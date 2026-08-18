"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Poppins } from "next/font/google";
import { motion } from "framer-motion";
import styles from "../dashboard.module.css";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { GooeySearchBar } from "../../../components/ui/GooeySearchBar";
import { Pagination } from "../../../components/ui/Pagination";
import { usePanelReportPage } from "../../../hooks/usePanelReportPage";

const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"] });

export default function LogsPage() {
  const panel = usePanelReportPage("logs");

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    setLogs([]);
    try {
      const res = await fetch("/api/data/logs");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setLogs(json);
    } catch (err: any) {
      setError(err.message || "Error al obtener la bitácora de auditoría.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    panel.setCurrentPage(1);
  }, [panel.searchQuery]);

  const filteredLogs = useMemo(() => {
    if (!panel.searchQuery.trim()) return logs;
    const q = panel.searchQuery.toLowerCase();
    return logs.filter((log) =>
      String(log.user_name).toLowerCase().includes(q) ||
      String(log.user_cedula).toLowerCase().includes(q) ||
      String(log.user_role).toLowerCase().includes(q) ||
      String(log.download_type).toLowerCase().includes(q) ||
      String(log.timestamp).toLowerCase().includes(q)
    );
  }, [logs, panel.searchQuery]);

  const paginatedLogs = useMemo(() => {
    const start = (panel.currentPage - 1) * panel.itemsPerPage;
    return filteredLogs.slice(start, start + panel.itemsPerPage);
  }, [filteredLogs, panel.currentPage, panel.itemsPerPage]);

  return (
    <>
      <header className={styles.contentHeader}>
        <h1 className={`${poppins.className} ${styles.moduleTitle}`}>Bitácora de Auditoría</h1>
        <p className={styles.moduleSubtext}>Historial de descargas de reportes para auditoría de seguridad</p>
      </header>

      <motion.section
        className={styles.filterPanel}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className={styles.movToolbar}>
          <motion.button
            type="button"
            onClick={fetchLogs}
            className={styles.movToolbarBtn}
            disabled={loading}
            whileHover={loading ? undefined : { scale: 1.03 }}
            whileTap={loading ? undefined : { scale: 0.97 }}
          >
            {loading ? <span className={styles.iconBtnSpinner} /> : null}
            {loading ? "Consultando..." : "Consultar Datos"}
            {!loading && <span className={styles.movToolbarBtnArrow}>→</span>}
          </motion.button>
          {logs.length > 0 && !loading && (
            <>
              <div className={styles.movToolbarDivider} />
              <GooeySearchBar
                value={panel.searchQuery}
                onChange={panel.setSearchQuery}
                placeholder="Buscar en todos los campos..."
              />
            </>
          )}
          <div className={styles.movToolbarSpacer} />
        </div>
      </motion.section>

      <section className={styles.reportSection}>
        <div className={styles.reportHeaderActions}>
          <h3>Detalle Consolidado de Datos</h3>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}

        {loading && (
          <div className={styles.loaderArea}>
            <div className={styles.spinner}></div>
            <p>Consultando base transaccional...</p>
          </div>
        )}

        {!loading && filteredLogs.length === 0 && !error && (
          <div className={styles.noDataArea}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p>No se encontraron registros para el rango de fechas seleccionado.</p>
          </div>
        )}

        {filteredLogs.length > 0 && !loading && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Cédula</th>
                  <th>Rol</th>
                  <th>Tipo Descarga</th>
                  <th>Periodo Reportado</th>
                  <th>Registros</th>
                  <th>Fecha de Descarga</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, i) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 20) * 0.02 }}
                  >
                    <td><strong>{log.user_name}</strong></td>
                    <td>{log.user_cedula}</td>
                    <td>
                      <Badge status={log.user_role === "Admin" ? "badgeAdmin" : "badgeUser"} styles={styles}>
                        {log.user_role}
                      </Badge>
                    </td>
                    <td><strong>{log.download_type}</strong></td>
                    <td>{log.query_period}</td>
                    <td>{log.records_count}</td>
                    <td>{new Date(log.timestamp).toLocaleString("es-EC")}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredLogs.length > 0 && (
          <Pagination
            currentPage={panel.currentPage}
            totalItems={filteredLogs.length}
            itemsPerPage={panel.itemsPerPage}
            onPageChange={panel.setCurrentPage}
            onItemsPerPageChange={(n) => { panel.setItemsPerPage(n); panel.setCurrentPage(1); }}
            styles={styles}
            itemLabel="logs"
            pageSizeOptions={[10, 25, 50]}
          />
        )}
      </section>
    </>
  );
}
