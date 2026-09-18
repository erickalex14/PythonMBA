"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Poppins } from "next/font/google";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import styles from "../../dashboard.module.css";
import { GooeySearchBar } from "../../../../components/ui/GooeySearchBar";
import { LoadingState, EmptyState } from "../../../../components/ui/StatusArea";

const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"] });

function periodoActual() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

// La meta de venta de la tienda no es un KPI ponderado, pero se carga igual.
const VENTA_TIENDA = { kpi: "venta_tienda", label: "META DE TIENDA", peso: 0 };

type Celda = { sucursal: string; kpi: string; meta: number };

export default function MetasKpiPage() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(periodoActual());
  const [vista, setVista] = useState<"metas" | "bodegas">("metas");

  const [kpis, setKpis] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [editadas, setEditadas] = useState<Record<string, number>>({});
  const [bodegas, setBodegas] = useState<any[]>([]);
  const [bodegasEditadas, setBodegasEditadas] = useState<Record<string, string>>({});
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [sucursalMasiva, setSucursalMasiva] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const clave = (s: string, k: string) => `${s}|${k}`;

  // Lo unico que se carga a mano cada mes es la meta de venta de la tienda.
  // Las metas por KPI vienen del Excel al importarlo y no se editan aqui: son
  // decision comercial y meterlas en esta tabla la volvia ilegible (11 columnas
  // por sucursal, 126 filas).
  const columnas = useMemo(() => [VENTA_TIENDA], []);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    setAviso(null);
    setEditadas({});
    setBodegasEditadas({});
    setSeleccionadas(new Set());
    try {
      const [defRes, sucRes, metRes, bodRes] = await Promise.all([
        fetch("/api/data/kpi?recurso=definicion"),
        fetch("/api/data/kpi?recurso=sucursales"),
        fetch(`/api/data/kpi?recurso=metas&periodo=${periodo}`),
        fetch("/api/data/kpi?recurso=bodegas"),
      ]);
      if (!metRes.ok) throw new Error(await metRes.text());
      const def = await defRes.json();
      const suc = await sucRes.json();
      const met = await metRes.json();
      const bod = bodRes.ok ? await bodRes.json() : { bodegas: [] };

      setKpis(def.kpis || []);
      setSucursales(suc.sucursales || []);
      setBodegas(bod.bodegas || []);
      const mapa: Record<string, number> = {};
      (met.metas || []).forEach((m: Celda) => {
        mapa[clave(m.sucursal, m.kpi)] = m.meta;
      });
      setMetas(mapa);
      if (!suc.sucursales?.length) {
        setAviso("No hay sucursales cargadas. Sube primero el Excel desde Seguimiento KPI.");
      }
    } catch (err: any) {
      setError(err.message || "No se pudieron cargar las metas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const guardarMetas = async () => {
    const cambios = Object.entries(editadas).map(([k, meta]) => {
      const [sucursal, kpi] = k.split("|");
      return { sucursal, kpi, meta };
    });
    if (!cambios.length) {
      setAviso("No hay cambios que guardar.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/data/kpi?recurso=metas&periodo=${periodo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || json.detail || "Error al guardar.");
      setMetas((prev) => ({ ...prev, ...editadas }));
      setEditadas({});
      setAviso(`${json.guardadas} metas guardadas para ${periodo}.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const guardarBodegas = async () => {
    const cambios = Object.entries(bodegasEditadas).map(([ware_code, sucursal]) => ({
      ware_code,
      sucursal: sucursal.trim() || null,
    }));
    if (!cambios.length) {
      setAviso("No hay bodegas modificadas.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/data/kpi?recurso=bodegas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error al guardar.");
      setAviso(`${json.actualizadas} bodegas actualizadas.`);
      setBodegasEditadas({});
      await cargar();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const filtrar = (texto: string[]) =>
    !busqueda.trim() ||
    texto.some((t) => String(t ?? "").toLowerCase().includes(busqueda.toLowerCase()));

  const sucursalesFiltradas = sucursales.filter((s) =>
    filtrar([s.codigo, s.nombre, s.supervisor, s.ciudad])
  );
  const bodegasFiltradas = bodegas.filter((b) =>
    filtrar([b.ware_code, b.ware_name, b.sucursal_efectiva, b.corp])
  );

  const pendientes = Object.keys(editadas).length + Object.keys(bodegasEditadas).length;

  const todasSeleccionadas =
    bodegasFiltradas.length > 0 && bodegasFiltradas.every((b) => seleccionadas.has(b.ware_code));

  const alternarTodas = () => {
    setSeleccionadas((prev) => {
      if (todasSeleccionadas) return new Set();
      return new Set(bodegasFiltradas.map((b) => b.ware_code));
    });
  };

  const alternarUna = (ware_code: string) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(ware_code)) next.delete(ware_code);
      else next.add(ware_code);
      return next;
    });
  };

  // Aplica la misma sucursal a todas las bodegas seleccionadas de una sola vez
  // (staged, igual que editar una por una): 329 bodegas fila por fila es
  // tedioso cuando varias comparten la misma tienda real.
  const aplicarSucursalMasiva = () => {
    const valor = sucursalMasiva.trim();
    if (!valor || seleccionadas.size === 0) return;
    setBodegasEditadas((prev) => {
      const next = { ...prev };
      seleccionadas.forEach((ware_code) => {
        next[ware_code] = valor;
      });
      return next;
    });
    setSeleccionadas(new Set());
    setSucursalMasiva("");
  };

  return (
    <>
      <header className={styles.contentHeader}>
        <h1 className={`${poppins.className} ${styles.moduleTitle}`}>Metas del KPI</h1>
        <p className={styles.moduleSubtext}>
          Carga las metas del mes y corrige a qué sucursal pertenece cada bodega
        </p>
      </header>

      <motion.section
        className={styles.filterPanel}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className={styles.movToolbar}>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className={styles.selectFilter}
            style={{ padding: "0.55rem 0.75rem", borderRadius: 8 }}
            aria-label="Mes"
          />
          <motion.button
            type="button"
            className={styles.movToolbarBtn}
            onClick={() => setVista(vista === "metas" ? "bodegas" : "metas")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {vista === "metas" ? "Ver bodegas" : "Ver metas"}
          </motion.button>
          <div className={styles.movToolbarDivider} />
          <GooeySearchBar
            value={busqueda}
            onChange={setBusqueda}
            placeholder={vista === "metas" ? "Buscar sucursal..." : "Buscar bodega..."}
          />
          <div className={styles.movToolbarSpacer} />
          <motion.button
            type="button"
            className={styles.movToolbarBtn}
            onClick={vista === "metas" ? guardarMetas : guardarBodegas}
            disabled={guardando || !pendientes}
            whileHover={guardando ? undefined : { scale: 1.03 }}
            whileTap={guardando ? undefined : { scale: 0.97 }}
          >
            {guardando ? <span className={styles.iconBtnSpinner} /> : null}
            {guardando ? "Guardando..." : `Guardar${pendientes ? ` (${pendientes})` : ""}`}
          </motion.button>
          <motion.button
            type="button"
            className={styles.movToolbarBtn}
            onClick={() => router.push("/panel/kpi")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Ver cumplimiento
          </motion.button>
        </div>
      </motion.section>

      <section className={styles.reportSection}>
        {error && <div className={styles.errorAlert}>{error}</div>}
        {aviso && <EmptyState styles={styles} message={aviso} icon={null} />}

        {loading && <LoadingState styles={styles} label="Cargando..." />}

        {!loading && vista === "metas" && sucursalesFiltradas.length > 0 && (
          <>
            <div className={styles.reportHeaderActions}>
              <h3>Metas de {periodo}</h3>
              <span>{sucursalesFiltradas.length} sucursales</span>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Sucursal</th>
                    <th>Supervisor</th>
                    {columnas.map((k) => (
                      <th key={k.kpi} title={k.peso ? `Peso ${(k.peso * 100).toFixed(0)}%` : "No pondera"}>
                        {k.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sucursalesFiltradas.map((s) => (
                    <tr key={s.codigo}>
                      <td><strong>{s.codigo}</strong> {s.nombre}</td>
                      <td>{s.supervisor || "—"}</td>
                      {columnas.map((k) => {
                        const c = clave(s.codigo, k.kpi);
                        const valor = c in editadas ? editadas[c] : metas[c] ?? "";
                        return (
                          <td key={k.kpi}>
                            <input
                              type="number"
                              step="any"
                              value={valor}
                              onChange={(e) =>
                                setEditadas((p) => ({
                                  ...p,
                                  [c]: e.target.value === "" ? 0 : Number(e.target.value),
                                }))
                              }
                              style={{
                                width: 92, padding: "0.3rem 0.4rem", borderRadius: 6,
                                border: c in editadas
                                  ? "2px solid var(--color-brand-primary)"
                                  : "1px solid var(--color-border-strong)",
                                background: "var(--color-surface)",
                                color: "var(--color-text-primary)",
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && vista === "bodegas" && (
          <>
            <div className={styles.reportHeaderActions}>
              <h3>Bodegas y su sucursal</h3>
              <span>
                {bodegasFiltradas.filter((b) => !b.sucursal_efectiva).length} sin asignar ·
                quedan fuera del reporte
              </span>
            </div>

            {seleccionadas.size > 0 && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  padding: "0.6rem 0.8rem", marginBottom: "0.6rem", borderRadius: 10,
                  background: "var(--color-surface-tint)", border: "1px solid var(--color-border-strong)",
                }}
              >
                <strong style={{ fontSize: "0.8rem" }}>{seleccionadas.size} seleccionadas</strong>
                <input
                  type="text"
                  placeholder="Sucursal (ej. 008)"
                  value={sucursalMasiva}
                  onChange={(e) => setSucursalMasiva(e.target.value)}
                  style={{
                    width: 100, padding: "0.3rem 0.5rem", borderRadius: 6,
                    border: "1px solid var(--color-border-strong)",
                    background: "var(--color-surface)", color: "var(--color-text-primary)",
                  }}
                />
                <motion.button
                  type="button"
                  className={styles.movToolbarBtn}
                  onClick={aplicarSucursalMasiva}
                  disabled={!sucursalMasiva.trim()}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Asignar a {seleccionadas.size}
                </motion.button>
                <button
                  type="button"
                  onClick={() => setSeleccionadas(new Set())}
                  style={{ background: "none", border: "none", color: "var(--color-text-faint)", cursor: "pointer", fontSize: "0.78rem" }}
                >
                  Cancelar selección
                </button>
              </div>
            )}

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input
                        type="checkbox"
                        checked={todasSeleccionadas}
                        onChange={alternarTodas}
                        aria-label="Seleccionar todas las bodegas filtradas"
                      />
                    </th>
                    <th>Bodega</th>
                    <th>Nombre</th>
                    <th>Empresa</th>
                    <th>Derivada</th>
                    <th>Corrección</th>
                  </tr>
                </thead>
                <tbody>
                  {bodegasFiltradas.map((b) => (
                    <tr key={b.ware_code}>
                      <td>
                        <input
                          type="checkbox"
                          checked={seleccionadas.has(b.ware_code)}
                          onChange={() => alternarUna(b.ware_code)}
                          aria-label={`Seleccionar bodega ${b.ware_code}`}
                        />
                      </td>
                      <td><strong>{b.ware_code}</strong></td>
                      <td>{b.ware_name || "—"}</td>
                      <td>{b.corp}</td>
                      <td>{b.sucursal || <span style={{ color: "#c62828" }}>sin mapear</span>}</td>
                      <td>
                        <input
                          type="text"
                          placeholder={b.sucursal || "000"}
                          value={
                            b.ware_code in bodegasEditadas
                              ? bodegasEditadas[b.ware_code]
                              : b.sucursal_override ?? ""
                          }
                          onChange={(e) =>
                            setBodegasEditadas((p) => ({ ...p, [b.ware_code]: e.target.value }))
                          }
                          style={{
                            width: 80, padding: "0.3rem 0.4rem", borderRadius: 6,
                            border: b.ware_code in bodegasEditadas
                              ? "2px solid var(--color-brand-primary)"
                              : "1px solid var(--color-border-strong)",
                            background: "var(--color-surface)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}
