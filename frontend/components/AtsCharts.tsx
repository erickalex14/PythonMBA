import React, { useMemo } from "react";
import { Card } from "./ui/Card";
import { RankedBarChart, TierHeading, TwoBarComparison, StatGauge, ParetoChart, TrendLine } from "./charts/ChartPrimitives";

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

  const productosVsServicios = useMemo(() => {
    let productos = 0;
    let servicios = 0;
    data.forEach((row) => {
      productos += num(row, "TotalProductosConIVa") + num(row, "TotalProductosSinIVa");
      servicios += num(row, "TotalServiciosConIVa") + num(row, "TotalServiciosSinIVa");
    });
    return { productos, servicios };
  }, [data]);

  const conIvaVsSinIva = useMemo(() => {
    let conIva = 0;
    let sinIva = 0;
    data.forEach((row) => {
      conIva += num(row, "SUMA_CON_IVA");
      sinIva += num(row, "SUMA_SIN_IVA");
    });
    return { conIva, sinIva };
  }, [data]);

  const topProveedores = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const proveedor = str(row, "VENDOR_NAME") || "Sin Proveedor";
      map[proveedor] = (map[proveedor] || 0) + num(row, "INVOICE_TOTAL");
    });
    return Object.entries(map)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [data]);

  const porClasificacion = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const clasif = str(row, "MF_Lista2");
      if (!clasif) return;
      map[clasif] = (map[clasif] || 0) + num(row, "INVOICE_TOTAL");
    });
    return Object.entries(map)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [data]);

  const pctAnulado = useMemo(() => {
    const anulados = data.filter((row) => Number(row.ES_ANULADO) === 1).length;
    return data.length > 0 ? (anulados / data.length) * 100 : 0;
  }, [data]);
  const anuladosCount = useMemo(() => data.filter((row) => Number(row.ES_ANULADO) === 1).length, [data]);

  const tendenciaDiaria = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const f = str(row, "INVOICE_DATE");
      if (!f) return;
      map[f] = (map[f] || 0) + num(row, "INVOICE_TOTAL");
    });
    return Object.entries(map)
      .map(([x, y]) => ({ x, y }))
      .sort((a, b) => a.x.localeCompare(b.x));
  }, [data]);

  const paretoProveedores = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((row) => {
      const proveedor = str(row, "VENDOR_NAME") || "Sin Proveedor";
      map[proveedor] = (map[proveedor] || 0) + num(row, "INVOICE_TOTAL");
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
          <h3>Productos vs Servicios Facturados</h3>
          <TwoBarComparison
            labelA="Productos"
            valueA={productosVsServicios.productos}
            labelB="Servicios"
            valueB={productosVsServicios.servicios}
            formatter={fmtMoney2}
          />
        </Card>
        <Card variant="chartCard" styles={styles}>
          <h3>Bases Con IVA vs Sin IVA</h3>
          <TwoBarComparison
            labelA="Con IVA"
            valueA={conIvaVsSinIva.conIva}
            labelB="Sin IVA"
            valueB={conIvaVsSinIva.sinIva}
            formatter={fmtMoney2}
          />
        </Card>
      </div>
      <Card variant="chartCard" styles={styles} style={cardStyle}>
        <h3>Top 10 Proveedores por Monto Facturado</h3>
        <RankedBarChart items={topProveedores} color="var(--color-chart-accent)" formatter={fmtMoney} />
      </Card>

      <TierHeading title="Detalle y Clasificación" />
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <Card variant="chartCard" styles={styles}>
          <h3>Distribución por Clasificación SRI</h3>
          <RankedBarChart items={porClasificacion} color="var(--color-chart-accent)" formatter={fmtMoney} />
        </Card>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 280 }}>
          <h3>% Facturas Anuladas</h3>
          <StatGauge pct={pctAnulado} label={`${anuladosCount.toLocaleString("es-EC")} anuladas de ${data.length.toLocaleString("es-EC")} facturas`} goodDirection="low" />
        </Card>
      </div>

      <TierHeading title="Tendencia y Concentración" />
      <div className={styles.chartsGridTwo} style={{ ...cardStyle, marginBottom: 0 }}>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 300 }}>
          <h3>Tendencia Diaria de Facturación</h3>
          <TrendLine points={tendenciaDiaria} formatter={fmtMoney2} color="var(--color-brand-primary)" />
        </Card>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 300 }}>
          <h3>Concentración de Facturación por Proveedor (80/20)</h3>
          <ParetoChart items={paretoProveedores} formatter={fmtMoney2} />
        </Card>
      </div>
    </section>
  );
};