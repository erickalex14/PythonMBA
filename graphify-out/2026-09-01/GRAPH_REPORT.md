# Graph Report - Python MBA  (2026-08-26)

## Corpus Check
- 141 files · ~95,055 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 980 nodes · 1666 edges · 72 communities (56 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e6f5eb67`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ChartPrimitives.tsx
- liquidacion.py
- Frontend Dependencies (package.json)
- [...nextauth]/route.ts
- estadisticas-ventas/page.tsx
- Project Docs & Infra Config
- KpiSyncVentas
- Frontend TypeScript Config
- RentabilidadCharts.tsx
- DailySalesDashboard.tsx
- dashboard_server.py
- Excel Export Controller
- ExcelService
- IMba3Repository
- dependencies.py
- VentasService
- Panel Layout, Splash & Sidebar
- EstadisticasVentasService
- AtsService
- MovimientosService
- Login Page (NovBILogin)
- Ventas DTOs
- App Root Layout & Providers
- NextAuth Type Definitions
- Prisma Seed Script
- Health Check Endpoint
- AtsDTO
- EstadisticasVentasDTO
- Liquidaciones DTOs
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
- DataFrame
- scheduler.py
- SyncService
- ClienteFalso
- BaseModel
- cache.py
- admin_controller.py
- models/ats.py
- investigar_metas_kpi.py
- Base
- test_estadisticas_columnas.py
- metas/page.tsx
- test_hojas_top.py
- test_kpi_agregacion.py
- AGENTS.md
- CLAUDE.md
- post
- Base
- config.py
- Mba3Repository
- get
- _resolver_env
- reporte_conciliacion_proveedores.py
- Session
- EstadisticasVentasCharts.tsx
- MovimientosCharts.tsx
- LiquidacionesCharts.tsx
- AtsCharts.tsx
- TrendLineAdvanced.tsx

## God Nodes (most connected - your core abstractions)
1. `IMba3Repository` - 26 edges
2. `ExcelService` - 24 edges
3. `KpiSyncVentas` - 23 edges
4. `VentasService` - 21 edges
5. `KpiService` - 19 edges
6. `SyncService` - 19 edges
7. `Mba3Repository` - 17 edges
8. `authOptions` - 17 edges
9. `EstadisticasVentasService` - 16 edges
10. `compilerOptions` - 16 edges

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

## Communities (72 total, 16 thin omitted)

### Community 0 - "ChartPrimitives.tsx"
Cohesion: 0.17
Nodes (10): CATEGORY_PALETTE, ParetoChart(), sliceTreemap(), smoothPath(), Treemap(), TREEMAP_SHADES, TreemapItem, useMeasuredWidth() (+2 more)

### Community 1 - "liquidacion.py"
Cohesion: 0.67
Nodes (3): LiquidacionPrincipalStaging, LiquidacionProductoStaging, Base

### Community 2 - "Frontend Dependencies (package.json)"
Cohesion: 0.04
Nodes (48): bcryptjs, eslint, eslint-config-next, framer-motion, dependencies, bcryptjs, framer-motion, next (+40 more)

### Community 3 - "[...nextauth]/route.ts"
Cohesion: 0.06
Nodes (26): checkAuth(), GET(), POST(), checkAuth(), DELETE(), GET(), POST(), PUT() (+18 more)

### Community 4 - "estadisticas-ventas/page.tsx"
Cohesion: 0.05
Nodes (62): poppins, AtsPage(), poppins, EstadisticasVentasPage(), poppins, LiquidacionesPage(), poppins, LogsPage() (+54 more)

### Community 5 - "Project Docs & Infra Config"
Cohesion: 0.07
Nodes (35): Backend Python Dependencies, apscheduler, fastapi, openpyxl, pandas, psycopg2-binary, python-multipart, requests (+27 more)

### Community 6 - "KpiSyncVentas"
Cohesion: 0.12
Nodes (14): KpiSyncVentas, Sincroniza el kardex y las facturas al schema propio del KPI.      Deliberadam, PRUEBAS corta en 3000 filas aunque el `limit` pida mas; PROD lo respeta., Parte un dia topado cortando el rango de `campo` a la mitad.          El ERP n, Consulta al ERP reintentando con token fresco.          Un backfill de meses t, Valores del maestro de bodegas por los que se puede partir un dia., ErpFalso, partir() (+6 more)

### Community 7 - "Frontend TypeScript Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 8 - "RentabilidadCharts.tsx"
Cohesion: 0.15
Nodes (23): pct(), periodoActual(), poppins, SeguimientoKpiPage(), Agg, aggregate(), BodegaMargen(), DescuentoPorGrupo() (+15 more)

### Community 9 - "DailySalesDashboard.tsx"
Cohesion: 0.17
Nodes (17): ComparisonMiniCard(), DailySalesDashboard(), DailySalesDashboardProps, dateNDaysAgo(), daysBefore(), deltaPct(), fetchRange(), fetchVentasAdaptive() (+9 more)

### Community 10 - "dashboard_server.py"
Cohesion: 0.23
Nodes (19): download_excel_ats(), download_excel_liquidaciones(), download_excel_movimientos(), ejecutar_consulta_tabla(), generate_excel_file(), get_ats(), get_ats_df(), get_liquidaciones() (+11 more)

### Community 11 - "Excel Export Controller"
Cohesion: 0.14
Nodes (18): CustomExportRequest, download_ats(), download_estadisticas_ventas(), download_liquidaciones(), download_movimientos(), download_ventas(), export_custom_data(), BaseModel (+10 more)

### Community 12 - "ExcelService"
Cohesion: 0.13
Nodes (18): _clean(), ExcelService, DataFrame, Servicio de Utilidad para la Generación de Archivos Excel.     Todos los report, Fallback genérico (sin encabezado/resumen/totales) para datos ad-hoc que no, Replica el reporte nativo "Estadisticas de Inventarios" del ERP: hoja principal, Escribe el reporte ENCIMA del ultimo archivo que subio Contabilidad., Libro del Seguimiento KPI con el MISMO formato del archivo manual.          A (+10 more)

### Community 13 - "IMba3Repository"
Cohesion: 0.14
Nodes (12): get, Obtiene el consolidado de liquidaciones y detalles de productos importados., read_liquidaciones(), get_liquidaciones_service(), get_mba3_repository(), Provee la implementación por defecto del Repositorio de MBA3., Provee el Servicio de Liquidaciones inyectando su dependencia del Repositorio., IMba3Repository (+4 more)

### Community 14 - "dependencies.py"
Cohesion: 0.21
Nodes (10): Inyección de Dependencia de FastAPI para validar el API Key de Next.js.     Aseg, verify_api_key(), get_ats_service(), get_estadisticas_service(), get_sync_service(), Provee el Servicio de ATS inyectando su dependencia del Repositorio., Provee el Servicio de Sincronización inyectando su dependencia del Repositorio., Provee el Servicio de Estadisticas de Ventas por producto. (+2 more)

### Community 15 - "VentasService"
Cohesion: 0.23
Nodes (13): get, Dashboard de ventas en una sola llamada: totales por rango (hoy, ayer,     sema, Totales del rango con devoluciones desglosadas (con devoluciones, solo     devo, Resumen agregado (hoy/ayer/semana/mes/año calendario + producto más     vendido, Obtiene la lista de transacciones del reporte de Ventas Espejo.     Requiere va, read_dashboard_ventas(), read_resumen_ventas(), read_totales_ventas() (+5 more)

### Community 16 - "Panel Layout, Splash & Sidebar"
Cohesion: 0.08
Nodes (26): poppins, clamp01(), Easing, NovbiSplash(), NovbiSplashProps, tRange(), Sidebar(), SidebarProps (+18 more)

### Community 17 - "EstadisticasVentasService"
Cohesion: 0.23
Nodes (7): get, Reporte de Ventas: una fila por producto con unidades/total vendido en el     ra, read_estadisticas(), EstadisticasVentasService, DataFrame, Por producto en el rango: unidades devueltas (UNID DEV) y ventas anuladas., Servicio para el Reporte de Ventas (Estadísticas de Inventario): una fila     po

### Community 18 - "AtsService"
Cohesion: 0.25
Nodes (7): get, Obtiene la lista de transacciones del reporte de facturación fiscal ATS.     Req, read_ats(), AtsService, DataFrame, Servicio de Reglas de Negocio para el Reporte Fiscal ATS.     Cruza Facturas con, _to_bool()

### Community 19 - "MovimientosService"
Cohesion: 0.12
Nodes (13): get, Obtiene la lista de movimientos de productos filtrados por rango de fechas., read_movimientos(), get_movimientos_service(), Provee el Servicio de Movimientos inyectando su dependencia del Repositorio., Config, MovimientoDTO, BaseModel (+5 more)

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

### Community 26 - "AtsDTO"
Cohesion: 0.50
Nodes (3): AtsDTO, Config, BaseModel

### Community 27 - "EstadisticasVentasDTO"
Cohesion: 0.50
Nodes (3): Config, EstadisticasVentasDTO, BaseModel

### Community 28 - "Liquidaciones DTOs"
Cohesion: 0.50
Nodes (3): Config, LiquidacionDTO, BaseModel

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
Cohesion: 0.09
Nodes (39): BodegaIn, download_kpi(), guardar_bodegas(), guardar_metas(), guardar_valores_manuales(), importar_excel(), MetaIn, get (+31 more)

### Community 42 - "test_kpi_cumplimiento.py"
Cohesion: 0.05
Nodes (37): _cumplimiento(), derivar_sucursal(), es_credito_directo(), _rango_periodo(), Decide si un pago 'Otros' es credito directo.      Valida contra la hoja D.CRE, Deduce a que tienda pertenece una bodega.      El nombre de la bodega de tiend, Ratio topado al peso.      Replica el IFS del Excel: por debajo de la meta pag, Trae el maestro de bodegas del ERP y recalcula el mapeo a sucursal.          N (+29 more)

### Community 44 - "scheduler.py"
Cohesion: 0.50
Nodes (3): Sincroniza Movimientos/Liquidaciones/ATS/Ventas con los datos de AYER.     Corre, run_nightly_sync(), start_scheduler()

### Community 45 - "SyncService"
Cohesion: 0.06
Nodes (46): limpiar_cache(), get, post, Endpoint administrativo para forzar la sincronización de facturas, proveedores e, Borra TODO el cache (catálogo de productos, dashboard, totales de ventas...), Endpoint administrativo para forzar la sincronización de movimientos de inventar, Cobertura del staging por tipo: hasta qué día está sincronizado y qué días     d, Endpoint administrativo para forzar la sincronización de movimientos (seriales) (+38 more)

### Community 46 - "ClienteFalso"
Cohesion: 0.21
Nodes (7): ClienteFalso, Check del cache: guardar/leer, y sobre todo que si Redis no responde el servicio, Lo importante: con Redis caido devuelve None/False, nunca lanza excepcion., _reset(), test_guardar_y_leer(), test_invalidar_por_patron(), test_sin_redis_no_rompe()

### Community 48 - "cache.py"
Cohesion: 0.31
Nodes (10): Any, guardar(), invalidar(), memoizar(), obtener(), _obtener_cliente(), Cache de lectura sobre Redis.  Existe por una razon medida: el catalogo de produ, Cliente perezoso. Si la conexion falla una vez, deja de reintentar en cada     r (+2 more)

### Community 49 - "admin_controller.py"
Cohesion: 0.27
Nodes (9): ConfigDTO, get_config(), BaseModel, get, post, Retorna la configuración actual del ERP MBA3 para pruebas y producción., Actualiza el entorno del ERP seleccionado en memoria y persiste todas las variab, save_config_to_env() (+1 more)

### Community 50 - "models/ats.py"
Cohesion: 0.32
Nodes (7): AtsFacturaStaging, AtsFiscalStaging, AtsProveedorStaging, Base, Tabla de Staging para el Catálogo de Proveedores de ATS., Tabla de Staging para la Información Fiscal de Documentos de ATS., Tabla de Staging para Cabeceras de Facturas de Compras de ATS.

### Community 51 - "investigar_metas_kpi.py"
Cohesion: 0.31
Nodes (8): hipotesis(), leer_historico(), leer_metas(), main(), Descifra de donde salen las metas por KPI del reporte de Seguimiento.  Las metas, Metas declaradas en la hoja RESUMEN KPI: {(sucursal, kpi): meta}., {(sucursal, cat, mes): (unidades, monto)}, Candidatos a formula de la meta, a partir del historico.

### Community 53 - "test_estadisticas_columnas.py"
Cohesion: 0.40
Nodes (4): no_dias(), Check de la logica nueva del reporte de Estadisticas de Inventarios: No. Dias (c, Misma formula que estadisticas_service.obtener_estadisticas., test_no_dias()

### Community 54 - "metas/page.tsx"
Cohesion: 0.40
Nodes (5): Celda, MetasKpiPage(), periodoActual(), poppins, VENTA_TIENDA

### Community 55 - "test_hojas_top.py"
Cohesion: 0.50
Nodes (4): main(), Check de la seleccion de las hojas Top contra el reporte de Contabilidad "01 AL, Misma seleccion que ExcelService: el top por unidades quita ruido, el de dolares, seleccionar_tops()

### Community 63 - "config.py"
Cohesion: 0.13
Nodes (4): Settings, get_db(), Busca en INVT_Ficha_Principal los campos de "ultima venta" del ERP. Hipotesis: U, Explora estructura+datos de tablas ERP (grupo PROVEEDORES) para diseñar reporte

### Community 65 - "Mba3Repository"
Cohesion: 0.18
Nodes (8): Mba3Repository, Implementación concreta del repositorio utilizando la librería 'requests'     pa, Lista los ORIGIN_MEMO reales (sin truncar) del kardex del ERP en un rango, para, Check del reintento ante HTTP 401 en Mba3Repository.ejecutar_consulta. Sin red:, RespuestaFalsa, test_no_reintenta_infinito_si_sigue_401(), test_reintenta_una_vez_tras_401(), Verifica un producto contra el ERP directo (no el staging), para separar "el sta

### Community 67 - "_resolver_env"
Cohesion: 0.25
Nodes (7): ABC, Normaliza el entorno del ERP.      Antes, un valor no reconocido caia a `setting, _resolver_env(), Un entorno de ERP mal escrito no debe terminar consultando PRODUCCION.  Antes, `, test_desconocido_falla(), test_por_defecto(), test_validos()

### Community 68 - "reporte_conciliacion_proveedores.py"
Cohesion: 0.27
Nodes (10): procesar_respuesta_erp(), Parser robusto para interceptar respuestas de error o ausencia de registros, consultar(), login(), main(), norm(), Reporte: facturas recibidas conciliadas con transferencias bancarias. Cruce PROV, Normaliza llaves de cruce: quita .0 de floats, espacios, mayusculas. (+2 more)

### Community 70 - "EstadisticasVentasCharts.tsx"
Cohesion: 0.19
Nodes (8): ExpandableChartCard(), EstadisticasVentasCharts(), fmtMoney(), fmtNumber(), Props, Card(), CardProps, CardVariant

### Community 71 - "MovimientosCharts.tsx"
Cohesion: 0.21
Nodes (10): RadialGauge(), DevolucionesDonut(), DevolucionesDonutProps, DonutSegment, fmtNumber(), MovimientosCharts(), MovimientosChartsProps, normalizeMemo() (+2 more)

### Community 72 - "LiquidacionesCharts.tsx"
Cohesion: 0.18
Nodes (7): ScatterXY(), TwoBarComparison(), EMPRESA_COLOR, EMPRESA_COLOR_FALLBACK, LiquidacionesCharts(), LiquidacionesChartsProps, num()

### Community 73 - "AtsCharts.tsx"
Cohesion: 0.22
Nodes (6): AtsCharts(), AtsChartsProps, IVA_COLOR, num(), RankedBarChart(), TierHeading()

### Community 74 - "TrendLineAdvanced.tsx"
Cohesion: 0.50
Nodes (4): ChartTooltip(), TrendLineAdvanced(), TrendLineAdvancedProps, useMeasuredWidth()

## Ambiguous Edges - Review These
- `docker-compose: backend service` → `Wrong PROD ERP service (SERIALES vs ERICKDEV)`  [AMBIGUOUS]
  contexto-sesion/resumen.md · relation: conceptually_related_to
- `Frontend Logo (logo.svg)` → `Python MBA Wordmark / Brand Identity`  [AMBIGUOUS]
  frontend/public/logo.svg · relation: conceptually_related_to

## Knowledge Gaps
- **161 isolated node(s):** `TotalesEmpresa`, `KPICardsProps`, `SyncSectionProps`, `CoberturaTipo`, `ETIQUETAS_TIPO` (+156 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `docker-compose: backend service` and `Wrong PROD ERP service (SERIALES vs ERICKDEV)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Frontend Logo (logo.svg)` and `Python MBA Wordmark / Brand Identity`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `KpiSyncVentas` connect `KpiSyncVentas` to `kpi_controller.py`, `test_kpi_cumplimiento.py`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `ExcelService` connect `ExcelService` to `Excel Export Controller`, `dependencies.py`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `VentasService` connect `VentasService` to `kpi_controller.py`, `test_kpi_cumplimiento.py`, `Excel Export Controller`, `ExcelService`, `dependencies.py`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `IMba3Repository` (e.g. with `AtsService` and `EstadisticasVentasService`) actually correct?**
  _`IMba3Repository` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `KpiSyncVentas` (e.g. with `BodegaIn` and `MetaIn`) actually correct?**
  _`KpiSyncVentas` has 4 INFERRED edges - model-reasoned connections that need verification._