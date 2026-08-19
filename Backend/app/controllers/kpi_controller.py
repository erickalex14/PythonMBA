from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import verify_api_key
from app.dependencies import get_db
from app.services.kpi_service import KPIS, KpiService

router = APIRouter(prefix="/api/v1/kpi", tags=["Seguimiento KPI"])

PERIODO = "^\\d{4}-\\d{2}$"
FECHA = "^\\d{4}-\\d{2}-\\d{2}$"


class MetaIn(BaseModel):
    sucursal: str = Field(..., max_length=20)
    kpi: str = Field(..., max_length=40)
    meta: float


class ValorManualIn(BaseModel):
    sucursal: str = Field(..., max_length=20)
    kpi: str = Field(..., max_length=40)
    valor: float


@router.get("/definicion", dependencies=[Depends(verify_api_key)])
def read_definicion():
    """Catalogo de KPIs: etiqueta, peso, origen y unidad de medida.

    Lo usa la pantalla de carga para saber que campos pedir y cuales no se
    editan porque salen del ERP.
    """
    return {
        "kpis": [{"kpi": k, **v} for k, v in KPIS.items()],
        "peso_total": round(sum(v["peso"] for v in KPIS.values()), 4),
    }


@router.get("/seguimiento", dependencies=[Depends(verify_api_key)])
def read_seguimiento(
    periodo: str = Query(..., pattern=PERIODO, description="Mes a evaluar (YYYY-MM)"),
    corte: Optional[str] = Query(None, pattern=FECHA,
                                 description="Dia de corte. Por defecto, el ultimo dia sincronizado del mes."),
    db: Session = Depends(get_db),
):
    """Seguimiento KPI por sucursal para un mes.

    No se cachea: las metas se editan desde el panel y el usuario espera ver el
    cambio al instante.
    """
    return KpiService().obtener_seguimiento(periodo, corte, db)


@router.get("/metas", dependencies=[Depends(verify_api_key)])
def read_metas(
    periodo: str = Query(..., pattern=PERIODO),
    db: Session = Depends(get_db),
):
    filas = db.execute(text(
        "SELECT sucursal, kpi, meta FROM kpi_meta WHERE periodo = :p "
        "ORDER BY sucursal, kpi"), {"p": periodo}).mappings().all()
    return {"periodo": periodo,
            "metas": [{"sucursal": f["sucursal"], "kpi": f["kpi"],
                       "meta": float(f["meta"])} for f in filas]}


@router.put("/metas", dependencies=[Depends(verify_api_key)])
def guardar_metas(
    metas: List[MetaIn],
    periodo: str = Query(..., pattern=PERIODO),
    db: Session = Depends(get_db),
):
    """Guarda metas de un mes. Reemplaza las que ya existan para esa combinacion.

    Se guarda solo lo que llega: mandar una lista parcial no borra el resto del
    mes, para que la pantalla pueda ir salvando por sucursal.
    """
    desconocidos = sorted({m.kpi for m in metas} - set(KPIS))
    if desconocidos:
        return {"error": f"KPI no reconocido: {', '.join(desconocidos)}",
                "validos": sorted(KPIS)}
    for m in metas:
        db.execute(text("""
            INSERT INTO kpi_meta (periodo, sucursal, kpi, meta)
            VALUES (:p, :s, :k, :v)
            ON CONFLICT (periodo, sucursal, kpi)
            DO UPDATE SET meta = EXCLUDED.meta, updated_at = NOW()
        """), {"p": periodo, "s": m.sucursal, "k": m.kpi, "v": m.meta})
    db.commit()
    return {"periodo": periodo, "guardadas": len(metas)}


@router.put("/valores-manuales", dependencies=[Depends(verify_api_key)])
def guardar_valores_manuales(
    valores: List[ValorManualIn],
    periodo: str = Query(..., pattern=PERIODO),
    db: Session = Depends(get_db),
):
    """Valores reales que no salen del ERP (REVIEW ENV, PLANES CLARO, credito)."""
    manuales = {k for k, v in KPIS.items() if v["origen"] == "manual"}
    invalidos = sorted({v.kpi for v in valores} - manuales)
    if invalidos:
        return {"error": f"Estos KPI no se cargan a mano: {', '.join(invalidos)}",
                "validos": sorted(manuales)}
    for v in valores:
        db.execute(text("""
            INSERT INTO kpi_valor_manual (periodo, sucursal, kpi, valor)
            VALUES (:p, :s, :k, :v)
            ON CONFLICT (periodo, sucursal, kpi)
            DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()
        """), {"p": periodo, "s": v.sucursal, "k": v.kpi, "v": v.valor})
    db.commit()
    return {"periodo": periodo, "guardados": len(valores)}


@router.get("/sucursales", dependencies=[Depends(verify_api_key)])
def read_sucursales(db: Session = Depends(get_db)):
    filas = db.execute(text(
        "SELECT codigo, nombre, supervisor, marca, ciudad FROM kpi_sucursal "
        "WHERE activa = 'SI' ORDER BY codigo")).mappings().all()
    return {"sucursales": [dict(f) for f in filas]}
