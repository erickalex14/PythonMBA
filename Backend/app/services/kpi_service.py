import calendar
import datetime
import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal

# Definicion de los KPIs del reporte de Seguimiento.
#
# `peso` sale de la fila 2 de la hoja RESUMEN KPI del Excel, que es la que de
# verdad entra en las formulas de cumplimiento. La hoja POND tiene su propia
# columna de ponderacion y NO coincide en 6 de los 10 KPIs (ambas suman 30%, por
# eso la diferencia no salta al cuadrar el total). Pendiente de confirmar cual es
# la oficial; mientras tanto manda la que se usaba para calcular.
#
# `origen`:
#   ventas  -> se agrega desde view_ventas_espejo_reporte cruzando el catalogo
#   manual  -> lo captura una persona (hoy llega por un Google Form)
#   externo -> lo entrega otro proceso y este servicio solo lo recibe
KPIS = {
    "rentabilidad": {
        "label": "RENTABILIDAD DE TIENDA", "peso": 0.04,
        "origen": "externo", "medida": "ratio"},
    "tecnologia": {
        "label": "TECNOLOGIA / PROYECTORES", "peso": 0.04,
        "origen": "ventas", "cat": "TECNOLOGIA", "medida": "unidades"},
    "celulares_tablets": {
        "label": "CELULARES Y TABLETS ENV", "peso": 0.03,
        "origen": "ventas", "cat": "CELULARES Y TABLETS ENV", "medida": "unidades"},
    "motorola": {
        "label": "MOTOROLA RAZR / EDGE 60", "peso": 0.00,
        "origen": "ventas", "cat": "MOTOROLA RAZR/EDGE 60", "medida": "unidades"},
    "sillas_gamer": {
        "label": "SILLAS GAMER ENV", "peso": 0.02,
        "origen": "ventas", "cat": "SILLAS GAMER ENV", "medida": "unidades"},
    "hogar_gym": {
        "label": "HOGAR Y GIMNASIO", "peso": 0.02,
        "origen": "ventas", "cat": "HOGAR Y GYM", "medida": "unidades"},
    "servicio_tecnico": {
        "label": "SERVICIO TECNICO", "peso": 0.02,
        "origen": "ventas", "cat": "ST", "medida": "monto"},
    "planes_claro": {
        "label": "PLANES CLARO", "peso": 0.00,
        "origen": "manual", "medida": "unidades"},
    "review_env": {
        "label": "REVIEW ENV", "peso": 0.03,
        "origen": "manual", "medida": "unidades"},
    # El credito directo sale de los cobros del ERP (Tipo='Otros',
    # SubTipo='CREDITO DIRECTO 1'), pero esa tabla todavia no se sincroniza al
    # staging. Hasta entonces se captura a mano igual que los del formulario.
    "credito_directo": {
        "label": "CREDITO DIRECTO", "peso": 0.10,
        "origen": "manual", "medida": "monto"},
}

CATS_VENTAS = {k: v["cat"] for k, v in KPIS.items() if v["origen"] == "ventas"}


def _rango_periodo(periodo: str) -> tuple:
    anio, mes = (int(p) for p in periodo.split("-"))
    dias = calendar.monthrange(anio, mes)[1]
    return (datetime.date(anio, mes, 1), datetime.date(anio, mes, dias), dias)


def _cumplimiento(real: float, meta: float, peso: float) -> float:
    """Ratio topado al peso.

    Replica el IFS del Excel: por debajo de la meta paga proporcional, en la
    meta o por encima paga el peso completo. Sin meta no puntua (en el Excel
    esa celda daba #DIV/0!).
    """
    if meta is None or meta <= 0:
        return 0.0
    return min(real / meta, 1.0) * peso


