from sqlalchemy import (Boolean, Column, Date, DateTime, Index, Integer,
                        LargeBinary, Numeric, String)
from sqlalchemy.sql import func
from app.core.database import Base

# Todo el reporte KPI vive en su propio schema de Postgres.
#
# Dos razones:
#  1. El sync del KPI puede apuntar a PRUEBAS sin pisar el staging de Ventas y
#     Rentabilidad, que ya esta cuadrado contra produccion y no se toca.
#  2. Prisma solo administra `public`. El contenedor del front arranca con
#     `prisma db push --accept-data-loss` y borraba estas tablas en cada deploy;
#     fuera de `public` ni las ve.
SCHEMA_KPI = "kpi"


class KpiProductoCat(Base):
    """Catalogo producto -> categoria de KPI.

    Reemplaza el VLOOKUP contra la hoja POND del Excel. El codigo va SIN el
    sufijo de empresa (`-NVC01` / `-ENV01`), igual que en el Excel; el cruce
    contra la vista de ventas lo quita antes de comparar.
    """
    __tablename__ = "kpi_producto_cat"
    __table_args__ = {"schema": SCHEMA_KPI}

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
    __table_args__ = {"schema": SCHEMA_KPI}

    codigo = Column(String(20), primary_key=True)
    nombre = Column(String(120), nullable=False)
    supervisor = Column(String(120), index=True, nullable=True)
    marca = Column(String(60), nullable=True)
    ciudad = Column(String(60), nullable=True)
    activa = Column(String(2), default="SI")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class KpiBodega(Base):
    """Bodega del ERP -> sucursal del reporte.

    El ERP no tiene un campo que diga a que tienda pertenece cada bodega:
    `Codigo_Sucursal` viene vacio en las 329 bodegas y las bodegas ADMIN
    ("ADMIN NV BOMBOL") no llevan el numero de su tienda en ningun lado. Por eso
    el mapeo se deriva con una regla y queda una columna para corregir a mano lo
    que la regla no acierta.

    `sucursal_efectiva` = override si existe, si no la derivada. Una bodega sin
    ninguna de las dos queda FUERA del reporte: es el caso de mayoristas,
    e-commerce y ROBO/PERDIDAS, que el reporte manual tampoco incluye.
    """
    __tablename__ = "kpi_bodega"
    __table_args__ = {"schema": SCHEMA_KPI}

    ware_code = Column(String(20), primary_key=True)
    ware_name = Column(String(120), nullable=True)
    codigo_local = Column(String(20), nullable=True)
    corp = Column(String(20), index=True, nullable=True)
    inactiva = Column(Boolean, default=False)
    # Derivada por la regla; se recalcula en cada sincronizacion.
    sucursal = Column(String(20), index=True, nullable=True)
    # Correccion manual: manda sobre la derivada y la sincronizacion no la pisa.
    sucursal_override = Column(String(20), nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class KpiCobroCredito(Base):
    """Cobros de credito directo (CrediNovi / Banco Solidario) del ERP.

    `CODIGO_TIENDA` del cobro ya trae el codigo de sucursal, asi que esto NO
    depende del mapeo de bodegas.
    """
    __tablename__ = "kpi_cobro_credito"
    __table_args__ = {"schema": SCHEMA_KPI}

    codigo_cobro = Column(String(50), primary_key=True)
    sucursal = Column(String(20), index=True, nullable=True)
    fecha = Column(Date, index=True, nullable=False)
    valor = Column(Numeric(18, 4), default=0)
    # Lo que escribio el cajero, para poder auditar por que entro al reporte.
    tipo_crudo = Column(String(160), nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class KpiPlantilla(Base):
    """El .xlsx que sube Contabilidad, guardado para usarlo como plantilla.

    Replicar a mano los colores, fuentes y anchos del archivo original seria
    frágil y largo. En vez de eso el reporte se genera ENCIMA del ultimo archivo
    subido: se conservan sus dos filas de encabezado con su formato y se
    reescriben las filas de datos copiando el estilo de la primera.
    """
    __tablename__ = "kpi_plantilla"
    __table_args__ = {"schema": SCHEMA_KPI}

    id = Column(Integer, primary_key=True, default=1)
    nombre = Column(String(250), nullable=True)
    archivo = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class KpiMeta(Base):
    """Meta por sucursal, KPI y mes. Se carga a mano desde el panel.

    `periodo` es 'YYYY-MM'. Las metas cambian todos los meses y no se derivan
    de nada: son una decision comercial.
    """
    __tablename__ = "kpi_meta"
    __table_args__ = {"schema": SCHEMA_KPI}

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
    __table_args__ = {"schema": SCHEMA_KPI}

    periodo = Column(String(7), primary_key=True)
    sucursal = Column(String(20), primary_key=True)
    kpi = Column(String(40), primary_key=True)
    valor = Column(Numeric(18, 4), nullable=False, default=0)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


Index("ix_kpi_meta_periodo", KpiMeta.periodo)
Index("ix_kpi_valor_manual_periodo", KpiValorManual.periodo)


class KpiVentasKardex(Base):
    """Copia del kardex SOLO para el reporte KPI.

    Espeja `ventas_kardex_staging` de `public`, pero se sincroniza aparte y
    puede apuntar a otro entorno del ERP sin afectar a Ventas ni Rentabilidad.
    """
    __tablename__ = "ventas_kardex"
    __table_args__ = {"schema": SCHEMA_KPI}

    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_id_corp = Column(String(50), index=True, nullable=False)
    trans_date = Column(Date, index=True, nullable=False)
    product_id_corp = Column(String(50), index=True, nullable=False)
    product_name = Column(String(250), nullable=True)
    quantity = Column(Numeric(18, 4), default=0.0)
    discount_amount = Column(Numeric(18, 4), default=0.0)
    net_line_total = Column(Numeric(18, 4), default=0.0)
    um = Column(String(20), nullable=True)
    anulada = Column(Boolean, default=False)
    codigo_grupo = Column(String(50), nullable=True)
    codigo_subgrupo = Column(String(50), nullable=True)
    trans_cost = Column(Numeric(18, 4), default=0.0)
    war_code = Column(String(20), index=True, nullable=True)
    code_salesman = Column(String(20), nullable=True)
    codigo_cliente = Column(String(20), nullable=True)
    nombre_cliente = Column(String(150), nullable=True)
    origin_memo = Column(String(50), index=True, nullable=True)
    origin_ref = Column(String(50), index=True, nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class KpiVentasFactura(Base):
    """Cabecera de factura para el reporte KPI. Espeja `ventas_facturas_staging`."""
    __tablename__ = "ventas_facturas"
    __table_args__ = {"schema": SCHEMA_KPI}

    doc_id_corp = Column(String(50), primary_key=True)
    numero_factura = Column(String(50), index=True, nullable=True)
    invoice_date = Column(Date, index=True, nullable=False)
    empresa = Column(String(20), index=True, nullable=True)
    codigo_local = Column(String(20), index=True, nullable=True)
    anulada = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
