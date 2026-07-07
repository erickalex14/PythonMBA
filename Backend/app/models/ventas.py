from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class VentasKardexStaging(Base):
    """
    Tabla de Staging para Movimientos de Inventario del Kardex (Ventas).
    """
    __tablename__ = "ventas_kardex_staging"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_id_corp = Column(String(50), index=True, nullable=False)
    trans_date = Column(Date, index=True, nullable=False)
    product_id_corp = Column(String(50), index=True, nullable=False)
    product_name = Column(String(250), nullable=True)
    quantity = Column(Numeric(18, 4), default=0.0)
    original_qty = Column(Numeric(18, 4), default=0.0)
    unit_cost = Column(Numeric(18, 4), default=0.0)
    discount_amount = Column(Numeric(18, 4), default=0.0)
    net_line_total = Column(Numeric(18, 4), default=0.0)
    um = Column(String(20), nullable=True, default="UNID")
    anulada = Column(Boolean, default=False)
    in_out = Column(String(10), nullable=True)
    codigo_grupo = Column(String(50), nullable=True)
    codigo_subgrupo = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=True)

class VentasFacturaStaging(Base):
    """
    Tabla de Staging para Cabeceras de Facturas de Clientes (Ventas).
    """
    __tablename__ = "ventas_facturas_staging"

    doc_id_corp = Column(String(50), primary_key=True, index=True)
    doc_reference = Column(String(100), nullable=True)
    invoice_date = Column(Date, index=True, nullable=False)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=True)
