"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Poppins } from "next/font/google";
import { motion } from "framer-motion";
import styles from "../dashboard.module.css";
import { KPICards, TotalesRango } from "../../../components/KPICards";
import { EstadisticasVentasCharts } from "../../../components/EstadisticasVentasCharts";
import { ReportTable } from "../../../components/ReportTable";
import { Button } from "../../../components/ui/Button";
import { DatePicker } from "../../../components/ui/DatePicker";
import { GooeySearchBar } from "../../../components/ui/GooeySearchBar";
import { SegmentedProgressBar } from "../../../components/ui/SegmentedProgressBar";
import { Pagination } from "../../../components/ui/Pagination";
import { FilterBar, FilterFieldConfig } from "../../../components/ui/FilterBar";
import { useReportQuery } from "../../../hooks/useReportQuery";
import { usePanelReportPage } from "../../../hooks/usePanelReportPage";

const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"] });

export default function EstadisticasVentasPage() {
  const { data: session } = useSession();
  const panel = usePanelReportPage("estadisticas-ventas");
  const { loading, data, error, setData, setError, setLoading } = useReportQuery();

  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [totales, setTotales] = useState<TotalesRango | null>(null);
  // Fetch propio (no usa el day-loop de useReportQuery), asi que el
  // AbortController tambien vive aca en vez de en el hook compartido.
  const abortRef = useRef<AbortController | null>(null);

  // Mismo endpoint que el reporte de Rentabilidad: suma sobre la misma vista y
  // el mismo kardex de devoluciones, asi que los montos con/sin devoluciones
  // coinciden exacto entre los dos reportes (no depende del catalogo de
  // productos, que es lo unico que cambia entre uno y otro).
  const cargarTotales = (inicio: string, fin: string) => {
    setTotales(null);
    fetch(`/api/data/ventas-totales?inicio=${inicio}&fin=${fin}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setTotales(json && !json.error ? json : null))
      .catch(() => setTotales(null));
  };

  // Ventas (Estadisticas): una fila por producto agregada sobre TODO el
  // rango - a diferencia de los demas reportes (linea x linea), no se puede
  // pedir dia por dia y concatenar (duplicaria cada producto por dia).
  const fetchEstadisticasVentas = async (start: string, end: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setData([]);
    try {
      const res = await fetch(`/api/data/estadisticas-ventas?inicio=${start}&fin=${end}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error consultando el reporte de ventas.");
      }
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Error al obtener el reporte de ventas.");
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  const cancelQuery = () => {
    abortRef.current?.abort();
  };

  useEffect(() => {
    if (panel.initialStartFromUrl && panel.initialEndFromUrl) {
      fetchEstadisticasVentas(panel.initialStartFromUrl, panel.initialEndFromUrl);
      cargarTotales(panel.initialStartFromUrl, panel.initialEndFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    panel.setCurrentPage(1);
  }, [selectedEmpresas, selectedBranches, panel.searchQuery]);

  const handleQuery = () => {
    fetchEstadisticasVentas(panel.startDate, panel.endDate);
    cargarTotales(panel.startDate, panel.endDate);
  };

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (panel.searchQuery.trim() !== "") {
        const match = Object.values(row).some((val) =>
          String(val).toLowerCase().includes(panel.searchQuery.toLowerCase())
        );
        if (!match) return false;
      }
      if (selectedEmpresas.length > 0 && !selectedEmpresas.includes(String(row.empresa || "").trim())) return false;
      if (selectedBranches.length > 0 && !selectedBranches.includes(String(row.grupo).trim())) return false;
      return true;
    });
  }, [data, panel.searchQuery, selectedEmpresas, selectedBranches]);

  const paginatedData = useMemo(() => {
    const start = (panel.currentPage - 1) * panel.itemsPerPage;
    return filteredData.slice(start, start + panel.itemsPerPage);
  }, [filteredData, panel.currentPage, panel.itemsPerPage]);

  const filterOptions = useMemo(() => {
    const branches = new Set<string>();
    const empresas = new Set<string>();
    data.forEach((row) => {
      if (row.grupo) branches.add(String(row.grupo).trim());
      if (row.empresa) empresas.add(String(row.empresa).trim());
    });
    return { branches: Array.from(branches).sort(), empresas: Array.from(empresas).sort() };
  }, [data]);

  const filterFields: FilterFieldConfig[] = [
    { label: "Filtrar por Empresa", value: selectedEmpresas, onChange: setSelectedEmpresas, placeholder: "Todas las Empresas...", options: filterOptions.empresas, type: "multiselect" },
    { label: "Filtrar por Grupo", value: selectedBranches, onChange: setSelectedBranches, placeholder: "Todos los Grupos...", options: filterOptions.branches, type: "multiselect" },
  ];

  const totalQty = useMemo(() => data.reduce((acc, row) => acc + (Number(row.unidades_vendidas) || 0), 0), [data]);
  const totalAmount = useMemo(() => data.reduce((acc, row) => acc + (Number(row.total_ventas) || 0), 0), [data]);

  return (
    <>
      <div className={styles.printOnlyHeader}>
        <div className={styles.printHeaderTop}>
          <div className={styles.printBrand}>NOVICOMPU CORPORATE BUSINESS INTELLIGENCE</div>
          <div className={styles.printConfidentiality}>SECRETARÍA GENERAL - CONFIDENCIAL</div>
        </div>
        <hr className={styles.printDivider} />
        <h1 className={styles.printTitle}>INFORME CERTIFICADO DE VENTAS POR PRODUCTO</h1>
        <div className={styles.printMetaGrid}>
          <div>
            <p><span>Periodo de Análisis:</span> Desde el {panel.startDate} hasta el {panel.endDate}</p>
            <p><span>Fecha y Hora de Emisión:</span> {new Date().toLocaleString("es-EC")}</p>
            <p><span>Sistema de Origen:</span> Base Transaccional ERP MBA3</p>
          </div>
          <div>
            <p><span>Auditor Responsable:</span> {session?.user?.name}</p>
            <p><span>Cédula de Identidad:</span> {(session?.user as any)?.cedula}</p>
            <p><span>Nivel de Acceso:</span> Rol {session?.user?.role}</p>
          </div>
        </div>
        <div className={styles.printExecutiveSummary}>
          <h3>Síntesis Ejecutiva del Reporte</h3>
          <p>
            El presente informe ha sido generado de forma certificada de acuerdo con las normativas corporativas de control interno.
            Tras el cruce y consolidación de datos, se reporta una muestra depurada de <strong>{filteredData.length} transacciones válidas</strong> en el periodo seleccionado.
            El reporte de ventas por producto totaliza ${totalAmount.toFixed(2)} en {totalQty.toLocaleString()} unidades vendidas en el periodo, con existencia actual y precios por producto.
          </p>
        </div>
      </div>

      <header className={styles.contentHeader}>
        <h1 className={`${poppins.className} ${styles.moduleTitle}`}>Ventas (Por Producto)</h1>
        <p className={styles.moduleSubtext}>Unidades vendidas, precios y existencia actual por producto</p>
      </header>

      <motion.section
        className={styles.filterPanel}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className={styles.movToolbar}>
          <div className={styles.movToolbarField}>
            <span className={styles.movToolbarFieldLabel}>Desde</span>
            <DatePicker value={panel.startDate} onChange={panel.setStartDate} disabled={loading} variant="plain" />
          </div>
          <div className={styles.movToolbarDivider} />
          <div className={styles.movToolbarField}>
            <span className={styles.movToolbarFieldLabel}>Hasta</span>
            <DatePicker value={panel.endDate} onChange={panel.setEndDate} disabled={loading} variant="plain" />
          </div>

          {data.length > 0 && !loading && (
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
          <motion.button
            type="button"
            onClick={handleQuery}
            className={styles.movToolbarBtn}
            disabled={loading}
            whileHover={loading ? undefined : { scale: 1.03 }}
            whileTap={loading ? undefined : { scale: 0.97 }}
          >
            {loading ? <span className={styles.iconBtnSpinner} /> : null}
            {loading ? "Consultando..." : "Consultar Datos"}
            {!loading && <span className={styles.movToolbarBtnArrow}>→</span>}
          </motion.button>
        </div>

        {data.length > 0 && !loading && (
          <>
            <div className={styles.filterPanelDivider} />
            <FilterBar fields={filterFields} styles={styles} />
          </>
        )}
      </motion.section>

      {!loading && (
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
          <KPICards filteredData={filteredData} activeTab="estadisticas-ventas" styles={styles} totales={totales} />
          <EstadisticasVentasCharts data={filteredData} styles={styles} />
        </motion.div>
      )}

      <section className={styles.reportSection}>
        <div className={styles.reportHeaderActions}>
          <h3>Detalle Consolidado de Datos</h3>
          {!loading && filteredData.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button onClick={() => panel.handleDownloadExcel(filteredData, selectedEmpresas.length === 1 ? selectedEmpresas[0] : undefined)} className={styles.iconActionBtn} disabled={panel.downloading} title="Descargar Excel" aria-label="Descargar Excel">
                {panel.downloading ? (
                  <span className={styles.iconBtnSpinner} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 15v1.5A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </Button>
              <Button onClick={() => panel.handlePrintPdf(filteredData.length)} className={styles.iconActionBtn} disabled={panel.downloadingPdf} title="Imprimir Certificado (PDF)" aria-label="Imprimir Certificado (PDF)">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M6 8V4.5A1 1 0 0 1 7 3.5h6a1 1 0 0 1 1 1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="4" y="8" width="12" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6.5 14v2a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="13" cy="10" r="0.6" fill="currentColor" />
                </svg>
              </Button>
            </div>
          )}
        </div>

        {panel.downloading && (
          <section className={styles.progressCard} style={{ marginBottom: "1rem" }}>
            <div className={styles.progressHeader}>
              <span>Generando archivo Excel...</span>
              <div className={styles.progressHeaderRight}>
                <span className={styles.progressPercentage}>{panel.downloadProgressPct}%</span>
                <button type="button" className={styles.progressCancelBtn} onClick={panel.cancelDownload}>Cancelar</button>
              </div>
            </div>
            <div style={{ margin: "0.5rem 0" }}>
              <SegmentedProgressBar pct={panel.downloadProgressPct} />
            </div>
            <div className={styles.progressMeta}>
              <p>Tiempo transcurrido: <strong>{panel.downloadElapsedSeconds}s</strong></p>
            </div>
          </section>
        )}

        {error && <div className={styles.errorAlert}>{error}</div>}

        {loading && (
          <div className={styles.loaderArea}>
            <div className={styles.spinner}></div>
            <p>Consultando base transaccional...</p>
            <button type="button" className={styles.progressCancelBtn} onClick={cancelQuery}>Cancelar</button>
          </div>
        )}

        {!loading && filteredData.length === 0 && !error && (
          <div className={styles.noDataArea}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p>No se encontraron registros para el rango de fechas seleccionado.</p>
          </div>
        )}

        {panel.reportConfig && filteredData.length > 0 && !loading && (
          <div className={styles.tableWrapper}>
            <ReportTable config={panel.reportConfig} paginatedData={paginatedData} styles={styles} />
          </div>
        )}

        {!loading && filteredData.length > 0 && (
          <Pagination
            currentPage={panel.currentPage}
            totalItems={filteredData.length}
            itemsPerPage={panel.itemsPerPage}
            onPageChange={panel.setCurrentPage}
            onItemsPerPageChange={(n) => { panel.setItemsPerPage(n); panel.setCurrentPage(1); }}
            styles={styles}
            itemLabel="registros"
          />
        )}
      </section>

      <div className={styles.printOnlyFooter}>
        <div className={styles.printSignatureArea}>
          <div className={styles.printSignatureLine}>
            <p>_________________________________________</p>
            <p className={styles.signatureTitle}>Firma del Auditor Responsable</p>
            <p>Nombre: {session?.user?.name}</p>
            <p>Cédula: {(session?.user as any)?.cedula}</p>
          </div>
          <div className={styles.printSignatureLine}>
            <p>_________________________________________</p>
            <p className={styles.signatureTitle}>Control Interno / Presidencia</p>
            <p>NOVICOMPU Corporate Systems</p>
          </div>
        </div>
        <div className={styles.printDisclaimer}>
          Este reporte es confidencial y para uso exclusivo de la presidencia y juntas directivas autorizadas. Toda reproducción no autorizada queda estrictamente prohibida bajo regulaciones de auditoría de datos corporativos.
        </div>
      </div>
    </>
  );
}
