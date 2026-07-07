from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.security import verify_api_key
from app.dependencies import get_db, get_sync_service
from app.services.sync_service import SyncService

router = APIRouter(prefix="/api/v1/sync", tags=["Administración / Sincronización Staging"])

@router.post("/movimientos")
def sync_movimientos(
    inicio: str = Query(..., description="Fecha de inicio en formato YYYY-MM-DD"),
    fin: str = Query(..., description="Fecha de fin en formato YYYY-MM-DD"),
    env: str = Query(None, description="Entorno opcional ('PRUEBAS' o 'PROD')"),
    api_key_valid: bool = Depends(verify_api_key),
    db: Session = Depends(get_db),
    sync_service: SyncService = Depends(get_sync_service)
):
    """
    Endpoint administrativo para forzar la sincronización de movimientos (seriales) 
    desde el ERP MBA3 hacia la base de datos PostgreSQL local.
    """
    if not api_key_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de API Key no válidas para acceder a este recurso."
        )

    res = sync_service.sync_movimientos(db, inicio, fin, env=env)
    
    if res.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("message")
        )
        
    return res

@router.post("/liquidaciones")
def sync_liquidaciones(
    inicio: str = Query(..., description="Fecha de inicio en formato YYYY-MM-DD"),
    fin: str = Query(..., description="Fecha de fin en formato YYYY-MM-DD"),
    env: str = Query(None, description="Entorno opcional ('PRUEBAS' o 'PROD')"),
    api_key_valid: bool = Depends(verify_api_key),
    db: Session = Depends(get_db),
    sync_service: SyncService = Depends(get_sync_service)
):
    """
    Endpoint administrativo para forzar la sincronización de liquidaciones (cabecera y productos)
    desde el ERP MBA3 hacia la base de datos PostgreSQL local.
    """
    if not api_key_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de API Key no válidas para acceder a este recurso."
        )

    res = sync_service.sync_liquidaciones(db, inicio, fin, env=env)
    
    if res.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("message")
        )
        
    return res

@router.post("/ats")
def sync_ats(
    inicio: str = Query(..., description="Fecha de inicio en formato YYYY-MM-DD"),
    fin: str = Query(..., description="Fecha de fin en formato YYYY-MM-DD"),
    env: str = Query(None, description="Entorno opcional ('PRUEBAS' o 'PROD')"),
    api_key_valid: bool = Depends(verify_api_key),
    db: Session = Depends(get_db),
    sync_service: SyncService = Depends(get_sync_service)
):
    """
    Endpoint administrativo para forzar la sincronización de facturas, proveedores e información fiscal de ATS
    desde el ERP MBA3 hacia la base de datos PostgreSQL local.
    """
    if not api_key_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de API Key no válidas para acceder a este recurso."
        )

    res = sync_service.sync_ats(db, inicio, fin, env=env)
    
    if res.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("message")
        )
        
    return res

@router.post("/ventas")
def sync_ventas(
    inicio: str = Query(..., description="Fecha de inicio en formato YYYY-MM-DD"),
    fin: str = Query(..., description="Fecha de fin en formato YYYY-MM-DD"),
    env: str = Query(None, description="Entorno opcional ('PRUEBAS' o 'PROD')"),
    api_key_valid: bool = Depends(verify_api_key),
    db: Session = Depends(get_db),
    sync_service: SyncService = Depends(get_sync_service)
):
    """
    Endpoint administrativo para forzar la sincronización de movimientos de inventario
    y facturas de clientes (Ventas) desde el ERP MBA3 hacia la base de datos local.
    """
    if not api_key_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de API Key no válidas para acceder a este recurso."
        )

    res = sync_service.sync_ventas(db, inicio, fin, env=env)
    
    if res.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("message")
        )
        
    return res


