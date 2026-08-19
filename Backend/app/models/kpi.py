from sqlalchemy import Column, String, Numeric, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base


class KpiProductoCat(Base):
    """Catalogo producto -> categoria de KPI.

    Reemplaza el VLOOKUP contra la hoja POND del Excel. El codigo va SIN el
    sufijo de empresa (`-NVC01` / `-ENV01`), igual que en el Excel; el cruce
    contra la vista de ventas lo quita antes de comparar.
    """
    __tablename__ = "kpi_producto_cat"

    codigo = Column(String(50), primary_key=True)
    cat = Column(String(60), index=True, nullable=False)
    producto = Column(String(250), nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class KpiSucursal(Base):
    """Sucursal -> supervisor / marca / ciudad.

    El ERP no expone el supervisor: hoy vive en hojas sueltas del Excel de KPI.
    `codigo` cruza con `view_ventas_espejo_reporte.sucursal` (= codigo_local).
    """
    __tablename__ = "kpi_sucursal"

    codigo = Column(String(20), primary_key=True)
    nombre = Column(String(120), nullable=False)
    supervisor = Column(String(120), index=True, nullable=True)
    marca = Column(String(60), nullable=True)
    ciudad = Column(String(60), nullable=True)
    activa = Column(String(2), default="SI")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class KpiMeta(Base):
    """Meta por sucursal, KPI y mes. Se carga a mano desde el panel.

    `periodo` es 'YYYY-MM'. Las metas cambian todos los meses y no se derivan
    de nada: son una decision comercial.
    """
    __tablename__ = "kpi_meta"

    periodo = Column(String(7), primary_key=True)
    sucursal = Column(String(20), primary_key=True)
    kpi = Column(String(40), primary_key=True)
    meta = Column(Numeric(18, 4), nullable=False, default=0)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class KpiValorManual(Base):
    """Valores reales que no salen del ERP (hoy llegan por un Google Form).

    REVIEW ENV y PLANES CLARO se capturan fuera del sistema. Se guardan aparte
    de `KpiMeta` porque son el valor REAL, no la meta.
    """
    __tablename__ = "kpi_valor_manual"

    periodo = Column(String(7), primary_key=True)
    sucursal = Column(String(20), primary_key=True)
    kpi = Column(String(40), primary_key=True)
    valor = Column(Numeric(18, 4), nullable=False, default=0)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


Index("ix_kpi_meta_periodo", KpiMeta.periodo)
Index("ix_kpi_valor_manual_periodo", KpiValorManual.periodo)
