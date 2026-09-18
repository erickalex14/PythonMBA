"""Valida el servicio de Costos por Sucursal contra el reporte de referencia
del 07/09/2026 (TAREA-costos-por-sucursal.md):

    157.344 filas con OH > 0
    146 sucursales
    Total: 21.957.216,04

Pega contra el MBA3 real (PRUEBAS): ~16 peticiones paginadas con pausa de
1.5s entre cada una. No correr en loop ni bajar el limit -- el servicio
vetea la IP por peticiones/segundo.

Correr con:  py -3 Backend/scripts/validar_costos_bodega.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.repositories.mba3_repository import Mba3Repository  # noqa: E402
from app.services.costos_bodega_service import CostosBodegaService  # noqa: E402

REFERENCIA_FILAS = 157344
REFERENCIA_SUCURSALES = 146
REFERENCIA_TOTAL = 21957216.04


def main():
    service = CostosBodegaService(Mba3Repository())
    resultado = service.obtener_costos_por_sucursal(env="PRUEBAS")

    filas = resultado["filas_procesadas"]
    sucursales = resultado["sucursales"]
    total = resultado["total_general"]

    print(f"Filas procesadas:  {filas} (referencia {REFERENCIA_FILAS})")
    print(f"Sucursales:        {len(sucursales)} (referencia {REFERENCIA_SUCURSALES})")
    print(f"Total general:     {total:,.2f} (referencia {REFERENCIA_TOTAL:,.2f})")
    print(f"Diferencia total:  {total - REFERENCIA_TOTAL:,.2f}")

    print("\n--- Resultado ---")
    ok = True
    if filas != REFERENCIA_FILAS:
        print(f"AVISO: filas distintas ({filas} vs {REFERENCIA_FILAS}) -- puede ser normal si "
              "el inventario cambio desde el 07/09/2026, no necesariamente un error.")
    if len(sucursales) != REFERENCIA_SUCURSALES:
        print(f"FALLA: {len(sucursales)} sucursales, se esperaban {REFERENCIA_SUCURSALES}.")
        ok = False
    diferencia = abs(total - REFERENCIA_TOTAL)
    if diferencia > 0.01:
        print(f"FALLA: el total no cuadra (diferencia {diferencia:,.2f}).")
        ok = False
    else:
        print("OK: total general cuadra contra la referencia.")

    if ok:
        print("\nTop 5 sucursales por costo:")
        for s in sorted(sucursales, key=lambda x: -x["costo_total"])[:5]:
            print(f"  {s['sucursal']:<10} {s['costo_total']:>14,.2f}")


if __name__ == "__main__":
    main()
