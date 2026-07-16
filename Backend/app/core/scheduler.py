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
    Sincroniza Movimientos/Liquidaciones/ATS/Ventas con los datos de hoy.
    Usa el entorno ERP activo en settings.MBA3_ENV (ver app/config.py) - no
    fuerza un entorno especifico aqui, para que el toggle PRUEBAS/PROD del
    panel de Admin siga siendo la unica fuente de verdad.
    """
    hoy = datetime.date.today().isoformat()
    logging.info(f"SyncScheduler: iniciando sincronizacion nocturna automatica para {hoy}")
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
                resultado = fn(db, hoy, hoy, env=None)
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
        CronTrigger(hour=23, minute=15, timezone="America/Guayaquil"),
        id="sync_nocturno_diario",
        replace_existing=True,
    )
    scheduler.start()
    logging.info("SyncScheduler: job de sincronizacion nocturna (23:15 America/Guayaquil) programado.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
