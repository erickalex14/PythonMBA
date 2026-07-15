from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import datetime
import logging
import pandas as pd
from app.core.security import verify_api_key
from app.dependencies import get_movimientos_service, get_liquidaciones_service, get_ats_service, get_excel_service, get_ventas_service, get_estadisticas_service, get_db
from app.services.movimientos_service import MovimientosService
from app.services.liquidaciones_service import LiquidacionesService
from app.services.ats_service import AtsService
from app.services.excel_service import ExcelService
from app.services.ventas_service import VentasService
from app.services.estadisticas_service import EstadisticasVentasService


router = APIRouter(prefix="/api/v1/excel", tags=["Excel Export"])

@router.get("/movimientos", dependencies=[Depends(verify_api_key)])
def download_movimientos(
    inicio: str = Query(...),
    fin: str = Query(...),
    movimientos_service: MovimientosService = Depends(get_movimientos_service),
    excel_service: ExcelService = Depends(get_excel_service),
    db: Session = Depends(get_db)
):
    """
    Descarga el reporte de movimientos en formato Excel corporativo para el rango dado.
    """
    df = movimientos_service.obtener_movimientos(inicio, fin, db)
    if df.empty:
        raise HTTPException(status_code=404, detail="No hay movimientos registrados para exportar en este rango.")

    excel_file = excel_service.generar_reporte_movimientos(df, inicio, fin)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"Reporte_Movimientos_MBA3_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/liquidaciones", dependencies=[Depends(verify_api_key)])
def download_liquidaciones(
    inicio: str = Query(...),
    fin: str = Query(...),
    liquidaciones_service: LiquidacionesService = Depends(get_liquidaciones_service),
    excel_service: ExcelService = Depends(get_excel_service),
    db: Session = Depends(get_db)
):
    """
    Descarga el reporte consolidado de liquidaciones en formato Excel para el rango dado.
    """
    df = liquidaciones_service.obtener_liquidaciones(inicio, fin, db)

    if df.empty:
        raise HTTPException(status_code=404, detail="No hay liquidaciones registradas para exportar en este rango.")

    excel_file = excel_service.generar_reporte_liquidaciones(df, inicio, fin)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"Reporte_Liquidaciones_Consolidado_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/ats", dependencies=[Depends(verify_api_key)])
def download_ats(
    inicio: str = Query(...),
    fin: str = Query(...),
    db: Session = Depends(get_db),
    ats_service: AtsService = Depends(get_ats_service),
    excel_service: ExcelService = Depends(get_excel_service)
):
    """
    Descarga el reporte de facturación fiscal ATS en formato Excel para el rango dado.
    """
    df = ats_service.obtener_ats(inicio, fin, db)
    if df.empty:
        raise HTTPException(status_code=404, detail="No hay facturas fiscales registradas para exportar en este rango.")

    excel_file = excel_service.generar_reporte_ats(df, inicio, fin)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"Reporte_Facturacion_Fiscal_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/ventas", dependencies=[Depends(verify_api_key)])
def download_ventas(
    inicio: str = Query(...),
    fin: str = Query(...),
    ventas_service: VentasService = Depends(get_ventas_service),
    excel_service: ExcelService = Depends(get_excel_service),
    db: Session = Depends(get_db)
):
    """
    Descarga el reporte de Ventas Espejo en formato Excel para el rango dado.
    """
    df = ventas_service.obtener_ventas_espejo(inicio, fin, db)
    if df.empty:
        raise HTTPException(status_code=404, detail="No hay ventas registradas para exportar en este rango.")

    excel_file = excel_service.generar_reporte_ventas(df, inicio, fin)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"VENTAS_{inicio}_a_{fin}_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/estadisticas-ventas", dependencies=[Depends(verify_api_key)])
def download_estadisticas_ventas(
    inicio: str = Query(...),
    fin: str = Query(...),
    estadisticas_service: EstadisticasVentasService = Depends(get_estadisticas_service),
    excel_service: ExcelService = Depends(get_excel_service),
    db: Session = Depends(get_db)
):
    """
    Descarga el reporte de Ventas por Producto (Estadísticas de Inventario) en Excel.
    """
    df = estadisticas_service.obtener_estadisticas(inicio, fin, db)
    if df.empty:
        raise HTTPException(status_code=404, detail="No hay ventas registradas para exportar en este rango.")

    excel_file = excel_service.generar_reporte_estadisticas_ventas(df, inicio, fin)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"Reporte_Ventas_Por_Producto_{timestamp}.xlsx"

    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class CustomExportRequest(BaseModel):
    sheet_name: str
    filename_prefix: str
    data: List[Dict[str, Any]]
    report_type: Optional[str] = None
    inicio: Optional[str] = None
    fin: Optional[str] = None

@router.post("/export", dependencies=[Depends(verify_api_key)])
def export_custom_data(
    payload: CustomExportRequest,
    excel_service: ExcelService = Depends(get_excel_service)
):
    """
    Exporta una lista personalizada de objetos JSON (datos filtrados del cliente) a un archivo Excel estructurado.
    """
    if not payload.data:
        raise HTTPException(status_code=400, detail="El conjunto de datos a exportar está vacío.")

    df = pd.DataFrame(payload.data)

    # Todos los tipos conocidos usan el formato corporativo (encabezado, resumen, totales).
    generadores = {
        "ventas": excel_service.generar_reporte_ventas,
        "movimientos": excel_service.generar_reporte_movimientos,
        "liquidaciones": excel_service.generar_reporte_liquidaciones,
        "ats": excel_service.generar_reporte_ats,
        "estadisticas-ventas": excel_service.generar_reporte_estadisticas_ventas,
    }
    generador = generadores.get((payload.report_type or "").lower())
    if generador:
        excel_file = generador(df, payload.inicio or "", payload.fin or "")
    else:
        excel_file = excel_service.generar_reporte_excel(df, payload.sheet_name)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{payload.filename_prefix}_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
