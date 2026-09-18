import datetime
import logging
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import verify_api_key
from app.dependencies import get_costos_bodega_service, get_mba3_repository
from app.dtos.costos_bodega import (CostosPorSucursalDTO, DetalleCostosDTO, EmpresaDTO,
                                    OpcionesFiltroDTO, SubBodegaDTO)
from app.repositories.mba3_repository import IMba3Repository
from app.services.costos_bodega_service import CORPS_SOPORTADOS, CostosBodegaService, CostosBodegaSyncService

router = APIRouter(prefix="/api/v1/costos-bodega", tags=["Costos de Inventario"])

CORP_PATTERN = "^(" + "|".join(CORPS_SOPORTADOS) + ")$"

# Estado de la sincronizacion en curso, en memoria (un solo proceso uvicorn,
# sin --workers -- ver Dockerfile). Antes el front solo podia ADIVINAR que ya
# habia terminado viendo si filas_procesadas dejaba de crecer por un par de
# minutos; esto le da una señal real de "termino" (y de paso evita que dos
# clicks/pestañas disparen dos sincronizaciones a la vez, ver el 409 abajo).
# Se resetea solo si el proceso se reinicia (nunca queda "en_curso" trabado
# de una corrida anterior al proceso).
_estado_sync: dict = {
    "en_curso": False,
    "iniciado_en": None,
    "terminado_en": None,
    "corps": None,
    "env": None,
    "error": None,
    "resultado": None,
}


@router.get("/empresas", response_model=List[EmpresaDTO], dependencies=[Depends(verify_api_key)])
def read_empresas(service: CostosBodegaService = Depends(get_costos_bodega_service)):
    """Empresas disponibles para filtrar (NVC01/ENV01)."""
    return service.obtener_empresas()


@router.get("", response_model=CostosPorSucursalDTO, dependencies=[Depends(verify_api_key)])
def read_costos_por_sucursal(
    corp: Optional[str] = Query(None, pattern=CORP_PATTERN, description="Filtra por empresa. Sin esto, junta todas."),
    service: CostosBodegaService = Depends(get_costos_bodega_service),
):
    """Costo de inventario por sucursal, leido del datawarehouse propio.

    NO consulta MBA3 en vivo (por eso responde rapido): reemplaza el reporte
    manual "Saldos y Costos Por Bodega" + VLOOKUP + SUMIF, cruzando lo que ya
    sincronizo /sincronizar. Si nunca se corrio una sincronizacion, devuelve
    el reporte vacio con `ultima_sincronizacion: null`.
    """
    return service.obtener_costos_por_sucursal(corp=corp)


@router.get("/opciones", response_model=OpcionesFiltroDTO, dependencies=[Depends(verify_api_key)])
def read_opciones_filtro(
    corp: Optional[str] = Query(None, pattern=CORP_PATTERN),
    service: CostosBodegaService = Depends(get_costos_bodega_service),
):
    """Bodegas Principales (primer selector) + grupo/marca para armar los
    filtros del detalle (pantalla "Costos por Sucursal", vista Detalle).

    Acotado a `corp` si se indica: las bodegas de una empresa no tienen por
    que aparecer como opcion al filtrar la otra. Las sub-bodegas de una
    Bodega Principal puntual se piden aparte, en GET /subbodegas -- dependen
    de cual principal se eligio primero.
    """
    return service.obtener_opciones_filtro(corp=corp)


@router.get("/subbodegas", response_model=List[SubBodegaDTO], dependencies=[Depends(verify_api_key)])
def read_subbodegas(
    corp: str = Query(..., pattern=CORP_PATTERN),
    bodega_principal: str = Query(..., description="Codigo de la Bodega Principal (de GET /opciones)"),
    service: CostosBodegaService = Depends(get_costos_bodega_service),
):
    """Sub-bodegas (WARE_CODE) de UNA Bodega Principal, segundo paso del
    filtro en dos niveles: primero se elige la principal (GET /opciones),
    despues se pueden ver/filtrar sus sub-bodegas con esto."""
    return service.obtener_subbodegas(corp=corp, bodega_principal=bodega_principal)


