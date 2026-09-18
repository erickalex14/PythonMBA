"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Poppins } from "next/font/google";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { GooeySearchBar } from "../../../components/ui/GooeySearchBar";
import { LoadingState, EmptyState } from "../../../components/ui/StatusArea";
import { Pagination } from "../../../components/ui/Pagination";

const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"] });

const usd = (n: number) =>
  (n ?? 0).toLocaleString("es-EC", { style: "currency", currency: "USD" });

interface SucursalCosto {
  sucursal: string;
  codigo: string;
  corp: string;
  costo_total: number;
  total_subbodegas: number;
  ciudad: string | null;
}

interface TopItem {
  etiqueta: string;
  costo_total: number;
}

interface RespuestaCostos {
  sucursales: SucursalCosto[];
  total_general: number;
  filas_procesadas: number;
  ultima_sincronizacion: string | null;
  top_productos: TopItem[];
  top_grupos: TopItem[];
  top_marcas: TopItem[];
}

interface BodegaPrincipal {
  codigo: string;
  nombre: string;
  corp: string;
}

// El selector de Bodega Principal puede listar opciones de las dos empresas
// a la vez (cuando el filtro de empresa esta en "Todas las empresas"): el
// codigo solo no alcanza para identificar una fila de forma univoca en ese
// caso (mismo riesgo que WARE_CODE compartido, ej. TRN/RCP), asi que el
// value de cada <option> lleva la empresa pegada.
const codificarPrincipal = (b: BodegaPrincipal) => `${b.corp}::${b.codigo}`;
const decodificarPrincipal = (valor: string): { corp: string; codigo: string } => {
  const [corp, ...resto] = valor.split("::");
  return { corp, codigo: resto.join("::") };
};

interface SubBodega {
  ware_code: string;
  nombre: string | null;
  tipo: string | null;
  costo_total: number;
}

interface Opciones {
  bodegas_principales: BodegaPrincipal[];
  grupos: string[];
  marcas: string[];
}

interface Empresa {
  corp: string;
  nombre: string;
}

interface LineaDetalle {
  corp: string;
  bodega_principal: string;
  ware_code: string;
  sub_bodega_nombre: string | null;
  sub_bodega_tipo: string | null;
  product_id_corp: string;
  producto_nombre: string | null;
  grupo: string | null;
  subgrupo: string | null;
  marca: string | null;
  oh: number;
  costo_unitario: number;
  costo_total: number;
}

interface RespuestaDetalle {
  lineas: LineaDetalle[];
  total_filas: number;
  limit: number;
  offset: number;
}

