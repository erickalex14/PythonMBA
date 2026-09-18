"use client";

import { useCallback, useEffect, useState } from "react";
import type { Layout } from "react-grid-layout/legacy";

interface FilaLayout {
  cardId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Trae/guarda el acomodo (tamaño/posición) de las tarjetas de UN dashboard,
// contra GET/POST /api/dashboard-layouts (ver esa ruta). Es una config
// GLOBAL (la define un admin desde /panel/admin/dashboards, la ven todos los
// usuarios) -- no hay estado "por usuario" acá. `layout` viene `null`
// mientras carga y `[]` si nunca se guardó nada para este dashboard (el
// llamador debe usar sus propios defaults en ese caso, ver DashboardGrid).
export function useDashboardLayout(dashboardId: string) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);

    fetch(`/api/dashboard-layouts?dashboardId=${encodeURIComponent(dashboardId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el acomodo guardado de este dashboard.");
        return res.json();
      })
      .then((filas: FilaLayout[]) => {
        if (cancelado) return;
        setLayout(filas.map((f) => ({ i: f.cardId, x: f.x, y: f.y, w: f.w, h: f.h })));
      })
      .catch((err: any) => {
        if (!cancelado) setError(err.message || "Error cargando el acomodo.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [dashboardId]);

  const saveLayout = useCallback(
    async (nuevoLayout: Layout) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard-layouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dashboardId,
            layout: nuevoLayout.map((item) => ({ cardId: item.i, x: item.x, y: item.y, w: item.w, h: item.h })),
          }),
        });
        if (!res.ok) {
          const texto = await res.text();
          throw new Error(texto || "Error guardando el acomodo.");
        }
        setLayout(nuevoLayout);
      } catch (err: any) {
        setError(err.message || "Error del servidor.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [dashboardId]
  );

  return { layout, loading, saving, error, saveLayout };
}
