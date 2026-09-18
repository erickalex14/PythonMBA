import logging
import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import SessionLocal
from app.repositories.mba3_repository import Mba3Repository
from app.services.sync_service import SyncService

scheduler = BackgroundScheduler()


def run_nightly_sync():
    """
    Sincroniza Movimientos/Liquidaciones/ATS/Ventas con los datos de AYER.
    Corre a las 5am - a esa hora el dia anterior ya cerro por completo en el
    ERP, asi que se consolida en staging. El dia actual sigue resolviendose
    en tiempo real contra el ERP (ver ventas_service/movimientos_service),
    no hace falta sincronizarlo aqui.
    Siempre contra PROD: el staging es el espejo de produccion. Antes usaba
    el toggle PRUEBAS/PROD del panel de Admin (en memoria) y bastaba que
    alguien lo dejara en PRUEBAS para que la noche guardara los 3 movimientos
    de prueba como si fueran el dia real (paso el 15, 16 y 17 de septiembre
    de 2026: dias "sincronizados" con 3 filas en vez de ~7.000).
    """
    # Ventana de 3 dias, no solo ayer: si una noche el ERP estuvo caido, el
    # dia quedaba como hueco para siempre (nadie lo volvia a pedir). Repetir
    # un dia es idempotente (borra e inserta por dia) y el modo estricto no
    # toca el staging cuando el ERP no contesta.
    hoy = datetime.date.today()
    ayer = (hoy - datetime.timedelta(days=1)).isoformat()
    desde = (hoy - datetime.timedelta(days=3)).isoformat()
    logging.info(f"SyncScheduler: iniciando sincronizacion automatica de madrugada para {desde}..{ayer}")
    db = SessionLocal()
    try:
        service = SyncService(Mba3Repository())
        for nombre, fn in (
            ("movimientos", service.sync_movimientos),
            ("liquidaciones", service.sync_liquidaciones),
            ("ats", service.sync_ats),
            ("ventas", service.sync_ventas),
        ):
            try:
                resultado = fn(db, desde, ayer, env="PROD")
                logging.info(f"SyncScheduler [{nombre}]: {resultado.get('message', resultado)}")
            except Exception as exc:
                logging.error(f"SyncScheduler [{nombre}]: fallo la sincronizacion automatica: {exc}")
    finally:
        db.close()


def start_scheduler():
    if scheduler.running:
        return
    # timezone explicito (no depende del TZ del contenedor): Guayaquil es
    # donde vive el negocio, sin importar en que UTC corra el host Docker.
    scheduler.add_job(
        run_nightly_sync,
        # Dos pasadas: si a las 05:00 el ERP esta en backup/reinicio, la de
        # las 07:00 recupera el dia antes de que alguien abra el reporte.
        CronTrigger(hour="5,7", minute=0, timezone="America/Guayaquil"),
        id="sync_nocturno_diario",
        replace_existing=True,
    )
    scheduler.start()
    logging.info("SyncScheduler: job de sincronizacion de madrugada (05:00 y 07:00 America/Guayaquil) programado.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
