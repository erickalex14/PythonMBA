import React, { useMemo } from "react";
import { Card } from "./ui/Card";

interface KPICardsProps {
  filteredData: any[];
  activeTab: string;
  styles: any;
}

export const KPICards: React.FC<KPICardsProps> = ({ filteredData, activeTab, styles }) => {
  const kpis = useMemo(() => {
    const totalRecords = filteredData.length;
    let mainMetricLabel = "Métrica Principal";
    let mainMetricValue = "$0.00";
    let secondMetricLabel = "Segunda Métrica";
    let secondMetricValue = "0";

    if (activeTab === "movimientos") {
      mainMetricLabel = "Total Cantidad Movimientos";
      const totalQty = filteredData.reduce((acc, row) => acc + (Number(row.ORIGINAL_QTY) || 0), 0);
      mainMetricValue = totalQty.toLocaleString("es-EC", { maximumFractionDigits: 2 });
      
      secondMetricLabel = "Base de Comisión Real";
      const totalComision = filteredData.reduce((acc, row) => acc + (Number(row.BASE_COMISION) || 0), 0);
      secondMetricValue = totalComision.toLocaleString("es-EC", { style: "currency", currency: "USD" });
    } else if (activeTab === "liquidaciones") {
      mainMetricLabel = "Valor Total CIF Acumulado";
      const totalCif = filteredData.reduce((acc, row) => acc + (Number(row.VALOR_TOTAL_CIF) || 0), 0);
      mainMetricValue = totalCif.toLocaleString("es-EC", { style: "currency", currency: "USD" });

      secondMetricLabel = "Total Unidades Importadas";
      const totalUnits = filteredData.reduce((acc, row) => acc + (Number(row.CANTIDAD) || 0), 0);
      secondMetricValue = totalUnits.toLocaleString("es-EC", { maximumFractionDigits: 0 });
    } else if (activeTab === "ats") {
      mainMetricLabel = "Monto Facturado Total (ATS)";
      const totalInvoice = filteredData.reduce((acc, row) => acc + (Number(row.INVOICE_TOTAL) || 0), 0);
      mainMetricValue = totalInvoice.toLocaleString("es-EC", { style: "currency", currency: "USD" });

      secondMetricLabel = "Suma Bases con IVA";
      const totalIva = filteredData.reduce((acc, row) => acc + (Number(row.SUMA_CON_IVA) || 0), 0);
      secondMetricValue = totalIva.toLocaleString("es-EC", { style: "currency", currency: "USD" });
    } else if (activeTab === "ventas") {
      mainMetricLabel = "Monto Total Ventas";
      const totalVentas = filteredData.reduce((acc, row) => acc + (Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0), 0);
      mainMetricValue = totalVentas.toLocaleString("es-EC", { style: "currency", currency: "USD" });

      secondMetricLabel = "Total Unidades Vendidas";
      const totalUnits = filteredData.reduce((acc, row) => acc + (Number(row.cantidad) || Number(row.CANTIDAD) || 0), 0);
      secondMetricValue = totalUnits.toLocaleString("es-EC", { maximumFractionDigits: 0 });
    }

    return { totalRecords, mainMetricLabel, mainMetricValue, secondMetricLabel, secondMetricValue };
  }, [filteredData, activeTab]);

  if (activeTab === "logs" || activeTab === "admin" || activeTab === "sync" || filteredData.length === 0) {
    return null;
  }

  return (
    <section className={styles.kpiGrid}>
      <Card variant="kpiCard" styles={styles}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3>Registros Encontrados</h3>
          <div style={{ background: "#eff6ff", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#005DAA" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
        </div>
        <p className={styles.kpiValue}>{kpis.totalRecords.toLocaleString()}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#70b92b" strokeWidth="3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          <span style={{ color: "#70b92b", fontWeight: "700" }}>+8.3%</span>
          <span>vs. mes anterior</span>
        </div>
      </Card>

      <Card variant="kpiCard" styles={styles}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3>{kpis.mainMetricLabel}</h3>
          <div style={{ background: "#f4fbef", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#70b92b" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <p className={styles.kpiValue}>{kpis.mainMetricValue}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#70b92b" strokeWidth="3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          <span style={{ color: "#70b92b", fontWeight: "700" }}>+12.6%</span>
          <span>vs. mes anterior</span>
        </div>
      </Card>

      <Card variant="kpiCard" styles={styles}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3>{kpis.secondMetricLabel}</h3>
          <div style={{ background: "#f5f3ff", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
        </div>
        <p className={styles.kpiValue}>{kpis.secondMetricValue}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
          <span style={{ color: "#dc2626", fontWeight: "700" }}>-3.2%</span>
          <span>vs. mes anterior</span>
        </div>
      </Card>
    </section>
  );
};
