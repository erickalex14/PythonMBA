import React, { useMemo, useState } from "react";
import { Card } from "./ui/Card";

interface RentabilidadChartsProps {
  data: any[];
  styles: Record<string, string>;
}

// ---------- helpers ----------

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
function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// Salud de margen mapeada a los tokens de estado ya existentes (success/warning/danger)
// en vez de interpolar un color nuevo - es el caso de uso exacto para el que existen.
function marginColor(pct: number): string {
  if (pct < 0) return "var(--color-danger-dark)";
  if (pct < 15) return "var(--color-danger)";
  if (pct < 35) return "var(--color-warning)";
  if (pct < 60) return "var(--color-brand-accent)";
  return "var(--color-success-dark)";
}

function Tooltip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        background: "#0f172a",
        color: "#ffffff",
        padding: "0.5rem 0.7rem",
        borderRadius: 8,
        fontSize: "0.72rem",
        lineHeight: 1.5,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.3)",
        zIndex: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function TierHeading({ title, first }: { title: string; first?: boolean }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        margin: first ? "0 0 1rem" : "2.25rem 0 1rem",
        paddingBottom: "0.6rem", borderBottom: "1px solid var(--color-border)",
      }}
    >
      <h2
        style={{
          fontSize: "0.8rem", fontWeight: 800, color: "var(--color-chart-accent)", margin: 0,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

type Agg = { key: string; label: string; cantidad: number; subtotal: number; descuento: number; costo: number; utilidad: number };

function aggregate(data: any[], keyField: string, labelField?: string): Agg[] {
  const map = new Map<string, Agg>();
  data.forEach((row) => {
    const key = str(row, keyField);
    if (!key) return;
    const label = labelField ? str(row, labelField) || key : key;
    const cur = map.get(key) || { key, label, cantidad: 0, subtotal: 0, descuento: 0, costo: 0, utilidad: 0 };
    cur.cantidad += num(row, "cantidad");
    cur.subtotal += num(row, "subtotal");
    cur.descuento += num(row, "descuento_aplicado");
    cur.costo += num(row, "costo_total");
    cur.utilidad += num(row, "utilidad_total");
    map.set(key, cur);
  });
  return Array.from(map.values());
}
function pctMargen(a: Agg): number {
  return a.costo > 0 ? (a.utilidad / a.costo) * 100 : 0;
}
function pctDescuento(a: Agg): number {
  return a.subtotal > 0 ? (a.descuento / a.subtotal) * 100 : 0;
}

// =====================================================================
// 1. Waterfall de utilidad
// =====================================================================
function WaterfallUtilidad({ data }: { data: any[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const steps = useMemo(() => {
    const ventasBrutas = data.reduce((a, r) => a + num(r, "subtotal"), 0);
    const descuentos = data.reduce((a, r) => a + num(r, "descuento_aplicado"), 0);
    const costos = data.reduce((a, r) => a + num(r, "costo_total"), 0);
    const neto = ventasBrutas - descuentos;
    const utilidadNeta = neto - costos;

    let running = ventasBrutas;
    const s = [
      { label: "Ventas Brutas", value: ventasBrutas, start: 0, end: ventasBrutas, kind: "total" as const },
      { label: "Descuentos", value: -descuentos, start: running, end: (running -= descuentos), kind: "decrease" as const },
      { label: "Costos", value: -costos, start: running, end: (running -= costos), kind: "decrease" as const },
      { label: "Utilidad Neta", value: utilidadNeta, start: 0, end: utilidadNeta, kind: "total" as const },
    ];
    return s;
  }, [data]);

  const domainMax = Math.max(...steps.map((s) => Math.max(s.start, s.end)), 1);
  const domainMin = Math.min(...steps.map((s) => Math.min(s.start, s.end)), 0);
  const span = domainMax - domainMin || 1;
  const H = 280;
  const plotTop = 20;
  const plotBottom = 230;
  const plotH = plotBottom - plotTop;
  const toY = (v: number) => plotBottom - ((v - domainMin) / span) * plotH;

  const n = steps.length;
  const gap = 30;
  const barW = (440 - gap * (n - 1)) / n;

  const colorFor = (kind: string, value: number) => {
    if (kind === "total") return value >= 0 ? "var(--color-success-dark)" : "var(--color-danger)";
    return "var(--color-danger)";
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 620, margin: "0 auto" }}>
      <svg viewBox={`0 0 500 ${H}`} style={{ width: "100%", height: 240, overflow: "visible" }}>
        <line x1="40" y1={plotBottom} x2="470" y2={plotBottom} stroke="var(--color-border-strong)" strokeWidth="1" />
        {steps.map((s, i) => {
          const x = 50 + i * (barW + gap);
          const yTop = toY(Math.max(s.start, s.end));
          const yBot = toY(Math.min(s.start, s.end));
          const h = Math.max(yBot - yTop, 2);
          const isHovered = hovered === i;
          const color = colorFor(s.kind, s.value);
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
              {i > 0 && (
                <line
                  x1={x - gap} y1={toY(steps[i - 1].end)} x2={x} y2={toY(steps[i - 1].end)}
                  stroke="var(--color-border)" strokeWidth="1.5" strokeDasharray="3 3"
                />
              )}
              <rect x={x} y={yTop} width={barW} height={h} rx="4" fill={color} fillOpacity={isHovered ? 1 : 0.82} />
              <text x={x + barW / 2} y={yTop - 8} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--color-text-secondary)">
                {s.value >= 0 ? "" : "-"}{fmtMoney(Math.abs(s.value))}
              </text>
              <text x={x + barW / 2} y={plotBottom + 16} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--color-text-muted)">
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered !== null && (
        <Tooltip style={{ left: `${10 + hovered * 22}%`, top: 0 }}>
          <strong>{steps[hovered].label}</strong>
          <br />
          {steps[hovered].value >= 0 ? "" : "-"}{fmtMoney2(Math.abs(steps[hovered].value))}
        </Tooltip>
      )}
    </div>
  );
}

// =====================================================================
// 2. Top/Bottom 10 por %Utilidad/Costo
// =====================================================================
function TopBottomMargen({ productos }: { productos: Agg[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  // ponytail: costo minimo para filtrar ruido de productos con costo casi cero
  // (una unidad devuelta a costo simbolico dispara % absurdos). Ajustar si hace falta.
  const candidatos = productos.filter((p) => p.costo >= 5);
  const ranked = [...candidatos].sort((a, b) => pctMargen(b) - pctMargen(a));
  const top = ranked.slice(0, 10);
  const bottom = ranked.slice(-10).reverse();

  const renderList = (items: Agg[], title: string, positive: boolean) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "0.4rem", textTransform: "uppercase" }}>
        {title}
      </div>
      {items.map((p) => {
        const pct = pctMargen(p);
        const widthPct = Math.min(Math.abs(pct), 150) / 150 * 100;
        const key = `${title}-${p.key}`;
        return (
          <div
            key={p.key}
            style={{ marginBottom: "0.4rem", position: "relative", cursor: "pointer" }}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 2 }}>
              <span style={{ color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                {p.label.substring(0, 26)}
              </span>
              <span style={{ fontWeight: 700, color: positive ? "var(--color-success-dark)" : "var(--color-danger)" }}>{fmtPct(pct)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: "var(--color-surface-subtle)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${widthPct}%`, background: positive ? "var(--color-success-dark)" : "var(--color-danger)", borderRadius: 4 }} />
            </div>
            {hovered === key && (
              <Tooltip style={{ left: "50%", top: -6, transform: "translate(-50%, -100%)" }}>
                <strong>{p.label}</strong>
                <br />Costo: {fmtMoney2(p.costo)}
                <br />Utilidad: {fmtMoney2(p.utilidad)}
                <br />Cantidad: {p.cantidad.toLocaleString()}
              </Tooltip>
            )}
          </div>
        );
      })}
      {items.length === 0 && <div style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>Sin datos suficientes</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", gap: "1.25rem" }}>
      {renderList(top, "Top 10 · mejor margen", true)}
      {renderList(bottom, "Bottom 10 · peor margen", false)}
    </div>
  );
}

// =====================================================================
// 3. Treemap Grupo -> Subgrupo (tamaño=utilidad, color=%margen)
// =====================================================================
function TreemapGrupoSubgrupo({ data }: { data: any[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const byGrupo = new Map<string, Map<string, Agg>>();
    data.forEach((row) => {
      const g = str(row, "grupo") || "Sin Grupo";
      const sg = str(row, "subgrupo") || "Sin Subgrupo";
      if (!byGrupo.has(g)) byGrupo.set(g, new Map());
      const inner = byGrupo.get(g)!;
      const cur = inner.get(sg) || { key: sg, label: sg, cantidad: 0, subtotal: 0, descuento: 0, costo: 0, utilidad: 0 };
      cur.cantidad += num(row, "cantidad");
      cur.subtotal += num(row, "subtotal");
      cur.descuento += num(row, "descuento_aplicado");
      cur.costo += num(row, "costo_total");
      cur.utilidad += num(row, "utilidad_total");
      inner.set(sg, cur);
    });
    const out = Array.from(byGrupo.entries()).map(([label, inner]) => {
      const children = Array.from(inner.values()).filter((c) => c.utilidad > 0).sort((a, b) => b.utilidad - a.utilidad);
      const total = children.reduce((a, c) => a + c.utilidad, 0);
      return { label, total, children };
    }).filter((g) => g.total > 0).sort((a, b) => b.total - a.total);
    return out;
  }, [data]);

  const grandTotal = grupos.reduce((a, g) => a + g.total, 0) || 1;
  const W = 500, H = 300;
  const HEADER_H = 15;
  let rowY = 0;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 620, margin: "0 auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 300, overflow: "visible" }}>
        {grupos.map((g) => {
          const rowH = (g.total / grandTotal) * H;
          const y0 = rowY;
          rowY += rowH;
          const hasHeader = rowH > HEADER_H + 14;
          const cellY = hasHeader ? y0 + HEADER_H : y0;
          const cellH = hasHeader ? rowH - HEADER_H : rowH;
          let colX = 0;
          return (
            <g key={g.label}>
              {hasHeader && (
                <>
                  <rect x={0} y={y0} width={W} height={HEADER_H} fill="var(--color-chart-accent)" />
                  <text x={6} y={y0 + 11} fontSize="8.5" fontWeight="700" fill="#ffffff">{g.label}</text>
                </>
              )}
              {g.children.map((c) => {
                const w = (c.utilidad / g.total) * W;
                const x0 = colX;
                colX += w;
                const pct = pctMargen(c);
                const key = `${g.label}-${c.label}`;
                const isHovered = hovered === key;
                return (
                  <g
                    key={c.key}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={x0} y={cellY} width={Math.max(w - 2, 0)} height={Math.max(cellH - 2, 0)}
                      fill={marginColor(pct)} fillOpacity={isHovered ? 1 : 0.85} stroke="var(--color-surface)" strokeWidth="2"
                    />
                    {w > 55 && cellH > 20 && (
                      <>
                        <text x={x0 + 6} y={cellY + 15} fontSize="9" fontWeight="700" fill="#ffffff">
                          {c.label.substring(0, Math.floor(w / 6))}
                        </text>
                        {cellH > 34 && (
                          <text x={x0 + 6} y={cellY + 28} fontSize="8" fill="rgba(255,255,255,0.85)">
                            {fmtPct(pct)}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {grupos.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="var(--color-text-faint)" fontSize="11">Sin datos en el período</text>
        )}
      </svg>
      {hovered && (() => {
        const [gl, ...rest] = hovered.split("-");
        const g = grupos.find((x) => x.label === gl);
        const c = g?.children.find((x) => `${gl}-${x.label}` === hovered);
        if (!c) return null;
        return (
          <Tooltip style={{ left: "50%", top: "45%" }}>
            <strong>{g!.label} / {c.label}</strong>
            <br />Utilidad: {fmtMoney2(c.utilidad)}
            <br />Margen: {fmtPct(pctMargen(c))}
          </Tooltip>
        );
      })()}
    </div>
  );
}

// =====================================================================
// 4. Scatter Cantidad vs %Utilidad (tamaño = utilidad total)
// =====================================================================
function ScatterCantidadMargen({ productos }: { productos: Agg[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const puntos = useMemo(() => productos.filter((p) => p.costo >= 5 && p.cantidad > 0), [productos]);

  const medianCantidad = useMemo(() => {
    const arr = [...puntos.map((p) => p.cantidad)].sort((a, b) => a - b);
    return arr.length ? arr[Math.floor(arr.length / 2)] : 0;
  }, [puntos]);
  const medianPct = useMemo(() => {
    const arr = [...puntos.map((p) => pctMargen(p))].sort((a, b) => a - b);
    return arr.length ? arr[Math.floor(arr.length / 2)] : 0;
  }, [puntos]);

  // Escala log en cantidad: unos pocos productos de altisimo volumen no deben
  // aplastar contra el eje a todos los demas (distribucion de cola larga tipica).
  const logCant = (v: number) => Math.log10(v + 1);
  const maxLogCant = Math.max(...puntos.map((p) => logCant(p.cantidad)), 1);
  const pctValues = puntos.map((p) => pctMargen(p));
  const maxPctVal = Math.max(...pctValues, 0);
  const minPctVal = Math.min(...pctValues, 0);
  const pctSpan = maxPctVal - minPctVal || 1;
  const maxUtil = Math.max(...puntos.map((p) => Math.abs(p.utilidad)), 1);

  const W = 500, H = 320, pad = 40;
  const toX = (v: number) => pad + (logCant(v) / maxLogCant) * (W - pad * 2);
  const toY = (v: number) => H - pad - ((v - minPctVal) / pctSpan) * (H - pad * 2);
  // Radio proporcional al area (sqrt), no al valor directo - si no, el mayor
  // domina visualmente mucho mas de lo que su utilidad real justifica.
  const toR = (v: number) => 3.5 + Math.sqrt(Math.abs(v) / maxUtil) * 16;
  const medianX = toX(medianCantidad);
  const medianY = toY(medianPct);

  const quadrantLabel = (cant: number, pct: number) => {
    if (cant >= medianCantidad && pct >= medianPct) return { label: "Joya (alto vol + alto margen)", color: "var(--color-success-dark)" };
    if (cant >= medianCantidad && pct < medianPct) return { label: "Volumen sin margen", color: "var(--color-warning)" };
    if (cant < medianCantidad && pct >= medianPct) return { label: "Nicho rentable", color: "var(--color-brand-primary)" };
    return { label: "Descartable", color: "var(--color-danger)" };
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 640, margin: "0 auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 320, overflow: "visible" }}>
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--color-border-strong)" strokeWidth="1" />
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-border-strong)" strokeWidth="1" />
        <line x1={medianX} y1={pad} x2={medianX} y2={H - pad} stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth="1" />
        <line x1={pad} y1={medianY} x2={W - pad} y2={medianY} stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth="1" />

        <text x={pad + 4} y={pad + 12} fontSize="8" fill="var(--color-text-faint)">Nicho rentable</text>
        <text x={W - pad - 4} y={pad + 12} textAnchor="end" fontSize="8" fill="var(--color-text-faint)">Joya</text>
        <text x={pad + 4} y={H - pad - 6} fontSize="8" fill="var(--color-text-faint)">Descartable</text>
        <text x={W - pad - 4} y={H - pad - 6} textAnchor="end" fontSize="8" fill="var(--color-text-faint)">Volumen sin margen</text>

        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">Cantidad vendida →</text>
        <text x={12} y={H / 2} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)" transform={`rotate(-90 12 ${H / 2})`}>% Utilidad/Costo →</text>

        {puntos.map((p) => {
          const pct = pctMargen(p);
          const q = quadrantLabel(p.cantidad, pct);
          const isHovered = hovered === p.key;
          return (
            <circle
              key={p.key}
              cx={toX(p.cantidad)} cy={toY(pct)} r={toR(p.utilidad)}
              fill={q.color} fillOpacity={isHovered ? 0.95 : 0.55} stroke={q.color} strokeWidth={isHovered ? 2 : 1}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(p.key)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>
      {hovered && (() => {
        const p = puntos.find((x) => x.key === hovered);
        if (!p) return null;
        const pct = pctMargen(p);
        const q = quadrantLabel(p.cantidad, pct);
        return (
          <Tooltip style={{ left: `${(toX(p.cantidad) / W) * 100}%`, top: `${(toY(pct) / H) * 100}%`, transform: "translate(-50%, -120%)" }}>
            <strong>{p.label}</strong>
            <br />{q.label}
            <br />Cantidad: {p.cantidad.toLocaleString()} · Margen: {fmtPct(pct)}
            <br />Utilidad: {fmtMoney2(p.utilidad)}
          </Tooltip>
        );
      })()}
    </div>
  );
}

// =====================================================================
// 5. Pareto de utilidad por producto (80/20)
// =====================================================================
function ParetoUtilidad({ productos }: { productos: Agg[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const items = useMemo(() => {
    const positivos = productos.filter((p) => p.utilidad > 0).sort((a, b) => b.utilidad - a.utilidad).slice(0, 20);
    const total = positivos.reduce((a, p) => a + p.utilidad, 0) || 1;
    let acc = 0;
    return positivos.map((p) => {
      acc += p.utilidad;
      return { ...p, cumPct: (acc / total) * 100 };
    });
  }, [productos]);

  const maxUtil = Math.max(...items.map((i) => i.utilidad), 1);
  const W = 500, H = 260, pad = 30;
  const barAreaW = W - pad * 2;
  const barW = items.length ? Math.min(barAreaW / items.length - 4, 26) : 0;
  const toXCenter = (i: number) => pad + (i + 0.5) * (barAreaW / (items.length || 1));
  // una sola escala 0-100 (%): barras normalizadas a su propio maximo, linea = % acumulado real.
  const toY = (pctOfMax: number) => H - pad - (pctOfMax / 100) * (H - pad * 2 - 10);

  const cutIdx = items.findIndex((it) => it.cumPct >= 80);

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

        {items.map((it, i) => {
          const hBar = (it.utilidad / maxUtil) * 100;
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

        {items.length > 0 && (
          <path
            d={`M ${items.map((it, i) => `${toXCenter(i)} ${toY(it.cumPct)}`).join(" L ")}`}
            fill="none" stroke="var(--color-chart-accent)" strokeWidth="2" strokeLinecap="round"
          />
        )}
        {items.map((it, i) => (
          <circle key={`c-${it.key}`} cx={toXCenter(i)} cy={toY(it.cumPct)} r="2.5" fill="var(--color-chart-accent)" />
        ))}

        <text x={pad - 4} y={toY(100) + 3} textAnchor="end" fontSize="8" fill="var(--color-text-faint)">100%</text>
        <text x={pad - 4} y={toY(80) + 3} textAnchor="end" fontSize="8" fill="var(--color-warning)">80%</text>
        <text x={pad - 4} y={toY(0) + 3} textAnchor="end" fontSize="8" fill="var(--color-text-faint)">0%</text>
      </svg>
      {items.length === 0 && (
        <div style={{ fontSize: "0.8rem", color: "var(--color-text-faint)", textAlign: "center", padding: "1rem" }}>Sin datos en el período</div>
      )}
      {cutIdx >= 0 && (
        <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.4rem" }}>
          <strong>{cutIdx + 1}</strong> de {items.length} productos sostienen el 80% de la utilidad.
        </div>
      )}
      {hovered !== null && (
        <Tooltip style={{ left: `${(toXCenter(hovered) / W) * 100}%`, top: 0, transform: "translateX(-50%)" }}>
          <strong>{items[hovered].label}</strong>
          <br />Utilidad: {fmtMoney2(items[hovered].utilidad)}
          <br />Acumulado: {fmtPct(items[hovered].cumPct)}
        </Tooltip>
      )}
    </div>
  );
}

// =====================================================================
// 6. Bodega vs %Utilidad promedio
// =====================================================================
function BodegaMargen({ data }: { data: any[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const bodegas = useMemo(() => {
    const agg = aggregate(data, "bodega_nombre");
    return agg.filter((b) => b.key && b.costo > 0).sort((a, b) => pctMargen(b) - pctMargen(a)).slice(0, 12);
  }, [data]);
  const avgPct = useMemo(() => {
    const totalCosto = bodegas.reduce((a, b) => a + b.costo, 0);
    const totalUtil = bodegas.reduce((a, b) => a + b.utilidad, 0);
    return totalCosto > 0 ? (totalUtil / totalCosto) * 100 : 0;
  }, [bodegas]);
  const maxAbs = Math.max(...bodegas.map((b) => Math.abs(pctMargen(b))), 1);

  return (
    <div style={{ position: "relative" }}>
      {bodegas.map((b) => {
        const pct = pctMargen(b);
        const isBelow = pct < avgPct;
        const w = (Math.abs(pct) / maxAbs) * 100;
        return (
          <div
            key={b.key} style={{ marginBottom: "0.45rem", cursor: "pointer" }}
            onMouseEnter={() => setHovered(b.key)} onMouseLeave={() => setHovered(null)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", marginBottom: 2 }}>
              <span style={{ color: "var(--color-text-tertiary)", fontWeight: 600 }}>{b.label.substring(0, 24)}</span>
              <span style={{ fontWeight: 700, color: isBelow ? "var(--color-danger)" : "var(--color-success-dark)" }}>{fmtPct(pct)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--color-surface-subtle)", overflow: "hidden", position: "relative" }}>
              <div style={{ height: "100%", width: `${w}%`, background: isBelow ? "var(--color-danger)" : "var(--color-success-dark)", borderRadius: 4 }} />
            </div>
            {hovered === b.key && (
              <Tooltip style={{ left: "50%", top: -6, transform: "translate(-50%, -100%)" }}>
                <strong>{b.label}</strong>
                <br />Costo: {fmtMoney2(b.costo)} · Utilidad: {fmtMoney2(b.utilidad)}
                <br />Promedio general: {fmtPct(avgPct)}
              </Tooltip>
            )}
          </div>
        );
      })}
      {bodegas.length === 0 && <div style={{ fontSize: "0.8rem", color: "var(--color-text-faint)" }}>Sin datos de bodega en el período</div>}
      {bodegas.length > 0 && (
        <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.3rem" }}>
          Promedio ponderado: <strong>{fmtPct(avgPct)}</strong>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 7. % Descuento sobre Neto por Grupo
// =====================================================================
function DescuentoPorGrupo({ data }: { data: any[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const agg = aggregate(data, "grupo");
    return agg.filter((g) => g.subtotal > 0).sort((a, b) => pctDescuento(b) - pctDescuento(a)).slice(0, 10);
  }, [data]);
  const maxPct = Math.max(...grupos.map((g) => pctDescuento(g)), 1);

  return (
    <div>
      {grupos.map((g) => {
        const pct = pctDescuento(g);
        const w = (pct / maxPct) * 100;
        return (
          <div
            key={g.key} style={{ marginBottom: "0.45rem", cursor: "pointer" }}
            onMouseEnter={() => setHovered(g.key)} onMouseLeave={() => setHovered(null)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", marginBottom: 2 }}>
              <span style={{ color: "var(--color-text-tertiary)", fontWeight: 600 }}>{g.label.substring(0, 20)}</span>
              <span style={{ fontWeight: 700, color: pct > 10 ? "var(--color-warning)" : "var(--color-text-secondary)" }}>{fmtPct(pct)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--color-surface-subtle)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${w}%`, background: "var(--color-warning)", borderRadius: 4 }} />
            </div>
            {hovered === g.key && (
              <Tooltip style={{ left: "50%", top: -6, transform: "translate(-50%, -100%)" }}>
                <strong>{g.label}</strong>
                <br />Descuento: {fmtMoney2(g.descuento)} / Bruto: {fmtMoney2(g.subtotal)}
              </Tooltip>
            )}
          </div>
        );
      })}
      {grupos.length === 0 && <div style={{ fontSize: "0.8rem", color: "var(--color-text-faint)" }}>Sin datos en el período</div>}
    </div>
  );
}

// =====================================================================
// 8. Tendencia diaria: Ventas $ vs %Utilidad (small multiples, un eje c/u)
// =====================================================================
function MiniTrendLine({ points, formatter, color }: { points: { x: string; y: number }[]; formatter: (n: number) => string; color: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 500, H = 120, pad = 8;
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const minY = Math.min(...points.map((p) => p.y), 0);
  const span = maxY - minY || 1;
  const toX = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * (W - 20) + 10 : W / 2);
  const toY = (v: number) => H - pad - ((v - minY) / span) * (H - pad * 2);

  if (points.length === 0) return <div style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>Sin datos</div>;
  if (points.length === 1) {
    return (
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-faint)", padding: "0.5rem 0" }}>
        {points[0].x}: {formatter(points[0].y)} · se necesita más de un día para ver tendencia
      </div>
    );
  }

  const path = `M ${points.map((p, i) => `${toX(i)} ${toY(p.y)}`).join(" L ")}`;

  return (
    <div style={{ position: "relative", maxWidth: 620, margin: "0 auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 90, overflow: "visible" }}>
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={i} cx={toX(i)} cy={toY(p.y)} r={hovered === i ? 4 : 2.5}
            fill="var(--color-surface)" stroke={color} strokeWidth="1.5"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {hovered !== null && (
        <Tooltip style={{ left: `${(toX(hovered) / W) * 100}%`, top: 0, transform: "translate(-50%, -100%)" }}>
          <strong>{points[hovered].x.substring(5)}</strong>: {formatter(points[hovered].y)}
        </Tooltip>
      )}
    </div>
  );
}

function TendenciaDiaria({ data }: { data: any[] }) {
  const dias = useMemo(() => {
    const map = new Map<string, { ventas: number; costo: number; utilidad: number }>();
    data.forEach((row) => {
      const f = str(row, "fecha");
      if (!f) return;
      const cur = map.get(f) || { ventas: 0, costo: 0, utilidad: 0 };
      cur.ventas += num(row, "total_linea");
      cur.costo += num(row, "costo_total");
      cur.utilidad += num(row, "utilidad_total");
      map.set(f, cur);
    });
    return Array.from(map.entries())
      .map(([fecha, v]) => ({ fecha, ventas: v.ventas, pctMargen: v.costo > 0 ? (v.utilidad / v.costo) * 100 : 0 }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [data]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <div>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "0.35rem" }}>VENTAS ($)</div>
        <MiniTrendLine points={dias.map((d) => ({ x: d.fecha, y: d.ventas }))} formatter={fmtMoney2} color="var(--color-brand-primary)" />
      </div>
      <div>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "0.35rem" }}>% UTILIDAD PROMEDIO</div>
        <MiniTrendLine points={dias.map((d) => ({ x: d.fecha, y: d.pctMargen }))} formatter={fmtPct} color="var(--color-success-dark)" />
      </div>
    </div>
  );
}

// =====================================================================
// Componente principal
// =====================================================================
export const RentabilidadCharts: React.FC<RentabilidadChartsProps> = ({ data, styles }) => {
  const productos = useMemo(() => aggregate(data, "codigo", "producto"), [data]);

  if (data.length === 0) return null;

  const cardStyle: React.CSSProperties = { marginBottom: "1.5rem" };

  return (
    <section>
      <TierHeading title="Resumen Ejecutivo" first />
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <Card variant="chartCard" styles={styles}>
          <h3>Utilidad Neta del Período</h3>
          <WaterfallUtilidad data={data} />
        </Card>
        <Card variant="chartCard" styles={styles}>
          <h3>Utilidad por Grupo y Subgrupo</h3>
          <TreemapGrupoSubgrupo data={data} />
        </Card>
      </div>
      <Card variant="chartCard" styles={styles} style={cardStyle}>
        <h3>Ranking de Productos por Margen (% Utilidad / Costo)</h3>
        <TopBottomMargen productos={productos} />
      </Card>

      <TierHeading title="Análisis de Márgenes" />
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <Card variant="chartCard" styles={styles}>
          <h3>Cantidad Vendida vs Margen por Producto</h3>
          <ScatterCantidadMargen productos={productos} />
        </Card>
        <Card variant="chartCard" styles={styles}>
          <h3>Concentración de Utilidad por Producto</h3>
          <ParetoUtilidad productos={productos} />
        </Card>
      </div>
      <div className={styles.chartsGridTwo} style={cardStyle}>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 320 }}>
          <h3>Margen Promedio por Bodega</h3>
          <BodegaMargen data={data} />
        </Card>
        <Card variant="chartCard" styles={styles} style={{ minHeight: 320 }}>
          <h3>Descuento sobre Bruto por Grupo</h3>
          <DescuentoPorGrupo data={data} />
        </Card>
      </div>

      <TierHeading title="Tendencia y Seguimiento" />
      <Card variant="chartCard" styles={styles} style={{ minHeight: 320 }}>
        <h3>Ventas vs Margen — Evolución Diaria</h3>
        <TendenciaDiaria data={data} />
      </Card>
    </section>
  );
};
