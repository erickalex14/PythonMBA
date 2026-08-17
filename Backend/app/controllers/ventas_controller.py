import os
from fastapi import APIRouter, Depends, Query
from typing import List
from sqlalchemy.orm import Session
from app.core import cache
from app.core.security import verify_api_key

# El dashboard se abre muchas veces al día y los datos cambian solo cuando corre
# el sync, asi que 5 min de cache no muestran nada viejo en la practica.
DASHBOARD_TTL_SEGUNDOS = int(os.getenv("DASHBOARD_TTL_SEGUNDOS", "300"))
from app.dependencies import get_ventas_service, get_db
from app.services.ventas_service import VentasService
from app.dtos.ventas import VentasDTO, ResumenVentasDTO

router = APIRouter(prefix="/api/v1/ventas", tags=["Ventas / Reporte Espejo"])

@router.get("/dashboard", dependencies=[Depends(verify_api_key)])
def read_dashboard_ventas(
    fecha_ancla: str = Query(None, pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Día a tomar como 'hoy'. Si se omite, el último día con ventas."),
    db: Session = Depends(get_db),
    service: VentasService = Depends(get_ventas_service)
):
    """
    Dashboard de ventas en una sola llamada: totales por rango (hoy, ayer,
    semana, últimos 15 días, mes y año), comparación real contra el período
    anterior equivalente, y top de productos por cantidad y por dinero.
    """
    clave = f"ventas:dashboard:{fecha_ancla or 'auto'}"
    return cache.memoizar(
        clave, DASHBOARD_TTL_SEGUNDOS,
        lambda: service.obtener_dashboard_ventas(db, fecha_ancla),
    )


@router.get("/totales", dependencies=[Depends(verify_api_key)])
def read_totales_ventas(
    inicio: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de inicio (YYYY-MM-DD)"),
    fin: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    service: VentasService = Depends(get_ventas_service)
):
    """
    Totales del rango con devoluciones desglosadas (con devoluciones, solo
    devoluciones y neto) para los KPIs del reporte de Ventas.
    """
    return cache.memoizar(
        f"ventas:totales:{inicio}:{fin}", DASHBOARD_TTL_SEGUNDOS,
        lambda: service.obtener_totales_rango(inicio, fin, db),
    )


@router.get("/resumen", response_model=ResumenVentasDTO, dependencies=[Depends(verify_api_key)])
def read_resumen_ventas(
    fecha_ancla: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha 'hoy real' (la que ya calcula el front por atraso de sync)"),
    db: Session = Depends(get_db),
    service: VentasService = Depends(get_ventas_service)
):
    """
    Resumen agregado (hoy/ayer/semana/mes/año calendario + producto más
    vendido del mes) para las cards del dashboard ejecutivo. Suma en SQL,
    no expone líneas individuales.
    """
    return service.obtener_resumen_dashboard(fecha_ancla, db)

@router.get("", response_model=List[VentasDTO], dependencies=[Depends(verify_api_key)])
def read_ventas(
    inicio: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de inicio (YYYY-MM-DD)"),
    fin: str = Query(..., pattern="^\\d{4}-\\d{2}-\\d{2}$", description="Fecha de fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    service: VentasService = Depends(get_ventas_service)
):
    """
    Obtiene la lista de transacciones del reporte de Ventas Espejo.
    Requiere validación de API Key y retorna el esquema VentasDTO.
    """
    df = service.obtener_ventas_espejo(inicio, fin, db)
    if df.empty:
        return []
        
    df_renamed = df.rename(columns={
        "# de factura": "factura_final",
        "FECHA": "fecha",
        "EMPRESA": "empresa",
        "SUCURSAL": "sucursal",
        "CODIGO": "codigo",
        "PRODUCTO": "producto",
        "GRUPO": "grupo",
        "SUBGRUPO": "subgrupo",
        "UNIDAD": "unidad",
        "CANTIDAD": "cantidad",
        "PRECIO VENTA": "precio_venta",
        "SUBTOTAL (C*PV)": "subtotal",
        "DESCUENTO APLICADO": "descuento_aplicado",
        "TOTAL LINEA": "total_linea",
        "BODEGA": "bodega",
        "BODEGA NOMBRE": "bodega_nombre",
        "CODIGO CLIENTE": "codigo_cliente",
        "NOMBRE CLIENTE": "nombre_cliente",
        "COSTO UNITARIO": "costo_unitario",
        "COSTO TOTAL": "costo_total",
        "UTILIDAD UNIDAD": "utilidad_unidad",
        "UTILIDAD TOTAL": "utilidad_total",
        "% UTILIDAD/NETO": "pct_utilidad_neto",
        "% UTILIDAD/COSTO": "pct_utilidad_costo"
    })
    
    return df_renamed.to_dict(orient='records')
