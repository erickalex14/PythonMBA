from pydantic import BaseModel, Field
from typing import Optional

#TO DEL DOMINIO DE ATS
class AtsDTO(BaseModel):
    CORP: Optional[str] = Field(None, description="Código de corporativo")
    INVOICE_DATE: Optional[str] = Field(None, description="Fecha de la factura")
    VENDOR_ID: Optional[str] = Field(None, description="ID del proveedor")
    VENDOR_NAME: Optional[str] = Field(None, description="Nombre del proveedor")
    RUC_or_FED_ID: Optional[str] = Field(None, description="RUC o Identificación fiscal")
    DOC_REFERENCE: Optional[str] = Field(None, description="Referencia del documento")
    MEMO: Optional[str] = Field(None, description="Concepto o nota de la factura")
    INVOICE_TOTAL: float = Field(0.0, description="Total facturado")
    TotalProductosConIVa: float = Field(0.0, description="Total productos con IVA")
    TotalServiciosConIVa: float = Field(0.0, description="Total servicios con IVA")
    TotalProductosSinIVa: float = Field(0.0, description="Total productos sin IVA")
    TotalServiciosSinIVa: float = Field(0.0, description="Total servicios sin IVA")
    MF_Alfa3: Optional[str] = Field(None, description="Campo fiscal alfa 3")
    MF_Nume1: Optional[float] = Field(None, description="Campo fiscal numérico 1")
    MF_Alfa2: Optional[str] = Field(None, description="Campo fiscal alfa 2")
    MF_Lista2: Optional[str] = Field(None, description="Lista de clasificación fiscal")
    Reservado1: Optional[bool] = Field(None, description="Campo fiscal reservado 1")
    Reservado2: Optional[bool] = Field(None, description="Campo fiscal reservado 2")
    Reservado3: Optional[bool] = Field(None, description="Campo fiscal reservado 3")
    CODIGO_PROVEEDOR_EMPRESA: Optional[str] = Field(None, description="Llave proveedor-empresa")
    VENDOR_ID_CORP: Optional[str] = Field(None, description="Llave proveedor-empresa en la factura")
    DOC_ID_CORP: Optional[str] = Field(None, description="ID de documento corporativo")
    ID_Relacionado: Optional[str] = Field(None, description="ID relacionado")
    SUMA_CON_IVA: float = Field(0.0, description="Suma de bases con IVA")
    SUMA_SIN_IVA: float = Field(0.0, description="Suma de bases sin IVA")
    ES_ANULADO: int = Field(0, description="Indica si la factura está anulada (1: Sí, 0: No)")
    MF_Bool5: Optional[bool] = Field(None, description="Indicador booleano fiscal 5")
    CONFIRMED: Optional[bool] = Field(None, description="Factura confirmada (front filtra por esto)")
    VOID: Optional[bool] = Field(None, description="Factura anulada")

    class Config:
        from_attributes = True
