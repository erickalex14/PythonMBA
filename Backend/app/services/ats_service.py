import pandas as pd
import logging
import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from typing import Optional
from app.repositories.mba3_repository import IMba3Repository

# Mapeo columna de la vista/staging (lowercase Postgres) -> nombre de salida esperado por el front.
# Se aplica igual al histórico (Postgres) y al tiempo real (ERP), evitando el desalineo por
# el viejo str.upper() que dejaba RUC/MF_* en None en el histórico.
MAP_OUT = {
    "corp": "CORP",
    "invoice_date": "INVOICE_DATE",
    "vendor_id": "VENDOR_ID",
    "vendor_name": "VENDOR_NAME",
    "ruc_or_fed_id": "RUC_or_FED_ID",
    "doc_reference": "DOC_REFERENCE",
    "memo": "MEMO",
    "invoice_total": "INVOICE_TOTAL",
    "total_productos_con_iva": "TotalProductosConIVa",
    "total_servicios_con_iva": "TotalServiciosConIVa",
    "total_productos_sin_iva": "TotalProductosSinIVa",
    "total_servicios_sin_iva": "TotalServiciosSinIVa",
    "mf_alfa3": "MF_Alfa3",
    "mf_nume1": "MF_Nume1",
    "mf_alfa2": "MF_Alfa2",
    "mf_lista2": "MF_Lista2",
    "reservado1": "Reservado1",
    "reservado2": "Reservado2",
    "reservado3": "Reservado3",
    "codigo_proveedor_empresa": "CODIGO_PROVEEDOR_EMPRESA",
    "vendor_id_corp": "VENDOR_ID_CORP",
    "doc_id_corp": "DOC_ID_CORP",
    "id_relacionado": "ID_Relacionado",
    "suma_con_iva": "SUMA_CON_IVA",
    "suma_sin_iva": "SUMA_SIN_IVA",
    "es_anulado": "ES_ANULADO",
    "mf_bool5": "MF_Bool5",
    "confirmed": "CONFIRMED",
    "void": "VOID",
}

# Orden final de columnas de salida.
COLUMNAS_FINALES = list(MAP_OUT.values())

STR_COLS = ["CORP", "VENDOR_ID", "VENDOR_NAME", "RUC_or_FED_ID", "MEMO", "DOC_REFERENCE",
            "MF_Alfa2", "MF_Alfa3", "MF_Lista2", "CODIGO_PROVEEDOR_EMPRESA", "VENDOR_ID_CORP",
            "DOC_ID_CORP", "ID_Relacionado"]
NUM_COLS = ["INVOICE_TOTAL", "MF_Nume1", "SUMA_CON_IVA", "SUMA_SIN_IVA", "ES_ANULADO",
            "TotalProductosConIVa", "TotalServiciosConIVa", "TotalProductosSinIVa", "TotalServiciosSinIVa"]
BOOL_COLS = ["Reservado1", "Reservado2", "Reservado3", "MF_Bool5", "CONFIRMED", "VOID"]


