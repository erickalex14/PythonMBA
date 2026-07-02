from pydantic import BaseModel, Field
from typing import Optional

#TO DEL DOMINIO DE ATS
class AtsDTO(BaseModel):
    INVOICE_DATE: Optional[str] = Field(None, description="Fecha de la factura")
    CORP: Optional[str] = Field(None, description="Código de corporativo")
    VENDOR_ID: Optional[str] = Field(None, description="ID del proveedor")
    VENDOR_NAME: Optional[str] = Field(None, description="Nombre del proveedor")
    RUC_or_FED_ID: Optional[str] = Field(None, description="RUC o Identificación fiscal")
    MEMO: Optional[str] = Field(None, description="Concepto o nota de la factura")
    INVOICE_TOTAL: float = Field(0.0, description="Total facturado")
    DOC_REFERENCE: Optional[str] = Field(None, description="Referencia del documento")
    MF_Nume1: Optional[float] = Field(None, description="Campo fiscal numérico 1")
    MF_Alfa2: Optional[str] = Field(None, description="Campo fiscal alfa 2")
    MF_Lista2: Optional[str] = Field(None, description="Lista de clasificación fiscal")
    SUMA_CON_IVA: float = Field(0.0, description="Suma de bases con IVA")
    SUMA_SIN_IVA: float = Field(0.0, description="Suma de bases sin IVA")
    ES_ANULADO: int = Field(0, description="Indica si la factura está anulada (1: Sí, 0: No)")
    MF_Bool5: Optional[bool] = Field(None, description="Indicador booleano fiscal 5")
    DOC_ID_CORP: Optional[str] = Field(None, description="ID de documento corporativo")
    ID_Relacionado: Optional[str] = Field(None, description="ID relacionado")

    class Config:
        from_attributes = True
