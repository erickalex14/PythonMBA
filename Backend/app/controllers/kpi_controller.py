import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import verify_api_key
from app.dependencies import get_db, get_excel_service, get_mba3_repository
from app.repositories.mba3_repository import IMba3Repository
from app.services.excel_service import ExcelService
from app.services.kpi_service import KPIS, METAS_EXTRA, KpiService

router = APIRouter(prefix="/api/v1/kpi", tags=["Seguimiento KPI"])

PERIODO = "^\\d{4}-\\d{2}$"
FECHA = "^\\d{4}-\\d{2}-\\d{2}$"


class MetaIn(BaseModel):
    sucursal: str = Field(..., max_length=20)
    kpi: str = Field(..., max_length=40)
    meta: float


class BodegaIn(BaseModel):
    ware_code: str = Field(..., max_length=20)
    # null quita la correccion y deja mandar a la regla derivada.
    sucursal: Optional[str] = Field(None, max_length=20)


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
    validos = set(KPIS) | set(METAS_EXTRA)
    desconocidos = sorted({m.kpi for m in metas} - validos)
    if desconocidos:
        return {"error": f"KPI no reconocido: {', '.join(desconocidos)}",
                "validos": sorted(validos)}
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


@router.post("/sincronizar-bodegas", dependencies=[Depends(verify_api_key)])
def sincronizar_bodegas(
    env: Optional[str] = Query(None, pattern="^(PRUEBAS|PROD)$",
                               description="Entorno del ERP. Por defecto, el del .env."),
    db: Session = Depends(get_db),
    repository: IMba3Repository = Depends(get_mba3_repository),
):
    """Trae el maestro de bodegas del ERP y recalcula a que sucursal pertenecen.

    Las correcciones manuales (`sucursal_override`) no se pisan.
    """
    try:
        return KpiService().sincronizar_bodegas(repository, env, db)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/bodegas", dependencies=[Depends(verify_api_key)])
def read_bodegas(
    sin_mapear: bool = Query(False, description="Solo las que quedaron fuera del reporte"),
    db: Session = Depends(get_db),
):
    """Mapeo bodega -> sucursal, para revisarlo y corregirlo desde el panel."""
    filtro = ("WHERE COALESCE(sucursal_override, sucursal) IS NULL"
              if sin_mapear else "")
    filas = db.execute(text(f"""
        SELECT ware_code, ware_name, codigo_local, corp, inactiva,
               sucursal, sucursal_override,
               COALESCE(sucursal_override, sucursal) AS sucursal_efectiva
        FROM kpi_bodega {filtro}
        ORDER BY COALESCE(sucursal_override, sucursal) NULLS FIRST, ware_code
    """)).mappings().all()
    return {"bodegas": [dict(f) for f in filas]}


@router.put("/bodegas", dependencies=[Depends(verify_api_key)])
def guardar_bodegas(
    asignaciones: List[BodegaIn],
    db: Session = Depends(get_db),
):
    """Corrige a mano a que sucursal pertenece una bodega.

    Mandar `sucursal` en null quita la correccion y vuelve a la regla derivada.
    """
    for a in asignaciones:
        db.execute(text("""
            UPDATE kpi_bodega
            SET sucursal_override = :s, updated_at = NOW()
            WHERE ware_code = :b
        """), {"b": a.ware_code, "s": a.sucursal})
    db.commit()
    return {"actualizadas": len(asignaciones)}


@router.post("/importar", dependencies=[Depends(verify_api_key)])
async def importar_excel(
    periodo: str = Query(..., pattern=PERIODO),
    archivo: UploadFile = File(..., description="El .xlsx de Seguimiento KPI"),
    db: Session = Depends(get_db),
):
    """Siembra sucursales, catalogo y metas subiendo el Excel armado a mano.

    Evita tener que entrar por SSH al servidor cada vez que cambian las metas.
    """
    if not (archivo.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Se espera un archivo .xlsx")
    contenido = await archivo.read()
    try:
        return KpiService().importar_excel(contenido, periodo, db)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/excel", dependencies=[Depends(verify_api_key)])
def download_kpi(
    periodo: str = Query(..., pattern=PERIODO, description="Mes a exportar (YYYY-MM)"),
    corte: Optional[str] = Query(None, pattern=FECHA),
    db: Session = Depends(get_db),
    excel_service: ExcelService = Depends(get_excel_service),
):
    """Libro completo del Seguimiento KPI, con la misma estructura de hojas que
    el archivo que hoy se arma a mano: RESUMEN KPI, PRESUPUESTO, una hoja de
    detalle por categoria y BASE.
    """
    service = KpiService()
    seguimiento = service.obtener_seguimiento(periodo, corte, db)
    if not seguimiento["sucursales"]:
        raise HTTPException(
            status_code=404,
            detail="No hay sucursales cargadas. Corre primero seed_kpi_desde_excel.py.")

    presupuesto = service.obtener_presupuesto(periodo, seguimiento["corte"], db)
    # BASE incluye lo no categorizado (accesorios, marcas de terceros), igual
    # que la hoja del Excel: ahi esas lineas salen con #N/A.
    lineas = service.obtener_lineas(seguimiento["inicio"], seguimiento["corte"],
                                    solo_categorizadas=False, db=db)

    archivo = excel_service.generar_reporte_kpi(seguimiento, presupuesto, lineas)
    sello = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre = f"SEGUIMIENTO_KPI_{periodo}_al_{seguimiento['corte']}_{sello}.xlsx"
    return StreamingResponse(
        archivo,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={nombre}",
                 "X-Record-Count": str(len(lineas))},
    )


@router.get("/sucursales", dependencies=[Depends(verify_api_key)])
def read_sucursales(db: Session = Depends(get_db)):
    filas = db.execute(text(
        "SELECT codigo, nombre, supervisor, marca, ciudad FROM kpi_sucursal "
        "WHERE activa = 'SI' ORDER BY codigo")).mappings().all()
    return {"sucursales": [dict(f) for f in filas]}
