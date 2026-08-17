"""
Lista los ORIGIN_MEMO reales (sin truncar) del kardex del ERP en un rango,
para identificar cual corresponde a devoluciones y cual a robos en el
reporte de Estadisticas de Inventarios.
Usa el repositorio del proyecto (servicio del .env = ERICKDEV).
"""
import sys
import os
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.repositories.mba3_repository import Mba3Repository

DESDE = os.environ.get("FECHA_DESDE", "2026-07-01")
HASTA = os.environ.get("FECHA_HASTA", "2026-07-30")
ENV = os.environ.get("MBA3_ENV_OVERRIDE", "PRUEBAS")

repo = Mba3Repository()
token = repo.obtener_token(force_refresh=True, env=ENV)
if not token:
    print(f"No se pudo obtener token para {ENV}")
    sys.exit(1)
print(f"Login OK en {ENV}")

# Un solo dia basta para enumerar los tipos de movimiento y ver el texto completo.
datos = repo.ejecutar_consulta(
    token=token,
    select="TRANS_DATE,ORIGIN_MEMO,IN_OUT,QUANTITY,PRODUCT_ID_CORP,Anulada",
    table="INVT_Producto_Movimientos",
    where=f"TRANS_DATE >= '{DESDE}' AND TRANS_DATE <= '{HASTA}'",
    limit=300000,
    env=ENV,
)
print(f"Filas del ERP: {len(datos)}")
if not datos:
    sys.exit(0)

df = pd.DataFrame(datos)
df["QUANTITY"] = pd.to_numeric(df["QUANTITY"], errors="coerce").fillna(0)
df["ORIGIN_MEMO"] = df["ORIGIN_MEMO"].astype(str).str.strip()
df["IN_OUT"] = df["IN_OUT"].astype(str).str.strip()
df["Anulada"] = df["Anulada"].astype(str).str.strip()

g = df.groupby(["ORIGIN_MEMO", "IN_OUT", "Anulada"]).agg(
    largo=("ORIGIN_MEMO", lambda s: len(s.iloc[0])),
    filas=("QUANTITY", "size"),
    qty=("QUANTITY", "sum")).reset_index()
print(f"\n--- ORIGIN_MEMO completos, {DESDE} a {HASTA} ({ENV}) ---")
print(g.sort_values("filas", ascending=False).to_string(index=False))

hay_robo = [m for m in df["ORIGIN_MEMO"].unique() if "ROBO" in m.upper()]
print(f"\nMemos que mencionan ROBO: {hay_robo if hay_robo else 'NINGUNO'}")
largos = [m for m in df["ORIGIN_MEMO"].unique() if len(m) > 17]
print(f"Memos de mas de 17 caracteres (truncados en staging): {largos if largos else 'NINGUNO'}")
