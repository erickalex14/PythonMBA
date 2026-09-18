import React, { useMemo, useState } from "react";
import { Card } from "./ui/Card";
import { ExpandableChartCard } from "./charts/ChartPrimitives";
import { esProductoRuido } from "../lib/productoRuido";

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
          const trackWidth = 295;
          const barWidth = (p.total / max) * trackWidth;
          const isHovered = hovered === index;
          const opacity = isHovered ? 1 : 0.5 + (p.total / max) * 0.5;
          return (
            <g key={index} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
              <rect x="0" y={y - 3} width="500" height="23" fill="transparent" />
              <text x="5" y={y + 11} fill="var(--color-text-tertiary)" fontSize="9" fontWeight="600">
                {index + 1}. {p.codigo || p.label.substring(0, 20)}
              </text>
              <rect x="115" y={y} width={trackWidth} height="14" rx="4" fill="var(--color-surface-subtle)" />
              <rect x="115" y={y} width={barWidth} height="14" rx="4" fill={color} fillOpacity={opacity} />
              <text x={120 + barWidth} y={y + 11} fill="var(--color-text-tertiary)" fontSize="8.5" fontWeight="700">
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

// Arma un Top 10 por un campo numerico (total_ventas / unidades_vendidas),
// opcionalmente acotado a una empresa (NVC01/ENV01 -- viene en `row.empresa`,
// cada producto trae una fila por empresa que lo vendio). Sin `empresa`
// junta ambas, para las tarjetas "Producto Más Vendido" de arriba.
function construirTop(
  rows: any[],
  campo: "total_ventas" | "unidades_vendidas",
  empresa?: string
) {
  return rows
    .filter((r) => !esProductoRuido(r.producto))
    .filter((r) => !empresa || String(r.empresa).trim() === empresa)
    .sort((a, b) => (Number(b[campo]) || 0) - (Number(a[campo]) || 0))
    .slice(0, 10)
    .map((r) => ({ label: String(r.producto || r.codigo || ""), codigo: String(r.codigo || ""), total: Number(r[campo]) || 0 }));
}

const EMPRESAS_TOP = [
  { codigo: "NVC01" as const, etiqueta: "Novicompu" },
  { codigo: "ENV01" as const, etiqueta: "ENV" },
];

export const EstadisticasVentasCharts: React.FC<Props> = ({ data, styles }) => {
  const [empresaTop, setEmpresaTop] = useState<"NVC01" | "ENV01">("NVC01");

  const topDolares = useMemo(() => construirTop(data, "total_ventas"), [data]);
  const topCantidad = useMemo(() => construirTop(data, "unidades_vendidas"), [data]);

  // Los 4 se calculan siempre (son baratos) para que cambiar el switch no
  // tenga que esperar un recalculo -- solo se elige cual par se muestra.
  const topDolaresNovicompu = useMemo(() => construirTop(data, "total_ventas", "NVC01"), [data]);
  const topDolaresEnv = useMemo(() => construirTop(data, "total_ventas", "ENV01"), [data]);
  const topCantidadNovicompu = useMemo(() => construirTop(data, "unidades_vendidas", "NVC01"), [data]);
  const topCantidadEnv = useMemo(() => construirTop(data, "unidades_vendidas", "ENV01"), [data]);

  const topDolaresActivo = empresaTop === "NVC01" ? topDolaresNovicompu : topDolaresEnv;
  const topCantidadActivo = empresaTop === "NVC01" ? topCantidadNovicompu : topCantidadEnv;
  const etiquetaEmpresa = EMPRESAS_TOP.find((e) => e.codigo === empresaTop)?.etiqueta || empresaTop;

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
      {/* Switch compartido: elige la empresa para los 2 Top 10 de abajo, en
          vez de mostrar las 4 combinaciones (Novicompu/ENV x $/Cantidad) a
          la vez -- ocupaba demasiado espacio vertical. */}
      <div style={{ display: "inline-flex", background: "var(--color-surface-subtle)", borderRadius: "var(--radius-pill)", padding: "0.25rem", gap: "0.25rem", marginBottom: "1rem" }}>
        {EMPRESAS_TOP.map((e) => (
          <button
            key={e.codigo}
            type="button"
            onClick={() => setEmpresaTop(e.codigo)}
            className={empresaTop === e.codigo ? styles.vistaSwitchBtnActive : undefined}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "0.45rem 1.1rem",
              borderRadius: "var(--radius-pill)",
              fontSize: "0.8rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
              background: empresaTop === e.codigo
                ? "linear-gradient(135deg, var(--color-brand-primary) 0%, var(--color-brand-primary-alt) 100%)"
                : "transparent",
              color: empresaTop === e.codigo ? undefined : "var(--color-text-tertiary)",
            }}
          >
            {e.etiqueta}
          </button>
        ))}
      </div>
      <div className={styles.chartsGridTwo}>
        <ExpandableChartCard title={`Top 10 Más Vendidos ($) · ${etiquetaEmpresa}`} styles={styles} render={() => (
          <TopRankingChart items={topDolaresActivo} color="var(--color-brand-primary)" formatter={fmtMoney} />
        )} />
        <ExpandableChartCard title={`Top 10 Más Vendidos (Cantidad) · ${etiquetaEmpresa}`} styles={styles} render={() => (
          <TopRankingChart items={topCantidadActivo} color="var(--color-success-dark)" formatter={fmtNumber} />
        )} />
      </div>
    </section>
  );
};
