import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { DatePicker } from "./ui/DatePicker";
import { SegmentedProgressBar } from "./ui/SegmentedProgressBar";

interface SyncSectionProps {
  styles: any;
}

interface CoberturaTipo {
  tipo: string;
  tabla: string;
  frecuencia: "diaria" | "esporadica";
  ultimo_dia_sincronizado: string | null;
  dias_esperados: number;
  dias_con_datos: number;
  dias_faltantes: string[];
  filas_en_rango: number;
  error?: string;
}

const ETIQUETAS_TIPO: Record<string, string> = {
  movimientos: "Movimientos",
  ventas: "Ventas",
  liquidaciones: "Liquidaciones",
  ats: "ATS",
  kpi: "KPI",
};

// Agrupa dias consecutivos en rangos ("2026-07-28 a 2026-07-30") para no listar
// treinta fechas sueltas cuando falta un mes entero.
function agruparEnRangos(dias: string[]): string[] {
  if (dias.length === 0) return [];
  const orden = [...dias].sort();
  const rangos: string[] = [];
  let desde = orden[0];
  let previo = orden[0];

  for (let i = 1; i <= orden.length; i++) {
    const actual = orden[i];
    const siguienteEsperado = new Date(previo + "T00:00:00");
    siguienteEsperado.setDate(siguienteEsperado.getDate() + 1);
    const esperadoStr = siguienteEsperado.toISOString().split("T")[0];

    if (actual !== esperadoStr) {
      rangos.push(desde === previo ? desde : `${desde} a ${previo}`);
      desde = actual;
    }
    previo = actual;
  }
  return rangos;
}

