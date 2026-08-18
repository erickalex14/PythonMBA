"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import styles from "../dashboard.module.css";
import { VentasDashboard } from "../../../components/VentasDashboard";

// Poppins (geométrica, redondeada, con personalidad) solo para el título del
// Dashboard - el resto de la app sigue en Inter. Le da carácter al
// encabezado sin tocar la tipografía compartida (.contentHeader/.subtext)
// que usan las demás pantallas del panel (ventas, movimientos, admin, etc.).
const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"] });

export default function DashboardTabPage() {
  const router = useRouter();

  // Abre Ventas (Por Producto) ya filtrado con el mismo rango de la tarjeta
  // activa - el Dashboard muestra tops por producto, que es lo que ese reporte
  // detalla (Rentabilidad es línea a línea, no por producto). La página lee
  // estos query params al montar y dispara el fetch sola (ver
  // hooks/usePanelReportPage.ts).
  const irAlDetalleDeVentas = (start: string, end: string) => {
    router.push(`/panel/estadisticas-ventas?${new URLSearchParams({ start, end }).toString()}`);
  };

  return (
    <>
      <header className={styles.contentHeader}>
        <span className={styles.dashboardEyebrow}>Panel ejecutivo</span>
        <h1 className={`${poppins.className} ${styles.dashboardTitle}`}>Dashboard</h1>
        <p className={styles.dashboardSubtext}>
          Ventas por período, con devoluciones desglosadas y productos más vendidos
        </p>
      </header>
      <VentasDashboard styles={styles} onNavigate={irAlDetalleDeVentas} />
    </>
  );
}
