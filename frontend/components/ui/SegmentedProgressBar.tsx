"use client";

import React from "react";
import { motion } from "framer-motion";

interface SegmentedProgressBarProps {
  pct: number; // 0-100
  segments?: number;
  color?: string;
}

/** Barra de progreso en bloques discretos (en vez de una barra continua) -
 *  cada segmento se enciende a medida que avanza el %, con una animación de
 *  entrada escalonada cuando se prende. */
export function SegmentedProgressBar({ pct, segments = 20, color = "var(--color-chart-accent)" }: SegmentedProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * segments);

  return (
    <div style={{ display: "flex", gap: "4px", width: "100%" }}>
      {Array.from({ length: segments }, (_, i) => {
        const isFilled = i < filled;
        return (
          <motion.div
            key={i}
            style={{
              flex: 1,
              height: 10,
              borderRadius: 4,
              backgroundColor: isFilled ? color : "var(--color-surface-subtle)",
            }}
            initial={false}
            animate={{ scaleY: isFilled ? 1 : 0.8, opacity: isFilled ? 1 : 0.8 }}
            transition={{ duration: 0.25, delay: isFilled ? i * 0.015 : 0, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

export default SegmentedProgressBar;
