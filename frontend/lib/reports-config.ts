export interface ColumnConfig {
  key: string;
  label: string;
  type: "text" | "currency" | "number" | "percent" | "badge" | "bold";
  badgeStyles?: (value: any) => { label: string; className: string };
}

export interface ReportConfig {
  id: string;
  title: string;
  subtitle: string;
  endpoint: string;
  excelType: string;
  columns: ColumnConfig[];
  kpis: {
    mainMetricLabel: string;
    mainMetricKey: string;
    secondMetricLabel: string;
    secondMetricKey: string;
  };
}

export const REPORTS_CONFIG: Record<string, ReportConfig> = {
  movimientos: {
    id: "movimientos",
    title: "Movimientos de Productos",
    subtitle: "Kardex de entradas, salidas y movimientos internos transaccionados",
    endpoint: "/api/data/movimientos",
    excelType: "movimientos",
    columns: [
      { key: "TRANS_DATE", label: "Fecha", type: "text" },
      { key: "PRODUCT_NAME", label: "Producto", type: "text" },
      { key: "Codigo_producto_convertido", label: "Cod. Convertido", type: "text" },
      { key: "Codigo_Marca", label: "Marca", type: "text" },
      { key: "ORIGINAL_QTY", label: "Cantidad", type: "number" },
      { key: "ORIGIN_REF", label: "Ref. Origen", type: "text" },
      { key: "ORIGIN_MEMO", label: "Concepto", type: "text" },
      { key: "BASE_COMISION", label: "Base Com.", type: "currency" },
      { key: "COD_SALESMAN", label: "Cod. Vendedor", type: "text" }
    ],
    kpis: {
      mainMetricLabel: "Transacciones de Movimiento",
      mainMetricKey: "count",
      secondMetricLabel: "Unidades Movilizadas",
      secondMetricKey: "totalQty"
    }
  },
  liquidaciones: {
    id: "liquidaciones",
    title: "Liquidaciones de Importaciones",
    subtitle: "Consolidado de costos CIF y detalle de productos liquidados",
    endpoint: "/api/data/liquidaciones",
    excelType: "liquidaciones",
    columns: [
      { key: "LIQUIDACION_FECHA", label: "Fecha", type: "text" },
      { key: "LIQUIDACION_ID_CORP", label: "Cod. Corp", type: "bold" },
      { key: "IdRecepcionRelacionada", label: "Detalle Recepción", type: "text" },
      { key: "PARTIDA_ID_CORP", label: "Partida ID", type: "text" },
      { key: "PRODUCTO_ID_CORP", label: "Producto ID", type: "text" },
      { key: "CANTIDAD", label: "Cant.", type: "number" },
      { key: "PRECIO", label: "Precio", type: "currency" },
      { key: "TOTAL", label: "Total", type: "currency" },
      { key: "VALOR_TOTAL_CIF", label: "Cost CIF Total", type: "currency" },
      { key: "OBSERVACIONES", label: "Observaciones", type: "text" }
    ],
    kpis: {
      mainMetricLabel: "Monto CIF Total Liquidado",
      mainMetricKey: "totalCif",
      secondMetricLabel: "Liquidaciones Completadas",
      secondMetricKey: "count"
    }
  },
  ats: {
    id: "ats",
    title: "Reporte ATS (Compras)",
    subtitle: "Transacciones de compras y retenciones del periodo fiscal",
    endpoint: "/api/data/ats",
    excelType: "ats",
    columns: [
      { key: "INVOICE_DATE", label: "Fecha", type: "text" },
      { key: "RUC_or_FED_ID", label: "RUC / ID", type: "text" },
      { key: "VENDOR_NAME", label: "Proveedor", type: "text" },
      { key: "DOC_REFERENCE", label: "Documento Ref.", type: "text" },
      { key: "SUMA_CON_IVA", label: "Bases con IVA", type: "currency" },
      { key: "SUMA_SIN_IVA", label: "Bases sin IVA", type: "currency" },
      { key: "INVOICE_TOTAL", label: "Total Facturado", type: "currency" },
      {
        key: "ES_ANULADO",
        label: "Estado",
        type: "badge",
        badgeStyles: (value: any) => ({
          label: value === 1 ? "ANULADO" : "ACTIVO",
          className: value === 1 ? "badgeAnulado" : "badgeActivo"
        })
      },
      { key: "MF_Lista2", label: "Cod. Clasif", type: "text" },
      { key: "MEMO", label: "Concepto", type: "text" }
    ],
    kpis: {
      mainMetricLabel: "Total Facturado Compras",
      mainMetricKey: "totalFacturado",
      secondMetricLabel: "Total Facturas Activas",
      secondMetricKey: "count"
    }
  },
  ventas: {
    id: "ventas",
    title: "Reporte de Rentabilidad",
    subtitle: "Costo, utilidad y margen por línea de venta",
    endpoint: "/api/data/ventas",
    excelType: "ventas",
    columns: [
      { key: "factura_final", label: "Factura", type: "bold" },
      { key: "fecha", label: "Fecha", type: "text" },
      { key: "empresa", label: "Empresa", type: "text" },
      { key: "sucursal", label: "Sucursal", type: "text" },
      { key: "bodega_nombre", label: "Bodega", type: "text" },
      { key: "codigo", label: "Código", type: "text" },
      { key: "producto", label: "Producto", type: "text" },
      { key: "grupo", label: "Grupo", type: "text" },
      { key: "subgrupo", label: "Subgrupo", type: "text" },
      { key: "nombre_cliente", label: "Cliente", type: "text" },
      { key: "unidad", label: "Unidad", type: "text" },
      { key: "cantidad", label: "Cantidad", type: "number" },
      { key: "precio_venta", label: "Precio Venta", type: "currency" },
      { key: "subtotal", label: "Subtotal", type: "currency" },
      { key: "descuento_aplicado", label: "Descuento", type: "currency" },
      { key: "total_linea", label: "Neto", type: "currency" },
      { key: "costo_unitario", label: "Costo Unitario", type: "currency" },
      { key: "costo_total", label: "Costo Total", type: "currency" },
      { key: "utilidad_total", label: "Utilidad", type: "currency" },
      { key: "pct_utilidad_costo", label: "% Margen", type: "percent" }
    ],
    kpis: {
      mainMetricLabel: "Monto Total de Ventas",
      mainMetricKey: "totalFacturado",
      secondMetricLabel: "Unidades Vendidas",
      secondMetricKey: "totalQty"
    }
  },
  "estadisticas-ventas": {
    id: "estadisticas-ventas",
    title: "Reporte de Ventas",
    subtitle: "Estadísticas por producto: vendido, precios y existencia actual",
    endpoint: "/api/data/estadisticas-ventas",
    excelType: "estadisticas-ventas",
    columns: [
      { key: "codigo", label: "Código", type: "bold" },
      { key: "producto", label: "Descripción", type: "text" },
      { key: "empresa_nombre", label: "Empresa", type: "text" },
      { key: "unidad", label: "Unidad", type: "text" },
      { key: "grupo", label: "Grupo", type: "text" },
      { key: "subgrupo", label: "Subgrupo", type: "text" },
      { key: "existencia", label: "Existencia", type: "number" },
      { key: "asignado", label: "Asignado", type: "number" },
      { key: "disponible", label: "Disponible", type: "number" },
      { key: "unidades_vendidas", label: "Unidades Vendidas", type: "number" },
      { key: "total_ventas", label: "Total Ventas", type: "currency" },
      { key: "precio_promedio", label: "Precio Promedio", type: "currency" },
      { key: "precio_maximo", label: "Precio Máximo", type: "currency" },
      { key: "precio_minimo", label: "Precio Mínimo", type: "currency" },
      { key: "ultimo_precio", label: "Último Precio", type: "currency" },
      { key: "ultima_fecha_venta", label: "Última Fecha Venta", type: "text" },
      { key: "no_dias", label: "No. Días", type: "number" }
    ],
    kpis: {
      mainMetricLabel: "Monto Total Vendido",
      mainMetricKey: "totalVentas",
      secondMetricLabel: "Unidades Vendidas",
      secondMetricKey: "totalUnidades"
    }
  }
};
