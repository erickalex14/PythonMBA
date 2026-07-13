import React, { useMemo } from "react";
import { Card } from "./ui/Card";
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
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <Card variant="chartCard" styles={styles}>
          <h3>Distribución de CIF por Empresa</h3>
          <DonutChart items={porEmpresa} formatter={fmtMoney} />
        </Card>
        <Card variant="chartCard" styles={styles}>
          <h3>Subtotal CIF vs Total CIF</h3>
          <TwoBarComparison
            labelA="Subtotal CIF"
            valueA={subtotalVsTotal.subtotal}
            labelB="Total CIF (con cargos)"
            valueB={subtotalVsTotal.total}
            formatter={fmtMoney2}
          />
        </Card>
      </div>
      <Card variant="chartCard" styles={styles} style={cardStyle}>
        <h3>Top 10 Partidas Arancelarias por Monto CIF</h3>
        <Treemap items={topPartidas} formatter={fmtMoney} />
      </Card>

      <TierHeading title="Detalle de Productos" />
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <Card variant="chartCard" styles={styles}>
          <h3>Top 10 Productos por Monto CIF</h3>
          <RankedBarChart items={topProductosCif} color="var(--color-chart-accent)" formatter={fmtMoney} />
        </Card>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 320 }}>
          <h3>Cantidad Importada vs Monto CIF por Producto</h3>
          <ScatterXY
            points={scatterProductos}
            xLabel="Cantidad Importada →"
            yLabel="Monto CIF →"
            xFormatter={fmtNumber}
            yFormatter={fmtMoney2}
            color="var(--color-chart-accent)"
          />
        </Card>
      </div>

      <TierHeading title="Tendencia y Concentración" />
      <div className={styles.chartsGridTwo} style={{ ...cardStyle, marginBottom: 0 }}>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 300 }}>
          <h3>Tendencia Diaria de Monto CIF</h3>
          <TrendLine points={tendenciaDiaria} formatter={fmtMoney2} color="var(--color-brand-primary)" />
        </Card>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 300 }}>
          <h3>Concentración de CIF por Producto (80/20)</h3>
          <ParetoChart items={paretoProductos} formatter={fmtMoney2} />
        </Card>
      </div>
    </section>
  );
};