export default function CostosBodegaPage() {
  const router = useRouter();
  const [vista, setVista] = useState<"resumen" | "detalle">("resumen");

  // Empresa: NVC01 y ENV01 comparten codigos de bodega (ambas tienen "TRN",
  // "RCP"), asi que nunca se mezclan del lado del backend -- "" (Todas) junta
  // los totales de las dos, elegir una acota todo (resumen, detalle,
  // opciones de filtro) a esa sola empresa.
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroCorp, setFiltroCorp] = useState("");

  useEffect(() => {
    fetch("/api/data/costos-bodega?recurso=empresas")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEmpresas)
      .catch(() => {});
  }, []);

  // ---------- Resumen ----------
  const [datos, setDatos] = useState<RespuestaCostos | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginaResumen, setPaginaResumen] = useState(1);
  const [porPaginaResumen, setPorPaginaResumen] = useState(50);

  const consultarResumen = async (corp: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = corp ? `&corp=${corp}` : "";
      const res = await fetch(`/api/data/costos-bodega?recurso=resumen${qs}`);
      if (!res.ok) throw new Error(await res.text());
      setDatos(await res.json());
    } catch (err: any) {
      setError(err.message || "No se pudo obtener el reporte de costos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vista !== "resumen") return;
    consultarResumen(filtroCorp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, filtroCorp]);

  const filtradas = useMemo(() => {
    const filas = datos?.sucursales || [];
    if (!busqueda.trim()) return filas;
    const q = busqueda.toLowerCase();
    return filas.filter((s) => s.sucursal.toLowerCase().includes(q));
  }, [datos, busqueda]);

  const ordenadas = useMemo(
    () => [...filtradas].sort((a, b) => b.costo_total - a.costo_total),
    [filtradas]
  );

  // La busqueda/empresa cambian que entra en `ordenadas` -- sin este reset se
  // puede quedar pidiendo una pagina que ya no existe en el resultado filtrado.
  useEffect(() => {
    setPaginaResumen(1);
  }, [busqueda, filtroCorp]);

  const paginadas = useMemo(
    () => ordenadas.slice((paginaResumen - 1) * porPaginaResumen, paginaResumen * porPaginaResumen),
    [ordenadas, paginaResumen, porPaginaResumen]
  );

  // Filas desplegables: cada Bodega Principal se puede abrir para ver el
  // desglose de costo por sus sub-bodegas (GET /subbodegas, el mismo
  // endpoint que ya alimenta el segundo selector del Detalle -- ahora
  // tambien trae costo_total por sub-bodega). Clave = corp::codigo (igual
  // que codificarPrincipal): el codigo solo no identifica una fila si hay
  // dos empresas mezcladas en "Todas las empresas".
  const [filasAbiertas, setFilasAbiertas] = useState<Set<string>>(new Set());
  const [desglose, setDesglose] = useState<Record<string, SubBodega[]>>({});
  const [desgloseCargando, setDesgloseCargando] = useState<Record<string, boolean>>({});
  const [desgloseError, setDesgloseError] = useState<Record<string, string>>({});

  const alternarFila = (s: SucursalCosto) => {
    const clave = `${s.corp}::${s.codigo}`;
    setFilasAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
    if (desglose[clave] || desgloseCargando[clave]) return;
    setDesgloseCargando((prev) => ({ ...prev, [clave]: true }));
    setDesgloseError((prev) => { const { [clave]: _omit, ...resto } = prev; return resto; });
    fetch(`/api/data/costos-bodega?recurso=subbodegas&corp=${s.corp}&bodega_principal=${encodeURIComponent(s.codigo)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((j: SubBodega[]) => setDesglose((prev) => ({ ...prev, [clave]: j })))
      .catch((err: any) => setDesgloseError((prev) => ({ ...prev, [clave]: err.message || "No se pudo cargar el desglose." })))
      .finally(() => setDesgloseCargando((prev) => ({ ...prev, [clave]: false })));
  };

  const sinSincronizar = !loading && !error && datos && datos.filas_procesadas === 0;

  // Exportar (Resumen): UN solo archivo con 2 hojas (Resumen por Bodega +
  // Detalle completo producto x bodega) -- pedido explicito para que se vea
  // como el reporte nativo de MBA3 que usaba Contabilidad antes ("Saldos y
  // Costos Por Bodega" + su propia hoja de formulas por sucursal), no dos
  // descargas separadas. El backend vuelve a consultar Postgres el mismo
  // corp que esta filtrado en pantalla -- no manda los datos ya cargados del
  // cliente (el Detalle completo no esta cargado ahi, puede ser ~157k filas).
  const [exportandoResumen, setExportandoResumen] = useState(false);
  const exportarResumenExcel = async () => {
    if (ordenadas.length === 0) return;
    setExportandoResumen(true);
    try {
      const params = new URLSearchParams({ type: "costos-bodega" });
      if (filtroCorp) params.set("corp", filtroCorp);
      const res = await fetch(`/api/data/excel?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_Costos_Bodega_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error al generar Excel: ${err.message}`);
    } finally {
      setExportandoResumen(false);
    }
  };

  // ---------- Detalle ----------
  const [opciones, setOpciones] = useState<Opciones>({ bodegas_principales: [], grupos: [], marcas: [] });
  // Filtro en dos niveles: primero se elige la Bodega Principal, y SOLO ahi se
  // habilita/puebla el selector de Sub-Bodega (sus WARE_CODE hijos) -- pedido
  // explicito: "seleccionar la principal y luego si filtrar por subbodega".
  // Se guarda codificado (corp::codigo, ver codificarPrincipal): con "Todas
  // las empresas" elegido arriba, el codigo solo no identifica una fila de
  // forma univoca (dos empresas podrian compartirlo, igual que TRN/RCP a
  // nivel de WARE_CODE) -- por eso la empresa a usar para pedir sub-bodegas
  // y filtrar el detalle es la de la PRINCIPAL elegida, no el selector
  // global de arriba.
  const [filtroBodegaPrincipal, setFiltroBodegaPrincipal] = useState("");
  const principalSeleccionada = filtroBodegaPrincipal ? decodificarPrincipal(filtroBodegaPrincipal) : null;
  const [subbodegas, setSubbodegas] = useState<SubBodega[]>([]);
  const [filtroSubBodega, setFiltroSubBodega] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [busquedaDetalle, setBusquedaDetalle] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(50);
  const [detalle, setDetalle] = useState<RespuestaDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  // Las opciones (bodegas principales/grupos/marcas) dependen de la empresa
  // elegida: se vuelven a pedir cada vez que cambia filtroCorp, no solo la
  // primera vez.
  useEffect(() => {
    if (vista !== "detalle") return;
    const qs = filtroCorp ? `&corp=${filtroCorp}` : "";
    fetch(`/api/data/costos-bodega?recurso=opciones${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setOpciones(j))
      .catch(() => {});
  }, [vista, filtroCorp]);

  // Cambiar de empresa invalida los filtros elegidos (son valores de la
  // empresa anterior, pueden no existir en la nueva).
  useEffect(() => {
    setFiltroBodegaPrincipal("");
    setFiltroGrupo("");
    setFiltroMarca("");
    setPagina(1);
  }, [filtroCorp]);

  // Al elegir/cambiar la Bodega Principal, se piden SUS sub-bodegas (segundo
  // paso del filtro) y se limpia cualquier sub-bodega elegida antes (era hija
  // de otra principal, ya no aplica). Usa la empresa de la PRINCIPAL elegida
  // (no el selector global): con "Todas las empresas" el selector global
  // esta vacio, pero la principal elegida siempre sabe a que empresa
  // pertenece (viene codificado en el value, ver codificarPrincipal).
  useEffect(() => {
    setFiltroSubBodega("");
    if (vista !== "detalle" || !principalSeleccionada) {
      setSubbodegas([]);
      return;
    }
    const { corp, codigo } = principalSeleccionada;
    fetch(`/api/data/costos-bodega?recurso=subbodegas&corp=${corp}&bodega_principal=${encodeURIComponent(codigo)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSubbodegas)
      .catch(() => setSubbodegas([]));
  }, [vista, filtroBodegaPrincipal]);

  useEffect(() => {
    if (vista !== "detalle") return;
    let cancelado = false;
    setLoadingDetalle(true);
    setErrorDetalle(null);
    const params = new URLSearchParams({
      recurso: "detalle",
      limit: String(porPagina),
      offset: String((pagina - 1) * porPagina),
    });
    // Una vez elegida una Bodega Principal, la empresa a filtrar es la SUYA
    // (viene codificada en el value) -- no el selector global de arriba, que
    // puede estar en "Todas las empresas" (corp = "") sin que eso invalide
    // haber elegido una principal puntual de una empresa especifica.
    const corpEfectivo = principalSeleccionada?.corp || filtroCorp;
    if (corpEfectivo) params.set("corp", corpEfectivo);
    if (principalSeleccionada) params.set("bodega_principal", principalSeleccionada.codigo);
    if (filtroSubBodega) params.set("sub_bodega", filtroSubBodega);
    if (filtroGrupo) params.set("grupo", filtroGrupo);
    if (filtroMarca) params.set("marca", filtroMarca);
    if (busquedaDetalle.trim()) params.set("q", busquedaDetalle.trim());

    fetch(`/api/data/costos-bodega?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((j) => { if (!cancelado) setDetalle(j); })
      .catch((err) => { if (!cancelado) setErrorDetalle(err.message || "No se pudo obtener el detalle."); })
      .finally(() => { if (!cancelado) setLoadingDetalle(false); });

    return () => { cancelado = true; };
  }, [vista, filtroCorp, filtroBodegaPrincipal, filtroSubBodega, filtroGrupo, filtroMarca, busquedaDetalle, pagina, porPagina]);

  // Cualquier cambio de filtro vuelve a la pagina 1 -- si no, se puede quedar
  // pidiendo un offset que ya no existe en el resultado filtrado.
  const cambiarFiltro = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPagina(1);
  };

  // Exportar Detalle: a diferencia del Resumen, el Detalle puede tener hasta
  // ~157k lineas y solo la pagina actual esta cargada en el navegador -- este
  // pide al backend TODAS las lineas que matchean los filtros actuales (no
  // las que se ven en pantalla) via un endpoint GET dedicado, con los mismos
  // filtros que ya se le mandan a /detalle.
  const [exportandoDetalle, setExportandoDetalle] = useState(false);
  const exportarDetalleExcel = async () => {
    setExportandoDetalle(true);
    try {
      const params = new URLSearchParams({ type: "costos-bodega-detalle" });
      const corpEfectivo = principalSeleccionada?.corp || filtroCorp;
      if (corpEfectivo) params.set("corp", corpEfectivo);
      if (principalSeleccionada) params.set("bodega_principal", principalSeleccionada.codigo);
      if (filtroSubBodega) params.set("sub_bodega", filtroSubBodega);
      if (filtroGrupo) params.set("grupo", filtroGrupo);
      if (filtroMarca) params.set("marca", filtroMarca);
      if (busquedaDetalle.trim()) params.set("q", busquedaDetalle.trim());

      const res = await fetch(`/api/data/excel?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_Costos_Bodega_Detalle_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error al generar Excel: ${err.message}`);
    } finally {
      setExportandoDetalle(false);
    }
  };

  return (
    <>
      <header className={styles.contentHeader}>
        <h1 className={`${poppins.className} ${styles.moduleTitle}`}>Costos por Sucursal</h1>
        <p className={styles.moduleSubtext}>
          Costo total de inventario (existencia x costo promedio), por sucursal o en detalle por producto
        </p>
      </header>

      <motion.section
        className={styles.filterPanel}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className={styles.movToolbar}>
          {/* Switch de dos segmentos (no un solo boton con texto que cambia):
              ambas vistas quedan a la vista todo el tiempo, con un fondo que
              desliza al segmento activo (framer-motion layoutId) en vez de
              un simple cambio de color. */}
          <div style={{ display: "inline-flex", background: "var(--color-surface-subtle)", borderRadius: "var(--radius-pill)", padding: "0.25rem", gap: "0.25rem" }}>
            {([
              { valor: "resumen", etiqueta: "Resumen por Bodega" },
              { valor: "detalle", etiqueta: "Detalle por Producto" },
            ] as const).map((op) => (
              <button
                key={op.valor}
                type="button"
                onClick={() => setVista(op.valor)}
                style={{
                  position: "relative",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "0.55rem 1.15rem",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: vista === op.valor ? "#ffffff" : "var(--color-text-tertiary)",
                  transition: "color 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {vista === op.valor && (
                  <motion.span
                    layoutId="vistaSwitchHighlight"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{
                      position: "absolute", inset: 0, borderRadius: "var(--radius-pill)", zIndex: -1,
                      background: "linear-gradient(135deg, var(--color-brand-primary) 0%, var(--color-brand-primary-alt) 100%)",
                      boxShadow: "var(--shadow-brand-md)",
                    }}
                  />
                )}
                {op.etiqueta}
              </button>
            ))}
          </div>

          <select
            value={filtroCorp}
            onChange={(e) => setFiltroCorp(e.target.value)}
            className={styles.selectFilter}
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e.corp} value={e.corp}>{e.nombre} ({e.corp})</option>)}
          </select>

          {vista === "resumen" && datos && datos.sucursales.length > 0 && (
            <>
              <div className={styles.movToolbarDivider} />
              <GooeySearchBar value={busqueda} onChange={setBusqueda} placeholder="Buscar bodega principal..." />
            </>
          )}

          {vista === "detalle" && (
            <>
              <select
                value={filtroBodegaPrincipal}
                onChange={(e) => cambiarFiltro(setFiltroBodegaPrincipal)(e.target.value)}
                className={styles.selectFilter}
              >
                <option value="">Todas las bodegas principales</option>
                {opciones.bodegas_principales.map((b) => (
                  <option key={codificarPrincipal(b)} value={codificarPrincipal(b)}>
                    {b.nombre}{!filtroCorp ? ` (${b.corp})` : ""}
                  </option>
                ))}
              </select>
              <select
                value={filtroSubBodega}
                onChange={(e) => cambiarFiltro(setFiltroSubBodega)(e.target.value)}
                className={styles.selectFilter}
                disabled={!filtroBodegaPrincipal}
                title={!filtroBodegaPrincipal ? "Elegí primero una Bodega Principal" : undefined}
              >
                <option value="">
                  {filtroBodegaPrincipal ? "Todas las sub-bodegas" : "Elegí una bodega principal primero"}
                </option>
                {subbodegas.map((s) => (
                  <option key={s.ware_code} value={s.ware_code}>
                    {s.nombre ? `${s.nombre} (${s.ware_code})` : s.ware_code}
                    {s.tipo ? ` — ${s.tipo}` : ""}
                  </option>
                ))}
              </select>
              <select
                value={filtroGrupo}
                onChange={(e) => cambiarFiltro(setFiltroGrupo)(e.target.value)}
                className={styles.selectFilter}
              >
                <option value="">Todos los grupos</option>
                {opciones.grupos.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select
                value={filtroMarca}
                onChange={(e) => cambiarFiltro(setFiltroMarca)(e.target.value)}
                className={styles.selectFilter}
              >
                <option value="">Todas las marcas</option>
                {opciones.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className={styles.movToolbarDivider} />
              <GooeySearchBar
                value={busquedaDetalle}
                onChange={cambiarFiltro(setBusquedaDetalle)}
                placeholder="Buscar producto (código o nombre)..."
              />
            </>
          )}

          <div className={styles.movToolbarSpacer} />
        </div>
      </motion.section>

      {vista === "resumen" ? (
        <section className={styles.reportSection}>
          {error && <div className={styles.errorAlert}>{error}</div>}

          {loading && <LoadingState styles={styles} label="Cargando reporte de costos..." />}

          {sinSincronizar && (
            <EmptyState styles={styles} icon={null} message={
              <>
                Todavía no hay datos sincronizados desde MBA3.{" "}
                <button
                  type="button"
                  onClick={() => router.push("/panel/sync")}
                  style={{ background: "none", border: "none", color: "var(--color-chart-accent)", cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}
                >
                  Ve a Sincronizar ERP
                </button>{" "}
                y ejecuta «Sincronizar Costos».
              </>
            } />
          )}

          {!loading && datos && datos.sucursales.length > 0 && (
            <>
              <section className={styles.kpiGrid}>
                <Card variant="kpiCard" styles={styles}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h3>Costo Total de Inventario</h3>
                    <div style={{ background: "var(--color-surface-tint-accent)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-chart-accent)" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    </div>
                  </div>
                  <p className={styles.kpiValue}>{usd(datos.total_general)}</p>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
                    {filtroCorp ? empresas.find((e) => e.corp === filtroCorp)?.nombre || filtroCorp : "todas las empresas"}
                  </div>
                </Card>

                <Card variant="kpiCard" styles={styles}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h3>Bodegas Principales</h3>
                    <div style={{ background: "var(--color-surface-tint-blue)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2.5"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /></svg>
                    </div>
                  </div>
                  <p className={styles.kpiValue}>{datos.sucursales.length.toLocaleString("es-EC")}</p>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
                    con costo de inventario &gt; 0
                  </div>
                </Card>

                <Card variant="kpiCard" styles={styles}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h3>Líneas de Inventario</h3>
                    <div style={{ background: "var(--color-surface-tint-violet)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-violet)" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                    </div>
                  </div>
                  <p className={styles.kpiValue}>{datos.filas_procesadas.toLocaleString("es-EC")}</p>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
                    productos x bodega, con existencia &gt; 0
                  </div>
                </Card>
              </section>

              {datos.top_productos.length > 0 && (
                <section className={styles.kpiGrid} style={{ marginBottom: "1.5rem" }}>
                  <Card variant="kpiCard" styles={styles}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h3>Bodega Principal con Mayor Costo</h3>
                      <div style={{ background: "var(--color-surface-tint-blue)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2.5"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /></svg>
                      </div>
                    </div>
                    <p className={styles.kpiValue}>{usd(ordenadas[0]?.costo_total || 0)}</p>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ordenadas[0]?.sucursal}
                    </div>
                  </Card>

                  <Card variant="kpiCard" styles={styles}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h3>Producto con Mayor Costo</h3>
                      <div style={{ background: "var(--color-surface-tint-accent)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-chart-accent)" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                      </div>
                    </div>
                    <p className={styles.kpiValue}>{usd(datos.top_productos[0]?.costo_total || 0)}</p>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {datos.top_productos[0]?.etiqueta}
                    </div>
                  </Card>

                  <Card variant="kpiCard" styles={styles}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h3>Grupo con Mayor Costo</h3>
                      <div style={{ background: "var(--color-surface-tint-violet)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-violet)" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                      </div>
                    </div>
                    <p className={styles.kpiValue}>{usd(datos.top_grupos[0]?.costo_total || 0)}</p>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {datos.top_grupos[0]?.etiqueta}
                    </div>
                  </Card>

                  <Card variant="kpiCard" styles={styles}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h3>Marca con Mayor Costo</h3>
                      <div style={{ background: "var(--color-surface-tint-blue)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2.5"><path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" /></svg>
                      </div>
                    </div>
                    <p className={styles.kpiValue}>{usd(datos.top_marcas[0]?.costo_total || 0)}</p>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {datos.top_marcas[0]?.etiqueta}
                    </div>
                  </Card>
                </section>
              )}

              <div className={styles.reportHeaderActions}>
                <h3>
                  {ordenadas.length} bodegas principales
                  {busqueda.trim() && ` (de ${datos.sucursales.length})`}
                </h3>
                <Button
                  onClick={exportarResumenExcel}
                  className={styles.iconActionBtn}
                  disabled={exportandoResumen}
                  title="Descargar Excel (Resumen + Detalle completo)"
                  aria-label="Descargar Excel"
                >
                  {exportandoResumen ? (
                    <span className={styles.iconBtnSpinner} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 15v1.5A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </Button>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Bodega Principal</th>
                      <th>Ciudad</th>
                      <th>Sub-Bodegas</th>
                      <th>Costo de inventario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginadas.map((s) => {
                      const clave = `${s.corp}::${s.codigo}`;
                      const abierta = filasAbiertas.has(clave);
                      const filas = desglose[clave];
                      return (
                        <React.Fragment key={clave}>
                          <tr onClick={() => alternarFila(s)} style={{ cursor: "pointer" }}>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                                <svg
                                  width="10" height="10" viewBox="0 0 20 20" fill="none"
                                  style={{ transform: abierta ? "rotate(90deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0, color: "var(--color-text-faint)" }}
                                >
                                  <path d="M6 4l8 6-8 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {s.sucursal}
                              </span>
                            </td>
                            <td>{s.ciudad || "—"}</td>
                            <td>{s.total_subbodegas.toLocaleString("es-EC")}</td>
                            <td>{usd(s.costo_total)}</td>
                          </tr>
                          {abierta && (
                            <tr>
                              <td colSpan={4} style={{ padding: 0 }}>
                                <div style={{ background: "var(--color-surface-subtle)", padding: "0.4rem 0" }}>
                                  {desgloseCargando[clave] && (
                                    <div style={{ padding: "0.5rem 1.5rem 0.5rem 2.75rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                                      Cargando sub-bodegas...
                                    </div>
                                  )}
                                  {desgloseError[clave] && (
                                    <div style={{ padding: "0.5rem 1.5rem 0.5rem 2.75rem", fontSize: "0.8rem", color: "#c0392b" }}>
                                      {desgloseError[clave]}
                                    </div>
                                  )}
                                  {filas && filas.length === 0 && (
                                    <div style={{ padding: "0.5rem 1.5rem 0.5rem 2.75rem", fontSize: "0.8rem", color: "var(--color-text-faint)" }}>
                                      Sin sub-bodegas registradas.
                                    </div>
                                  )}
                                  {filas?.map((sb) => (
                                    <div
                                      key={sb.ware_code}
                                      style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.4rem 1.5rem 0.4rem 2.75rem", fontSize: "0.82rem" }}
                                    >
                                      <span style={{ color: "var(--color-text-tertiary)" }}>
                                        {sb.nombre ? `${sb.nombre} (${sb.ware_code})` : sb.ware_code}
                                        {sb.tipo && <span style={{ marginLeft: "0.5rem", color: "var(--color-text-faint)" }}>· {sb.tipo}</span>}
                                      </span>
                                      <strong style={{ flexShrink: 0 }}>{usd(sb.costo_total)}</strong>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={paginaResumen}
                totalItems={ordenadas.length}
                itemsPerPage={porPaginaResumen}
                onPageChange={setPaginaResumen}
                onItemsPerPageChange={(n) => { setPorPaginaResumen(n); setPaginaResumen(1); }}
                styles={styles}
                itemLabel="bodegas principales"
              />
            </>
          )}
        </section>
      ) : (
        <section className={styles.reportSection}>
          {errorDetalle && <div className={styles.errorAlert}>{errorDetalle}</div>}

          {loadingDetalle && <LoadingState styles={styles} label="Cargando detalle..." />}

          {!loadingDetalle && detalle && detalle.total_filas === 0 && (
            <EmptyState styles={styles} message="Sin resultados para estos filtros." />
          )}

          {!loadingDetalle && detalle && detalle.total_filas > 0 && (
            <>
              <div className={styles.reportHeaderActions}>
                <h3>{detalle.total_filas.toLocaleString("es-EC")} líneas</h3>
                <Button
                  onClick={exportarDetalleExcel}
                  className={styles.iconActionBtn}
                  disabled={exportandoDetalle}
                  title="Descargar Excel (todas las líneas filtradas)"
                  aria-label="Descargar Excel"
                >
                  {exportandoDetalle ? (
                    <span className={styles.iconBtnSpinner} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 15v1.5A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </Button>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Bodega Principal</th>
                      <th>Sub-Bodega</th>
                      <th>Producto</th>
                      <th>Nombre</th>
                      <th>Grupo</th>
                      <th>Marca</th>
                      <th>Existencia</th>
                      <th>Costo unitario</th>
                      <th>Costo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.lineas.map((l, i) => (
                      <tr key={`${l.ware_code}-${l.product_id_corp}-${i}`}>
                        <td>{l.corp}</td>
                        <td>{l.bodega_principal}</td>
                        <td>{l.sub_bodega_nombre ? `${l.sub_bodega_nombre} (${l.ware_code})` : l.ware_code}</td>
                        <td>{l.product_id_corp}</td>
                        <td>{l.producto_nombre || "—"}</td>
                        <td>{l.grupo || "—"}</td>
                        <td>{l.marca || "—"}</td>
                        <td>{l.oh.toLocaleString("es-EC")}</td>
                        <td>{usd(l.costo_unitario)}</td>
                        <td>{usd(l.costo_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={pagina}
                totalItems={detalle.total_filas}
                itemsPerPage={porPagina}
                onPageChange={setPagina}
                onItemsPerPageChange={(n) => { setPorPagina(n); setPagina(1); }}
                styles={styles}
                itemLabel="líneas"
              />
            </>
          )}
        </section>
      )}
    </>
  );
}
