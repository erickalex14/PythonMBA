import React, { useMemo } from "react";

interface ChartsSectionProps {
  filteredData: any[];
  activeTab: string;
  styles: any;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ filteredData, activeTab, styles }) => {
  // 1. Curva Diaria
  const chartDataByDay = useMemo(() => {
    if (
      (activeTab !== "movimientos" &&
        activeTab !== "liquidaciones" &&
        activeTab !== "ats" &&
        activeTab !== "ventas") ||
      filteredData.length === 0
    ) {
      return [];
    }

    const dailyCounts: { [date: string]: number } = {};
    filteredData.forEach((row) => {
      const date =
        row.TRANS_DATE ||
        row.LIQUIDACION_FECHA ||
        row.INVOICE_DATE ||
        row.fecha ||
        row.FECHA ||
        "Sin Fecha";
      
      const val =
        activeTab === "movimientos"
          ? Number(row.ORIGINAL_QTY) || 0
          : activeTab === "ventas"
          ? Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0
          : Number(row.VALOR_TOTAL_CIF) || Number(row.INVOICE_TOTAL) || 0;

      dailyCounts[date] = (dailyCounts[date] || 0) + val;
    });

    return Object.entries(dailyCounts)
      .map(([date, qty]) => ({ date, qty }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData, activeTab]);

  // 2. Top Items
  const chartDataByBrand = useMemo(() => {
    if (
      (activeTab !== "movimientos" &&
        activeTab !== "liquidaciones" &&
        activeTab !== "ats" &&
        activeTab !== "ventas") ||
      filteredData.length === 0
    ) {
      return [];
    }

    const itemCounts: { [key: string]: number } = {};
    filteredData.forEach((row) => {
      let key = "Sin Item";
      if (activeTab === "movimientos") {
        key =
          row.Codigo_Marca !== undefined && row.Codigo_Marca !== null
            ? String(row.Codigo_Marca).trim()
            : "Sin Marca";
      } else if (activeTab === "liquidaciones") {
        key =
          row.PRODUCTO_ID_CORP !== undefined && row.PRODUCTO_ID_CORP !== null
            ? String(row.PRODUCTO_ID_CORP).trim()
            : "Sin Producto";
      } else if (activeTab === "ats") {
        key =
          row.VENDOR_NAME !== undefined && row.VENDOR_NAME !== null
            ? String(row.VENDOR_NAME).trim()
            : "Sin Proveedor";
      } else if (activeTab === "ventas") {
        key =
          row.producto !== undefined && row.producto !== null
            ? String(row.producto).trim()
            : "Sin Producto";
      }

      const val =
        activeTab === "movimientos"
          ? Number(row.ORIGINAL_QTY) || 0
          : activeTab === "ventas"
          ? Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0
          : Number(row.VALOR_TOTAL_CIF) || Number(row.INVOICE_TOTAL) || 0;

      itemCounts[key] = (itemCounts[key] || 0) + val;
    });

    return Object.entries(itemCounts)
      .map(([brand, qty]) => ({ brand, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [filteredData, activeTab]);

  // 3. Distribución por Grupos/Sucursales
  const chartDataByBranch = useMemo(() => {
    if (
      (activeTab !== "movimientos" &&
        activeTab !== "liquidaciones" &&
        activeTab !== "ats" &&
        activeTab !== "ventas") ||
      filteredData.length === 0
    ) {
      return [];
    }

    const groupCounts: { [key: string]: number } = {};
    filteredData.forEach((row) => {
      let key = "Sin Grupo";
      if (activeTab === "movimientos") {
        key =
          row.Codigo_Sucursal !== undefined && row.Codigo_Sucursal !== null
            ? String(row.Codigo_Sucursal).trim()
            : "Sin Sucursal";
      } else if (activeTab === "liquidaciones") {
        key =
          row.PARTIDA_ID_CORP !== undefined && row.PARTIDA_ID_CORP !== null
            ? String(row.PARTIDA_ID_CORP).trim()
            : "Sin Partida";
      } else if (activeTab === "ats") {
        key =
          row.MF_Lista2 !== undefined && row.MF_Lista2 !== null
            ? String(row.MF_Lista2).trim()
            : "Sin Clasificación";
      } else if (activeTab === "ventas") {
        key =
          row.grupo !== undefined && row.grupo !== null
            ? String(row.grupo).trim()
            : "Sin Grupo";
      }

      const val =
        activeTab === "movimientos"
          ? Number(row.ORIGINAL_QTY) || 0
          : activeTab === "ventas"
          ? Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0
          : Number(row.VALOR_TOTAL_CIF) || Number(row.INVOICE_TOTAL) || 0;

      groupCounts[key] = (groupCounts[key] || 0) + val;
    });

    const total = Object.values(groupCounts).reduce((acc, curr) => acc + curr, 0);
    return Object.entries(groupCounts)
      .map(([branch, qty]) => ({
        branch,
        qty,
        percentage: total > 0 ? Math.round((qty / total) * 100) : 0
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [filteredData, activeTab]);

  if (
    (activeTab !== "movimientos" &&
      activeTab !== "liquidaciones" &&
      activeTab !== "ats" &&
      activeTab !== "ventas") ||
    filteredData.length === 0
  ) {
    return null;
  }

  return (
    <section className={styles.chartsGrid}>
      {/* Gráfico 1: Curva Diaria */}
      <div className={styles.chartCard}>
        <h3>
          {activeTab === "movimientos"
            ? "Curva Diaria de Movimientos"
            : activeTab === "liquidaciones"
            ? "Curva Diaria de Liquidaciones"
            : activeTab === "ats"
            ? "Curva Diaria de Facturación (Compras)"
            : "Curva Diaria de Ventas"}
        </h3>
        <div className={styles.svgContainer}>
          <svg viewBox="0 0 500 200" className={styles.svgChart}>
            <defs>
              <linearGradient id="areaGradBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#005DAA" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#005DAA" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
              <line
                key={i}
                x1="50"
                y1={170 - p * 140}
                x2="470"
                y2={170 - p * 140}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
            ))}

            {/* Area y Línea */}
            {(() => {
              const maxQty = Math.max(...chartDataByDay.map((d) => d.qty), 1);
              const points = chartDataByDay.map((d, index) => {
                const x =
                  chartDataByDay.length > 1
                    ? (index / (chartDataByDay.length - 1)) * 400 + 50
                    : 250;
                const y = 170 - (d.qty / maxQty) * 140;
                return { x, y };
              });

              if (points.length === 0) return null;

              const pathD = `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
              const areaD = `${pathD} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`;

              return (
                <>
                  <path d={areaD} fill="url(#areaGradBlue)" />
                  <path d={pathD} fill="none" stroke="#005DAA" strokeWidth="2.5" strokeLinecap="round" />
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="3.5"
                      fill="#ffffff"
                      stroke="#005DAA"
                      strokeWidth="1.5"
                    />
                  ))}
                </>
              );
            })()}

            {/* Ejes */}
            <line x1="50" y1="170" x2="470" y2="170" stroke="#cbd5e1" strokeWidth="1" />
            <line x1="50" y1="30" x2="50" y2="170" stroke="#cbd5e1" strokeWidth="1" />

            {/* Etiquetas */}
            <text x="42" y="173" textAnchor="end" fill="#94a3b8" fontSize="8">0</text>
            {chartDataByDay.length > 0 && (
              <text x="42" y="34" textAnchor="end" fill="#94a3b8" fontSize="8">
                {Math.max(...chartDataByDay.map((d) => d.qty)).toLocaleString()}
              </text>
            )}
            {chartDataByDay.length > 0 && (
              <>
                <text x="50" y="184" textAnchor="middle" fill="#94a3b8" fontSize="8">
                  {chartDataByDay[0].date.substring(5)}
                </text>
                {chartDataByDay.length > 1 && (
                  <text x="470" y="184" textAnchor="middle" fill="#94a3b8" fontSize="8">
                    {chartDataByDay[chartDataByDay.length - 1].date.substring(5)}
                  </text>
                )}
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Gráfico 2: Top de Items */}
      <div className={styles.chartCard}>
        <h3>
          {activeTab === "movimientos"
            ? "Top 8 Marcas más Movidas"
            : activeTab === "liquidaciones"
            ? "Top 8 Productos Importados"
            : activeTab === "ats"
            ? "Top 8 Proveedores Facturados"
            : "Top 8 Productos Vendidos"}
        </h3>
        <div className={styles.svgContainer}>
          <svg viewBox="0 0 500 200" className={styles.svgChart}>
            {(() => {
              const maxQty = Math.max(...chartDataByBrand.map((d) => d.qty), 1);
              return chartDataByBrand.map((d, index) => {
                const y = index * 22 + 15;
                const barWidth = (d.qty / maxQty) * 310;
                const opacity = 0.45 + (d.qty / maxQty) * 0.55;
                return (
                  <g key={index}>
                    <text x="5" y={y + 11} fill="#475569" fontSize="9" fontWeight="600">
                      {d.brand.substring(0, 11)}
                    </text>
                    <rect x="90" y={y} width="320" height="13" rx="4" fill="#f1f5f9" />
                    <rect x="90" y={y} width={barWidth} height="13" rx="4" fill="#005DAA" fillOpacity={opacity} />
                    <text x={95 + barWidth} y={y + 11} fill="#475569" fontSize="8.5" fontWeight="700">
                      {activeTab === "movimientos"
                        ? d.qty.toLocaleString()
                        : d.qty.toLocaleString("es-EC", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          })}
                    </text>
                  </g>
                );
              });
            })()}
          </svg>
        </div>
      </div>

      {/* Gráfico 3: Distribución */}
      <div className={styles.chartCard}>
        <h3>
          {activeTab === "movimientos"
            ? "Distribución por Sucursal"
            : activeTab === "liquidaciones"
            ? "Distribución por Partida"
            : activeTab === "ats"
            ? "Distribución por SRI Clasificación"
            : "Distribución por Grupo de Ventas"}
        </h3>
        <div className={styles.branchProgressList}>
          {chartDataByBranch.map((d, index) => (
            <div key={index} className={styles.branchProgressItem}>
              <div className={styles.branchMetaInfo}>
                <span className={styles.branchName}>{d.branch}</span>
                <span className={styles.branchQty}>
                  {activeTab === "movimientos"
                    ? `${d.qty.toLocaleString()} (${d.percentage}%)`
                    : `${d.qty.toLocaleString("es-EC", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })} (${d.percentage}%)`}
                </span>
              </div>
              <div className={styles.branchProgressBarBg}>
                <div
                  className={styles.branchProgressBarFill}
                  style={{ width: `${d.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