@router.get("/detalle", response_model=DetalleCostosDTO, dependencies=[Depends(verify_api_key)])
def read_detalle_costos(
    corp: Optional[str] = Query(None, pattern=CORP_PATTERN),
    bodega_principal: Optional[str] = Query(None, description="Codigo de Bodega Principal (de GET /opciones)"),
    sub_bodega: Optional[str] = Query(None, description="WARE_CODE puntual (de GET /subbodegas)"),
    grupo: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Busca por codigo o nombre de producto"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: CostosBodegaService = Depends(get_costos_bodega_service),
):
    """Detalle linea por linea (bodega x producto), filtrable y paginado --
    el equivalente a la hoja cruda del libro de Excel, ya cruzada contra
    bodegas y productos. Puede haber ~157k lineas: nunca se manda todo de
    una sola vez, `limit`/`offset` paginan (maximo 1000 por pagina)."""
    return service.obtener_detalle(corp=corp, bodega_principal=bodega_principal, sub_bodega=sub_bodega,
                                   grupo=grupo, marca=marca, q=q, limit=limit, offset=offset)


def _correr_sincronizacion(repository: IMba3Repository, env: Optional[str], corps: Optional[List[str]]) -> None:
    """Cuerpo real de la sincronizacion, para correr en background.

    Abre su PROPIA sesion de Postgres: la que inyecta `Depends(get_db)` en el
    request se cierra apenas se manda la respuesta, mucho antes de que esta
    tarea (que puede tardar 30-45 min POR EMPRESA en PRUEBAS) termine de usarla.

    SIEMPRE deja `_estado_sync["en_curso"] = False` al salir (exito o error)
    -- es la señal real que el front espera para saber que ya termino, en
    vez de adivinarlo viendo si filas_procesadas dejo de crecer.
    """
    db: Session = SessionLocal()
    try:
        resultado = CostosBodegaSyncService(repository).sincronizar(db, env, corps)
        logging.info(f"CostosBodegaSyncService: sincronizacion en background completa: {resultado}")
        _estado_sync.update({
            "en_curso": False, "terminado_en": datetime.datetime.utcnow().isoformat(),
            "error": None, "resultado": resultado,
        })
    except Exception as e:
        logging.error(f"CostosBodegaSyncService: sincronizacion en background fallo: {e}")
        _estado_sync.update({
            "en_curso": False, "terminado_en": datetime.datetime.utcnow().isoformat(),
            "error": str(e), "resultado": None,
        })
    finally:
        db.close()


@router.get("/sincronizar/estado", dependencies=[Depends(verify_api_key)])
def estado_sincronizacion():
    """Estado real de la ultima sincronizacion disparada desde este proceso
    (en memoria, ver `_estado_sync` -- un solo worker uvicorn, sin --workers).
    El front la sondea mientras `en_curso` es true para saber CUANDO termino
    de verdad (en vez de adivinarlo), y para deshabilitar el boton de
    sincronizar mientras tanto."""
    return _estado_sync


@router.post("/sincronizar", dependencies=[Depends(verify_api_key)])
def sincronizar_costos_bodega(
    background_tasks: BackgroundTasks,
    env: Optional[str] = Query(None, pattern="^(PRUEBAS|PROD)$",
                               description="Entorno del ERP. Por defecto, el del .env."),
    corp: Optional[str] = Query(None, pattern=CORP_PATTERN,
                                description="Sincroniza solo esta empresa. Sin esto, sincroniza todas (NVC01 y ENV01)."),
    repository: IMba3Repository = Depends(get_mba3_repository),
):
    """Dispara en background la sincronizacion de bodegas y saldos desde MBA3,
    para una empresa o para todas.

    Responde de inmediato: la sincronizacion real puede tardar 30-45 minutos
    POR EMPRESA en PRUEBAS (corta cada pagina en 3000 filas ignorando el
    limit pedido) o unos pocos minutos en PROD. Un POST que esperara esa
    respuesta chocaria con el timeout por defecto del fetch de Next.js/Node
    (~5 min, el mismo "fetch failed" que se vio al consultar MBA3 en vivo
    desde el reporte).

    Rechaza con 409 si ya hay una en curso (ver _estado_sync) -- dos
    sincronizaciones pisandose podrian dejar el barrido de una corrida
    borrando filas que la otra todavia no termino de escribir.

    Consultar GET /sincronizar/estado para saber si sigue en curso.
    """
    if _estado_sync["en_curso"]:
        raise HTTPException(status_code=409, detail="Ya hay una sincronización de Costos por Sucursal en curso.")

    _estado_sync.update({
        "en_curso": True, "iniciado_en": datetime.datetime.utcnow().isoformat(),
        "terminado_en": None, "corps": [corp] if corp else CORPS_SOPORTADOS, "env": env,
        "error": None, "resultado": None,
    })
    background_tasks.add_task(_correr_sincronizacion, repository, env, [corp] if corp else None)
    return {"status": "iniciado",
            "mensaje": "Sincronizacion en curso. Puede tardar varios minutos (o mas si son ambas empresas); "
                       "consulta el reporte mas tarde para ver los datos actualizados."}