function getDatesInRange(startStr: string, endStr: string): string[] {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  const dates: string[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export const SyncSection: React.FC<SyncSectionProps> = ({ styles }) => {
  const [startDate, setStartDate] = useState("2026-06-19");
  const [endDate, setEndDate] = useState("2026-07-07");
  const [selectedEnv, setSelectedEnv] = useState<"PRUEBAS" | "PROD">("PROD");
  
  const [syncing, setSyncing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [estTimeRemaining, setEstTimeRemaining] = useState<number | null>(null);
  const [currentDateProcessing, setCurrentDateProcessing] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const [cobertura, setCobertura] = useState<CoberturaTipo[]>([]);
  const [verificando, setVerificando] = useState(false);
  const [errorCobertura, setErrorCobertura] = useState<string | null>(null);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll de la consola
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const verificarCobertura = async () => {
    if (!startDate || !endDate) return;
    setVerificando(true);
    setErrorCobertura(null);
    try {
      const res = await fetch(`/api/data/sync?inicio=${startDate}&fin=${endDate}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setCobertura(Array.isArray(json) ? json : []);
    } catch (err: any) {
      setErrorCobertura(err.message || "No se pudo verificar la cobertura del staging.");
      setCobertura([]);
    } finally {
      setVerificando(false);
    }
  };

  // Al abrir la pantalla se muestra el estado sin que haya que pedirlo: el objetivo
  // es que un hueco se vea antes de que alguien lo descubra en un reporte.
  useEffect(() => {
    verificarCobertura();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async (type: "movimientos" | "liquidaciones" | "ats" | "ventas" | "kpi") => {
    if (syncing) return;
    
    // Validar rango de fechas
    if (!startDate || !endDate) {
      alert("Por favor ingrese las fechas de inicio y fin.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      alert("La fecha de inicio debe ser anterior o igual a la fecha de fin.");
      return;
    }

    setSyncing(true);
    setCurrentProgress(0);
    setEstTimeRemaining(null);
    setLogs([]);
    
    const labelMap = {
      movimientos: "Movimientos de Inventario (Kardex)",
      liquidaciones: "Liquidaciones de Importación",
      ats: "Reporte ATS (Compras/Facturación)",
      ventas: "Reporte de Ventas",
      kpi: "Seguimiento KPI (schema propio)"
    };

    addLog(`>>> INICIANDO SINCRONIZACIÓN MANUAL: ${labelMap[type].toUpperCase()} <<<`);
    addLog(`Rango: ${startDate} al ${endDate}`);
    addLog(`Origen de Datos (ERP): Ambiente de ${selectedEnv.toUpperCase()}`);
    addLog(`Estableciendo conexión...`);

    const diasVacios: string[] = [];

    try {
      const dates = getDatesInRange(startDate, endDate);
      const totalDays = dates.length;
      const startTime = Date.now();

      for (let i = 0; i < totalDays; i++) {
        const currentDate = dates[i];
        setCurrentDateProcessing(currentDate);

        const progressPercent = Math.round((i / totalDays) * 100);
        setCurrentProgress(progressPercent);

        if (i > 0) {
          const elapsed = Date.now() - startTime;
          const avgPerDay = elapsed / i;
          const remainingDays = totalDays - i;
          const estSeconds = Math.round((avgPerDay * remainingDays) / 1000);
          setEstTimeRemaining(estSeconds);
        }

        addLog(`Procesando día ${i + 1}/${totalDays}: ${currentDate}...`);

        const res = await fetch(
          `/api/data/sync?type=${type}&inicio=${currentDate}&fin=${currentDate}&env=${selectedEnv}`,
          { method: "POST" }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error || `HTTP ${res.status}`;
          addLog(`[ERROR] Falló día ${currentDate}: ${errMsg}`);
          throw new Error(errMsg);
        }

        const result = await res.json();

        let details = "";
        let registros = 0;
        if (type === "movimientos") {
          registros = result.records_count || 0;
          details = `${registros} movimientos de inventario`;
        } else if (type === "liquidaciones") {
          registros = (result.cabeceras_count || 0) + (result.productos_count || 0);
          details = `${result.cabeceras_count || 0} liquidaciones, ${result.productos_count || 0} partidas`;
        } else if (type === "ats") {
          registros = (result.facturas_count || 0) + (result.fiscal_count || 0);
          details = `${result.facturas_count || 0} facturas, ${result.fiscal_count || 0} registros fiscales`;
        } else if (type === "ventas") {
          // El backend de ventas devuelve kardex_count / facturas_count
          registros = (result.kardex_count || 0) + (result.facturas_count || 0);
          details = `${result.kardex_count || 0} movimientos, ${result.facturas_count || 0} facturas`;
        }

        // Un dia con 0 registros casi nunca es correcto en estas tablas: suele ser un
        // fallo de token que el ERP devuelve como respuesta vacia. Se marca distinto
        // para que no se lea como exito.
        if (registros === 0) {
          diasVacios.push(currentDate);
          addLog(`[AVISO] Día ${currentDate} devolvió 0 registros - revisar si es un hueco.`);
        } else {
          addLog(`[OK] Día ${currentDate} sincronizado con éxito (${details}).`);
        }
      }

      setCurrentProgress(100);
      setEstTimeRemaining(0);
      if (diasVacios.length > 0) {
        addLog(`>>> PROCESO FINALIZADO CON ${diasVacios.length} DÍA(S) EN 0: ${diasVacios.join(", ")} <<<`);
        addLog(`Verifica esos días abajo antes de dar el rango por sincronizado.`);
      } else {
        addLog(`>>> PROCESO FINALIZADO CON ÉXITO: 100% COMPLETADO <<<`);
        addLog(`La tabla de staging local ya se encuentra al día con el ERP.`);
      }
    } catch (err: any) {
      addLog(`>>> [FALLO DE PROCESO] Sincronización abortada: ${err.message} <<<`);
    } finally {
      setSyncing(false);
      verificarCobertura();
    }
  };

  return (
    <Card variant="adminCard" styles={styles} style={{ marginTop: "1rem" }}>
      <h3 style={{ borderBottom: "2px solid var(--color-border)", paddingBottom: "0.50rem", color: "var(--color-brand-primary)" }}>
        Sincronización Manual del ERP
      </h3>
      <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0.50rem 0 1.25rem 0" }}>
        Utiliza esta herramienta para importar datos transaccionales del ERP por días de forma controlada y segura hacia la base de datos de staging local.
      </p>

      {/* Formulario */}
      <div className={styles.formRow} style={{ flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className={styles.formGroup} style={{ flex: "1 1 200px" }}>
          <label>AMBIENTE DEL ERP ORIGEN</label>
          <select
            value={selectedEnv}
            onChange={(e) => setSelectedEnv(e.target.value as any)}
            disabled={syncing}
            className={styles.inputField}
            style={{ border: "1px solid var(--color-brand-accent)", fontWeight: "700" }}
          >
            <option value="PROD">Producción (ERP Real)</option>
            <option value="PRUEBAS">Pruebas (Puerto 8020)</option>
          </select>
        </div>

        <div className={styles.formGroup} style={{ flex: "1 1 150px" }}>
          <label>FECHA INICIO</label>
          <DatePicker value={startDate} onChange={setStartDate} disabled={syncing} />
        </div>

        <div className={styles.formGroup} style={{ flex: "1 1 150px" }}>
          <label>FECHA FIN</label>
          <DatePicker value={endDate} onChange={setEndDate} disabled={syncing} />
        </div>
      </div>

      {/* Estado de cobertura del staging: hasta que dia hay datos y que dias faltan */}
      <div style={{ marginBottom: "1.5rem", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>ESTADO DEL STAGING ({startDate} al {endDate})</strong>
          <Button onClick={verificarCobertura} disabled={verificando || syncing} className={styles.iconActionBtn}>
            {verificando ? "Verificando..." : "Volver a verificar"}
          </Button>
        </div>

        {errorCobertura && (
          <p style={{ fontSize: "0.85rem", color: "var(--color-danger, #c0392b)", margin: 0 }}>{errorCobertura}</p>
        )}

        {!errorCobertura && cobertura.length === 0 && (
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: 0 }}>
            {verificando ? "Consultando cobertura..." : "Sin información de cobertura."}
          </p>
        )}

        <div style={{ display: "grid", gap: "0.5rem" }}>
          {cobertura.map((c, i) => {
            const completo = c.dias_faltantes.length === 0 && !c.error;
            // Solo las tablas diarias tienen que estar completas; en las esporadicas
            // (liquidaciones, ATS) un dia sin registros es normal y no es un hueco.
            const esAlerta = !completo && !c.error && c.frecuencia === "diaria";
            const colorBorde = c.error ? "#c0392b" : completo ? "#2e7d32" : esAlerta ? "#e67e22" : "var(--color-border)";
            return (
              <motion.div
                key={c.tipo}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: "easeOut" }}
                whileHover={{ x: 2 }}
                style={{
                  display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem",
                  padding: "0.5rem 0.75rem", borderRadius: "6px",
                  borderLeft: `4px solid ${colorBorde}`,
                  background: "var(--color-bg-subtle, rgba(0,0,0,0.03))",
                }}
              >
                <strong style={{ minWidth: "110px", fontSize: "0.85rem" }}>
                  {ETIQUETAS_TIPO[c.tipo] || c.tipo}
                </strong>

                {c.error ? (
                  <span style={{ fontSize: "0.8rem", color: "var(--color-danger, #c0392b)" }}>Error: {c.error}</span>
                ) : (
                  <>
                    <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                      Sincronizado hasta <strong>{c.ultimo_dia_sincronizado || "sin datos"}</strong>
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                      {c.dias_con_datos}/{c.dias_esperados} días · {c.filas_en_rango.toLocaleString()} filas
                    </span>
                    {completo ? (
                      <span style={{ fontSize: "0.8rem", color: "#2e7d32", fontWeight: 700 }}>Sin huecos</span>
                    ) : esAlerta ? (
                      <span style={{ fontSize: "0.8rem", color: "#e67e22", fontWeight: 700 }}>
                        Faltan {c.dias_faltantes.length} día(s): {agruparEnRangos(c.dias_faltantes).join(" · ")}
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                        {c.dias_faltantes.length} día(s) sin registros (normal: no ocurre todos los días)
                      </span>
                    )}
                    {esAlerta && (
                      <Button
                        onClick={() => {
                          const orden = [...c.dias_faltantes].sort();
                          setStartDate(orden[0]);
                          setEndDate(orden[orden.length - 1]);
                          addLog(`Rango ajustado al hueco de ${ETIQUETAS_TIPO[c.tipo] || c.tipo}: ${orden[0]} a ${orden[orden.length - 1]}. Ejecuta la sincronización de ese tipo.`);
                        }}
                        disabled={syncing}
                        className={styles.iconActionBtn}
                        title="Ajustar el rango de fechas al hueco detectado"
                      >
                        Usar este rango
                      </Button>
                    )}
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Botonera de Acción */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {[
          { type: "movimientos" as const, label: "Sincronizar Movimientos", color: "var(--color-brand-primary)" },
          { type: "liquidaciones" as const, label: "Sincronizar Liquidaciones", color: "var(--color-accent-violet)" },
          { type: "ats" as const, label: "Sincronizar ATS", color: "var(--color-warning)" },
          { type: "ventas" as const, label: "Sincronizar Ventas", color: "var(--color-brand-accent)" },
          // Escribe en el schema `kpi`, no en el staging de Ventas/Rentabilidad.
          { type: "kpi" as const, label: "Sincronizar KPI", color: "var(--color-accent-violet)" },
        ].map((b) => (
          <motion.button
            key={b.type}
            type="button"
            onClick={() => handleSync(b.type)}
            disabled={syncing}
            className={styles.submitBtn}
            style={{ background: b.color, flex: "1 1 180px", border: "none" }}
            whileHover={syncing ? undefined : { y: -2, boxShadow: "0 8px 18px rgba(0,0,0,0.18)" }}
            whileTap={syncing ? undefined : { scale: 0.97 }}
          >
            {b.label}
          </motion.button>
        ))}
      </div>

      {/* Indicadores de Progreso */}
      <AnimatePresence>
        {(syncing || logs.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{ background: "var(--color-surface-zebra)", border: "1px solid var(--color-border)", borderRadius: "10px", padding: "1.25rem", marginBottom: "1rem", overflow: "hidden" }}
          >
          {syncing && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.45rem" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Procesando: <strong style={{ color: "var(--color-brand-primary)" }}>{currentDateProcessing}</strong>
                </span>
                <span style={{ color: "var(--color-brand-primary)" }}>{currentProgress}%</span>
              </div>
              <SegmentedProgressBar pct={currentProgress} color="var(--color-brand-primary)" />
              {estTimeRemaining !== null && (
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.45rem" }}>
                  Tiempo estimado restante: <strong>{estTimeRemaining} segundos</strong>
                </p>
              )}
            </div>
          )}

          {/* Consola de logs */}
          <div
            style={{
              background: "var(--color-text-primary)",
              color: "#38bdf8",
              fontFamily: "Courier New, monospace",
              padding: "1rem",
              borderRadius: "8px",
              height: "220px",
              overflowY: "auto",
              fontSize: "0.80rem",
              border: "1px solid var(--color-text-secondary)",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6)"
            }}
          >
            {logs.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>Esperando inicio de proceso de sincronización...</p>
            ) : (
              logs.map((l, index) => {
                let color = "#38bdf8"; // cyan
                if (l.includes("[ERROR]")) color = "#f87171"; // red
                if (l.includes("[OK]")) color = "#4ade80"; // green
                if (l.includes(">>>")) color = "#facc15"; // yellow
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ color, marginBottom: "0.25rem" }}
                  >
                    {l}
                  </motion.div>
                );
              })
            )}
            <div ref={consoleEndRef} />
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};
