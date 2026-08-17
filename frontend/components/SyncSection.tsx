import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface SyncSectionProps {
  styles: any;
}

interface CoberturaTipo {
  tipo: string;
  tabla: string;
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

  const handleSync = async (type: "movimientos" | "liquidaciones" | "ats" | "ventas") => {
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
      ventas: "Reporte de Ventas"
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
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={syncing}
            className={styles.inputField}
          />
        </div>

        <div className={styles.formGroup} style={{ flex: "1 1 150px" }}>
          <label>FECHA FIN</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={syncing}
            className={styles.inputField}
          />
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
          {cobertura.map((c) => {
            const completo = c.dias_faltantes.length === 0 && !c.error;
            return (
              <div
                key={c.tipo}
                style={{
                  display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem",
                  padding: "0.5rem 0.75rem", borderRadius: "6px",
                  borderLeft: `4px solid ${completo ? "#2e7d32" : "#e67e22"}`,
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
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "#e67e22", fontWeight: 700 }}>
                        Faltan {c.dias_faltantes.length} día(s): {agruparEnRangos(c.dias_faltantes).join(" · ")}
                      </span>
                    )}
                    {!completo && (
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Botonera de Acción */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <Button
          onClick={() => handleSync("movimientos")}
          disabled={syncing}
          className={styles.submitBtn}
          style={{ background: "var(--color-brand-primary)", flex: "1 1 180px" }}
        >
          Sincronizar Movimientos
        </Button>
        <Button
          onClick={() => handleSync("liquidaciones")}
          disabled={syncing}
          className={styles.submitBtn}
          style={{ background: "var(--color-accent-violet)", flex: "1 1 180px" }}
        >
          Sincronizar Liquidaciones
        </Button>
        <Button
          onClick={() => handleSync("ats")}
          disabled={syncing}
          className={styles.submitBtn}
          style={{ background: "var(--color-warning)", flex: "1 1 180px" }}
        >
          Sincronizar ATS
        </Button>
        <Button
          onClick={() => handleSync("ventas")}
          disabled={syncing}
          className={styles.submitBtn}
          style={{ background: "var(--color-brand-accent)", flex: "1 1 180px" }}
        >
          Sincronizar Ventas
        </Button>
      </div>

      {/* Indicadores de Progreso */}
      {(syncing || logs.length > 0) && (
        <div style={{ background: "var(--color-surface-zebra)", border: "1px solid var(--color-border)", borderRadius: "10px", padding: "1.25rem", marginBottom: "1rem" }}>
          {syncing && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.45rem" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Procesando: <strong style={{ color: "var(--color-brand-primary)" }}>{currentDateProcessing}</strong>
                </span>
                <span style={{ color: "var(--color-brand-primary)" }}>{currentProgress}%</span>
              </div>
              <div className={styles.branchProgressBarBg} style={{ height: "10px", borderRadius: "5px" }}>
                <div
                  className={styles.branchProgressBarFill}
                  style={{ width: `${currentProgress}%`, height: "100%", borderRadius: "5px" }}
                ></div>
              </div>
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
                  <div key={index} style={{ color, marginBottom: "0.25rem" }}>
                    {l}
                  </div>
                );
              })
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
      )}
    </Card>
  );
};
