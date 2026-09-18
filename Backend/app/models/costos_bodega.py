from sqlalchemy import Column, Numeric, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

# Datawarehouse propio del reporte de Costos por Sucursal (TAREA-costos-por-
# sucursal.md), mismo motivo que el schema `kpi`: viviendo en `public`,
# `prisma db push --accept-data-loss` (Prisma solo administra `public`) las
# borraba en cada deploy del frontend.
SCHEMA_COSTOS_BODEGA = "costos_bodega"


class CostosBodegaBodega(Base):
    """Catalogo de bodegas (INVT_Bodegas_Lista), sincronizado desde MBA3.

    Clave compuesta (ware_code, corp) y NO solo ware_code: NVC01 y ENV01
    comparten codigos de bodega (ambas tienen "TRN"/"RCP" con nombre/dueño
    distinto) -- con ware_code solo, sincronizar la segunda empresa pisaria
    los datos de la primera.

    NO se guarda INACTIVE: hay bodegas cerradas que todavia tienen stock y
    cuentan para el total (aclarado explicitamente en la tarea).
    """
    __tablename__ = "bodegas"
    __table_args__ = {"schema": SCHEMA_COSTOS_BODEGA}

    ware_code = Column(String(20), primary_key=True)
    corp = Column(String(20), primary_key=True, index=True)
    ware_name = Column(String(120), nullable=True)
    codigo_sucursal = Column(String(20), nullable=True)
    codigo_local = Column(String(20), nullable=True, index=True)
    # CITY de INVT_Bodegas_Lista -- campo real (confirmado contra MBA3), pero
    # muy disperso: solo ~5% de las bodegas de NVC01 lo tienen cargado. Se
    # guarda tal cual viene (sin normalizar GYE/GUAYAQUIL ni similares).
    ciudad = Column(String(60), nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class CostosBodegaSaldo(Base):
    """Saldos y costos por producto/bodega (INVT_Bodegas_Saldos) con OH > 0,
    sincronizado desde MBA3. `updated_at` se usa para el barrido de filas que
    ya no tienen OH > 0 en MBA3 (ver CostosBodegaSyncService)."""
    __tablename__ = "saldos"
    __table_args__ = {"schema": SCHEMA_COSTOS_BODEGA}

    ware_code = Column(String(20), primary_key=True)
    product_id_corp = Column(String(80), primary_key=True)
    oh = Column(Numeric(18, 4), default=0)
    costo_promedio = Column(Numeric(18, 4), default=0)
    corp = Column(String(20), index=True, nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class CostosBodegaProducto(Base):
    """Catalogo de productos (INVT_Ficha_Principal), sincronizado desde MBA3.

    Dos usos: filtrar el reporte por producto/grupo/marca (pedido 2026-09-15,
    igual que el libro de Excel que usa Contabilidad), y servir de respaldo
    del costo cuando `Costo_Promedio` de INVT_Bodegas_Saldos viene en 0 --
    confirmado contra MBA3 real que en PRUEBAS ese campo especifico viene
    roto (siempre 0) mientras que `AVERAGE_COST` de la ficha del producto
    trae el costo real (mismo valor que el desglose interno
    ResumSaldosProductos de MBA3 cuando ese si esta poblado).
    """
    __tablename__ = "productos"
    __table_args__ = {"schema": SCHEMA_COSTOS_BODEGA}

    product_id_corp = Column(String(80), primary_key=True)
    product_name = Column(String(250), nullable=True)
    group_code = Column(String(20), nullable=True)
    sub_group_code = Column(String(20), nullable=True)
    codigo_marca = Column(String(20), nullable=True)
    product_type = Column(String(30), nullable=True)
    average_cost = Column(Numeric(18, 4), default=0)
    corp = Column(String(20), index=True, nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class CostosBodegaPrincipal(Base):
    """Catalogo Codigo_Local -> nombre de "Bodega Principal" (ej. "001 RIO
    COCA"), importado del Excel de Contabilidad (Estructura_Todas_las_
    Bodegas_y_Subbodegas.xlsx, importado 2026-09-16). MBA3 no expone este
    nombre por ningun campo consultable -- Codigo_Local agrupa las
    sub-bodegas (WARE_CODE) pero su nombre bonito solo vive en este documento
    manual de Contabilidad. Se re-importa via POST /importar-estructura
    cuando cambie la estructura de bodegas.

    corp en la clave porque el documento fuente es propio de NVC01: no
    asumir que un Codigo_Local de otra empresa significa lo mismo.
    """
    __tablename__ = "bodegas_principales"
    __table_args__ = {"schema": SCHEMA_COSTOS_BODEGA}

    codigo_local = Column(String(20), primary_key=True)
    corp = Column(String(20), primary_key=True)
    nombre = Column(String(150), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class CostosBodegaSubtipo(Base):
    """Tipo/Clasificacion de cada sub-bodega (WARE_CODE) -- ej. "Ventas /
    Operativa", "Consignacion", "Transito" -- importado del mismo Excel que
    CostosBodegaPrincipal. Igual que ese, no viene de MBA3."""
    __tablename__ = "subbodegas_tipo"
    __table_args__ = {"schema": SCHEMA_COSTOS_BODEGA}

    ware_code = Column(String(20), primary_key=True)
    corp = Column(String(20), primary_key=True)
    tipo = Column(String(60), nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
