"""
Check de la seleccion de las hojas Top contra el reporte de Contabilidad
"01 AL 30 JULIO 2026.xlsx" (solo NOVICOMPU).

Replica la logica de ExcelService.generar_reporte_estadisticas_ventas sobre la
hoja principal de ESE archivo y verifica que salgan los mismos productos.
Correr: py -3 Backend/scripts/test_hojas_top.py [ruta_del_excel]
"""
import sys
import pandas as pd

RUTA = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\USER\Downloads\01 AL 30 JULIO 2026.xlsx"
TOP_CANTIDADES = 11
TOP_DOLARES = 10


def seleccionar_tops(df, col_producto, col_unidades, col_total):
    """Misma seleccion que ExcelService: el top por unidades quita ruido, el de dolares no."""
    ruido = df[col_producto].astype(str).str.upper()
    sin_ruido = df[~ruido.str.contains("GLOBO", na=False) & ~ruido.str.contains("FUNDA", na=False)]
    sin_ruido = sin_ruido[~sin_ruido[col_producto].astype(str).str.upper().str.contains("SERVICIO", na=False)]
    top_cant = sin_ruido.nlargest(TOP_CANTIDADES, col_unidades)
    top_dol = df.nlargest(TOP_DOLARES, col_total)
    return top_cant, top_dol


def main():
    xl = pd.ExcelFile(RUTA)
    h1 = xl.parse("Estadisticas de Inventarios - V")
    h1 = h1[h1["Registro"].astype(str) != "Total :"].copy()
    h1["uv"] = pd.to_numeric(h1["Unidades Vendidas"], errors="coerce").fillna(0)
    h1["tv"] = pd.to_numeric(h1["Total Ventas"], errors="coerce").fillna(0)
    h1["cod"] = h1["Codigo"].astype(str).str.strip()

    top_cant, top_dol = seleccionar_tops(h1, "Descripción", "uv", "tv")

    esperado_cant = xl.parse("MAS VENDIDO EN CANTIDADES")
    esperado_cant = esperado_cant[esperado_cant["Codigo"].notna()]["Codigo"].astype(str).str.strip().tolist()
    esperado_dol = xl.parse("MAS VENDIDO EN DOLARES")
    esperado_dol = esperado_dol[esperado_dol["Codigo"].notna()]["Codigo"].astype(str).str.strip().tolist()

    obtenido_cant = top_cant["cod"].tolist()
    obtenido_dol = top_dol["cod"].tolist()

    print(f"Top cantidades -> esperado {len(esperado_cant)} filas, obtenido {len(obtenido_cant)}")
    print(f"Top dolares    -> esperado {len(esperado_dol)} filas, obtenido {len(obtenido_dol)}")

    assert obtenido_dol == esperado_dol, (
        f"Top dolares no coincide.\n  esperado: {esperado_dol}\n  obtenido: {obtenido_dol}")
    assert sorted(obtenido_cant) == sorted(esperado_cant), (
        f"Top cantidades no coincide.\n  esperado: {sorted(esperado_cant)}\n  obtenido: {sorted(obtenido_cant)}")
    print("OK: ambas hojas Top seleccionan exactamente los mismos productos que Contabilidad.")


if __name__ == "__main__":
    main()
