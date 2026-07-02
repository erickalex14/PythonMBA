from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.controllers import (
    health_controller,
    movimientos_controller,
    liquidaciones_controller,
    ats_controller,
    excel_controller,
    admin_controller
)

app = FastAPI(
    title="MBA3 BI Microservice",
    description="Python FastAPI Microservice constructed using SOLID principles.",
    version="1.0.0"
)

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
