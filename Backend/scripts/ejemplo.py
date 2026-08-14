import os
import requests

BASE_URL = os.environ["MBA3_BASE_URL"]
CODIGO = os.environ["MBA3_CODIGO_SERVICIO"]
PASSWORD = os.environ["MBA3_PASSWORD_SERVICIO"]


def obtener_token() -> str:
    resp = requests.post(
        f"{BASE_URL}/ws2_mba3_serv_/login_servicio",
        json={"codigo": CODIGO, "pwd": PASSWORD},
        headers={"Content-Type": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    token = resp.json().get("jwt")
    if not token:
        raise RuntimeError("Login OK pero respuesta sin 'jwt'")
    return token


def ejecutar_consulta(token: str, select: str, table: str, where: str | None = None, limit: int | None = None) -> list[dict]:
    payload = {"select": select, "from": table}
    if where:
        payload["where"] = where
    if limit:
        payload["limit"] = str(limit)

    resp = requests.post(
        f"{BASE_URL}/ws2_mba3_serv_Consultas_Externas_/",
        headers={"Authorization": token},
        data=payload,
        timeout=120,
    )
    resp.raise_for_status()
    datos = resp.json()

    # ERP MBA3 devuelve dict con codigo "009" cuando no hay registros, en vez de lista vacía.
    if isinstance(datos, dict) and datos.get("codigo") == "009":
        return []
    return datos if isinstance(datos, list) else [datos]


if __name__ == "__main__":
    token = obtener_token()
    print(f"Token obtenido: {token[:20]}...")

    filas = ejecutar_consulta(token, select="*", table="VENTAS", limit=5)
    print(f"{len(filas)} filas recibidas")
    for fila in filas[:3]:
        print(fila)

    # No hay conexión que cerrar: cada requests.post() es una petición HTTP
    # corta e independiente (sin requests.Session() persistente).