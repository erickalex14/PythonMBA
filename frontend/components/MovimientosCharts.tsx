import React, { useMemo } from "react";
import { Card } from "./ui/Card";
import {
  RankedBarChart,
  TierHeading,
  TwoBarComparison,
  RadialGauge,
  Treemap,
  ParetoChart,
  ExpandableChartCard,
} from "./charts/ChartPrimitives";
import { DevolucionesDonut, type DonutSegment } from "./charts/DevolucionesDonut";
import { TrendLineAdvanced } from "./charts/TrendLineAdvanced";

// Mismo lenguaje de color que el resto de la app: marca para los tipos
// "normales" de movimiento, rojo de alerta para Devolución (igual que las
// devoluciones del Dashboard), gris para lo no clasificado. Categorías que
// no calcen con ninguna de estas (poco probable, pero el memo de origen
// varía) rotan sobre una paleta sobria de respaldo.
const TIPO_COLOR: Record<string, string> = {
  Proveedores: "var(--color-brand-primary)",
  Clientes: "var(--color-brand-accent)",
  Transferencia: "var(--color-chart-accent)",
  "Movimiento Manual": "var(--color-brand-primary-alt)",
  "Devolución": "#c0392b",
  "Sin Clasificar": "var(--color-text-tertiary)",
};
const TIPO_COLOR_FALLBACK = [
  "var(--color-chart-accent)",
  "var(--color-brand-primary)",
  "var(--color-brand-primary-alt)",
  "var(--color-brand-accent-dark)",
];

interface MovimientosChartsProps {
  data: any[];
  styles: Record<string, string>;
}

function str(row: any, key: string): string {
  const v = row?.[key];
  return v === undefined || v === null ? "" : String(v).trim();
}
function fmtNumber(n: number): string {
  return n.toLocaleString("es-EC");
}

// Los memos de origen vienen con variantes de mayúsculas/minúsculas y algún
// "MOVIMIENTO MANUAL -" con guión suelto - se normalizan a una sola etiqueta
// por tipo real de movimiento en vez de contarlas como categorías separadas.
function normalizeMemo(memo: string): string {
  const upper = memo.toUpperCase().replace(/-$/, "").trim();
  if (upper === "TRANSFERENCIA") return "Transferencia";
  if (upper === "PROVEEDORES") return "Proveedores";
  if (upper === "CLIENTES") return "Clientes";
  if (upper.startsWith("DEVOLUC")) return "Devolución";
  if (upper.startsWith("MOVIMIENTO MANUAL")) return "Movimiento Manual";
  return memo || "Sin Clasificar";
}

export const MovimientosCharts: React.FC<MovimientosChartsProps> = ({ data, styles }) => {
  if (data.length === 0) return null;

  const porTipo = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const tipo = normalizeMemo(str(row, "ORIGIN_MEMO"));
      map[tipo] = (map[tipo] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const entradasVsSalidas = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    data.forEach((row) => {
      const tipo = normalizeMemo(str(row, "ORIGIN_MEMO"));
      if (tipo === "Proveedores") entradas++;
      else if (tipo === "Clientes") salidas++;
    });
    return { entradas, salidas };
  }, [data]);

  const topMarcas = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const marca = str(row, "Codigo_Marca") || "Sin Marca";
      map[marca] = (map[marca] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  const topSucursales = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const suc = str(row, "Codigo_Sucursal") || "Sin Sucursal";
      map[suc] = (map[suc] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [data]);

  const paretoVendedores = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const v = str(row, "COD_SALESMAN");
      if (!v) return;
      map[v] = (map[v] || 0) + 1;
    });
    return Object.entries(map)
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [data]);

  const tendenciaDiaria = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const f = str(row, "TRANS_DATE");
      if (!f) return;
      map[f] = (map[f] || 0) + 1;
    });
    return Object.entries(map)
      .map(([x, y]) => ({ x, y }))
      .sort((a, b) => a.x.localeCompare(b.x));
  }, [data]);

  const porTipoSegments: DonutSegment[] = useMemo(
    () =>
      porTipo.map((t, i) => ({
        key: t.label,
        label: t.label,
        value: t.value,
        color: TIPO_COLOR[t.label] ?? TIPO_COLOR_FALLBACK[i % TIPO_COLOR_FALLBACK.length],
      })),
    [porTipo]
  );

  const pctDevoluciones = useMemo(() => {
    const devoluciones = porTipo.find((t) => t.label === "Devolución")?.value || 0;
    return data.length > 0 ? (devoluciones / data.length) * 100 : 0;
  }, [porTipo, data.length]);

  const cardStyle: React.CSSProperties = { marginBottom: "1.5rem" };

  return (
    <section>
      <TierHeading title="Resumen Ejecutivo" first />
      <div className={styles.chartsGridThree} style={cardStyle}>
        <ExpandableChartCard title="Distribución por Tipo de Movimiento" styles={styles} render={(expanded) => (
          <DevolucionesDonut
            segments={porTipoSegments}
            totalLabel="Movimientos"
            totalValue={data.length}
            formatter={fmtNumber}
            size={expanded ? 220 : 130}
            strokeWidth={expanded ? 26 : 17}
          />
        )} />
        <ExpandableChartCard title="Entradas (Proveedores) vs Salidas (Clientes)" styles={styles} render={(expanded) => (
          <TwoBarComparison
            labelA="Entradas (Proveedores)"
            valueA={entradasVsSalidas.entradas}
            labelB="Salidas (Clientes)"
            valueB={entradasVsSalidas.salidas}
            formatter={fmtNumber}
            compact={!expanded}
          />
        )} />
        <ExpandableChartCard title="Top 10 Marcas por Cantidad de Movimientos" styles={styles} render={(expanded) => (
          <Treemap items={topMarcas} formatter={fmtNumber} height={expanded ? 460 : 170} />
        )} />
      </div>

      <TierHeading title="Detalle Operativo" />
      <div className={`${styles.chartsGridTwo} ${styles.chartsGridTwoTop}`} style={cardStyle}>
        <ExpandableChartCard title="Top 10 Sucursales con Más Movimientos" styles={styles} render={(expanded) => (
          <RankedBarChart items={topSucursales} color="var(--color-chart-accent)" formatter={fmtNumber} minHeight={expanded ? 260 : 100} maxVisibleItems={expanded ? undefined : 5} />
        )} />
        <ExpandableChartCard title="Concentración de Movimientos por Vendedor (80/20)" styles={styles} render={(expanded) => (
          <ParetoChart items={paretoVendedores} formatter={fmtNumber} height={expanded ? 420 : 130} />
        )} />
      </div>

      <TierHeading title="Tendencia y Calidad" />
      <div className={`${styles.chartsGridTwo} ${styles.chartsGridTwoTop}`} style={{ ...cardStyle, marginBottom: 0 }}>
        <ExpandableChartCard title="Tendencia Diaria de Transacciones" styles={styles} render={(expanded) => (
          <TrendLineAdvanced points={tendenciaDiaria} formatter={fmtNumber} color="var(--color-brand-primary)" height={expanded ? 320 : 160} />
        )} />
        <Card variant="chartCard" styles={styles} style={{ minHeight: 200 }}>
          <h3>% Devoluciones sobre el Total</h3>
          <RadialGauge pct={pctDevoluciones} label={`${fmtNumber(porTipo.find((t) => t.label === "Devolución")?.value || 0)} devoluciones de ${fmtNumber(data.length)} movimientos`} goodDirection="low" />
        </Card>
      </div>
    </section>
  );
};
