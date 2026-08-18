"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DevolucionesDonutProps {
  segments: DonutSegment[];
  totalLabel: string;
  totalValue: number;
  formatter: (n: number) => string;
  size?: number;
  strokeWidth?: number;
}

/** Dona animada (trazo redondeado + brillo al hover + centro que cambia entre
 *  total y detalle del segmento) para desgloses de 2-4 categorías donde
 *  importa la proporción sobre el total, no comparar barras entre sí. */
export function DevolucionesDonut({
  segments,
  totalLabel,
  totalValue,
  formatter,
  size = 190,
  strokeWidth = 24,
}: DevolucionesDonutProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const [hovered, setHovered] = useState<string | null>(null);

  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((a, s) => a + s.value, 0);
  const hoveredSeg = segments.find((s) => s.key === hovered) ?? null;

  let cumulative = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.75rem", flexWrap: "wrap" }}>
      <div
        style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
        onMouseLeave={() => setHovered(null)}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: "visible", transform: "rotate(-90deg)" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--color-surface-subtle)"
            strokeWidth={strokeWidth}
          />
          {total === 0 ? null : (
            <AnimatePresence>
              {segments.map((seg, i) => {
                if (seg.value <= 0) return null;
                const frac = seg.value / total;
                const dash = frac * circumference;
                const offset = cumulative * circumference;
                cumulative += frac;
                const isActive = hovered === seg.key;
                return (
                  <motion.circle
                    key={seg.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    initial={{ strokeDashoffset: reducedMotion ? -offset : 0, opacity: reducedMotion ? 1 : 0 }}
                    animate={{ strokeDashoffset: -offset, opacity: 1 }}
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : { duration: 0.7, delay: i * 0.12, ease: "easeOut" }
                    }
                    style={{
                      cursor: "pointer",
                      transformOrigin: "center",
                      transform: isActive ? "scale(1.035)" : "scale(1)",
                      filter: isActive ? `drop-shadow(0 0 6px ${seg.color})` : "none",
                      transition: "transform 0.2s ease-out, filter 0.2s ease-out",
                    }}
                    onMouseEnter={() => setHovered(seg.key)}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </svg>

        <div
          style={{
            position: "absolute",
            inset: strokeWidth * 0.9,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={hoveredSeg?.key ?? "__total__"}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
            >
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  maxWidth: size - strokeWidth * 2.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {hoveredSeg ? hoveredSeg.label : totalLabel}
              </span>
              <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.15 }}>
                {formatter(hoveredSeg ? hoveredSeg.value : totalValue)}
              </span>
              {hoveredSeg && total > 0 && (
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: hoveredSeg.color }}>
                  {((hoveredSeg.value / total) * 100).toFixed(0)}%
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1, minWidth: 150 }}>
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          const isActive = hovered === seg.key;
          return (
            <div
              key={seg.key}
              onMouseEnter={() => setHovered(seg.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.35rem 0.5rem",
                borderRadius: 8,
                cursor: "pointer",
                background: isActive ? "var(--color-surface-subtle)" : "transparent",
                transition: "background-color 0.15s ease",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)", flex: 1 }}>{seg.label}</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                {formatter(seg.value)}
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--color-text-faint)", minWidth: 30, textAlign: "right" }}>
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
        {total === 0 && (
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", margin: 0 }}>
            Sin devoluciones registradas en este rango.
          </p>
        )}
      </div>
    </div>
  );
}

export default DevolucionesDonut;
