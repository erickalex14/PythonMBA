"""Descifra de donde salen las metas por KPI del reporte de Seguimiento.

Las metas del archivo manual son fracciones exactas de tercios (12,3333 = 37/3;
4,3333 = 13/3), lo que sugiere un promedio de tres meses. Este script prueba
varias hipotesis contra el archivo real y dice cual acierta mas.

Necesita dos entradas:
  - el .xlsx del reporte manual (de ahi salen las metas a explicar)
  - un CSV con el historico mensual por sucursal y categoria, con columnas
    mes,suc,cat,unidades,monto (se saca con la consulta del pie)

Correr con:
    py -3 Backend/scripts/investigar_metas_kpi.py <reporte.xlsx> <hist.csv>
"""
import collections
import csv
import re
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.kpi_service import COL_META_EXCEL, KPIS  # noqa: E402

# Categoria del catalogo por cada KPI que sale de ventas.
CAT_POR_KPI = {k: (v.get("cat") or "").upper().strip()
               for k, v in KPIS.items() if v.get("cat")}
MESES_PREVIOS = ["2026-05", "2026-06", "2026-07"]   # el reporte es de agosto
TOL = 0.005


def leer_metas(ruta):
    """Metas declaradas en la hoja RESUMEN KPI: {(sucursal, kpi): meta}."""
    ws = openpyxl.load_workbook(ruta, data_only=True)["RESUMEN KPI"]
    metas = {}
    for fila in ws.iter_rows(values_only=True):
        m = re.match(r"^\s*(\d{3})", str(fila[1] or ""))
        if not m:
            continue
        for col, kpi in COL_META_EXCEL.items():
            if col < len(fila) and isinstance(fila[col], (int, float)):
                metas[(m.group(1), kpi)] = float(fila[col])
    return metas


def leer_historico(ruta):
    """{(sucursal, cat, mes): (unidades, monto)}"""
    hist = {}
    for r in csv.DictReader(open(ruta, encoding="utf-8")):
        hist[(r["suc"], r["cat"], r["mes"])] = (float(r["unidades"] or 0),
                                                float(r["monto"] or 0))
    return hist


def hipotesis(hist, suc, cat, medida):
    """Candidatos a formula de la meta, a partir del historico."""
    i = 1 if medida == "monto" else 0
    v = [hist.get((suc, cat, mes), (0, 0))[i] for mes in MESES_PREVIOS]
    prev3, prev2, prev1 = v[0], v[1], v[2]
    return {
        "promedio 3 meses": sum(v) / 3,
        "promedio 2 ultimos": (prev2 + prev1) / 2,
        "mes anterior": prev1,
        "promedio 3 meses +10%": sum(v) / 3 * 1.1,
        "maximo de los 3": max(v),
    }


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(2)
    metas = leer_metas(sys.argv[1])
    hist = leer_historico(sys.argv[2])

    aciertos = collections.Counter()
    evaluadas = 0
    ejemplos = []
    for (suc, kpi), meta in sorted(metas.items()):
        cat = CAT_POR_KPI.get(kpi)
        if not cat or meta == 0:
            continue
        evaluadas += 1
        cand = hipotesis(hist, suc, cat, KPIS[kpi]["medida"])
        for nombre, valor in cand.items():
            if abs(valor - meta) < TOL:
                aciertos[nombre] += 1
        if len(ejemplos) < 6:
            ejemplos.append((suc, kpi, meta, cand))

    print(f"metas evaluadas: {evaluadas}\n")
    print("aciertos por hipotesis:")
    for nombre, n in aciertos.most_common():
        print(f"  {nombre:24} {n:5}  ({n / evaluadas * 100:.1f}%)")
    if not aciertos:
        print("  ninguna hipotesis acierta")

    # El desglose por KPI importa mas que el total: si una categoria acierta
    # casi siempre y otra casi nunca, es que no todas se calculan igual.
    print("\npromedio de 3 meses, desglosado por KPI:")
    por_kpi = collections.Counter()
    total_kpi = collections.Counter()
    for (suc, kpi), meta in metas.items():
        cat = CAT_POR_KPI.get(kpi)
        if not cat or meta == 0:
            continue
        total_kpi[kpi] += 1
        prom = hipotesis(hist, suc, cat, KPIS[kpi]["medida"])["promedio 3 meses"]
        if abs(prom - meta) < TOL:
            por_kpi[kpi] += 1
    for kpi in sorted(total_kpi, key=lambda k: -por_kpi[k] / total_kpi[k]):
        n, t = por_kpi[kpi], total_kpi[kpi]
        print(f"  {kpi:20} {n:4}/{t:4}  ({n / t * 100:5.1f}%)   "
              f"medida={KPIS[kpi]['medida']}")

    print("\nejemplos (meta declarada vs cada candidato):")
    for suc, kpi, meta, cand in ejemplos:
        print(f"  {suc} {kpi:18} meta={meta:9.4f}")
        for nombre, valor in cand.items():
            marca = "  <-- coincide" if abs(valor - meta) < TOL else ""
            print(f"      {nombre:24} {valor:9.4f}{marca}")


# Consulta para generar el CSV del historico:
#   SELECT to_char(v.fecha,'YYYY-MM') AS mes,
#          COALESCE(b.sucursal_override,b.sucursal) AS suc,
#          UPPER(TRIM(c.cat)) AS cat,
#          SUM(v.cantidad) AS unidades, ROUND(SUM(v.total_linea),2) AS monto
#   FROM view_ventas_espejo_reporte v
#   JOIN kpi_bodega b ON b.ware_code = v.bodega_codigo
#   JOIN kpi_producto_cat c
#     ON UPPER(TRIM(c.codigo)) = UPPER(regexp_replace(v.codigo,'-(NVC01|ENV01)$',''))
#   WHERE v.fecha BETWEEN '2026-02-01' AND '2026-08-16'
#     AND COALESCE(b.sucursal_override,b.sucursal) IS NOT NULL
#   GROUP BY 1,2,3;

if __name__ == "__main__":
    main()
