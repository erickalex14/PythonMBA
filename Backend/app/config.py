import os
from dotenv import load_dotenv

# Cargar variables de entorno desde el archivo .env
# Busca en el directorio raíz o en el directorio donde se ejecuta el proceso
load_dotenv()

class Settings:
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "")
    
    # Conmutador de Entorno del ERP (PRUEBAS o PROD)
    MBA3_ENV: str = os.getenv("MBA3_ENV", "PRUEBAS")
    
    # Credenciales de conexión del ERP MBA3 PRUEBAS (Desarrollo)
    MBA3_BASE_URL_TEST: str = os.getenv("MBA3_BASE_URL", "")
    MBA3_CODIGO_SERVICIO_TEST: str = os.getenv("MBA3_CODIGO_SERVICIO", "")
    MBA3_PASSWORD_SERVICIO_TEST: str = os.getenv("MBA3_PASSWORD_SERVICIO", "")
    
    # Credenciales de conexión del ERP MBA3 PRODUCCIÓN
    MBA3_BASE_URL_PROD: str = os.getenv("MBA3_BASE_URL_PROD", "")
    MBA3_CODIGO_SERVICIO_PROD: str = os.getenv("MBA3_CODIGO_SERVICIO_PROD", "")
    MBA3_PASSWORD_SERVICIO_PROD: str = os.getenv("MBA3_PASSWORD_SERVICIO_PROD", "")
    
    @property
    def ACTIVE_BASE_URL(self) -> str:
        return self.MBA3_BASE_URL_PROD if self.MBA3_ENV == "PROD" else self.MBA3_BASE_URL_TEST

    @property
    def ACTIVE_CODIGO_SERVICIO(self) -> str:
        return self.MBA3_CODIGO_SERVICIO_PROD if self.MBA3_ENV == "PROD" else self.MBA3_CODIGO_SERVICIO_TEST

    @property
    def ACTIVE_PASSWORD_SERVICIO(self) -> str:
        return self.MBA3_PASSWORD_SERVICIO_PROD if self.MBA3_ENV == "PROD" else self.ACTIVE_PASSWORD_SERVICIO_TEST

    @property
    def ACTIVE_PASSWORD_SERVICIO_TEST(self) -> str:
        # Fallback helper para evitar recursiones circulares
        return self.MBA3_PASSWORD_SERVICIO_TEST

    @property
    def MBA3_URL_LOGIN(self) -> str:
        return f"{self.ACTIVE_BASE_URL}/ws2_mba3_serv_/login_servicio"
        
    @property
    def MBA3_URL_CONSULTA(self) -> str:
        return f"{self.ACTIVE_BASE_URL}/ws2_mba3_serv_Consultas_Externas_/"

settings = Settings()
