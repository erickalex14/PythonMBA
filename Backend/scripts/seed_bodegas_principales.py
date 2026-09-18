"""Carga inicial del catalogo "Bodega Principal" -> "Sub-Bodega" (jerarquia
de filtro del reporte de Costos por Sucursal), desde el JSON ya extraido y
verificado del Excel de Contabilidad (Estructura_Todas_las_Bodegas_y_
Subbodegas.xlsx, hoja "Listado Completo (Matriz)", 322 filas, 200 Bodegas
Principales distintas, importado 2026-09-16). Ese documento es propio de
NVC01: no cubre ENV01.

No hay endpoint de subida todavia (a diferencia de KPI/importar): este
catalogo cambia con poca frecuencia (es la estructura fisica de bodegas del
negocio), y este script cubre la carga/actualizacion manual mientras tanto.

Correr con:
    py -3 Backend/scripts/seed_bodegas_principales.py
    py -3 Backend/scripts/seed_bodegas_principales.py ruta/a/otro.json ENV01
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal  # noqa: E402
from app.services.costos_bodega_service import importar_estructura_bodegas  # noqa: E402

RUTA_POR_DEFECTO = Path(__file__).resolve().parent / "seed_data" / "bodegas_principales_nvc01.json"


def main():
    ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else RUTA_POR_DEFECTO
    corp = sys.argv[2] if len(sys.argv) > 2 else "NVC01"
    if not ruta.exists():
        raise SystemExit(f"No existe el archivo: {ruta}")

    filas = json.loads(ruta.read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        resumen = importar_estructura_bodegas(db, filas, corp)
    finally:
        db.close()
    print(f"{corp}: {resumen['bodegas_principales']} bodegas principales, "
          f"{resumen['subbodegas_tipo']} sub-bodegas con tipo (de {len(filas)} filas leidas de {ruta.name})")


if __name__ == "__main__":
    main()
