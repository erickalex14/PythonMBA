# Graph Report - .  (2026-07-28)

## Corpus Check
- 115 files · ~60,319 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 614 nodes · 1064 edges · 41 communities (35 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.63)
- Token cost: 323,531 input · 0 output

## Community Hubs (Navigation)
- Panel Dashboards & Chart Components
- Backend Sync Pipeline (ATS/Ventas/Movimientos/Liquidaciones)
- Frontend Dependencies (package.json)
- Frontend API Routes (admin/auth/data)
- Report Panel Pages & Shared UI
- Project Docs & Infra Config
- Backend Admin Config & DB Access
- Frontend TypeScript Config
- Profitability Charts (Rentabilidad)
- Daily Sales Dashboard
- Legacy Dashboard Server (Flask/standalone)
- Excel Export Controller
- Excel Report Generation Service
- Liquidaciones Service & MBA3 Repository
- Backend Controllers & Auth Dependencies
- Ventas Service & Controller
- Panel Layout, Splash & Sidebar
- Estadisticas Service & Controller
- ATS Service & Controller
- Movimientos Service & Controller
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

## God Nodes (most connected - your core abstractions)
1. `IMba3Repository` - 32 edges
2. `ExcelService` - 20 edges
3. `SyncService` - 19 edges
4. `compilerOptions` - 16 edges
5. `EstadisticasVentasService` - 14 edges
6. `VentasService` - 14 edges
7. `authOptions` - 14 edges
8. `AtsService` - 13 edges
9. `MovimientosService` - 13 edges
10. `usePanelReportPage()` - 13 edges

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

## Communities (41 total, 6 thin omitted)

### Community 0 - "Panel Dashboards & Chart Components"
Cohesion: 0.06
Nodes (38): AtsCharts(), AtsChartsProps, num(), CATEGORY_PALETTE, ChartTooltip(), DonutChart(), ExpandableChartCard(), ParetoChart() (+30 more)

