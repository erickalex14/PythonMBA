"""
Busca en INVT_Ficha_Principal los campos de "ultima venta" del ERP.
Hipotesis: Ultima Fecha Venta / Ultimo Precio del reporte nativo salen de la
ficha del producto, no del kardex del rango.
Valores buscados (del reporte de contabilidad 01-30 julio 2026):
  1CENV1030 -> fecha 2026-07-24, precio 54.05
  1KSM9474  -> fecha 2026-07-08, precio 0.05
  SERTEC    -> fecha 2026-07-30, precio 13.0
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings
from app.repositories.mba3_repository import Mba3Repository

ENV = os.environ.get("MBA3_ENV_OVERRIDE", settings.MBA3_ENV)
BUSCADOS = {
    "1CENV1030-NVC01": ("2026-07-24", 54.05),
    "1KSM9474-NVC01": ("2026-07-08", 0.05),
    "SERTEC-NVC01": ("2026-07-30", 13.0),
}

repo = Mba3Repository()
token = repo.obtener_token(force_refresh=True, env=ENV)
if not token:
    print(f"No se pudo obtener token en {ENV}")
    sys.exit(1)
print(f"Login OK en {ENV}\n")

for codigo, (fecha_esp, precio_esp) in BUSCADOS.items():
    filas = repo.ejecutar_consulta(
        token=token, select="*", table="INVT_Ficha_Principal",
        where=f"PRODUCT_ID_CORP = '{codigo}'", limit=1, env=ENV,
    )
    if not filas:
        print(f"{codigo}: sin ficha")
        continue
    ficha = filas[0]
    print(f"===== {codigo} (contabilidad: fecha {fecha_esp}, precio {precio_esp}) =====")

    # Campos cuyo valor coincide con lo que reporta contabilidad.
    coincidencias = []
    for k, v in ficha.items():
        s = str(v).strip()
        if not s or s in ("0", "0.0", "None"):
            continue
        if fecha_esp in s or s.startswith(fecha_esp):
            coincidencias.append((k, v, "FECHA"))
        else:
            try:
                if abs(float(s) - precio_esp) < 0.005:
                    coincidencias.append((k, v, "PRECIO"))
            except ValueError:
                pass
    if coincidencias:
        for k, v, tipo in coincidencias:
            print(f"  [{tipo}] {k} = {v}")
    else:
        print("  ningun campo de la ficha coincide")

    # Cualquier campo que huela a fecha/precio de ultima venta, para tener el mapa.
    print("  -- campos candidatos --")
    for k, v in ficha.items():
        ku = k.upper()
        if any(t in ku for t in ("LAST", "ULTIM", "SALE_DATE", "SALEDATE", "PRICE", "PRECIO", "FECHA")):
            s = str(v).strip()
            if s and s not in ("None", ""):
                print(f"     {k} = {s[:40]}")
    print()
