import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SummaryStatsResponse } from "../types";
import { SummaryContext } from "./SummaryContext";
import type { SummaryContextValue } from "./SummaryContext";
import { API_ROOT } from "../utils/api";

const SUMMARY_ENDPOINT = `${API_ROOT}/stats/total`;

function buildSummaryUrl(refresh: boolean) {
  const url = new URL(SUMMARY_ENDPOINT);
  if (refresh) {
    url.searchParams.set("refresh", "true");
  }
  return url.toString();
}

async function fetchSummary(forceRefresh: boolean) {
  const response = await fetch(buildSummaryUrl(forceRefresh));
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as SummaryStatsResponse;
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
    try {
      const data = await fetchSummary(forceRefresh);
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
    const requestId = ++requestIdRef.current;
    const loadInitialSummary = async () => {
      try {
        const data = await fetchSummary(false);
        if (requestId === requestIdRef.current) {
          setSummary(data);
        }
      } catch (err) {
        if (requestId === requestIdRef.current) {
          const message =
            err instanceof Error ? err.message : "Failed to load summary.";
          setError(message);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    void loadInitialSummary();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadSummary]);

  const refresh = useCallback(async () => {
    setRefreshSignal((prev) => prev + 1);
    setRefreshing(true);
    setError(null);
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
