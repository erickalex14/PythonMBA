import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./ui/Card";
import { FilterBar } from "./ui/FilterBar";
import { getEmpresaLabel } from "../lib/empresa";
import { getMarcaFromProductName } from "../lib/marca";
import NovbiSplash from "./NovbiSplash";

interface DailySalesDashboardProps {
  styles: Record<string, string>;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("es-EC", { style: "currency", currency: "USD" });
}

function fmtNumber(n: number): string {
  return n.toLocaleString("es-EC");
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

const RANGE_DAYS = 7;
const MOV_RANGE_DAYS = 14;
const PERIOD_RANGE_DAYS = 60; // ventana de Liquidaciones/ATS (necesitan 60d para comparar 30 vs 30)
const FAST_RANGE_DAYS = 14;
const VENTAS_FALLBACK_DAYS = 45; // suficiente margen sobre el atraso de sync conocido, sin pedir los 60d completos

// Ventas viene de una tabla de staging sincronizada manualmente, no en vivo.
// En producción con sync regular, los últimos FAST_RANGE_DAYS ya alcanzan
// para encontrar "hoy" real - se pide esa ventana chica primero (rápido). Si
// la sincronización está atrasada (pocos días con datos en esa ventana, como
// pasa en este entorno de pruebas), se amplía recién ahí, en vez de pedir
// siempre la ventana grande "por si acaso".
async function fetchVentasAdaptive(): Promise<any[]> {
  const fastRows = await fetchRange("ventas", dateNDaysAgo(FAST_RANGE_DAYS - 1), dateNDaysAgo(0));
  const populatedDays = new Set(fastRows.map((r: any) => r.fecha || r.FECHA)).size;
  if (populatedDays >= 5) return fastRows;
  return fetchRange("ventas", dateNDaysAgo(VENTAS_FALLBACK_DAYS - 1), dateNDaysAgo(0));
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
            <div style={{ height: "100%", width: `${(currentValue / max) * 100}%`, background: "var(--color-brand-primary)", borderRadius: 6 }} />
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
            <span style={{ color: pct >= 0 ? "var(--color-brand-accent)" : "var(--color-danger)", fontWeight: 700 }}>
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

export const DailySalesDashboard: React.FC<DailySalesDashboardProps> = ({ styles }) => {
  const [data, setData] = useState<any[]>([]);
  const [movData, setMovData] = useState<any[]>([]);
  const [liqData, setLiqData] = useState<any[]>([]);
  const [atsData, setAtsData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  // Empieza en true desde el primer render (sin esperar al useEffect) para
  // que el splash cubra la pantalla desde el primer frame, sin dejar ver
  // el layout/dashboard vacío mientras el efecto todavía no dispara el fetch.
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchVentasAdaptive(),
      fetchRange("movimientos", dateNDaysAgo(MOV_RANGE_DAYS - 1), dateNDaysAgo(0)),
      fetchRange("liquidaciones", dateNDaysAgo(PERIOD_RANGE_DAYS - 1), dateNDaysAgo(0)),
      fetchRange("ats", dateNDaysAgo(PERIOD_RANGE_DAYS - 1), dateNDaysAgo(0)),
    ])
      .then(([ventasRows, movRows, liqRows, atsRows]) => {
        if (cancelled) return;
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
    data.forEach((row: any) => set.add(getEmpresaLabel(row.codigo)));
    return Array.from(set).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((row: any) => {
      if (selectedEmpresa && getEmpresaLabel(row.codigo) !== selectedEmpresa) return false;
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
  const topBrands = useMemo(() => {
    const map: Record<string, number> = {};
    recentData.forEach((row: any) => {
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
  }, [recentData]);

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
  const maxProduct = Math.max(...topProducts.map((p) => p.total), 1);
  const maxProductToday = Math.max(...topProductsToday.map((p) => p.total), 1);

  const points = dailySeries.map((d, index) => {
    const x = dailySeries.length > 1 ? (index / (dailySeries.length - 1)) * 400 + 50 : 250;
    const y = 170 - (d.total / maxDaily) * 140;
    return { x, y };
  });
  const pathD = points.length > 0 ? `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}` : "";
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`
    : "";

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
        <Card variant="kpiCard" styles={styles}>
          <h3>Ventas Hoy</h3>
          <p className={styles.kpiValue}>{fmtCurrency(totalToday)}</p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>
            {pctChange !== null ? (
              <span style={{ color: pctChange >= 0 ? "var(--color-brand-accent)" : "var(--color-danger)", fontWeight: 700 }}>
                {pctChange >= 0 ? "+" : ""}
                {pctChange.toFixed(1)}%
              </span>
            ) : (
              "Sin datos de ayer"
            )}{" "}
            vs. ayer
          </span>
        </Card>

        <Card variant="kpiCard" styles={styles}>
          <h3>Ventas Ayer</h3>
          <p className={styles.kpiValue}>{fmtCurrency(totalYesterday)}</p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>{yesterday}</span>
        </Card>

        <Card variant="kpiCard" styles={styles}>
          <h3>Total Últimos {RANGE_DAYS} Días</h3>
          <p className={styles.kpiValue}>{fmtCurrency(total30d)}</p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>
            Promedio diario: {fmtCurrency(avgDaily)}
          </span>
        </Card>
      </section>

      <section className={styles.chartsGrid}>
        <Card variant="chartCard" styles={styles}>
          <h3>Tendencia Diaria de Ventas ({RANGE_DAYS} días)</h3>
          <div className={styles.svgContainer}>
            <svg viewBox="0 0 500 200" className={styles.svgChart}>
              <defs>
                <linearGradient id="areaGradSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                <line key={i} x1="50" y1={170 - p * 140} x2="470" y2={170 - p * 140} stroke="var(--color-surface-subtle)" strokeWidth="1" />
              ))}

              {points.length > 0 && (
                <>
                  <path d={areaD} fill="url(#areaGradSales)" />
                  <path d={pathD} fill="none" stroke="var(--color-brand-primary)" strokeWidth="2.5" strokeLinecap="round" />
                </>
              )}

              <line x1="50" y1="170" x2="470" y2="170" stroke="var(--color-border-strong)" strokeWidth="1" />
              <line x1="50" y1="30" x2="50" y2="170" stroke="var(--color-border-strong)" strokeWidth="1" />

              <text x="42" y="173" textAnchor="end" fill="var(--color-text-faint)" fontSize="8">$0</text>
              <text x="42" y="34" textAnchor="end" fill="var(--color-text-faint)" fontSize="8">
                {fmtCurrency(maxDaily)}
              </text>
              {dailySeries.length > 0 && (
                <>
                  <text x="50" y="184" textAnchor="middle" fill="var(--color-text-faint)" fontSize="8">
                    {dailySeries[0].date.substring(5)}
                  </text>
                  <text x="470" y="184" textAnchor="middle" fill="var(--color-text-faint)" fontSize="8">
                    {dailySeries[dailySeries.length - 1].date.substring(5)}
                  </text>
                </>
              )}
            </svg>
          </div>
        </Card>

        <Card variant="chartCard" styles={styles}>
          <h3>Top Productos ({RANGE_DAYS} días)</h3>
          <div className={styles.svgContainer}>
            <svg viewBox="0 0 500 200" className={styles.svgChart}>
              {topProducts.map((p, index) => {
                const y = index * 22 + 15;
                const barWidth = (p.total / maxProduct) * 310;
                const opacity = 0.45 + (p.total / maxProduct) * 0.55;
                return (
                  <g key={index}>
                    <text x="5" y={y + 11} fill="var(--color-text-tertiary)" fontSize="9" fontWeight="600">
                      {p.producto.substring(0, 11)}
                    </text>
                    <rect x="90" y={y} width="320" height="13" rx="4" fill="var(--color-surface-subtle)" />
                    <rect x="90" y={y} width={barWidth} height="13" rx="4" fill="var(--color-brand-primary)" fillOpacity={opacity} />
                    <text x={95 + barWidth} y={y + 11} fill="var(--color-text-tertiary)" fontSize="8.5" fontWeight="700">
                      {fmtCurrency(p.total)}
                    </text>
                  </g>
                );
              })}
              {topProducts.length === 0 && (
                <text x="250" y="100" textAnchor="middle" fill="var(--color-text-faint)" fontSize="10">
                  Sin datos en el período
                </text>
              )}
            </svg>
          </div>
        </Card>

        <Card variant="chartCard" styles={styles}>
          <h3>Top Productos Diario ({today})</h3>
          <div className={styles.svgContainer}>
            <svg viewBox="0 0 500 200" className={styles.svgChart}>
              {topProductsToday.map((p, index) => {
                const y = index * 22 + 15;
                const barWidth = (p.total / maxProductToday) * 310;
                const opacity = 0.45 + (p.total / maxProductToday) * 0.55;
                return (
                  <g key={index}>
                    <text x="5" y={y + 11} fill="var(--color-text-tertiary)" fontSize="9" fontWeight="600">
                      {p.producto.substring(0, 11)}
                    </text>
                    <rect x="90" y={y} width="320" height="13" rx="4" fill="var(--color-surface-subtle)" />
                    <rect x="90" y={y} width={barWidth} height="13" rx="4" fill="var(--color-brand-accent)" fillOpacity={opacity} />
                    <text x={95 + barWidth} y={y + 11} fill="var(--color-text-tertiary)" fontSize="8.5" fontWeight="700">
                      {fmtCurrency(p.total)}
                    </text>
                  </g>
                );
              })}
              {topProductsToday.length === 0 && (
                <text x="250" y="100" textAnchor="middle" fill="var(--color-text-faint)" fontSize="10">
                  Sin datos en el período
                </text>
              )}
            </svg>
          </div>
        </Card>

        <Card variant="chartCard" styles={styles}>
          <h3>Top Marcas (Ventas, {RANGE_DAYS} días)</h3>
          <div className={styles.branchProgressList}>
            {topBrands.map((b, index) => (
              <div key={index} className={styles.branchProgressItem}>
                <div className={styles.branchMetaInfo}>
                  <span className={styles.branchName}>{b.marca}</span>
                  <span className={styles.branchQty}>
                    {fmtCurrency(b.monto)} ({b.percentage}%)
                  </span>
                </div>
                <div className={styles.branchProgressBarBg}>
                  <div className={styles.branchProgressBarFill} style={{ width: `${b.percentage}%` }}></div>
                </div>
              </div>
            ))}
            {topBrands.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-faint)" }}>Sin datos en el período</p>
            )}
          </div>
        </Card>
      </section>

      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "2rem 0 1rem", color: "var(--color-text-primary)" }}>
        Comparativa entre Módulos
      </h2>
      <section className={styles.chartsGrid}>
        <ComparisonMiniCard
          title="Movimientos de Inventario"
          currentLabel="Esta semana"
          previousLabel="Semana anterior"
          currentValue={movThisWeek}
          previousValue={movLastWeek}
          formatter={fmtNumber}
          styles={styles}
        />
        <ComparisonMiniCard
          title="Liquidaciones (Monto CIF)"
          currentLabel="Últimos 30 días"
          previousLabel="30 días anteriores"
          currentValue={liqLast30d}
          previousValue={liqPrev30d}
          formatter={fmtCurrency}
          styles={styles}
        />
        <ComparisonMiniCard
          title="ATS Compras (Facturado)"
          currentLabel="Últimos 30 días"
          previousLabel="30 días anteriores"
          currentValue={atsLast30d}
          previousValue={atsPrev30d}
          formatter={fmtCurrency}
          styles={styles}
        />
      </section>
    </div>
  );
};
