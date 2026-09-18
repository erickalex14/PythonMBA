"""Valida agregar_por_sucursal(): redondeo estilo MBA3, resolucion de Bodega
Principal (con y sin catalogo manual), fallback para bodegas sin
Codigo_Local (TRN/RCP), y que un WARE_CODE numerico no rompa la agregacion.

Corresponde a TAREA-costos-por-sucursal.md y a la jerarquia Bodega Principal
-> Sub-Bodega agregada 2026-09-16. Sin red: opera solo sobre fixtures, no
toca mba3_repository ni el ERP.

Correr con:  py -3 Backend/scripts/test_costos_bodega.py
"""
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.costos_bodega_service import (  # noqa: E402
    CostosBodegaService, _costo_linea, agregar_por_sucursal, resolver_bodega_principal_codigo,
    resolver_bodega_principal_nombre, resolver_costo_promedio)


def test_agregacion_por_bodega_principal_sin_red():
    """agregar_por_sucursal() recibe un iterable de filas + un dict de
    bodegas, ningun cliente HTTP: se puede probar contra fixtures. Dos
    sub-bodegas (1VT, RCE) de la misma Bodega Principal (PRI) deben sumar
    juntas. La llave del resultado es SOLO el codigo_principal -- el nombre
    se resuelve aparte (ver test_resumen_subbodegas_por_principal), nunca
    como parte de esta llave (bug de fragmentacion corregido 2026-09-18,
    ver docstring de agregar_por_sucursal)."""
    filas = [
        {"WARE_CODE": "1VT", "Costo_Promedio": 10, "OH": 5},   # 50.00
        {"WARE_CODE": "RCE", "Costo_Promedio": 2, "OH": 3},    # 6.00 -> PRI = 56.00
        {"WARE_CODE": "2VT", "Costo_Promedio": 4, "OH": 2},    # 8.00 -> CARACOL
    ]
    bodegas = {
        "1VT": {"codigo_local": "PRI", "ware_name": "RIO COCA VENTAS"},
        "RCE": {"codigo_local": "PRI", "ware_name": "RIO COCA CONSIGNACION"},
        "2VT": {"codigo_local": "2", "ware_name": "CARACOL VENTAS"},
    }
    totales = agregar_por_sucursal(filas, bodegas)
    assert totales["PRI"] == Decimal("56.00")
    assert totales["2"] == Decimal("8.00")
    print("OK agregacion por Bodega Principal (junta sub-bodegas), sin tocar la red")


def test_agregacion_no_se_fragmenta_sin_catalogo():
    """Reproduce el bug real de produccion (2026-09-18): una Bodega
    Principal con VARIAS sub-bodegas de WARE_NAME distinto, SIN entrada en
    el catalogo manual (`bodegas_principales` vacio o incompleto). Antes,
    el nombre por fila (WARE_NAME) entraba en la llave de agregacion y esto
    daba tres totales separados en vez de uno solo sumado."""
    filas = [
        {"WARE_CODE": "163", "Costo_Promedio": 10, "OH": 5},   # 50.00
        {"WARE_CODE": "27F", "Costo_Promedio": 2, "OH": 3},    # 6.00
        {"WARE_CODE": "27M", "Costo_Promedio": 4, "OH": 2},    # 8.00
    ]
    bodegas = {
        "163": {"codigo_local": "27", "ware_name": "C.LOG. DURAN"},
        "27F": {"codigo_local": "27", "ware_name": "FUNNY PARK"},
        "27M": {"codigo_local": "27", "ware_name": "99MAYORIS CLGYE"},
    }
    totales = agregar_por_sucursal(filas, bodegas)
    assert totales == {"27": Decimal("64.00")}
    print("OK sin catalogo, sub-bodegas de WARE_NAME distinto siguen sumando a UNA sola Bodega Principal")


def test_redondeo_estilo_mba3_no_banker():
    """round() nativo de Python (banker's rounding) da 6.76 y 2.25 -- MBA3/
    Excel dan 6.77 y 2.26 (ROUND_HALF_UP). Ver TAREA-costos-por-sucursal.md."""
    assert _costo_linea(2.255, 3) == Decimal("6.77")
    assert _costo_linea(2.255, 1) == Decimal("2.26")
    print("OK redondeo ROUND_HALF_UP (no banker's rounding)")


