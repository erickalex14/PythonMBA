import React from "react";
import { KpiTile } from "../ui/KpiTile";
import type { DashboardCardDef } from "../ui/DashboardGrid";

interface SucursalCosto {
  sucursal: string;
  codigo: string;
  corp: string;
  costo_total: number;
  total_subbodegas: number;
  ciudad: string | null;
}

interface TopItem {
  etiqueta: string;
  costo_total: number;
}

interface DatosResumen {
  sucursales: SucursalCosto[];
  total_general: number;
  filas_procesadas: number;
  top_productos: TopItem[];
  top_grupos: TopItem[];
  top_marcas: TopItem[];
}

const usd = (n: number) => (n ?? 0).toLocaleString("es-EC", { style: "currency", currency: "USD" });

// Único lugar donde viven las 7 tarjetas KPI de Costos por Sucursal (antes
// copy-paste inline en costos-bodega/page.tsx) -- las usa tanto la vista
// real del reporte como el submódulo de edición en /panel/admin/dashboards,
// así ambas ven exactamente las mismas tarjetas con el mismo id estable
// (lo que usa <DashboardGrid> para guardar/aplicar el acomodo).
export function buildCostosBodegaCards(
  styles: Record<string, string>,
  datos: DatosResumen,
  ordenadas: SucursalCosto[],
  nombreEmpresa: string
): DashboardCardDef[] {
  const cards: DashboardCardDef[] = [
    {
      id: "costo-total",
      title: "Costo Total de Inventario",
      defaultLayout: { x: 0, y: 0, w: 4, h: 4 },
      minW: 2,
      minH: 3,
      render: () => (
        <KpiTile
          styles={styles}
          title="Costo Total de Inventario"
          value={usd(datos.total_general)}
          iconBg="var(--color-surface-tint-accent)"
          footnote={nombreEmpresa}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-chart-accent)" strokeWidth="2.5">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
      ),
    },
    {
      id: "bodegas-principales",
      title: "Bodegas Principales",
      defaultLayout: { x: 4, y: 0, w: 4, h: 4 },
      minW: 2,
      minH: 3,
      render: () => (
        <KpiTile
          styles={styles}
          title="Bodegas Principales"
          value={datos.sucursales.length.toLocaleString("es-EC")}
          iconBg="var(--color-surface-tint-blue)"
          footnote="con costo de inventario > 0"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2.5">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
            </svg>
          }
        />
      ),
    },
    {
      id: "lineas-inventario",
      title: "Líneas de Inventario",
      defaultLayout: { x: 8, y: 0, w: 4, h: 4 },
      minW: 2,
      minH: 3,
      render: () => (
        <KpiTile
          styles={styles}
          title="Líneas de Inventario"
          value={datos.filas_procesadas.toLocaleString("es-EC")}
          iconBg="var(--color-surface-tint-violet)"
          footnote="productos x bodega, con existencia > 0"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-violet)" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          }
        />
      ),
    },
  ];

  // Estos 4 solo existen cuando hay top_productos -- si no hay, simplemente
  // no entran al array (DashboardGrid tolera menos tarjetas que las guardadas).
  if (datos.top_productos.length > 0) {
    cards.push(
      {
        id: "bodega-mayor-costo",
        title: "Bodega Principal con Mayor Costo",
        defaultLayout: { x: 0, y: 4, w: 3, h: 4 },
        minW: 2,
        minH: 3,
        render: () => (
          <KpiTile
            styles={styles}
            title="Bodega Principal con Mayor Costo"
            value={usd(ordenadas[0]?.costo_total || 0)}
            iconBg="var(--color-surface-tint-blue)"
            footnote={ordenadas[0]?.sucursal}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2.5">
                <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
              </svg>
            }
          />
        ),
      },
      {
        id: "producto-mayor-costo",
        title: "Producto con Mayor Costo",
        defaultLayout: { x: 3, y: 4, w: 3, h: 4 },
        minW: 2,
        minH: 3,
        render: () => (
          <KpiTile
            styles={styles}
            title="Producto con Mayor Costo"
            value={usd(datos.top_productos[0]?.costo_total || 0)}
            iconBg="var(--color-surface-tint-accent)"
            footnote={datos.top_productos[0]?.etiqueta}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-chart-accent)" strokeWidth="2.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            }
          />
        ),
      },
      {
        id: "grupo-mayor-costo",
        title: "Grupo con Mayor Costo",
        defaultLayout: { x: 6, y: 4, w: 3, h: 4 },
        minW: 2,
        minH: 3,
        render: () => (
          <KpiTile
            styles={styles}
            title="Grupo con Mayor Costo"
            value={usd(datos.top_grupos[0]?.costo_total || 0)}
            iconBg="var(--color-surface-tint-violet)"
            footnote={datos.top_grupos[0]?.etiqueta}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-violet)" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
            }
          />
        ),
      },
      {
        id: "marca-mayor-costo",
        title: "Marca con Mayor Costo",
        defaultLayout: { x: 9, y: 4, w: 3, h: 4 },
        minW: 2,
        minH: 3,
        render: () => (
          <KpiTile
            styles={styles}
            title="Marca con Mayor Costo"
            value={usd(datos.top_marcas[0]?.costo_total || 0)}
            iconBg="var(--color-surface-tint-blue)"
            footnote={datos.top_marcas[0]?.etiqueta}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2.5">
                <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" />
              </svg>
            }
          />
        ),
      },
    );
  }

  return cards;
}
