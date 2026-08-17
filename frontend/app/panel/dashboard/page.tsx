"use client";

import React from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import { VentasDashboard } from "../../../components/VentasDashboard";

export default function DashboardTabPage() {
  const router = useRouter();

  // Abre el reporte de Ventas ya filtrado con el mismo rango de la tarjeta
  // activa; la página lee estos query params al montar y dispara el fetch sola
  // (ver hooks/usePanelReportPage.ts).
  const irAlDetalleDeVentas = (start: string, end: string) => {
    router.push(`/panel/ventas?${new URLSearchParams({ start, end }).toString()}`);
  };

  return (
    <>
      <header className={styles.contentHeader}>
        <h1>Dashboard</h1>
        <p className={styles.subtext}>Ventas por período, con devoluciones desglosadas y productos más vendidos</p>
      </header>
      <VentasDashboard styles={styles} onNavigate={irAlDetalleDeVentas} />
    </>
  );
}
