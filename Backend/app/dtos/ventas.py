from pydantic import BaseModel, Field
from typing import Optional

class VentasDTO(BaseModel):
    factura_final: Optional[str] = Field(None, alias="factura_final", description="Número comercial de factura o código corporativo")
    fecha: Optional[str] = Field(None, description="Fecha de la transacción")
    empresa: Optional[str] = Field(None, description="Empresa (NOVICOMPU / ENV)")
    sucursal: Optional[str] = Field(None, description="Código de sucursal / local")
    codigo: Optional[str] = Field(None, description="Código de producto")
    producto: Optional[str] = Field(None, description="Nombre de producto")
    grupo: Optional[str] = Field(None, description="Grupo")
    subgrupo: Optional[str] = Field(None, description="Subgrupo")
    unidad: Optional[str] = Field(None, description="Unidad de medida")
    cantidad: int = Field(0, description="Cantidad vendida")
    precio_venta: float = Field(0.0, description="Precio unitario de venta")
    subtotal: float = Field(0.0, description="Subtotal antes de descuentos")
    descuento_aplicado: float = Field(0.0, description="Descuento aplicado")
    total_linea: float = Field(0.0, description="Total neto de la línea")
    bodega: Optional[str] = Field(None, description="Código de bodega")
    bodega_nombre: Optional[str] = Field(None, description="Nombre de bodega")
    codigo_cliente: Optional[str] = Field(None, description="Código de cliente")
    nombre_cliente: Optional[str] = Field(None, description="Nombre de cliente")
    costo_unitario: float = Field(0.0, description="Costo real de la unidad")
    costo_total: float = Field(0.0, description="Costo total de la línea")
    utilidad_unidad: float = Field(0.0, description="Utilidad por unidad")
    utilidad_total: float = Field(0.0, description="Utilidad total de la línea")
    pct_utilidad_neto: Optional[float] = Field(None, description="% utilidad sobre el neto de línea")
    pct_utilidad_costo: Optional[float] = Field(None, description="% utilidad sobre el costo")

    class Config:
        from_attributes = True
        populate_by_name = True


class RangoFechasDTO(BaseModel):
    inicio: str
    fin: str


class RangoResumenDTO(BaseModel):
    monto: float = 0.0
    cantidad: int = 0
    rango: RangoFechasDTO


class ProductoTopDTO(BaseModel):
    producto: Optional[str] = None
    cantidad: int = 0
    monto: float = 0.0


class ResumenVentasDTO(BaseModel):
    hoy: RangoResumenDTO
    ayer: RangoResumenDTO
    semana: RangoResumenDTO
    mes: RangoResumenDTO
    anio: RangoResumenDTO
    top_producto_cantidad: Optional[ProductoTopDTO] = None
    top_producto_monto: Optional[ProductoTopDTO] = None
