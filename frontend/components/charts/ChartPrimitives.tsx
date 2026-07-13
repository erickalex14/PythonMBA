import React, { useState } from "react";

export function ChartTooltip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        background: "#0f172a",
        color: "#ffffff",
        padding: "0.5rem 0.7rem",
        borderRadius: 8,
        fontSize: "0.72rem",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.3)",
        zIndex: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function RankedBarChart({
  items,
  color,
  formatter,
}: {
  items: { label: string; total: number }[];
  color: string;
  formatter: (n: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...items.map((it) => it.total), 1);
  const chartHeight = Math.max(200, items.length * 22 + 20);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 500 ${chartHeight}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        {items.map((p, index) => {
          const y = index * 22 + 15;
          const barWidth = (p.total / max) * 310;
          const isHovered = hovered === index;
          const opacity = isHovered ? 1 : 0.45 + (p.total / max) * 0.55;
          return (
            <g
              key={index}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <rect x="0" y={y - 2} width="500" height="19" fill="transparent" />
              <text x="5" y={y + 11} fill="var(--color-text-tertiary)" fontSize="9" fontWeight="600">
                {p.label.substring(0, 11)}
              </text>
              <rect x="90" y={y} width="320" height="13" rx="4" fill="var(--color-surface-subtle)" />
              <rect x="90" y={y} width={barWidth} height="13" rx="4" fill={color} fillOpacity={opacity} />
              <text x={95 + barWidth} y={y + 11} fill="var(--color-text-tertiary)" fontSize="8.5" fontWeight="700">
                {formatter(p.total)}
              </text>
            </g>
          );
        })}
        {items.length === 0 && (
          <text x="250" y="100" textAnchor="middle" fill="var(--color-text-faint)" fontSize="10">
            Sin datos en el período
          </text>
        )}
      </svg>
      {hovered !== null && items[hovered] && (
        <ChartTooltip
          style={{
            left: "5%",
            top: `${((hovered * 22 + 15 - 4) / chartHeight) * 100}%`,
            transform: "translateY(-100%)",
          }}
        >
          {items[hovered].label}
        </ChartTooltip>
      )}
    </div>
  );
}