class AtsService:
    """
    Servicio de Reglas de Negocio para el Reporte Fiscal ATS.
    Cruza Facturas con Proveedores e Info Fiscal por la llave vendor-empresa.
    Trae TODO (confirmadas y no, anuladas y no); el front aplica los filtros.
    """
    def __init__(self, repository: IMba3Repository):
        self.repository = repository

    def obtener_ats(self, fecha_inicio: str, fecha_fin: str, db: Optional[Session] = None) -> pd.DataFrame:
        logging.info(f"Service: Iniciando extracción de ATS híbrida desde {fecha_inicio} hasta {fecha_fin}")

        try:
            dt_inicio = datetime.datetime.strptime(fecha_inicio, "%Y-%m-%d")
            dt_fin = datetime.datetime.strptime(fecha_fin, "%Y-%m-%d")
        except Exception as e:
            logging.error(f"Service: Formato de fechas no válido en ATS: {e}")
            return pd.DataFrame()

        hoy = datetime.date.today()
        dt_hoy = datetime.datetime.combine(hoy, datetime.time.min)

        rango_local_inicio = dt_inicio
        rango_local_fin = min(dt_fin, dt_hoy - datetime.timedelta(days=1))

        df_historico = pd.DataFrame()

        # 1. HISTÓRICO DESDE POSTGRESQL (vista pre-cruzada)
        if rango_local_inicio <= rango_local_fin:
            close_db_manually = False
            if db is None:
                db = SessionLocal()
                close_db_manually = True

            inicio_str = rango_local_inicio.strftime('%Y-%m-%d')
            fin_str = rango_local_fin.strftime('%Y-%m-%d')
            logging.info(f"Service [ATS]: Consultando histórico en PostgreSQL local ({inicio_str} a {fin_str})")

            try:
                query_sql = """
                    SELECT * FROM view_ats_reporte
                    WHERE invoice_date BETWEEN :inicio AND :fin
                """
                with db.get_bind().connect() as conn:
                    result = conn.execute(text(query_sql), {"inicio": inicio_str, "fin": fin_str})
                    rows = result.fetchall()
                    keys = result.keys()

                if rows:
                    df_historico = pd.DataFrame([dict(zip(keys, row)) for row in rows])
                    # Renombrar de lowercase (Postgres) a los nombres de salida.
                    df_historico = df_historico.rename(columns={k: v for k, v in MAP_OUT.items() if k in df_historico.columns})
                    if "INVOICE_DATE" in df_historico.columns:
                        df_historico["INVOICE_DATE"] = df_historico["INVOICE_DATE"].astype(str)
                    logging.info(f"Service [ATS]: Histórico recuperado de local. Registros: {len(df_historico)}")
            except Exception as e:
                logging.error(f"Service [ATS]: Error consultando la vista SQL local: {e}")
            finally:
                if close_db_manually:
                    db.close()

        # 2. TIEMPO REAL DE HOY DESDE EL ERP (si el rango incluye hoy, aún sin sincronizar)
        df_hoy = pd.DataFrame()
        if dt_fin >= dt_hoy:
            fecha_hoy_str = dt_hoy.strftime('%Y-%m-%d')
            logging.info(f"Service [ATS]: Rango incluye HOY ({fecha_hoy_str}). Solicitando al ERP MBA3...")
            df_hoy = self._obtener_hoy_erp(fecha_hoy_str)

        # 3. CONSOLIDACIÓN Y NORMALIZACIÓN
        if not df_historico.empty and not df_hoy.empty:
            df_consolidado = pd.concat([df_historico, df_hoy], ignore_index=True)
        elif not df_historico.empty:
            df_consolidado = df_historico
        elif not df_hoy.empty:
            df_consolidado = df_hoy
        else:
            return pd.DataFrame()

        # Asegurar todas las columnas de salida
        for col in COLUMNAS_FINALES:
            if col not in df_consolidado.columns:
                df_consolidado[col] = None

        df_final = df_consolidado[COLUMNAS_FINALES].copy()

        for col in STR_COLS:
            df_final[col] = df_final[col].fillna("").astype(str).str.strip()
        for col in NUM_COLS:
            df_final[col] = pd.to_numeric(df_final[col], errors='coerce').fillna(0.0)
        for col in BOOL_COLS:
            df_final[col] = df_final[col].apply(_to_bool)

        sort_cols = [c for c in ['MF_Lista2', 'INVOICE_DATE', 'DOC_REFERENCE'] if c in df_final.columns]
        if sort_cols:
            df_final = df_final.sort_values(by=sort_cols, ascending=[True] * len(sort_cols))

        return df_final.head(100000)

    def _obtener_hoy_erp(self, fecha_hoy_str: str) -> pd.DataFrame:
        token = self.repository.obtener_token()
        if not token:
            return pd.DataFrame()

        cols_factura = ("INVOICE_DATE,CORP,VENDOR_ID,VENDOR_ID_CORP,MEMO,INVOICE_TOTAL,DOC_REFERENCE,"
                        "TotalProductosConIVa,TotalServiciosConIVa,TotalProductosSinIVa,TotalServiciosSinIVa,VOID,DOC_ID_CORP,CONFIRMED")
        cols_proveedor = "VENDOR_ID,CODIGO_PROVEEDOR_EMPRESA,VENDOR_NAME,RUC_or_FED_ID"
        cols_fiscal = "MF_Nume1,MF_Alfa2,MF_Alfa3,MF_Lista2,MF_Bool5,Reservado1,Reservado2,Reservado3,ID_Relacionado"

        datos_factura = self.repository.ejecutar_consulta(
            token=token, select=cols_factura, table="PROV_Factura_Principal",
            where=f"INVOICE_DATE = '{fecha_hoy_str}'", limit=2000
        )
        if not datos_factura:
            return pd.DataFrame()

        df_fact = pd.DataFrame(datos_factura)
        df_fact['VENDOR_ID_CORP'] = df_fact['VENDOR_ID_CORP'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper() if 'VENDOR_ID_CORP' in df_fact.columns else ""
        df_fact['DOC_ID_CORP'] = df_fact['DOC_ID_CORP'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()

        datos_prov = self.repository.ejecutar_consulta(
            token=token, select=cols_proveedor, table="PROV_Ficha_Principal", limit=100000
        )
        if not datos_prov:
            return pd.DataFrame()
        df_prov = pd.DataFrame(datos_prov)
        df_prov['CODIGO_PROVEEDOR_EMPRESA'] = df_prov['CODIGO_PROVEEDOR_EMPRESA'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()
        df_prov = df_prov.drop_duplicates(subset=['CODIGO_PROVEEDOR_EMPRESA'])

        lista_doc_ids = df_fact['DOC_ID_CORP'].tolist()
        if not lista_doc_ids:
            return pd.DataFrame()
        or_conds = " OR ".join([f"ID_Relacionado = '{doc}'" for doc in lista_doc_ids])
        datos_fiscal = self.repository.ejecutar_consulta(
            token=token, select=cols_fiscal, table="CONT_Info_Fiscal",
            where=f"({or_conds})", limit=5000
        )
        if not datos_fiscal:
            return pd.DataFrame()
        df_fisc = pd.DataFrame(datos_fiscal)
        df_fisc['ID_Relacionado'] = df_fisc['ID_Relacionado'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()

        # Cruce vendor-empresa + fiscal (mismo JOIN que la vista)
        df = pd.merge(df_fact, df_prov, left_on='VENDOR_ID_CORP', right_on='CODIGO_PROVEEDOR_EMPRESA', how='inner')
        df = pd.merge(df, df_fisc, left_on='DOC_ID_CORP', right_on='ID_Relacionado', how='inner')
        if df.empty:
            return df

        # Campos derivados de compat
        df['ES_ANULADO'] = df['VOID'].apply(lambda v: 1 if _to_bool(v) else 0)
        df['SUMA_CON_IVA'] = pd.to_numeric(df['TotalProductosConIVa'], errors='coerce').fillna(0) + pd.to_numeric(df['TotalServiciosConIVa'], errors='coerce').fillna(0)
        df['SUMA_SIN_IVA'] = pd.to_numeric(df['TotalProductosSinIVa'], errors='coerce').fillna(0) + pd.to_numeric(df['TotalServiciosSinIVa'], errors='coerce').fillna(0)
        return df


def _to_bool(val):
    if pd.isna(val):
        return False
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ['true', '1', 't', 'y', 'yes', 's', 'si']
