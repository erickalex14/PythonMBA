import React, { useState, useRef, useEffect } from "react";

interface SyncSectionProps {
  styles: any;
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
        if (type === "movimientos") {
          details = `${result.records_count || 0} movimientos de inventario`;
        } else if (type === "liquidaciones") {
          details = `${result.cabeceras_count || 0} liquidaciones, ${result.productos_count || 0} partidas`;
        } else if (type === "ats") {
          details = `${result.facturas_count || 0} facturas, ${result.fiscal_count || 0} registros fiscales`;
        } else if (type === "ventas") {
          // Ambos tablas
          details = `${result.records_count || 0} movimientos transaccionados`;
        }

        addLog(`[OK] Día ${currentDate} sincronizado con éxito (${details}).`);
      }

      setCurrentProgress(100);
      setEstTimeRemaining(0);
      addLog(`>>> PROCESO FINALIZADO CON ÉXITO: 100% COMPLETADO <<<`);
      addLog(`La tabla de staging local ya se encuentra al día con el ERP.`);
    } catch (err: any) {
      addLog(`>>> [FALLO DE PROCESO] Sincronización abortada: ${err.message} <<<`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={styles.adminCard} style={{ marginTop: "1rem" }}>
      <h3 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "0.50rem", color: "#005DAA" }}>
        Sincronización Manual del ERP
      </h3>
      <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.50rem 0 1.25rem 0" }}>
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
            style={{ border: "1px solid #70b92b", fontWeight: "700" }}
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

      {/* Botonera de Acción */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <button
          onClick={() => handleSync("movimientos")}
          disabled={syncing}
          className={styles.submitBtn}
          style={{ background: "#005DAA", flex: "1 1 180px" }}
        >
          Sincronizar Movimientos
        </button>
        <button
          onClick={() => handleSync("liquidaciones")}
          disabled={syncing}
          className={styles.submitBtn}
          style={{ background: "#7c3aed", flex: "1 1 180px" }}
        >
          Sincronizar Liquidaciones
        </button>
        <button
          onClick={() => handleSync("ats")}
          disabled={syncing}
          className={styles.submitBtn}
          style={{ background: "#f59e0b", flex: "1 1 180px" }}
        >
          Sincronizar ATS
        </button>
        <button
          onClick={() => handleSync("ventas")}
          disabled={syncing}
          className={styles.submitBtn}
          style={{ background: "#70b92b", flex: "1 1 180px" }}
        >
          Sincronizar Ventas
        </button>
      </div>

      {/* Indicadores de Progreso */}
      {(syncing || logs.length > 0) && (
        <div style={{ background: "#fafafa", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem", marginBottom: "1rem" }}>
          {syncing && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.45rem" }}>
                <span style={{ color: "#334155" }}>
                  Procesando: <strong style={{ color: "#005DAA" }}>{currentDateProcessing}</strong>
                </span>
                <span style={{ color: "#005DAA" }}>{currentProgress}%</span>
              </div>
              <div className={styles.branchProgressBarBg} style={{ height: "10px", borderRadius: "5px" }}>
                <div
                  className={styles.branchProgressBarFill}
                  style={{ width: `${currentProgress}%`, height: "100%", borderRadius: "5px" }}
                ></div>
              </div>
              {estTimeRemaining !== null && (
                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.45rem" }}>
                  Tiempo estimado restante: <strong>{estTimeRemaining} segundos</strong>
                </p>
              )}
            </div>
          )}

          {/* Consola de logs */}
          <div
            style={{
              background: "#0f172a",
              color: "#38bdf8",
              fontFamily: "Courier New, monospace",
              padding: "1rem",
              borderRadius: "8px",
              height: "220px",
              overflowY: "auto",
              fontSize: "0.80rem",
              border: "1px solid #334155",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6)"
            }}
          >
            {logs.length === 0 ? (
              <p style={{ color: "#64748b" }}>Esperando inicio de proceso de sincronización...</p>
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
    </div>
  );
};
