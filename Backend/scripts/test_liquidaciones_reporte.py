"""
Check: split de codigo/empresa en el reporte de liquidaciones, y que los
encabezados nuevos del Excel salgan con el nombre pedido en la revision
(2026-09-11), no el nombre crudo del campo del ERP.

Correr: py -3 Backend/scripts/test_liquidaciones_reporte.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from app.services.liquidaciones_service import codigo_sin_sufijo_empresa, LiquidacionesService
from app.services.excel_service import ExcelService
from app.dtos.liquidaciones import LiquidacionDTO


def test_dto_no_filtra_los_campos_nuevos():
    # Bug real 2026-09-12: el service calculaba PRODUCTO_CODIGO/PRODUCTO_NOMBRE/
    # PROVEEDOR_NOMBRE bien, pero read_liquidaciones() usa
    # response_model=List[LiquidacionDTO] -- FastAPI descarta del JSON
    # cualquier campo no declarado en el DTO. Sin esto, nunca llegaban al
    # front (ni al Excel descargado desde la web, que reusa esos datos).
    fila = {
        "PRODUCTO_CODIGO": "1PENV9453", "PRODUCTO_NOMBRE": "PRODUCTO DE PRUEBA",
        "PROVEEDOR_NOMBRE": "HK YSW TECHNOLOGY LIMITED",
    }
    dto = LiquidacionDTO(**fila)
    salida = dto.model_dump()
    for campo, esperado in fila.items():
        assert salida[campo] == esperado, f"{campo} no sobrevive al DTO"


def test_sufijo_de_empresa_se_recorta_si_coincide():
    assert codigo_sin_sufijo_empresa("1PENV9453-NVC01", "NVC01") == "1PENV9453"
    assert codigo_sin_sufijo_empresa("1CENV9415-NVC01", "NVC01") == "1CENV9415"


def test_codigo_sin_sufijo_no_se_toca():
    # Si no coincide con el Corp de la fila (dato raro, o ya viene sin
    # sufijo), no se corta nada -- mejor dejarlo completo que cortar mal.
    assert codigo_sin_sufijo_empresa("01EA000", "NVC01") == "01EA000"
    assert codigo_sin_sufijo_empresa("01EA000-ENV01", "NVC01") == "01EA000-ENV01"


def test_encabezados_del_excel_usan_el_nombre_pedido_en_la_revision():
    df = pd.DataFrame([{
        "CORP": "NVC01", "LIQUIDACION_FECHA": "2026-08-13", "LIQUIDACION_ID_CORP": "LIQ-1",
        "LIQUIDACION_ESTADO": True, "FACTURA_ID_CORP": "I-1",
        "PRODUCTO_CODIGO": "1PENV9453", "PRODUCTO_NOMBRE": "PRODUCTO DE PRUEBA",
        "CANTIDAD": 1, "PRECIO": 1.7, "TOTAL": 2550,
        "VALOR_TOTAL_CIF": 2808.35, "VALOR_SUBTOTAL_CIF": 2631.16, "VALOR_TOTAL_CIF_MANUAL": 258.35,
        "VALOR_TOTAL_CIF_UNIDAD": 1.87,
        "ANTES_TOTAL_1": 1606.35, "ANTES_TOTAL_2": 735.9, "ANTES_TOTAL_3": 0,
        "DESPUES_TOTAL_1": 3679.5, "DESPUES_TOTAL_2": 1433.93, "DESPUES_TOTAL_3": 0,
        "VALOR_ANTES_1": 55.66, "VALOR_ANTES_2": 25.5, "VALOR_ANTES_3": 0,
        "VALOR_DESPUES_1": 0, "VALOR_DESPUES_2": 0, "VALOR_DESPUES_3": 0,
        "OBSERVACIONES": "", "PARTIDA_ID_CORP": "8471700000-NVC01", "IdRecepcionRelacionada": "A-1",
        "PROVEEDOR_NOMBRE": "HK YSW TECHNOLOGY LIMITED",
    }])

    buffer = ExcelService().generar_reporte_liquidaciones(df, "2026-08-01", "2026-08-31")

    import openpyxl
    wb = openpyxl.load_workbook(buffer)

    # Consolidado: solo lo confirmado/entendido.
    ws = wb["Consolidado"]
    encabezados = [c.value for c in ws[9]]  # fila 9: resumen ocupa 5-7, cabecera cae en la 9

    esperados = [
        "Proveedor", "Código Producto", "Nombre Producto", "PRECIO UNITARIO FOB", "TOTAL FOB / OC",
        "COSTO DE LA OPERACIÓN / GASTOS ASOCIADOS", "DIFERENCIA FOB- CIF", "Valor CIF Unidad",
        "FLETE (Liquidación)", "SERVICIO (Liquidación)", "OTROS GASTOS (Liquidación)",
        "IMPUESTO SALIDA DE DIVISAS (Liquidación)", "SERVICIO Después (Liquidación)",
        "OTROS GASTOS Después (Liquidación)", "FLETE", "SEGURO",
    ]
    for esperado in esperados:
        assert esperado in encabezados, f"falta el encabezado {esperado!r} en {encabezados}"

    # Lo que sigue sin confirmar NO se mezcla en el Consolidado.
    for no_debe_estar in ("Valor Antes 3", "Valor Después 1", "Valor Después 2", "Valor Después 3"):
        assert no_debe_estar not in encabezados, f"{no_debe_estar!r} no deberia estar en Consolidado"

    # Hoja aparte para lo que nadie identifico todavia.
    assert "Valores Sin Confirmar" in wb.sheetnames
    ws2 = wb["Valores Sin Confirmar"]
    encabezados2 = [c.value for c in ws2[6]]  # sin resumen: cabecera cae en la 6
    for esperado in ("Valor Antes 3", "Valor Después 1", "Valor Después 2", "Valor Después 3"):
        assert esperado in encabezados2, f"falta {esperado!r} en Valores Sin Confirmar: {encabezados2}"


class _RepoFalso:
    """Simula el ERP: factura -> vendor_id -> nombre, con 2 consultas batch."""
    def __init__(self, factura_a_vendor, vendor_a_nombre, token="tok", caido=False):
        self.factura_a_vendor = factura_a_vendor
        self.vendor_a_nombre = vendor_a_nombre
        self.token = token
        self.caido = caido
        self.envs_usados = []

    def obtener_token(self, *a, **k):
        self.envs_usados.append(k.get("env"))
        return None if self.caido else self.token

    def ejecutar_consulta(self, token, select, table, where, **k):
        self.envs_usados.append(k.get("env"))
        if table == "PROV_Factura_Principal":
            return [{"DOC_ID_CORP": f, "VENDOR_ID": v} for f, v in self.factura_a_vendor.items() if f in where]
        if table == "PROV_Ficha_Principal":
            return [{"VENDOR_ID": v, "VENDOR_NAME": n} for v, n in self.vendor_a_nombre.items() if v in where]
        return []


def test_nombre_de_proveedor_se_resuelve_con_el_join_real():
    # Camino confirmado contra PRUEBAS (2026-09-12): FACTURA_ID_CORP ->
    # PROV_Factura_Principal.VENDOR_ID -> PROV_Ficha_Principal.VENDOR_NAME.
    repo = _RepoFalso(
        factura_a_vendor={"I-218801-NVC01": "13146"},
        vendor_a_nombre={"13146": "HK YSW TECHNOLOGY LIMITED"},
    )
    facturas = pd.Series(["I-218801-NVC01", "I-218801-NVC01", ""])
    resultado = LiquidacionesService(repo)._resolver_nombres_proveedor(facturas)

    assert resultado.tolist() == ["HK YSW TECHNOLOGY LIMITED", "HK YSW TECHNOLOGY LIMITED", ""]
    # PRUEBAS a proposito, no el env por defecto del servicio (PROD esta caido
    # de red) -- PRUEBAS refleja los mismos datos reales, confirmado 2026-09-12.
    assert repo.envs_usados == ["PRUEBAS"] * 3, repo.envs_usados


def test_nombre_de_proveedor_no_revienta_si_el_erp_no_responde():
    # Si el ERP esta caido o al servicio le falta el permiso de esas 2 tablas
    # (008), la columna queda en blanco -- el reporte no se cae por esto.
    repo = _RepoFalso(factura_a_vendor={}, vendor_a_nombre={}, caido=True)
    facturas = pd.Series(["I-218801-NVC01"])
    resultado = LiquidacionesService(repo)._resolver_nombres_proveedor(facturas)

    assert resultado.tolist() == [""]


if __name__ == "__main__":
    test_sufijo_de_empresa_se_recorta_si_coincide()
    test_codigo_sin_sufijo_no_se_toca()
    test_encabezados_del_excel_usan_el_nombre_pedido_en_la_revision()
    test_nombre_de_proveedor_se_resuelve_con_el_join_real()
    test_nombre_de_proveedor_no_revienta_si_el_erp_no_responde()
    test_dto_no_filtra_los_campos_nuevos()
    print("OK: codigo/empresa separado, encabezados nuevos presentes, proveedor resuelto, DTO no filtra los campos nuevos.")
