"use client";

import React from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import { DailySalesDashboard } from "../../../components/DailySalesDashboard";

export default function DashboardTabPage() {
  const router = useRouter();

  // Click en una tarjeta del Dashboard: navega a la URL real del reporte
  // correspondiente, ya filtrada igual que la tarjeta (mismo rango de
  // fechas y, para Ventas, la misma Empresa activa en el Dashboard) - cada
  // página de reporte lee estos query params al montar y dispara el fetch
  // sola (ver hooks/usePanelReportPage.ts).
  const handleDashboardNavigate = (
    tab: "ventas" | "movimientos" | "liquidaciones" | "ats",
    start: string,
    end: string,
    empresa: string = ""
  ) => {
    const params = new URLSearchParams({ start, end });
    if (tab === "ventas" && empresa) {
      params.set("empresa", empresa);
    }
    router.push(`/panel/${tab}?${params.toString()}`);
  };

  return <DailySalesDashboard styles={styles} onNavigate={handleDashboardNavigate} />;
}
