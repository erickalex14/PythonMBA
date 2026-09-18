"""Confirma contra el MBA3 real que orderBy + offset paginan sin perder ni
repetir filas en INVT_Bodegas_Saldos, antes de construir nada sobre ese
supuesto (TAREA-costos-por-sucursal.md).

No toca mba3_repository.py: ese cliente compartido todavia no acepta
orderBy/offset, asi que esta consulta se arma a mano, temporal, solo para
esta investigacion. Reusa Mba3Repository unicamente para el login (evita
duplicar esa parte).

Verifica:
  1. El servicio acepta las llaves orderBy y offset sin devolver error.
  2. IndexKey_ProductoBodega (unico por fila, campo #11 del diccionario)
     no se repite entre la pagina 1 y la pagina 2.
  3. El orden es realmente ascendente por esa columna: la ultima llave de la
     pagina 1 es menor que la primera de la pagina 2.

Correr con:  py -3 Backend/scripts/investigar_paginacion_saldos.py
"""
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings                          # noqa: E402
from app.repositories.mba3_repository import Mba3Repository, procesar_respuesta_erp  # noqa: E402

CORP = settings.MBA3_CORP
TABLA = "INVT_Bodegas_Saldos"
CAMPOS = "WARE_CODE,PRODUCT_ID_CORP,IndexKey_ProductoBodega,OH"
ORDEN = "IndexKey_ProductoBodega asc"
TAMANO_PAGINA = 5


def pedir_pagina(token: str, offset: int) -> list:
    """Arma la peticion a mano, incluyendo orderBy/offset (que el cliente
    compartido no soporta todavia), y la manda igual que ejecutar_consulta."""
    payload = {
        "select": CAMPOS,
        "from": TABLA,
        "where": f"CORP='{CORP}' AND OH>0",
        "orderBy": ORDEN,
        "limit": str(TAMANO_PAGINA),
        "offset": str(offset),
    }
    resp = requests.post(
        settings.MBA3_URL_CONSULTA,
        headers={"Authorization": token},
        data=payload,
        timeout=60,
    )
    resp.raise_for_status()
    return procesar_respuesta_erp(resp.json(), f"{TABLA} offset={offset}")


def main():
    repo = Mba3Repository()
    token = repo.obtener_token(env="PRUEBAS")
    if not token:
        print("No se pudo obtener token. Revisar credenciales en .env.")
        sys.exit(1)

    print(f"CORP={CORP}  orderBy='{ORDEN}'  limit={TAMANO_PAGINA}\n")

    pagina_1 = pedir_pagina(token, offset=0)
    print(f"Pagina 1 (offset=0): {len(pagina_1)} filas")
    for f in pagina_1:
        print(f"  {f.get('IndexKey_ProductoBodega')}  {f.get('WARE_CODE')}  {f.get('PRODUCT_ID_CORP')}")

    if len(pagina_1) < TAMANO_PAGINA:
        print("\nMenos filas que el tamano de pagina: no hay suficiente data "
              "para probar una segunda pagina de forma concluyente.")
        return

    import time
    time.sleep(1.5)  # mismo respiro que usa el resto del codigo contra este servicio

    pagina_2 = pedir_pagina(token, offset=TAMANO_PAGINA)
    print(f"\nPagina 2 (offset={TAMANO_PAGINA}): {len(pagina_2)} filas")
    for f in pagina_2:
        print(f"  {f.get('IndexKey_ProductoBodega')}  {f.get('WARE_CODE')}  {f.get('PRODUCT_ID_CORP')}")

    claves_1 = [str(f.get("IndexKey_ProductoBodega")) for f in pagina_1]
    claves_2 = [str(f.get("IndexKey_ProductoBodega")) for f in pagina_2]

    print("\n--- Resultado ---")

    repetidas = set(claves_1) & set(claves_2)
    if repetidas:
        print(f"FALLA: {len(repetidas)} IndexKey_ProductoBodega repetida(s) entre paginas: {repetidas}")
    else:
        print("OK: ninguna fila se repite entre pagina 1 y pagina 2.")

    if claves_1 and claves_2:
        if claves_1[-1] < claves_2[0]:
            print(f"OK: orden ascendente real (ultima pag.1={claves_1[-1]!r} < primera pag.2={claves_2[0]!r}).")
        else:
            print(f"FALLA: no quedo ascendente (ultima pag.1={claves_1[-1]!r}, primera pag.2={claves_2[0]!r}).")


if __name__ == "__main__":
    main()
