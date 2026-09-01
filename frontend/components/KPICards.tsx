import React, { useMemo } from "react";
import { Card } from "./ui/Card";
import { Sparkline } from "./charts/Sparkline";

/* Cadena de descuentos que devuelve el backend, en orden:
     monto − devoluciones                        = monto_neto
     monto_neto − autoconsumos − consumibles     = monto_real
   `autoconsumos` es la bodega 31A (consumo de la tienda) y `consumibles` son
   globos/portaglobos/infladores/fundas vendidos FUERA de 31A — se excluyen
   entre sí en el backend, así que se pueden restar los dos sin duplicar. */
export interface TotalesEmpresa {
  empresa: string;
  empresa_nombre: string;
  monto: number;
  monto_devoluciones: number;
  monto_neto: number;
  cantidad: number;
  cantidad_devoluciones: number;
  monto_autoconsumos?: number;
  cantidad_autoconsumos?: number;
  monto_consumibles?: number;
  cantidad_consumibles?: number;
  monto_real?: number;
}

export interface TotalesRango {
  monto: number;
  monto_devoluciones: number;
  monto_neto: number;
  cantidad_devoluciones: number;
  monto_autoconsumos?: number;
  cantidad_autoconsumos?: number;
  monto_consumibles?: number;
  cantidad_consumibles?: number;
  monto_real?: number;
  comparado_con: string;
  delta_pct: number | null;
  por_empresa?: TotalesEmpresa[];
}

const usd = (n: number) => n.toLocaleString("es-EC", { style: "currency", currency: "USD" });

/** Fila de valor dentro de una tarjeta por empresa. */
function LineaMonto({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 3 }}>
      <span>{etiqueta}</span>
      <strong style={{ color: color || "var(--color-text-primary)" }}>{valor}</strong>
    </div>
  );
}

interface KPICardsProps {
  filteredData: any[];
  activeTab: string;
  styles: any;
  /** Totales del rango calculados en el backend (incluyen devoluciones, que no
   *  vienen en las líneas del reporte). Sin esto no se muestran esas tarjetas. */
  totales?: TotalesRango | null;
  /** Tendencia diaria real (misma agrupación por fecha que ya usan los
   *  gráficos de la página) para dibujar un mini sparkline junto al valor de
   *  las 3 tarjetas genéricas de arriba. Opcional - sin esto, esas tarjetas
   *  se ven exactamente igual que antes. */
  sparklines?: { registros?: number[]; principal?: number[]; segunda?: number[] };
}

/** Pie de tarjeta con el % real contra el período anterior del mismo largo. */
function DeltaReal({ delta, comparadoCon }: { delta: number | null; comparadoCon?: string }) {
  if (delta === null || delta === undefined) {
    return (
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
        sin período anterior para comparar
      </div>
    );
  }
  const sube = delta >= 0;
  const color = sube ? "var(--color-success-dark)" : "#c0392b";
  return (
    <div
      title={comparadoCon ? `Comparado con ${comparadoCon}` : undefined}
      style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" style={{ transform: sube ? "none" : "scaleY(-1)" }}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
      </svg>
      <span style={{ color, fontWeight: 700 }}>{sube ? "+" : ""}{delta}%</span>
      <span>vs. período anterior</span>
    </div>
  );
}

