"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Layout } from "react-grid-layout/legacy";
import styles from "../../dashboard.module.css";
import { Button } from "../../../../components/ui/Button";
import { DashboardGrid } from "../../../../components/ui/DashboardGrid";
import { buildCostosBodegaCards } from "../../../../components/dashboards/costosBodegaCards";
import { useDashboardLayout } from "../../../../hooks/useDashboardLayout";

// Dashboards ya conectados a este submódulo. Fase 1 solo trae Costos por
// Sucursal -- el resto (Ventas, KPI, Estadísticas de Ventas, ATS,
// Movimientos, Liquidaciones) queda para fases siguientes (ver el plan:
// KPICards es un componente monolítico en esas 5 pantallas, hay que
// separarlo en tarjetas antes de poder registrarlas acá).
const DASHBOARDS_DISPONIBLES = [
  { id: "costos-bodega", etiqueta: "Costos por Sucursal" },
] as const;

export default function AdminDashboardsPage() {
  const [dashboardId, setDashboardId] = useState<string>(DASHBOARDS_DISPONIBLES[0].id);
  const [datos, setDatos] = useState<any | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [pendingLayout, setPendingLayout] = useState<Layout | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const { layout, loading: cargandoLayout, saving, error, saveLayout } = useDashboardLayout(dashboardId);

  useEffect(() => {
    setCargandoDatos(true);
    setPendingLayout(null);
    setGuardadoOk(false);
    fetch("/api/data/costos-bodega?recurso=resumen")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar la vista previa."))))
      .then((json) => setDatos(json))
      .catch((err) => console.error("Error cargando datos de preview para el editor de dashboards", err))
      .finally(() => setCargandoDatos(false));
  }, [dashboardId]);

  const ordenadas = useMemo(() => {
    const filas = datos?.sucursales || [];
    return [...filas].sort((a: any, b: any) => b.costo_total - a.costo_total);
  }, [datos]);

  const cards = useMemo(() => {
    if (!datos) return [];
    return buildCostosBodegaCards(styles, datos, ordenadas, "todas las empresas");
  }, [datos, ordenadas]);

  const handleGuardar = async () => {
    if (!pendingLayout) return;
    try {
      await saveLayout(pendingLayout);
      setGuardadoOk(true);
    } catch {
      // el error ya queda expuesto via `error` del hook
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div className={styles.adminFormGroup} style={{ minWidth: "260px" }}>
          <label>Dashboard a personalizar</label>
          <select
            value={dashboardId}
            onChange={(e) => setDashboardId(e.target.value)}
            className={styles.adminSelectEnv}
          >
            {DASHBOARDS_DISPONIBLES.map((d) => (
              <option key={d.id} value={d.id}>{d.etiqueta}</option>
            ))}
          </select>
        </div>

        <Button
          onClick={handleGuardar}
          disabled={!pendingLayout || saving}
          loading={saving}
          loadingText="Guardando..."
          className={styles.submitBtn}
          style={{ background: "var(--color-success-dark)", border: "none" }}
        >
          Guardar acomodo
        </Button>

        {guardadoOk && (
          <span style={{ fontSize: "0.85rem", color: "var(--color-success-dark)", fontWeight: 600 }}>
            Acomodo guardado -- ya lo ven todos los usuarios.
          </span>
        )}
        {error && (
          <span style={{ fontSize: "0.85rem", color: "var(--color-danger)", fontWeight: 600 }}>{error}</span>
        )}
      </div>

      <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1.25rem" }}>
        Arrastra el título de una tarjeta para moverla, o su esquina inferior derecha para redimensionarla.
        Los datos que ves acá son reales (última sincronización), es exactamente lo que va a ver cualquier usuario en el reporte.
      </p>

      {(cargandoDatos || cargandoLayout) ? (
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Cargando...</p>
      ) : cards.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
          Este dashboard todavía no tiene datos sincronizados -- sincroniza desde /panel/sync para poder acomodar sus tarjetas.
        </p>
      ) : (
        <DashboardGrid
          cards={cards}
          savedLayout={pendingLayout ?? layout}
          editable
          onLayoutChange={(nuevo) => {
            setGuardadoOk(false);
            setPendingLayout(nuevo);
          }}
        />
      )}
    </div>
  );
}
