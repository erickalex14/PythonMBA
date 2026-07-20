import pandas as pd
import logging
import datetime
import re
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from typing import Optional
from app.repositories.mba3_repository import IMba3Repository

class VentasService:
    """
    Servicio de Reglas de Negocio para el Reporte de Ventas Espejo.
    Implementa consultas híbridas de alta velocidad con cache local de staging e integración de tiempo real.
    """
    def __init__(self, repository: IMba3Repository):
        self.repository = repository

    def obtener_ventas_espejo(self, fecha_inicio: str, fecha_fin: str, db: Optional[Session] = None) -> pd.DataFrame:
        logging.info(f"VentasService: Iniciando extracción híbrida de Ventas Espejo desde {fecha_inicio} hasta {fecha_fin}")
        
        try:
            dt_inicio = datetime.datetime.strptime(fecha_inicio, "%Y-%m-%d")
            dt_fin = datetime.datetime.strptime(fecha_fin, "%Y-%m-%d")
        except Exception as e:
            logging.error(f"VentasService: Formato de fechas no válido: {e}")
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
            logging.info(f"VentasService: Consultando histórico en PostgreSQL local ({inicio_str} a {fin_str})")

            try:
                query_sql = """
                    SELECT
                        factura_final AS "# de factura",
                        fecha AS "FECHA",
                        empresa_nombre AS "EMPRESA",
                        sucursal AS "SUCURSAL",
                        codigo AS "CODIGO",
                        producto AS "PRODUCTO",
                        grupo AS "GRUPO",
                        subgrupo AS "SUBGRUPO",
                        unidad AS "UNIDAD",
                        cantidad AS "CANTIDAD",
                        precio_venta AS "PRECIO VENTA",
                        subtotal AS "SUBTOTAL (C*PV)",
                        descuento_aplicado AS "DESCUENTO APLICADO",
                        total_linea AS "TOTAL LINEA",
                        bodega_codigo AS "BODEGA",
                        bodega_nombre AS "BODEGA NOMBRE",
                        codigo_cliente AS "CODIGO CLIENTE",
                        nombre_cliente AS "NOMBRE CLIENTE",
                        costo_unitario AS "COSTO UNITARIO",
                        costo_total AS "COSTO TOTAL",
                        utilidad_unidad AS "UTILIDAD UNIDAD",
                        utilidad_total AS "UTILIDAD TOTAL",
                        pct_utilidad_neto AS "% UTILIDAD/NETO",
                        pct_utilidad_costo AS "% UTILIDAD/COSTO"
                    FROM view_ventas_espejo_reporte
                    WHERE fecha BETWEEN :inicio AND :fin
                    ORDER BY factura_final, codigo
                """
                with db.get_bind().connect() as conn:
                    result = conn.execute(text(query_sql), {"inicio": inicio_str, "fin": fin_str})
                    rows = result.fetchall()
                    keys = result.keys()

                if rows:
                    df_historico = pd.DataFrame([dict(zip(keys, row)) for row in rows])
                    # Convertir la fecha a string para compatibilidad
                    if "FECHA" in df_historico.columns:
                        df_historico["FECHA"] = df_historico["FECHA"].astype(str)
                    logging.info(f"VentasService: Histórico recuperado de Postgres. Registros: {len(df_historico)}")
            except Exception as e:
                logging.error(f"VentasService: Error consultando la vista SQL local: {e}")
            finally:
                if close_db_manually:
                    db.close()

        # 2. CONSULTA DEL TIEMPO REAL DE HOY DESDE EL ERP MBA3
        df_realtime = pd.DataFrame()
        if dt_fin >= dt_hoy:
            fecha_hoy_str = dt_hoy.strftime('%Y-%m-%d')
            logging.info(f"VentasService: Rango incluye HOY ({fecha_hoy_str}). Solicitando al ERP en tiempo real...")

            token = self.repository.obtener_token()
            if token:
                cols_movs = (
                    "DOC_ID_CORP,TRANS_DATE,PRODUCT_ID_CORP,PRODUCT_NAME,QUANTITY,ORIGINAL_QTY,"
                    "UNIT_COST,DISCOUNT_AMOUNT,NET_LINE_TOTAL,UM,Anulada,IN_OUT,"
                    "\"Codigo grupo\",\"Codigo subgrupo\",Codigo_grupo,Codigo_subgrupo,"
                    "TRANS_COST,WAR_CODE,COD_CLIENTE,Info_Seriales"
                )
                cols_facturas = "CODIGO_FACTURA,NUMERO_FACTURA,FECHA_FACTURA"
                
                # Consultar Kardex para hoy
                datos_movs = self.repository.ejecutar_consulta(
                    token=token,
                    select=cols_movs,
                    table="INVT_Producto_Movimientos",
                    where=f"TRANS_DATE = '{fecha_hoy_str}'",
                    limit=50000
                )
                
                # Consultar Facturas para hoy
                datos_facturas = self.repository.ejecutar_consulta(
                    token=token,
                    select=cols_facturas,
                    table="CLNT_Factura_Principal",
                    where=f"FECHA_FACTURA = '{fecha_hoy_str}'",
                    limit=20000
                )

                if datos_movs:
                    df_movs = pd.DataFrame(datos_movs)
                    
                    # Normalizar nombres de columnas del ERP
                    mapeo_movs = {c.replace(" ", "").replace("_", "").upper(): c for c in df_movs.columns}
                    col_movs_doc = mapeo_movs.get("DOCIDCORP")
                    col_codigo_prod = mapeo_movs.get("PRODUCTIDCORP")
                    col_nombre_prod = mapeo_movs.get("PRODUCTNAME")
                    col_orig_qty = mapeo_movs.get("ORIGINALQTY")
                    col_qty = mapeo_movs.get("QUANTITY")
                    col_seriales = mapeo_movs.get("INFOSERIALES")
                    col_grupo = mapeo_movs.get("CODIGOGRUPO")
                    col_subgrupo = mapeo_movs.get("CODIGOSUBGRUPO")
                    col_precio = mapeo_movs.get("UNITCOST")
                    col_descuento = mapeo_movs.get("DISCOUNTAMOUNT")
                    col_total_linea = mapeo_movs.get("NETLINETOTAL")
                    col_um = mapeo_movs.get("UM")
                    col_anulada = mapeo_movs.get("ANULADA")
                    col_costo = mapeo_movs.get("TRANSCOST")
                    col_bodega = mapeo_movs.get("WARCODE")
                    col_cliente = mapeo_movs.get("CODCLIENTE")

                    df_movs = df_movs.rename(columns={
                        col_movs_doc: 'DOC_ID_CORP_KARDEX',
                        col_codigo_prod: 'CODIGO_INT',
                        col_nombre_prod: 'PRODUCTO_INT',
                        col_orig_qty: 'ORIGQTY_INT',
                        col_qty: 'QTY_INT',
                        col_seriales: 'SERIALES_INT',
                        col_grupo: 'GRUPO_INT',
                        col_subgrupo: 'SUBGRUPO_INT',
                        col_precio: 'PRECIO_INT',
                        col_descuento: 'DESCUENTO_INT',
                        col_total_linea: 'TOTAL_INT',
                        col_um: 'UM_INT',
                        col_anulada: 'ANULADA_INT',
                        col_costo: 'COSTO_INT',
                        col_bodega: 'BODEGA_INT',
                        col_cliente: 'CLIENTE_INT'
                    })

                    # QUANTITY es la cantidad real (ver misma verificacion en la vista SQL de
                    # historico: match exacto 1219/1219 contra el reporte nativo del ERP).
                    # ORIGINAL_QTY no representa cantidad vendida, no usarlo.
                    df_movs['CANTIDAD_INT'] = pd.to_numeric(df_movs.get('QTY_INT'), errors='coerce').fillna(0.0) if 'QTY_INT' in df_movs.columns else 0.0

                    df_facturas = pd.DataFrame(datos_facturas) if datos_facturas else pd.DataFrame()
                    if not df_facturas.empty:
                        mapeo_fact = {c.replace(" ", "").replace("_", "").upper(): c for c in df_facturas.columns}
                        col_fact_id = mapeo_fact.get("CODIGOFACTURA")
                        col_fact_ref = mapeo_fact.get("NUMEROFACTURA")

                        df_facturas = df_facturas.rename(columns={
                            col_fact_id: 'DOC_ID_CORP_FACT',
                            col_fact_ref: 'NUMERO_FACTURA_REAL'
                        })

                        # Higiene radical de llaves numéricas para el cruce
                        def limpiar_llave_numerica(val):
                            if pd.isna(val): return ""
                            numeros = re.findall(r'\d+', str(val))
                            return "".join(numeros) if numeros else str(val).strip()

                        df_movs['KEY_CRUCE_KARDEX'] = df_movs['DOC_ID_CORP_KARDEX'].apply(limpiar_llave_numerica)
                        df_facturas['KEY_CRUCE_FACT'] = df_facturas['DOC_ID_CORP_FACT'].apply(limpiar_llave_numerica)

                        df_consolidado = pd.merge(df_movs, df_facturas, left_on='KEY_CRUCE_KARDEX', right_on='KEY_CRUCE_FACT', how='left')
                        df_consolidado['FACTURA_FINAL'] = df_consolidado['NUMERO_FACTURA_REAL'].fillna(df_consolidado['DOC_ID_CORP_KARDEX'])
                    else:
                        df_consolidado = df_movs.copy()
                        df_consolidado['FACTURA_FINAL'] = df_consolidado['DOC_ID_CORP_KARDEX']

                    # Fallback manual para vacíos
                    df_consolidado['FACTURA_FINAL'] = df_consolidado.apply(
                        lambda r: r['DOC_ID_CORP_KARDEX'] if str(r.get('FACTURA_FINAL', '')).strip().upper() in ['NAN', 'NONE', ''] else r['FACTURA_FINAL'],
                        axis=1
                    )

                    # Higiene de tipos y strings
                    df_consolidado['FACTURA_FINAL'] = df_consolidado['FACTURA_FINAL'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()
                    df_consolidado['CODIGO_INT'] = df_consolidado['CODIGO_INT'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()
                    df_consolidado['PRODUCTO_INT'] = df_consolidado['PRODUCTO_INT'].astype(str).str.strip().str.upper()
                    df_consolidado['UM_INT'] = df_consolidado['UM_INT'].astype(str).str.strip().str.upper() if 'UM_INT' in df_consolidado.columns else 'UNID'

                    df_consolidado['CANTIDAD_INT'] = pd.to_numeric(df_consolidado['CANTIDAD_INT'], errors='coerce').fillna(0)
                    df_consolidado['PRECIO_INT'] = pd.to_numeric(df_consolidado['PRECIO_INT'], errors='coerce').fillna(0.0)
                    df_consolidado['DESCUENTO_INT'] = pd.to_numeric(df_consolidado['DESCUENTO_INT'], errors='coerce').fillna(0.0)
                    df_consolidado['TOTAL_INT'] = pd.to_numeric(df_consolidado['TOTAL_INT'], errors='coerce').fillna(0.0)
                    df_consolidado['COSTO_INT'] = pd.to_numeric(df_consolidado.get('COSTO_INT'), errors='coerce').fillna(0.0) if 'COSTO_INT' in df_consolidado.columns else 0.0
                    df_consolidado['BODEGA_INT'] = df_consolidado['BODEGA_INT'].astype(str).str.strip() if 'BODEGA_INT' in df_consolidado.columns else ''
                    df_consolidado['CLIENTE_INT'] = df_consolidado['CLIENTE_INT'].astype(str).str.strip() if 'CLIENTE_INT' in df_consolidado.columns else ''

                    def evaluar_anulada(val):
                        if pd.isna(val): return False
                        if isinstance(val, bool): return val
                        return str(val).strip().lower() in ['true', '1', 't', 's', 'si', 'y']

                    df_consolidado['IS_ANULADA'] = df_consolidado['ANULADA_INT'].apply(evaluar_anulada) if 'ANULADA_INT' in df_consolidado.columns else False

                    # Filtro de negocio
                    df_filtrado = df_consolidado[
                        (df_consolidado['IS_ANULADA'] == False) &
                        (df_consolidado['CANTIDAD_INT'] > 0)
                    ].copy()

                    if not df_filtrado.empty:
                        df_filtrado['CANTIDAD_INT'] = df_filtrado['CANTIDAD_INT'].round(0).astype(int)
                        df_filtrado['SUBTOTAL_INT'] = df_filtrado['CANTIDAD_INT'] * df_filtrado['PRECIO_INT']
                        df_filtrado['TOTAL_INT'] = df_filtrado.apply(
                            lambda r: r['TOTAL_INT'] if r['TOTAL_INT'] > 0 else (r['SUBTOTAL_INT'] - r['DESCUENTO_INT']), axis=1
                        )

                        df_realtime['# de factura'] = df_filtrado['FACTURA_FINAL']
                        df_realtime['FECHA'] = df_filtrado['TRANS_DATE'].astype(str)
                        # El path en tiempo real (hoy) aún no resuelve empresa/sucursal por factura.
                        df_realtime['EMPRESA'] = 'N/D'
                        df_realtime['SUCURSAL'] = 'N/D'
                        df_realtime['CODIGO'] = df_filtrado['CODIGO_INT']
                        df_realtime['PRODUCTO'] = df_filtrado['PRODUCTO_INT']
                        df_realtime['GRUPO'] = df_filtrado['GRUPO_INT'].fillna('GENERAL')
                        df_realtime['SUBGRUPO'] = df_filtrado['SUBGRUPO_INT'].fillna('GENERAL')
                        df_realtime['UNIDAD'] = df_filtrado['UM_INT']
                        df_realtime['CANTIDAD'] = df_filtrado['CANTIDAD_INT']
                        df_realtime['PRECIO VENTA'] = df_filtrado['PRECIO_INT'].round(4)
                        df_realtime['SUBTOTAL (C*PV)'] = df_filtrado['SUBTOTAL_INT'].round(4)
                        df_realtime['DESCUENTO APLICADO'] = df_filtrado['DESCUENTO_INT'].round(4)
                        df_realtime['TOTAL LINEA'] = df_filtrado['TOTAL_INT'].round(4)

                        # Costo/utilidad si; nombre de cliente/bodega aun no se resuelven en el path de hoy.
                        costo_total = (df_filtrado['CANTIDAD_INT'] * df_filtrado['COSTO_INT'])
                        utilidad_total = df_filtrado['TOTAL_INT'] - costo_total
                        df_realtime['BODEGA'] = df_filtrado['BODEGA_INT']
                        df_realtime['BODEGA NOMBRE'] = 'N/D'
                        df_realtime['CODIGO CLIENTE'] = df_filtrado['CLIENTE_INT']
                        df_realtime['NOMBRE CLIENTE'] = 'N/D'
                        df_realtime['COSTO UNITARIO'] = df_filtrado['COSTO_INT'].round(4)
                        df_realtime['COSTO TOTAL'] = costo_total.round(4)
                        df_realtime['UTILIDAD UNIDAD'] = (df_filtrado['PRECIO_INT'] - df_filtrado['COSTO_INT']).round(4)
                        df_realtime['UTILIDAD TOTAL'] = utilidad_total.round(4)
                        # pd.NA en un Series float64 lo sube a dtype object (rompe .round()) -
                        # float('nan') mantiene el dtype numerico y se comporta igual para esto.
                        df_realtime['% UTILIDAD/NETO'] = (utilidad_total / df_filtrado['TOTAL_INT'].replace(0, float('nan')) * 100).round(2)
                        df_realtime['% UTILIDAD/COSTO'] = (utilidad_total / costo_total.replace(0, float('nan')) * 100).round(2)

        # 3. CONSOLIDACIÓN FINAL
        if df_historico.empty and df_realtime.empty:
            return pd.DataFrame()
        elif df_historico.empty:
            df_final = df_realtime
        elif df_realtime.empty:
            df_final = df_historico
        else:
            df_final = pd.concat([df_historico, df_realtime], ignore_index=True)

        df_final = df_final.sort_values(by=['# de factura', 'CODIGO'], ascending=[True, True])
        return df_final

    def obtener_resumen_dashboard(self, fecha_ancla: str, db: Optional[Session] = None) -> dict:
        """
        Resumen agregado para las cards del dashboard (hoy/ayer/semana/mes/año,
        calendario, ancladas a `fecha_ancla` = el "hoy real" que ya calcula el
        front por atraso de sync). Suma en SQL contra la vista de staging, sin
        traer las líneas crudas al front - evita mover un año completo de filas
        solo para calcular totales.
        """
        ancla = datetime.datetime.strptime(fecha_ancla, "%Y-%m-%d").date()
        ayer = ancla - datetime.timedelta(days=1)
        inicio_semana = ancla - datetime.timedelta(days=ancla.weekday())
        inicio_mes = ancla.replace(day=1)
        inicio_anio = ancla.replace(month=1, day=1)

        close_db_manually = False
        if db is None:
            db = SessionLocal()
            close_db_manually = True

        try:
            query_sql = """
                SELECT
                    SUM(CASE WHEN fecha = :hoy THEN total_linea ELSE 0 END) AS monto_hoy,
                    SUM(CASE WHEN fecha = :hoy THEN cantidad ELSE 0 END) AS cantidad_hoy,
                    SUM(CASE WHEN fecha = :ayer THEN total_linea ELSE 0 END) AS monto_ayer,
                    SUM(CASE WHEN fecha = :ayer THEN cantidad ELSE 0 END) AS cantidad_ayer,
                    SUM(CASE WHEN fecha BETWEEN :inicio_semana AND :hoy THEN total_linea ELSE 0 END) AS monto_semana,
                    SUM(CASE WHEN fecha BETWEEN :inicio_semana AND :hoy THEN cantidad ELSE 0 END) AS cantidad_semana,
                    SUM(CASE WHEN fecha BETWEEN :inicio_mes AND :hoy THEN total_linea ELSE 0 END) AS monto_mes,
                    SUM(CASE WHEN fecha BETWEEN :inicio_mes AND :hoy THEN cantidad ELSE 0 END) AS cantidad_mes,
                    SUM(CASE WHEN fecha BETWEEN :inicio_anio AND :hoy THEN total_linea ELSE 0 END) AS monto_anio,
                    SUM(CASE WHEN fecha BETWEEN :inicio_anio AND :hoy THEN cantidad ELSE 0 END) AS cantidad_anio
                FROM view_ventas_espejo_reporte
                WHERE fecha BETWEEN :inicio_anio AND :hoy
            """
            params = {
                "hoy": ancla.isoformat(),
                "ayer": ayer.isoformat(),
                "inicio_semana": inicio_semana.isoformat(),
                "inicio_mes": inicio_mes.isoformat(),
                "inicio_anio": inicio_anio.isoformat(),
            }
            with db.get_bind().connect() as conn:
                row = conn.execute(text(query_sql), params).mappings().first()

            def rango(monto_key: str, cantidad_key: str, inicio: datetime.date, fin: datetime.date) -> dict:
                return {
                    "monto": float(row[monto_key] or 0) if row else 0.0,
                    "cantidad": int(row[cantidad_key] or 0) if row else 0,
                    "rango": {"inicio": inicio.isoformat(), "fin": fin.isoformat()},
                }

            resumen = {
                "hoy": rango("monto_hoy", "cantidad_hoy", ancla, ancla),
                "ayer": rango("monto_ayer", "cantidad_ayer", ayer, ayer),
                "semana": rango("monto_semana", "cantidad_semana", inicio_semana, ancla),
                "mes": rango("monto_mes", "cantidad_mes", inicio_mes, ancla),
                "anio": rango("monto_anio", "cantidad_anio", inicio_anio, ancla),
            }

            # Producto más vendido del mes en curso (cantidad y monto, cada uno con su propio ganador).
            query_top = """
                SELECT producto, SUM(cantidad) AS total_cantidad, SUM(total_linea) AS total_monto
                FROM view_ventas_espejo_reporte
                WHERE fecha BETWEEN :inicio_mes AND :hoy
                GROUP BY producto
            """
            with db.get_bind().connect() as conn:
                top_rows = conn.execute(
                    text(query_top),
                    {"inicio_mes": inicio_mes.isoformat(), "hoy": ancla.isoformat()},
                ).mappings().all()

            top_cantidad = None
            top_monto = None
            if top_rows:
                df_top = pd.DataFrame([dict(r) for r in top_rows])
                df_top["total_cantidad"] = pd.to_numeric(df_top["total_cantidad"], errors="coerce").fillna(0)
                df_top["total_monto"] = pd.to_numeric(df_top["total_monto"], errors="coerce").fillna(0)
                fila_cantidad = df_top.loc[df_top["total_cantidad"].idxmax()]
                fila_monto = df_top.loc[df_top["total_monto"].idxmax()]
                top_cantidad = {
                    "producto": fila_cantidad["producto"],
                    "cantidad": int(fila_cantidad["total_cantidad"]),
                    "monto": float(fila_cantidad["total_monto"]),
                }
                top_monto = {
                    "producto": fila_monto["producto"],
                    "cantidad": int(fila_monto["total_cantidad"]),
                    "monto": float(fila_monto["total_monto"]),
                }

            resumen["top_producto_cantidad"] = top_cantidad
            resumen["top_producto_monto"] = top_monto
            return resumen
        finally:
            if close_db_manually:
                db.close()
