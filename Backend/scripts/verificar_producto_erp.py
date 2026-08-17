"""
Verifica un producto contra el ERP directo (no el staging), para separar
"el staging perdio filas" de "el ambiente tiene otros datos".
Usa el repositorio del proyecto (servicio del .env = ERICKDEV).
"""
import sys
import os
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.repositories.mba3_repository import Mba3Repository

PRODUCTO = os.environ.get("PRODUCTO", "1ESM1778")
DESDE = os.environ.get("FECHA_DESDE", "2026-07-01")
HASTA = os.environ.get("FECHA_HASTA", "2026-07-30")
ENV = os.environ.get("MBA3_ENV_OVERRIDE", "PRUEBAS")

repo = Mba3Repository()
token = repo.obtener_token(force_refresh=True, env=ENV)
if not token:
    print(f"No se pudo obtener token para {ENV}")
    sys.exit(1)
print(f"Login OK en {ENV}")

datos = repo.ejecutar_consulta(
    token=token,
    select="TRANS_DATE,PRODUCT_ID_CORP,ORIGIN_MEMO,IN_OUT,QUANTITY,NET_LINE_TOTAL,Anulada,ORIGIN_REF",
    table="INVT_Producto_Movimientos",
    where=(f"TRANS_DATE >= '{DESDE}' AND TRANS_DATE <= '{HASTA}' "
           f"AND PRODUCT_ID_CORP = '{PRODUCTO}-NVC01'"),
    limit=100000,
    env=ENV,
)
print(f"Filas del ERP: {len(datos)}")
if not datos:
    sys.exit(0)

df = pd.DataFrame(datos)
df["QUANTITY"] = pd.to_numeric(df["QUANTITY"], errors="coerce").fillna(0)
df["NET_LINE_TOTAL"] = pd.to_numeric(df["NET_LINE_TOTAL"], errors="coerce").fillna(0)
for c in ["ORIGIN_MEMO", "IN_OUT", "Anulada"]:
    df[c] = df[c].astype(str).str.strip()

g = df.groupby(["ORIGIN_MEMO", "IN_OUT", "Anulada"]).agg(
    filas=("QUANTITY", "size"),
    qty=("QUANTITY", "sum"),
    total=("NET_LINE_TOTAL", "sum")).reset_index()
print(f"\n--- {PRODUCTO}-NVC01 en el ERP {ENV}, {DESDE} a {HASTA} ---")
print(g.sort_values("filas", ascending=False).to_string(index=False))
