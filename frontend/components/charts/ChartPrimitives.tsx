import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

// Mide el ancho real en px del contenedor via ResizeObserver - se usa para
// que el viewBox del SVG coincida exactamente con el ancho renderizado (en
// vez de un ancho fijo tipo "500 unidades") y asi evitar el letterboxing de
// preserveAspectRatio="meet" (barras vacias a los costados cuando la tarjeta
// es mas ancha que el viewBox fijo).
function useMeasuredWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";

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
  minHeight = 200,
  maxVisibleItems,
}: {
  items: { label: string; total: number }[];
  color: string;
  formatter: (n: number) => string;
  // Piso del viewBox en unidades SVG - baja este valor cuando el listado
  // tiene muy pocos items (ej. 2 empresas) para no dejar un tramo vacio
  // dentro del propio SVG (el vacio queda "adentro" del viewBox, no es
  // espacio de layout externo, asi que envolver en flex/centrar no alcanza).
  minHeight?: number;
  // El alto real escala con la cantidad de items (22px c/u), asi que
  // minHeight solo pone un piso, nunca un techo - una lista de 10 items
  // sigue siendo alta aunque minHeight sea chico (vista "compacta" real).
  // maxVisibleItems corta la lista mostrada para sí limitar el alto en la
  // vista compacta; el resto queda disponible al expandir (sin este prop).
  maxVisibleItems?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const visibleItems = maxVisibleItems ? items.slice(0, maxVisibleItems) : items;
  const hiddenCount = items.length - visibleItems.length;
  const max = Math.max(...items.map((it) => it.total), 1);
  const chartHeight = Math.max(minHeight, visibleItems.length * 22 + 20);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 500 ${chartHeight}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        {visibleItems.map((p, index) => {
          const y = index * 22 + 15;
          const barWidth = (p.total / max) * 310;
          const isHovered = hovered === index;
          const opacity = isHovered ? 1 : 0.45 + (p.total / max) * 0.55;
          return (
            <motion.g
              key={index}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: index * 0.03, ease: "easeOut" }}
            >
              <rect x="0" y={y - 2} width="500" height="19" fill="transparent" />
              <text x="5" y={y + 11} fill="var(--color-text-tertiary)" fontSize="9" fontWeight="600">
                {p.label.substring(0, 11)}
              </text>
              <rect x="90" y={y} width="320" height="13" rx="4" fill="var(--color-surface-subtle)" />
              <motion.rect
                x="90" y={y} height="13" rx="4" fill={color}
                initial={{ width: 0 }}
                animate={{ width: barWidth, fillOpacity: opacity }}
                transition={{ width: { duration: 0.5, delay: 0.1 + index * 0.03, ease: "easeOut" }, fillOpacity: { duration: 0.15 } }}
              />
              <text x={95 + barWidth} y={y + 11} fill="var(--color-text-tertiary)" fontSize="8.5" fontWeight="700">
                {formatter(p.total)}
              </text>
            </motion.g>
          );
        })}
        {items.length === 0 && (
          <text x="250" y="100" textAnchor="middle" fill="var(--color-text-faint)" fontSize="10">
            Sin datos en el período
          </text>
        )}
      </svg>
      {hiddenCount > 0 && (
        <div style={{ fontSize: "0.7rem", color: "var(--color-text-faint)", marginTop: "0.35rem", textAlign: "center" }}>
          +{hiddenCount} más — click para ver todos
        </div>
      )}
      {hovered !== null && visibleItems[hovered] && (
        <ChartTooltip
          style={{
            left: "5%",
            top: `${((hovered * 22 + 15 - 4) / chartHeight) * 100}%`,
            transform: "translateY(-100%)",
          }}
        >
          {visibleItems[hovered].label}
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
  compact = false,
}: {
  labelA: string;
  valueA: number;
  labelB: string;
  valueB: number;
  formatter: (n: number) => string;
  compact?: boolean;
}) {
  const max = Math.max(valueA, valueB, 1);
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } } }}
      style={{ display: "flex", flexDirection: "column", gap: compact ? "0.6rem" : "0.9rem", marginTop: compact ? "0.25rem" : "0.5rem" }}
    >
      <motion.div variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
          <span>{labelA}</span>
          <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{formatter(valueA)}</span>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: "var(--color-surface-subtle)", overflow: "hidden" }}>
          <motion.div
            style={{ height: "100%", background: "var(--color-chart-accent)", borderRadius: 6 }}
            initial={{ width: 0 }} animate={{ width: `${(valueA / max) * 100}%` }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          />
        </div>
      </motion.div>
      <motion.div variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
          <span>{labelB}</span>
          <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{formatter(valueB)}</span>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: "var(--color-surface-subtle)", overflow: "hidden" }}>
          <motion.div
            style={{ height: "100%", background: "var(--color-text-faint)", borderRadius: 6 }}
            initial={{ width: 0 }} animate={{ width: `${(valueB / max) * 100}%` }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          />
        </div>
      </motion.div>
    </motion.div>
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
// Curva suave (Catmull-Rom -> Bezier) para la línea acumulada del Pareto -
// en vez de segmentos rectos entre puntos, que se ven quebrados/duros.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function ParetoChart({
  items,
  formatter,
  height = 260,
}: {
  items: { key: string; label: string; value: number }[];
  formatter: (n: number) => string;
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  let acc = 0;
  const withCum = items.map((it) => {
    acc += it.value;
    return { ...it, cumPct: (acc / total) * 100 };
  });
  const maxVal = Math.max(...withCum.map((i) => i.value), 1);
  const W = 500, H = height, pad = 30;
  const barAreaW = W - pad * 2;
  const barW = withCum.length ? Math.min(barAreaW / withCum.length - 4, 26) : 0;
  const toXCenter = (i: number) => pad + (i + 0.5) * (barAreaW / (withCum.length || 1));
  const toY = (pctOfMax: number) => H - pad - (pctOfMax / 100) * (H - pad * 2 - 10);
  const cutIdx = withCum.findIndex((it) => it.cumPct >= 80);
  const linePoints = withCum.map((it, i) => ({ x: toXCenter(i), y: toY(it.cumPct) }));
  const linePath = smoothPath(linePoints);
  const areaPath = linePoints.length
    ? `${linePath} L ${linePoints[linePoints.length - 1].x} ${H - pad} L ${linePoints[0].x} ${H - pad} Z`
    : "";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* height:"auto" (no valor fijo en px) - igual que RankedBarChart/
          TrendLine, para que el alto real escale con el ancho real de la
          columna. Un alto fijo en px aca desalinea el par cuando la
          ventana es mas angosta (RankedBarChart se achica, este se queda
          igual), generando un hueco vacio dependiente del viewport. */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="paretoAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-accent)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--color-chart-accent)" stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((p) => (
          <line key={p} x1={pad} y1={toY(p)} x2={W - pad} y2={toY(p)} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" />
        ))}
        {cutIdx >= 0 && (
          <motion.line
            x1={toXCenter(cutIdx)} y1={pad} x2={toXCenter(cutIdx)} y2={H - pad}
            stroke="var(--color-warning)" strokeDasharray="4 4" strokeWidth="1.3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }}
          />
        )}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-border-strong)" strokeWidth="1" />

        {/* Las barras ya NO disparan el hover/tooltip por sí solas - antes
            pasar el mouse en cualquier punto de una barra alta (lejos del
            punto real de la línea acumulada) abría el tooltip con el globo
            desalineado del cursor. Ahora solo el punto (círculo, con un área
            de click más grande e invisible alrededor) responde al hover. */}
        {withCum.map((it, i) => {
          const hBar = (it.value / maxVal) * 100;
          const x = toXCenter(i) - barW / 2;
          const y = toY(hBar);
          const isHovered = hovered === i;
          return (
            <motion.rect
              key={it.key} x={x} width={barW} rx={barW / 2}
              fill="var(--color-brand-primary)"
              initial={{ height: 0, y: H - pad, fillOpacity: 0.7 }}
              animate={{ height: H - pad - y, y, fillOpacity: isHovered ? 1 : 0.7 }}
              transition={{
                height: { duration: 0.55, delay: i * 0.035, ease: "easeOut" },
                y: { duration: 0.55, delay: i * 0.035, ease: "easeOut" },
                fillOpacity: { duration: 0.15 },
              }}
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        {areaPath && (
          <motion.path
            d={areaPath} fill="url(#paretoAreaFill)" stroke="none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}
          />
        )}
        {linePath && (
          <motion.path
            d={linePath} fill="none" stroke="var(--color-chart-accent)" strokeWidth="2.25" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }}
          />
        )}
        {withCum.map((it, i) => (
          <g key={`c-${it.key}`}>
            {/* Círculo invisible más grande, centrado exacto en el punto -
                agranda el área clickeable sin mover el punto de disparo del
                tooltip fuera de la línea. */}
            <circle
              cx={toXCenter(i)} cy={toY(it.cumPct)} r="9" fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            />
            <motion.circle
              cx={toXCenter(i)} cy={toY(it.cumPct)}
              r={hovered === i ? 4.5 : 2.5} fill="var(--color-chart-accent)" stroke="var(--color-surface)" strokeWidth={hovered === i ? 1.5 : 0}
              initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.03, duration: 0.3, r: { duration: 0.12 } }}
              style={{ pointerEvents: "none" }}
            />
          </g>
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

// Paleta categórica fija (reutiliza tokens de estado ya existentes) para
// Donut/Treemap - evita inventar colores nuevos fuera del sistema.
const CATEGORY_PALETTE = [
  "var(--color-chart-accent)",
  "var(--color-brand-primary)",
  "var(--color-success-dark)",
  "var(--color-warning)",
  "var(--color-danger)",
  "var(--color-text-tertiary)",
  "var(--color-text-faint)",
  "var(--color-brand-accent)",
];

// Donut chart con leyenda - para distribuciones de pocas categorías (2-8)
// donde ver la proporción del total importa más que comparar magnitudes
// exactas entre sí (para eso ya está RankedBarChart).
export function DonutChart({
  items,
  formatter,
  size = 170,
  compact = false,
}: {
  items: { label: string; value: number }[];
  formatter: (n: number) => string;
  size?: number;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  const R = 60, CX = 70, CY = 70, STROKE = 26;
  const circumference = 2 * Math.PI * R;

  let acc = 0;
  const arcs = items.map((it, i) => {
    const frac = it.value / total;
    const dash = frac * circumference;
    const offset = acc * circumference;
    acc += frac;
    return { ...it, dash, offset, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length], pct: frac * 100 };
  });

  if (items.length === 0 || total === 0) {
    return <div style={{ fontSize: "0.8rem", color: "var(--color-text-faint)", textAlign: "center", padding: "1rem" }}>Sin datos en el período</div>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? "1rem" : "2rem", flexWrap: "wrap", padding: compact ? "0.25rem 0" : "0.5rem 0" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={size} height={size} viewBox="0 0 140 140">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-surface-subtle)" strokeWidth={STROKE} />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={STROKE}
              // Un solo arco al 100% no debe llevar dasharray: "circumference 0"
              // deja una costura visible por el redondeo de punto flotante de
              // la circunferencia (irracional, 2*pi*R) - un circulo solido sin
              // dasharray se ve completo sin ese artefacto.
              {...(arcs.length > 1 ? {
                strokeDasharray: `${a.dash} ${circumference - a.dash}`,
                strokeDashoffset: -a.offset,
              } : {})}
              strokeOpacity={hovered === null || hovered === i ? 1 : 0.35}
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{ cursor: "pointer", transition: "stroke-opacity 0.15s ease" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          {hovered !== null ? (
            <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-text-primary)" }}>{arcs[hovered].pct.toFixed(0)}%</span>
          ) : arcs.length === 1 ? (
            <>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-text-primary)" }}>100%</span>
              <span style={{ fontSize: "0.62rem", color: "var(--color-text-faint)", maxWidth: 80, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {arcs[0].label}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div style={{ width: compact ? 150 : 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: compact ? "0.35rem" : "0.6rem" }}>
        {arcs.map((a, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", opacity: hovered === null || hovered === i ? 1 : 0.5 }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flexShrink: 0 }} />
            <span style={{ fontSize: compact ? "0.7rem" : "0.76rem", color: "var(--color-text-tertiary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.label}
            </span>
            <span style={{ fontSize: compact ? "0.7rem" : "0.76rem", fontWeight: 700, color: "var(--color-text-primary)", flexShrink: 0 }}>{formatter(a.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gauge radial (arco de 270°) para una métrica en % - misma info que
// StatGauge pero con forma circular, para no repetir la misma silueta de
// barra horizontal en cada tarjeta de indicador.
export function RadialGauge({
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

  const R = 54, CX = 65, CY = 65;
  const startAngle = 135, sweep = 270;
  const angleToXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  };
  const describeArc = (fracOfSweep: number) => {
    const endDeg = startAngle + sweep * fracOfSweep;
    const start = angleToXY(startAngle);
    const end = angleToXY(endDeg);
    const largeArc = sweep * fracOfSweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  return (
    <motion.div
      style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <svg width="130" height="120" viewBox="0 0 130 120" style={{ flexShrink: 0 }}>
        <path d={describeArc(1)} fill="none" stroke="var(--color-surface-subtle)" strokeWidth="12" strokeLinecap="round" />
        <motion.path
          d={describeArc(Math.min(pct, 100) / 100)} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
        />
        <motion.text
          x={CX} y={CY + 6} textAnchor="middle" fontSize="20" fontWeight="800" fill={color}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.7 }}
        >
          {pct.toFixed(1)}%
        </motion.text>
      </svg>
      <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", flex: 1, minWidth: 120 }}>{label}</div>
    </motion.div>
  );
}

// Paleta monocroma del Treemap ("mono rounded treemap"): un solo tono
// (navy/azul de marca en claro, blanco/gris en oscuro) en distintas
// intensidades - deliberadamente NO usa CATEGORY_PALETTE (esa mezcla verde/
// naranja/rojo/azul para categorías, acá el pedido es estrictamente
// monocromático).
const TREEMAP_SHADES = [
  "var(--color-chart-accent)",
  "var(--color-brand-primary)",
  "var(--color-text-secondary)",
  "var(--color-brand-primary-alt)",
  "var(--color-text-tertiary)",
  "var(--color-text-muted)",
];

// Treemap genérico de un solo nivel (slice-and-dice): mosaico 2D donde el
// área de cada bloque es proporcional a su valor - da una sensación de
// distribución muy distinta a una lista de barras horizontales.
type TreemapItem = { key: string; label: string; value: number };
function sliceTreemap(
  items: TreemapItem[],
  x: number,
  y: number,
  w: number,
  h: number,
  horizontal: boolean
): { item: TreemapItem; x: number; y: number; w: number; h: number }[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ item: items[0], x, y, w, h }];
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  let acc = 0;
  let splitIdx = 0;
  for (let i = 0; i < items.length; i++) {
    acc += items[i].value;
    if (acc >= total / 2) {
      splitIdx = i + 1;
      break;
    }
  }
  splitIdx = Math.max(1, Math.min(splitIdx, items.length - 1));
  const left = items.slice(0, splitIdx);
  const right = items.slice(splitIdx);
  const leftTotal = left.reduce((a, i) => a + i.value, 0);
  const frac = leftTotal / total;

  if (horizontal) {
    const wLeft = w * frac;
    return [
      ...sliceTreemap(left, x, y, wLeft, h, false),
      ...sliceTreemap(right, x + wLeft, y, w - wLeft, h, false),
    ];
  } else {
    const hTop = h * frac;
    return [
      ...sliceTreemap(left, x, y, w, hTop, true),
      ...sliceTreemap(right, x, y + hTop, w, h - hTop, true),
    ];
  }
}

export function Treemap({
  items,
  formatter,
  height = 280,
}: {
  items: { label: string; value: number }[];
  formatter: (n: number) => string;
  height?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [containerRef, W] = useMeasuredWidth(500);
  const H = height;
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value).map((i, idx) => ({ ...i, key: `${i.label}-${idx}` }));
  const rects = sliceTreemap(sorted, 0, 0, W, H, true);

  if (rects.length === 0) {
    return (
      <div ref={containerRef} style={{ width: "100%" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }}>
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="var(--color-text-faint)" fontSize="11">Sin datos en el período</text>
        </svg>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height, overflow: "visible" }}>
        {rects.map((r, i) => {
          const isHovered = hovered === r.item.key;
          // Monocromo puro (no CATEGORY_PALETTE): del tile más grande al más
          // chico, de blanco a gris oscuro - sin verde/naranja/rojo, ese
          // degradé de opacidad es lo único que distingue un tile de otro.
          const shade = TREEMAP_SHADES[i % TREEMAP_SHADES.length];
          // Gap real entre tiles (inset a los 2 lados, no solo abajo/derecha)
          // + esquinas bien redondeadas que se acercan a "pill" en los tiles
          // chicos - look "mono rounded treemap".
          const gap = 6;
          const x = r.x + gap / 2;
          const y = r.y + gap / 2;
          const w = Math.max(r.w - gap, 0);
          const h = Math.max(r.h - gap, 0);
          const rx = Math.min(16, Math.min(w, h) / 2);
          return (
            <g
              key={r.item.key}
              onMouseEnter={() => setHovered(r.item.key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <motion.rect
                x={x} y={y} width={w} height={h} rx={rx}
                fill={shade}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: isHovered ? 1.02 : 1 }}
                transition={{
                  opacity: { duration: 0.4, delay: i * 0.03, ease: "easeOut" },
                  scale: { duration: 0.18, ease: "easeOut" },
                }}
                style={{ transformOrigin: `${x + w / 2}px ${y + h / 2}px` }}
              />
              {/* Halo oscuro alrededor del texto blanco: en monocromo los
                  tiles van de casi-blanco a gris oscuro, así que un texto
                  blanco plano queda ilegible en los tiles claros. El stroke
                  oscuro separa el texto del fondo sin importar el tono. */}
              {w > 50 && h > 18 && (
                <text
                  x={x + 8} y={y + 17} fontSize="9" fontWeight="700" fill="#ffffff"
                  stroke="rgba(0,0,0,0.55)" strokeWidth="3" paintOrder="stroke fill"
                >
                  {r.item.label.substring(0, Math.floor(w / 6))}
                </text>
              )}
              {w > 50 && h > 32 && (
                <text
                  x={x + 8} y={y + 30} fontSize="8" fill="rgba(255,255,255,0.9)"
                  stroke="rgba(0,0,0,0.55)" strokeWidth="3" paintOrder="stroke fill"
                >
                  {formatter(r.item.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (() => {
        const r = rects.find((x) => x.item.key === hovered);
        if (!r) return null;
        return (
          <ChartTooltip style={{ left: `${((r.x + r.w / 2) / W) * 100}%`, top: `${((r.y + r.h / 2) / H) * 100}%`, transform: "translate(-50%, -50%)" }}>
            <strong>{r.item.label}</strong>
            <br />{formatter(r.item.value)}
          </ChartTooltip>
        );
      })()}
    </div>
  );
}

// Scatter XY genérico (ejes lineales) con tamaño de punto opcional.
export function ScatterXY({
  points,
  xLabel,
  yLabel,
  xFormatter,
  yFormatter,
  color,
  height = 300,
}: {
  points: { key: string; label: string; x: number; y: number; size?: number }[];
  xLabel: string;
  yLabel: string;
  xFormatter: (n: number) => string;
  yFormatter: (n: number) => string;
  color: string;
  height?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = 500, H = height, pad = 40;

  if (points.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }}>
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="var(--color-text-faint)" fontSize="11">Sin datos en el período</text>
      </svg>
    );
  }

  // Ejes acotados al rango real de los datos (no siempre desde 0) - un
  // scatter compara posicion/agrupamiento, no longitud de barra, asi que
  // acotar al rango real no engaña (a diferencia de truncar un eje de
  // barras) y evita que el grafico quede vacio cuando los datos estan
  // concentrados lejos del origen. Sin labels numericos en los ejes (solo
  // xLabel/yLabel descriptivos), no hay riesgo de mala lectura de valores.
  const rawMinX = Math.min(...points.map((p) => p.x));
  const rawMaxX = Math.max(...points.map((p) => p.x));
  const rawMinY = Math.min(...points.map((p) => p.y));
  const rawMaxY = Math.max(...points.map((p) => p.y));
  const spanX = rawMaxX - rawMinX || rawMaxX || 1;
  const spanY = rawMaxY - rawMinY || rawMaxY || 1;
  const minX = Math.max(0, rawMinX - spanX * 0.08);
  const maxX = rawMaxX + spanX * 0.08;
  const minY = Math.max(0, rawMinY - spanY * 0.08);
  const maxY = rawMaxY + spanY * 0.08;
  const maxSize = Math.max(...points.map((p) => p.size ?? 1), 1);
  const toX = (v: number) => pad + ((v - minX) / (maxX - minX)) * (W - pad * 2);
  const toY = (v: number) => H - pad - ((v - minY) / (maxY - minY)) * (H - pad * 2);
  const toR = (v: number) => 3 + Math.sqrt((v ?? 1) / maxSize) * 12;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 620, margin: "0 auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height, overflow: "visible" }}>
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--color-border-strong)" strokeWidth="1" />
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-border-strong)" strokeWidth="1" />
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">{xLabel}</text>
        <text x={12} y={H / 2} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)" transform={`rotate(-90 12 ${H / 2})`}>{yLabel}</text>
        {points.map((p, i) => (
          <motion.circle
            key={p.key}
            cx={toX(p.x)} cy={toY(p.y)}
            fill={color} stroke={color}
            initial={{ r: 0, opacity: 0 }}
            animate={{
              r: toR(p.size ?? 1),
              opacity: 1,
              fillOpacity: hovered === p.key ? 0.95 : 0.5,
              strokeWidth: hovered === p.key ? 2 : 1,
            }}
            transition={{
              r: { type: "spring", stiffness: 260, damping: 14, delay: i * 0.045 },
              opacity: { duration: 0.25, delay: i * 0.045 },
              fillOpacity: { duration: 0.15 },
              strokeWidth: { duration: 0.15 },
            }}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(p.key)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {hovered && (() => {
        const p = points.find((x) => x.key === hovered);
        if (!p) return null;
        return (
          <ChartTooltip style={{ left: `${(toX(p.x) / W) * 100}%`, top: `${(toY(p.y) / H) * 100}%`, transform: "translate(-50%, -120%)" }}>
            <strong>{p.label}</strong>
            <br />{xLabel}: {xFormatter(p.x)}
            <br />{yLabel}: {yFormatter(p.y)}
          </ChartTooltip>
        );
      })()}
    </div>
  );
}

// Tendencia diaria simple (una sola serie), con hover.
export function TrendLine({
  points,
  formatter,
  color,
  height = 200,
}: {
  points: { x: string; y: number }[];
  formatter: (n: number) => string;
  color: string;
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 500, H = height, pad = 20;
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

// Tarjeta de gráfico con vista compacta por defecto (para que entren más
// gráficos por pantalla) y click para expandir en un modal más grande.
// Usa render-prop en vez de children fijos porque el propio gráfico
// necesita saber si está expandido o no (para pedir un alto mayor vía su
// prop `height`/`minHeight`) - el wrapper no puede decidir eso por afuera
// sin duplicar el árbol de componentes.
export function ExpandableChartCard({
  title,
  styles,
  render,
  modalWidth = "min(920px, 92vw)",
}: {
  title: string;
  styles: Record<string, string>;
  render: (expanded: boolean) => React.ReactNode;
  modalWidth?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Card
        variant="chartCard"
        styles={styles}
        className={styles.expandableChartCard}
        onClick={() => setExpanded(true)}
      >
        <div className={styles.expandableChartCardHeader}>
          <h3>{title}</h3>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className={styles.expandIcon}>
            <path d="M8 3H3v5M12 17h5v-5M17 3l-6 6M3 17l6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {render(false)}
      </Card>

      <Modal
        isOpen={expanded}
        onClose={() => setExpanded(false)}
        title={title}
        styles={styles}
        contentStyle={{ width: modalWidth, maxWidth: "95vw" }}
      >
        {render(true)}
      </Modal>
    </>
  );
}
