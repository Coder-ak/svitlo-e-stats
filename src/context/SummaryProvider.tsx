import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SummaryStatsResponse } from "../types";
import { SummaryContext } from "./SummaryContext";
import type { SummaryContextValue } from "./SummaryContext";

const SUMMARY_ENDPOINT = `${import.meta.env.VITE_API_PATH}/total`;

function buildSummaryUrl(refresh: boolean) {
  const url = new URL(SUMMARY_ENDPOINT, window.location.origin);
  if (refresh) {
    url.searchParams.set("refresh", "true");
  }
  return url.toString();
}

export function SummaryProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<SummaryStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const requestIdRef = useRef(0);

  const loadSummary = useCallback(async (forceRefresh: boolean) => {
    const requestId = ++requestIdRef.current;
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(buildSummaryUrl(forceRefresh));
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = (await response.json()) as SummaryStatsResponse;
      if (requestId !== requestIdRef.current) {
        return;
      }
      setSummary(data);
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      const message =
        err instanceof Error ? err.message : "Failed to load summary.";
      setError(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadSummary(false);

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadSummary]);

  const refresh = useCallback(async () => {
    setRefreshSignal((prev) => prev + 1);
    await loadSummary(true);
  }, [loadSummary]);

  const value = useMemo<SummaryContextValue>(
    () => ({
      summary,
      loading,
      refreshing,
      error,
      refreshSignal,
      refresh,
    }),
    [summary, loading, refreshing, error, refreshSignal, refresh],
  );

  return (
    <SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>
  );
}
