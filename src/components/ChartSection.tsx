import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AccessChart from "./AccessChart";
import type { AccessStatsResponse, RangeOption } from "../types";
import { parseMetaTime } from "../utils/time";

type ChartSectionProps = {
  theme: "light" | "dark";
  onMetaChange?: (meta: {
    latestSampleLabel: string;
    cacheSize: number;
  }) => void;
};

type CacheItem = {
  data: AccessStatsResponse;
  loadedAt: number;
};

const DEFAULT_RANGE_SEC = 7 * 24 * 60 * 60;
const MIN_RANGE_SEC = 60;
const RANGE_OPTIONS: RangeOption[] = [
  { id: "1h", label: "1H", seconds: 60 * 60 },
  { id: "1d", label: "1D", seconds: 24 * 60 * 60 },
  { id: "7d", label: "7D", seconds: DEFAULT_RANGE_SEC },
  { id: "30d", label: "30D", seconds: 30 * 24 * 60 * 60 },
];

const BIN_SEC: number | null = null;
const API_ENDPOINT = `${import.meta.env.VITE_API_PATH}/access`;

function makeCacheKey(
  endTimeEpochMs: number,
  rangeSec: number,
  binSec: number | null,
) {
  const binLabel = binSec ?? "default";
  return `${Math.round(endTimeEpochMs)}:${Math.round(rangeSec)}:${binLabel}`;
}

