import React, { useMemo } from "react";
import { EMPRESA_LABELS } from "../lib/empresa";
import {
  RankedBarChart,
  TierHeading,
  TwoBarComparison,
  ParetoChart,
  TrendLine,
  DonutChart,
  Treemap,
  ScatterXY,
  ExpandableChartCard,
} from "./charts/ChartPrimitives";

interface LiquidacionesChartsProps {
  data: any[];
  styles: Record<string, string>;
}

function num(row: any, key: string): number {
  const n = Number(row?.[key]);
  return isNaN(n) ? 0 : n;
}
function str(row: any, key: string): string {
  const v = row?.[key];
  return v === undefined || v === null ? "" : String(v).trim();
}
function fmtMoney(n: number): string {
  return n.toLocaleString("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtMoney2(n: number): string {
  return n.toLocaleString("es-EC", { style: "currency", currency: "USD" });
}
function fmtNumber(n: number): string {
  return n.toLocaleString("es-EC");
}

export const LiquidacionesCharts: React.FC<LiquidacionesChartsProps> = ({ data, styles }) => {
  if (data.length === 0) return null;

  const porEmpresa = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const corp = str(row, "CORP");
      const label = EMPRESA_LABELS[corp] || corp || "Sin Empresa";
      map[label] = (map[label] || 0) + num(row, "VALOR_TOTAL_CIF");
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const subtotalVsTotal = useMemo(() => {
    let subtotal = 0;
    let total = 0;
    data.forEach((row) => {
      subtotal += num(row, "VALOR_SUBTOTAL_CIF");
      total += num(row, "VALOR_TOTAL_CIF");
    });
    return { subtotal, total };
  }, [data]);

  const topPartidas = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const partida = str(row, "PARTIDA_ID_CORP") || "Sin Partida";
      map[partida] = (map[partida] || 0) + num(row, "VALOR_TOTAL_CIF");
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  const topProductosCif = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const producto = str(row, "PRODUCTO_ID_CORP") || "Sin Producto";
      map[producto] = (map[producto] || 0) + num(row, "VALOR_TOTAL_CIF");
    });
    return Object.entries(map)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [data]);

  // Cantidad importada vs Monto CIF por producto: distingue productos de
  // alto volumen/bajo valor unitario de los de bajo volumen/alto valor,
  // algo que un ranking simple no muestra.
  const scatterProductos = useMemo(() => {
    const map: Record<string, { cantidad: number; cif: number }> = {};
    data.forEach((row) => {
      const producto = str(row, "PRODUCTO_ID_CORP") || "Sin Producto";
      const cur = map[producto] || { cantidad: 0, cif: 0 };
      cur.cantidad += num(row, "CANTIDAD");
      cur.cif += num(row, "VALOR_TOTAL_CIF");
      map[producto] = cur;
    });
    return Object.entries(map)
      .filter(([, v]) => v.cantidad > 0 && v.cif > 0)
      .map(([key, v]) => ({ key, label: key, x: v.cantidad, y: v.cif, size: v.cif }));
  }, [data]);

  const tendenciaDiaria = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const f = str(row, "LIQUIDACION_FECHA");
      if (!f) return;
      map[f] = (map[f] || 0) + num(row, "VALOR_TOTAL_CIF");
    });
    return Object.entries(map)
      .map(([x, y]) => ({ x, y }))
      .sort((a, b) => a.x.localeCompare(b.x));
  }, [data]);

  const paretoProductos = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const producto = str(row, "PRODUCTO_ID_CORP") || "Sin Producto";
      map[producto] = (map[producto] || 0) + num(row, "VALOR_TOTAL_CIF");
    });
    return Object.entries(map)
      .map(([key, value]) => ({ key, label: key, value }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [data]);

  const cardStyle: React.CSSProperties = { marginBottom: "1.5rem" };

  return (
    <section>
      <TierHeading title="Resumen Ejecutivo" first />
      <div className={`${styles.chartsGridTwo} ${styles.chartsGridTwoTop}`} style={cardStyle}>
        <ExpandableChartCard title="Distribución de CIF por Empresa" styles={styles} render={(expanded) => (
          <DonutChart items={porEmpresa} formatter={fmtMoney} size={expanded ? 170 : 100} compact={!expanded} />
        )} />
        <ExpandableChartCard title="Subtotal CIF vs Total CIF" styles={styles} render={(expanded) => (
          <TwoBarComparison
            labelA="Subtotal CIF"
            valueA={subtotalVsTotal.subtotal}
            labelB="Total CIF (con cargos)"
            valueB={subtotalVsTotal.total}
            formatter={fmtMoney2}
            compact={!expanded}
          />
        )} />
      </div>
      <div style={cardStyle}>
        <ExpandableChartCard title="Top 10 Partidas Arancelarias por Monto CIF" styles={styles} render={(expanded) => (
          <Treemap items={topPartidas} formatter={fmtMoney} height={expanded ? 460 : 170} />
        )} />
      </div>

      <TierHeading title="Detalle de Productos" />
      <div className={`${styles.chartsGridTwo} ${styles.chartsGridTwoTop}`} style={cardStyle}>
        <ExpandableChartCard title="Top 10 Productos por Monto CIF" styles={styles} render={(expanded) => (
          <RankedBarChart items={topProductosCif} color="var(--color-chart-accent)" formatter={fmtMoney} minHeight={expanded ? 260 : 100} maxVisibleItems={expanded ? undefined : 5} />
        )} />
        <ExpandableChartCard title="Cantidad Importada vs Monto CIF por Producto" styles={styles} render={(expanded) => (
          <ScatterXY
            points={scatterProductos}
            xLabel="Cantidad Importada →"
            yLabel="Monto CIF →"
            xFormatter={fmtNumber}
            yFormatter={fmtMoney2}
            color="var(--color-chart-accent)"
            height={expanded ? 460 : 190}
          />
        )} />
      </div>

      <TierHeading title="Tendencia y Concentración" />
      <div className={`${styles.chartsGridTwo} ${styles.chartsGridTwoTop}`} style={{ ...cardStyle, marginBottom: 0 }}>
        <ExpandableChartCard title="Tendencia Diaria de Monto CIF" styles={styles} render={(expanded) => (
          <TrendLine points={tendenciaDiaria} formatter={fmtMoney2} color="var(--color-brand-primary)" height={expanded ? 300 : 130} />
        )} />
        <ExpandableChartCard title="Concentración de CIF por Producto (80/20)" styles={styles} render={(expanded) => (
          <ParetoChart items={paretoProductos} formatter={fmtMoney2} height={expanded ? 420 : 170} />
        )} />
      </div>
    </section>
  );
};
