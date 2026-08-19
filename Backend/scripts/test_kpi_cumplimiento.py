"""Valida la formula de cumplimiento KPI contra el Excel real de Seguimiento.

Los numeros salen de la fila de "001 RIO COCA" en la hoja RESUMEN KPI del
archivo SEGUIMIENTO KPI AL 16-08-2026.xlsx (corte 16-08-2026). Si esta prueba
falla, el reporte automatico dejo de cuadrar contra el que se arma a mano.

Correr con:  py -3 Backend/scripts/test_kpi_cumplimiento.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.kpi_service import KPIS, _cumplimiento, _rango_periodo  # noqa: E402

TOL = 1e-9

# (kpi, real, meta, aporte esperado en el Excel)
FILA_RIO_COCA = [
    ("rentabilidad",      0.38778992872713003, 0.4418821723667983, 0.03510346902207521),
    ("tecnologia",        1,                   12.333333333333334, 0.003243243243243243),
    ("celulares_tablets", 11,                  18,                 0.018333333333333333),
    ("motorola",          0,                   0,                  0.0),
    ("sillas_gamer",      3,                   4.333333333333333,  0.013846153846153848),
    ("hogar_gym",         32,                  29,                 0.02),
    ("planes_claro",      0,                   0,                  0.0),
    ("review_env",        0,                   1,                  0.0),
    ("credito_directo",   0,                   750,                0.0),
    ("servicio_tecnico",  122.09,              800,                0.0030522500000000003),
]

TOTAL_EXCEL = 0.09357844944480564


def test_aportes():
    for kpi, real, meta, esperado in FILA_RIO_COCA:
        peso = KPIS[kpi]["peso"]
        got = _cumplimiento(real, meta, peso)
        assert abs(got - esperado) < TOL, f"{kpi}: {got} != {esperado}"
    print(f"OK aportes por KPI ({len(FILA_RIO_COCA)} casos)")


def test_total():
    total = sum(_cumplimiento(r, m, KPIS[k]["peso"]) for k, r, m, _ in FILA_RIO_COCA)
    assert abs(total - TOTAL_EXCEL) < TOL, f"total {total} != {TOTAL_EXCEL}"
    print(f"OK total de la sucursal: {total:.8f}")


def test_bordes():
    # Por encima de la meta se topa en el peso, no lo supera.
    assert _cumplimiento(100, 10, 0.04) == 0.04
    # Justo en la meta paga el peso completo.
    assert _cumplimiento(10, 10, 0.04) == 0.04
    # Sin meta no puntua: en el Excel esa celda daba #DIV/0!.
    assert _cumplimiento(50, 0, 0.04) == 0.0
    assert _cumplimiento(50, None, 0.04) == 0.0
    # Un KPI con peso 0 no aporta aunque cumpla.
    assert _cumplimiento(10, 5, 0.0) == 0.0
    print("OK bordes (sobrecumplimiento, meta cero, peso cero)")


def test_periodo():
    ini, fin, dias = _rango_periodo("2026-08")
    assert (ini.isoformat(), fin.isoformat(), dias) == ("2026-08-01", "2026-08-31", 31)
    # Febrero bisiesto: 2028 tiene 29 dias.
    assert _rango_periodo("2028-02")[2] == 29
    print("OK rango de periodo (mes largo y febrero bisiesto)")


def test_pesos_declarados():
    # El Excel reparte 30% entre los 10 KPIs. Si alguien agrega uno sin ajustar
    # el resto, el total deja de ser comparable contra los meses anteriores.
    total = sum(k["peso"] for k in KPIS.values())
    assert abs(total - 0.30) < 1e-9, f"los pesos suman {total}, no 0.30"
    print("OK los pesos suman 30%")


if __name__ == "__main__":
    test_aportes()
    test_total()
    test_bordes()
    test_periodo()
    test_pesos_declarados()
    print("\nTodo cuadra contra el Excel de Contabilidad.")
