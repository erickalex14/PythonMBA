"""
Check del reintento ante HTTP 401 en Mba3Repository.ejecutar_consulta.
Sin red: se sustituye requests.post por un doble que responde 401 la primera vez.
Correr: py -3 Backend/scripts/test_reintento_401.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.repositories import mba3_repository as repo_mod
from app.repositories.mba3_repository import Mba3Repository


class RespuestaFalsa:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_reintenta_una_vez_tras_401():
    llamadas = {"consulta": 0, "login": 0}

    def post_falso(url, **kwargs):
        if "login_servicio" in url:
            llamadas["login"] += 1
            return RespuestaFalsa(200, {"jwt": f"token-fresco-{llamadas['login']}"})
        llamadas["consulta"] += 1
        if llamadas["consulta"] == 1:
            return RespuestaFalsa(401, {})           # token de cache vencido
        return RespuestaFalsa(200, [{"COL": "dato"}])  # con token fresco, funciona

    original = repo_mod.requests.post
    repo_mod.requests.post = post_falso
    try:
        Mba3Repository._cached_tokens.clear()
        filas = Mba3Repository().ejecutar_consulta(
            token="token-vencido", select="*", table="TABLA_X", env="PRUEBAS")
    finally:
        repo_mod.requests.post = original
        Mba3Repository._cached_tokens.clear()

    assert filas == [{"COL": "dato"}], f"deberia devolver los datos del reintento, dio {filas}"
    assert llamadas["consulta"] == 2, f"deberia consultar 2 veces (401 + reintento), fueron {llamadas['consulta']}"
    assert llamadas["login"] == 1, f"deberia hacer 1 login fresco, fueron {llamadas['login']}"


def test_no_reintenta_infinito_si_sigue_401():
    llamadas = {"consulta": 0}

    def post_falso(url, **kwargs):
        if "login_servicio" in url:
            return RespuestaFalsa(200, {"jwt": "token-que-tampoco-sirve"})
        llamadas["consulta"] += 1
        return RespuestaFalsa(401, {})

    original = repo_mod.requests.post
    repo_mod.requests.post = post_falso
    try:
        Mba3Repository._cached_tokens.clear()
        filas = Mba3Repository().ejecutar_consulta(
            token="token-vencido", select="*", table="TABLA_X", env="PRUEBAS")
    finally:
        repo_mod.requests.post = original
        Mba3Repository._cached_tokens.clear()

    assert filas == [], "si sigue en 401 debe devolver lista vacia"
    assert llamadas["consulta"] == 2, f"debe parar en 2 intentos, fueron {llamadas['consulta']}"


if __name__ == "__main__":
    test_reintenta_una_vez_tras_401()
    test_no_reintenta_infinito_si_sigue_401()
    print("OK: reintenta una vez con token fresco y no entra en bucle.")
