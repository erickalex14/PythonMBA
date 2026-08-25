# Graph Report - Python MBA  (2026-08-25)

## Corpus Check
- 140 files · ~92,186 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 933 nodes · 1609 edges · 60 communities (51 shown, 9 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e4c365ac`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ChartPrimitives.tsx
- SyncService
- Frontend Dependencies (package.json)
- [...nextauth]/route.ts
- Report Panel Pages & Shared UI
- Project Docs & Infra Config
- Mba3Repository
- Frontend TypeScript Config
- RentabilidadCharts.tsx
- Daily Sales Dashboard
- dashboard_server.py
- Excel Export Controller
- ExcelService
- IMba3Repository
- dependencies.py
- VentasService
- Panel Layout, Splash & Sidebar
- EstadisticasVentasService
- ATS Service & Controller
- MovimientosService
- Login Page (NovBILogin)
- Ventas DTOs
- App Root Layout & Providers
- NextAuth Type Definitions
- Prisma Seed Script
- Health Check Endpoint
- ATS DTOs
- Estadisticas DTOs
- Liquidaciones DTOs
- Movimientos DTOs
- Auth Proxy Middleware
- Logo Asset (logo.svg)
- NOVBI Brand Logo (SVG)
- ESLint Config
- Next.js Config
- NOVBI Logo Asset (PNG)
- Novicompu El Recreo Logo
- pnpm esbuild Build Allowlist
- pnpm unrs-resolver Allowlist
- kpi_controller.py
- test_kpi_cumplimiento.py
- ._calcular_periodos
- kpi.py
- get
- ClienteFalso
- app/main.py
- cache.py
- admin_controller.py
- AtsFacturaStaging
- investigar_metas_kpi.py
- VentasFacturaStaging
- test_estadisticas_columnas.py
- metas/page.tsx
- test_hojas_top.py
- test_kpi_agregacion.py
- AGENTS.md
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `IMba3Repository` - 38 edges
2. `ExcelService` - 29 edges
3. `VentasService` - 22 edges
4. `SyncService` - 21 edges
5. `KpiService` - 19 edges
6. `Mba3Repository` - 17 edges
7. `authOptions` - 17 edges
8. `EstadisticasVentasService` - 16 edges
9. `compilerOptions` - 16 edges
10. `AtsService` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Next.js 16 breaking-changes warning (AGENTS.md)` --semantically_similar_to--> `middleware.ts to proxy.ts migration (Next.js 16)`  [INFERRED] [semantically similar]
  frontend/AGENTS.md → contexto-sesion/resumen.md
- `Next.js create-next-app Getting Started boilerplate` --semantically_similar_to--> `Frontend (Next.js 16, frontend/)`  [INFERRED] [semantically similar]
  frontend/README.md → contexto-sesion/resumen.md
- `sqlalchemy` --shares_data_with--> `docker-compose: db (Postgres 15)`  [INFERRED]
  Backend/requirements.txt → docker-compose.yml
- `psycopg2-binary` --shares_data_with--> `docker-compose: db (Postgres 15)`  [INFERRED]
  Backend/requirements.txt → docker-compose.yml
- `prisma (allowBuilds)` --shares_data_with--> `docker-compose: db (Postgres 15)`  [INFERRED]
  frontend/pnpm-workspace.yaml → docker-compose.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Session bugfix pass on MBA3 sales-sync pipeline** — contexto_sesion_resumen_origin_memo_bug, contexto_sesion_resumen_nan_infinity_bug, contexto_sesion_resumen_prod_service_bug [INFERRED 0.85]
- **Shared Postgres database access across backend and frontend** — docker_compose_db, docker_compose_backend, docker_compose_frontend [INFERRED 0.85]
- **Deployment and git workflow for MBA3 BI** — contexto_sesion_resumen_deploy_script, contexto_sesion_resumen_github_repo, contexto_sesion_resumen_git_dev_branch_issue [INFERRED 0.75]

## Communities (60 total, 9 thin omitted)

### Community 0 - "ChartPrimitives.tsx"
Cohesion: 0.05
Nodes (46): poppins, AtsCharts(), AtsChartsProps, IVA_COLOR, num(), CATEGORY_PALETTE, ChartTooltip(), ExpandableChartCard() (+38 more)

### Community 1 - "SyncService"
Cohesion: 0.23
Nodes (7): LiquidacionPrincipalStaging, LiquidacionProductoStaging, Base, MovimientoStaging, Base, Dias con datos y dias sin datos (huecos) por tipo de sincronizacion.          Ex, SyncService

### Community 2 - "Frontend Dependencies (package.json)"
Cohesion: 0.04
Nodes (48): bcryptjs, eslint, eslint-config-next, framer-motion, dependencies, bcryptjs, framer-motion, next (+40 more)

### Community 3 - "[...nextauth]/route.ts"
Cohesion: 0.06
Nodes (26): checkAuth(), GET(), POST(), checkAuth(), DELETE(), GET(), POST(), PUT() (+18 more)

### Community 4 - "Report Panel Pages & Shared UI"
Cohesion: 0.06
Nodes (61): AtsPage(), poppins, EstadisticasVentasPage(), poppins, LiquidacionesPage(), poppins, LogsPage(), poppins (+53 more)

### Community 5 - "Project Docs & Infra Config"
Cohesion: 0.07
Nodes (35): Backend Python Dependencies, apscheduler, fastapi, openpyxl, pandas, psycopg2-binary, python-multipart, requests (+27 more)

### Community 6 - "Mba3Repository"
Cohesion: 0.05
Nodes (29): ABC, Settings, get_db(), Mba3Repository, procesar_respuesta_erp(), Normaliza el entorno del ERP.      Antes, un valor no reconocido caia a `setting, Parser robusto para interceptar respuestas de error o ausencia de registros, Implementación concreta del repositorio utilizando la librería 'requests'     pa (+21 more)

### Community 7 - "Frontend TypeScript Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 8 - "RentabilidadCharts.tsx"
Cohesion: 0.15
Nodes (23): pct(), periodoActual(), poppins, SeguimientoKpiPage(), Agg, aggregate(), BodegaMargen(), DescuentoPorGrupo() (+15 more)

### Community 9 - "Daily Sales Dashboard"
Cohesion: 0.17
Nodes (17): ComparisonMiniCard(), DailySalesDashboard(), DailySalesDashboardProps, dateNDaysAgo(), daysBefore(), deltaPct(), fetchRange(), fetchVentasAdaptive() (+9 more)

### Community 10 - "dashboard_server.py"
Cohesion: 0.23
Nodes (19): download_excel_ats(), download_excel_liquidaciones(), download_excel_movimientos(), ejecutar_consulta_tabla(), generate_excel_file(), get_ats(), get_ats_df(), get_liquidaciones() (+11 more)

### Community 11 - "Excel Export Controller"
Cohesion: 0.14
Nodes (18): CustomExportRequest, download_ats(), download_estadisticas_ventas(), download_liquidaciones(), download_movimientos(), download_ventas(), export_custom_data(), BaseModel (+10 more)

### Community 12 - "ExcelService"
Cohesion: 0.14
Nodes (18): _clean(), ExcelService, DataFrame, Servicio de Utilidad para la Generación de Archivos Excel.     Todos los report, Fallback genérico (sin encabezado/resumen/totales) para datos ad-hoc que no, Replica el reporte nativo "Estadisticas de Inventarios" del ERP: hoja principal, Escribe el reporte ENCIMA del ultimo archivo que subio Contabilidad., Libro del Seguimiento KPI con el MISMO formato del archivo manual.          A (+10 more)

### Community 13 - "IMba3Repository"
Cohesion: 0.14
Nodes (12): get, Obtiene el consolidado de liquidaciones y detalles de productos importados., read_liquidaciones(), get_liquidaciones_service(), get_mba3_repository(), Provee la implementación por defecto del Repositorio de MBA3., Provee el Servicio de Liquidaciones inyectando su dependencia del Repositorio., IMba3Repository (+4 more)

### Community 14 - "dependencies.py"
Cohesion: 0.20
Nodes (11): Inyección de Dependencia de FastAPI para validar el API Key de Next.js.     Aseg, verify_api_key(), get_ats_service(), get_movimientos_service(), get_sync_service(), get_ventas_service(), Provee el Servicio de Movimientos inyectando su dependencia del Repositorio., Provee el Servicio de ATS inyectando su dependencia del Repositorio. (+3 more)

### Community 15 - "VentasService"
Cohesion: 0.19
Nodes (11): get, Dashboard de ventas en una sola llamada: totales por rango (hoy, ayer,     sema, Totales del rango con devoluciones desglosadas (con devoluciones, solo     devo, Resumen agregado (hoy/ayer/semana/mes/año calendario + producto más     vendido, Obtiene la lista de transacciones del reporte de Ventas Espejo.     Requiere va, read_dashboard_ventas(), read_resumen_ventas(), read_totales_ventas() (+3 more)

### Community 16 - "Panel Layout, Splash & Sidebar"
Cohesion: 0.08
Nodes (26): poppins, clamp01(), Easing, NovbiSplash(), NovbiSplashProps, tRange(), Sidebar(), SidebarProps (+18 more)

### Community 17 - "EstadisticasVentasService"
Cohesion: 0.17
Nodes (10): get, Reporte de Ventas: una fila por producto con unidades/total vendido en el     ra, read_estadisticas(), get_estadisticas_service(), Provee el Servicio de Estadisticas de Ventas por producto., EstadisticasVentasService, DataFrame, Por producto en el rango: unidades devueltas (UNID DEV) y ventas anuladas. (+2 more)

### Community 18 - "ATS Service & Controller"
Cohesion: 0.25
Nodes (7): get, Obtiene la lista de transacciones del reporte de facturación fiscal ATS.     Req, read_ats(), AtsService, DataFrame, Servicio de Reglas de Negocio para el Reporte Fiscal ATS.     Cruza Facturas con, _to_bool()

### Community 19 - "MovimientosService"
Cohesion: 0.22
Nodes (6): get, Obtiene la lista de movimientos de productos filtrados por rango de fechas., read_movimientos(), MovimientosService, DataFrame, Servicio de Reglas de Negocio para Movimientos de Productos.     Depende de la a

### Community 20 - "Login Page (NovBILogin)"
Cohesion: 0.28
Nodes (6): BAR_HEIGHTS, FEATURES, LINE_POINTS, NovBILogin(), validateCedula(), validatePassword()

### Community 21 - "Ventas DTOs"
Cohesion: 0.39
Nodes (7): Config, ProductoTopDTO, BaseModel, RangoFechasDTO, RangoResumenDTO, ResumenVentasDTO, VentasDTO

### Community 22 - "App Root Layout & Providers"
Cohesion: 0.40
Nodes (3): inter, metadata, Providers()

### Community 23 - "NextAuth Type Definitions"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 24 - "Prisma Seed Script"
Cohesion: 0.40
Nodes (3): adapter, pool, prisma

### Community 25 - "Health Check Endpoint"
Cohesion: 0.50
Nodes (3): health_check(), get, Ruta básica para validación de estado de salud del servicio (liveness/readiness

### Community 26 - "ATS DTOs"
Cohesion: 0.50
Nodes (3): AtsDTO, Config, BaseModel

### Community 27 - "Estadisticas DTOs"
Cohesion: 0.50
Nodes (3): Config, EstadisticasVentasDTO, BaseModel

### Community 28 - "Liquidaciones DTOs"
Cohesion: 0.50
Nodes (3): Config, LiquidacionDTO, BaseModel

### Community 29 - "Movimientos DTOs"
Cohesion: 0.50
Nodes (3): Config, MovimientoDTO, BaseModel

### Community 30 - "Auth Proxy Middleware"
Cohesion: 0.67
Nodes (3): authMiddleware, config, proxy()

### Community 31 - "Logo Asset (logo.svg)"
Cohesion: 0.67
Nodes (3): Frontend Public Assets Directory, Frontend Logo (logo.svg), Python MBA Wordmark / Brand Identity

### Community 32 - "NOVBI Brand Logo (SVG)"
Cohesion: 0.67
Nodes (3): NOVBI Logo, NOVBI (Brand/Wordmark), NOVBI.svg (Logo Image)

### Community 41 - "kpi_controller.py"
Cohesion: 0.08
Nodes (36): BodegaIn, download_kpi(), guardar_bodegas(), guardar_metas(), guardar_valores_manuales(), importar_excel(), MetaIn, BaseModel (+28 more)

### Community 42 - "test_kpi_cumplimiento.py"
Cohesion: 0.11
Nodes (20): _cumplimiento(), derivar_sucursal(), es_credito_directo(), _rango_periodo(), Decide si un pago 'Otros' es credito directo.      Valida contra la hoja D.CRE, Deduce a que tienda pertenece una bodega.      El nombre de la bodega de tiend, Ratio topado al peso.      Replica el IFS del Excel: por debajo de la meta pag, Trae el maestro de bodegas del ERP y recalcula el mapeo a sucursal.          N (+12 more)

### Community 43 - "._calcular_periodos"
Cohesion: 0.13
Nodes (14): DataFrame, Todo lo que necesita el dashboard de ventas en UNA llamada: totales por, Totales de un rango cualquiera con las devoluciones desglosadas, para los, Pasa el updated_at del staging a hora de Ecuador.          Los contenedores co, Cada rango del dashboard con el periodo anterior equivalente para comparar., Top de productos por cantidad y por dinero en cada rango, consolidado         (, Resumen agregado para las cards del dashboard (hoy/ayer/semana/mes/año,, Check de los periodos del dashboard de ventas: que cada rango compare contra un (+6 more)

### Community 44 - "kpi.py"
Cohesion: 0.17
Nodes (15): KpiBodega, KpiCobroCredito, KpiMeta, KpiPlantilla, KpiProductoCat, KpiSucursal, KpiValorManual, Base (+7 more)

### Community 45 - "get"
Cohesion: 0.18
Nodes (14): limpiar_cache(), get, post, Endpoint administrativo para forzar la sincronización de facturas, proveedores e, Borra TODO el cache (catálogo de productos, dashboard, totales de ventas...), Endpoint administrativo para forzar la sincronización de movimientos de inventar, Cobertura del staging por tipo: hasta qué día está sincronizado y qué días     d, Endpoint administrativo para forzar la sincronización de movimientos (seriales) (+6 more)

### Community 46 - "ClienteFalso"
Cohesion: 0.21
Nodes (7): ClienteFalso, Check del cache: guardar/leer, y sobre todo que si Redis no responde el servicio, Lo importante: con Redis caido devuelve None/False, nunca lanza excepcion., _reset(), test_guardar_y_leer(), test_invalidar_por_patron(), test_sin_redis_no_rompe()

### Community 47 - "app/main.py"
Cohesion: 0.24
Nodes (10): Sincroniza Movimientos/Liquidaciones/ATS/Ventas con los datos de AYER.     Corre, run_nightly_sync(), start_scheduler(), stop_scheduler(), authenticate_docs(), get_open_api_endpoint(), get_swagger_documentation(), lifespan() (+2 more)

### Community 48 - "cache.py"
Cohesion: 0.31
Nodes (10): Any, guardar(), invalidar(), memoizar(), obtener(), _obtener_cliente(), Cache de lectura sobre Redis.  Existe por una razon medida: el catalogo de produ, Cliente perezoso. Si la conexion falla una vez, deja de reintentar en cada     r (+2 more)

### Community 49 - "admin_controller.py"
Cohesion: 0.27
Nodes (9): ConfigDTO, get_config(), BaseModel, get, post, Retorna la configuración actual del ERP MBA3 para pruebas y producción., Actualiza el entorno del ERP seleccionado en memoria y persiste todas las variab, save_config_to_env() (+1 more)

### Community 50 - "AtsFacturaStaging"
Cohesion: 0.33
Nodes (7): AtsFacturaStaging, AtsFiscalStaging, AtsProveedorStaging, Base, Tabla de Staging para el Catálogo de Proveedores de ATS., Tabla de Staging para la Información Fiscal de Documentos de ATS., Tabla de Staging para Cabeceras de Facturas de Compras de ATS.

### Community 51 - "investigar_metas_kpi.py"
Cohesion: 0.31
Nodes (8): hipotesis(), leer_historico(), leer_metas(), main(), Descifra de donde salen las metas por KPI del reporte de Seguimiento.  Las metas, Metas declaradas en la hoja RESUMEN KPI: {(sucursal, kpi): meta}., {(sucursal, cat, mes): (unidades, monto)}, Candidatos a formula de la meta, a partir del historico.

### Community 52 - "VentasFacturaStaging"
Cohesion: 0.38
Nodes (5): Base, Tabla de Staging para Cabeceras de Facturas de Clientes (Ventas)., Tabla de Staging para Movimientos de Inventario del Kardex (Ventas)., VentasFacturaStaging, VentasKardexStaging

### Community 53 - "test_estadisticas_columnas.py"
Cohesion: 0.40
Nodes (4): no_dias(), Check de la logica nueva del reporte de Estadisticas de Inventarios: No. Dias (c, Misma formula que estadisticas_service.obtener_estadisticas., test_no_dias()

### Community 54 - "metas/page.tsx"
Cohesion: 0.40
Nodes (5): Celda, MetasKpiPage(), periodoActual(), poppins, VENTA_TIENDA

### Community 55 - "test_hojas_top.py"
Cohesion: 0.50
Nodes (4): main(), Check de la seleccion de las hojas Top contra el reporte de Contabilidad "01 AL, Misma seleccion que ExcelService: el top por unidades quita ruido, el de dolares, seleccionar_tops()

## Ambiguous Edges - Review These
- `docker-compose: backend service` → `Wrong PROD ERP service (SERIALES vs ERICKDEV)`  [AMBIGUOUS]
  contexto-sesion/resumen.md · relation: conceptually_related_to
- `Frontend Logo (logo.svg)` → `Python MBA Wordmark / Brand Identity`  [AMBIGUOUS]
  frontend/public/logo.svg · relation: conceptually_related_to

## Knowledge Gaps
- **161 isolated node(s):** `Config`, `Config`, `Config`, `Config`, `Config` (+156 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `docker-compose: backend service` and `Wrong PROD ERP service (SERIALES vs ERICKDEV)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Frontend Logo (logo.svg)` and `Python MBA Wordmark / Brand Identity`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `IMba3Repository` connect `IMba3Repository` to `SyncService`, `Mba3Repository`, `kpi_controller.py`, `dependencies.py`, `VentasService`, `EstadisticasVentasService`, `ATS Service & Controller`, `MovimientosService`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `KpiService` connect `kpi_controller.py` to `test_kpi_cumplimiento.py`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `ExcelService` connect `ExcelService` to `kpi_controller.py`, `Excel Export Controller`, `dependencies.py`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `IMba3Repository` (e.g. with `BodegaIn` and `MetaIn`) actually correct?**
  _`IMba3Repository` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `ExcelService` (e.g. with `CustomExportRequest` and `BodegaIn`) actually correct?**
  _`ExcelService` has 4 INFERRED edges - model-reasoned connections that need verification._