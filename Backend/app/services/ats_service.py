import pandas as pd
import logging
import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from typing import Optional
from app.repositories.mba3_repository import IMba3Repository

class AtsService:
    """
    Servicio de Reglas de Negocio para el Reporte Fiscal ATS.
    Cruza Facturas con Proveedores e Info Fiscal, ejecutando filtros lógicos en RAM.
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

        # 1. CONSULTA DE HISTÓRICO DESDE POSTGRESQL (Staging DB View)
        if rango_local_inicio <= rango_local_fin:
            close_db_manually = False
            if db is None:
                db = SessionLocal()
                close_db_manually = True

            inicio_str = rango_local_inicio.strftime('%Y-%m-%d')
            fin_str = rango_local_fin.strftime('%Y-%m-%d')
            logging.info(f"Service [ATS]: Consultando histórico en PostgreSQL local ({inicio_str} a {fin_str})")

            try:
                # view_ats_reporte ya tiene pre-calculados los campos y cruzado Facturas con Proveedores e Info Fiscal
                # y pre-filtrado por f.confirmed=True, f.void=False, fi.mf_bool5=False
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
                    # Estandarizar columnas a MAYÚSCULAS para compatibilidad
                    df_historico.columns = df_historico.columns.str.upper()
                    # Parsear la fecha de Postgres a string YYYY-MM-DD para compatibilidad
                    if "INVOICE_DATE" in df_historico.columns:
                        df_historico["INVOICE_DATE"] = df_historico["INVOICE_DATE"].astype(str)
                    logging.info(f"Service [ATS]: Histórico recuperado de local. Registros: {len(df_historico)}")
            except Exception as e:
                logging.error(f"Service [ATS]: Error consultando la vista SQL local: {e}")
            finally:
                if close_db_manually:
                    db.close()

        # 2. CONSULTA DEL TIEMPO REAL DE HOY DESDE EL ERP MBA3
        df_hoy = pd.DataFrame()
        if dt_fin >= dt_hoy:
            fecha_hoy_str = dt_hoy.strftime('%Y-%m-%d')
            logging.info(f"Service [ATS]: Rango incluye HOY ({fecha_hoy_str}). Solicitando al ERP MBA3...")

            token = self.repository.obtener_token()
            if token:
                cols_factura = "INVOICE_DATE,CORP,VENDOR_ID,MEMO,INVOICE_TOTAL,DOC_REFERENCE,TotalProductosConIVa,TotalServiciosConIVa,TotalProductosSinIVa,TotalServiciosSinIVa,VOID,DOC_ID_CORP,CONFIRMED"
                cols_proveedor = "VENDOR_ID,VENDOR_NAME,RUC_or_FED_ID"
                cols_fiscal = "MF_Nume1,MF_Alfa2,MF_Lista2,MF_Bool5,ID_Relacionado"

                where_factura = f"INVOICE_DATE = '{fecha_hoy_str}'"

                datos_factura = self.repository.ejecutar_consulta(
                    token=token,
                    select=cols_factura,
                    table="PROV_Factura_Principal",
                    where=where_factura,
                    limit=2000
                )

                if datos_factura:
                    df_facturas_hoy = pd.DataFrame(datos_factura)
                    df_facturas_hoy['VENDOR_ID'] = df_facturas_hoy['VENDOR_ID'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()
                    df_facturas_hoy['DOC_ID_CORP'] = df_facturas_hoy['DOC_ID_CORP'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()

                    # Catálogo de Proveedores completo (petición rápida)
                    datos_proveedor = self.repository.ejecutar_consulta(
                        token=token,
                        select=cols_proveedor,
                        table="PROV_Ficha_Principal",
                        limit=100000
                    )
                    
                    if datos_proveedor:
                        df_proveedores_hoy = pd.DataFrame(datos_proveedor)
                        df_proveedores_hoy['VENDOR_ID'] = df_proveedores_hoy['VENDOR_ID'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()
                        df_proveedores_hoy = df_proveedores_hoy.drop_duplicates(subset=['VENDOR_ID'])

                        # Info Fiscal de hoy basándonos en los IDs de hoy
                        lista_doc_ids = df_facturas_hoy['DOC_ID_CORP'].tolist()
                        if lista_doc_ids:
                            or_conds = " OR ".join([f"ID_Relacionado = '{doc}'" for doc in lista_doc_ids])
                            condicion_fiscal = f"({or_conds}) AND MF_Bool5 = 0"

                            datos_fiscal = self.repository.ejecutar_consulta(
                                token=token,
                                select=cols_fiscal,
                                table="CONT_Info_Fiscal",
                                where=condicion_fiscal,
                                limit=5000
                            )

                            if datos_fiscal:
                                df_fiscal_hoy = pd.DataFrame(datos_fiscal)
                                df_fiscal_hoy['ID_Relacionado'] = df_fiscal_hoy['ID_Relacionado'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()

                                # Cruces relacionales en RAM de hoy
                                df_cruce_hoy = pd.merge(df_facturas_hoy, df_proveedores_hoy, on='VENDOR_ID', how='inner')
                                df_cruce_hoy = pd.merge(df_cruce_hoy, df_fiscal_hoy, left_on='DOC_ID_CORP', right_on='ID_Relacionado', how='inner')

                                def parse_bool(val):
                                    if pd.isna(val): return False
                                    return str(val).strip().lower() in ['true', '1', 't', 'y', 'yes']

                                df_cruce_hoy['CONFIRMED_BOOL'] = df_cruce_hoy['CONFIRMED'].apply(parse_bool) if 'CONFIRMED' in df_cruce_hoy.columns else False
                                df_cruce_hoy['VOID_BOOL'] = df_cruce_hoy['VOID'].apply(parse_bool) if 'VOID' in df_cruce_hoy.columns else False
                                df_cruce_hoy['MF_Bool5_BOOL'] = df_cruce_hoy['MF_Bool5'].apply(parse_bool) if 'MF_Bool5' in df_cruce_hoy.columns else False

                                # Filtrar líneas netas válidas
                                df_cruce_hoy = df_cruce_hoy[
                                    (df_cruce_hoy['CONFIRMED_BOOL'] == True) &
                                    (df_cruce_hoy['VOID_BOOL'] == False) &
                                    (df_cruce_hoy['MF_Bool5_BOOL'] == False)
                                ]

                                if not df_cruce_hoy.empty:
                                    df_cruce_hoy['ES_ANULADO'] = df_cruce_hoy['VOID_BOOL'].apply(lambda x: 1 if x else 0)
                                    df_cruce_hoy['SUMA_CON_IVA'] = pd.to_numeric(df_cruce_hoy['TotalProductosConIVa'], errors='coerce').fillna(0) + pd.to_numeric(df_cruce_hoy['TotalServiciosConIVa'], errors='coerce').fillna(0)
                                    df_cruce_hoy['SUMA_SIN_IVA'] = pd.to_numeric(df_cruce_hoy['TotalProductosSinIVa'], errors='coerce').fillna(0) + pd.to_numeric(df_cruce_hoy['TotalServiciosSinIVa'], errors='coerce').fillna(0)
                                    df_hoy = df_cruce_hoy

        # 3. CONSOLIDACIÓN Y NORMALIZACIÓN FINAL
        df_consolidado = pd.DataFrame()
        if not df_historico.empty and not df_hoy.empty:
            df_consolidado = pd.concat([df_historico, df_hoy], ignore_index=True)
        elif not df_historico.empty:
            df_consolidado = df_historico
        elif not df_hoy.empty:
            df_consolidado = df_hoy

        if not df_consolidado.empty:
            columnas_finales = [
                "INVOICE_DATE", "CORP", "VENDOR_ID", "VENDOR_NAME", "RUC_or_FED_ID",
                "MEMO", "INVOICE_TOTAL", "DOC_REFERENCE", "MF_Nume1", "MF_Alfa2",
                "MF_Lista2", "SUMA_CON_IVA", "SUMA_SIN_IVA", "ES_ANULADO", "MF_Bool5",
                "DOC_ID_CORP", "ID_Relacionado"
            ]

            # Asegurar existencia de todas las columnas finales
            for col in columnas_finales:
                if col not in df_consolidado.columns:
                    df_consolidado[col] = None

            df_final = df_consolidado[columnas_finales].copy()

            # Normalizar columnas string
            str_cols = ["CORP", "VENDOR_ID", "VENDOR_NAME", "RUC_or_FED_ID", "MEMO", "DOC_REFERENCE", "MF_Alfa2", "MF_Lista2", "DOC_ID_CORP", "ID_Relacionado"]
            for col in str_cols:
                if col in df_final.columns:
                    df_final[col] = df_final[col].fillna("").astype(str).str.strip()

            # Parsear monetarios y numéricos
            numeric_cols = ["INVOICE_TOTAL", "MF_Nume1", "SUMA_CON_IVA", "SUMA_SIN_IVA", "ES_ANULADO"]
            for col in numeric_cols:
                if col in df_final.columns:
                    df_final[col] = pd.to_numeric(df_final[col], errors='coerce').fillna(0.0)

            # Ordenar por lista fiscal, fecha y referencia de documento
            sort_cols = ['MF_Lista2', 'INVOICE_DATE', 'DOC_REFERENCE']
            available_sort_cols = [c for c in sort_cols if c in df_final.columns]
            if available_sort_cols:
                df_final = df_final.sort_values(
                    by=available_sort_cols,
                    ascending=[True] * len(available_sort_cols)
                )

            return df_final.head(100000)

        return pd.DataFrame()
