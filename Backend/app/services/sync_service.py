import logging
import datetime
import time
from sqlalchemy.orm import Session
from app.repositories.mba3_repository import IMba3Repository
from app.models.movimiento import MovimientoStaging
from app.models.liquidacion import LiquidacionPrincipalStaging, LiquidacionProductoStaging

class SyncService:
    def __init__(self, repository: IMba3Repository):
        self.repository = repository

    def sync_movimientos(self, db: Session, fecha_inicio: str, fecha_fin: str) -> dict:
        logging.info(f"SyncService: Iniciando sincronización de movimientos desde {fecha_inicio} hasta {fecha_fin}")
        
        try:
            dt_inicio = datetime.datetime.strptime(fecha_inicio, "%Y-%m-%d")
            dt_fin = datetime.datetime.strptime(fecha_fin, "%Y-%m-%d")
        except Exception as e:
            logging.error(f"SyncService: Formato de fechas inválido: {e}")
            return {"status": "error", "message": "Formato de fechas inválido (esperado YYYY-MM-DD)"}

        token_actual = self.repository.obtener_token()
        if not token_actual:
            logging.error("SyncService: No se pudo obtener el token inicial del ERP.")
            return {"status": "error", "message": "No se pudo conectar al ERP para obtener el token."}

        columnas = "TRANS_DATE,PRODUCT_NAME,Codigo_producto_convertido,ORIGINAL_QTY,ORIGIN_MEMO,ORIGIN_REF,BASE_COMISION,Info_Seriales,Codigo_Sucursal,BaseImponibleReal_1,COD_SALESMAN,Codigo_Marca"
        
        dt_actual = dt_inicio
        dias_totales = (dt_fin - dt_inicio).days + 1
        dia_contador = 1
        registros_sincronizados = 0

        while dt_actual <= dt_fin:
            fecha_str = dt_actual.strftime('%Y-%m-%d')
            logging.info(f"SyncService: Procesando día {dia_contador}/{dias_totales} (Fecha: {fecha_str})")
            
            condicion_where = f"TRANS_DATE = '{fecha_str}'"
            
            # Ejecutar con reintentos
            datos = None
            max_intentos_dia = 3
            intento_dia = 1
            
            while intento_dia <= max_intentos_dia:
                try:
                    # Intentar consulta
                    datos = self.repository.ejecutar_consulta(
                        token=token_actual,
                        select=columnas,
                        table="INVT_Producto_Movimientos",
                        where=condicion_where,
                        limit=50000
                    )
                    # Si no da error pero regresa None/vacío, intentamos refrescar token una vez
                    if datos is None:
                        logging.warning(f"SyncService: Intento {intento_dia} fallido para {fecha_str}. Refrescando token con login fresco...")
                        # Esperar 3 segundos antes del reintento de login para evitar rate limiting del Sophos/ERP
                        time.sleep(3)
                        nuevo_token = self.repository.obtener_token(force_refresh=True)
                        if nuevo_token:
                            token_actual = nuevo_token
                            continue # Reintentar el ciclo con el nuevo token
                    else:
                        break # Éxito en la consulta, salir del loop de reintentos
                except Exception as e:
                    logging.error(f"SyncService: Excepción en intento {intento_dia} para {fecha_str}: {e}")
                    time.sleep(3)
                    nuevo_token = self.repository.obtener_token(force_refresh=True)
                    if nuevo_token:
                        token_actual = nuevo_token
                
                intento_dia += 1
                time.sleep(1) # Esperar antes del reintento

            if datos is not None:
                # Transacción atómica por día: eliminar existentes e insertar nuevos
                try:
                    # 1. Eliminar registros del día actual
                    db.query(MovimientoStaging).filter(MovimientoStaging.trans_date == dt_actual.date()).delete()
                    
                    # 2. Mapear y preparar nuevos objetos
                    nuevos_movimientos = []
                    for item in datos:
                        def parse_float(val):
                            try:
                                return float(str(val).strip()) if val else 0.0
                            except:
                                return 0.0

                        def clean_str(val):
                            if val is None:
                                return None
                            # Eliminar caracteres nulos que PostgreSQL no tolera
                            return str(val).replace('\x00', '').replace('\u0000', '').strip()

                        mov = MovimientoStaging(
                            trans_date=dt_actual.date(),
                            product_name=clean_str(item.get("PRODUCT_NAME")),
                            codigo_producto_convertido=clean_str(item.get("Codigo_producto_convertido")),
                            original_qty=parse_float(item.get("ORIGINAL_QTY")),
                            origin_memo=clean_str(item.get("ORIGIN_MEMO")),
                            origin_ref=clean_str(item.get("ORIGIN_REF")),
                            base_comision=parse_float(item.get("BASE_COMISION")),
                            info_seriales=clean_str(item.get("Info_Seriales")),
                            codigo_sucursal=clean_str(item.get("Codigo_Sucursal")),
                            base_imponible_real_1=parse_float(item.get("BaseImponibleReal_1")),
                            cod_salesman=clean_str(item.get("COD_SALESMAN")),
                            codigo_marca=clean_str(item.get("Codigo_Marca"))
                        )
                        nuevos_movimientos.append(mov)

                    if nuevos_movimientos:
                        db.bulk_save_objects(nuevos_movimientos)
                    
                    db.commit()
                    registros_sincronizados += len(nuevos_movimientos)
                    logging.info(f"SyncService: Día {fecha_str} sincronizado con éxito. Registros: {len(nuevos_movimientos)}")
                except Exception as e:
                    db.rollback()
                    logging.error(f"SyncService: Error escribiendo día {fecha_str} en base de datos: {e}")
                    # Continuamos con el siguiente día en lugar de abortar todo el semestre
            else:
                logging.error(f"SyncService: No se pudieron obtener datos del ERP para el día {fecha_str} tras {max_intentos_dia} intentos.")

            dt_actual += datetime.timedelta(days=1)
            dia_contador += 1
            time.sleep(0.3)  # Delay preventivo para el ERP

        return {
            "status": "success",
            "message": f"Sincronización completada. Total de registros procesados: {registros_sincronizados}",
            "records_count": registros_sincronizados
        }

    def sync_liquidaciones(self, db: Session, fecha_inicio: str, fecha_fin: str) -> dict:
        logging.info(f"SyncService: Iniciando sincronización masiva de liquidaciones desde {fecha_inicio} hasta {fecha_fin}")
        
        try:
            dt_inicio = datetime.datetime.strptime(fecha_inicio, "%Y-%m-%d")
            dt_fin = datetime.datetime.strptime(fecha_fin, "%Y-%m-%d")
        except Exception as e:
            logging.error(f"SyncService: Formato de fechas inválido en liquidaciones: {e}")
            return {"status": "error", "message": "Formato de fechas inválido (esperado YYYY-MM-DD)"}

        token_actual = self.repository.obtener_token()
        if not token_actual:
            logging.error("SyncService: No se pudo obtener el token inicial para liquidaciones.")
            return {"status": "error", "message": "No se pudo conectar al ERP para obtener el token."}

        cols_cabecera = "CORP,LIQUIDACION_FECHA,OBSERVACIONES,ANTES_TOTAL_1,ANTES_TOTAL_2,ANTES_TOTAL_3,DESPUES_TOTAL_1,DESPUES_TOTAL_2,DESPUES_TOTAL_3,LIQUIDACION_ESTADO,LIQUIDACION_ID_CORP"
        cols_productos = "FACTURA_ID_CORP,IdRecepcionRelacionada,VALOR_TOTAL_CIF,VALOR_SUBTOTAL_CIF,VALOR_ANTES_1,VALOR_ANTES_2,VALOR_ANTES_3,VALOR_DESPUES_1,VALOR_DESPUES_2,VALOR_DESPUES_3,PARTIDA_ID_CORP,PRODUCTO_ID_CORP,LIQUIDACION_ID,CANTIDAD,PRECIO,TOTAL,VALOR_TOTAL_CIF_MANUAL,VALOR_TOTAL_CIF_UNIDAD,LIQUIDACION_ID_CORP"

        def parse_float(val):
            try:
                return float(str(val).strip()) if val else 0.0
            except:
                return 0.0

        def clean_str(val):
            if val is None:
                return None
            return str(val).replace('\x00', '').replace('\u0000', '').strip()

        # 1. Traer cabeceras del rango de fechas completo
        condicion_cabecera = f"CORP = 'NVC01' AND LIQUIDACION_ESTADO = True AND LIQUIDACION_FECHA >= '{fecha_inicio}' AND LIQUIDACION_FECHA <= '{fecha_fin}'"
        
        logging.info(f"SyncService [Liquidaciones]: Solicitando cabeceras del ERP para todo el rango.")
        datos_cabecera = self.repository.ejecutar_consulta(
            token=token_actual,
            select=cols_cabecera,
            table="PROV_Liquidaciones_Principal",
            where=condicion_cabecera,
            limit=50000
        )

        if datos_cabecera is None:
            # Reintentar una vez con token fresco si falla
            token_actual = self.repository.obtener_token(force_refresh=True)
            datos_cabecera = self.repository.ejecutar_consulta(
                token=token_actual,
                select=cols_cabecera,
                table="PROV_Liquidaciones_Principal",
                where=condicion_cabecera,
                limit=50000
            )

        if not datos_cabecera:
            logging.info("SyncService [Liquidaciones]: No se encontraron cabeceras en el ERP para este rango.")
            return {
                "status": "success",
                "message": "Sincronización completada. No había datos en este rango.",
                "cabeceras_count": 0,
                "productos_count": 0
            }

        # Extraer IDs de liquidaciones únicos
        lista_ids = []
        for c in datos_cabecera:
            liq_id = clean_str(c.get("LIQUIDACION_ID_CORP"))
            if liq_id:
                lista_ids.append(liq_id.replace('.0', '').strip().upper())
        lista_ids = list(set(lista_ids))

        # 2. Descargar los productos de estas liquidaciones en lotes pequeños (de 30 IDs máximo por consulta)
        # para no superar el límite de longitud de consulta URL de Sophos
        datos_productos = []
        tamanio_lote = 30
        lotes_ids = [lista_ids[i:i + tamanio_lote] for i in range(0, len(lista_ids), tamanio_lote)]

        for index, lote in enumerate(lotes_ids):
            or_conds = " OR ".join([f"LIQUIDACION_ID_CORP = '{liq}'" for liq in lote])
            condicion_prod = f"({or_conds})"

            logging.info(f"SyncService [Liquidaciones]: Solicitando lote de productos {index+1}/{len(lotes_ids)} ({len(lote)} IDs)...")
            lote_datos = self.repository.ejecutar_consulta(
                token=token_actual,
                select=cols_productos,
                table="PROV_Liquidaciones_Productos",
                where=condicion_prod,
                limit=10000
            )

            if lote_datos is None:
                # Reintentar con token fresco
                token_actual = self.repository.obtener_token(force_refresh=True)
                lote_datos = self.repository.ejecutar_consulta(
                    token=token_actual,
                    select=cols_productos,
                    table="PROV_Liquidaciones_Productos",
                    where=condicion_prod,
                    limit=10000
                )

            if lote_datos:
                datos_productos.extend(lote_datos)
            
            time.sleep(0.5) # Respiro corto entre lotes

        # 3. Guardar todo atómicamente en PostgreSQL
        try:
            # Eliminar cabeceras del rango de fechas
            db.query(LiquidacionPrincipalStaging).filter(
                LiquidacionPrincipalStaging.liquidacion_fecha.between(dt_inicio.date(), dt_fin.date())
            ).delete()

            # Eliminar productos asociados a estas liquidaciones específicas
            if lista_ids:
                db.query(LiquidacionProductoStaging).filter(
                    LiquidacionProductoStaging.liquidacion_id_corp.in_(lista_ids)
                ).delete()

            # Insertar cabeceras
            nuevas_cabeceras = []
            for c in datos_cabecera:
                liq_id = clean_str(c.get("LIQUIDACION_ID_CORP")).replace('.0', '').strip().upper()
                
                # Parsear fecha de cabecera
                fecha_raw = c.get("LIQUIDACION_FECHA")
                if isinstance(fecha_raw, str):
                    fecha_db = datetime.datetime.strptime(fecha_raw.split("T")[0], "%Y-%m-%d").date()
                else:
                    fecha_db = dt_inicio.date()

                cab = LiquidacionPrincipalStaging(
                    liquidacion_id_corp=liq_id,
                    corp=clean_str(c.get("CORP")),
                    liquidacion_fecha=fecha_db,
                    observaciones=clean_str(c.get("OBSERVACIONES")),
                    antes_total_1=parse_float(c.get("ANTES_TOTAL_1")),
                    antes_total_2=parse_float(c.get("ANTES_TOTAL_2")),
                    antes_total_3=parse_float(c.get("ANTES_TOTAL_3")),
                    despues_total_1=parse_float(c.get("DESPUES_TOTAL_1")),
                    despues_total_2=parse_float(c.get("DESPUES_TOTAL_2")),
                    despues_total_3=parse_float(c.get("DESPUES_TOTAL_3")),
                    liquidacion_estado=True if str(c.get("LIQUIDACION_ESTADO")).lower() in ('true', '1') else False
                )
                nuevas_cabeceras.append(cab)

            if nuevas_cabeceras:
                db.bulk_save_objects(nuevas_cabeceras)

            # Insertar productos
            nuevos_productos = []
            for p in datos_productos:
                liq_prod_id = clean_str(p.get("LIQUIDACION_ID_CORP")).replace('.0', '').strip().upper()
                prod = LiquidacionProductoStaging(
                    liquidacion_id_corp=liq_prod_id,
                    factura_id_corp=clean_str(p.get("FACTURA_ID_CORP")),
                    id_recepcion_relacionada=clean_str(p.get("IdRecepcionRelacionada")),
                    valor_total_cif=parse_float(p.get("VALOR_TOTAL_CIF")),
                    valor_subtotal_cif=parse_float(p.get("VALOR_SUBTOTAL_CIF")),
                    valor_antes_1=parse_float(p.get("VALOR_ANTES_1")),
                    valor_antes_2=parse_float(p.get("VALOR_ANTES_2")),
                    valor_antes_3=parse_float(p.get("VALOR_ANTES_3")),
                    valor_despues_1=parse_float(p.get("VALOR_DESPUES_1")),
                    valor_despues_2=parse_float(p.get("VALOR_DESPUES_2")),
                    valor_despues_3=parse_float(p.get("VALOR_DESPUES_3")),
                    partida_id_corp=clean_str(p.get("PARTIDA_ID_CORP")),
                    producto_id_corp=clean_str(p.get("PRODUCTO_ID_CORP")),
                    liquidacion_id=clean_str(p.get("LIQUIDACION_ID")),
                    cantidad=parse_float(p.get("CANTIDAD")),
                    precio=parse_float(p.get("PRECIO")),
                    total=parse_float(p.get("TOTAL")),
                    valor_total_cif_manual=parse_float(p.get("VALOR_TOTAL_CIF_MANUAL")),
                    valor_total_cif_unidad=parse_float(p.get("VALOR_TOTAL_CIF_UNIDAD"))
                )
                nuevos_productos.append(prod)

            if nuevos_productos:
                db.bulk_save_objects(nuevos_productos)

            db.commit()
            logging.info(f"SyncService: Sincronización masiva finalizada. Cabeceras: {len(nuevas_cabeceras)}, Productos: {len(nuevos_productos)}")
            return {
                "status": "success",
                "message": f"Sincronización completada. Cabeceras procesadas: {len(nuevas_cabeceras)}, Productos procesados: {len(nuevos_productos)}",
                "cabeceras_count": len(nuevas_cabeceras),
                "productos_count": len(nuevos_productos)
            }
        except Exception as e:
            db.rollback()
            logging.error(f"SyncService: Error escribiendo liquidaciones masivas en PostgreSQL: {e}")
            return {"status": "error", "message": f"Error persistiendo liquidaciones: {e}"}
