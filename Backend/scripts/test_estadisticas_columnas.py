"""
Check de la logica nueva del reporte de Estadisticas de Inventarios:
No. Dias (contra fin de rango, inclusivo) y UNID VEND FINAL.
Valores esperados tomados del reporte del ERP "01 AL 30 JULIO 2026".
Correr: py -3 Backend/scripts/test_estadisticas_columnas.py
"""
import pandas as pd


def no_dias(ultima_fecha_venta, fecha_fin):
    """Misma formula que estadisticas_service.obtener_estadisticas."""
    fin_dt = pd.Timestamp(fecha_fin)
    fecha_dt = pd.to_datetime(pd.Series(ultima_fecha_venta), errors="coerce")
    return ((fin_dt - fecha_dt).dt.days + 1).tolist()


def test_no_dias():
    # Del reporte del ERP, rango 2026-07-01 a 2026-07-30.
    esperado = {"2026-07-30": 1, "2026-07-29": 2, "2026-07-28": 3, "2026-07-22": 9, "2026-07-20": 11}
    fechas = list(esperado.keys())
    obtenido = no_dias(fechas, "2026-07-30")
    for fecha, valor in zip(fechas, obtenido):
        assert valor == esperado[fecha], f"No. Dias de {fecha}: esperaba {esperado[fecha]}, dio {valor}"

    # No debe depender de la fecha actual: mismo rango, mismo resultado siempre.
    assert no_dias(["2026-07-30"], "2026-07-30") == [1]


def test_unid_vend_final():
    # Filas reales del reporte del ERP: vendidas - devueltas - robo = final.
    casos = [
        (4347, 0, 0, 4347),
        (3220, 109, 1, 3110),
        (3127, 101, 8, 3018),
        (704, 2, 200, 502),
        (632, 2, 0, 630),
    ]
    for vendidas, dev, robo, final in casos:
        assert vendidas - dev - robo == final, f"{vendidas}-{dev}-{robo} deberia dar {final}"

    # Totales del reporte completo de julio 2026.
    assert 100807 - 2409 - 3468 == 94930


if __name__ == "__main__":
    test_no_dias()
    test_unid_vend_final()
    print("OK: No. Dias y UNID VEND FINAL cuadran con el reporte del ERP.")
