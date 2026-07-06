import pandas as pd
import logging
import datetime
import time
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.repositories.mba3_repository import IMba3Repository
from app.models.movimiento import MovimientoStaging
from app.core.database import SessionLocal

class MovimientosService:
    """
    Servicio de Reglas de Negocio para Movimientos de Productos.
    Depende de la abstracción IMba3Repository.
    Implementa la estrategia de consulta híbrida:
    - Recupera datos históricos desde la base de datos PostgreSQL local (Staging).
    - Consulta al ERP MBA3 en tiempo real solo por el día de hoy si la consulta lo incluye.
    """
    def __init__(self, repository: IMba3Repository):
        self.repository = repository
        
    def obtener_movimientos(self, fecha_inicio: str, fecha_fin: str, db: Optional[Session] = None) -> pd.DataFrame:
        logging.info(f"Service: Iniciando obtención híbrida de movimientos desde {fecha_inicio} hasta {fecha_fin}")
        
        try:
            dt_inicio = datetime.datetime.strptime(fecha_inicio, "%Y-%m-%d").date()
            dt_fin = datetime.datetime.strptime(fecha_fin, "%Y-%m-%d").date()
        except Exception as e:
            logging.error(f"Service: Formato de fechas no válido (esperado YYYY-MM-DD): {e}")
            return pd.DataFrame()

        hoy = datetime.date.today()
        
        # 1. Determinar rangos para local y externo
        rango_local_fin = dt_fin
        consultar_hoy_erp = False
        
        if dt_fin >= hoy:
            consultar_hoy_erp = True
            rango_local_fin = hoy - datetime.timedelta(days=1)
            
        registros_totales = []

        # 2. Consultar base de datos local (Staging) para el histórico
        if dt_inicio <= rango_local_fin:
            close_db_manually = False
            if db is None:
                db = SessionLocal()
                close_db_manually = True
                
            try:
                logging.info(f"Service: Consultando base de datos local para el rango: {dt_inicio} al {rango_local_fin}")
                query_res = db.query(MovimientoStaging).filter(
                    MovimientoStaging.trans_date >= dt_inicio,
                    MovimientoStaging.trans_date <= rango_local_fin
                ).all()
                
                # Convertir a estructura de diccionarios
                for mov in query_res:
                    registros_totales.append({
                        "TRANS_DATE": mov.trans_date.strftime("%Y-%m-%d") if mov.trans_date else "",
                        "PRODUCT_NAME": mov.product_name or "",
                        "Codigo_producto_convertido": mov.codigo_producto_convertido,
                        "ORIGINAL_QTY": float(mov.original_qty or 0.0),
                        "ORIGIN_MEMO": mov.origin_memo or "",
                        "ORIGIN_REF": mov.origin_ref or "",
                        "BASE_COMISION": float(mov.base_comision or 0.0),
                        "Info_Seriales": mov.info_seriales or "",
                        "Codigo_Sucursal": mov.codigo_sucursal or "",
                        "BaseImponibleReal_1": float(mov.base_imponible_real_1 or 0.0),
                        "COD_SALESMAN": mov.cod_salesman or "",
                        "Codigo_Marca": mov.codigo_marca or ""
                    })
                logging.info(f"Service: {len(query_res)} registros históricos recuperados de base de datos local.")
            except Exception as e:
                logging.error(f"Service: Error al leer desde base de datos de Staging: {e}")
            finally:
                if close_db_manually:
                    db.close()

        # 3. Consultar ERP MBA3 para el día de hoy (tiempo real)
        if consultar_hoy_erp:
            fecha_hoy_str = hoy.strftime('%Y-%m-%d')
            logging.info(f"Service: Consultando el día actual en tiempo real al ERP ({fecha_hoy_str})...")
            
            token_actual = self.repository.obtener_token()
            if token_actual:
                columnas = "TRANS_DATE,PRODUCT_NAME,Codigo_producto_convertido,ORIGINAL_QTY,ORIGIN_MEMO,ORIGIN_REF,BASE_COMISION,Info_Seriales,Codigo_Sucursal,BaseImponibleReal_1,COD_SALESMAN,Codigo_Marca"
                condicion_where = f"TRANS_DATE = '{fecha_hoy_str}'"
                
                datos_hoy = self.repository.ejecutar_consulta(
                    token=token_actual,
                    select=columnas,
                    table="INVT_Producto_Movimientos",
                    where=condicion_where,
                    limit=50000
                )
                
                if datos_hoy:
                    logging.info(f"Service: {len(datos_hoy)} registros en tiempo real recuperados para hoy.")
                    for item in datos_hoy:
                        def parse_float(val):
                            try:
                                return float(str(val).strip()) if val else 0.0
                            except:
                                return 0.0
                        registros_totales.append({
                            "TRANS_DATE": fecha_hoy_str,
                            "PRODUCT_NAME": str(item.get("PRODUCT_NAME", "")).strip() if item.get("PRODUCT_NAME") else "",
                            "Codigo_producto_convertido": str(item.get("Codigo_producto_convertido", "")).strip(),
                            "ORIGINAL_QTY": parse_float(item.get("ORIGINAL_QTY")),
                            "ORIGIN_MEMO": str(item.get("ORIGIN_MEMO", "")).strip() if item.get("ORIGIN_MEMO") else "",
                            "ORIGIN_REF": str(item.get("ORIGIN_REF", "")).strip() if item.get("ORIGIN_REF") else "",
                            "BASE_COMISION": parse_float(item.get("BASE_COMISION")),
                            "Info_Seriales": str(item.get("Info_Seriales", "")).strip() if item.get("Info_Seriales") else "",
                            "Codigo_Sucursal": str(item.get("Codigo_Sucursal", "")).strip() if item.get("Codigo_Sucursal") else "",
                            "BaseImponibleReal_1": parse_float(item.get("BaseImponibleReal_1")),
                            "COD_SALESMAN": str(item.get("COD_SALESMAN", "")).strip() if item.get("COD_SALESMAN") else "",
                            "Codigo_Marca": str(item.get("Codigo_Marca", "")).strip() if item.get("Codigo_Marca") else ""
                        })
                else:
                    logging.info("Service: No hay registros del día de hoy en el ERP.")
            else:
                logging.error("Service: No se pudo obtener el token para la consulta en tiempo real de hoy.")

        # 4. Crear DataFrame y formatear
        df = pd.DataFrame(registros_totales)
        if not df.empty:
            df = df.apply(lambda x: x.str.strip() if x.dtype == "object" else x)
            # Asegurar tipos numéricos consistentes
            for col in ['ORIGINAL_QTY', 'BASE_COMISION', 'BaseImponibleReal_1']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
                else:
                    df[col] = 0.0
                    
        logging.info(f"Service: Operación completada. Total de registros devueltos: {len(df)}")
        return df
