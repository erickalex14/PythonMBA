import os
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.security import verify_api_key
from app.config import settings

router = APIRouter(prefix="/api/v1/admin/config", tags=["Admin / Configuración"])

class ConfigDTO(BaseModel):
    env: str # "PRUEBAS" | "PROD"
    base_url_test: str
    codigo_servicio_test: str
    password_servicio_test: str
    base_url_prod: str
    codigo_servicio_prod: str
    password_servicio_prod: str

def save_config_to_env(
    env_val: str,
    base_url_test: str,
    codigo_servicio_test: str,
    password_servicio_test: str,
    base_url_prod: str,
    codigo_servicio_prod: str,
    password_servicio_prod: str
):
    env_path = ".env"
    content = ""
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            content = f.read()
            
    updates = {
        "MBA3_ENV": env_val,
        "MBA3_BASE_URL": base_url_test,
        "MBA3_CODIGO_SERVICIO": codigo_servicio_test,
        "MBA3_PASSWORD_SERVICIO": password_servicio_test,
        "MBA3_BASE_URL_PROD": base_url_prod,
        "MBA3_CODIGO_SERVICIO_PROD": codigo_servicio_prod,
        "MBA3_PASSWORD_SERVICIO_PROD": password_servicio_prod
    }
    
    for key, val in updates.items():
        pattern = rf"^{key}\s*=.*$"
        new_line = f"{key}={val}"
        if re.search(pattern, content, re.MULTILINE):
            content = re.sub(pattern, new_line, content, flags=re.MULTILINE)
        else:
            if content and not content.endswith("\n"):
                content += "\n"
            content += new_line + "\n"
            
    with open(env_path, "w", encoding="utf-8") as f:
        f.write(content)

@router.get("", response_model=ConfigDTO, dependencies=[Depends(verify_api_key)])
def get_config():
    """
    Retorna la configuración actual del ERP MBA3 para pruebas y producción.
    """
    return ConfigDTO(
        env=settings.MBA3_ENV,
        base_url_test=settings.MBA3_BASE_URL_TEST,
        codigo_servicio_test=settings.MBA3_CODIGO_SERVICIO_TEST,
        password_servicio_test=settings.MBA3_PASSWORD_SERVICIO_TEST,
        base_url_prod=settings.MBA3_BASE_URL_PROD,
        codigo_servicio_prod=settings.MBA3_CODIGO_SERVICIO_PROD,
        password_servicio_prod=settings.MBA3_PASSWORD_SERVICIO_PROD
    )

@router.post("", dependencies=[Depends(verify_api_key)])
def update_config(payload: ConfigDTO):
    """
    Actualiza el entorno del ERP seleccionado en memoria y persiste todas las variables en .env.
    """
    try:
        env_val = payload.env.strip().upper()
        if env_val not in ["PRUEBAS", "PROD"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El entorno seleccionado debe ser PRUEBAS o PROD."
            )
            
        # 1. Actualizar configuración en memoria
        settings.MBA3_ENV = env_val
        settings.MBA3_BASE_URL_TEST = payload.base_url_test.strip()
        settings.MBA3_CODIGO_SERVICIO_TEST = payload.codigo_servicio_test.strip()
        settings.MBA3_PASSWORD_SERVICIO_TEST = payload.password_servicio_test.strip()
        
        settings.MBA3_BASE_URL_PROD = payload.base_url_prod.strip()
        settings.MBA3_CODIGO_SERVICIO_PROD = payload.codigo_servicio_prod.strip()
        settings.MBA3_PASSWORD_SERVICIO_PROD = payload.password_servicio_prod.strip()
        
        # 2. Guardar en el archivo .env
        save_config_to_env(
            settings.MBA3_ENV,
            settings.MBA3_BASE_URL_TEST,
            settings.MBA3_CODIGO_SERVICIO_TEST,
            settings.MBA3_PASSWORD_SERVICIO_TEST,
            settings.MBA3_BASE_URL_PROD,
            settings.MBA3_CODIGO_SERVICIO_PROD,
            settings.MBA3_PASSWORD_SERVICIO_PROD
        )
        
        return {"status": "ok", "message": "Configuración del entorno del ERP actualizada y persistida correctamente."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al persistir la configuración: {e}"
        )
