"""Un entorno de ERP mal escrito no debe terminar consultando PRODUCCION.

Antes, `_resolver_env` caia a `settings.MBA3_ENV` ante cualquier valor que no
reconociera: pasar "TEST" en vez de "PRUEBAS" consultaba la base real con las
credenciales de produccion, sin error ni aviso en el log.

Correr con:  py -3 Backend/scripts/test_erp_entorno.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings                                   # noqa: E402
from app.repositories.mba3_repository import _resolver_env        # noqa: E402


def test_validos():
    assert _resolver_env("PRUEBAS") == "PRUEBAS"
    assert _resolver_env("prod") == "PROD"
    assert _resolver_env("  Pruebas  ") == "PRUEBAS"
    print("OK entornos validos, sin importar mayusculas ni espacios")


def test_por_defecto():
    # Sin entorno explicito manda el .env: es el comportamiento de siempre.
    assert _resolver_env(None) == settings.MBA3_ENV
    assert _resolver_env("") == settings.MBA3_ENV
    print(f"OK sin entorno usa el del .env ({settings.MBA3_ENV})")


def test_desconocido_falla():
    for malo in ("TEST", "QA", "staging", "PRODUCCION", "x"):
        try:
            resuelto = _resolver_env(malo)
        except ValueError:
            continue
        raise AssertionError(
            f"{malo!r} no lanzo error y resolvio a {resuelto!r}: "
            "un entorno desconocido no puede caer a produccion en silencio")
    print("OK un entorno desconocido lanza error en vez de asumir produccion")


if __name__ == "__main__":
    test_validos()
    test_por_defecto()
    test_desconocido_falla()
    print("\nEl entorno del ERP ya no se adivina.")
