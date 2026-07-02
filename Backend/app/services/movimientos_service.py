import pandas as pd
import logging
import datetime
import time
from typing import List, Dict
from app.repositories.mba3_repository import IMba3Repository

class MovimientosService:
    """
    Servicio de Reglas de Negocio para Movimientos de Productos.
    Depende de la abstracción IMba3Repository.
    Implementa la extracción diaria por lotes (lotes diarios) para prevenir timeouts en consultas masivas del ERP.
    """
    def __init__(self, repository: IMba3Repository):
        self.repository = repository
        
    def obtener_movimientos(self, fecha_inicio: str, fecha_fin: str) -> pd.DataFrame:
        logging.info(f"Service: Iniciando extracción masiva por lotes diarios desde {fecha_inicio} hasta {fecha_fin}")
        
        try:
            dt_inicio = datetime.datetime.strptime(fecha_inicio, "%Y-%m-%d")
            dt_fin = datetime.datetime.strptime(fecha_fin, "%Y-%m-%d")
        except Exception as e:
            logging.error(f"Service: Formato de fechas no válido (esperado YYYY-MM-DD): {e}")
            return pd.DataFrame()
            
        token_actual = self.repository.obtener_token()
        if not token_actual:
            logging.error("Service: No se pudo obtener el token inicial de autenticación.")
            return pd.DataFrame()
            
        registros_totales = []
        dt_actual = dt_inicio
        dias_totales = (dt_fin - dt_inicio).days + 1
        dia_contador = 1
        
        columnas = "TRANS_DATE,PRODUCT_NAME,Codigo_producto_convertido,ORIGINAL_QTY,ORIGIN_MEMO,ORIGIN_REF,BASE_COMISION,Info_Seriales,Codigo_Sucursal,BaseImponibleReal_1,COD_SALESMAN,Codigo_Marca"
        
        while dt_actual <= dt_fin:
            fecha_str = dt_actual.strftime('%Y-%m-%d')
            logging.info(f"Service: Procesando lote {dia_contador}/{dias_totales} (Fecha: {fecha_str})")
            
            max_intentos = 3
            intento_actual = 1
            exito = False
            
            while intento_actual <= max_intentos and not exito:
                condicion_where = f"TRANS_DATE = '{fecha_str}'"
                
                # Ejecutar consulta diaria
                datos = self.repository.ejecutar_consulta(
                    token=token_actual,
                    select=columnas,
                    table="INVT_Producto_Movimientos",
                    where=condicion_where,
                    limit=50000
                )
                
                # Si no retorna datos, verificamos si es por token expirado
                # (Intentamos refrescar el token una vez y reconsultamos)
                if not datos:
                    logging.warning("Service: Lote vacío o error detectado. Intentando refrescar token...")
                    nuevo_token = self.repository.obtener_token()
                    if nuevo_token:
                        token_actual = nuevo_token
                        time.sleep(1)
                        # Reintentar la consulta con el nuevo token
                        datos = self.repository.ejecutar_consulta(
                            token=token_actual,
                            select=columnas,
                            table="INVT_Producto_Movimientos",
                            where=condicion_where,
                            limit=50000
                        )
                
                if datos:
                    registros_totales.extend(datos)
                    exito = True
                else:
                    # Si sigue vacío tras el reintento, asumimos que no hay registros en este día
                    # y continuamos para no bloquear la cola de extracción completa
                    exito = True
                    
            dt_actual += datetime.timedelta(days=1)
            dia_contador += 1
            time.sleep(0.5) # Breve delay para no saturar el servidor del ERP
            
        df = pd.DataFrame(registros_totales)
        if not df.empty:
            df = df.apply(lambda x: x.str.strip() if x.dtype == "object" else x)
            # Conversión de valores numéricos de forma robusta
            for col in ['ORIGINAL_QTY', 'BASE_COMISION', 'BaseImponibleReal_1']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                else:
                    df[col] = 0.0
                    
        logging.info(f"Service: Extracción completada. Total de registros recuperados: {len(df)}")
        return df
