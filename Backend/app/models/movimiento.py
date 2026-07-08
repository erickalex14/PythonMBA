from sqlalchemy import Column, Integer, String, Numeric, Text, Date, DateTime, func
from app.core.database import Base

class MovimientoStaging(Base):
    __tablename__ = "movimientos_staging"

    id = Column(Integer, primary_key=True, index=True)
    
    # Campo clave para filtros
    trans_date = Column(Date, index=True, nullable=False)
    
    product_name = Column(String, nullable=True)
    codigo_producto_convertido = Column(String, index=True, nullable=False)
    original_qty = Column(Numeric(18, 4), default=0.0)
    origin_memo = Column(Text, nullable=True)
    origin_ref = Column(String, nullable=True)
    base_comision = Column(Numeric(18, 4), default=0.0)
    info_seriales = Column(Text, nullable=True)
    codigo_sucursal = Column(String, nullable=True)
    base_imponible_real_1 = Column(Numeric(18, 4), default=0.0)
    cod_salesman = Column(String, nullable=True)
    codigo_marca = Column(String, nullable=True)
    
    # default= (no server_default): la tabla la crea Prisma sin default en DB,
    # y bulk_save_objects solo emite defaults del lado cliente en el INSERT
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
