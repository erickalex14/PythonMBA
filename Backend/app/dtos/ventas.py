from pydantic import BaseModel, Field
from typing import Optional

class VentasDTO(BaseModel):
    factura_final: Optional[str] = Field(None, alias="factura_final", description="Número comercial de factura o código corporativo")
    fecha: Optional[str] = Field(None, description="Fecha de la transacción")
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

    class Config:
        from_attributes = True
        populate_by_name = True
