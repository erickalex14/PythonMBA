import pandas as pd
import logging
import datetime
import time
from app.repositories.mba3_repository import IMba3Repository

class LiquidacionesService:
    """
    Servicio de Reglas de Negocio para Liquidaciones e Importaciones.
    Ejecuta el INNER JOIN en memoria RAM entre las tablas de cabecera y detalle.
    Implementa el proceso por lotes diarios de cabeceras y la descarga masiva de productos.
    """
    def __init__(self, repository: IMba3Repository):
        self.repository = repository
        
    def obtener_liquidaciones(self, fecha_inicio: str, fecha_fin: str) -> pd.DataFrame:
        logging.info(f"Service: Iniciando extracción de liquidaciones desde {fecha_inicio} hasta {fecha_fin}")
        
        try:
            dt_inicio = datetime.datetime.strptime(fecha_inicio, "%Y-%m-%d")
            dt_fin = datetime.datetime.strptime(fecha_fin, "%Y-%m-%d")
        except Exception as e:
            logging.error(f"Service: Formato de fechas no válido en liquidaciones: {e}")
            return pd.DataFrame()
            
        token_actual = self.repository.obtener_token()
        if not token_actual:
            logging.error("Service: No se pudo obtener el token para realizar la consulta de liquidaciones.")
            return pd.DataFrame()
            
        # =========================================================
        # 1. EXTRACCIÓN DE CABECERAS EN LOTES DIARIOS
        # =========================================================
        registros_cabecera = []
        dt_actual = dt_inicio
        dias_totales = (dt_fin - dt_inicio).days + 1
        dia_contador = 1
        
        cols_principal = "CORP,LIQUIDACION_FECHA,OBSERVACIONES,ANTES_TOTAL_1,ANTES_TOTAL_2,ANTES_TOTAL_3,DESPUES_TOTAL_1,DESPUES_TOTAL_2,DESPUES_TOTAL_3,LIQUIDACION_ESTADO,LIQUIDACION_ID_CORP"
        
        while dt_actual <= dt_fin:
            fecha_str = dt_actual.strftime('%Y-%m-%d')
            logging.info(f"Service: Procesando cabecera lote {dia_contador}/{dias_totales} (Fecha: {fecha_str})")
            
            max_intentos = 3
            intento_actual = 1
            exito = False
            
            while intento_actual <= max_intentos and not exito:
                # Condición estricta: CORP NVC01, ESTADO True y Fecha
                condicion_where = f"CORP = 'NVC01' AND LIQUIDACION_ESTADO = True AND LIQUIDACION_FECHA = '{fecha_str}'"
                
                datos = self.repository.ejecutar_consulta(
                    token=token_actual,
                    select=cols_principal,
                    table="PROV_Liquidaciones_Principal",
                    where=condicion_where,
                    limit=50000
                )
                
                if not datos:
                    logging.warning("Service: Lote vacío o token expirado. Intentando refrescar token...")
                    nuevo_token = self.repository.obtener_token()
                    if nuevo_token:
                        token_actual = nuevo_token
                        time.sleep(1)
                        # Reintentar consulta
                        datos = self.repository.ejecutar_consulta(
                            token=token_actual,
                            select=cols_principal,
                            table="PROV_Liquidaciones_Principal",
                            where=condicion_where,
                            limit=50000
                        )
                
                if datos:
                    registros_cabecera.extend(datos)
                    exito = True
                else:
                    # Continuar si realmente no hay datos
                    exito = True
                    
            dt_actual += datetime.timedelta(days=1)
            dia_contador += 1
            time.sleep(0.3)
            
        if not registros_cabecera:
            logging.warning("Service: No se recuperaron cabeceras de liquidación en este rango.")
            return pd.DataFrame()
            
        df_principal = pd.DataFrame(registros_cabecera)
        
        # Normalizar ID de cabecera a string, limpiando decimales .0 y espacios
        df_principal['LIQUIDACION_ID_CORP'] = df_principal['LIQUIDACION_ID_CORP'].astype(str).str.replace(
            r'\.0$', '', regex=True
        ).str.strip().str.upper()
        
        # =========================================================
        # 2. EXTRACCIÓN MASIVA DE DETALLE DE PRODUCTOS
        # =========================================================
        cols_productos = "FACTURA_ID_CORP,IdRecepcionRelacionada,VALOR_TOTAL_CIF,VALOR_SUBTOTAL_CIF,VALOR_ANTES_1,VALOR_ANTES_2,VALOR_ANTES_3,VALOR_DESPUES_1,VALOR_DESPUES_2,VALOR_DESPUES_3,PARTIDA_ID_CORP,PRODUCTO_ID_CORP,LIQUIDACION_ID,CANTIDAD,PRECIO,TOTAL,VALOR_TOTAL_CIF_MANUAL,VALOR_TOTAL_CIF_UNIDAD,LIQUIDACION_ID_CORP"
        
        logging.info("Service: Descargando tabla de productos de liquidaciones (Límite masivo: 100,000)...")
        
        # Obtener los productos en un bloque masivo
        datos_productos = self.repository.ejecutar_consulta(
            token=token_actual,
            select=cols_productos,
            table="PROV_Liquidaciones_Productos",
            limit=100000
        )
        
        if not datos_productos:
            # Refrescar token por si falló la descarga masiva
            logging.warning("Service: Productos vacíos. Intentando refrescar token...")
            nuevo_token = self.repository.obtener_token()
            if nuevo_token:
                token_actual = nuevo_token
                time.sleep(1)
                datos_productos = self.repository.ejecutar_consulta(
                    token=token_actual,
                    select=cols_productos,
                    table="PROV_Liquidaciones_Productos",
                    limit=100000
                )
                
        if not datos_productos:
            logging.error("Service: No se pudo obtener la tabla de productos secundaria.")
            return pd.DataFrame()
            
        df_productos = pd.DataFrame(datos_productos)
        
        # Normalizar ID de productos a string
        df_productos['LIQUIDACION_ID_CORP'] = df_productos['LIQUIDACION_ID_CORP'].astype(str).str.replace(
            r'\.0$', '', regex=True
        ).str.strip().str.upper()
        
        # =========================================================
        # 3. CRUCE RELACIONAL (INNER JOIN) EN MEMORIA RAM
        # =========================================================
        logging.info("Service: Ejecutando INNER JOIN relacional en memoria RAM.")
        df_cruce = pd.merge(df_principal, df_productos, on='LIQUIDACION_ID_CORP', how='inner')
        
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
        
        columnas_disponibles = [col for col in columnas_finales if col in df_cruce.columns]
        df_final = df_cruce[columnas_disponibles]
        
        if not df_final.empty:
            # Convertir a texto limpio los identificadores y observaciones
            str_cols = [
                "CORP", "OBSERVACIONES", "FACTURA_ID_CORP", "IdRecepcionRelacionada",
                "PARTIDA_ID_CORP", "PRODUCTO_ID_CORP", "LIQUIDACION_ID", "LIQUIDACION_ID_CORP"
            ]
            for col in str_cols:
                if col in df_final.columns:
                    df_final[col] = df_final[col].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
            
            # Parsear numéricos de forma robusta
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
                    df_final[col] = pd.to_numeric(df_final[col], errors='coerce').fillna(0)
                else:
                    df_final[col] = 0.0
                    
        logging.info(f"Service: Operación de cruce completada. Total registros finales: {len(df_final)}")
        return df_final