class KpiService:
    """Reporte de Seguimiento KPI por sucursal.

    Sustituye el armado manual del Excel: las categorias salen de cruzar la
    vista de ventas contra `kpi_producto_cat`, y las metas de `kpi_meta`.
    """

    def obtener_seguimiento(self, periodo: str, corte: Optional[str] = None,
                            db: Optional[Session] = None) -> dict:
        inicio, fin_mes, dias_mes = _rango_periodo(periodo)

        cerrar = False
        if db is None:
            db = SessionLocal()
            cerrar = True
        try:
            with db.get_bind().connect() as conn:
                if corte:
                    fin = datetime.date.fromisoformat(corte)
                else:
                    # El corte real es el ultimo dia sincronizado, no "hoy": el
                    # sync es manual 4 veces al dia y el mes casi nunca esta
                    # completo cuando se corre el reporte.
                    fin = conn.execute(
                        text("SELECT MAX(fecha) FROM view_ventas_espejo_reporte "
                             "WHERE fecha BETWEEN :i AND :f"),
                        {"i": inicio, "f": fin_mes}).scalar() or inicio
                fin = min(fin, fin_mes)
                params = {"i": inicio, "f": fin}

                # El codigo de la vista conserva el sufijo de empresa
                # ("1CENV153-NVC01") pero el catalogo usa el codigo pelado, asi
                # que se quita antes de cruzar. Sin esto el join no pega nunca.
                filas = conn.execute(text("""
                    SELECT v.sucursal AS sucursal,
                           UPPER(TRIM(c.cat)) AS cat,
                           COALESCE(SUM(v.cantidad), 0) AS unidades,
                           COALESCE(SUM(v.total_linea), 0) AS monto
                    FROM view_ventas_espejo_reporte v
                    JOIN kpi_producto_cat c
                      ON UPPER(TRIM(c.codigo)) =
                         UPPER(regexp_replace(v.codigo, '-(NVC01|ENV01)$', ''))
                    WHERE v.fecha BETWEEN :i AND :f
                    GROUP BY 1, 2
                """), params).mappings().all()

                metas = conn.execute(text(
                    "SELECT sucursal, kpi, meta FROM kpi_meta WHERE periodo = :p"),
                    {"p": periodo}).mappings().all()
                manuales = conn.execute(text(
                    "SELECT sucursal, kpi, valor FROM kpi_valor_manual "
                    "WHERE periodo = :p"), {"p": periodo}).mappings().all()
                sucursales = conn.execute(text(
                    "SELECT codigo, nombre, supervisor, marca, ciudad "
                    "FROM kpi_sucursal WHERE activa = 'SI'")).mappings().all()

            reales = {}
            cat_a_kpi = {v.upper().strip(): k for k, v in CATS_VENTAS.items()}
            for f in filas:
                kpi = cat_a_kpi.get(f["cat"])
                if not kpi:
                    continue     # categoria fuera de los KPIs (ACCESORIO, etc.)
                medida = KPIS[kpi]["medida"]
                valor = float(f["monto"] if medida == "monto" else f["unidades"])
                reales[(f["sucursal"], kpi)] = valor
            for m in manuales:
                reales[(m["sucursal"], m["kpi"])] = float(m["valor"] or 0)

            metas_map = {(m["sucursal"], m["kpi"]): float(m["meta"] or 0)
                         for m in metas}

            dias_corte = (fin - inicio).days + 1
            resultado = []
            for s in sucursales:
                cod = s["codigo"]
                detalle, total = [], 0.0
                for kpi, cfg in KPIS.items():
                    real = reales.get((cod, kpi), 0.0)
                    meta = metas_map.get((cod, kpi))
                    aporte = _cumplimiento(real, meta or 0, cfg["peso"])
                    total += aporte
                    detalle.append({
                        "kpi": kpi,
                        "label": cfg["label"],
                        "origen": cfg["origen"],
                        "medida": cfg["medida"],
                        "peso": cfg["peso"],
                        "meta": meta,
                        "real": real,
                        "cumplimiento": (real / meta) if meta else None,
                        "aporte": round(aporte, 6),
                        "proyeccion": round(real / dias_corte * dias_mes, 2)
                        if dias_corte else None,
                    })
                resultado.append({
                    "sucursal": cod,
                    "nombre": s["nombre"],
                    "supervisor": s["supervisor"],
                    "marca": s["marca"],
                    "ciudad": s["ciudad"],
                    "total_kpi": round(total, 6),
                    "sin_metas": all(d["meta"] is None for d in detalle),
                    "detalle": detalle,
                })

            resultado.sort(key=lambda r: r["total_kpi"], reverse=True)
            return {
                "periodo": periodo,
                "inicio": inicio.isoformat(),
                "corte": fin.isoformat(),
                "dias_corte": dias_corte,
                "dias_mes": dias_mes,
                "peso_total": round(sum(k["peso"] for k in KPIS.values()), 4),
                "sucursales": resultado,
            }
        except Exception as e:
            logging.error(f"Error al construir el seguimiento KPI: {e}")
            raise
        finally:
            if cerrar:
                db.close()
