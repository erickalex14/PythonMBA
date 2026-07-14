from fastapi import APIRouter, Depends, Query
from typing import List
from sqlalchemy.orm import Session
from app.core.security import verify_api_key
from app.dependencies import get_estadisticas_service, get_db
from app.services.estadisticas_service import EstadisticasVentasService
from app.dtos.estadisticas import EstadisticasVentasDTO

router = APIRouter(prefix="/api/v1/estadisticas-ventas", tags=["Ventas / Estadísticas de Inventario"])

@router.get("", response_model=List[EstadisticasVentasDTO], dependencies=[Depends(verify_api_key)])
def read_estadisticas(
    inicio: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de inicio (YYYY-MM-DD)"),
    fin: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    service: EstadisticasVentasService = Depends(get_estadisticas_service)
):
    """
    Reporte de Ventas: una fila por producto con unidades/total vendido en el
    rango, precios y existencia actual (replica "Estadisticas de Inventarios" del ERP).
    """
    df = service.obtener_estadisticas(inicio, fin, db)
    if df.empty:
        return []
    return df.to_dict(orient='records')
