"""
Check: con el ERP caido, ejecutar_consulta(estricto=True) devuelve None (no []),
y sync_ventas / sync_movimientos SALTAN el dia sin borrar el staging.

Bug historico: el 401/timeout se tragaba como [] -> el DELETE del dia corria
igual y no se reinsertaba nada -> el staging se vaciaba dia por dia.

Correr: py -3 Backend/scripts/test_sync_estricto_no_borra.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
time.sleep = lambda *_a, **_k: None  # los reintentos del sync no deben frenar el check

from app.repositories import mba3_repository as repo_mod
from app.repositories.mba3_repository import Mba3Repository
from app.services.sync_service import SyncService


class RespuestaFalsa:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_estricto_devuelve_none_en_fallo():
    def post_falso(url, **kwargs):
        if "login_servicio" in url:
            return RespuestaFalsa(200, {"jwt": "tok"})
        raise ConnectionError("no route to host")  # ERP inalcanzable

    original = repo_mod.requests.post
    repo_mod.requests.post = post_falso
    try:
        Mba3Repository._cached_tokens.clear()
        estricto = Mba3Repository().ejecutar_consulta("t", "*", "T", env="PRUEBAS", estricto=True)
        laxo = Mba3Repository().ejecutar_consulta("t", "*", "T", env="PRUEBAS")
    finally:
        repo_mod.requests.post = original
        Mba3Repository._cached_tokens.clear()

    assert estricto is None, f"estricto debe dar None si el ERP no responde, dio {estricto!r}"
    assert laxo == [], f"sin estricto sigue dando [] (compatibilidad), dio {laxo!r}"


class _Query:
    def __init__(self, registro):
        self.registro = registro

    def filter(self, *a, **k):
        return self

    def delete(self):
        self.registro["deletes"] += 1
        return 0


class DbFalso:
    """Registra si alguien llamo .delete() sobre el staging."""
    def __init__(self):
        self.marca = {"deletes": 0, "commits": 0, "inserts": 0}

    def query(self, *a, **k):
        return _Query(self.marca)

    def bulk_save_objects(self, objs):
        self.marca["inserts"] += len(objs)

    def commit(self):
        self.marca["commits"] += 1

    def rollback(self):
        pass


class RepoFalsoCaido:
    """Simula el ERP inalcanzable: token OK, consultas None."""
    def obtener_token(self, *a, **k):
        return "token-ok"

    def ejecutar_consulta(self, *a, **k):
        # estricto=True -> None (el ERP no respondio)
        return None if k.get("estricto") else []


def test_sync_ventas_no_borra_si_erp_cae():
    db = DbFalso()
    res = SyncService(RepoFalsoCaido()).sync_ventas(db, "2026-09-01", "2026-09-03", env="PROD")

    assert db.marca["deletes"] == 0, f"NO debe borrar el staging si el ERP no responde (borros: {db.marca['deletes']})"
    assert db.marca["inserts"] == 0
    assert res["status"] == "parcial", f"status parcial, dio {res['status']}"
    assert res["dias_omitidos"] == ["2026-09-01", "2026-09-02", "2026-09-03"], res["dias_omitidos"]


def test_sync_movimientos_no_borra_si_erp_cae():
    db = DbFalso()
    res = SyncService(RepoFalsoCaido()).sync_movimientos(db, "2026-09-01", "2026-09-02", env="PROD")

    assert db.marca["deletes"] == 0, f"NO debe borrar (borros: {db.marca['deletes']})"
    assert res["status"] == "parcial"
    assert res["dias_omitidos"] == ["2026-09-01", "2026-09-02"], res["dias_omitidos"]


if __name__ == "__main__":
    test_estricto_devuelve_none_en_fallo()
    test_sync_ventas_no_borra_si_erp_cae()
    test_sync_movimientos_no_borra_si_erp_cae()
    print("OK: ERP caido -> None, y el sync salta el dia sin borrar staging.")
