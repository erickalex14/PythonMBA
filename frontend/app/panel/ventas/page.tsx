"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import styles from "../dashboard.module.css";
import { KPICards } from "../../../components/KPICards";
import { RentabilidadCharts } from "../../../components/RentabilidadCharts";
import { ReportTable } from "../../../components/ReportTable";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { FilterBar, FilterFieldConfig } from "../../../components/ui/FilterBar";
import { useReportQuery } from "../../../hooks/useReportQuery";
import { usePanelReportPage } from "../../../hooks/usePanelReportPage";

export default function VentasPage() {
  const { data: session } = useSession();
  const panel = usePanelReportPage("ventas");
  const { loading, queryProgress, estTimeRemaining, currentQueryingDate, data, error, fetchReportData } = useReportQuery();

  const [selectedProduct, setSelectedProduct] = useState(panel.initialProductoFromUrl);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState(panel.initialEmpresaFromUrl);
  const [codigoSearch, setCodigoSearch] = useState("");

  // Si venimos del click-through del Dashboard, la URL trae fechas y, para
  // Ventas, también la Empresa activa en la tarjeta del Dashboard.
  useEffect(() => {
    if (panel.initialStartFromUrl && panel.initialEndFromUrl) {
      fetchReportData("ventas", panel.initialStartFromUrl, panel.initialEndFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    panel.setCurrentPage(1);
  }, [selectedProduct, selectedBranch, selectedEmpresa, codigoSearch]);

  const handleQuery = () => fetchReportData("ventas", panel.startDate, panel.endDate);

  // Ventas no aplica la búsqueda global de texto (tiene sus propios filtros
  // específicos: código, empresa, producto, grupo) - igual que antes.
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (selectedProduct && String(row.producto).trim() !== selectedProduct) return false;
      if (selectedBranch && String(row.grupo).trim() !== selectedBranch) return false;
      if (selectedEmpresa && String(row.empresa || "").trim() !== selectedEmpresa) return false;
      if (codigoSearch && !String(row.codigo || "").toLowerCase().includes(codigoSearch.trim().toLowerCase())) return false;
      return true;
    });
  }, [data, selectedProduct, selectedBranch, selectedEmpresa, codigoSearch]);

  const paginatedData = useMemo(() => {
    const start = (panel.currentPage - 1) * panel.itemsPerPage;
    return filteredData.slice(start, start + panel.itemsPerPage);
  }, [filteredData, panel.currentPage, panel.itemsPerPage]);

  const filterOptions = useMemo(() => {
    const products = new Set<string>();
    const branches = new Set<string>();
    const empresas = new Set<string>();
    data.forEach((row) => {
      if (row.producto) products.add(String(row.producto).trim());
      if (row.grupo) branches.add(String(row.grupo).trim());
      if (row.empresa) empresas.add(String(row.empresa).trim());
    });
    return {
      products: Array.from(products).sort(),
      branches: Array.from(branches).sort(),
      empresas: Array.from(empresas).sort(),
    };
  }, [data]);

  const filterFields: FilterFieldConfig[] = [
    { label: "Buscar por Código de Producto", value: codigoSearch, onChange: setCodigoSearch, placeholder: "Ej: 1AENV8395-NVC01", options: [], type: "text" },
    { label: "Filtrar por Empresa", value: selectedEmpresa, onChange: setSelectedEmpresa, placeholder: "Todas las Empresas...", options: filterOptions.empresas },
    { label: "Filtrar por Producto", value: selectedProduct, onChange: setSelectedProduct, placeholder: "Todos los Productos...", options: filterOptions.products },
    { label: "Filtrar por Grupo", value: selectedBranch, onChange: setSelectedBranch, placeholder: "Todos los Grupos...", options: filterOptions.branches },
  ];

  const totalQty = useMemo(() => data.reduce((acc, row) => acc + (Number(row.cantidad) || Number(row.CANTIDAD) || 0), 0), [data]);
  const totalAmount = useMemo(() => data.reduce((acc, row) => acc + (Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0), 0), [data]);

  return (
    <>
      <div className={styles.printOnlyHeader}>
        <div className={styles.printHeaderTop}>
          <div className={styles.printBrand}>NOVICOMPU CORPORATE BUSINESS INTELLIGENCE</div>
          <div className={styles.printConfidentiality}>SECRETARÍA GENERAL - CONFIDENCIAL</div>
        </div>
        <hr className={styles.printDivider} />
        <h1 className={styles.printTitle}>INFORME CERTIFICADO DE RENTABILIDAD</h1>
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
            El análisis de rentabilidad reporta ventas netas por un valor total de ${totalAmount.toFixed(2)}, distribuidas en un volumen acumulado de {totalQty.toLocaleString()} unidades físicas vendidas, con desglose de costo y utilidad por línea.
          </p>
        </div>
      </div>

      <header className={styles.contentHeader}>
        <h1>Rentabilidad (Detalle)</h1>
        <p className={styles.subtext}>Costo, utilidad y margen por línea de venta — facturación de clientes</p>
      </header>

      <section className={styles.filtersSection}>
        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <label>Fecha de Inicio</label>
            <input type="date" value={panel.startDate} onChange={(e) => panel.setStartDate(e.target.value)} disabled={loading} />
          </div>
          <div className={styles.filterGroup}>
            <label>Fecha de Fin</label>
            <input type="date" value={panel.endDate} onChange={(e) => panel.setEndDate(e.target.value)} disabled={loading} />
          </div>
          <Button onClick={handleQuery} className={styles.queryBtn} loading={loading} loadingText="Consultando...">
            Consultar Datos
          </Button>
        </div>
      </section>

      {data.length > 0 && !loading && (
        <FilterBar fields={filterFields} styles={styles} />
      )}

      {loading && (
        <section className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <span>Consultando ERP MBA3 por lotes diarios...</span>
            <span className={styles.progressPercentage}>{queryProgress}%</span>
          </div>
          <div className={styles.progressBarBg}>
            <div className={styles.progressBarFill} style={{ width: `${queryProgress}%` }}></div>
          </div>
          <div className={styles.progressMeta}>
            <p>Procesando fecha: <strong>{currentQueryingDate}</strong></p>
            {estTimeRemaining !== null && <p>Tiempo restante estimado: <strong>{estTimeRemaining}s</strong></p>}
          </div>
        </section>
      )}

      {!loading && <KPICards filteredData={filteredData} activeTab="ventas" styles={styles} />}
      {!loading && <RentabilidadCharts data={filteredData} styles={styles} />}

      <section className={styles.reportSection}>
        <div className={styles.reportHeaderActions}>
          <h3>Detalle Consolidado de Datos</h3>
          {!loading && filteredData.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button onClick={() => panel.handleDownloadExcel(filteredData)} className={styles.iconActionBtn} disabled={panel.downloading} title="Descargar Excel" aria-label="Descargar Excel">
                {panel.downloading ? (
                  <span className={styles.iconBtnSpinner} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 15v1.5A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </Button>
              <Button onClick={panel.handlePrintPdf} className={styles.iconActionBtn} disabled={panel.downloadingPdf} title="Imprimir Certificado (PDF)" aria-label="Imprimir Certificado (PDF)">
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

        {error && <div className={styles.errorAlert}>{error}</div>}

        {loading && !queryProgress && (
          <div className={styles.loaderArea}>
            <div className={styles.spinner}></div>
            <p>Consultando base transaccional...</p>
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