const ChartSection = ({ theme, onMetaChange }: ChartSectionProps) => {
  const [selectedRangeSec, setSelectedRangeSec] = useState(DEFAULT_RANGE_SEC);
  const [rangeSec, setRangeSec] = useState(DEFAULT_RANGE_SEC);
  const [endTime, setEndTime] = useState(() => Date.now());
  const [chartData, setChartData] = useState<AccessStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [availableRange, setAvailableRange] = useState<{
    min?: number;
    max?: number;
  }>({});

  const cacheRef = useRef(new Map<string, CacheItem>());
  const inFlightRef = useRef(new Map<string, Promise<AccessStatsResponse>>());
  const requestIdRef = useRef(0);
  const zoomDebounceRef = useRef<number | null>(null);

  const dateTimeFormat = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const rangeStart = endTime - rangeSec * 1000;
  const minRangeMs = MIN_RANGE_SEC * 1000;
  const maxRangeMs = Math.max(minRangeMs, selectedRangeSec * 1000);
  const axisMin = availableRange.min ?? chartData?.bins?.[0];
  const latestBin = chartData?.bins?.length
    ? chartData.bins[chartData.bins.length - 1]
    : undefined;
  const axisMax = availableRange.max ?? latestBin;

  const seriesData = useMemo(() => {
    const merged = new Map<number, number>();
    for (const cached of cacheRef.current.values()) {
      cached.data.bins.forEach((bin, index) => {
        merged.set(bin, cached.data.total?.[index] ?? 0);
      });
    }
    return Array.from(merged.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bin, value]) => [bin, value] as [number, number]);
  }, []);

  const windowSeriesData = useMemo(() => {
    if (!chartData?.bins?.length) {
      return [] as [number, number][];
    }
    return chartData.bins.map((bin, index) => [
      bin,
      chartData.total?.[index] ?? 0,
    ]);
  }, [chartData]);

  const allRangeSec = useMemo(() => {
    if (availableRange.min == null || availableRange.max == null) {
      return null;
    }
    const diffSec = Math.round(
      (availableRange.max - availableRange.min) / 1000,
    );
    return diffSec > 0 ? diffSec : null;
  }, [availableRange]);

  const rangeOptions = useMemo(() => {
    if (!allRangeSec) {
      return RANGE_OPTIONS;
    }
    return [
      ...RANGE_OPTIONS,
      { id: "all", label: "ALL", seconds: allRangeSec },
    ];
  }, [allRangeSec]);

  const fetchStats = useCallback(
    async (targetEndTime: number, targetRangeSec: number) => {
      const cacheKey = makeCacheKey(targetEndTime, targetRangeSec, BIN_SEC);
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        return cached.data;
      }

      const inFlight = inFlightRef.current.get(cacheKey);
      if (inFlight) {
        return inFlight;
      }

      const url = new URL(API_ENDPOINT, window.location.origin);
      url.searchParams.set("endTimeEpochMs", `${Math.round(targetEndTime)}`);
      url.searchParams.set("rangeSec", `${Math.round(targetRangeSec)}`);
      if (BIN_SEC && BIN_SEC > 0) {
        url.searchParams.set("binSec", `${BIN_SEC}`);
      }

      const request = fetch(url.toString()).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const data = (await response.json()) as AccessStatsResponse;
        if (!Array.isArray(data.bins) || !Array.isArray(data.total)) {
          throw new Error("Unexpected response shape.");
        }
        const normalizedCountsByType = data.countsByType
          ? Object.fromEntries(
              Object.entries(data.countsByType).map(([key, values]) => [
                key,
                Array.isArray(values)
                  ? values.map((value) => Number(value))
                  : [],
              ]),
            )
          : undefined;
        const normalized: AccessStatsResponse = {
          ...data,
          bins: data.bins.map((value) => Number(value)),
          total: data.total.map((value) => Number(value)),
          countsByType: normalizedCountsByType,
        };
        cacheRef.current.set(cacheKey, {
          data: normalized,
          loadedAt: Date.now(),
        });
        setCacheVersion((value) => value + 1);
        return normalized;
      });

      inFlightRef.current.set(cacheKey, request);
      try {
        return await request;
      } finally {
        inFlightRef.current.delete(cacheKey);
      }
    },
    [],
  );

  const prefetchAdjacent = useCallback(
    async (
      targetEndTime: number,
      targetRangeSec: number,
      data: AccessStatsResponse | null,
    ) => {
      if (!targetRangeSec) {
        return;
      }
      const rangeMs = targetRangeSec * 1000;
      const currentStart = targetEndTime - rangeMs;
      const availableMin =
        parseMetaTime(data?.meta?.availableMin) ?? availableRange.min;
      const availableMax =
        parseMetaTime(data?.meta?.availableMax) ?? availableRange.max;
      const prevEnd = currentStart;
      const nextEnd = targetEndTime + rangeMs;

      const canPrefetchPrev =
        availableMin == null || prevEnd - rangeMs >= availableMin;
      const canPrefetchNext = availableMax == null || nextEnd <= availableMax;

      if (canPrefetchPrev) {
        fetchStats(prevEnd, targetRangeSec).catch(() => undefined);
      }
      if (canPrefetchNext) {
        fetchStats(nextEnd, targetRangeSec).catch(() => undefined);
      }
    },
    [availableRange, fetchStats],
  );

  const loadRange = useCallback(
    async (targetEndTime: number, targetRangeSec: number) => {
      const requestId = ++requestIdRef.current;
      const cacheKey = makeCacheKey(targetEndTime, targetRangeSec, BIN_SEC);
      const cached = cacheRef.current.get(cacheKey);

      if (cached) {
        setChartData(cached.data);
        setError(null);
      }

      setLoading(!cached);
      try {
        const data =
          cached?.data ?? (await fetchStats(targetEndTime, targetRangeSec));
        if (requestId !== requestIdRef.current) {
          return;
        }
        setChartData(data);
        setError(null);
        const metaMin = parseMetaTime(data.meta?.availableMin);
        const metaMax = parseMetaTime(data.meta?.availableMax);
        if (Number.isFinite(metaMin) && Number.isFinite(metaMax)) {
          setAvailableRange((prev) => {
            if (prev.min === metaMin && prev.max === metaMax) {
              return prev;
            }
            return { min: metaMin as number, max: metaMax as number };
          });
        }
        void prefetchAdjacent(targetEndTime, targetRangeSec, data);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to load chart data.";
        setError(message);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [fetchStats, prefetchAdjacent],
  );

  useEffect(() => {
    loadRange(endTime, rangeSec);
  }, [endTime, rangeSec, loadRange]);

  useEffect(() => {
    return () => {
      if (zoomDebounceRef.current) {
        window.clearTimeout(zoomDebounceRef.current);
      }
    };
  }, []);

  const handleRangeClick = (option: RangeOption) => {
    const targetEnd =
      option.id === "all" && availableRange.max
        ? availableRange.max
        : Date.now();
    setSelectedRangeSec(option.seconds);
    setRangeSec(option.seconds);
    setEndTime(targetEnd);
  };

  const handleZoomRange = useCallback(
    (startMs: number, endMs: number) => {
      const rawRangeSec = Math.round((endMs - startMs) / 1000);
      const boundedRangeSec = Math.min(
        Math.max(rawRangeSec, MIN_RANGE_SEC),
        selectedRangeSec,
      );
      const nextRangeSec =
        rawRangeSec < MIN_RANGE_SEC
          ? Math.min(rangeSec, selectedRangeSec)
          : boundedRangeSec;
      const nextEndTime = Math.round(startMs + nextRangeSec * 1000);

      if (
        Math.abs(nextEndTime - endTime) < 1000 &&
        Math.abs(nextRangeSec - rangeSec) < 1
      ) {
        return;
      }

      if (zoomDebounceRef.current) {
        window.clearTimeout(zoomDebounceRef.current);
      }

      zoomDebounceRef.current = window.setTimeout(() => {
        setRangeSec(nextRangeSec);
        setEndTime(nextEndTime);
      }, 250);
    },
    [endTime, rangeSec, selectedRangeSec],
  );

  const latestSample = chartData?.bins?.length
    ? chartData.bins[chartData.bins.length - 1]
    : null;
  const rangeStartLabel = dateTimeFormat.format(new Date(rangeStart));
  const rangeEndLabel = dateTimeFormat.format(new Date(endTime));
  const latestSampleLabel = latestSample
    ? dateTimeFormat.format(new Date(latestSample))
    : "--";

  useEffect(() => {
    if (!onMetaChange) {
      return;
    }
    onMetaChange({
      latestSampleLabel,
      cacheSize: cacheRef.current.size,
    });
  }, [cacheVersion, latestSampleLabel, onMetaChange]);

  return (
    <section className="section fade-in delay-1">
      <div className="panel-header">
        <div>
          <h2 className="section-title">Access activity</h2>
          <p className="section-subtitle">
            Pan or zoom to request more data. Previously loaded ranges pop in
            immediately.
          </p>
        </div>
        <div className="panel-actions">
          <div className="range-buttons">
            {rangeOptions.map((option) => {
              const isActive =
                option.id === "all" && allRangeSec
                  ? Math.abs(selectedRangeSec - allRangeSec) < 2
                  : selectedRangeSec === option.seconds;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`range-button${isActive ? " active" : ""}`}
                  onClick={() => handleRangeClick(option)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="range-meta">
            <span>{rangeStartLabel}</span>
            <span>to</span>
            <span>{rangeEndLabel}</span>
          </div>
        </div>
      </div>
      <div className="chart-shell">
        <AccessChart
          seriesData={seriesData}
          rangeStart={rangeStart}
          endTime={endTime}
          axisMin={axisMin}
          axisMax={axisMax}
          minRangeMs={minRangeMs}
          maxRangeMs={maxRangeMs}
          dateTimeFormat={dateTimeFormat}
          theme={theme}
          onZoomRange={handleZoomRange}
        />
        {loading && (
          <div className="chart-overlay">
            <div className="spinner" aria-label="Loading chart" />
          </div>
        )}
        {!loading && error && <div className="chart-overlay">{error}</div>}
        {!loading && !error && windowSeriesData.length === 0 && (
          <div className="chart-overlay">No data yet</div>
        )}
      </div>
    </section>
  );
};

export default ChartSection;
