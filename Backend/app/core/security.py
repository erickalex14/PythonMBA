from fastapi import Depends, HTTPException, status
from fastapi.security.api_key import APIKeyHeader
from app.config import settings

API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def verify_api_key(header_value: str = Depends(api_key_header)):
    """
    Inyección de Dependencia de FastAPI para validar el API Key de Next.js.
    Asegura que el microservicio de datos no pueda ser accedido por agentes externos sin autorización.
    """
    if header_value == settings.INTERNAL_API_KEY:
        return header_value
        
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Credenciales de API Key no válidas para acceder a este microservicio de datos."
    )
