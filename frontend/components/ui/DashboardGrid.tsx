"use client";

import React, { useMemo } from "react";
import { ReactGridLayout, WidthProvider, type Layout } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import gridStyles from "./DashboardGrid.module.css";

const GridLayoutWithWidth = WidthProvider(ReactGridLayout);

export interface DashboardCardDef {
  id: string;
  title: string;
  minW?: number;
  minH?: number;
  defaultLayout: { x: number; y: number; w: number; h: number };
  render: () => React.ReactNode;
}

interface DashboardGridProps {
  cards: DashboardCardDef[];
  // Acomodo guardado (de useDashboardLayout) -- null mientras carga (no
  // pinta nada todavía, evita el parpadeo de "defaults" -> "guardado" al
  // entrar a la página), [] si nunca se guardó nada (usa los defaults de
  // cada tarjeta).
  savedLayout: Layout | null;
  editable?: boolean;
  onLayoutChange?: (layout: Layout) => void;
  cols?: number;
  rowHeight?: number;
}

// Wrapper de react-grid-layout compartido por todos los dashboards. En modo
// normal (editable=false, lo que ve cualquier usuario en su reporte) no deja
// arrastrar ni redimensionar -- solo pinta las tarjetas en el tamaño/posición
// guardado. El modo editable (arrastrar/redimensionar) solo se usa dentro de
// /panel/admin/dashboards.
export const DashboardGrid: React.FC<DashboardGridProps> = ({
  cards,
  savedLayout,
  editable = false,
  onLayoutChange,
  cols = 12,
  rowHeight = 40,
}) => {
  const layout: Layout = useMemo(() => {
    const guardadoPorId = new Map((savedLayout || []).map((item) => [item.i, item]));
    return cards.map((card) => {
      const guardado = guardadoPorId.get(card.id);
      return {
        i: card.id,
        x: guardado?.x ?? card.defaultLayout.x,
        y: guardado?.y ?? card.defaultLayout.y,
        w: guardado?.w ?? card.defaultLayout.w,
        h: guardado?.h ?? card.defaultLayout.h,
        minW: card.minW,
        minH: card.minH,
      };
    });
  }, [cards, savedLayout]);

  if (cards.length === 0) return null;

  return (
    <GridLayoutWithWidth
      className={gridStyles.grid}
      layout={layout}
      cols={cols}
      rowHeight={rowHeight}
      margin={[20, 20] as const}
      isDraggable={editable}
      isResizable={editable}
      draggableHandle={editable ? `.${gridStyles.dragHandle}` : undefined}
      onLayoutChange={editable ? onLayoutChange : undefined}
      useCSSTransforms
    >
      {cards.map((card) => (
        <div key={card.id} className={`${gridStyles.item} ${editable ? gridStyles.itemEditable : ""}`}>
          {editable && (
            <div className={gridStyles.dragHandle} title="Arrastrar para mover">
              {card.title}
            </div>
          )}
          <div className={gridStyles.itemBody}>{card.render()}</div>
        </div>
      ))}
    </GridLayoutWithWidth>
  );
};
