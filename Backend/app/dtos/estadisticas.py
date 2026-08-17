from pydantic import BaseModel, Field
from typing import Optional

class EstadisticasVentasDTO(BaseModel):
    codigo: Optional[str] = Field(None, description="Código de producto")
    producto: Optional[str] = Field(None, description="Nombre/descripción del producto")
    empresa: Optional[str] = Field(None, description="Código de empresa (NVC01/ENV01)")
    empresa_nombre: Optional[str] = Field(None, description="Nombre de empresa (NOVICOMPU/ENV)")
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
    no_dias: Optional[int] = Field(None, description="Días desde la última venta hasta el fin del rango")
    unid_dev: float = Field(0.0, description="Unidades devueltas en el rango")
    robo: float = Field(0.0, description="Unidades de robo (pendiente de fuente en el ERP)")
    unid_vend_final: float = Field(0.0, description="Unidades vendidas netas (vendidas - devueltas - robo)")
    unid_anuladas: float = Field(0.0, description="Unidades facturadas y luego anuladas (no se descuentan del neto)")
    total_anulado: float = Field(0.0, description="Monto facturado y luego anulado en el rango")

    class Config:
        from_attributes = True
