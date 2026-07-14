from pydantic import BaseModel, Field
from typing import Optional

class EstadisticasVentasDTO(BaseModel):
    codigo: Optional[str] = Field(None, description="Código de producto")
    producto: Optional[str] = Field(None, description="Nombre/descripción del producto")
    unidad: Optional[str] = Field(None, description="Unidad de medida")
    grupo: Optional[str] = Field(None, description="Grupo")
    subgrupo: Optional[str] = Field(None, description="Subgrupo")
    existencia: float = Field(0.0, description="Existencia actual (OH)")
    asignado: float = Field(0.0, description="Cantidad asignada/comprometida")
    disponible: float = Field(0.0, description="Cantidad disponible")
    unidades_vendidas: float = Field(0.0, description="Unidades vendidas en el rango")
    total_ventas: float = Field(0.0, description="Total vendido en el rango")
    precio_promedio: float = Field(0.0, description="Precio promedio (total/unidades)")
    precio_maximo: float = Field(0.0, description="Precio máximo de venta en el rango")
    precio_minimo: float = Field(0.0, description="Precio mínimo de venta en el rango")
    ultimo_precio: float = Field(0.0, description="Precio de la última venta")
    ultima_fecha_venta: Optional[str] = Field(None, description="Fecha de la última venta en el rango")
    no_dias: Optional[int] = Field(None, description="Días transcurridos desde la última venta")

    class Config:
        from_attributes = True
