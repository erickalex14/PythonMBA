import os
import secrets
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi

# Inicialización de Base de Datos y Creación de Tablas (Staging)
from app.core.database import engine, Base
from app.models.movimiento import MovimientoStaging
from app.models.liquidacion import LiquidacionPrincipalStaging, LiquidacionProductoStaging
from app.models.ats import AtsFacturaStaging, AtsProveedorStaging, AtsFiscalStaging
from app.models.ventas import VentasKardexStaging, VentasFacturaStaging
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Arrancando aplicación: Inicializando base de datos...")
    try:
        # 1. Crear tablas físicas
        Base.metadata.create_all(bind=engine)
        logging.info("Base de datos inicializada: tablas creadas correctamente.")
        
        # 2. Crear o actualizar las vistas SQL
        with engine.begin() as connection:
            # create_all no altera tablas ya existentes: columnas nuevas del modelo
            # (bodega/cliente/costo) se agregan aqui de forma idempotente.
            connection.execute(text("""
                ALTER TABLE ventas_kardex_staging
                    ADD COLUMN IF NOT EXISTS trans_cost NUMERIC(18, 4) DEFAULT 0.0,
                    ADD COLUMN IF NOT EXISTS war_code VARCHAR(20),
                    ADD COLUMN IF NOT EXISTS bodega_nombre VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS codigo_cliente VARCHAR(20),
                    ADD COLUMN IF NOT EXISTS nombre_cliente VARCHAR(150),
                    ADD COLUMN IF NOT EXISTS info_seriales VARCHAR(2000);
            """))
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_ventas_kardex_staging_war_code ON ventas_kardex_staging (war_code);
            """))
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_ventas_kardex_staging_codigo_cliente ON ventas_kardex_staging (codigo_cliente);
            """))
            logging.info("Columnas de rentabilidad (bodega/cliente/costo) verificadas en ventas_kardex_staging.")

            # ATS: columnas nuevas (JOIN vendor-empresa + campos fiscales) de forma idempotente.
            connection.execute(text("ALTER TABLE ats_facturas_staging ADD COLUMN IF NOT EXISTS vendor_id_corp VARCHAR(60);"))
            connection.execute(text("ALTER TABLE ats_proveedores_staging ADD COLUMN IF NOT EXISTS codigo_proveedor_empresa VARCHAR(60);"))
            connection.execute(text("""
                ALTER TABLE ats_fiscal_staging
                    ADD COLUMN IF NOT EXISTS mf_alfa3 VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS reservado1 BOOLEAN DEFAULT false,
                    ADD COLUMN IF NOT EXISTS reservado2 BOOLEAN DEFAULT false,
                    ADD COLUMN IF NOT EXISTS reservado3 BOOLEAN DEFAULT false;
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_ats_facturas_staging_vendor_id_corp ON ats_facturas_staging (vendor_id_corp);"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_ats_proveedores_staging_cod_prov_emp ON ats_proveedores_staging (codigo_proveedor_empresa);"))
            logging.info("Columnas nuevas de ATS verificadas en staging.")

            sql_view_liq = """
            CREATE OR REPLACE VIEW view_liquidaciones_reporte AS
            SELECT
                p.corp,
                p.liquidacion_fecha,
                p.observaciones,
                d.factura_id_corp,
                d.id_recepcion_relacionada,
                p.antes_total_1,
                p.antes_total_2,
                p.antes_total_3,
                p.despues_total_1,
                p.despues_total_2,
                p.despues_total_3,
                d.valor_total_cif,
                d.valor_subtotal_cif,
                d.valor_antes_1,
                d.valor_antes_2,
                d.valor_antes_3,
                d.valor_despues_1,
                d.valor_despues_2,
                d.valor_despues_3,
                d.partida_id_corp,
                d.producto_id_corp,
                d.liquidacion_id,
                d.cantidad,
                d.precio,
                d.total,
                d.valor_total_cif_manual,
                d.valor_total_cif_unidad,
                p.liquidacion_estado,
                p.liquidacion_id_corp
            FROM liquidaciones_principal_staging p
            INNER JOIN liquidaciones_productos_staging d 
                ON p.liquidacion_id_corp = d.liquidacion_id_corp;
            """
            connection.execute(text(sql_view_liq))
            logging.info("Vista relacional SQL 'view_liquidaciones_reporte' creada o actualizada.")

            # DROP antes de CREATE: cambian columnas y llave de JOIN, CREATE OR REPLACE fallaria.
            connection.execute(text("DROP VIEW IF EXISTS view_ats_reporte CASCADE;"))
            sql_view_ats = """
            CREATE VIEW view_ats_reporte AS
            SELECT
                f.corp,
                f.invoice_date,
                f.vendor_id,
                p.vendor_name,
                p.ruc_or_fed_id,
                f.doc_reference,
                f.memo,
                f.invoice_total,
                f.total_productos_con_iva,
                f.total_servicios_con_iva,
                f.total_productos_sin_iva,
                f.total_servicios_sin_iva,
                fi.mf_alfa3,
                fi.mf_nume1,
                fi.mf_alfa2,
                fi.mf_lista2,
                fi.reservado1,
                fi.reservado2,
                fi.reservado3,
                p.codigo_proveedor_empresa,
                f.vendor_id_corp,
                f.doc_id_corp,
                fi.id_relacionado,
                -- Compat con front actual: sumas, es_anulado y flags para filtrar en cliente.
                (f.total_productos_con_iva + f.total_servicios_con_iva) AS suma_con_iva,
                (f.total_productos_sin_iva + f.total_servicios_sin_iva) AS suma_sin_iva,
                CASE WHEN f.void = true THEN 1 ELSE 0 END AS es_anulado,
                fi.mf_bool5,
                f.confirmed,
                f.void
            FROM ats_facturas_staging f
            INNER JOIN ats_proveedores_staging p ON f.vendor_id_corp = p.codigo_proveedor_empresa
            INNER JOIN ats_fiscal_staging fi ON f.doc_id_corp = fi.id_relacionado;
            """
            connection.execute(text(sql_view_ats))
            logging.info("Vista relacional SQL 'view_ats_reporte' creada o actualizada.")

            # DROP antes de CREATE: al cambiar columnas, CREATE OR REPLACE falla.
            connection.execute(text("DROP VIEW IF EXISTS view_ventas_espejo_reporte CASCADE;"))
            sql_view_ventas = """
            CREATE VIEW view_ventas_espejo_reporte AS
            SELECT
                f.numero_factura AS factura_final,
                k.trans_date AS fecha,
                regexp_replace(k.product_id_corp, '\\.0$', '') AS codigo,
                UPPER(TRIM(k.product_name)) AS producto,
                COALESCE(k.codigo_grupo, 'GENERAL') AS grupo,
                COALESCE(k.codigo_subgrupo, 'GENERAL') AS subgrupo,
                UPPER(TRIM(k.um)) AS unidad,
                k.cantidad_real AS cantidad,
                ROUND((k.net_line_total + k.discount_amount) / NULLIF(k.cantidad_real, 0), 4) AS precio_venta,
                ROUND(k.net_line_total + k.discount_amount, 4) AS subtotal,
                ROUND(k.discount_amount, 4) AS descuento_aplicado,
                ROUND(k.net_line_total, 4) AS total_linea,
                k.war_code AS bodega_codigo,
                COALESCE(k.bodega_nombre, '') AS bodega_nombre,
                k.codigo_cliente AS codigo_cliente,
                COALESCE(k.nombre_cliente, '') AS nombre_cliente,
                ROUND(k.trans_cost, 4) AS costo_unitario,
                ROUND(k.trans_cost * k.cantidad_real, 4) AS costo_total,
                ROUND(((k.net_line_total + k.discount_amount) / NULLIF(k.cantidad_real, 0)) - k.trans_cost, 4) AS utilidad_unidad,
                ROUND(k.net_line_total - (k.trans_cost * k.cantidad_real), 4) AS utilidad_total,
                ROUND((k.net_line_total - (k.trans_cost * k.cantidad_real)) / NULLIF(k.net_line_total, 0) * 100, 2) AS pct_utilidad_neto,
                ROUND((k.net_line_total - (k.trans_cost * k.cantidad_real)) / NULLIF(k.trans_cost * k.cantidad_real, 0) * 100, 2) AS pct_utilidad_costo,
                f.empresa AS empresa,
                CASE WHEN f.empresa = 'ENV01' THEN 'ENV'
                     WHEN f.empresa = 'NVC01' THEN 'NOVICOMPU'
                     ELSE COALESCE(f.empresa, 'OTRO') END AS empresa_nombre,
                f.codigo_local AS sucursal,
                (f.codigo_local IN ('026','027')) AS es_mayorista,
                k.doc_id_corp AS doc_id_corp_kardex,
                f.doc_id_corp AS doc_id_corp_fact,
                k.anulada
            FROM (
                SELECT *,
                    -- Productos con serial (IMEI/serie): ORIGINAL_QTY del ERP es basura ahi,
                    -- la cantidad real es QUANTITY (confirmado contra el reporte oficial del
                    -- ERP: siempre muestra 1 por linea serializada). Sin serial: ORIGINAL_QTY
                    -- es la cantidad real y QUANTITY no sirve (casi siempre 1 sin importar cuanto se vendio).
                    ROUND(CASE
                        WHEN info_seriales IS NOT NULL AND info_seriales <> '' THEN quantity
                        WHEN original_qty > 0 THEN original_qty
                        ELSE quantity
                    END)::integer AS cantidad_real
                FROM ventas_kardex_staging
            ) k
            INNER JOIN ventas_facturas_staging f
                ON k.origin_ref = f.numero_factura
            WHERE k.origin_memo = 'CLIENTES'
              AND k.anulada = false
              AND f.anulada = false
              AND k.cantidad_real > 0;
            """
            connection.execute(text(sql_view_ventas))
            logging.info("Vista relacional SQL 'view_ventas_espejo_reporte' creada o actualizada.")
            
    except Exception as e:
        logging.error(f"Error al inicializar la base de datos PostgreSQL: {e}")
    yield
    logging.info("Apagando aplicación...")

from app.controllers import (
    health_controller,
    movimientos_controller,
    liquidaciones_controller,
    ats_controller,
    excel_controller,
    admin_controller,
    sync_controller,
    ventas_controller,
    estadisticas_controller
)

root_path = os.getenv("ROOT_PATH", "")
docs_user = os.getenv("DOCS_USER", "admin")
docs_password = os.getenv("DOCS_PASSWORD", "Adm1n2026$")

app = FastAPI(
    title="MBA3 BI Microservice",
    description="Python FastAPI Microservice constructed using SOLID principles.",
    version="1.0.0",
    root_path=root_path,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan
)

security = HTTPBasic()

def authenticate_docs(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, docs_user)
    correct_password = secrets.compare_digest(credentials.password, docs_password)
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas para ver la documentacion.",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

@app.get("/docs", include_in_schema=False)
async def get_swagger_documentation(username: str = Depends(authenticate_docs)):
    return get_swagger_ui_html(
        openapi_url="/openapi.json" if not root_path else f"{root_path}/openapi.json",
        title=app.title + " - Swagger UI",
    )

@app.get("/openapi.json", include_in_schema=False)
async def get_open_api_endpoint(username: str = Depends(authenticate_docs)):
    return get_openapi(title=app.title, version=app.version, routes=app.routes)

# Configurar middleware CORS
# En producción, se debe limitar allow_origins al host específico del frontend de Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar Controladores (Routers)
app.include_router(health_controller.router)
app.include_router(movimientos_controller.router)
app.include_router(liquidaciones_controller.router)
app.include_router(ats_controller.router)
app.include_router(excel_controller.router)
app.include_router(admin_controller.router)
app.include_router(sync_controller.router)
app.include_router(ventas_controller.router)
app.include_router(estadisticas_controller.router)

