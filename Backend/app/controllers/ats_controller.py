from fastapi import APIRouter, Depends, Query
from typing import List
from sqlalchemy.orm import Session
from app.core.security import verify_api_key
from app.dependencies import get_ats_service, get_db
from app.services.ats_service import AtsService
from app.dtos.ats import AtsDTO

router = APIRouter(prefix="/api/v1/ats", tags=["ATS / Facturación"])

@router.get("", response_model=List[AtsDTO], dependencies=[Depends(verify_api_key)])
def read_ats(
    inicio: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de inicio (YYYY-MM-DD)"),
    fin: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    service: AtsService = Depends(get_ats_service)
):
    """
    Obtiene la lista de transacciones del reporte de facturación fiscal ATS.
    Requiere validación de API Key y retorna el esquema AtsDTO.
    """
    df = service.obtener_ats(inicio, fin, db)
    return df.to_dict(orient='records')
