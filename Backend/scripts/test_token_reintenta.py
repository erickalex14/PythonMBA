"""
Check: obtener_token reintenta cuando el ERP rechaza la conexion (PROD se cae
a ratos y vuelve en segundos) y la ventana nocturna cubre 3 dias.

Correr: py -3 Backend/scripts/test_token_reintenta.py
"""
import os
import sys
import time
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
time.sleep = lambda *_a, **_k: None

from app.repositories import mba3_repository as repo_mod
from app.repositories.mba3_repository import Mba3Repository


class RespuestaOk:
    status_code = 200

    def json(self):
        return {"jwt": "token-fresco"}

    def raise_for_status(self):
        pass


llamadas = []


def post_falla_dos_veces(url, **kw):
    llamadas.append(url)
    if len(llamadas) < 3:
        raise ConnectionError("Connection refused")
    return RespuestaOk()


repo_mod.requests.post = post_falla_dos_veces
Mba3Repository._cached_tokens.clear()
assert Mba3Repository().obtener_token(force_refresh=True, env="PRUEBAS") == "token-fresco"
assert len(llamadas) == 3, llamadas

llamadas.clear()
repo_mod.requests.post = lambda url, **kw: (_ for _ in ()).throw(ConnectionError("down"))
assert Mba3Repository().obtener_token(force_refresh=True, env="PRUEBAS") is None

# ventana nocturna: 3 dias hasta ayer, dos pasadas
from app.core import scheduler as sched
capturado = {}
class ServicioFalso:
    def __init__(self, *_a): pass
    def _f(self, db, ini, fin, env=None):
        capturado.setdefault("rangos", []).append((ini, fin, env)); return {"message": "ok"}
    sync_movimientos = sync_liquidaciones = sync_ats = sync_ventas = _f
sched.SyncService = ServicioFalso
sched.SessionLocal = lambda: type("Db", (), {"close": lambda self: None})()
sched.run_nightly_sync()
hoy = datetime.date.today()
esperado = ((hoy - datetime.timedelta(days=3)).isoformat(), (hoy - datetime.timedelta(days=1)).isoformat(), "PROD")
assert capturado["rangos"] == [esperado] * 4, capturado
print("OK: login reintenta 3 veces y la noche cubre", esperado)
