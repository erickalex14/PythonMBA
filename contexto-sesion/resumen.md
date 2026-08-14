# Contexto de sesión — MBA3 BI (Novicompu)

Última actualización: 2026-07-23. Carpeta local, NO trackeada en git (tiene IPs/nombres internos).

## Arquitectura

- **Backend**: FastAPI (`Backend/app/`), Postgres staging local, conecta al ERP MBA3 vía API REST propia.
- **Frontend**: Next.js 16 (`frontend/`), rutas reales por página bajo `app/panel/*` (ya no una sola página con tabs).
- **Deploy**: `deploy.py` (raíz, gitignorado, credenciales en `.env` raíz gitignorado) — SSH al VPS, sube archivos vía `git ls-files`, rebuild Docker Compose completo (`down` → `build --no-cache` → `up -d`), reescribe bloque nginx, recarga nginx.
- **Servidor prod**: `HOST-PROD-REDACTADO:PUERTO-REDACTADO` (SSH), stack en `/home/usuario-vps-redactado/novitec-stack/mba3-bi`.
- **Repo GitHub**: `erickalex14/PythonMBA`, público (portafolio) — ramas `main` y `dev`.

## ERP MBA3 — entornos y servicios

- **PRUEBAS**: `IP-ERP-PRUEBAS-REDACTADA:8020`, servicio `ERICKDEV` (usuario "Erick Chavarrea", nombre servicio "REPORTERIA").
- **PRODUCCIÓN**: `IP-ERP-PROD-REDACTADA:8081` (IP interna LAN — la IP pública `HOST-PROD-REDACTADO:8081` da hairpin NAT, nunca usar). Servicio activo: **`ERICKDEV`** (mismo código/pass que pruebas, `Er1ck2026$$`) — NO usar `SERIALES` (ese servicio no tiene habilitadas `INVT_Ficha_Principal`, `PROV_Liquidaciones_Principal`, `PROV_Factura_Principal`; ERICKDEV/REPORTERIA sí las tiene).
- Toggle activo en `Backend/.env` → `MBA3_ENV=PROD` (actualmente en PROD).
- Credenciales viven en `Backend/.env` (gitignorado), leídas por `app/config.py` (`settings.ACTIVE_*`).

## Bugs reales encontrados y arreglados esta sesión

1. **`ORIGIN_MEMO` faltante en el path tiempo-real** (`Backend/app/services/ventas_service.py`): el query en vivo a `INVT_Producto_Movimientos` no filtraba `ORIGIN_MEMO='CLIENTES'` como sí hace la vista SQL histórica — contaba transferencias de bodega como ventas. Inflaba "Ventas Hoy" 3x. **Arreglado.**
2. **`NaN`/`Infinity` no son JSON válido** (mismo archivo): división por cero en tiempo real generaba `NaN`, Starlette lo rechazaba con 500. Fix: sanea todo el DataFrame final (`.astype(object).where(notna, None)`) — OJO, `Series.where(cond, None)` sobre float64 NO guarda `None` solo, hay que castear a `object` primero.
3. **Servicio PROD equivocado**: estaba en `SERIALES`, se cambió a `ERICKDEV` (ver arriba).
4. **`middleware.ts` → `proxy.ts`**: Next.js 16 deprecó `middleware.ts`. El límite `proxyClientMaxBodySize` (100mb→300mb) en `next.config.ts` NUNCA se aplicaba porque el archivo seguía llamándose `middleware.ts`. Migrado con el codemod oficial (`npx @next/codemod@canary middleware-to-proxy .`).
5. **`client_max_body_size` de nginx** (50m default aaPanel) también bloqueaba Excel de rangos grandes — subido a 300m, ahora `deploy.py` lo fuerza en cada deploy (regex sobre el vhost conf).
6. **Credenciales hardcodeadas en 14 archivos trackeados** (deploy.py, scripts sueltos, Backend/scripts/*, consulta.json, dashboard_server.py) — refactorizados a leer de `.env`/`app.config.settings`. Historial de git purgado con `git-filter-repo` (múltiples pasadas, ver abajo).

## Scheduler automático (madrugada)

- `Backend/app/core/scheduler.py`: APScheduler in-process, corre **05:00 America/Guayaquil** todos los días, sincroniza el día de AYER (movimientos/liquidaciones/ats/ventas) usando el entorno activo (`MBA3_ENV`).
- **Confirmado que SÍ dispara** (verificado en logs del 2026-07-23 ~05:02am) pero **el sync falló completo** — timeout contra `IP-ERP-PROD-REDACTADA:8081` justo a esa hora. Sospecha: mantenimiento/backup nocturno del ERP a esa hora. **Pendiente**: confirmar con el cliente/admin del ERP si hay ventana de mantenimiento ~5am, y si es así mover el scheduler a otra hora (editar `CronTrigger(hour=5, minute=0, ...)` en `scheduler.py`).
- Nota aparte encontrada: la app nunca llama `logging.basicConfig()` — todos los `logging.info()` (incluida la confirmación de arranque del scheduler y los mensajes de éxito de cada sync) son invisibles en los logs (nivel INFO por debajo del default WARNING). Solo se ven los `logging.error()`. Pendiente de arreglar si se quiere auditoría completa (no urgente).

## Git — cuidado con la rama `dev`

- El otro dev (`jxsue-dev`) trabaja en `dev`. **Un `git pull` normal en una copia local vieja hace MERGE, no reemplaza** — si su local todavía tenía como ancestros los archivos ya purgados (deploy.py, scripts, secretos, código viejo de ventas_service sin los fixes), el merge los resucita aunque main y dev ya compartan un ancestro común real.
- Instrucción correcta para el otro dev antes de seguir trabajando:
  ```
  git fetch origin
  git reset --hard origin/main
  ```
  (guardar cambios locales sin pushear con `git stash` antes si los hay).
- Si vuelve a pasar: comparar `git diff --stat main origin/dev` — si aparecen archivos que ya sabemos borrados (deploy.py, scratch/, Backend/scripts/, *.rpt, *.md de docs internas) o reversiones en `Backend/app/services/ventas_service.py` / `estadisticas_service.py` / `scheduler.py`, es la misma reconciliación manual: identificar los commits GENUINAMENTE nuevos (`git log --oneline main..origin/dev`, mirar solo los de fecha más reciente / `git show <hash> --stat` para confirmar que solo tocan archivos de gráficos frontend), tomar esos archivos puntuales con `git checkout origin/dev -- <archivo>`, nunca mergear la rama completa. Después de reconciliar: `git push origin main:dev --force` para limpiar `dev` de nuevo.

## Archivos borrados del repo (y de TODO el historial vía git-filter-repo)

`scratch/`, `Backend/scratch/`, `Backend/scripts/`, `deploy.py` (sigue local, gitignorado), `deploy_files.py`, `Estructura_BD_MBA3.md`, `MBA3_Consulta_Externa_Guia.pdf`, `REPORTE FACTURAS ALINEADO 2026 CORP.rpt`, `walkthrough.md` (raíz y frontend/), `scalability_maintainability_report.md`. Todos agregados a `.gitignore` para que no se puedan volver a commitear por error.

## Pendiente / próximos pasos

- [ ] Confirmar ventana de mantenimiento del ERP ~5am y ajustar hora del scheduler si aplica.
- [ ] (Opcional) Agregar `logging.basicConfig(level=logging.INFO)` en `main.py` para que los syncs exitosos queden visibles en logs.
- [ ] Avisar de nuevo al dev del front sobre el flujo correcto de sync con `main` (`reset --hard`, no `pull`).
