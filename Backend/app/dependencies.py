from fastapi import Depends
from sqlalchemy.orm import Session
from app.repositories.mba3_repository import Mba3Repository, IMba3Repository
from app.services.movimientos_service import MovimientosService
from app.services.liquidaciones_service import LiquidacionesService
from app.services.ats_service import AtsService
from app.services.excel_service import ExcelService
from app.services.sync_service import SyncService
from app.core.database import get_db

def get_mba3_repository() -> IMba3Repository:
    """
    Provee la implementación por defecto del Repositorio de MBA3.
    """
    return Mba3Repository()

def get_movimientos_service(repo: IMba3Repository = Depends(get_mba3_repository)) -> MovimientosService:
    """
    Provee el Servicio de Movimientos inyectando su dependencia del Repositorio.
    """
    return MovimientosService(repo)

def get_liquidaciones_service(repo: IMba3Repository = Depends(get_mba3_repository)) -> LiquidacionesService:
    """
    Provee el Servicio de Liquidaciones inyectando su dependencia del Repositorio.
    """
    return LiquidacionesService(repo)

def get_ats_service(repo: IMba3Repository = Depends(get_mba3_repository)) -> AtsService:
    """
    Provee el Servicio de ATS inyectando su dependencia del Repositorio.
    """
    return AtsService(repo)

def get_excel_service() -> ExcelService:
    """
    Provee el Servicio de Excel.
    """
    return ExcelService()

def get_sync_service(repo: IMba3Repository = Depends(get_mba3_repository)) -> SyncService:
    """
    Provee el Servicio de Sincronización inyectando su dependencia del Repositorio.
    """
    return SyncService(repo)
