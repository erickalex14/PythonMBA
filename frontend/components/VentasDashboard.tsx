"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import NovbiSplash from "./NovbiSplash";
import { DevolucionesDonut, type DonutSegment } from "./charts/DevolucionesDonut";

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

interface TopsPorVista {
  cantidad: TopProducto[];
  dinero: TopProducto[];
}

interface DashboardVentas {
  fecha_ancla: string | null;
  ultima_sincronizacion: string | null;
  rangos: RangoVentas[];
  // "general" consolida NVC01+ENV01 bajo un solo codigo; por_empresa trae la
  // misma metrica aislada por empresa - misma consulta al ERP, sin costo extra.
  tops: Record<string, { general: TopsPorVista; por_empresa: Record<string, TopsPorVista> }>;
}

interface TotalesEmpresaResp {
  empresa: string;
  empresa_nombre: string;
  monto: number;
  monto_devoluciones: number;
  monto_neto: number;
  cantidad: number;
}

interface VentasTotalesResp {
  monto: number;
  monto_devoluciones: number;
  monto_neto: number;
  por_empresa?: TotalesEmpresaResp[];
}

// Mismo lenguaje de color que KPICards.tsx: NOVICOMPU en azul de marca, ENV
// en verde de marca - no se inventan colores nuevos para esta dona.
const EMPRESA_COLOR: Record<string, string> = {
  NVC01: "var(--color-brand-primary)",
  ENV01: "var(--color-brand-accent)",
};
const EMPRESA_COLOR_FALLBACK = "var(--color-text-tertiary)";

// Nombres reales confirmados desde /api/v1/ventas/totales (por_empresa[].empresa_nombre) -
// se fijan acá para que la barra de pestañas del dashboard no dependa de que
// el rango activo tenga ventas de ambas empresas para poder mostrarlas.
const EMPRESA_TABS = [
  { key: "general", label: "General" },
  { key: "NVC01", label: "Novicompu" },
  { key: "ENV01", label: "ENV" },
] as const;

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

// Contenedor con stagger: cada fila de barra aparece un poco después de la
// anterior. reducedMotion apaga el stagger y las transiciones (accesibilidad,
// prefers-reduced-motion) sin tocar el layout final.
const barListVariants = (reducedMotion: boolean): Variants => ({
  hidden: {},
  show: {
    transition: reducedMotion ? {} : { staggerChildren: 0.06, delayChildren: 0.05 },
  },
});

// Paleta sobria para las barras Top: variacion sutil de tono en vez del
// mismo azul repetido en cada fila - todos los tonos ya existen en el
// sistema de diseño (ningun color nuevo inventado).
const BAR_PALETTE = [
  "var(--color-chart-accent)",
  "var(--color-brand-primary)",
  "var(--color-brand-primary-alt)",
  "var(--color-brand-accent-dark)",
];

