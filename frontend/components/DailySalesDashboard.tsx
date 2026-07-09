import React, { useEffect, useMemo, useState } from "react";
import { useReportQuery } from "../hooks/useReportQuery";
import { Card } from "./ui/Card";
import { FilterBar } from "./ui/FilterBar";
import NovbiSplash from "./NovbiSplash";

interface DailySalesDashboardProps {
  styles: Record<string, string>;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("es-EC", { style: "currency", currency: "USD" });
}

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const RANGE_DAYS = 7;

export const DailySalesDashboard: React.FC<DailySalesDashboardProps> = ({ styles }) => {
  const { loading, data, error, fetchReportData } = useReportQuery();
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [codigoSearch, setCodigoSearch] = useState("");
  // Empieza en true desde el primer render (sin esperar al useEffect) para
  // que el splash cubra la pantalla desde el primer frame, sin dejar ver
  // el layout/dashboard vacío mientras el efecto todavía no dispara el fetch.
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  useEffect(() => {
    fetchReportData("ventas", dateNDaysAgo(RANGE_DAYS - 1), dateNDaysAgo(0)).finally(() => {
      setFirstLoadDone(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empresaOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row: any) => { if (row.empresa) set.add(String(row.empresa).trim()); });
    return Array.from(set).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((row: any) => {
      if (selectedEmpresa && String(row.empresa || "").trim() !== selectedEmpresa) return false;
      if (codigoSearch && !String(row.codigo || "").toLowerCase().includes(codigoSearch.trim().toLowerCase())) return false;
      return true;
    });
  }, [data, selectedEmpresa, codigoSearch]);

  const totalsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach((row: any) => {
      const date = row.fecha || row.FECHA;
      if (!date) return;
      const val = Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      map[date] = (map[date] || 0) + val;
    });
    return map;
  }, [filteredData]);

  const today = dateNDaysAgo(0);
  const yesterday = dateNDaysAgo(1);
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
      const date = dateNDaysAgo(i);
      days.push({ date, total: totalsByDay[date] || 0 });
    }
    return days;
  }, [totalsByDay]);

  const topProducts = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach((row: any) => {
      const key = row.producto || row.PRODUCTO || "Sin producto";
      const val = Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      map[key] = (map[key] || 0) + val;
    });
    return Object.entries(map)
      .map(([producto, total]) => ({ producto, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredData]);

  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach((row: any) => {
      const key = row.grupo || row.GRUPO || "Sin categoría";
      const val = Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      map[key] = (map[key] || 0) + val;
    });
    const total = Object.values(map).reduce((acc, v) => acc + v, 0);
    return Object.entries(map)
      .map(([categoria, monto]) => ({
        categoria,
        monto,
        percentage: total > 0 ? Math.round((monto / total) * 100) : 0,
      }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 6);
  }, [filteredData]);

  if (loading || !firstLoadDone) {
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
            label: "Buscar por Código de Producto",
            value: codigoSearch,
            onChange: setCodigoSearch,
            placeholder: "Ej: 1AENV8395-NVC01",
            options: [],
            type: "text",
          },
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
          <h3>Distribución por Categoría ({RANGE_DAYS} días)</h3>
          <div className={styles.branchProgressList}>
            {topCategories.map((c, index) => (
              <div key={index} className={styles.branchProgressItem}>
                <div className={styles.branchMetaInfo}>
                  <span className={styles.branchName}>{c.categoria}</span>
                  <span className={styles.branchQty}>
                    {fmtCurrency(c.monto)} ({c.percentage}%)
                  </span>
                </div>
                <div className={styles.branchProgressBarBg}>
                  <div className={styles.branchProgressBarFill} style={{ width: `${c.percentage}%` }}></div>
                </div>
              </div>
            ))}
            {topCategories.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-faint)" }}>Sin datos en el período</p>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
};