### Community 1 - "Backend Sync Pipeline (ATS/Ventas/Movimientos/Liquidaciones)"
Cohesion: 0.07
Nodes (37): post, Endpoint administrativo para forzar la sincronización de movimientos de inventar, Endpoint administrativo para forzar la sincronización de movimientos (seriales), Endpoint administrativo para forzar la sincronización de liquidaciones (cabecera, Endpoint administrativo para forzar la sincronización de facturas, proveedores e, sync_ats(), sync_liquidaciones(), sync_movimientos() (+29 more)

### Community 2 - "Frontend Dependencies (package.json)"
Cohesion: 0.04
Nodes (46): bcryptjs, eslint, eslint-config-next, dependencies, bcryptjs, next, next-auth, pg (+38 more)

### Community 3 - "Frontend API Routes (admin/auth/data)"
Cohesion: 0.08
Nodes (18): checkAuth(), GET(), POST(), checkAuth(), DELETE(), GET(), POST(), PUT() (+10 more)

### Community 4 - "Report Panel Pages & Shared UI"
Cohesion: 0.15
Nodes (28): AtsPage(), EstadisticasVentasPage(), LiquidacionesPage(), LogsPage(), MovimientosPage(), VentasPage(), KPICards(), KPICardsProps (+20 more)

### Community 5 - "Project Docs & Infra Config"
Cohesion: 0.07
Nodes (35): Backend Python Dependencies, apscheduler, fastapi, openpyxl, pandas, psycopg2-binary, python-multipart, requests (+27 more)

### Community 6 - "Backend Admin Config & DB Access"
Cohesion: 0.08
Nodes (16): ABC, Settings, ConfigDTO, get_config(), BaseModel, get, post, Retorna la configuración actual del ERP MBA3 para pruebas y producción. (+8 more)

### Community 7 - "Frontend TypeScript Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 8 - "Profitability Charts (Rentabilidad)"
Cohesion: 0.18
Nodes (19): Agg, aggregate(), BodegaMargen(), DescuentoPorGrupo(), fmtMoney(), fmtMoney2(), fmtPct(), marginColor() (+11 more)

### Community 9 - "Daily Sales Dashboard"
Cohesion: 0.16
Nodes (16): ComparisonMiniCard(), DailySalesDashboard(), DailySalesDashboardProps, dateNDaysAgo(), daysBefore(), deltaPct(), fetchRange(), fetchVentasAdaptive() (+8 more)

### Community 10 - "Legacy Dashboard Server (Flask/standalone)"
Cohesion: 0.23
Nodes (19): download_excel_ats(), download_excel_liquidaciones(), download_excel_movimientos(), ejecutar_consulta_tabla(), generate_excel_file(), get_ats(), get_ats_df(), get_liquidaciones() (+11 more)

### Community 11 - "Excel Export Controller"
Cohesion: 0.14
Nodes (18): CustomExportRequest, download_ats(), download_estadisticas_ventas(), download_liquidaciones(), download_movimientos(), download_ventas(), export_custom_data(), BaseModel (+10 more)

### Community 12 - "Excel Report Generation Service"
Cohesion: 0.24
Nodes (10): _clean(), ExcelService, DataFrame, Servicio de Utilidad para la Generación de Archivos Excel.     Todos los reporte, Fallback genérico (sin encabezado/resumen/totales) para datos ad-hoc que no, Replica el reporte nativo "Estadisticas de Inventarios" del ERP: hoja principal, Renderer compartido de una sola hoja: crea su propio workbook y lo devuelve., Escribe UNA hoja con formato corporativo (encabezado, resumen, tabla, totales) (+2 more)

### Community 13 - "Liquidaciones Service & MBA3 Repository"
Cohesion: 0.13
Nodes (12): get, Obtiene el consolidado de liquidaciones y detalles de productos importados., read_liquidaciones(), get_liquidaciones_service(), get_mba3_repository(), Provee la implementación por defecto del Repositorio de MBA3., Provee el Servicio de Liquidaciones inyectando su dependencia del Repositorio., IMba3Repository (+4 more)

### Community 14 - "Backend Controllers & Auth Dependencies"
Cohesion: 0.23
Nodes (9): Inyección de Dependencia de FastAPI para validar el API Key de Next.js.     Aseg, verify_api_key(), get_ats_service(), get_estadisticas_service(), get_sync_service(), Provee el Servicio de ATS inyectando su dependencia del Repositorio., Provee el Servicio de Sincronización inyectando su dependencia del Repositorio., Provee el Servicio de Estadisticas de Ventas por producto. (+1 more)

### Community 15 - "Ventas Service & Controller"
Cohesion: 0.15
Nodes (11): get, Resumen agregado (hoy/ayer/semana/mes/año calendario + producto más     vendido, Obtiene la lista de transacciones del reporte de Ventas Espejo.     Requiere va, read_resumen_ventas(), read_ventas(), get_ventas_service(), Provee el Servicio de Ventas Espejo inyectando su dependencia del Repositorio., DataFrame (+3 more)

### Community 16 - "Panel Layout, Splash & Sidebar"
Cohesion: 0.21
Nodes (7): clamp01(), Easing, NovbiSplash(), NovbiSplashProps, tRange(), Sidebar(), SidebarProps

### Community 17 - "Estadisticas Service & Controller"
Cohesion: 0.25
Nodes (6): get, Reporte de Ventas: una fila por producto con unidades/total vendido en el     ra, read_estadisticas(), EstadisticasVentasService, DataFrame, Servicio para el Reporte de Ventas (Estadísticas de Inventario): una fila     po

### Community 18 - "ATS Service & Controller"
Cohesion: 0.29
Nodes (7): get, Obtiene la lista de transacciones del reporte de facturación fiscal ATS.     Req, read_ats(), AtsService, DataFrame, Servicio de Reglas de Negocio para el Reporte Fiscal ATS.     Cruza Facturas con, _to_bool()

### Community 19 - "Movimientos Service & Controller"
Cohesion: 0.20
Nodes (8): get, Obtiene la lista de movimientos de productos filtrados por rango de fechas., read_movimientos(), get_movimientos_service(), Provee el Servicio de Movimientos inyectando su dependencia del Repositorio., MovimientosService, DataFrame, Servicio de Reglas de Negocio para Movimientos de Productos.     Depende de la a

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

## Ambiguous Edges - Review These
- `docker-compose: backend service` → `Wrong PROD ERP service (SERIALES vs ERICKDEV)`  [AMBIGUOUS]
  contexto-sesion/resumen.md · relation: conceptually_related_to
- `Frontend Logo (logo.svg)` → `Python MBA Wordmark / Brand Identity`  [AMBIGUOUS]
  frontend/public/logo.svg · relation: conceptually_related_to

## Knowledge Gaps
- **119 isolated node(s):** `Config`, `Config`, `Config`, `Config`, `Config` (+114 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `docker-compose: backend service` and `Wrong PROD ERP service (SERIALES vs ERICKDEV)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Frontend Logo (logo.svg)` and `Python MBA Wordmark / Brand Identity`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `IMba3Repository` connect `Liquidaciones Service & MBA3 Repository` to `Backend Sync Pipeline (ATS/Ventas/Movimientos/Liquidaciones)`, `Backend Admin Config & DB Access`, `Backend Controllers & Auth Dependencies`, `Ventas Service & Controller`, `Estadisticas Service & Controller`, `ATS Service & Controller`, `Movimientos Service & Controller`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `ExcelService` connect `Excel Report Generation Service` to `Excel Export Controller`, `Backend Controllers & Auth Dependencies`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `SyncService` connect `Backend Sync Pipeline (ATS/Ventas/Movimientos/Liquidaciones)` to `Liquidaciones Service & MBA3 Repository`, `Backend Controllers & Auth Dependencies`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `IMba3Repository` (e.g. with `AtsService` and `EstadisticasVentasService`) actually correct?**
  _`IMba3Repository` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `SyncService` (e.g. with `LiquidacionPrincipalStaging` and `LiquidacionProductoStaging`) actually correct?**
  _`SyncService` has 4 INFERRED edges - model-reasoned connections that need verification._