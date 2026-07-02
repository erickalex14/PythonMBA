import uvicorn
from app.config import settings

if __name__ == "__main__":
    print("=========================================================")
    print("      INICIANDO MICROSERVICIO DE BI EMPRESARIAL (FASTAPI) ")
    print("=========================================================")
    print(f"Servidor escuchando en: http://{settings.HOST}:{settings.PORT}")
    print("=========================================================")
    
    # Ejecuta uvicorn apuntando al módulo 'app.main' y al objeto 'app'
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=False)
