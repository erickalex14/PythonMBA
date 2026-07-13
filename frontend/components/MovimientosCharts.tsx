import React, { useMemo } from "react";
import { Card } from "./ui/Card";
import { RankedBarChart, TierHeading, TwoBarComparison, StatGauge, TrendLine } from "./charts/ChartPrimitives";

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
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
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
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
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

  const topVendedores = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const v = str(row, "COD_SALESMAN");
      if (!v) return;
      map[v] = (map[v] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
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
    const devoluciones = porTipo.find((t) => t.label === "Devolución")?.total || 0;
    return data.length > 0 ? (devoluciones / data.length) * 100 : 0;
  }, [porTipo, data.length]);

  const cardStyle: React.CSSProperties = { marginBottom: "1.5rem" };

  return (
    <section>
      <TierHeading title="Resumen Ejecutivo" first />
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <Card variant="chartCard" styles={styles}>
          <h3>Distribución por Tipo de Movimiento</h3>
          <RankedBarChart items={porTipo} color="var(--color-chart-accent)" formatter={fmtNumber} />
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
      <Card variant="chartCard" styles={styles} style={cardStyle}>
        <h3>Top 10 Marcas por Cantidad de Movimientos</h3>
        <RankedBarChart items={topMarcas} color="var(--color-chart-accent)" formatter={fmtNumber} />
      </Card>

      <TierHeading title="Detalle Operativo" />
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <Card variant="chartCard" styles={styles}>
          <h3>Top 10 Sucursales con Más Movimientos</h3>
          <RankedBarChart items={topSucursales} color="var(--color-chart-accent)" formatter={fmtNumber} />
        </Card>
        <Card variant="chartCard" styles={styles}>
          <h3>Top 10 Vendedores por Movimientos</h3>
          <RankedBarChart items={topVendedores} color="var(--color-chart-accent)" formatter={fmtNumber} />
        </Card>
      </div>

      <TierHeading title="Tendencia y Calidad" />
      <div className={styles.chartsGridTwo} style={{ ...cardStyle, marginBottom: 0 }}>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 280 }}>
          <h3>Tendencia Diaria de Transacciones</h3>
          <TrendLine points={tendenciaDiaria} formatter={fmtNumber} color="var(--color-brand-primary)" />
        </Card>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 280 }}>
          <h3>% Devoluciones sobre el Total</h3>
          <StatGauge pct={pctDevoluciones} label={`${fmtNumber(porTipo.find((t) => t.label === "Devolución")?.total || 0)} devoluciones de ${fmtNumber(data.length)} movimientos`} goodDirection="low" />
        </Card>
      </div>
    </section>
  );
};