from sqlalchemy import Column, String, Date, Numeric, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class AtsFacturaStaging(Base):
    """
    Tabla de Staging para Cabeceras de Facturas de Compras de ATS.
    """
    __tablename__ = "ats_facturas_staging"

    doc_id_corp = Column(String(50), primary_key=True, index=True)
    invoice_date = Column(Date, nullable=False, index=True)
    corp = Column(String(10), nullable=False)
    vendor_id = Column(String(50), nullable=False, index=True)
    # vendor_id_corp = llave vendor-empresa ("P0691-NVC01"); cruza con proveedor.codigo_proveedor_empresa.
    vendor_id_corp = Column(String(60), nullable=True, index=True)
    memo = Column(Text, nullable=True)
    invoice_total = Column(Numeric(18, 4), default=0.0)
    doc_reference = Column(String(100), nullable=True)
    total_productos_con_iva = Column(Numeric(18, 4), default=0.0)
    total_servicios_con_iva = Column(Numeric(18, 4), default=0.0)
    total_productos_sin_iva = Column(Numeric(18, 4), default=0.0)
    total_servicios_sin_iva = Column(Numeric(18, 4), default=0.0)
    void = Column(Boolean, default=False)
    confirmed = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=True)

class AtsProveedorStaging(Base):
    """
    Tabla de Staging para el Catálogo de Proveedores de ATS.
    """
    __tablename__ = "ats_proveedores_staging"

    vendor_id = Column(String(50), primary_key=True, index=True)
    vendor_name = Column(String(200), nullable=False)
    ruc_or_fed_id = Column(String(50), nullable=True)
    # codigo_proveedor_empresa = llave vendor-empresa ("P0001-NVC01"); cruza con factura.vendor_id_corp.
    # ponytail: PK sigue siendo vendor_id (datos mono-empresa NVC01). Si aparecen proveedores
    # multi-empresa (mismo vendor_id, distinto corp), migrar PK a codigo_proveedor_empresa.
    codigo_proveedor_empresa = Column(String(60), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=True)

class AtsFiscalStaging(Base):
    """
    Tabla de Staging para la Información Fiscal de Documentos de ATS.
    """
    __tablename__ = "ats_fiscal_staging"

    id_relacionado = Column(String(50), primary_key=True, index=True)
    mf_nume1 = Column(Numeric(18, 4), default=0.0)
    mf_alfa2 = Column(String(100), nullable=True)
    mf_alfa3 = Column(String(100), nullable=True)
    mf_lista2 = Column(String(100), nullable=True)
    mf_bool5 = Column(Boolean, default=False)
    reservado1 = Column(Boolean, default=False)
    reservado2 = Column(Boolean, default=False)
    reservado3 = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=True)
