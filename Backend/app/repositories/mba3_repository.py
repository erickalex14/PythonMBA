from abc import ABC, abstractmethod
import requests
import logging
from typing import Optional, Union, List, Dict
from app.config import settings

class IMba3Repository(ABC):
    """
    Interface para el Repositorio de Datos de MBA3 ERP.
    Sigue el principio de Inversión de Dependencias (DIP) de SOLID.
    """
    @abstractmethod
    def obtener_token(self) -> Optional[str]:
        pass
        
    @abstractmethod
    def ejecutar_consulta(self, token: str, select: str, table: str, where: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
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
        if datos.get("codigo") == "009": # Sin registros
            logging.info(f"Repository: No se encontraron registros en {context}.")
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
            if first.get("codigo") == "009":
                logging.info(f"Repository: No se encontraron registros en {context}.")
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
    
    def obtener_token(self) -> Optional[str]:
        logging.info("Repository: Iniciando sesión en MBA3...")
        headers = {"Content-Type": "application/json"}
        payload = {
            "codigo": settings.ACTIVE_CODIGO_SERVICIO,
            "pwd": settings.ACTIVE_PASSWORD_SERVICIO
        }
        try:
            response = requests.post(settings.MBA3_URL_LOGIN, json=payload, headers=headers, timeout=15)
            response.raise_for_status()
            datos = response.json()
            token = datos.get("jwt")
            if token:
                logging.info("Repository: Token JWT obtenido correctamente.")
                return token
            else:
                logging.error("Repository: La respuesta no contiene la clave 'jwt'.")
                return None
        except Exception as e:
            logging.error(f"Repository: Error en la autenticación del ERP: {e}")
            return None

    def ejecutar_consulta(self, token: str, select: str, table: str, where: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
        logging.info(f"Repository: Ejecutando consulta sobre la tabla {table}")
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
            response = requests.post(settings.MBA3_URL_CONSULTA, headers=headers, data=payload, timeout=120)
            response.raise_for_status()
            datos = response.json()
            return procesar_respuesta_erp(datos, f"tabla {table}")
        except Exception as e:
            logging.error(f"Repository: Error de comunicación al consultar la tabla {table}: {e}")
            return []
