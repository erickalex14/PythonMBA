import React, { useMemo } from "react";
import { Card } from "./ui/Card";
import {
  RankedBarChart,
  TierHeading,
  TwoBarComparison,
  RadialGauge,
  TrendLine,
  DonutChart,
  Treemap,
  ParetoChart,
  ExpandableChartCard,
} from "./charts/ChartPrimitives";

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

  const pctDevoluciones = useMemo(() => {
    const devoluciones = porTipo.find((t) => t.label === "Devolución")?.value || 0;
    return data.length > 0 ? (devoluciones / data.length) * 100 : 0;
  }, [porTipo, data.length]);

  const cardStyle: React.CSSProperties = { marginBottom: "1.5rem" };

  return (
    <section>
      <TierHeading title="Resumen Ejecutivo" first />
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <Card variant="chartCard" styles={styles}>
          <h3>Distribución por Tipo de Movimiento</h3>
          <DonutChart items={porTipo} formatter={fmtNumber} />
        </Card>
        <Card variant="chartCard" styles={styles}>
          <h3>Entradas (Proveedores) vs Salidas (Clientes)</h3>
          <TwoBarComparison
            labelA="Entradas (Proveedores)"
            valueA={entradasVsSalidas.entradas}
            labelB="Salidas (Clientes)"
            valueB={entradasVsSalidas.salidas}
            formatter={fmtNumber}
          />
        </Card>
      </div>
      <div style={cardStyle}>
        <ExpandableChartCard title="Top 10 Marcas por Cantidad de Movimientos" styles={styles} render={(expanded) => (
          <Treemap items={topMarcas} formatter={fmtNumber} height={expanded ? 460 : 170} />
        )} />
      </div>

      <TierHeading title="Detalle Operativo" />
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <ExpandableChartCard title="Top 10 Sucursales con Más Movimientos" styles={styles} render={(expanded) => (
          <RankedBarChart items={topSucursales} color="var(--color-chart-accent)" formatter={fmtNumber} minHeight={expanded ? 260 : 100} />
        )} />
        <ExpandableChartCard title="Concentración de Movimientos por Vendedor (80/20)" styles={styles} render={(expanded) => (
          <ParetoChart items={paretoVendedores} formatter={fmtNumber} height={expanded ? 420 : 170} />
        )} />
      </div>

      <TierHeading title="Tendencia y Calidad" />
      <div className={styles.chartsGridTwo} style={{ ...cardStyle, marginBottom: 0 }}>
        <ExpandableChartCard title="Tendencia Diaria de Transacciones" styles={styles} render={(expanded) => (
          <TrendLine points={tendenciaDiaria} formatter={fmtNumber} color="var(--color-brand-primary)" height={expanded ? 300 : 130} />
        )} />
        <Card variant="chartCard" styles={styles} style={{ minHeight: 200 }}>
          <h3>% Devoluciones sobre el Total</h3>
          <RadialGauge pct={pctDevoluciones} label={`${fmtNumber(porTipo.find((t) => t.label === "Devolución")?.value || 0)} devoluciones de ${fmtNumber(data.length)} movimientos`} goodDirection="low" />
        </Card>
      </div>
    </section>
  );
};
