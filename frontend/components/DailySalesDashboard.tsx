import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./ui/Card";
import { FilterBar } from "./ui/FilterBar";
import { getMarcaFromProductName } from "../lib/marca";
import { getEmpresaLabel } from "../lib/empresa";
import { ChartTooltip, RankedBarChart } from "./charts/ChartPrimitives";
import NovbiSplash from "./NovbiSplash";

interface DailySalesDashboardProps {
  styles: Record<string, string>;
  onNavigate?: (
    tab: "ventas" | "movimientos" | "liquidaciones" | "ats",
    startDate: string,
    endDate: string,
    empresa?: string
  ) => void;
}

function ClickableCard({
  onClick,
  styles,
  children,
}: {
  onClick: () => void;
  styles: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.clickableCard} onClick={onClick}>
      {children}
      <div className={styles.clickableCardOverlay}>Ir al Reporte →</div>
    </div>
  );
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("es-EC", { style: "currency", currency: "USD" });
}

function fmtNumber(n: number): string {
  return n.toLocaleString("es-EC");
}

function rankBrandsByRevenue(rows: any[]): { marca: string; monto: number; percentage: number }[] {
  const map: Record<string, number> = {};
  rows.forEach((row: any) => {
    const marca = getMarcaFromProductName(row.producto || row.PRODUCTO);
    if (!marca) return;
    const val = Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
    map[marca] = (map[marca] || 0) + val;
  });
  const total = Object.values(map).reduce((acc, v) => acc + v, 0);
  return Object.entries(map)
    .map(([marca, monto]) => ({ marca, monto, percentage: total > 0 ? Math.round((monto / total) * 100) : 0 }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 8);
}

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function daysBefore(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

async function fetchRange(reportId: string, start: string, end: string): Promise<any[]> {
  const res = await fetch(`/api/data/${reportId}?inicio=${start}&fin=${end}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error consultando ${reportId}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

// Cache en memoria a nivel de módulo (no React state): el componente se
// desmonta/remonta cada vez que se cambia de pestaña, pero el módulo JS
// sigue cargado mientras dure la sesión. Tiene un TTL corto: Ventas es una
// tabla de staging que en este entorno de pruebas sigue recibiendo filas en
// tiempo real, así que un cache sin vencimiento se queda pegado a un
// snapshot cada vez más viejo (el fallback anclaba en enero cuando ya había
// datos de abril). Pasado el TTL se vuelve a pedir todo una vez, no en cada
// cambio de pestaña.
let dashboardCache: {
  data: any[];
  movData: any[];
  liqData: any[];
  atsData: any[];
  fetchedAt: number;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000;

const RANGE_DAYS = 7;
const MOV_RANGE_DAYS = 14;
const PERIOD_RANGE_DAYS = 60; // ventana de Liquidaciones/ATS (necesitan 60d para comparar 30 vs 30)
const FAST_RANGE_DAYS = 14;
const VENTAS_GENESIS_DATE = "2020-01-01"; // fecha de origen fija, previa a cualquier dato real posible

// Ventas viene de una tabla de staging sincronizada manualmente, no en vivo.
// En producción con sync regular, los últimos FAST_RANGE_DAYS ya alcanzan
// para encontrar "hoy" real - se pide esa ventana chica primero (rápido). Si
// la sincronización está atrasada, no tiene sentido adivinar el tamaño del
// atraso con ventanas cada vez más grandes: se pide directamente desde una
// fecha de origen fija hasta hoy, así siempre se encuentra el último día
// real con registros sin importar cuánto atraso tenga el sync.
async function fetchVentasAdaptive(): Promise<any[]> {
  const fastRows = await fetchRange("ventas", dateNDaysAgo(FAST_RANGE_DAYS - 1), dateNDaysAgo(0));
  const populatedDays = new Set(fastRows.map((r: any) => r.fecha || r.FECHA)).size;
  if (populatedDays >= 5) return fastRows;
  return fetchRange("ventas", VENTAS_GENESIS_DATE, dateNDaysAgo(0));
}

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function ComparisonMiniCard({
  title,
  currentLabel,
  previousLabel,
  currentValue,
  previousValue,
  formatter,
  styles,
}: {
  title: string;
  currentLabel: string;
  previousLabel: string;
  currentValue: number;
  previousValue: number;
  formatter: (n: number) => string;
  styles: Record<string, string>;
}) {
  const max = Math.max(currentValue, previousValue, 1);
  const pct = deltaPct(currentValue, previousValue);
  return (
    <Card variant="chartCard" styles={styles}>
      <h3>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
            <span>{currentLabel}</span>
            <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{formatter(currentValue)}</span>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: "var(--color-surface-subtle)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(currentValue / max) * 100}%`, background: "var(--color-chart-accent)", borderRadius: 6 }} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
            <span>{previousLabel}</span>
            <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{formatter(previousValue)}</span>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: "var(--color-surface-subtle)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(previousValue / max) * 100}%`, background: "var(--color-text-faint)", borderRadius: 6 }} />
          </div>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>
          {pct === null ? (
            "Sin datos del período anterior"
          ) : (
            <span style={{ color: pct >= 0 ? "var(--color-success-dark)" : "var(--color-danger)", fontWeight: 700 }}>
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(1)}%
            </span>
          )}{" "}
          vs. período anterior
        </span>
      </div>
    </Card>
  );
}

