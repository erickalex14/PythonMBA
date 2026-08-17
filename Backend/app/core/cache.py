"""
Cache de lectura sobre Redis.

Existe por una razon medida: el catalogo de productos del ERP tarda ~11s y es el
88% del tiempo del reporte de Estadisticas de Inventarios, mientras que las
consultas a Postgres suman ~2.6s. Es el mismo catalogo para todos los usuarios y
no depende del rango de fechas, asi que se pide una vez y se reusa.

Regla: el cache NUNCA puede tumbar un reporte. Si Redis no responde, todas las
operaciones degradan a "sin cache" y el servicio consulta el origen como siempre.
"""
import json
import logging
import os
from typing import Any, Optional

try:
    import redis
except ImportError:  # el backend debe arrancar aunque falte la dependencia
    redis = None

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

_cliente = None
_conexion_fallida = False


def _obtener_cliente():
    """Cliente perezoso. Si la conexion falla una vez, deja de reintentar en cada
    request (cada intento con Redis caido costaria el timeout completo)."""
    global _cliente, _conexion_fallida
    if _cliente is not None:
        return _cliente
    if _conexion_fallida or redis is None:
        return None
    try:
        cliente = redis.from_url(
            REDIS_URL, socket_connect_timeout=2, socket_timeout=2, decode_responses=True
        )
        cliente.ping()
        _cliente = cliente
        logging.info(f"Cache: conectado a Redis en {REDIS_URL}")
        return _cliente
    except Exception as e:
        logging.warning(f"Cache: Redis no disponible ({e}). El servicio sigue sin cache.")
        _conexion_fallida = True
        return None


def obtener(clave: str) -> Optional[Any]:
    cliente = _obtener_cliente()
    if cliente is None:
        return None
    try:
        crudo = cliente.get(clave)
        if crudo is None:
            return None
        return json.loads(crudo)
    except Exception as e:
        logging.warning(f"Cache: no se pudo leer '{clave}': {e}")
        return None


def guardar(clave: str, valor: Any, ttl_segundos: int) -> bool:
    cliente = _obtener_cliente()
    if cliente is None:
        return False
    try:
        cliente.setex(clave, ttl_segundos, json.dumps(valor, default=str))
        return True
    except Exception as e:
        logging.warning(f"Cache: no se pudo guardar '{clave}': {e}")
        return False


def invalidar(patron: str) -> int:
    """Borra las claves que coinciden con el patron (ej. 'catalogo:*').
    Devuelve cuantas borro; 0 si Redis no esta disponible."""
    cliente = _obtener_cliente()
    if cliente is None:
        return 0
    try:
        # scan_iter y no keys(): keys() bloquea Redis mientras recorre todo el
        # keyspace, y aqui puede convivir con otros stacks.
        claves = list(cliente.scan_iter(match=patron, count=100))
        if not claves:
            return 0
        return int(cliente.delete(*claves))
    except Exception as e:
        logging.warning(f"Cache: no se pudo invalidar '{patron}': {e}")
        return 0
