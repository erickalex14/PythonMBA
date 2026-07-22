import React, { useMemo } from "react";
import { Card } from "./ui/Card";
import {
  RankedBarChart,
  TierHeading,
  TwoBarComparison,
  RadialGauge,
  ParetoChart,
  TrendLine,
  DonutChart,
  Treemap,
  ExpandableChartCard,
} from "./charts/ChartPrimitives";

interface AtsChartsProps {
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

export const AtsCharts: React.FC<AtsChartsProps> = ({ data, styles }) => {
  if (data.length === 0) return null;

  // Una factura anulada no cuenta como facturado real - todos los totales
  // monetarios se calculan solo sobre facturas activas (igual que en el
  // Dashboard). El unico lugar que SI necesita ver las anuladas es el
  // propio gauge de "% Facturas Anuladas", que usa `data` sin filtrar.
  const activos = useMemo(() => data.filter((row) => Number(row.ES_ANULADO) !== 1), [data]);

  const productosVsServicios = useMemo(() => {
    let productos = 0;
    let servicios = 0;
    activos.forEach((row) => {
      productos += num(row, "TotalProductosConIVa") + num(row, "TotalProductosSinIVa");
      servicios += num(row, "TotalServiciosConIVa") + num(row, "TotalServiciosSinIVa");
    });
    return { productos, servicios };
  }, [activos]);

  const conIvaVsSinIva = useMemo(() => {
    let conIva = 0;
    let sinIva = 0;
    activos.forEach((row) => {
      conIva += num(row, "SUMA_CON_IVA");
      sinIva += num(row, "SUMA_SIN_IVA");
    });
    return [
      { label: "Con IVA", value: conIva },
      { label: "Sin IVA", value: sinIva },
    ];
  }, [activos]);

  const topProveedores = useMemo(() => {
    const map: Record<string, number> = {};
    activos.forEach((row) => {
      const proveedor = str(row, "VENDOR_NAME") || "Sin Proveedor";
      map[proveedor] = (map[proveedor] || 0) + num(row, "INVOICE_TOTAL");
    });
    return Object.entries(map)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [activos]);

  const porClasificacion = useMemo(() => {
    const map: Record<string, number> = {};
    activos.forEach((row) => {
      const clasif = str(row, "MF_Lista2");
      if (!clasif) return;
      map[clasif] = (map[clasif] || 0) + num(row, "INVOICE_TOTAL");
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [activos]);

  const pctAnulado = useMemo(() => {
    const anulados = data.filter((row) => Number(row.ES_ANULADO) === 1).length;
    return data.length > 0 ? (anulados / data.length) * 100 : 0;
  }, [data]);
  const anuladosCount = useMemo(() => data.filter((row) => Number(row.ES_ANULADO) === 1).length, [data]);

  const tendenciaDiaria = useMemo(() => {
    const map: Record<string, number> = {};
    activos.forEach((row) => {
      const f = str(row, "INVOICE_DATE");
      if (!f) return;
      map[f] = (map[f] || 0) + num(row, "INVOICE_TOTAL");
    });
    return Object.entries(map)
      .map(([x, y]) => ({ x, y }))
      .sort((a, b) => a.x.localeCompare(b.x));
  }, [activos]);

  const paretoProveedores = useMemo(() => {
    const map: Record<string, number> = {};
    activos.forEach((row) => {
      const proveedor = str(row, "VENDOR_NAME") || "Sin Proveedor";
      map[proveedor] = (map[proveedor] || 0) + num(row, "INVOICE_TOTAL");
    });
    return Object.entries(map)
      .map(([key, value]) => ({ key, label: key, value }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [activos]);

  const cardStyle: React.CSSProperties = { marginBottom: "1.5rem" };

  return (
    <section>
      <TierHeading title="Resumen Ejecutivo" first />
      <div className={styles.chartsGridThree} style={cardStyle}>
        <ExpandableChartCard title="Bases Con IVA vs Sin IVA" styles={styles} render={(expanded) => (
          <DonutChart items={conIvaVsSinIva} formatter={fmtMoney} size={expanded ? 170 : 100} compact={!expanded} />
        )} />
        <ExpandableChartCard title="Productos vs Servicios Facturados" styles={styles} render={(expanded) => (
          <TwoBarComparison
            labelA="Productos"
            valueA={productosVsServicios.productos}
            labelB="Servicios"
            valueB={productosVsServicios.servicios}
            formatter={fmtMoney2}
            compact={!expanded}
          />
        )} />
        <ExpandableChartCard title="Top 10 Proveedores por Monto Facturado" styles={styles} render={(expanded) => (
          <RankedBarChart items={topProveedores} color="var(--color-chart-accent)" formatter={fmtMoney} minHeight={expanded ? 260 : 100} maxVisibleItems={expanded ? undefined : 5} />
        )} />
      </div>

      <TierHeading title="Detalle y Clasificación" />
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <ExpandableChartCard title="Distribución por Clasificación SRI" styles={styles} render={(expanded) => (
          <Treemap items={porClasificacion} formatter={fmtMoney} height={expanded ? 460 : 170} />
        )} />
        <Card variant="chartCard" styles={styles} style={{ minHeight: 200 }}>
          <h3>% Facturas Anuladas</h3>
          <RadialGauge pct={pctAnulado} label={`${anuladosCount.toLocaleString("es-EC")} anuladas de ${data.length.toLocaleString("es-EC")} facturas`} goodDirection="low" />
        </Card>
      </div>

      <TierHeading title="Tendencia y Concentración" />
      <div className={styles.chartsGridTwo} style={{ ...cardStyle, marginBottom: 0 }}>
        <ExpandableChartCard title="Tendencia Diaria de Facturación" styles={styles} render={(expanded) => (
          <TrendLine points={tendenciaDiaria} formatter={fmtMoney2} color="var(--color-brand-primary)" height={expanded ? 300 : 130} />
        )} />
        <ExpandableChartCard title="Concentración de Facturación por Proveedor (80/20)" styles={styles} render={(expanded) => (
          <ParetoChart items={paretoProveedores} formatter={fmtMoney2} height={expanded ? 420 : 130} />
        )} />
      </div>
    </section>
  );
};
