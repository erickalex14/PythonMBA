"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { REPORTS_CONFIG } from "../lib/reports-config";

// Estado y handlers comunes a cada página de reporte del panel (fechas,
// búsqueda global, paginación, exportar Excel/PDF) - antes vivían todos
// juntos y compartidos en app/panel/page.tsx; ahora cada ruta usa su propia
// instancia, genuinamente local (ya no se pisan entre pestañas).
export function usePanelReportPage(reportId: string) {
  const searchParams = useSearchParams();
  const initialStartFromUrl = searchParams.get("start");
  const initialEndFromUrl = searchParams.get("end");
  const initialEmpresaFromUrl = searchParams.get("empresa") || "";
  const initialProductoFromUrl = searchParams.get("producto") || "";

  const [startDate, setStartDate] = useState(initialStartFromUrl || "2026-06-01");
  const [endDate, setEndDate] = useState(initialEndFromUrl || "2026-06-30");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadElapsedMs, setDownloadElapsedMs] = useState(0);

  const reportConfig = REPORTS_CONFIG[reportId];

  // El backend genera el .xlsx completo en una sola respuesta (sin
  // checkpoints reales de avance) - para rangos grandes (ej. 2 meses de
  // Movimientos) puede tardar bastante y antes no habia ninguna señal de
  // que seguia trabajando. downloadProgressPct es un avance simulado
  // (se acerca a 95% y se detiene ahi, nunca miente diciendo "listo" antes
  // de tiempo) solo para que la barra se sienta viva mientras se espera.
  const downloadProgressPct = downloading
    ? Math.min(95, Math.round(100 * (1 - Math.exp(-downloadElapsedMs / 8000))))
    : 0;

  const handleDownloadExcel = async (filteredData: any[]) => {
    if (filteredData.length === 0 || !reportConfig) return;
    setDownloading(true);
    setDownloadElapsedMs(0);
    const startedAt = Date.now();
    const ticker = setInterval(() => setDownloadElapsedMs(Date.now() - startedAt), 200);
    try {
      const res = await fetch("/api/data/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: reportConfig.excelType,
          data: filteredData,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (!res.ok) {
        throw new Error("No se pudo generar el archivo de Excel en el servidor.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_${reportId}_${startDate}_a_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error al generar Excel: ${err.message}`);
    } finally {
      clearInterval(ticker);
      setDownloading(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return {
    startDate, setStartDate,
    endDate, setEndDate,
    searchQuery, setSearchQuery,
    currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage,
    downloading, downloadingPdf,
    downloadElapsedSeconds: Math.round(downloadElapsedMs / 1000),
    downloadProgressPct,
    handleDownloadExcel, handlePrintPdf,
    reportConfig,
    initialStartFromUrl, initialEndFromUrl, initialEmpresaFromUrl, initialProductoFromUrl,
  };
}