function isDashboardCacheFresh(): boolean {
  return !!dashboardCache && Date.now() - dashboardCache.fetchedAt < CACHE_TTL_MS;
}

export const DailySalesDashboard: React.FC<DailySalesDashboardProps> = ({ styles, onNavigate }) => {
  const [data, setData] = useState<any[]>(isDashboardCacheFresh() ? dashboardCache!.data : []);
  const [movData, setMovData] = useState<any[]>(isDashboardCacheFresh() ? dashboardCache!.movData : []);
  const [liqData, setLiqData] = useState<any[]>(isDashboardCacheFresh() ? dashboardCache!.liqData : []);
  const [atsData, setAtsData] = useState<any[]>(isDashboardCacheFresh() ? dashboardCache!.atsData : []);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  // Empieza en true desde el primer render (sin esperar al useEffect) para
  // que el splash cubra la pantalla desde el primer frame, sin dejar ver
  // el layout/dashboard vacío mientras el efecto todavía no dispara el fetch.
  // Si ya hay cache vigente de esta sesión, no hay nada que esperar.
  const [firstLoadDone, setFirstLoadDone] = useState(isDashboardCacheFresh());

  useEffect(() => {
    // El Dashboard se desmonta/remonta cada vez que se cambia de pestaña y se
    // vuelve - sin este cache, volvería a pedir todo (ventas/movimientos/
    // liquidaciones/ats) cada vez. Se reutiliza mientras siga vigente (ver
    // CACHE_TTL_MS); pasado eso, se vuelve a pedir todo una sola vez.
    if (isDashboardCacheFresh()) return;
    let cancelled = false;
    Promise.all([
      fetchVentasAdaptive(),
      fetchRange("movimientos", dateNDaysAgo(MOV_RANGE_DAYS - 1), dateNDaysAgo(0)),
      fetchRange("liquidaciones", dateNDaysAgo(PERIOD_RANGE_DAYS - 1), dateNDaysAgo(0)),
      fetchRange("ats", dateNDaysAgo(PERIOD_RANGE_DAYS - 1), dateNDaysAgo(0)),
    ])
      .then(([ventasRows, movRows, liqRows, atsRows]) => {
        if (cancelled) return;
        dashboardCache = { data: ventasRows, movData: movRows, liqData: liqRows, atsData: atsRows, fetchedAt: Date.now() };
        setData(ventasRows);
        setMovData(movRows);
        setLiqData(liqRows);
        setAtsData(atsRows);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || "Error al obtener la información desde el ERP.");
      })
      .finally(() => {
        if (!cancelled) setFirstLoadDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const empresaOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row: any) => { if (row.empresa) set.add(String(row.empresa).trim()); });
    return Array.from(set).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((row: any) => {
      if (selectedEmpresa && String(row.empresa || "").trim() !== selectedEmpresa) return false;
      return true;
    });
  }, [data, selectedEmpresa]);

  const fullDailyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach((row: any) => {
      const date = String(row.fecha || row.FECHA || "");
      if (!date) return;
      const val = Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      map[date] = (map[date] || 0) + val;
    });
    return map;
  }, [filteredData]);

  // "Hoy" real = el día más reciente con un volumen de ventas representativo,
  // no el día del reloj (la sincronización es manual y puede llevar semanas
  // de retraso) ni necesariamente el último día con CUALQUIER registro: tras
  // el último lote de sincronización real suelen quedar días sueltos con
  // montos mínimos (pruebas de sync, no ventas del día completo). Se ancla
  // al día más reciente cuyo total sea al menos 10% del máximo diario visto
  // en la ventana consultada, para no anclar en uno de esos días sueltos.
  const latestVentasDate = useMemo(() => {
    const entries = Object.entries(fullDailyTotals);
    if (entries.length === 0) return dateNDaysAgo(0);
    const maxTotal = Math.max(...entries.map(([, v]) => v));
    const threshold = maxTotal * 0.1;
    const validDates = entries.filter(([, v]) => v >= threshold).map(([d]) => d).sort();
    return validDates.length > 0 ? validDates[validDates.length - 1] : entries.map(([d]) => d).sort().slice(-1)[0];
  }, [fullDailyTotals]);

  const recentData = useMemo(() => {
    const windowStart = daysBefore(latestVentasDate, RANGE_DAYS - 1);
    return filteredData.filter((row: any) => {
      const date = String(row.fecha || row.FECHA || "");
      return date >= windowStart && date <= latestVentasDate;
    });
  }, [filteredData, latestVentasDate]);

  // Ventas por Empresa: a proposito NO respeta el filtro de Empresa (usa
  // `data` en vez de `filteredData`) - si se filtrara por empresa este
  // grafico siempre mostraria 100%/0%, perdiendo su sentido.
  const empresaSplit = useMemo(() => {
    const windowStart = daysBefore(latestVentasDate, RANGE_DAYS - 1);
    const map: Record<string, number> = {};
    data.forEach((row: any) => {
      const date = String(row.fecha || row.FECHA || "");
      if (date < windowStart || date > latestVentasDate) return;
      const label = getEmpresaLabel(row.codigo);
      const val = Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      map[label] = (map[label] || 0) + val;
    });
    return Object.entries(map)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [data, latestVentasDate]);

  // Ticket promedio = monto total / número de facturas únicas. Se compara
  // contra el período de 7 días anterior (ya viene en filteredData: el
  // fetch trae al menos 14 días incluso en el camino rápido).
  const previousPeriodData = useMemo(() => {
    const windowEnd = daysBefore(latestVentasDate, RANGE_DAYS);
    const windowStart = daysBefore(latestVentasDate, RANGE_DAYS * 2 - 1);
    return filteredData.filter((row: any) => {
      const date = String(row.fecha || row.FECHA || "");
      return date >= windowStart && date <= windowEnd;
    });
  }, [filteredData, latestVentasDate]);

  const avgTicket = (rows: any[]): number => {
    const facturas = new Set<string>();
    let total = 0;
    rows.forEach((row: any) => {
      total += Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      const f = row.factura_final || row.FACTURA_FINAL;
      if (f) facturas.add(String(f));
    });
    return facturas.size > 0 ? total / facturas.size : 0;
  };

  const avgTicketCurrent = useMemo(() => avgTicket(recentData), [recentData]);
  const avgTicketPrevious = useMemo(() => avgTicket(previousPeriodData), [previousPeriodData]);

  const totalsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    recentData.forEach((row: any) => {
      const date = row.fecha || row.FECHA;
      if (!date) return;
      const val = Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      map[date] = (map[date] || 0) + val;
    });
    return map;
  }, [recentData]);

  const today = latestVentasDate;
  const yesterday = daysBefore(latestVentasDate, 1);
  const isLatestRealToday = latestVentasDate === dateNDaysAgo(0);
  const totalToday = totalsByDay[today] || 0;
  const totalYesterday = totalsByDay[yesterday] || 0;
  const pctChange = totalYesterday > 0 ? ((totalToday - totalYesterday) / totalYesterday) * 100 : null;

  const total30d = useMemo(
    () => Object.values(totalsByDay).reduce((acc, v) => acc + v, 0),
    [totalsByDay]
  );
  const avgDaily = total30d / RANGE_DAYS;

  const dailySeries = useMemo(() => {
    const days: { date: string; total: number }[] = [];
    for (let i = RANGE_DAYS - 1; i >= 0; i--) {
      const date = daysBefore(latestVentasDate, i);
      days.push({ date, total: totalsByDay[date] || 0 });
    }
    return days;
  }, [totalsByDay, latestVentasDate]);

  const topProducts = useMemo(() => {
    const map: Record<string, number> = {};
    recentData.forEach((row: any) => {
      const key = row.producto || row.PRODUCTO || "Sin producto";
      const val = Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      map[key] = (map[key] || 0) + val;
    });
    return Object.entries(map)
      .map(([producto, total]) => ({ producto, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [recentData]);

  const todayData = useMemo(
    () => recentData.filter((row: any) => String(row.fecha || row.FECHA || "") === latestVentasDate),
    [recentData, latestVentasDate]
  );

  const topProductsToday = useMemo(() => {
    const map: Record<string, number> = {};
    todayData.forEach((row: any) => {
      const key = row.producto || row.PRODUCTO || "Sin producto";
      const val = Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      map[key] = (map[key] || 0) + val;
    });
    return Object.entries(map)
      .map(([producto, total]) => ({ producto, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [todayData]);

  // Movimientos: esta semana (últimos 7 días) vs. semana anterior
  const movWeekSplit = dateNDaysAgo(6);
  const movThisWeek = useMemo(
    () => movData.filter((r: any) => String(r.TRANS_DATE) >= movWeekSplit).length,
    [movData, movWeekSplit]
  );
  const movLastWeek = useMemo(
    () => movData.filter((r: any) => String(r.TRANS_DATE) < movWeekSplit).length,
    [movData, movWeekSplit]
  );

  // Liquidaciones y ATS: son procesos periódicos (no diarios) y casi nunca tienen
  // registros en el mes calendario actual todavía - comparar por mes calendario
  // (julio vs junio) siempre mostraba $0 en "este mes" aunque hubiera datos reales
  // recientes. Se usa una ventana móvil de 30 días en vez de mes calendario.
  const periodSplit = dateNDaysAgo(29);

  const liqLast30d = useMemo(
    () =>
      liqData
        .filter((r: any) => String(r.LIQUIDACION_FECHA) >= periodSplit)
        .reduce((acc: number, r: any) => acc + (Number(r.VALOR_TOTAL_CIF) || 0), 0),
    [liqData, periodSplit]
  );
  const liqPrev30d = useMemo(
    () =>
      liqData
        .filter((r: any) => String(r.LIQUIDACION_FECHA) < periodSplit)
        .reduce((acc: number, r: any) => acc + (Number(r.VALOR_TOTAL_CIF) || 0), 0),
    [liqData, periodSplit]
  );

  const atsLast30d = useMemo(
    () =>
      atsData
        .filter((r: any) => String(r.INVOICE_DATE) >= periodSplit && r.ES_ANULADO !== 1)
        .reduce((acc: number, r: any) => acc + (Number(r.INVOICE_TOTAL) || 0), 0),
    [atsData, periodSplit]
  );
  const atsPrev30d = useMemo(
    () =>
      atsData
        .filter((r: any) => String(r.INVOICE_DATE) < periodSplit && r.ES_ANULADO !== 1)
        .reduce((acc: number, r: any) => acc + (Number(r.INVOICE_TOTAL) || 0), 0),
    [atsData, periodSplit]
  );

  // Top Marcas viene de Ventas (no de Movimientos): Movimientos incluye
  // transferencias internas entre bodegas, no refleja lo que realmente
  // compran los clientes. Se busca el nombre de marca dentro del texto real
  // del producto vendido (ver lib/marca.ts).
  const topBrands = useMemo(() => rankBrandsByRevenue(recentData), [recentData]);
  const topBrandsToday = useMemo(() => rankBrandsByRevenue(todayData), [todayData]);

  if (!firstLoadDone) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#ffffff" }}>
        <NovbiSplash loop />
      </div>
    );
  }

  if (error) {
    return <div className={styles.errorAlert}>{error}</div>;
  }

  const maxDaily = Math.max(...dailySeries.map((d) => d.total), 1);

  const points = dailySeries.map((d, index) => {
    const x = dailySeries.length > 1 ? (index / (dailySeries.length - 1)) * 400 + 50 : 250;
    const y = 170 - (d.total / maxDaily) * 140;
    return { x, y };
  });
  const pathD = points.length > 0 ? `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}` : "";

  return (
    <div>
      <FilterBar
        fields={[
          {
            label: "Filtrar por Empresa",
            value: selectedEmpresa,
            onChange: setSelectedEmpresa,
            placeholder: "Todas las Empresas...",
            options: empresaOptions,
          },
        ]}
        styles={styles}
      />

      <p style={{ fontSize: "0.8rem", color: "var(--color-text-faint)", margin: "0 0 0.75rem" }}>
        Datos de ventas sincronizados al <strong>{latestVentasDate}</strong> (último día con registros)
      </p>

      <section className={styles.kpiGrid}>
        <ClickableCard styles={styles} onClick={() => onNavigate?.("ventas", today, today, selectedEmpresa)}>
          <Card variant="kpiCard" styles={styles}>
            <h3>{isLatestRealToday ? "Ventas Hoy" : "Ventas Último Registro"}</h3>
            <p className={styles.kpiValue}>{fmtCurrency(totalToday)}</p>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>
              {!isLatestRealToday && <>{today} · </>}
              {pctChange !== null ? (
                <span style={{ color: pctChange >= 0 ? "var(--color-success-dark)" : "var(--color-danger)", fontWeight: 700 }}>
                  {pctChange >= 0 ? "+" : ""}
                  {pctChange.toFixed(1)}%
                </span>
              ) : (
                `Sin datos del ${isLatestRealToday ? "ayer" : "día anterior"}`
              )}{" "}
              vs. {isLatestRealToday ? "ayer" : "día anterior"}
            </span>
          </Card>
        </ClickableCard>

        <ClickableCard styles={styles} onClick={() => onNavigate?.("ventas", yesterday, yesterday, selectedEmpresa)}>
          <Card variant="kpiCard" styles={styles}>
            <h3>{isLatestRealToday ? "Ventas Ayer" : "Ventas Día Anterior al Último Registro"}</h3>
            <p className={styles.kpiValue}>{fmtCurrency(totalYesterday)}</p>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>{yesterday}</span>
          </Card>
        </ClickableCard>

        <ClickableCard
          styles={styles}
          onClick={() => onNavigate?.("ventas", daysBefore(latestVentasDate, RANGE_DAYS - 1), today, selectedEmpresa)}
        >
          <Card variant="kpiCard" styles={styles} className={styles.kpiCardHighlight}>
            <h3>Total Últimos {RANGE_DAYS} Días</h3>
            <p className={styles.kpiValue}>{fmtCurrency(total30d)}</p>
            <span style={{ fontSize: "0.75rem" }}>
              Promedio diario: {fmtCurrency(avgDaily)}
            </span>
          </Card>
        </ClickableCard>
      </section>

      <section className={styles.chartsGrid}>
        <ClickableCard
          styles={styles}
          onClick={() => onNavigate?.("ventas", daysBefore(latestVentasDate, RANGE_DAYS - 1), today, selectedEmpresa)}
        >
        <Card variant="chartCard" styles={styles}>
          <h3>Tendencia Diaria de Ventas ({RANGE_DAYS} días)</h3>
          <div className={styles.svgContainer}>
            <svg viewBox="0 0 500 200" className={styles.svgChart}>
              <line x1="50" y1="170" x2="450" y2="170" stroke="var(--color-border)" strokeWidth="1" />

              {points.length > 0 && (
                <path d={pathD} fill="none" stroke="var(--color-chart-accent)" strokeWidth="2.5" strokeLinecap="round" />
              )}

              {dailySeries.length > 0 && (
                <>
                  <text x="50" y="184" textAnchor="start" fill="var(--color-text-faint)" fontSize="9">
                    {dailySeries[0].date.substring(5)}
                  </text>
                  <text x="450" y="184" textAnchor="end" fill="var(--color-text-faint)" fontSize="9">
                    {dailySeries[dailySeries.length - 1].date.substring(5)}
                  </text>
                </>
              )}

              {hoveredDay !== null && points[hoveredDay] && (
                <line
                  x1={points[hoveredDay].x}
                  y1={points[hoveredDay].y}
                  x2={points[hoveredDay].x}
                  y2="170"
                  stroke="var(--color-chart-accent)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.5"
                />
              )}

              {points.map((p, i) => (
                <circle
                  key={`dot-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredDay === i ? 6 : 4}
                  fill={hoveredDay === i ? "var(--color-chart-accent)" : "#ffffff"}
                  stroke="var(--color-chart-accent)"
                  strokeWidth={hoveredDay === i ? 2.5 : 2}
                  style={{ transition: "r 0.15s ease" }}
                />
              ))}

              {points.map((p, i) => (
                <circle
                  key={`hit-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredDay(i)}
                  onMouseLeave={() => setHoveredDay(null)}
                />
              ))}
            </svg>

            {hoveredDay !== null && points[hoveredDay] && (
              <ChartTooltip
                style={{
                  left: `${(points[hoveredDay].x / 500) * 100}%`,
                  top: `${(points[hoveredDay].y / 200) * 100}%`,
                  transform: "translate(-50%, -125%)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{dailySeries[hoveredDay].date}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-chart-accent)", display: "inline-block" }} />
                  Ventas: {fmtCurrency(dailySeries[hoveredDay].total)}
                </div>
              </ChartTooltip>
            )}
          </div>
        </Card>
        </ClickableCard>

        <ClickableCard
          styles={styles}
          onClick={() => onNavigate?.("ventas", daysBefore(latestVentasDate, RANGE_DAYS - 1), today, selectedEmpresa)}
        >
          <Card variant="chartCard" styles={styles}>
            <h3>Top Productos ({RANGE_DAYS} días)</h3>
            <RankedBarChart
              items={topProducts.map((p) => ({ label: p.producto, total: p.total }))}
              color="var(--color-chart-accent)"
              formatter={fmtCurrency}
            />
          </Card>
        </ClickableCard>

        <ClickableCard styles={styles} onClick={() => onNavigate?.("ventas", today, today, selectedEmpresa)}>
          <Card variant="chartCard" styles={styles}>
            <h3>Top Productos Diario ({today})</h3>
            <RankedBarChart
              items={topProductsToday.map((p) => ({ label: p.producto, total: p.total }))}
              color="var(--color-chart-accent)"
              formatter={fmtCurrency}
            />
          </Card>
        </ClickableCard>

      </section>

      <section className={styles.chartsGridTwo}>
        <ClickableCard
          styles={styles}
          onClick={() => onNavigate?.("ventas", daysBefore(latestVentasDate, RANGE_DAYS - 1), today, selectedEmpresa)}
        >
          <Card variant="chartCard" styles={styles}>
            <h3>Top Marcas (Ventas, {RANGE_DAYS} días)</h3>
            <RankedBarChart
              items={topBrands.map((b) => ({ label: b.marca, total: b.monto }))}
              color="var(--color-chart-accent)"
              formatter={fmtCurrency}
            />
          </Card>
        </ClickableCard>

        <ClickableCard styles={styles} onClick={() => onNavigate?.("ventas", today, today, selectedEmpresa)}>
          <Card variant="chartCard" styles={styles}>
            <h3>Top Marcas Diario ({today})</h3>
            <RankedBarChart
              items={topBrandsToday.map((b) => ({ label: b.marca, total: b.monto }))}
              color="var(--color-chart-accent)"
              formatter={fmtCurrency}
            />
          </Card>
        </ClickableCard>
      </section>

      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "2rem 0 1rem", color: "var(--color-text-primary)" }}>
        Indicadores Ejecutivos
      </h2>
      <section className={styles.chartsGridTwo}>
        <ClickableCard
          styles={styles}
          onClick={() => onNavigate?.("ventas", daysBefore(latestVentasDate, RANGE_DAYS - 1), today, "")}
        >
          <Card variant="chartCard" styles={styles}>
            <h3>Ventas por Empresa ({RANGE_DAYS} días)</h3>
            <RankedBarChart
              items={empresaSplit}
              color="var(--color-chart-accent)"
              formatter={fmtCurrency}
            />
          </Card>
        </ClickableCard>

        <ClickableCard
          styles={styles}
          onClick={() => onNavigate?.("ventas", daysBefore(latestVentasDate, RANGE_DAYS - 1), today, selectedEmpresa)}
        >
          <ComparisonMiniCard
            title="Ticket Promedio de Venta"
            currentLabel="Últimos 7 días"
            previousLabel="7 días anteriores"
            currentValue={avgTicketCurrent}
            previousValue={avgTicketPrevious}
            formatter={fmtCurrency}
            styles={styles}
          />
        </ClickableCard>
      </section>

      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "2rem 0 1rem", color: "var(--color-text-primary)" }}>
        Comparativa entre Módulos
      </h2>
      <section className={styles.chartsGrid}>
        <ClickableCard styles={styles} onClick={() => onNavigate?.("movimientos", movWeekSplit, dateNDaysAgo(0))}>
          <ComparisonMiniCard
            title="Movimientos de Inventario"
            currentLabel="Esta semana"
            previousLabel="Semana anterior"
            currentValue={movThisWeek}
            previousValue={movLastWeek}
            formatter={fmtNumber}
            styles={styles}
          />
        </ClickableCard>
        <ClickableCard styles={styles} onClick={() => onNavigate?.("liquidaciones", periodSplit, dateNDaysAgo(0))}>
          <ComparisonMiniCard
            title="Liquidaciones (Monto CIF)"
            currentLabel="Últimos 30 días"
            previousLabel="30 días anteriores"
            currentValue={liqLast30d}
            previousValue={liqPrev30d}
            formatter={fmtCurrency}
            styles={styles}
          />
        </ClickableCard>
        <ClickableCard styles={styles} onClick={() => onNavigate?.("ats", periodSplit, dateNDaysAgo(0))}>
          <ComparisonMiniCard
            title="ATS Compras (Facturado)"
            currentLabel="Últimos 30 días"
            previousLabel="30 días anteriores"
            currentValue={atsLast30d}
            previousValue={atsPrev30d}
            formatter={fmtCurrency}
            styles={styles}
          />
        </ClickableCard>
      </section>
    </div>
  );
};