const barRowVariants = (reducedMotion: boolean): Variants => ({
  hidden: reducedMotion ? { opacity: 1 } : { opacity: 0, x: -12 },
  show: {
    opacity: 1,
    x: 0,
    transition: reducedMotion ? { duration: 0 } : { duration: 0.35, ease: "easeOut" },
  },
});

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
  const reducedMotion = useReducedMotion() ?? false;
  const max = Math.max(...filas.map(valor), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
    >
      <Card variant="chartCard" styles={styles}>
        <h3>{titulo}</h3>
        {filas.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "1rem" }}>
            Sin ventas registradas en este rango.
          </p>
        ) : (
          <motion.div
            variants={barListVariants(reducedMotion)}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.9rem" }}
          >
            {filas.map((p, i) => {
              const v = valor(p);
              const pct = Math.max((v / max) * 100, 12); // piso: que el nombre siempre entre
              return (
                // title: se conserva el tooltip al pasar el puntero, ademas del nombre visible
                <motion.div
                  key={`${p.codigo}-${i}`}
                  title={`${p.producto} (${p.codigo})`}
                  variants={barRowVariants(reducedMotion)}
                  whileHover={reducedMotion ? undefined : { scale: 1.015 }}
                  transition={{ duration: 0.15 }}
                >
                  <div
                    style={{
                      position: "relative",
                      height: 30,
                      borderRadius: 6,
                      background: "var(--color-surface-subtle, rgba(0,0,0,0.05))",
                      overflow: "hidden",
                    }}
                  >
                    <motion.div
                      initial={{ width: reducedMotion ? `${pct}%` : 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={reducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut", delay: 0.1 }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: BAR_PALETTE[i % BAR_PALETTE.length],
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
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </Card>
    </motion.div>
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
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className={styles.rangeCard}
      variants={barRowVariants(reducedMotion)}
      whileHover={reducedMotion ? undefined : { y: -3 }}
      whileTap={reducedMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ cursor: "pointer", borderRadius: 10, padding: "0.9rem 1rem" }}
    >
      {activo && (
        <motion.div
          layoutId="rangeActiveRing"
          className={styles.rangeCardRing}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.72rem", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--rc-text-muted)" }}>
          {rango.etiqueta}
        </span>
        {rango.periodo_en_curso ? (
          // Hoy esta cortado en el ultimo sync: un % contra un dia completo
          // siempre daria negativo, asi que se muestra la hora en su lugar.
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--rc-text-muted)" }}>
            {corte ? `hasta ${corte}` : "en curso"}
          </span>
        ) : delta === null ? (
          <span style={{ fontSize: "0.68rem", color: "var(--rc-text-muted)" }}>sin comparativo</span>
        ) : (
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: positivo ? "var(--rc-delta-up)" : "var(--rc-delta-down)" }}>
            {positivo ? "+" : ""}{delta}% vs. {rango.comparado_con}
          </span>
        )}
      </div>

      <div style={{ fontSize: "1.45rem", fontWeight: 700, margin: "0.35rem 0 0.1rem", color: "var(--rc-text)" }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={rango.monto_neto}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >
            {money0(rango.monto_neto)}
          </motion.span>
        </AnimatePresence>
      </div>
      <div style={{ fontSize: "0.68rem", color: "var(--rc-text-muted)", marginBottom: "0.5rem" }}>
        venta sin devoluciones
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--rc-text-muted)" }}>
        <span>Con devoluciones</span>
        <strong style={{ color: "var(--rc-text)" }}>{money0(rango.monto)}</strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--rc-text-muted)" }}>
        <span>Devoluciones</span>
        <strong style={{ color: rango.monto_devoluciones > 0 ? "var(--rc-delta-down)" : "var(--rc-text)" }}>
          {rango.monto_devoluciones > 0 ? `- ${money0(rango.monto_devoluciones)}` : money0(0)}
        </strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--rc-text-muted)", marginTop: 2 }}>
        <span>Unidades</span>
        <strong style={{ color: "var(--rc-text)" }}>{units(rango.cantidad)}</strong>
      </div>
    </motion.div>
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
  const [totalesRango, setTotalesRango] = useState<VentasTotalesResp | null>(null);
  const [cargandoDevoluciones, setCargandoDevoluciones] = useState(false);
  // Selector de empresa a nivel de todo el dashboard: "general" (mezclado,
  // vista real/actual) es el que se ve primero. Afecta las tarjetas de rango
  // y los top-productos (el backend trae ambas vistas en la misma consulta) -
  // la dona de devoluciones queda siempre fija en "general", sin importar esto.
  const [empresaSel, setEmpresaSel] = useState<(typeof EMPRESA_TABS)[number]["key"]>("general");
  const [rangosPorEmpresa, setRangosPorEmpresa] = useState<Record<string, TotalesEmpresaResp> | null>(null);
  const [cargandoEmpresa, setCargandoEmpresa] = useState(false);
  const reducedMotionRoot = useReducedMotion() ?? false;

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
  const topsVacios: TopsPorVista = { cantidad: [], dinero: [] };
  const topsRango = datos?.tops?.[rangoActivo];
  const tops =
    empresaSel === "general"
      ? topsRango?.general ?? topsVacios
      : topsRango?.por_empresa?.[empresaSel] ?? topsVacios;

  // Al elegir una empresa, se piden en paralelo los totales reales de los 6
  // rangos (mismo endpoint /ventas-totales de la dona) y se guarda el que
  // corresponde a esa empresa por rango - así cambiar de tarjeta (HOY/AYER/...)
  // después no dispara más pedidos, solo lee el mapa ya cargado.
  useEffect(() => {
    if (empresaSel === "general" || !datos) {
      setRangosPorEmpresa(null);
      return;
    }
    let cancelado = false;
    setCargandoEmpresa(true);
    Promise.all(
      datos.rangos.map((r) =>
        fetch(`/api/data/ventas-totales?inicio=${r.desde}&fin=${r.hasta}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((json: VentasTotalesResp | null) => {
            const emp = json?.por_empresa?.find((e) => e.empresa === empresaSel) ?? null;
            return [r.clave, emp] as const;
          })
          .catch(() => [r.clave, null] as const)
      )
    ).then((entries) => {
      if (cancelado) return;
      const map: Record<string, TotalesEmpresaResp> = {};
      entries.forEach(([clave, emp]) => { if (emp) map[clave] = emp; });
      setRangosPorEmpresa(map);
    }).finally(() => { if (!cancelado) setCargandoEmpresa(false); });
    return () => { cancelado = true; };
  }, [empresaSel, datos]);

  // Tarjetas de rango con los montos reales de la empresa elegida (delta_pct
  // en null porque el backend no trae comparativo por empresa - TarjetaRango
  // ya sabe mostrar "sin comparativo" en ese caso).
  const rangosMostrados: RangoVentas[] = useMemo(() => {
    if (!datos) return [];
    if (empresaSel === "general") return datos.rangos;
    return datos.rangos.map((r) => {
      const emp = rangosPorEmpresa?.[r.clave];
      if (!emp) return { ...r, monto: 0, monto_devoluciones: 0, monto_neto: 0, cantidad: 0, delta_pct: null };
      return {
        ...r,
        monto: emp.monto,
        monto_devoluciones: emp.monto_devoluciones,
        monto_neto: emp.monto_neto,
        cantidad: emp.cantidad,
        delta_pct: null,
      };
    });
  }, [datos, empresaSel, rangosPorEmpresa]);

  // Devoluciones por empresa: /ventas-dashboard no trae este desglose, pero
  // /ventas-totales sí (mismo endpoint que usan los KPIs del reporte de
  // Ventas) - se reconsulta con el desde/hasta del rango activo cada vez que
  // el usuario cambia de tarjeta (HOY/AYER/ESTA SEMANA/...).
  useEffect(() => {
    if (!rangoSel) return;
    let cancelado = false;
    setCargandoDevoluciones(true);
    fetch(`/api/data/ventas-totales?inicio=${rangoSel.desde}&fin=${rangoSel.hasta}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelado) setTotalesRango(json); })
      .catch(() => { if (!cancelado) setTotalesRango(null); })
      .finally(() => { if (!cancelado) setCargandoDevoluciones(false); });
    return () => { cancelado = true; };
  }, [rangoSel?.desde, rangoSel?.hasta]);

  const devolucionesSegments: DonutSegment[] = useMemo(() => {
    return (totalesRango?.por_empresa ?? [])
      .filter((e) => e.monto_devoluciones > 0)
      .map((e) => ({
        key: e.empresa,
        label: e.empresa_nombre,
        value: e.monto_devoluciones,
        color: EMPRESA_COLOR[e.empresa] ?? EMPRESA_COLOR_FALLBACK,
      }));
  }, [totalesRango]);

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
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotionRoot ? 0 : 0.4, ease: "easeOut" }}
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}
      >
        <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
          Ventas al <strong style={{ color: "var(--color-text-primary)" }}>{fechaLarga(datos.fecha_ancla)}</strong>
          {corte && <> · sincronizado hasta las <strong style={{ color: "var(--color-text-primary)" }}>{corte}</strong></>}
        </span>
        {onNavigate && rangoSel && (
          <Button onClick={() => onNavigate(rangoSel.desde, rangoSel.hasta)} className={styles.viewDetailBtn}>
            Ver detalle de {rangoSel.etiqueta.toLowerCase()}
            <span className={styles.viewDetailBtnArrow}>→</span>
          </Button>
        )}
      </motion.div>

      <div className={styles.empresaTabBar}>
        {EMPRESA_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setEmpresaSel(tab.key)}
            className={styles.empresaTab}
          >
            {tab.key === empresaSel && (
              <motion.span
                layoutId="dashboardEmpresaTabIndicator"
                className={styles.empresaTabIndicator}
                transition={reducedMotionRoot ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className={styles.empresaTabLabel} data-active={tab.key === empresaSel}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      <motion.div
        variants={barListVariants(reducedMotionRoot)}
        initial="hidden"
        animate="show"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: "0.75rem", opacity: cargandoEmpresa ? 0.5 : 1, transition: "opacity 0.15s ease" }}
      >
        {rangosMostrados.map((r) => (
          <TarjetaRango
            key={r.clave}
            rango={r}
            corte={corte}
            activo={r.clave === rangoActivo}
            onClick={() => setRangoActivo(r.clave)}
            styles={styles}
          />
        ))}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: "1rem" }}>
        <BarrasTop
          titulo={`Más vendidos por dinero · ${rangoSel?.etiqueta ?? ""}${empresaSel !== "general" ? ` · ${EMPRESA_TABS.find((t) => t.key === empresaSel)?.label ?? ""}` : ""}`}
          filas={tops.dinero}
          valor={(p) => p.monto}
          formato={money}
          styles={styles}
        />
        <BarrasTop
          titulo={`Más vendidos por cantidad · ${rangoSel?.etiqueta ?? ""}${empresaSel !== "general" ? ` · ${EMPRESA_TABS.find((t) => t.key === empresaSel)?.label ?? ""}` : ""}`}
          filas={tops.cantidad}
          valor={(p) => p.cantidad}
          formato={units}
          styles={styles}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={reducedMotionRoot ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      >
        <Card variant="chartCard" styles={styles}>
          <h3>Devoluciones por empresa · {rangoSel?.etiqueta ?? ""}</h3>
          {cargandoDevoluciones ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "1rem" }}>
              Cargando devoluciones…
            </p>
          ) : (
            <div style={{ marginTop: "0.9rem" }}>
              <DevolucionesDonut
                segments={devolucionesSegments}
                totalLabel={`Devoluciones · ${rangoSel?.etiqueta ?? ""}`}
                totalValue={totalesRango?.monto_devoluciones ?? 0}
                formatter={money0}
              />
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default VentasDashboard;
