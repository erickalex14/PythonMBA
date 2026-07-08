from sqlalchemy import Column, Integer, String, Date, Text, Numeric, Boolean, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base

class LiquidacionPrincipalStaging(Base):
    __tablename__ = "liquidaciones_principal_staging"

    liquidacion_id_corp = Column(String(50), primary_key=True, index=True)
    corp = Column(String(10), nullable=False)
    liquidacion_fecha = Column(Date, nullable=False, index=True)
    observaciones = Column(Text, nullable=True)
    
    antes_total_1 = Column(Numeric(18, 4), default=0.0)
    antes_total_2 = Column(Numeric(18, 4), default=0.0)
    antes_total_3 = Column(Numeric(18, 4), default=0.0)
    despues_total_1 = Column(Numeric(18, 4), default=0.0)
    despues_total_2 = Column(Numeric(18, 4), default=0.0)
    despues_total_3 = Column(Numeric(18, 4), default=0.0)
    
    liquidacion_estado = Column(Boolean, default=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class LiquidacionProductoStaging(Base):
    __tablename__ = "liquidaciones_productos_staging"

    id = Column(Integer, primary_key=True, autoincrement=True)
    liquidacion_id_corp = Column(String(50), nullable=False, index=True)
    
    factura_id_corp = Column(String(50), nullable=True)
    id_recepcion_relacionada = Column(String(50), nullable=True)
    
    valor_total_cif = Column(Numeric(18, 4), default=0.0)
    valor_subtotal_cif = Column(Numeric(18, 4), default=0.0)
    
    valor_antes_1 = Column(Numeric(18, 4), default=0.0)
    valor_antes_2 = Column(Numeric(18, 4), default=0.0)
    valor_antes_3 = Column(Numeric(18, 4), default=0.0)
    valor_despues_1 = Column(Numeric(18, 4), default=0.0)
    valor_despues_2 = Column(Numeric(18, 4), default=0.0)
    valor_despues_3 = Column(Numeric(18, 4), default=0.0)
    
    partida_id_corp = Column(String(50), nullable=True)
    producto_id_corp = Column(String(50), nullable=True)
    liquidacion_id = Column(String(50), nullable=True)
    
    cantidad = Column(Numeric(18, 4), default=0.0)
    precio = Column(Numeric(18, 4), default=0.0)
    total = Column(Numeric(18, 4), default=0.0)
    
    valor_total_cif_manual = Column(Numeric(18, 4), default=0.0)
    valor_total_cif_unidad = Column(Numeric(18, 4), default=0.0)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

# Crear índices individuales para agilizar el cruce
Index("idx_liquidaciones_prod_id_corp", LiquidacionProductoStaging.liquidacion_id_corp)
