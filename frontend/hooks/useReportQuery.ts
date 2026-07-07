import { useState, useCallback } from "react";

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

  const fetchReportData = useCallback(async (reportId: string, startDate: string, endDate: string) => {
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

        const res = await fetch(`/api/data/${reportId}?inicio=${currentDate}&fin=${currentDate}`);
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
      setError(err.message || "Error al obtener la información desde el ERP.");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    queryProgress,
    estTimeRemaining,
    currentQueryingDate,
    data,
    error,
    fetchReportData,
    setData,
    setError,
    setQueryProgress,
    setEstTimeRemaining,
    setLoading
  };
}
