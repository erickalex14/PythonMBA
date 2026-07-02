from fastapi import APIRouter

router = APIRouter()

@router.get("/health", tags=["Health"])
def health_check():
    """
    Ruta básica para validación de estado de salud del servicio (liveness/readiness probe).
    """
    return {"status": "healthy", "service": "MBA3 BI Data Microservice"}
