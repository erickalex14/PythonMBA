"""
Check del cache: guardar/leer, y sobre todo que si Redis no responde el servicio
siga funcionando sin cache en vez de romperse.
Correr: py -3 Backend/scripts/test_cache.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core import cache


def _reset():
    cache._cliente = None
    cache._conexion_fallida = False


class ClienteFalso:
    def __init__(self, falla=False):
        self.datos = {}
        self.falla = falla

    def ping(self):
        if self.falla:
            raise ConnectionError("Redis caido")
        return True

    def get(self, k):
        if self.falla:
            raise ConnectionError("Redis caido")
        return self.datos.get(k)

    def setex(self, k, ttl, v):
        if self.falla:
            raise ConnectionError("Redis caido")
        self.datos[k] = v

    def scan_iter(self, match=None, count=None):
        prefijo = (match or "").replace("*", "")
        return [k for k in list(self.datos) if k.startswith(prefijo)]

    def delete(self, *claves):
        for k in claves:
            self.datos.pop(k, None)
        return len(claves)


def test_guardar_y_leer():
    _reset()
    cache._cliente = ClienteFalso()
    filas = [{"codigo": "A-1", "existencia": 5}, {"codigo": "B-2", "existencia": 0}]
    assert cache.guardar("k1", filas, 60) is True
    assert cache.obtener("k1") == filas
    assert cache.obtener("no-existe") is None


def test_sin_redis_no_rompe():
    """Lo importante: con Redis caido devuelve None/False, nunca lanza excepcion."""
    _reset()
    cache._cliente = ClienteFalso(falla=True)
    assert cache.obtener("k1") is None
    assert cache.guardar("k1", [{"a": 1}], 60) is False
    assert cache.invalidar("k*") == 0

    # Y si ni siquiera se puede conectar, tampoco revienta.
    _reset()
    cache._conexion_fallida = True
    assert cache.obtener("k1") is None
    assert cache.guardar("k1", [{"a": 1}], 60) is False


def test_invalidar_por_patron():
    _reset()
    cliente = ClienteFalso()
    cache._cliente = cliente
    cache.guardar("estadisticas:catalogo_productos", [{"a": 1}], 60)
    cache.guardar("estadisticas:otro", [{"b": 2}], 60)
    cache.guardar("ajeno:cosa", [{"c": 3}], 60)

    assert cache.invalidar("estadisticas:*") == 2
    assert cache.obtener("estadisticas:catalogo_productos") is None
    assert cache.obtener("ajeno:cosa") is not None, "no debe tocar claves de otros stacks"


if __name__ == "__main__":
    test_guardar_y_leer()
    test_sin_redis_no_rompe()
    test_invalidar_por_patron()
    print("OK: cache guarda/lee, degrada sin romper si Redis falla y respeta claves ajenas.")