export const KPICards: React.FC<KPICardsProps> = ({ filteredData, activeTab, styles, totales, sparklines }) => {
  const kpis = useMemo(() => {
    const totalRecords = filteredData.length;
    let mainMetricLabel = "Métrica Principal";
    let mainMetricValue = "$0.00";
    let secondMetricLabel = "Segunda Métrica";
    let secondMetricValue = "0";

    if (activeTab === "movimientos") {
      mainMetricLabel = "Total Cantidad Movimientos";
      const totalQty = filteredData.reduce((acc, row) => acc + (Number(row.ORIGINAL_QTY) || 0), 0);
      mainMetricValue = totalQty.toLocaleString("es-EC", { maximumFractionDigits: 2 });
      
      secondMetricLabel = "Base de Comisión Real";
      const totalComision = filteredData.reduce((acc, row) => acc + (Number(row.BASE_COMISION) || 0), 0);
      secondMetricValue = totalComision.toLocaleString("es-EC", { style: "currency", currency: "USD" });
    } else if (activeTab === "liquidaciones") {
      mainMetricLabel = "Valor Total CIF Acumulado";
      const totalCif = filteredData.reduce((acc, row) => acc + (Number(row.VALOR_TOTAL_CIF) || 0), 0);
      mainMetricValue = totalCif.toLocaleString("es-EC", { style: "currency", currency: "USD" });

      secondMetricLabel = "Total Unidades Importadas";
      const totalUnits = filteredData.reduce((acc, row) => acc + (Number(row.CANTIDAD) || 0), 0);
      secondMetricValue = totalUnits.toLocaleString("es-EC", { maximumFractionDigits: 0 });
    } else if (activeTab === "ats") {
      // Una factura anulada no cuenta como facturado real - se excluye de
      // los totales monetarios (igual que en el Dashboard), aunque sigue
      // visible en la tabla de detalle con su badge de estado.
      const activos = filteredData.filter((row) => Number(row.ES_ANULADO) !== 1);
      mainMetricLabel = "Monto Facturado Total (ATS)";
      const totalInvoice = activos.reduce((acc, row) => acc + (Number(row.INVOICE_TOTAL) || 0), 0);
      mainMetricValue = totalInvoice.toLocaleString("es-EC", { style: "currency", currency: "USD" });

      secondMetricLabel = "Suma Bases con IVA";
      const totalIva = activos.reduce((acc, row) => acc + (Number(row.SUMA_CON_IVA) || 0), 0);
      secondMetricValue = totalIva.toLocaleString("es-EC", { style: "currency", currency: "USD" });
    } else if (activeTab === "ventas") {
      mainMetricLabel = "Monto Total Ventas";
      const totalVentas = filteredData.reduce((acc, row) => acc + (Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0), 0);
      mainMetricValue = totalVentas.toLocaleString("es-EC", { style: "currency", currency: "USD" });

      secondMetricLabel = "Total Unidades Vendidas";
      const totalUnits = filteredData.reduce((acc, row) => acc + (Number(row.cantidad) || Number(row.CANTIDAD) || 0), 0);
      secondMetricValue = totalUnits.toLocaleString("es-EC", { maximumFractionDigits: 0 });
    } else if (activeTab === "estadisticas-ventas") {
      mainMetricLabel = "Monto Total Vendido";
      const totalVentas = filteredData.reduce((acc, row) => acc + (Number(row.total_ventas) || 0), 0);
      mainMetricValue = totalVentas.toLocaleString("es-EC", { style: "currency", currency: "USD" });

      secondMetricLabel = "Unidades Vendidas";
      const totalUnidades = filteredData.reduce((acc, row) => acc + (Number(row.unidades_vendidas) || 0), 0);
      secondMetricValue = totalUnidades.toLocaleString("es-EC", { maximumFractionDigits: 0 });
    }

    // Desglose por empresa/sucursal (solo Ventas)
    let ventasSeg: { novicompu: string; env: string; mayoristas: string } | null = null;
    if (activeTab === "ventas") {
      const fmt = (n: number) => n.toLocaleString("es-EC", { style: "currency", currency: "USD" });
      const lineTotal = (row: any) => Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0;
      const emp = (row: any) => String(row.empresa || row.EMPRESA || "").toUpperCase();
      const suc = (row: any) => String(row.sucursal || row.SUCURSAL || "").trim();
      const novi = filteredData.reduce((a, r) => a + (emp(r).includes("NOVI") ? lineTotal(r) : 0), 0);
      const env = filteredData.reduce((a, r) => a + (emp(r).includes("ENV") ? lineTotal(r) : 0), 0);
      const may = filteredData.reduce((a, r) => a + (["026", "027"].includes(suc(r)) ? lineTotal(r) : 0), 0);
      ventasSeg = { novicompu: fmt(novi), env: fmt(env), mayoristas: fmt(may) };
    } else if (activeTab === "estadisticas-ventas") {
      const fmt = (n: number) => n.toLocaleString("es-EC", { style: "currency", currency: "USD" });
      const totalVenta = (row: any) => Number(row.total_ventas) || 0;
      const novi = filteredData.reduce((a, r) => a + (String(r.empresa).trim() === "NVC01" ? totalVenta(r) : 0), 0);
      const env = filteredData.reduce((a, r) => a + (String(r.empresa).trim() === "ENV01" ? totalVenta(r) : 0), 0);
      ventasSeg = { novicompu: fmt(novi), env: fmt(env), mayoristas: "" };
    }

    return { totalRecords, mainMetricLabel, mainMetricValue, secondMetricLabel, secondMetricValue, ventasSeg };
  }, [filteredData, activeTab]);

  if (activeTab === "logs" || activeTab === "admin" || activeTab === "sync" || filteredData.length === 0) {
    return null;
  }

  return (
    <section className={styles.kpiGrid}>
      <Card variant="kpiCard" styles={styles}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3>Registros Encontrados</h3>
          <div style={{ background: "var(--color-surface-tint-blue)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-chart-accent)" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "0.75rem" }}>
          <p className={styles.kpiValue} style={{ margin: 0 }}>{kpis.totalRecords.toLocaleString()}</p>
          {sparklines?.registros && sparklines.registros.length > 1 && (
            <Sparkline data={sparklines.registros} color="var(--color-chart-accent)" />
          )}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
          líneas en el rango consultado
        </div>
      </Card>

      <Card variant="kpiCard" styles={styles}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3>{kpis.mainMetricLabel}</h3>
          <div style={{ background: "var(--color-surface-tint-accent)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-chart-accent)" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "0.75rem" }}>
          <p className={styles.kpiValue} style={{ margin: 0 }}>{kpis.mainMetricValue}</p>
          {sparklines?.principal && sparklines.principal.length > 1 && (
            <Sparkline data={sparklines.principal} color="var(--color-chart-accent)" />
          )}
        </div>
        {totales ? (
          <DeltaReal delta={totales.delta_pct} comparadoCon={totales.comparado_con} />
        ) : (
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
            total del rango consultado
          </div>
        )}
      </Card>

      <Card variant="kpiCard" styles={styles}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3>{kpis.secondMetricLabel}</h3>
          <div style={{ background: "var(--color-surface-tint-violet)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-violet)" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "0.75rem" }}>
          <p className={styles.kpiValue} style={{ margin: 0 }}>{kpis.secondMetricValue}</p>
          {sparklines?.segunda && sparklines.segunda.length > 1 && (
            <Sparkline data={sparklines.segunda} color="var(--color-accent-violet)" />
          )}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
          acumulado del rango consultado
        </div>
      </Card>

      {/* Devoluciones: solo en Ventas y solo si el backend las devolvió. No se
          pueden sumar de las líneas del reporte, que excluyen las devoluciones. */}
      {totales && (
        <>
          <Card variant="kpiCard" styles={styles}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3>Ventas con devoluciones</h3>
            </div>
            <p className={styles.kpiValue}>
              {totales.monto.toLocaleString("es-EC", { style: "currency", currency: "USD" })}
            </p>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
              facturado bruto, sin descontar
            </div>
          </Card>

          <Card variant="kpiCard" styles={styles}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3>Devoluciones</h3>
            </div>
            <p className={styles.kpiValue} style={{ color: totales.monto_devoluciones > 0 ? "#c0392b" : undefined }}>
              {totales.monto_devoluciones.toLocaleString("es-EC", { style: "currency", currency: "USD" })}
            </p>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
              {totales.cantidad_devoluciones.toLocaleString("es-EC")} unidades devueltas
            </div>
          </Card>

          <Card variant="kpiCard" styles={styles}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3>Ventas sin devoluciones</h3>
            </div>
            <p className={styles.kpiValue}>
              {totales.monto_neto.toLocaleString("es-EC", { style: "currency", currency: "USD" })}
            </p>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
              todavía incluye autoconsumos y consumibles
            </div>
          </Card>

          {/* Autoconsumo (bodega 31A): la tienda se consume el producto. El ERP lo
              marca como venta a cliente, así que venía sumado en el bruto — se
              descuenta para llegar a la venta real. */}
          <Card variant="kpiCard" styles={styles}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3>Autoconsumos</h3>
            </div>
            <p className={styles.kpiValue} style={{ color: (totales.monto_autoconsumos ?? 0) > 0 ? "#b7791f" : undefined }}>
              {(totales.monto_autoconsumos ?? 0).toLocaleString("es-EC", { style: "currency", currency: "USD" })}
            </p>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
              {(totales.cantidad_autoconsumos ?? 0).toLocaleString("es-EC")} unidades · bodega 31A · se descuenta
            </div>
          </Card>

          {/* Globos, portaglobos, infladores y fundas vendidos fuera de 31A:
              material de despacho, no el negocio. */}
          <Card variant="kpiCard" styles={styles}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3>Globos y fundas</h3>
            </div>
            <p className={styles.kpiValue} style={{ color: (totales.monto_consumibles ?? 0) > 0 ? "#b7791f" : undefined }}>
              {(totales.monto_consumibles ?? 0).toLocaleString("es-EC", { style: "currency", currency: "USD" })}
            </p>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
              {(totales.cantidad_consumibles ?? 0).toLocaleString("es-EC")} unidades · fuera de 31A · se descuenta
            </div>
          </Card>

          <Card variant="kpiCard" styles={styles}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3>Venta real</h3>
            </div>
            <p className={styles.kpiValue} style={{ color: "var(--color-success-dark)" }}>
              {(totales.monto_real ?? totales.monto_neto).toLocaleString("es-EC", { style: "currency", currency: "USD" })}
            </p>
            <DeltaReal delta={totales.delta_pct} comparadoCon={totales.comparado_con} />
          </Card>
        </>
      )}

      {kpis.ventasSeg && (
        <>
          {/* Con el desglose del backend cada empresa muestra sus tres montos; si
              no llegó, se cae al total simple que ya se calculaba en el front. */}
          {totales?.por_empresa?.length ? (
            totales.por_empresa.map((emp) => (
              <Card key={emp.empresa} variant="kpiCard" styles={styles}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3>{emp.empresa_nombre}</h3>
                  <div style={{ background: emp.empresa === "NVC01" ? "var(--color-surface-tint-blue)" : "var(--color-surface-tint-accent)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={emp.empresa === "NVC01" ? "var(--color-brand-primary)" : "var(--color-brand-accent)"} strokeWidth="2.5"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
                  </div>
                </div>
                <p className={styles.kpiValue}>{usd(emp.monto_real ?? emp.monto_neto)}</p>
                <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>venta real</div>
                <div style={{ borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.45rem" }}>
                  <LineaMonto etiqueta="Con devoluciones" valor={usd(emp.monto)} />
                  <LineaMonto
                    etiqueta="Devoluciones"
                    valor={emp.monto_devoluciones > 0 ? `- ${usd(emp.monto_devoluciones)}` : usd(0)}
                    color={emp.monto_devoluciones > 0 ? "#c0392b" : undefined}
                  />
                  <LineaMonto
                    etiqueta="Autoconsumos (31A)"
                    valor={(emp.monto_autoconsumos ?? 0) > 0 ? `- ${usd(emp.monto_autoconsumos ?? 0)}` : usd(0)}
                    color={(emp.monto_autoconsumos ?? 0) > 0 ? "#b7791f" : undefined}
                  />
                  <LineaMonto
                    etiqueta="Globos y fundas"
                    valor={(emp.monto_consumibles ?? 0) > 0 ? `- ${usd(emp.monto_consumibles ?? 0)}` : usd(0)}
                    color={(emp.monto_consumibles ?? 0) > 0 ? "#b7791f" : undefined}
                  />
                  <LineaMonto etiqueta="Unidades devueltas" valor={emp.cantidad_devoluciones.toLocaleString("es-EC")} />
                </div>
              </Card>
            ))
          ) : (
            <>
              <Card variant="kpiCard" styles={styles}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3>Novicompu</h3>
                  <div style={{ background: "var(--color-surface-tint-blue)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2.5"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
                  </div>
                </div>
                <p className={styles.kpiValue}>{kpis.ventasSeg.novicompu}</p>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>Empresa NVC01</div>
              </Card>

              <Card variant="kpiCard" styles={styles}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3>ENV</h3>
                  <div style={{ background: "var(--color-surface-tint-accent)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-accent)" strokeWidth="2.5"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
                  </div>
                </div>
                <p className={styles.kpiValue}>{kpis.ventasSeg.env}</p>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>Empresa ENV01</div>
              </Card>
            </>
          )}

          {activeTab === "ventas" && (
            <Card variant="kpiCard" styles={styles}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3>Mayoristas</h3>
                <div style={{ background: "var(--color-surface-tint-violet)", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </div>
              </div>
              <p className={styles.kpiValue}>{kpis.ventasSeg.mayoristas}</p>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "0.45rem", marginTop: "0.25rem" }}>Novicompu suc. 026 + 027</div>
            </Card>
          )}
        </>
      )}
    </section>
  );
};