export function TierHeading({ title, first }: { title: string; first?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        margin: first ? "0 0 1rem" : "2.25rem 0 1rem",
        paddingBottom: "0.6rem",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <h2
        style={{
          fontSize: "0.8rem",
          fontWeight: 800,
          color: "var(--color-chart-accent)",
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

// Comparativa de dos barras horizontales (ej. Entradas vs Salidas, Con IVA vs
// Sin IVA) - mismo lenguaje visual que ComparisonMiniCard de DailySalesDashboard
// pero como pieza standalone para insertar dentro de una Card ya existente.
export function TwoBarComparison({
  labelA,
  valueA,
  labelB,
  valueB,
  formatter,
}: {
  labelA: string;
  valueA: number;
  labelB: string;
  valueB: number;
  formatter: (n: number) => string;
}) {
  const max = Math.max(valueA, valueB, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "0.5rem" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
          <span>{labelA}</span>
          <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{formatter(valueA)}</span>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: "var(--color-surface-subtle)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(valueA / max) * 100}%`, background: "var(--color-chart-accent)", borderRadius: 6 }} />
        </div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
          <span>{labelB}</span>
          <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{formatter(valueB)}</span>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: "var(--color-surface-subtle)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(valueB / max) * 100}%`, background: "var(--color-text-faint)", borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

// Indicador tipo gauge de una sola metrica en % (ej. % Devoluciones, % Anulado)
export function StatGauge({
  pct,
  label,
  goodDirection = "low",
}: {
  pct: number;
  label: string;
  goodDirection?: "low" | "high";
}) {
  const isGood = goodDirection === "low" ? pct <= 10 : pct >= 90;
  const isWarn = goodDirection === "low" ? pct <= 25 : pct >= 75;
  const color = isGood ? "var(--color-success-dark)" : isWarn ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <div style={{ padding: "0.5rem 0" }}>
      <div style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1 }}>{pct.toFixed(1)}%</div>
      <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: "0.4rem" }}>{label}</div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--color-surface-subtle)", overflow: "hidden", marginTop: "0.6rem" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

// Pareto 80/20 generico: barras normalizadas al propio maximo + linea de %
// acumulado real, con corte marcado donde se alcanza el 80%.
export function ParetoChart({
  items,
  formatter,
}: {
  items: { key: string; label: string; value: number }[];
  formatter: (n: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  let acc = 0;
  const withCum = items.map((it) => {
    acc += it.value;
    return { ...it, cumPct: (acc / total) * 100 };
  });
  const maxVal = Math.max(...withCum.map((i) => i.value), 1);
  const W = 500, H = 260, pad = 30;
  const barAreaW = W - pad * 2;
  const barW = withCum.length ? Math.min(barAreaW / withCum.length - 4, 26) : 0;
  const toXCenter = (i: number) => pad + (i + 0.5) * (barAreaW / (withCum.length || 1));
  const toY = (pctOfMax: number) => H - pad - (pctOfMax / 100) * (H - pad * 2 - 10);
  const cutIdx = withCum.findIndex((it) => it.cumPct >= 80);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 620, margin: "0 auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 260, overflow: "visible" }}>
        {[0, 25, 50, 75, 100].map((p) => (
          <line key={p} x1={pad} y1={toY(p)} x2={W - pad} y2={toY(p)} stroke="var(--color-surface-subtle)" strokeWidth="1" />
        ))}
        {cutIdx >= 0 && (
          <line x1={toXCenter(cutIdx)} y1={pad} x2={toXCenter(cutIdx)} y2={H - pad} stroke="var(--color-warning)" strokeDasharray="4 4" strokeWidth="1.3" />
        )}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-border-strong)" strokeWidth="1" />
        {withCum.map((it, i) => {
          const hBar = (it.value / maxVal) * 100;
          const x = toXCenter(i) - barW / 2;
          const y = toY(hBar);
          const isHovered = hovered === i;
          return (
            <rect
              key={it.key} x={x} y={y} width={barW} height={H - pad - y} rx="3"
              fill="var(--color-brand-primary)" fillOpacity={isHovered ? 1 : 0.7}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            />
          );
        })}
        {withCum.length > 0 && (
          <path
            d={`M ${withCum.map((it, i) => `${toXCenter(i)} ${toY(it.cumPct)}`).join(" L ")}`}
            fill="none" stroke="var(--color-chart-accent)" strokeWidth="2" strokeLinecap="round"
          />
        )}
        {withCum.map((it, i) => (
          <circle key={`c-${it.key}`} cx={toXCenter(i)} cy={toY(it.cumPct)} r="2.5" fill="var(--color-chart-accent)" />
        ))}
        <text x={pad - 4} y={toY(100) + 3} textAnchor="end" fontSize="8" fill="var(--color-text-faint)">100%</text>
        <text x={pad - 4} y={toY(80) + 3} textAnchor="end" fontSize="8" fill="var(--color-warning)">80%</text>
        <text x={pad - 4} y={toY(0) + 3} textAnchor="end" fontSize="8" fill="var(--color-text-faint)">0%</text>
      </svg>
      {withCum.length === 0 && (
        <div style={{ fontSize: "0.8rem", color: "var(--color-text-faint)", textAlign: "center", padding: "1rem" }}>Sin datos en el período</div>
      )}
      {cutIdx >= 0 && (
        <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.4rem" }}>
          <strong>{cutIdx + 1}</strong> de {withCum.length} sostienen el 80% del total.
        </div>
      )}
      {hovered !== null && (
        <ChartTooltip style={{ left: `${(toXCenter(hovered) / W) * 100}%`, top: 0, transform: "translateX(-50%)" }}>
          <strong>{withCum[hovered].label}</strong>
          <br />{formatter(withCum[hovered].value)}
          <br />Acumulado: {withCum[hovered].cumPct.toFixed(1)}%
        </ChartTooltip>
      )}
    </div>
  );
}

// Tendencia diaria simple (una sola serie), con hover.
export function TrendLine({
  points,
  formatter,
  color,
}: {
  points: { x: string; y: number }[];
  formatter: (n: number) => string;
  color: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 500, H = 200, pad = 20;
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const minY = Math.min(...points.map((p) => p.y), 0);
  const span = maxY - minY || 1;
  const toX = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * (W - 100) + 50 : W / 2);
  const toY = (v: number) => H - pad - ((v - minY) / span) * (H - pad * 2);

  if (points.length === 0) {
    return <div style={{ fontSize: "0.8rem", color: "var(--color-text-faint)", padding: "1rem", textAlign: "center" }}>Sin datos en el período</div>;
  }

  const path = `M ${points.map((p, i) => `${toX(i)} ${toY(p.y)}`).join(" L ")}`;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <line x1="50" y1={H - pad} x2={W - 20} y2={H - pad} stroke="var(--color-border)" strokeWidth="1" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={i} cx={toX(i)} cy={toY(p.y)} r={hovered === i ? 4.5 : 3}
            fill="var(--color-surface)" stroke={color} strokeWidth="1.5"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          />
        ))}
        <text x="50" y={H - 4} fontSize="8" fill="var(--color-text-faint)">{points[0].x.substring(5)}</text>
        {points.length > 1 && (
          <text x={W - 20} y={H - 4} textAnchor="end" fontSize="8" fill="var(--color-text-faint)">
            {points[points.length - 1].x.substring(5)}
          </text>
        )}
      </svg>
      {hovered !== null && (
        <ChartTooltip style={{ left: `${(toX(hovered) / W) * 100}%`, top: 0, transform: "translate(-50%, -100%)" }}>
          <strong>{points[hovered].x}</strong>
          <br />{formatter(points[hovered].y)}
        </ChartTooltip>
      )}
    </div>
  );
}
