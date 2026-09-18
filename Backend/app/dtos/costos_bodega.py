from typing import List, Optional

from pydantic import BaseModel, Field


class SucursalCostoDTO(BaseModel):
    sucursal: str = Field(
        ..., description="Nombre de la Bodega Principal (agrupa el costo de todas sus sub-bodegas). "
                          "Para TRN/RCP (sin Bodega Principal), es su propio WARE_NAME/WARE_CODE")
    codigo: str = Field(..., description="Codigo de la Bodega Principal, para pedir su desglose en GET /subbodegas")
    corp: str = Field(..., description="Empresa duena de esta fila")
    costo_total: float = Field(..., description="Costo total de inventario de la bodega principal")
    total_subbodegas: int = Field(
        ..., description="Cuantas sub-bodegas (WARE_CODE) tiene registradas esta Bodega Principal en el catalogo, "
                          "tengan o no stock actual")
    ciudad: Optional[str] = Field(
        None, description="Ciudad de la bodega (CITY de MBA3, campo disperso -- puede venir vacio)")


class TopItemDTO(BaseModel):
    etiqueta: str = Field(..., description="Nombre del producto, o codigo de grupo/marca")
    costo_total: float


class CostosPorSucursalDTO(BaseModel):
    sucursales: List[SucursalCostoDTO]
    total_general: float = Field(..., description="Suma de costo_total de todas las bodegas principales")
    filas_procesadas: int = Field(..., description="Filas de INVT_Bodegas_Saldos con OH>0 usadas en el calculo")
    ultima_sincronizacion: Optional[str] = Field(
        None, description="Cuando corrio la ultima sincronizacion contra MBA3; null si nunca se sincronizo")
    top_productos: List[TopItemDTO] = Field(
        default_factory=list, description="Top 15 productos por costo total, para el grafico inicial del reporte")
    top_grupos: List[TopItemDTO] = Field(default_factory=list, description="Top grupos por costo total")
    top_marcas: List[TopItemDTO] = Field(default_factory=list, description="Top marcas por costo total")


class EmpresaDTO(BaseModel):
    corp: str = Field(..., description="Codigo de empresa en MBA3 (NVC01, ENV01)")
    nombre: str = Field(..., description="Nombre comercial de la empresa")


class BodegaPrincipalDTO(BaseModel):
    codigo: str = Field(
        ..., description="Codigo_Local de MBA3, o el propio WARE_CODE si la bodega no pertenece a "
                          "ninguna Bodega Principal (TRN, RCP). Usar este valor para filtrar por bodega_principal")
    nombre: str = Field(..., description="Nombre a mostrar (del catalogo manual, o WARE_NAME/codigo si no hay match)")
    corp: str = Field(
        ..., description="Empresa duena de esta Bodega Principal. Usar este valor (no el filtro de empresa "
                          "elegido en pantalla) al pedir /subbodegas o filtrar /detalle por esta principal -- "
                          "el codigo solo no es univoco entre empresas")


class SubBodegaDTO(BaseModel):
    ware_code: str = Field(..., description="Codigo de la sub-bodega, para filtrar por sub_bodega")
    nombre: Optional[str] = None
    tipo: Optional[str] = Field(None, description="Clasificacion del catalogo manual (Ventas/Operativa, Consignacion, etc.)")
    costo_total: float = Field(0, description="Costo de inventario de esta sub-bodega sola (0 si no tiene stock actual)")


class OpcionesFiltroDTO(BaseModel):
    bodegas_principales: List[BodegaPrincipalDTO]
    grupos: List[str]
    marcas: List[str]


class LineaDetalleDTO(BaseModel):
    corp: str
    bodega_principal: str = Field(..., description="Nombre de la Bodega Principal de esta linea")
    ware_code: str = Field(..., description="Codigo de la sub-bodega (WARE_CODE)")
    sub_bodega_nombre: Optional[str] = None
    sub_bodega_tipo: Optional[str] = None
    product_id_corp: str
    producto_nombre: Optional[str] = None
    grupo: Optional[str] = None
    subgrupo: Optional[str] = None
    marca: Optional[str] = None
    oh: float
    costo_unitario: float = Field(..., description="Costo_Promedio de la bodega, o AVERAGE_COST del producto si aquel vino en 0")
    costo_total: float


class DetalleCostosDTO(BaseModel):
    lineas: List[LineaDetalleDTO]
    total_filas: int = Field(..., description="Filas que matchean los filtros (antes de paginar)")
    limit: int
    offset: int
