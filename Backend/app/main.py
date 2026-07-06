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
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Arrancando aplicación: Inicializando base de datos...")
    try:
        # 1. Crear tablas físicas
        Base.metadata.create_all(bind=engine)
        logging.info("Base de datos inicializada: tablas creadas correctamente.")
        
        # 2. Crear o actualizar la vista SQL de liquidaciones
        with engine.begin() as connection:
            sql_view_ddl = """
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
            connection.execute(text(sql_view_ddl))
            logging.info("Vista relacional SQL 'view_liquidaciones_reporte' creada o actualizada correctamente.")
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
    sync_controller
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

