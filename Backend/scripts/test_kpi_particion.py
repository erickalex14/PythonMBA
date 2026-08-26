"""Valida que partir un dia topado no pierda ni duplique filas.

El ERP de PRUEBAS corta en 3000 filas sin avisar. `_por_partes` baja por
mitades hasta que cada pedazo entra completo. Si esta prueba falla, el kardex
del reporte queda corto en silencio, que es justo el error que costo mas caro.

Correr con:  py -3 Backend/scripts/test_kpi_particion.py
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.kpi_service import KpiSyncVentas  # noqa: E402

TOPE = 3000
WHERE_DIA = "TRANS_DATE = '2026-08-05'"


class ErpFalso:
    """ERP de mentira: respeta los rangos y corta en 3000 filas, como PRUEBAS."""

    def __init__(self, filas_por_bodega):
        self.datos = filas_por_bodega
        self.peticiones = 0

    def obtener_token(self, **kw):
        return "tok"

    def ejecutar_consulta(self, token, columnas, tabla, where, limit, env=None):
        self.peticiones += 1
        lo = re.search(r"WAR_CODE >= '([^']*)'", where)
        hi = re.search(r"WAR_CODE < '([^']*)'", where)
        filas = []
        for code in sorted(self.datos):
            if lo and code < lo.group(1):
                continue
            if hi and code >= hi.group(1):
                continue
            filas += [{"WAR_CODE": code, "DOC": f"{code}-{i}"}
                      for i in range(self.datos[code])]
        return filas[:TOPE]


def partir(datos):
    erp = ErpFalso(datos)
    sync = KpiSyncVentas(erp)
    filas, _, topados = sync._por_partes(
        "tok", "COLS", "INVT_Producto_Movimientos", WHERE_DIA,
        "WAR_CODE", sorted(datos), None)
    return erp, filas, topados


def test_dia_que_no_se_topa():
    erp, filas, topados = partir({"001": 10, "002": 20})
    assert len(filas) == 30, len(filas)
    assert not topados
    assert erp.peticiones == 1, f"no debia partir nada, hizo {erp.peticiones}"
    print("OK dia corto: una sola peticion, sin partir")


def test_dia_topado_se_recupera_entero():
    # ~8900 filas repartidas en 325 bodegas, como un dia real de agosto.
    datos = {f"{i:03d}": 27 for i in range(1, 326)}
    datos["NVA"] = 200
    total = sum(datos.values())
    erp, filas, topados = partir(datos)

    assert not topados, topados
    assert len(filas) == total, f"esperaba {total}, llegaron {len(filas)}"
    docs = {f["DOC"] for f in filas}
    assert len(docs) == total, f"{total - len(docs)} filas duplicadas"
    faltan = set(datos) - {f["WAR_CODE"] for f in filas}
    assert not faltan, f"bodegas perdidas: {sorted(faltan)}"
    assert erp.peticiones < 40, f"demasiadas peticiones: {erp.peticiones}"
    print(f"OK dia topado: {total} filas enteras en {erp.peticiones} peticiones")


def test_bodega_sola_mas_grande_que_el_tope():
    # Una sola bodega por encima del tope no se puede partir mas: hay que avisar,
    # no devolver 3000 filas como si fueran todas.
    _, filas, topados = partir({"001": 5000, "002": 10})
    assert topados, "una bodega impartible tiene que reportarse como topada"
    assert len(filas) >= TOPE
    print(f"OK bodega impartible se reporta: {topados}")


def test_codigo_fuera_del_maestro_no_se_pierde():
    # 'ZZZ' esta en el kardex pero no en el maestro: los cortes semiabiertos
    # tienen que arrastrarlo igual dentro del ultimo pedazo.
    datos = {f"{i:03d}": 27 for i in range(1, 326)}
    erp = ErpFalso({**datos, "ZZZ": 50})
    sync = KpiSyncVentas(erp)
    filas, _, _ = sync._por_partes("tok", "COLS", "INVT_Producto_Movimientos",
                                   WHERE_DIA, "WAR_CODE", sorted(datos), None)
    assert any(f["WAR_CODE"] == "ZZZ" for f in filas), "se perdio una bodega ajena al maestro"
    print("OK bodega fuera del maestro sigue llegando")


if __name__ == "__main__":
    test_dia_que_no_se_topa()
    test_dia_topado_se_recupera_entero()
    test_bodega_sola_mas_grande_que_el_tope()
    test_codigo_fuera_del_maestro_no_se_pierde()
    print("\nPartir un dia topado no pierde ni duplica filas.")
