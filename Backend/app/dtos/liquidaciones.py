from pydantic import BaseModel, Field
from typing import Optional, Any

class LiquidacionDTO(BaseModel):
    CORP: Optional[Any] = Field(None, description="Código corporativo")
    LIQUIDACION_FECHA: Optional[Any] = Field(None, description="Fecha de liquidación")
    OBSERVACIONES: Optional[Any] = Field(None, description="Observaciones generales")
    FACTURA_ID_CORP: Optional[Any] = Field(None, description="ID corporativo de factura")
    IdRecepcionRelacionada: Optional[Any] = Field(None, description="ID de recepción relacionada")
    ANTES_TOTAL_1: float = Field(0.0)
    ANTES_TOTAL_2: float = Field(0.0)
    ANTES_TOTAL_3: float = Field(0.0)
    DESPUES_TOTAL_1: float = Field(0.0)
    DESPUES_TOTAL_2: float = Field(0.0)
    DESPUES_TOTAL_3: float = Field(0.0)
    VALOR_TOTAL_CIF: float = Field(0.0, description="Valor CIF total")
    VALOR_SUBTOTAL_CIF: float = Field(0.0, description="Subtotal de valor CIF")
    VALOR_ANTES_1: float = Field(0.0)
    VALOR_ANTES_2: float = Field(0.0)
    VALOR_ANTES_3: float = Field(0.0)
    VALOR_DESPUES_1: float = Field(0.0)
    VALOR_DESPUES_2: float = Field(0.0)
    VALOR_DESPUES_3: float = Field(0.0)
    PARTIDA_ID_CORP: Optional[Any] = Field(None, description="ID de partida arancelaria")
    PRODUCTO_ID_CORP: Optional[Any] = Field(None, description="ID corporativo del producto")
    LIQUIDACION_ID: Optional[Any] = Field(None, description="ID interno de liquidación")
    CANTIDAD: float = Field(0.0, description="Cantidad de productos")
    PRECIO: float = Field(0.0, description="Precio unitario")
    TOTAL: float = Field(0.0, description="Total de la transacción")
    VALOR_TOTAL_CIF_MANUAL: float = Field(0.0, description="Valor CIF manual")
    VALOR_TOTAL_CIF_UNIDAD: float = Field(0.0, description="Valor CIF por unidad")
    LIQUIDACION_ESTADO: Any = Field(None, description="Estado de la liquidación")
    LIQUIDACION_ID_CORP: Optional[Any] = Field(None, description="ID corporativo de liquidación")
    # Agregados en la revision 2026-09-11/12. FastAPI filtra del JSON de salida
    # cualquier campo no declarado aca (response_model=List[LiquidacionDTO]):
    # el service ya los calculaba, pero sin declararlos aca nunca llegaban al
    # front ni al Excel descargado desde la web (bug real, encontrado
    # 2026-09-12 -- el curl directo al backend SI los traia porque no pasa por
    # este filtro de FastAPI, la lectura normal del front si).
    PRODUCTO_CODIGO: Optional[Any] = Field(None, description="Código de producto sin el sufijo de empresa")
    PRODUCTO_NOMBRE: Optional[Any] = Field(None, description="Nombre del producto")
    PROVEEDOR_NOMBRE: Optional[Any] = Field(None, description="Nombre del proveedor")

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True
