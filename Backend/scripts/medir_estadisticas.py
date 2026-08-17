"""
Desglosa el tiempo del reporte de Estadisticas de Inventarios por fase, para
saber que conviene cachear antes de montar infraestructura.
"""
import sys
import os
import time
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import SessionLocal
from app.dependencies import get_estadisticas_service
from app.repositories.mba3_repository import Mba3Repository
from app.services.estadisticas_service import EstadisticasVentasService

INICIO = os.environ.get("FECHA_INICIO", "2026-07-01")
FIN = os.environ.get("FECHA_FIN", "2026-07-31")

servicio = EstadisticasVentasService(Mba3Repository())
db = SessionLocal()
try:
    t0 = time.time()
    catalogo = servicio._obtener_catalogo()
    t_catalogo = time.time() - t0

    t0 = time.time()
    ventas = servicio._obtener_ventas_agregadas(INICIO, FIN, db)
    t_ventas = time.time() - t0

    t0 = time.time()
    ajustes = servicio._obtener_ajustes_inventario(INICIO, FIN, db)
    t_ajustes = time.time() - t0

    t0 = time.time()
    df = servicio.obtener_estadisticas(INICIO, FIN, db)
    t_total = time.time() - t0

    t0 = time.time()
    registros = df.to_dict(orient="records")
    payload = json.dumps(registros, default=str)
    t_serializar = time.time() - t0

    print(f"catalogo (ERP)        {t_catalogo:6.2f}s   {len(catalogo):>7,} productos")
    print(f"ventas (Postgres)     {t_ventas:6.2f}s   {len(ventas):>7,} filas")
    print(f"ajustes (Postgres)    {t_ajustes:6.2f}s   {len(ajustes):>7,} filas")
    print(f"obtener_estadisticas  {t_total:6.2f}s   {len(df):>7,} filas  (repite las 3 fases)")
    print(f"serializar a JSON     {t_serializar:6.2f}s   {len(payload)/1048576:>7.2f} MB")
    print()
    print(f"El catalogo es {t_catalogo / max(t_total, 0.01) * 100:.0f}% del tiempo del reporte.")

    # Segunda corrida: el token ya esta en cache, mide el costo real recurrente.
    t0 = time.time()
    servicio._obtener_catalogo()
    print(f"catalogo, 2da corrida {time.time() - t0:6.2f}s  (token ya cacheado)")
finally:
    db.close()
