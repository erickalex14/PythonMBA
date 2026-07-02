from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
import datetime
import logging
import pandas as pd
from app.core.security import verify_api_key
from app.dependencies import get_movimientos_service, get_liquidaciones_service, get_ats_service, get_excel_service
from app.services.movimientos_service import MovimientosService
from app.services.liquidaciones_service import LiquidacionesService
from app.services.ats_service import AtsService
from app.services.excel_service import ExcelService

router = APIRouter(prefix="/api/v1/excel", tags=["Excel Export"])

@router.get("/movimientos", dependencies=[Depends(verify_api_key)])
def download_movimientos(
    inicio: str = Query(...),
    fin: str = Query(...),
    movimientos_service: MovimientosService = Depends(get_movimientos_service),
    excel_service: ExcelService = Depends(get_excel_service)
):
    """
    Descarga el reporte de movimientos en formato Excel corporativo para el rango dado.
    """
    df = movimientos_service.obtener_movimientos(inicio, fin)
    if df.empty:
        raise HTTPException(status_code=404, detail="No hay movimientos registrados para exportar en este rango.")
    
    excel_file = excel_service.generar_reporte_excel(df, 'Movimientos')
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
    excel_service: ExcelService = Depends(get_excel_service)
):
    """
    Descarga el reporte consolidado de liquidaciones en formato Excel para el rango dado.
    """
    df = liquidaciones_service.obtener_liquidaciones(inicio, fin)
    if df.empty:
        raise HTTPException(status_code=404, detail="No hay liquidaciones registradas para exportar en este rango.")
    
    excel_file = excel_service.generar_reporte_excel(df, 'Consolidado')
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
    ats_service: AtsService = Depends(get_ats_service),
    excel_service: ExcelService = Depends(get_excel_service)
):
    """
    Descarga el reporte de facturación fiscal ATS en formato Excel para el rango dado.
    """
    df = ats_service.obtener_ats(inicio, fin)
    if df.empty:
        raise HTTPException(status_code=404, detail="No hay facturas fiscales registradas para exportar en este rango.")
    
    excel_file = excel_service.generar_reporte_excel(df, 'Consolidado')
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"Reporte_Facturacion_Fiscal_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

from pydantic import BaseModel
from typing import List, Dict, Any

class CustomExportRequest(BaseModel):
    sheet_name: str
    filename_prefix: str
    data: List[Dict[str, Any]]

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
    
    excel_file = excel_service.generar_reporte_excel(df, payload.sheet_name)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{payload.filename_prefix}_{timestamp}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