def test_resolver_bodega_principal_codigo():
    """Codigo_Local manda cuando existe; TRN/RCP (sin Codigo_Local) caen a
    su propio WARE_CODE -- se tratan como su propia Bodega Principal."""
    assert resolver_bodega_principal_codigo(codigo_local="PRI", ware_code="1VT") == "PRI"
    assert resolver_bodega_principal_codigo(codigo_local=None, ware_code="TRN") == "TRN"
    assert resolver_bodega_principal_codigo(codigo_local="", ware_code="RCP") == "RCP"
    print("OK resolucion de codigo de Bodega Principal (Codigo_Local, o WARE_CODE si no tiene)")


def test_resolver_bodega_principal_nombre():
    """El nombre del catalogo manual manda; sin match (ENV01, o bodega nueva
    de NVC01), cae a WARE_NAME y despues al propio codigo -- nunca se pierde
    la fila en silencio."""
    assert resolver_bodega_principal_nombre("PRI", "001 RIO COCA", "RIO COCA VENTAS") == "001 RIO COCA"
    assert resolver_bodega_principal_nombre("XYZ", None, "BODEGA NUEVA ENV01") == "BODEGA NUEVA ENV01"
    assert resolver_bodega_principal_nombre("XYZ", None, None) == "XYZ"
    print("OK resolucion de nombre de Bodega Principal (catalogo -> WARE_NAME -> codigo)")


def test_fallback_bodegas_sin_codigo_local():
    """TRN (Transito) y RCP (Proveedor) no tienen Codigo_Local: el reporte
    las agrupa como su propia Bodega Principal, usando su WARE_NAME."""
    filas = [
        {"WARE_CODE": "TRN", "Costo_Promedio": 5, "OH": 2},   # 10.00
        {"WARE_CODE": "RCP", "Costo_Promedio": 1, "OH": 1},   # 1.00
    ]
    bodegas = {
        "TRN": {"codigo_local": None, "ware_name": "TRANSITO"},
        "RCP": {"codigo_local": None, "ware_name": None},
    }
    totales = agregar_por_sucursal(filas, bodegas)
    assert totales["TRN"] == Decimal("10.00")
    assert totales["RCP"] == Decimal("1.00")
    print("OK fallback de Bodega Principal (TRN/RCP sin Codigo_Local)")


def test_ware_code_numerico_no_rompe():
    """Bodegas como 145/184/187 pueden llegar como int en el JSON del ERP,
    no como str. Un .strip() directo sobre un int revienta con
    AttributeError."""
    filas = [{"WARE_CODE": 145, "Costo_Promedio": 3, "OH": 2}]  # 6.00
    bodegas = {"145": {"codigo_local": "16", "ware_name": "BODEGA 145"}}
    totales = agregar_por_sucursal(filas, bodegas)
    assert totales["16"] == Decimal("6.00")
    print("OK WARE_CODE numerico (int) no rompe la agregacion")


def test_respaldo_costo_producto_cuando_bodega_da_cero():
    """Confirmado contra MBA3 real (2026-09-15): en PRUEBAS Costo_Promedio de
    INVT_Bodegas_Saldos viene en 0 para todo NVC01, pero AVERAGE_COST de la
    ficha del producto (INVT_Ficha_Principal) trae el costo real. Sin este
    respaldo el reporte da $0 en un ambiente donde la plata si existe."""
    assert resolver_costo_promedio(costo_promedio_saldo=0, average_cost_producto=29.81) == 29.81
    # Con costo de bodega real (>0), ese manda -- no se pisa con el del producto.
    assert resolver_costo_promedio(costo_promedio_saldo=15.5, average_cost_producto=29.81) == 15.5
    # Sin ficha de producto (LEFT JOIN sin match), no revienta: cae a 0.
    assert resolver_costo_promedio(costo_promedio_saldo=0, average_cost_producto=None) == 0

    filas = [{"WARE_CODE": "001", "PRODUCT_ID_CORP": "ABC-NVC01", "Costo_Promedio": 0, "OH": 5}]
    bodegas = {"001": {"codigo_local": "10", "ware_name": "TIENDA 010"}}
    productos = {"ABC-NVC01": {"average_cost": 29.81}}
    totales = agregar_por_sucursal(filas, bodegas, productos)
    assert totales["10"] == Decimal("149.05")  # 29.81 * 5
    print("OK respaldo de costo del producto cuando el de la bodega viene en 0")


