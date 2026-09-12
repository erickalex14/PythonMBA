import pandas as pd
import logging
import datetime
import time
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from typing import Optional
from app.repositories.mba3_repository import IMba3Repository


def codigo_sin_sufijo_empresa(producto_id_corp: str, corp: str) -> str:
    """
    PRODUCTO_ID_CORP viene como "código-EMPRESA" (HANDOFF.md: la empresa no es
    una columna, es un sufijo del código). La columna "Corp" ya trae esa
    empresa aparte, asi que el sufijo ahi es redundante. Solo se recorta si
    coincide con el "Corp" de esa misma fila -- si no coincide (dato raro o
    ya viene sin sufijo) se deja tal cual, para no cortar de mas.
    """
    sufijo = f"-{corp}"
    return producto_id_corp[:-len(sufijo)] if producto_id_corp.upper().endswith(sufijo.upper()) else producto_id_corp


class LiquidacionesService:
    """
    Servicio de Reglas de Negocio para Liquidaciones e Importaciones.
    Implementa consulta híbrida (PostgreSQL local para histórico y ERP para tiempo real).
    """
    def __init__(self, repository: IMba3Repository):
        self.repository = repository
        
    def obtener_liquidaciones(self, fecha_inicio: str, fecha_fin: str, db: Optional[Session] = None) -> pd.DataFrame:
        logging.info(f"Service: Iniciando extracción de liquidaciones híbrida desde {fecha_inicio} hasta {fecha_fin}")
        
        try:
            dt_inicio = datetime.datetime.strptime(fecha_inicio, "%Y-%m-%d")
            dt_fin = datetime.datetime.strptime(fecha_fin, "%Y-%m-%d")
        except Exception as e:
            logging.error(f"Service: Formato de fechas no válido en liquidaciones: {e}")
            return pd.DataFrame()

        hoy = datetime.date.today()
        dt_hoy = datetime.datetime.combine(hoy, datetime.time.min)

        # Separar rangos
        rango_local_inicio = dt_inicio
        rango_local_fin = min(dt_fin, dt_hoy - datetime.timedelta(days=1))
        
        df_historico = pd.DataFrame()

        # 1. CONSULTA DEL HISTÓRICO DESDE POSTGRESQL (Staging DB View)
        if rango_local_inicio <= rango_local_fin:
            close_db_manually = False
            if db is None:
                db = SessionLocal()
                close_db_manually = True

            inicio_str = rango_local_inicio.strftime('%Y-%m-%d')
            fin_str = rango_local_fin.strftime('%Y-%m-%d')
            logging.info(f"Service [Liquidaciones]: Consultando histórico en PostgreSQL local ({inicio_str} a {fin_str})")

            try:
                query_sql = """
                    SELECT * FROM view_liquidaciones_reporte 
                    WHERE liquidacion_fecha BETWEEN :inicio AND :fin
                """
                with db.get_bind().connect() as conn:
                    result = conn.execute(text(query_sql), {"inicio": inicio_str, "fin": fin_str})
                    rows = result.fetchall()
                    keys = result.keys()
                    
                if rows:
                    df_historico = pd.DataFrame([dict(zip(keys, row)) for row in rows])
                    # Estandarizar nombres de columnas a mayúsculas
                    df_historico.columns = df_historico.columns.str.upper()
                    # Renombrar ID_RECEPCION_RELACIONADA para mantener compatibilidad
                    df_historico.rename(columns={"ID_RECEPCION_RELACIONADA": "IdRecepcionRelacionada"}, inplace=True)
                    # Parsear la fecha de Postgres a string YYYY-MM-DD para compatibilidad
                    if "LIQUIDACION_FECHA" in df_historico.columns:
                        df_historico["LIQUIDACION_FECHA"] = df_historico["LIQUIDACION_FECHA"].astype(str)
                    logging.info(f"Service [Liquidaciones]: Histórico recuperado de local. Registros: {len(df_historico)}")
            except Exception as e:
                logging.error(f"Service [Liquidaciones]: Error consultando la vista SQL local: {e}")
            finally:
                if close_db_manually:
                    db.close()

        # 2. CONSULTA DEL TIEMPO REAL DE HOY DESDE EL ERP MBA3
        df_hoy = pd.DataFrame()
        if dt_fin >= dt_hoy:
            fecha_hoy_str = dt_hoy.strftime('%Y-%m-%d')
            logging.info(f"Service [Liquidaciones]: Rango incluye HOY ({fecha_hoy_str}). Solicitando al ERP MBA3...")

            token_actual = self.repository.obtener_token()
            if token_actual:
                cols_cabecera = "CORP,LIQUIDACION_FECHA,OBSERVACIONES,ANTES_TOTAL_1,ANTES_TOTAL_2,ANTES_TOTAL_3,DESPUES_TOTAL_1,DESPUES_TOTAL_2,DESPUES_TOTAL_3,LIQUIDACION_ESTADO,LIQUIDACION_ID_CORP"
                cols_productos = "FACTURA_ID_CORP,IdRecepcionRelacionada,VALOR_TOTAL_CIF,VALOR_SUBTOTAL_CIF,VALOR_ANTES_1,VALOR_ANTES_2,VALOR_ANTES_3,VALOR_DESPUES_1,VALOR_DESPUES_2,VALOR_DESPUES_3,PARTIDA_ID_CORP,PRODUCTO_ID_CORP,LIQUIDACION_ID,CANTIDAD,PRECIO,TOTAL,VALOR_TOTAL_CIF_MANUAL,VALOR_TOTAL_CIF_UNIDAD,LIQUIDACION_ID_CORP"
                
                condicion_cabecera = f"CORP = 'NVC01' AND LIQUIDACION_ESTADO = True AND LIQUIDACION_FECHA = '{fecha_hoy_str}'"
                
                # Obtener cabeceras de hoy
                datos_cab = self.repository.ejecutar_consulta(
                    token=token_actual,
                    select=cols_cabecera,
                    table="PROV_Liquidaciones_Principal",
                    where=condicion_cabecera,
                    limit=2000
                )

                if datos_cab:
                    df_cab_hoy = pd.DataFrame(datos_cab)
                    df_cab_hoy['LIQUIDACION_ID_CORP'] = df_cab_hoy['LIQUIDACION_ID_CORP'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()

                    # Extraer IDs de liquidación de hoy para productos
                    lista_ids_hoy = df_cab_hoy['LIQUIDACION_ID_CORP'].tolist()
                    if lista_ids_hoy:
                        or_conds = " OR ".join([f"LIQUIDACION_ID_CORP = '{liq}'" for liq in lista_ids_hoy])
                        condicion_prod = f"({or_conds})"

                        # Obtener productos de hoy
                        datos_prod = self.repository.ejecutar_consulta(
                            token=token_actual,
                            select=cols_productos,
                            table="PROV_Liquidaciones_Productos",
                            where=condicion_prod,
                            limit=5000
                        )

                        if datos_prod:
                            df_prod_hoy = pd.DataFrame(datos_prod)
                            df_prod_hoy['LIQUIDACION_ID_CORP'] = df_prod_hoy['LIQUIDACION_ID_CORP'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()

                            # Cruce de hoy
                            df_cruce_hoy = pd.merge(df_cab_hoy, df_prod_hoy, on='LIQUIDACION_ID_CORP', how='inner')
                            df_hoy = df_cruce_hoy

        # 3. CONSOLIDACIÓN Y NORMALIZACIÓN FINAL
        df_consolidado = pd.DataFrame()
        if not df_historico.empty and not df_hoy.empty:
            df_consolidado = pd.concat([df_historico, df_hoy], ignore_index=True)
        elif not df_historico.empty:
            df_consolidado = df_historico
        elif not df_hoy.empty:
            df_consolidado = df_hoy

        # Formatear columnas finales para consistencia visual
        if not df_consolidado.empty:
            columnas_finales = [
                "CORP", "LIQUIDACION_FECHA", "OBSERVACIONES", "FACTURA_ID_CORP",
                "IdRecepcionRelacionada", "ANTES_TOTAL_1", "ANTES_TOTAL_2", "ANTES_TOTAL_3",
                "DESPUES_TOTAL_1", "DESPUES_TOTAL_2", "DESPUES_TOTAL_3", "VALOR_TOTAL_CIF",
                "VALOR_SUBTOTAL_CIF", "VALOR_ANTES_1", "VALOR_ANTES_2", "VALOR_ANTES_3",
                "VALOR_DESPUES_1", "VALOR_DESPUES_2", "VALOR_DESPUES_3", "PARTIDA_ID_CORP",
                "PRODUCTO_ID_CORP", "LIQUIDACION_ID", "CANTIDAD", "PRECIO", "TOTAL",
                "VALOR_TOTAL_CIF_MANUAL", "VALOR_TOTAL_CIF_UNIDAD", "LIQUIDACION_ESTADO",
                "LIQUIDACION_ID_CORP"
            ]
            
            # Asegurar la existencia de todas las columnas (llenando con valores vacíos si faltan)
            for col in columnas_finales:
                if col not in df_consolidado.columns:
                    df_consolidado[col] = None

            df_final = df_consolidado[columnas_finales].copy()

            # Nombre del producto y código sin el sufijo de empresa (pedido en
            # la revisión del reporte, 2026-09-11). PRODUCTO_ID_CORP viene como
            # "código-EMPRESA" (HANDOFF.md: la empresa no es una columna, es un
            # sufijo del código) y esa columna "Corp" ya existe aparte, asi que
            # el sufijo ahi es redundante. El nombre no lo trae el ERP para
            # liquidaciones (PROV_Liquidaciones_Productos no tiene esa
            # columna) -- se toma de ventas_kardex_staging, que ya lo trae
            # sincronizado para el mismo codigo. Cobertura: solo productos que
            # ya tuvieron alguna venta: uno recien importado puede salir sin
            # nombre todavia.
            df_final["PRODUCTO_CODIGO"] = df_final.apply(
                lambda r: codigo_sin_sufijo_empresa(r["PRODUCTO_ID_CORP"], r["CORP"]), axis=1
            )
            try:
                with SessionLocal() as db_nombres:
                    filas_nombre = db_nombres.execute(text(
                        "SELECT DISTINCT ON (product_id_corp) product_id_corp, product_name "
                        "FROM ventas_kardex_staging WHERE product_name IS NOT NULL "
                        "ORDER BY product_id_corp, trans_date DESC"
                    )).fetchall()
                mapa_nombres = {fila[0]: fila[1] for fila in filas_nombre}
            except Exception as e:
                logging.error(f"Service [Liquidaciones]: No se pudo obtener nombres de producto: {e}")
                mapa_nombres = {}
            df_final["PRODUCTO_NOMBRE"] = df_final["PRODUCTO_ID_CORP"].map(mapa_nombres).fillna("")

            # Limpiar strings de caracteres nulos
            str_cols = [
                "CORP", "OBSERVACIONES", "FACTURA_ID_CORP", "IdRecepcionRelacionada",
                "PARTIDA_ID_CORP", "PRODUCTO_ID_CORP", "LIQUIDACION_ID", "LIQUIDACION_ID_CORP",
                "PRODUCTO_CODIGO", "PRODUCTO_NOMBRE"
            ]
            for col in str_cols:
                if col in df_final.columns:
                    df_final[col] = df_final[col].fillna("").astype(str).str.replace(r'\.0$', '', regex=True).str.replace('\x00', '').str.strip()

            # Parsear numéricos
            numeric_cols = [
                "ANTES_TOTAL_1", "ANTES_TOTAL_2", "ANTES_TOTAL_3", 
                "DESPUES_TOTAL_1", "DESPUES_TOTAL_2", "DESPUES_TOTAL_3", 
                "VALOR_TOTAL_CIF", "VALOR_SUBTOTAL_CIF", "VALOR_ANTES_1", 
                "VALOR_ANTES_2", "VALOR_ANTES_3", "VALOR_DESPUES_1", 
                "VALOR_DESPUES_2", "VALOR_DESPUES_3", "CANTIDAD", 
                "PRECIO", "TOTAL", "VALOR_TOTAL_CIF_MANUAL", "VALOR_TOTAL_CIF_UNIDAD"
            ]
            for col in numeric_cols:
                if col in df_final.columns:
                    df_final[col] = pd.to_numeric(df_final[col], errors='coerce').fillna(0.0)

            # Nombre del proveedor: ninguna tabla de Liquidaciones/Importaciones
            # lo trae. Camino real probado contra PRUEBAS (2026-09-12):
            # FACTURA_ID_CORP -> PROV_Factura_Principal.DOC_ID_CORP -> VENDOR_ID
            # -> PROV_Ficha_Principal.VENDOR_ID -> VENDOR_NAME. Se resuelve aca,
            # al armar el reporte, no en el sync -- evita migrar el staging y
            # la vista SQL, y backfillear el historico, por un dato de
            # exhibicion. Si el ERP no responde o al servicio le falta el
            # permiso de esas 2 tablas (008), la columna queda en blanco: no
            # se cae el reporte por esto.
            df_final["PROVEEDOR_NOMBRE"] = self._resolver_nombres_proveedor(df_final["FACTURA_ID_CORP"])

            return df_final

        return pd.DataFrame()

    def _resolver_nombres_proveedor(self, facturas: pd.Series) -> pd.Series:
        """
        Dado un Series de FACTURA_ID_CORP, devuelve el nombre del proveedor de
        cada una (o "" si no se pudo resolver). 2 consultas batch (factura ->
        vendor_id, vendor_id -> nombre) con OR, no una por fila -- el ERP no
        soporta IN(). Cualquier fallo (ERP caido, tabla sin permiso, token
        vencido) devuelve todo en blanco; nunca lanza.

        Se consulta el entorno PRUEBAS a proposito, no el que use el resto del
        servicio (normalmente PROD). Confirmado el 2026-09-12: PRUEBAS refleja
        los mismos datos reales de NVC01 (misma LIQ-000002363, mismos montos,
        mismo proveedor que el Excel de Contabilidad) -- no es data ficticia.
        El VPS de PROD no llega al ERP de PROD (192.168.80.190:8081 rechaza
        conexion, problema de red ya reportado); PRUEBAS si es alcanzable y ya
        tiene habilitadas PROV_Factura_Principal/PROV_Ficha_Principal. Es un
        parche hasta que arreglen esa red -- volver a sin argumento (el env
        por defecto) cuando PROD sea alcanzable otra vez.
        """
        vacio = pd.Series([""] * len(facturas), index=facturas.index)
        facturas_unicas = [f for f in facturas.dropna().unique().tolist() if f]
        if not facturas_unicas:
            return vacio

        try:
            token = self.repository.obtener_token(env="PRUEBAS")
            if not token:
                return vacio

            or_facturas = " OR ".join(f"DOC_ID_CORP = '{f}'" for f in facturas_unicas)
            datos_factura = self.repository.ejecutar_consulta(
                token=token, select="DOC_ID_CORP,VENDOR_ID", table="PROV_Factura_Principal",
                where=f"CORP = 'NVC01' AND ({or_facturas})", limit=len(facturas_unicas) + 10,
                env="PRUEBAS",
            )
            factura_a_vendor = {d["DOC_ID_CORP"]: d["VENDOR_ID"] for d in (datos_factura or []) if d.get("VENDOR_ID")}
            if not factura_a_vendor:
                return vacio

            vendors_unicos = list({v for v in factura_a_vendor.values() if v})
            or_vendors = " OR ".join(f"VENDOR_ID = '{v}'" for v in vendors_unicos)
            datos_vendor = self.repository.ejecutar_consulta(
                token=token, select="VENDOR_ID,VENDOR_NAME", table="PROV_Ficha_Principal",
                where=f"CORP = 'NVC01' AND ({or_vendors})", limit=len(vendors_unicos) + 10,
                env="PRUEBAS",
            )
            vendor_a_nombre = {d["VENDOR_ID"]: d.get("VENDOR_NAME", "") for d in (datos_vendor or [])}

            return facturas.map(lambda f: vendor_a_nombre.get(factura_a_vendor.get(f, ""), ""))
        except Exception as e:
            logging.error(f"Service [Liquidaciones]: No se pudo resolver nombre de proveedor: {e}")
            return vacio

