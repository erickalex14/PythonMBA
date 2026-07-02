from pydantic import BaseModel, Field
from typing import Optional

class MovimientoDTO(BaseModel):
    TRANS_DATE: Optional[str] = Field(None, description="Fecha de la transacción")
    PRODUCT_NAME: Optional[str] = Field(None, description="Nombre del producto")
    Codigo_producto_convertido: Optional[str] = Field(None, description="Código de producto convertido")
    ORIGINAL_QTY: float = Field(0.0, description="Cantidad original")
    ORIGIN_MEMO: Optional[str] = Field(None, description="Nota de origen")
    ORIGIN_REF: Optional[str] = Field(None, description="Referencia de origen")
    BASE_COMISION: float = Field(0.0, description="Base de comisión")
    Info_Seriales: Optional[str] = Field(None, description="Información de seriales")
    Codigo_Sucursal: Optional[str] = Field(None, description="Código de la sucursal")
    BaseImponibleReal_1: float = Field(0.0, description="Base imponible real")
    COD_SALESMAN: Optional[str] = Field(None, description="Código del vendedor")
    Codigo_Marca: Optional[str] = Field(None, description="Código de la marca del producto")

    class Config:
        from_attributes = True
