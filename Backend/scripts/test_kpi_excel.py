"""Verifica que el libro del Seguimiento KPI salga con todas sus hojas.

Arma el Excel con datos sinteticos (no toca la base) y revisa que existan las
hojas esperadas, que el detalle por categoria filtre bien y que BASE conserve
las lineas sin categoria.

Correr con:  py -3 Backend/scripts/test_kpi_excel.py
"""
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.excel_service import ExcelService          # noqa: E402
from app.services.kpi_service import HOJA_POR_KPI, KPIS      # noqa: E402

SEGUIMIENTO = {
    "periodo": "2026-08", "inicio": "2026-08-01", "corte": "2026-08-16",
    "dias_corte": 16, "dias_mes": 31, "peso_total": 0.30,
    "sucursales": [{
        "sucursal": "001", "nombre": "RIO COCA", "supervisor": "GUSTAVO ONA",
        "marca": "NOVICOMPU", "ciudad": "QUITO",
        "total_kpi": 0.0935784, "sin_metas": False,
        "detalle": [{"kpi": k, "label": c["label"], "origen": c["origen"],
                     "medida": c["medida"], "peso": c["peso"], "meta": 10,
                     "real": 5, "cumplimiento": 0.5,
                     "aporte": c["peso"] * 0.5, "proyeccion": 9.7}
                    for k, c in KPIS.items()],
    }],
}

PRESUPUESTO = [{
    "sucursal": "001", "nombre": "RIO COCA", "supervisor": "GUSTAVO ONA",
    "marca": "NOVICOMPU", "ciudad": "QUITO", "meta": 50000.0,
    "venta": 16331.6, "facturas": 159, "unidades": 254.0,
    "ticket_promedio": 102.71, "unidades_por_factura": 1.6,
    "venta_promedio_dia": 1020.72, "proyeccion": 31642.47, "cumplimiento": 0.3266,
}]


def _linea(codigo, cat, total):
    return {"factura_final": "5001", "fecha": "2026-08-01", "codigo": codigo,
            "producto": f"PROD {codigo}", "unidad": "UN", "grupo": "ET",
            "subgrupo": "LAPTO", "cantidad": 1, "precio_venta": total,
            "total_linea": total, "bodega_codigo": "5", "sucursal": "001",
            "sucursal_nombre": "RIO COCA", "supervisor": "GUSTAVO ONA", "cat": cat}


LINEAS = [
    _linea("1EENV9220", "TECNOLOGIA", 533.57),
    _linea("1EENV9212", "TECNOLOGIA", 574.55),
    _linea("1CENV89", "CELULARES Y TABLETS ENV", 146.91),
    _linea("1HENV4565", "HOGAR Y GYM", 20.0),
    _linea("B2P-SERTEC1", "ST", 13.04),
    _linea("1CSAM5797", None, 152.0),      # marca de tercero: no puntua
]


def main():
    wb_bytes = ExcelService().generar_reporte_kpi(SEGUIMIENTO, PRESUPUESTO, LINEAS)
    wb = openpyxl.load_workbook(wb_bytes)

    esperadas = ["RESUMEN KPI", "PRESUPUESTO", *HOJA_POR_KPI.values(), "BASE"]
    faltan = [h for h in esperadas if h not in wb.sheetnames]
    assert not faltan, f"faltan hojas: {faltan}"
    print(f"OK {len(wb.sheetnames)} hojas: {', '.join(wb.sheetnames)}")

    def filas_datos(hoja):
        """Cuenta filas de datos: la hoja trae encabezado corporativo arriba."""
        ws = wb[hoja]
        return [r for r in ws.iter_rows(values_only=True)
                if r and str(r[0] or "").strip() == "5001"]

    assert len(filas_datos("TCNLG")) == 2, "TCNLG deberia traer las 2 de TECNOLOGIA"
    assert len(filas_datos("ST")) == 1, "ST deberia traer 1 linea"
    assert len(filas_datos("RAZR-EDGE60")) == 0, "no hay ventas de Motorola"
    print("OK el detalle por categoria filtra correctamente")

    assert len(filas_datos("BASE")) == len(LINEAS), \
        "BASE debe incluir tambien las lineas sin categoria"
    print(f"OK BASE conserva las {len(LINEAS)} lineas, incluida la no categorizada")

    # La fila de encabezado no esta fija: arriba va el bloque corporativo y un
    # resumen de largo variable, asi que se busca por contenido.
    cabeceras = [str(c or "") for fila in wb["RESUMEN KPI"].iter_rows(values_only=True)
                 for c in (fila or ())]
    for sufijo in ("REAL", "META", "APORTE"):
        assert any(t.endswith(sufijo) for t in cabeceras), f"falta columna {sufijo}"
    assert "% CUMPLIMIENTO KPI" in cabeceras, "falta el total por sucursal"
    print("OK RESUMEN KPI trae real/meta/aporte por KPI y el total")

    print("\nEl libro sale completo.")


if __name__ == "__main__":
    main()
