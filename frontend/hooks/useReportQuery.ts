import { useState, useCallback, useRef } from "react";

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

export interface UseReportQueryResult {
  loading: boolean;
  queryProgress: number;
  estTimeRemaining: number | null;
  currentQueryingDate: string;
  data: any[];
  error: string | null;
  fetchReportData: (reportId: string, startDate: string, endDate: string) => Promise<void>;
  cancelQuery: () => void;
  setData: (data: any[]) => void;
  setError: (error: string | null) => void;
  setQueryProgress: (progress: number) => void;
  setEstTimeRemaining: (sec: number | null) => void;
  setLoading: (loading: boolean) => void;
}

export function useReportQuery(): UseReportQueryResult {
  const [loading, setLoading] = useState(false);
  const [queryProgress, setQueryProgress] = useState(0);
  const [estTimeRemaining, setEstTimeRemaining] = useState<number | null>(null);
  const [currentQueryingDate, setCurrentQueryingDate] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Un ref y no un state: cancelQuery necesita el controller vigente sin
  // esperar a un re-render, y no hay nada en pantalla que dependa de su valor.
  const abortRef = useRef<AbortController | null>(null);

  const fetchReportData = useCallback(async (reportId: string, startDate: string, endDate: string) => {
    // Corta cualquier consulta anterior todavia en vuelo: sin esto, pedir un
    // rango, arrepentirse y pedir otro dejaba las dos corriendo a la vez y la
    // que terminara despues pisaba los datos de la otra.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setData([]);
    setQueryProgress(0);
    setCurrentQueryingDate("");
    setEstTimeRemaining(null);

    try {
      const dates = getDatesInRange(startDate, endDate);
      const totalDays = dates.length;
      const accumulatedData: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < totalDays; i++) {
        const currentDate = dates[i];
        setCurrentQueryingDate(currentDate);

        const progressPercent = Math.round((i / totalDays) * 100);
        setQueryProgress(progressPercent);

        if (i > 0) {
          const elapsed = Date.now() - startTime;
          const avgPerDay = elapsed / i;
          const remainingDays = totalDays - i;
          const estSeconds = Math.round((avgPerDay * remainingDays) / 1000);
          setEstTimeRemaining(estSeconds);
        }

        const res = await fetch(`/api/data/${reportId}?inicio=${currentDate}&fin=${currentDate}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error consultando datos del día ${currentDate}`);
        }
        const dayJson = await res.json();
        if (Array.isArray(dayJson)) {
          accumulatedData.push(...dayJson);
        }
      }

      setQueryProgress(100);
      setEstTimeRemaining(0);
      setData(accumulatedData);
    } catch (err: any) {
      // Cancelado a proposito: no es un error, se limpia en silencio.
      if (err.name === "AbortError") {
        setData([]);
      } else {
        setError(err.message || "Error al obtener la información desde el ERP.");
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  const cancelQuery = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    loading,
    queryProgress,
    estTimeRemaining,
    currentQueryingDate,
    data,
    error,
    fetchReportData,
    cancelQuery,
    setData,
    setError,
    setQueryProgress,
    setEstTimeRemaining,
    setLoading
  };
}
