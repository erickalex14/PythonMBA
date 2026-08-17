"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import NovbiSplash from "./NovbiSplash";

interface RangoVentas {
  clave: string;
  etiqueta: string;
  desde: string;
  hasta: string;
  monto: number;
  monto_devoluciones: number;
  monto_neto: number;
  cantidad: number;
  comparado_con: string;
  monto_anterior: number;
  monto_neto_anterior: number;
  cantidad_anterior: number;
  periodo_en_curso: boolean;
  delta_pct: number | null;
}

interface TopProducto {
  codigo: string;
  producto: string;
  cantidad: number;
  monto: number;
}

interface DashboardVentas {
  fecha_ancla: string | null;
  ultima_sincronizacion: string | null;
  rangos: RangoVentas[];
  tops: Record<string, { cantidad: TopProducto[]; dinero: TopProducto[] }>;
}

const money = (n: number) =>
  n.toLocaleString("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const money0 = (n: number) =>
  n.toLocaleString("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const units = (n: number) => n.toLocaleString("es-EC");

function horaCorte(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fechaLarga(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" });
}

/** Barras horizontales con el nombre del producto DENTRO de la barra. */
function BarrasTop({
  titulo,
  filas,
  valor,
  formato,
  styles,
}: {
  titulo: string;
  filas: TopProducto[];
  valor: (p: TopProducto) => number;
  formato: (n: number) => string;
  styles: Record<string, string>;
}) {
  const max = Math.max(...filas.map(valor), 1);

  return (
    <Card variant="chartCard" styles={styles}>
      <h3>{titulo}</h3>
      {filas.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "1rem" }}>
          Sin ventas registradas en este rango.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.9rem" }}>
          {filas.map((p, i) => {
            const v = valor(p);
            const pct = Math.max((v / max) * 100, 12); // piso: que el nombre siempre entre
            return (
              // title: se conserva el tooltip al pasar el puntero, ademas del nombre visible
              <div key={`${p.codigo}-${i}`} title={`${p.producto} (${p.codigo})`}>
                <div
                  style={{
                    position: "relative",
                    height: 30,
                    borderRadius: 6,
                    background: "var(--color-surface-subtle, rgba(0,0,0,0.05))",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${pct}%`,
                      background: "var(--color-chart-accent, #2f4b7c)",
                      borderRadius: 6,
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      padding: "0 0.6rem",
                    }}
                  >
                    <span
                      style={{
                        color: "#fff",
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                        maxWidth: `calc(${pct}% - 1rem)`,
                      }}
                    >
                      {p.producto}
                    </span>
                    <span
                      style={{
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {formato(v)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function TarjetaRango({
  rango,
  corte,
  activo,
  onClick,
  styles,
}: {
  rango: RangoVentas;
  corte: string | null;
  activo: boolean;
  onClick: () => void;
  styles: Record<string, string>;
}) {
  const delta = rango.delta_pct;
  const positivo = (delta ?? 0) >= 0;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      style={{
        cursor: "pointer",
        borderRadius: 10,
        padding: "0.9rem 1rem",
        background: "var(--color-surface, #fff)",
        border: `1px solid ${activo ? "var(--color-brand-accent, #2f4b7c)" : "var(--color-border, rgba(0,0,0,0.1))"}`,
        boxShadow: activo ? "0 0 0 2px var(--color-brand-accent, #2f4b7c) inset" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.72rem", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
          {rango.etiqueta}
        </span>
        {rango.periodo_en_curso ? (
          // Hoy esta cortado en el ultimo sync: un % contra un dia completo
          // siempre daria negativo, asi que se muestra la hora en su lugar.
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--color-text-muted)" }}>
            {corte ? `hasta ${corte}` : "en curso"}
          </span>
        ) : delta === null ? (
          <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)" }}>sin comparativo</span>
        ) : (
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: positivo ? "#2e7d32" : "#c0392b" }}>
            {positivo ? "+" : ""}{delta}% vs. {rango.comparado_con}
          </span>
        )}
      </div>

      <div style={{ fontSize: "1.45rem", fontWeight: 700, margin: "0.35rem 0 0.1rem", color: "var(--color-text-primary)" }}>
        {money0(rango.monto_neto)}
      </div>
      <div style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
        venta sin devoluciones
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
        <span>Con devoluciones</span>
        <strong style={{ color: "var(--color-text-primary)" }}>{money0(rango.monto)}</strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
        <span>Devoluciones</span>
        <strong style={{ color: rango.monto_devoluciones > 0 ? "#c0392b" : "var(--color-text-primary)" }}>
          {rango.monto_devoluciones > 0 ? `- ${money0(rango.monto_devoluciones)}` : money0(0)}
        </strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: 2 }}>
        <span>Unidades</span>
        <strong style={{ color: "var(--color-text-primary)" }}>{units(rango.cantidad)}</strong>
      </div>
    </div>
  );
}

export const VentasDashboard: React.FC<{
  styles: Record<string, string>;
  onNavigate?: (start: string, end: string) => void;
}> = ({ styles, onNavigate }) => {
  const [datos, setDatos] = useState<DashboardVentas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangoActivo, setRangoActivo] = useState("hoy");

  useEffect(() => {
    let cancelado = false;
    fetch("/api/data/ventas-dashboard")
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => { if (!cancelado) setDatos(json); })
      .catch((err) => { if (!cancelado) setError(err.message || "No se pudo cargar el dashboard."); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, []);

  const corte = useMemo(() => horaCorte(datos?.ultima_sincronizacion ?? null), [datos]);
  const rangoSel = useMemo(
    () => datos?.rangos.find((r) => r.clave === rangoActivo) ?? datos?.rangos[0],
    [datos, rangoActivo]
  );
  const tops = datos?.tops?.[rangoActivo] ?? { cantidad: [], dinero: [] };

  if (cargando) return <NovbiSplash loop />;

  if (error) {
    return (
      <Card variant="chartCard" styles={styles}>
        <p style={{ color: "#c0392b", margin: 0 }}>{error}</p>
      </Card>
    );
  }

  if (!datos || datos.rangos.length === 0) {
    return (
      <Card variant="chartCard" styles={styles}>
        <p style={{ margin: 0 }}>No hay ventas sincronizadas todavía.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
          Ventas al <strong style={{ color: "var(--color-text-primary)" }}>{fechaLarga(datos.fecha_ancla)}</strong>
          {corte && <> · sincronizado hasta las <strong style={{ color: "var(--color-text-primary)" }}>{corte}</strong></>}
        </span>
        {onNavigate && rangoSel && (
          <Button onClick={() => onNavigate(rangoSel.desde, rangoSel.hasta)} className={styles.iconActionBtn}>
            Ver detalle de {rangoSel.etiqueta.toLowerCase()} →
          </Button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: "0.75rem" }}>
        {datos.rangos.map((r) => (
          <TarjetaRango
            key={r.clave}
            rango={r}
            corte={corte}
            activo={r.clave === rangoActivo}
            onClick={() => setRangoActivo(r.clave)}
            styles={styles}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: "1rem" }}>
        <BarrasTop
          titulo={`Más vendidos por dinero · ${rangoSel?.etiqueta ?? ""}`}
          filas={tops.dinero}
          valor={(p) => p.monto}
          formato={money}
          styles={styles}
        />
        <BarrasTop
          titulo={`Más vendidos por cantidad · ${rangoSel?.etiqueta ?? ""}`}
          filas={tops.cantidad}
          valor={(p) => p.cantidad}
          formato={units}
          styles={styles}
        />
      </div>
    </div>
  );
};

export default VentasDashboard;
