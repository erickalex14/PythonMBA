"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChartTooltip } from "./ChartPrimitives";

interface TrendLineAdvancedProps {
  points: { x: string; y: number }[];
  formatter: (n: number) => string;
  color: string;
  height?: number;
  // Etiqueta corta para el eje Y (ej. "und" o "$") - el formatter completo
  // suele ser muy largo (moneda con centavos) para caber en el margen del eje.
  axisFormatter?: (n: number) => string;
}

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

/** Versión "con grid + eje Y + tooltip con variación diaria" de TrendLine -
 *  gráfico propio (sin recharts, no está en el proyecto), pensado para
 *  Movimientos donde importa ver de un vistazo si un día tuvo más o menos
 *  transacciones que el anterior. TrendLine (la versión simple, sin ejes)
 *  se deja intacta para Liquidaciones/ATS/Rentabilidad. */
export function TrendLineAdvanced({ points, formatter, color, height = 220, axisFormatter }: TrendLineAdvancedProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [containerRef, measuredW] = useMeasuredWidth(500);
  const H = height;
  const leftPad = 46;
  const rightPad = 14;
  const topPad = 14;
  const bottomPad = 26;
  const W = measuredW;
  const plotW = Math.max(W - leftPad - rightPad, 10);
  const plotH = Math.max(H - topPad - bottomPad, 10);
  const axisFmt = axisFormatter ?? formatter;

  if (points.length === 0) {
    return <div style={{ fontSize: "0.8rem", color: "var(--color-text-faint)", padding: "1rem", textAlign: "center" }}>Sin datos en el período</div>;
  }

  const maxY = Math.max(...points.map((p) => p.y), 1);
  const minY = Math.min(...points.map((p) => p.y), 0);
  const rawSpan = maxY - minY;
  const padding = rawSpan === 0 ? Math.max(maxY * 0.15, 1) : rawSpan * 0.12;
  const yTop = maxY + padding;
  const yBottom = Math.max(0, minY - padding);
  const span = yTop - yBottom || 1;

  const toX = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * plotW + leftPad : leftPad + plotW / 2);
  const toY = (v: number) => topPad + plotH - ((v - yBottom) / span) * plotH;

  const path = `M ${points.map((p, i) => `${toX(i)} ${toY(p.y)}`).join(" L ")}`;
  const areaPath = `${path} L ${toX(points.length - 1)} ${topPad + plotH} L ${toX(0)} ${topPad + plotH} Z`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => yBottom + (span / yTicks) * i);

  // Ticks del eje X: todas las fechas si son pocas, si no un subconjunto
  // parejo (evita que se amontonen las etiquetas con 20-30 días de rango).
  const maxXTicks = 7;
  const xTickStep = Math.max(1, Math.ceil(points.length / maxXTicks));
  const xTickIndexes = points.map((_, i) => i).filter((i) => i % xTickStep === 0 || i === points.length - 1);

  const gradId = `trendfill-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Grid horizontal punteado + etiquetas del eje Y */}
        {yTickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={leftPad} x2={W - rightPad} y1={toY(v)} y2={toY(v)}
              stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 3"
            />
            <text x={leftPad - 8} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="var(--color-text-faint)">
              {axisFmt(v)}
            </text>
          </g>
        ))}

        {/* Etiquetas del eje X */}
        {xTickIndexes.map((i) => (
          <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="8.5" fill="var(--color-text-faint)">
            {points[i].x.length > 5 ? points[i].x.slice(5) : points[i].x}
          </text>
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />

        {hovered !== null && (
          <line x1={toX(hovered)} x2={toX(hovered)} y1={topPad} y2={topPad + plotH} stroke={color} strokeDasharray="4 4" strokeWidth="1" opacity={0.5} />
        )}

        {points.map((p, i) => (
          <circle
            key={i} cx={toX(i)} cy={toY(p.y)} r={hovered === i ? 5 : 2.5}
            fill="var(--color-surface)" stroke={color} strokeWidth={hovered === i ? 2 : 1.5}
            style={{ cursor: "pointer", transition: "r 0.1s ease" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {hovered !== null && (
        <ChartTooltip style={{ left: `${(toX(hovered) / W) * 100}%`, top: 0, transform: "translate(-50%, -100%)" }}>
          <strong>{points[hovered].x}</strong>
          <br />Total {formatter(points[hovered].y)}
          {hovered > 0 && (() => {
            const cambio = points[hovered].y - points[hovered - 1].y;
            const positivo = cambio >= 0;
            return (
              <>
                <br />
                <span style={{ color: positivo ? "#86efac" : "#fca5a5" }}>
                  {positivo ? "+" : ""}{formatter(cambio)} vs. día anterior
                </span>
              </>
            );
          })()}
        </ChartTooltip>
      )}
    </div>
  );
}

export default TrendLineAdvanced;
