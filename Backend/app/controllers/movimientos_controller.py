from fastapi import APIRouter, Depends, Query
from typing import List
from app.core.security import verify_api_key
from app.dependencies import get_movimientos_service
from app.services.movimientos_service import MovimientosService
from app.dtos.movimientos import MovimientoDTO

router = APIRouter(prefix="/api/v1/movimientos", tags=["Movimientos"])

@router.get("", response_model=List[MovimientoDTO], dependencies=[Depends(verify_api_key)])
def read_movimientos(
    inicio: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de inicio (YYYY-MM-DD)"),
    fin: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de fin (YYYY-MM-DD)"),
    service: MovimientosService = Depends(get_movimientos_service)
):
    """
    Obtiene la lista de movimientos de productos filtrados por rango de fechas.
    Requiere validación de API Key y retorna el esquema MovimientoDTO.
    """
    df = service.obtener_movimientos(inicio, fin)
    return df.to_dict(orient='records')
