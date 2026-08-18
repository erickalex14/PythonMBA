"""
Check de los periodos del dashboard de ventas: que cada rango compare contra un
periodo anterior del mismo largo y que los tops salgan del rango correcto.
Correr: py -3 Backend/scripts/test_dashboard_ventas.py
"""
import sys
import os
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.ventas_service import VentasService


def test_periodos_lunes_17_agosto():
    # 2026-08-17 es lunes: la semana en curso arranca ese mismo dia.
    ancla = datetime.date(2026, 8, 17)
    p = VentasService._calcular_periodos(ancla)

    assert p["hoy"]["desde"] == ancla and p["hoy"]["hasta"] == ancla
    assert p["ayer"]["desde"] == datetime.date(2026, 8, 16)
    assert p["semana"]["desde"] == ancla, "lunes: la semana empieza hoy"
    assert p["quincena"]["desde"] == datetime.date(2026, 8, 3), "15 dias incluyendo hoy"
    assert p["mes"]["desde"] == datetime.date(2026, 8, 1)
    assert p["anio"]["desde"] == datetime.date(2026, 1, 1)

    # El mes anterior se compara con el mismo tramo, no con el mes completo.
    assert p["mes"]["desde_ant"] == datetime.date(2026, 7, 1)
    assert p["mes"]["hasta_ant"] == datetime.date(2026, 7, 17)

    # El año anterior, hasta el mismo dia.
    assert p["anio"]["desde_ant"] == datetime.date(2025, 1, 1)
    assert p["anio"]["hasta_ant"] == datetime.date(2025, 8, 17)


def test_cada_rango_compara_contra_uno_del_mismo_largo():
    for ancla in [datetime.date(2026, 8, 17), datetime.date(2026, 8, 20), datetime.date(2026, 3, 1)]:
        for clave, p in VentasService._calcular_periodos(ancla).items():
            largo = (p["hasta"] - p["desde"]).days
            largo_ant = (p["hasta_ant"] - p["desde_ant"]).days
            assert largo_ant == largo, (
                f"{clave} en {ancla}: compara {largo+1} dias contra {largo_ant+1}")
            assert p["hasta_ant"] < p["desde"], f"{clave}: el periodo previo se solapa con el actual"


def test_mes_anterior_mas_corto_se_recorta():
    # 31 de marzo: febrero no tiene 31, el comparativo debe recortarse a fin de mes.
    p = VentasService._calcular_periodos(datetime.date(2026, 3, 31))
    assert p["mes"]["hasta_ant"] == datetime.date(2026, 2, 28)


def test_tops_solo_toman_su_rango():
    ancla = datetime.date(2026, 8, 17)
    periodos = VentasService._calcular_periodos(ancla)
    filas = [
        {"codigo": "A", "producto": "PROD A", "empresa": "NVC01", "fecha": ancla, "cantidad": 5, "monto": 10.0},
        {"codigo": "B", "producto": "PROD B", "empresa": "NVC01", "fecha": ancla, "cantidad": 1, "monto": 999.0},
        # Fuera de "hoy" pero dentro del mes: no debe aparecer en el top de hoy.
        {"codigo": "C", "producto": "PROD C", "empresa": "NVC01", "fecha": datetime.date(2026, 8, 2), "cantidad": 99, "monto": 5.0},
    ]
    tops = VentasService._calcular_tops(filas, periodos)

    codigos_hoy = {r["codigo"] for r in tops["hoy"]["general"]["cantidad"]}
    assert codigos_hoy == {"A", "B"}, f"el top de hoy no debe incluir otros dias: {codigos_hoy}"
    assert tops["hoy"]["general"]["cantidad"][0]["codigo"] == "A", "por cantidad manda A (5 unidades)"
    assert tops["hoy"]["general"]["dinero"][0]["codigo"] == "B", "por dinero manda B ($999)"
    assert {r["codigo"] for r in tops["mes"]["general"]["cantidad"]} == {"A", "B", "C"}


def test_tops_sin_ruido_y_sin_duplicar_empresas():
    ancla = datetime.date(2026, 8, 17)
    periodos = VentasService._calcular_periodos(ancla)
    filas = [
        # Mismo producto en las dos empresas: en "general" sale una vez, sumado.
        {"codigo": "1CENV153-NVC01", "producto": "CELULAR ENV LINK 2G BLUE", "empresa": "NVC01", "fecha": ancla, "cantidad": 431, "monto": 4310.0},
        {"codigo": "1CENV153-ENV01", "producto": "CELULAR ENV LINK 2G BLUE", "empresa": "ENV01", "fecha": ancla, "cantidad": 429, "monto": 4290.0},
        # Ruido promocional y servicios: fuera del ranking.
        {"codigo": "1KSM9477-NVC01", "producto": "Portaglobos", "empresa": "NVC01", "fecha": ancla, "cantidad": 9999, "monto": 50.0},
        {"codigo": "1KSM9476-NVC01", "producto": 'Globo ENV 3.2Gr 12"', "empresa": "NVC01", "fecha": ancla, "cantidad": 8888, "monto": 40.0},
        {"codigo": "1FENV1-NVC01", "producto": "FUNDA SILICONA", "empresa": "NVC01", "fecha": ancla, "cantidad": 700, "monto": 30.0},
        {"codigo": "B2P-SERTEC1-NVC01", "producto": "SERVICIO TECNICO", "empresa": "NVC01", "fecha": ancla, "cantidad": 500, "monto": 900.0},
        # Codigo con guion interno: no debe recortarse por el guion.
        {"codigo": "ZTE-BLADEL2-NVC01", "producto": "CELULAR ZTE BLADE", "empresa": "NVC01", "fecha": ancla, "cantidad": 10, "monto": 1000.0},
    ]
    tops_hoy = VentasService._calcular_tops(filas, periodos)["hoy"]

    codigos_general = [r["codigo"] for r in tops_hoy["general"]["cantidad"]]
    assert codigos_general == ["1CENV153", "ZTE-BLADEL2"], f"ranking general inesperado: {codigos_general}"
    assert int(tops_hoy["general"]["cantidad"][0]["cantidad"]) == 860, "general debe sumar las dos empresas (431+429)"

    # Por empresa: cada una ve solo lo suyo, sin sumar la otra.
    codigos_nvc01 = [r["codigo"] for r in tops_hoy["por_empresa"]["NVC01"]["cantidad"]]
    codigos_env01 = [r["codigo"] for r in tops_hoy["por_empresa"]["ENV01"]["cantidad"]]
    assert codigos_env01 == ["1CENV153"], f"ENV01 solo debe ver su propia fila: {codigos_env01}"
    assert int(tops_hoy["por_empresa"]["ENV01"]["cantidad"][0]["cantidad"]) == 429, "ENV01 no debe sumar NVC01"
    assert int(tops_hoy["por_empresa"]["NVC01"]["cantidad"][0]["cantidad"]) == 431, "NVC01 no debe sumar ENV01"
    assert "ZTE-BLADEL2" in codigos_nvc01, "NVC01 si debe ver sus propios productos"


if __name__ == "__main__":
    test_periodos_lunes_17_agosto()
    test_cada_rango_compara_contra_uno_del_mismo_largo()
    test_mes_anterior_mas_corto_se_recorta()
    test_tops_solo_toman_su_rango()
    test_tops_sin_ruido_y_sin_duplicar_empresas()
    print("OK: periodos, tops por rango, ruido filtrado, tops general y por empresa.")
