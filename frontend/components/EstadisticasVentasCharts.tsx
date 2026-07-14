import React, { useMemo, useState } from "react";
import { Card } from "./ui/Card";

interface Props {
  data: any[];
  styles: Record<string, string>;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtNumber(n: number): string {
  return n.toLocaleString("es-EC");
}

function Tooltip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute", background: "#0f172a", color: "#fff", padding: "0.5rem 0.7rem",
        borderRadius: 8, fontSize: "0.72rem", lineHeight: 1.4, whiteSpace: "nowrap",
        pointerEvents: "none", boxShadow: "0 8px 20px rgba(15,23,42,0.3)", zIndex: 10, ...style,
      }}
    >
      {children}
    </div>
  );
}

function TopRankingChart({ items, color, formatter }: { items: { label: string; codigo: string; total: number }[]; color: string; formatter: (n: number) => string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...items.map((it) => it.total), 1);
  const chartHeight = Math.max(180, items.length * 26 + 15);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 500 ${chartHeight}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        {items.map((p, index) => {
          const y = index * 26 + 12;
          const barWidth = (p.total / max) * 300;
          const isHovered = hovered === index;
          const opacity = isHovered ? 1 : 0.5 + (p.total / max) * 0.5;
          return (
            <g key={index} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
              <rect x="0" y={y - 3} width="500" height="23" fill="transparent" />
              <text x="5" y={y + 11} fill="var(--color-text-tertiary)" fontSize="9" fontWeight="600">
                {index + 1}. {p.label.substring(0, 24)}
              </text>
              <rect x="185" y={y} width="225" height="14" rx="4" fill="var(--color-surface-subtle)" />
              <rect x="185" y={y} width={barWidth} height="14" rx="4" fill={color} fillOpacity={opacity} />
              <text x={190 + barWidth} y={y + 11} fill="var(--color-text-tertiary)" fontSize="8.5" fontWeight="700">
                {formatter(p.total)}
              </text>
            </g>
          );
        })}
        {items.length === 0 && (
          <text x="250" y="90" textAnchor="middle" fill="var(--color-text-faint)" fontSize="10">Sin datos en el período</text>
        )}
      </svg>
      {hovered !== null && items[hovered] && (
        <Tooltip style={{ left: "8%", top: `${((hovered * 26 + 12 - 4) / chartHeight) * 100}%`, transform: "translateY(-100%)" }}>
          <strong>{items[hovered].label}</strong>
          <br />Código: {items[hovered].codigo}
        </Tooltip>
      )}
    </div>
  );
}

function ProductoDestacado({ label, producto, valor, color, styles }: { label: string; producto: string; valor: string; color: string; styles: Record<string, string> }) {
  return (
    <Card variant="chartCard" styles={styles} style={{ borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
        {producto || "Sin datos"}
      </div>
      <div style={{ fontSize: "1.3rem", fontWeight: 800, color, marginTop: "0.4rem" }}>
        {valor}
      </div>
    </Card>
  );
}

export const EstadisticasVentasCharts: React.FC<Props> = ({ data, styles }) => {
  const topDolares = useMemo(() => {
    return [...data]
      .sort((a, b) => (Number(b.total_ventas) || 0) - (Number(a.total_ventas) || 0))
      .slice(0, 10)
      .map((r) => ({ label: String(r.producto || r.codigo || ""), codigo: String(r.codigo || ""), total: Number(r.total_ventas) || 0 }));
  }, [data]);

  const topCantidad = useMemo(() => {
    return [...data]
      .sort((a, b) => (Number(b.unidades_vendidas) || 0) - (Number(a.unidades_vendidas) || 0))
      .slice(0, 10)
      .map((r) => ({ label: String(r.producto || r.codigo || ""), codigo: String(r.codigo || ""), total: Number(r.unidades_vendidas) || 0 }));
  }, [data]);

  if (data.length === 0) return null;

  const masVendidoDolares = topDolares[0];
  const masVendidoCantidad = topCantidad[0];

  return (
    <section>
      <div className={styles.chartsGridTwo} style={{ marginBottom: "1.25rem" }}>
        <ProductoDestacado
          label="Producto Más Vendido ($)"
          producto={masVendidoDolares?.label || ""}
          valor={masVendidoDolares ? fmtMoney(masVendidoDolares.total) : "$0"}
          color="var(--color-brand-primary)"
          styles={styles}
        />
        <ProductoDestacado
          label="Producto Más Vendido (Cantidad)"
          producto={masVendidoCantidad?.label || ""}
          valor={masVendidoCantidad ? `${fmtNumber(masVendidoCantidad.total)} unidades` : "0 unidades"}
          color="var(--color-success-dark)"
          styles={styles}
        />
      </div>
      <div className={styles.chartsGridTwo}>
        <Card variant="chartCard" styles={styles}>
          <h3>Top 10 Productos Más Vendidos ($)</h3>
          <TopRankingChart items={topDolares} color="var(--color-brand-primary)" formatter={fmtMoney} />
        </Card>
        <Card variant="chartCard" styles={styles}>
          <h3>Top 10 Productos Más Vendidos (Cantidad)</h3>
          <TopRankingChart items={topCantidad} color="var(--color-success-dark)" formatter={fmtNumber} />
        </Card>
      </div>
    </section>
  );
};