def test_resumen_subbodegas_por_principal():
    """Cuenta sub-bodegas por Bodega Principal (todas, tengan o no stock),
    resuelve una ciudad representativa -- la primera no vacia entre sus
    sub-bodegas, porque CITY de MBA3 viene muy disperso (confirmado contra
    MBA3 real: ~5% de las bodegas de NVC01 lo tienen cargado) -- y resuelve
    el nombre UNA sola vez por principal: con catalogo (PRI), el nombre del
    catalogo manda sin importar el WARE_NAME de cada sub-bodega; sin
    catalogo (2), cae al WARE_NAME de la PRIMERA sub-bodega en orden de
    WARE_CODE (determinista, no cualquiera al azar)."""
    bodegas = {
        "1VT": {"codigo_local": "PRI", "ware_name": "RIO COCA VENTAS", "ciudad": None},
        "RCE": {"codigo_local": "PRI", "ware_name": "RIO COCA CONSIGNACION", "ciudad": "QUITO"},
        "RCC": {"codigo_local": "PRI", "ware_name": "RIO COCA OTRA", "ciudad": "QUITO"},
        "2VT": {"codigo_local": "2", "ware_name": "CARACOL VENTAS", "ciudad": None},
        "TRN": {"codigo_local": None, "ware_name": "TRANSITO", "ciudad": None},
    }
    principales = {"PRI": "001 RIO COCA"}
    resumen = CostosBodegaService._resumen_subbodegas_por_principal(bodegas, principales)
    assert resumen["PRI"] == {"total_subbodegas": 3, "ciudad": "QUITO", "nombre": "001 RIO COCA"}
    # "2" no esta en el catalogo: cae al WARE_NAME de su unica sub-bodega.
    assert resumen["2"] == {"total_subbodegas": 1, "ciudad": None, "nombre": "CARACOL VENTAS"}
    # TRN sin Codigo_Local es su propia "principal" (mismo fallback que el resto).
    assert resumen["TRN"] == {"total_subbodegas": 1, "ciudad": None, "nombre": "TRANSITO"}
    print("OK conteo de sub-bodegas, ciudad y nombre representativos por Bodega Principal")


def test_no_mezcla_ware_code_compartido_entre_bodegas_distintas():
    """Dos dicts de `bodegas` separados (uno por empresa, como arma
    CostosBodegaService.obtener_costos_por_sucursal) para el mismo WARE_CODE
    ("TRN", compartido entre NVC01 y ENV01) no deben mezclar nombres: cada
    llamada a agregar_por_sucursal esta acotada a un solo dict de bodegas."""
    filas_nvc01 = [{"WARE_CODE": "TRN", "Costo_Promedio": 5, "OH": 2}]  # 10.00
    filas_env01 = [{"WARE_CODE": "TRN", "Costo_Promedio": 3, "OH": 2}]  # 6.00
    bodegas_nvc01 = {"TRN": {"codigo_local": None, "ware_name": "TRANSITO NOVICOMPU"}}
    bodegas_env01 = {"TRN": {"codigo_local": None, "ware_name": "TRANSITO ENV"}}

    totales_nvc01 = agregar_por_sucursal(filas_nvc01, bodegas_nvc01)
    totales_env01 = agregar_por_sucursal(filas_env01, bodegas_env01)

    assert totales_nvc01 == {"TRN": Decimal("10.00")}
    assert totales_env01 == {"TRN": Decimal("6.00")}
    print("OK WARE_CODE compartido (TRN) entre empresas no se mezcla entre llamadas separadas")


if __name__ == "__main__":
    test_agregacion_por_bodega_principal_sin_red()
    test_agregacion_no_se_fragmenta_sin_catalogo()
    test_redondeo_estilo_mba3_no_banker()
    test_resolver_bodega_principal_codigo()
    test_resolver_bodega_principal_nombre()
    test_fallback_bodegas_sin_codigo_local()
    test_ware_code_numerico_no_rompe()
    test_respaldo_costo_producto_cuando_bodega_da_cero()
    test_resumen_subbodegas_por_principal()
    test_no_mezcla_ware_code_compartido_entre_bodegas_distintas()
    print("\nCostos por sucursal: agregacion, jerarquia de Bodega Principal, redondeo, "
          "fallback y respaldo de costo OK.")
