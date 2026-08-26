import pandas as pd
import logging
import datetime
import re
from zoneinfo import ZoneInfo
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from typing import Optional
from app.repositories.mba3_repository import IMba3Repository

# Productos que ensucian los rankings: material promocional/regalo y servicios.
# Salen en cantidades enormes o con montos irrisorios y tapan a los productos
# que de verdad interesan. Se compara contra el nombre en mayusculas, asi que
# "GLOBO" tambien atrapa "PORTAGLOBOS". Para excluir otro tipo, agregarlo aqui:
# lo usan tanto los tops del dashboard como las hojas Top del Excel.
PATRONES_PRODUCTO_RUIDO = ("GLOBO", "FUNDA", "SERVICIO")

# Bodega de consumo interno: lo que sale por aqui se lo consume la propia tienda
# (globos, portaglobos, material de local), no un cliente. El ERP igual lo marca
# origin_memo='CLIENTES', asi que suma como venta. No se descuenta -- se reporta
# aparte, igual que las devoluciones, para poder leerlo.
BODEGA_AUTOCONSUMO = "31A"


def es_producto_ruido(nombre) -> bool:
    texto = str(nombre or "").upper()
    return any(patron in texto for patron in PATRONES_PRODUCTO_RUIDO)


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
                    "UNIT_COST,DISCOUNT_AMOUNT,NET_LINE_TOTAL,UM,Anulada,IN_OUT,ORIGIN_MEMO,"
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
                    col_origin_memo = mapeo_movs.get("ORIGINMEMO")

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
                        col_cliente: 'CLIENTE_INT',
                        col_origin_memo: 'ORIGIN_MEMO_INT'
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

                    # ORIGIN_MEMO = tipo de movimiento. Sin este filtro se contaban tambien
                    # transferencias entre bodegas y otros movimientos de inventario como si
                    # fueran ventas (mismo criterio que la vista SQL del historico, que ya
                    # filtra k.origin_memo = 'CLIENTES').
                    df_consolidado['ORIGIN_MEMO_INT'] = (
                        df_consolidado['ORIGIN_MEMO_INT'].astype(str).str.strip().str.upper()
                        if 'ORIGIN_MEMO_INT' in df_consolidado.columns else ''
                    )

                    # Filtro de negocio
                    df_filtrado = df_consolidado[
                        (df_consolidado['IS_ANULADA'] == False) &
                        (df_consolidado['CANTIDAD_INT'] > 0) &
                        (df_consolidado['ORIGIN_MEMO_INT'] == 'CLIENTES')
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
                        # El NaN resultante se sanea a None mas abajo, junto con el resto del
                        # dataframe final (el historico via SQL NULLIF tambien puede traer NaN).
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

        # NaN/Infinity no son JSON valido (Starlette los rechaza al serializar la
        # respuesta) - pueden venir del calculo en tiempo real (division por cero)
        # o del historico via SQL NULLIF (SQL NULL se carga como NaN en pandas).
        # OJO: Series.where(cond, None) sobre una columna float64 NO guarda None -
        # pandas la vuelve a convertir a NaN silenciosamente (no hace upcast solo).
        # Por eso primero se castea todo a object (ahi None si se mantiene tal cual).
        df_final = df_final.replace([float('inf'), float('-inf')], float('nan'))
        mask_validos = df_final.notna()
        df_final = df_final.astype(object).where(mask_validos, None)
        return df_final

    def obtener_dashboard_ventas(self, db: Optional[Session] = None, fecha_ancla: Optional[str] = None) -> dict:
        """
        Todo lo que necesita el dashboard de ventas en UNA llamada: totales por
        rango (hoy / ayer / semana / 15 dias / mes / año), su comparacion real
        contra el periodo anterior equivalente, y el top de productos por
        cantidad y por dinero en cada rango.

        Todo se agrega en SQL. El dashboard viejo bajaba ~45 MB de lineas crudas
        (ventas, movimientos, liquidaciones y ATS) y tardaba ~36s solo para
        calcular totales en el navegador; esto devuelve unos pocos KB.

        fecha_ancla: si no viene, se usa el ultimo dia con ventas registradas. El
        sync puede estar atrasado, asi que el dia del reloj no sirve como "hoy";
        antes el front pedia 14 dias de lineas (25s, 15 MB) solo para deducirlo.
        """
        close_db_manually = False
        if db is None:
            db = SessionLocal()
            close_db_manually = True

        try:
            with db.get_bind().connect() as conn:
                if fecha_ancla:
                    ancla = datetime.datetime.strptime(fecha_ancla, "%Y-%m-%d").date()
                else:
                    ancla = conn.execute(text("SELECT MAX(fecha) FROM view_ventas_espejo_reporte")).scalar()
                    if ancla is None:
                        return {"fecha_ancla": None, "rangos": [], "tops": {}}

                periodos = self._calcular_periodos(ancla)

                # Un solo escaneo: cada rango (actual y su comparativo) es un CASE.
                partes = []
                params = {}
                for clave, p in periodos.items():
                    for sufijo in ("act", "ant"):
                        desde, hasta = (p["desde"], p["hasta"]) if sufijo == "act" else (p["desde_ant"], p["hasta_ant"])
                        params[f"{clave}_{sufijo}_desde"] = desde.isoformat()
                        params[f"{clave}_{sufijo}_hasta"] = hasta.isoformat()
                        cond = f"fecha BETWEEN :{clave}_{sufijo}_desde AND :{clave}_{sufijo}_hasta"
                        partes.append(f"SUM(CASE WHEN {cond} THEN total_linea ELSE 0 END) AS {clave}_{sufijo}_monto")
                        partes.append(f"SUM(CASE WHEN {cond} THEN cantidad ELSE 0 END) AS {clave}_{sufijo}_cantidad")

                minimo = min(p["desde_ant"] for p in periodos.values())
                params["piso"] = minimo.isoformat()
                params["techo"] = ancla.isoformat()
                sql_totales = (f"SELECT {', '.join(partes)} FROM view_ventas_espejo_reporte "
                               f"WHERE fecha BETWEEN :piso AND :techo")
                fila = conn.execute(text(sql_totales), params).mappings().first()

                # Devoluciones: van aparte porque la vista de ventas filtra
                # origin_memo='CLIENTES' y no las incluye. Se leen del kardex con el
                # mismo recorte de rangos para poder mostrar bruto, devuelto y neto.
                partes_dev = []
                for clave in periodos:
                    for sufijo in ("act", "ant"):
                        cond = f"trans_date BETWEEN :{clave}_{sufijo}_desde AND :{clave}_{sufijo}_hasta"
                        partes_dev.append(
                            f"SUM(CASE WHEN {cond} THEN net_line_total ELSE 0 END) AS {clave}_{sufijo}_dev")
                sql_dev = (f"SELECT {', '.join(partes_dev)} FROM ventas_kardex_staging "
                           f"WHERE trans_date BETWEEN :piso AND :techo "
                           f"AND anulada = false AND origin_memo ILIKE 'Devoluci%'")
                fila_dev = conn.execute(text(sql_dev), params).mappings().first()

                rangos = []
                for clave, p in periodos.items():
                    monto = float(fila[f"{clave}_act_monto"] or 0)
                    monto_ant = float(fila[f"{clave}_ant_monto"] or 0)
                    dev = float(fila_dev[f"{clave}_act_dev"] or 0) if fila_dev else 0.0
                    dev_ant = float(fila_dev[f"{clave}_ant_dev"] or 0) if fila_dev else 0.0
                    neto = monto - dev
                    neto_ant = monto_ant - dev_ant
                    # "hoy" queda cortado en el ultimo sync del dia, asi que compararlo
                    # contra un dia completo siempre daria negativo: se marca en curso
                    # y se devuelve delta_pct=None para que el front no muestre %.
                    # Semana/mes/año tambien estan en curso pero su comparativo usa el
                    # mismo tramo del periodo anterior, asi que ahi el % si es justo.
                    rangos.append({
                        "clave": clave,
                        "etiqueta": p["etiqueta"],
                        "desde": p["desde"].isoformat(),
                        "hasta": p["hasta"].isoformat(),
                        "monto": monto,                      # ventas con devoluciones incluidas
                        "monto_devoluciones": dev,
                        "monto_neto": neto,                  # ventas descontando devoluciones
                        "cantidad": int(fila[f"{clave}_act_cantidad"] or 0),
                        "comparado_con": p["etiqueta_ant"],
                        "monto_anterior": monto_ant,
                        "monto_devoluciones_anterior": dev_ant,
                        "monto_neto_anterior": neto_ant,
                        "cantidad_anterior": int(fila[f"{clave}_ant_cantidad"] or 0),
                        "periodo_en_curso": clave == "hoy",
                        # None y no 0: sin periodo previo con ventas, el porcentaje
                        # no existe y el front debe mostrar "sin comparativo".
                        "delta_pct": (round((neto - neto_ant) / neto_ant * 100, 1)
                                      if neto_ant > 0 and clave != "hoy" else None),
                    })

                # Top de productos: se agrega por producto una sola vez sobre el
                # rango mas largo y se recorta por periodo en Python.
                sql_top = """
                    SELECT codigo, producto, empresa, fecha, SUM(cantidad) AS cantidad, SUM(total_linea) AS monto
                    FROM view_ventas_espejo_reporte
                    WHERE fecha BETWEEN :desde AND :hasta
                    GROUP BY codigo, producto, empresa, fecha
                """
                filas_top = conn.execute(text(sql_top), {
                    "desde": periodos["anio"]["desde"].isoformat(),
                    "hasta": ancla.isoformat(),
                }).mappings().all()

                # Hora de corte real: las ventas se sincronizan varias veces al dia,
                # asi que "ventas de hoy" siempre son "hasta el ultimo sync". Sale de
                # updated_at del staging, no de un texto fijo.
                corte = conn.execute(text(
                    "SELECT MAX(updated_at) FROM ventas_kardex_staging WHERE trans_date = :ancla"
                ), {"ancla": ancla.isoformat()}).scalar()
                if corte is None:
                    corte = conn.execute(text("SELECT MAX(updated_at) FROM ventas_kardex_staging")).scalar()

            tops = self._calcular_tops(filas_top, periodos)
            return {
                "fecha_ancla": ancla.isoformat(),
                "ultima_sincronizacion": self._a_hora_local(corte),
                "rangos": rangos,
                "tops": tops,
            }
        finally:
            if close_db_manually:
                db.close()

    def obtener_totales_rango(self, inicio: str, fin: str, db: Optional[Session] = None) -> dict:
        """
        Totales de un rango cualquiera con las devoluciones desglosadas, para los
        KPIs del reporte de Ventas.

        Las devoluciones salen del kardex y no de view_ventas_espejo_reporte: esa
        vista filtra origin_memo='CLIENTES', asi que el front no puede calcularlas
        con las lineas que ya tiene por mas que las sume.
        """
        # Periodo previo del mismo largo, para que el % de los KPIs sea real.
        d_ini = datetime.datetime.strptime(inicio, "%Y-%m-%d").date()
        d_fin = datetime.datetime.strptime(fin, "%Y-%m-%d").date()
        largo = (d_fin - d_ini).days + 1
        fin_ant = d_ini - datetime.timedelta(days=1)
        inicio_ant = fin_ant - datetime.timedelta(days=largo - 1)

        close_db_manually = False
        if db is None:
            db = SessionLocal()
            close_db_manually = True
        try:
            sql_venta = text("""
                SELECT COALESCE(SUM(total_linea), 0) AS monto,
                       COALESCE(SUM(cantidad), 0) AS cantidad
                FROM view_ventas_espejo_reporte
                WHERE fecha BETWEEN :inicio AND :fin
            """)
            sql_dev = text("""
                SELECT COALESCE(SUM(net_line_total), 0) AS monto,
                       COALESCE(SUM(ROUND(quantity)::integer), 0) AS cantidad
                FROM ventas_kardex_staging
                WHERE trans_date BETWEEN :inicio AND :fin
                  AND anulada = false AND origin_memo ILIKE 'Devoluci%'
            """)
            # Autoconsumo: la bodega 31A es consumo interno (globos, portaglobos,
            # material de tienda). Entra como origin_memo='CLIENTES', asi que ya
            # esta sumado dentro de `monto`; NO se resta, se expone aparte para
            # poder leer cuanto de la venta no salio a un cliente real.
            sql_auto = text("""
                SELECT COALESCE(SUM(total_linea), 0) AS monto,
                       COALESCE(SUM(cantidad), 0) AS cantidad
                FROM view_ventas_espejo_reporte
                WHERE fecha BETWEEN :inicio AND :fin
                  AND bodega_codigo = :bodega
            """)
            actual = {"inicio": inicio, "fin": fin}
            previo = {"inicio": inicio_ant.isoformat(), "fin": fin_ant.isoformat()}
            actual_auto = {**actual, "bodega": BODEGA_AUTOCONSUMO}

            # Desglose por empresa. En el kardex la empresa no es una columna: viene
            # como sufijo del codigo de producto ("1CENV153-NVC01"), asi que se
            # deriva de ahi para poder cruzarla con las ventas de la vista.
            sql_venta_emp = text("""
                SELECT empresa,
                       COALESCE(SUM(total_linea), 0) AS monto,
                       COALESCE(SUM(cantidad), 0) AS cantidad
                FROM view_ventas_espejo_reporte
                WHERE fecha BETWEEN :inicio AND :fin
                GROUP BY empresa
            """)
            sql_dev_emp = text("""
                SELECT CASE WHEN product_id_corp LIKE '%%-NVC01' THEN 'NVC01'
                            WHEN product_id_corp LIKE '%%-ENV01' THEN 'ENV01'
                            ELSE 'OTRO' END AS empresa,
                       COALESCE(SUM(net_line_total), 0) AS monto,
                       COALESCE(SUM(ROUND(quantity)::integer), 0) AS cantidad
                FROM ventas_kardex_staging
                WHERE trans_date BETWEEN :inicio AND :fin
                  AND anulada = false AND origin_memo ILIKE 'Devoluci%%'
                GROUP BY 1
            """)
            sql_auto_emp = text("""
                SELECT empresa,
                       COALESCE(SUM(total_linea), 0) AS monto,
                       COALESCE(SUM(cantidad), 0) AS cantidad
                FROM view_ventas_espejo_reporte
                WHERE fecha BETWEEN :inicio AND :fin
                  AND bodega_codigo = :bodega
                GROUP BY empresa
            """)

            with db.get_bind().connect() as conn:
                venta = conn.execute(sql_venta, actual).mappings().first()
                dev = conn.execute(sql_dev, actual).mappings().first()
                auto = conn.execute(sql_auto, actual_auto).mappings().first()
                venta_ant = conn.execute(sql_venta, previo).mappings().first()
                dev_ant = conn.execute(sql_dev, previo).mappings().first()
                ventas_emp = conn.execute(sql_venta_emp, actual).mappings().all()
                devs_emp = conn.execute(sql_dev_emp, actual).mappings().all()
                autos_emp = conn.execute(sql_auto_emp, actual_auto).mappings().all()

            monto = float(venta["monto"] or 0)
            monto_dev = float(dev["monto"] or 0)
            neto = monto - monto_dev
            neto_ant = float(venta_ant["monto"] or 0) - float(dev_ant["monto"] or 0)

            nombres = {"NVC01": "NOVICOMPU", "ENV01": "ENV"}
            ventas_por_emp = {r["empresa"]: r for r in ventas_emp}
            devs_por_emp = {r["empresa"]: r for r in devs_emp}
            autos_por_emp = {r["empresa"]: r for r in autos_emp}
            por_empresa = []
            for codigo in sorted(set(ventas_por_emp) | set(devs_por_emp)):
                v = ventas_por_emp.get(codigo)
                d = devs_por_emp.get(codigo)
                a = autos_por_emp.get(codigo)
                m = float(v["monto"] or 0) if v else 0.0
                md = float(d["monto"] or 0) if d else 0.0
                por_empresa.append({
                    "empresa": codigo,
                    "empresa_nombre": nombres.get(codigo, codigo),
                    "monto": m,
                    "monto_devoluciones": md,
                    "monto_neto": m - md,
                    "cantidad": int(v["cantidad"] or 0) if v else 0,
                    "cantidad_devoluciones": int(d["cantidad"] or 0) if d else 0,
                    # Ya incluido en `monto`, no se resta de `monto_neto`.
                    "monto_autoconsumos": float(a["monto"] or 0) if a else 0.0,
                    "cantidad_autoconsumos": int(a["cantidad"] or 0) if a else 0,
                })

            return {
                "inicio": inicio,
                "fin": fin,
                "monto": monto,
                "monto_devoluciones": monto_dev,
                "monto_neto": neto,
                "cantidad": int(venta["cantidad"] or 0),
                "cantidad_devoluciones": int(dev["cantidad"] or 0),
                # Dentro de `monto`, no restado: es venta que se consumio la propia
                # tienda (bodega 31A), no una devolucion.
                "monto_autoconsumos": float(auto["monto"] or 0),
                "cantidad_autoconsumos": int(auto["cantidad"] or 0),
                "comparado_con": f"{inicio_ant.isoformat()} a {fin_ant.isoformat()}",
                "monto_neto_anterior": neto_ant,
                # null si no hay periodo previo con ventas: es preferible a un 0%
                # que se leeria como "igual que antes".
                "delta_pct": round((neto - neto_ant) / neto_ant * 100, 1) if neto_ant > 0 else None,
                "por_empresa": por_empresa,
            }
        finally:
            if close_db_manually:
                db.close()

    @staticmethod
    def _a_hora_local(momento) -> Optional[str]:
        """
        Pasa el updated_at del staging a hora de Ecuador.

        Los contenedores corren en UTC y la columna es 'timestamp without time
        zone', asi que el valor guardado es UTC. Mostrarlo crudo adelantaria el
        corte 5 horas: el sync de las 12:00 se leeria como "hasta las 17:00".
        """
        if momento is None:
            return None
        if momento.tzinfo is None:
            momento = momento.replace(tzinfo=datetime.timezone.utc)
        return momento.astimezone(ZoneInfo("America/Guayaquil")).isoformat()

    @staticmethod
    def _calcular_periodos(ancla: datetime.date) -> dict:
        """Cada rango del dashboard con el periodo anterior equivalente para comparar."""
        un_dia = datetime.timedelta(days=1)
        ayer = ancla - un_dia
        inicio_semana = ancla - datetime.timedelta(days=ancla.weekday())
        dias_semana = (ancla - inicio_semana).days
        inicio_mes = ancla.replace(day=1)

        # Mes anterior: mismo tramo de dias (1 al mismo numero), recortado si el mes
        # anterior es mas corto - comparar un mes completo contra medio mes mentiria.
        fin_mes_ant = inicio_mes - un_dia
        inicio_mes_ant = fin_mes_ant.replace(day=1)
        hasta_mes_ant = inicio_mes_ant.replace(day=min(ancla.day, fin_mes_ant.day))

        inicio_anio = ancla.replace(month=1, day=1)
        try:
            hasta_anio_ant = ancla.replace(year=ancla.year - 1)
        except ValueError:  # 29 de febrero
            hasta_anio_ant = ancla.replace(year=ancla.year - 1, day=28)
        inicio_anio_ant = inicio_anio.replace(year=inicio_anio.year - 1)

        return {
            "hoy": {"etiqueta": "Hoy", "desde": ancla, "hasta": ancla,
                    "etiqueta_ant": "ayer", "desde_ant": ayer, "hasta_ant": ayer},
            "ayer": {"etiqueta": "Ayer", "desde": ayer, "hasta": ayer,
                     "etiqueta_ant": "anteayer", "desde_ant": ayer - un_dia, "hasta_ant": ayer - un_dia},
            "semana": {"etiqueta": "Esta semana", "desde": inicio_semana, "hasta": ancla,
                       "etiqueta_ant": "semana anterior",
                       "desde_ant": inicio_semana - datetime.timedelta(days=7),
                       "hasta_ant": inicio_semana - datetime.timedelta(days=7 - dias_semana)},
            "quincena": {"etiqueta": "Últimos 15 días", "desde": ancla - datetime.timedelta(days=14), "hasta": ancla,
                         "etiqueta_ant": "15 días previos",
                         "desde_ant": ancla - datetime.timedelta(days=29),
                         "hasta_ant": ancla - datetime.timedelta(days=15)},
            "mes": {"etiqueta": "Este mes", "desde": inicio_mes, "hasta": ancla,
                    "etiqueta_ant": "mes anterior", "desde_ant": inicio_mes_ant, "hasta_ant": hasta_mes_ant},
            "anio": {"etiqueta": "Este año", "desde": inicio_anio, "hasta": ancla,
                     "etiqueta_ant": "año anterior", "desde_ant": inicio_anio_ant, "hasta_ant": hasta_anio_ant},
        }

    @staticmethod
    def _calcular_tops(filas, periodos: dict, limite: int = 10) -> dict:
        """
        Top de productos por cantidad y por dinero en cada rango, consolidado
        ("general") y por empresa. La query trae ambas empresas de una sola
        pasada (columna `empresa`), asi que el desglose no cuesta una consulta
        extra: es la misma tabla agrupada dos veces en pandas.
        """
        vacio = {"cantidad": [], "dinero": []}
        vacio_por_clave = {clave: {"general": vacio, "por_empresa": {"NVC01": vacio, "ENV01": vacio}} for clave in periodos}
        if not filas:
            return vacio_por_clave

        df = pd.DataFrame([dict(f) for f in filas])
        df["fecha"] = pd.to_datetime(df["fecha"]).dt.date
        df["cantidad"] = pd.to_numeric(df["cantidad"], errors="coerce").fillna(0)
        df["monto"] = pd.to_numeric(df["monto"], errors="coerce").fillna(0)
        df["empresa"] = df["empresa"].astype(str).str.strip()

        # El ruido promocional se saca solo de los rankings; los totales por rango
        # se siguen calculando sobre todo, porque esa plata si se vendio.
        df = df[~df["producto"].apply(es_producto_ruido)]
        if df.empty:
            return vacio_por_clave

        # El mismo producto existe con sufijo por empresa ("1CENV153-NVC01" y
        # "-ENV01"). El "general" suma ambas bajo un solo codigo (sin unificar,
        # el ranking consolidado se llena de pares repetidos y muestra la mitad
        # de productos distintos); por empresa no hace falta sumar nada, cada
        # fila ya pertenece a una sola, pero se limpia el sufijo igual para que
        # el codigo se vea igual en ambas vistas.
        df["codigo"] = df["codigo"].astype(str).str.replace(r"-(NVC01|ENV01)$", "", regex=True)

        def top_de(sub_df: pd.DataFrame) -> dict:
            if sub_df.empty:
                return vacio
            agrupado = sub_df.groupby("codigo", as_index=False).agg(
                producto=("producto", "first"), cantidad=("cantidad", "sum"), monto=("monto", "sum"))
            return {
                "cantidad": agrupado.nlargest(limite, "cantidad").to_dict(orient="records"),
                "dinero": agrupado.nlargest(limite, "monto").to_dict(orient="records"),
            }

        tops = {}
        for clave, p in periodos.items():
            ventana = df[(df["fecha"] >= p["desde"]) & (df["fecha"] <= p["hasta"])]
            tops[clave] = {
                "general": top_de(ventana),
                "por_empresa": {
                    "NVC01": top_de(ventana[ventana["empresa"] == "NVC01"]),
                    "ENV01": top_de(ventana[ventana["empresa"] == "ENV01"]),
                },
            }
        return tops

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
