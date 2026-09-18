import React from "react";
import { Card } from "./Card";

interface KpiTileProps {
  styles: Record<string, string>;
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  footnote?: React.ReactNode;
}

// Tarjeta KPI genérica (label + ícono + valor grande + pie opcional) --
// extraída de las 7 tarjetas que costos-bodega/page.tsx tenía copy-paste
// inline, para poder registrarlas como tarjetas independientes en
// <DashboardGrid>. Mismo markup que tenían antes, solo parametrizado.
export const KpiTile: React.FC<KpiTileProps> = ({ styles, title, value, icon, iconBg, footnote }) => (
  <Card variant="kpiCard" styles={styles} style={{ height: "100%" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <h3>{title}</h3>
      <div style={{ background: iconBg, padding: "0.45rem", borderRadius: "8px", display: "flex", flexShrink: 0 }}>
        {icon}
      </div>
    </div>
    <p className={styles.kpiValue}>{value}</p>
    {footnote && (
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text-muted)",
          borderTop: "1px solid var(--color-surface-subtle)",
          paddingTop: "0.45rem",
          marginTop: "0.25rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {footnote}
      </div>
    )}
  </Card>
);
