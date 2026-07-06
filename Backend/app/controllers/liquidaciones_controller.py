from fastapi import APIRouter, Depends, Query
from typing import List
from sqlalchemy.orm import Session
from app.core.security import verify_api_key
from app.dependencies import get_liquidaciones_service, get_db
from app.services.liquidaciones_service import LiquidacionesService
from app.dtos.liquidaciones import LiquidacionDTO

router = APIRouter(prefix="/api/v1/liquidaciones", tags=["Liquidaciones"])

@router.get("", response_model=List[LiquidacionDTO], dependencies=[Depends(verify_api_key)])
def read_liquidaciones(
    inicio: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de inicio (YYYY-MM-DD)"),
    fin: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de fin (YYYY-MM-DD)"),
    service: LiquidacionesService = Depends(get_liquidaciones_service),
    db: Session = Depends(get_db)
):
    """
    Obtiene el consolidado de liquidaciones y detalles de productos importados.
    Requiere validación de API Key y retorna el esquema LiquidacionDTO.
    """
    df = service.obtener_liquidaciones(inicio, fin, db)
    return df.to_dict(orient='records')

