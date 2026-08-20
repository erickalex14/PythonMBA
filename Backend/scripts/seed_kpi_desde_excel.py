"""Carga inicial de las tablas KPI desde el Excel que hoy se arma a mano.

Hace lo mismo que POST /api/v1/kpi/importar, pero desde la terminal. Util para
sembrar contra la base local; en produccion conviene subir el archivo desde el
panel y no entrar por SSH.

Correr con:
    py -3 Backend/scripts/seed_kpi_desde_excel.py "C:/ruta/SEGUIMIENTO KPI.xlsx" 2026-08
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.kpi_service import KpiService  # noqa: E402


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(2)

    ruta, periodo = Path(sys.argv[1]), sys.argv[2]
    if not ruta.exists():
        raise SystemExit(f"No existe el archivo: {ruta}")

    resumen = KpiService().importar_excel(ruta.read_bytes(), periodo)
    print(f"periodo {resumen['periodo']}: "
          f"{resumen['sucursales']} sucursales, "
          f"{resumen['productos']} productos, "
          f"{resumen['metas']} metas")


if __name__ == "__main__":
    main()
