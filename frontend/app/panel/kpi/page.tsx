"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Poppins } from "next/font/google";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import { GooeySearchBar } from "../../../components/ui/GooeySearchBar";

const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"] });

/** Mes actual como YYYY-MM, que es el formato que espera el backend. */
function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

const pct = (v: number | null) =>
  v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;

export default function SeguimientoKpiPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const usuario = session?.user as any;
  const puedeCargar =
    usuario?.role === "Admin" || (usuario?.permissions || []).includes("MANAGE_CONFIG");

  const [periodo, setPeriodo] = useState(periodoActual());
  const [datos, setDatos] = useState<any | null>(null);
  const [definicion, setDefinicion] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/data/kpi?recurso=definicion")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setDefinicion(j.kpis || []))
      .catch(() => setDefinicion([]));
  }, []);

  const consultar = async () => {
    setLoading(true);
    setError(null);
    setAviso(null);
    setDatos(null);
    try {
      const res = await fetch(`/api/data/kpi?recurso=seguimiento&periodo=${periodo}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setDatos(json);
      if (!json.sucursales?.length) {
        setAviso("No hay sucursales cargadas. Sube el Excel de Seguimiento KPI para sembrarlas.");
      }
    } catch (err: any) {
      setError(err.message || "No se pudo obtener el seguimiento KPI.");
    } finally {
      setLoading(false);
    }
  };

  const descargarExcel = async () => {
    setDescargando(true);
    setError(null);
    try {
      const corte = datos?.corte ? `&corte=${datos.corte}` : "";
      const res = await fetch(`/api/data/kpi?recurso=excel&periodo=${periodo}${corte}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SEGUIMIENTO_KPI_${periodo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "No se pudo generar el Excel.");
    } finally {
      setDescargando(false);
    }
  };

  const importar = async (archivo: File) => {
    setImportando(true);
    setError(null);
    setAviso(null);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      const res = await fetch(`/api/data/kpi?recurso=importar&periodo=${periodo}`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || "Error al importar.");
      setAviso(
        `Cargado: ${json.sucursales} sucursales, ${json.productos} productos y ${json.metas} metas para ${json.periodo}.`
      );
      await consultar();
    } catch (err: any) {
      setError(err.message || "No se pudo importar el archivo.");
    } finally {
      setImportando(false);
      if (archivoRef.current) archivoRef.current.value = "";
    }
  };

  const filtradas = useMemo(() => {
    const filas = datos?.sucursales || [];
    if (!busqueda.trim()) return filas;
    const q = busqueda.toLowerCase();
    return filas.filter((s: any) =>
      [s.sucursal, s.nombre, s.supervisor, s.ciudad, s.marca]
        .some((v: any) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [datos, busqueda]);

  const promedio = useMemo(() => {
    if (!filtradas.length) return 0;
    return filtradas.reduce((a: number, s: any) => a + s.total_kpi, 0) / filtradas.length;
  }, [filtradas]);

  return (
    <>
      <header className={styles.contentHeader}>
        <h1 className={`${poppins.className} ${styles.moduleTitle}`}>Seguimiento KPI</h1>
        <p className={styles.moduleSubtext}>
          Cumplimiento por sucursal contra las metas del mes
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
            aria-label="Mes a consultar"
          />
          <motion.button
            type="button"
            onClick={consultar}
            className={styles.movToolbarBtn}
            disabled={loading}
            whileHover={loading ? undefined : { scale: 1.03 }}
            whileTap={loading ? undefined : { scale: 0.97 }}
          >
            {loading ? <span className={styles.iconBtnSpinner} /> : null}
            {loading ? "Consultando..." : "Consultar Datos"}
            {!loading && <span className={styles.movToolbarBtnArrow}>→</span>}
          </motion.button>

          {datos?.sucursales?.length > 0 && (
            <>
              <div className={styles.movToolbarDivider} />
              <motion.button
                type="button"
                onClick={descargarExcel}
                className={styles.movToolbarBtn}
                disabled={descargando}
                whileHover={descargando ? undefined : { scale: 1.03 }}
                whileTap={descargando ? undefined : { scale: 0.97 }}
              >
                {descargando ? <span className={styles.iconBtnSpinner} /> : null}
                {descargando ? "Generando..." : "Descargar Excel"}
              </motion.button>
              <div className={styles.movToolbarDivider} />
              <GooeySearchBar
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar sucursal o supervisor..."
              />
            </>
          )}
          <div className={styles.movToolbarSpacer} />

          {puedeCargar && (
            <>
              <motion.button
                type="button"
                onClick={() => router.push("/panel/kpi/metas")}
                className={styles.movToolbarBtn}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Editar metas
              </motion.button>
              <input
                ref={archivoRef}
                type="file"
                accept=".xlsx,.xlsm"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importar(f);
                }}
              />
              <motion.button
                type="button"
                onClick={() => archivoRef.current?.click()}
                className={styles.movToolbarBtn}
                disabled={importando}
                whileHover={importando ? undefined : { scale: 1.03 }}
                whileTap={importando ? undefined : { scale: 0.97 }}
              >
                {importando ? <span className={styles.iconBtnSpinner} /> : null}
                {importando ? "Importando..." : "Cargar metas (Excel)"}
              </motion.button>
            </>
          )}
        </div>
      </motion.section>

      <section className={styles.reportSection}>
        <div className={styles.reportHeaderActions}>
          <h3>
            Cumplimiento por Sucursal
            {datos?.corte && (
              // El sync es manual varias veces al dia: el mes casi nunca esta
              // completo, asi que el corte va siempre a la vista.
              <span style={{ color: "#c62828", fontWeight: 600, marginLeft: 10 }}>
                corte al {datos.corte} ({datos.dias_corte} de {datos.dias_mes} dias)
              </span>
            )}
          </h3>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}
        {aviso && <div className={styles.noDataArea}><p>{aviso}</p></div>}

        {loading && (
          <div className={styles.loaderArea}>
            <div className={styles.spinner}></div>
            <p>Calculando cumplimiento por sucursal...</p>
          </div>
        )}

        {!loading && !datos && !error && (
          <div className={styles.noDataArea}>
            <p>Elige un mes y pulsa Consultar Datos.</p>
          </div>
        )}

        {!loading && filtradas.length > 0 && (
          <>
            <div className={styles.reportHeaderActions}>
              <span>
                {filtradas.length} sucursales · cumplimiento promedio{" "}
                <strong>{pct(promedio)}</strong> sobre {pct(datos.peso_total)} posible
              </span>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Sucursal</th>
                    <th>Supervisor</th>
                    {definicion.map((k: any) => (
                      <th key={k.kpi} title={`Peso ${pct(k.peso)} · origen ${k.origen}`}>
                        {k.label}
                      </th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((s: any) => {
                    const porKpi = new Map(s.detalle.map((d: any) => [d.kpi, d]));
                    return (
                      <tr key={s.sucursal}>
                        <td>
                          <strong>{s.sucursal}</strong> {s.nombre}
                        </td>
                        <td>{s.supervisor || "—"}</td>
                        {definicion.map((k: any) => {
                          const d: any = porKpi.get(k.kpi);
                          return (
                            <td
                              key={k.kpi}
                              title={d ? `Real ${d.real} · Meta ${d.meta ?? "sin meta"}` : ""}
                            >
                              {d ? pct(d.cumplimiento) : "—"}
                            </td>
                          );
                        })}
                        <td>
                          <strong>{pct(s.total_kpi)}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}
