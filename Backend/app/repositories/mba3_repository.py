from abc import ABC, abstractmethod
import requests
import logging
from typing import Optional, Union, List, Dict
from app.config import settings

class IMba3Repository(ABC):
    """
    Interface para el Repositorio de Datos de MBA3 ERP.
    """
    @abstractmethod
    def obtener_token(self, force_refresh: bool = False, env: Optional[str] = None) -> Optional[str]:
        pass
        
    @abstractmethod
    def ejecutar_consulta(self, token: str, select: str, table: str, where: Optional[str] = None, limit: Optional[int] = None, env: Optional[str] = None) -> List[Dict]:
        pass

def procesar_respuesta_erp(datos, context=""):
    """
    Parser robusto para interceptar respuestas de error o ausencia de registros
    en el ERP, previniendo fallos en cascada.
    """
    if not datos:
        return []
        
    # Si es un diccionario único
    if isinstance(datos, dict):
        error_val = datos.get("error") or datos.get("codigo")
        if error_val == "009": # Sin registros
            logging.info(f"Repository: No se encontraron registros en {context} (009).")
            return []
        elif "error" in datos or "codigo" in datos:
            logging.error(f"Repository: Error devuelto por ERP en {context}: {datos}")
            return []
        return [datos]
        
    # Si es una lista de registros
    if isinstance(datos, list):
        if len(datos) == 0:
            return []
        # Comprobar si el primer registro es de error/información
        first = datos[0]
        if isinstance(first, dict):
            error_val = first.get("error") or first.get("codigo")
            if error_val == "009":
                logging.info(f"Repository: No se encontraron registros en {context} (009).")
                return []
            elif "error" in first or "codigo" in first:
                logging.error(f"Repository: Error devuelto por ERP en lista para {context}: {first}")
                return []
        return datos
        
    return []

class Mba3Repository(IMba3Repository):
    """
    Implementación concreta del repositorio utilizando la librería 'requests'
    para consumir las APIs REST de MBA3.
    """
    
    # Diccionario para almacenar los tokens JWT en memoria indexados por entorno ("PRUEBAS" o "PROD")
    _cached_tokens: Dict[str, str] = {}

    def obtener_token(self, force_refresh: bool = False, env: Optional[str] = None) -> Optional[str]:
        #SELECCIONA CREDENCIALES DE PRODUCCION O PRUEBAS DINAMICAMENTE SEGUN SE ELIJA EN EL FRONT
        target_env = env.strip().upper() if env else settings.MBA3_ENV
        if target_env not in ["PRUEBAS", "PROD"]:
            target_env = settings.MBA3_ENV
        #SE USA EL TOKEN EN CACHE PARA EL ENTORNO
        if not force_refresh and target_env in Mba3Repository._cached_tokens:
            logging.info(f"Repository: Utilizando token JWT almacenado en caché para el entorno {target_env}.")
            return Mba3Repository._cached_tokens[target_env]

        logging.info(f"Repository: Iniciando sesión en MBA3 (Solicitud fresca para entorno {target_env})...")
        
        codigo = settings.MBA3_CODIGO_SERVICIO_PROD if target_env == "PROD" else settings.MBA3_CODIGO_SERVICIO_TEST
        pwd = settings.MBA3_PASSWORD_SERVICIO_PROD if target_env == "PROD" else settings.MBA3_PASSWORD_SERVICIO_TEST
        base_url = settings.MBA3_BASE_URL_PROD if target_env == "PROD" else settings.MBA3_BASE_URL_TEST
        url_login = f"{base_url}/ws2_mba3_serv_/login_servicio"

        headers = {"Content-Type": "application/json"}
        payload = {
            "codigo": codigo,
            "pwd": pwd
        }
        try:
            response = requests.post(url_login, json=payload, headers=headers, timeout=15)
            response.raise_for_status()
            datos = response.json()
            token = datos.get("jwt")
            if token:
                logging.info(f"Repository: Token JWT obtenido correctamente y cacheado para entorno {target_env}.")
                Mba3Repository._cached_tokens[target_env] = token
                return token
            else:
                logging.error("Repository: La respuesta no contiene la clave 'jwt'.")
                return None
        except Exception as e:
            logging.error(f"Repository: Error en la autenticación del ERP para entorno {target_env}: {e}")
            return None

    #EJECUTAR LA CONSULTA EXTERNA NECESARIA PARA EL REPORTE
    def ejecutar_consulta(self, token: str, select: str, table: str, where: Optional[str] = None, limit: Optional[int] = None, env: Optional[str] = None) -> List[Dict]:
        target_env = env.strip().upper() if env else settings.MBA3_ENV
        if target_env not in ["PRUEBAS", "PROD"]:
            target_env = settings.MBA3_ENV

        logging.info(f"Repository: Ejecutando consulta sobre la tabla {table} (Entorno: {target_env})")
        
        base_url = settings.MBA3_BASE_URL_PROD if target_env == "PROD" else settings.MBA3_BASE_URL_TEST
        url_consulta = f"{base_url}/ws2_mba3_serv_Consultas_Externas_/"

        headers = {"Authorization": token}
        payload = {
            "select": select,
            "from": table
        }
        if where:
            payload["where"] = where
        if limit:
            payload["limit"] = str(limit)
            
        try:
            response = requests.post(url_consulta, headers=headers, data=payload, timeout=120)
            if response.status_code == 401:
                logging.warning(f"Repository: Recibido HTTP 401. Invalidando token de caché para entorno {target_env}...")
                if target_env in Mba3Repository._cached_tokens:
                    del Mba3Repository._cached_tokens[target_env]
            response.raise_for_status()
            datos = response.json()
            return procesar_respuesta_erp(datos, f"tabla {table}")
        except Exception as e:
            logging.error(f"Repository: Error de comunicación al consultar la tabla {table} en {target_env}: {e}")
            if hasattr(e, 'response') and e.response is not None and e.response.status_code == 401:
                if target_env in Mba3Repository._cached_tokens:
                    del Mba3Repository._cached_tokens[target_env]
            return []
