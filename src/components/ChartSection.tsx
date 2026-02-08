import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AccessChart from "./AccessChart";
import type {
  AccessStatsResponse,
  LightStatusEvent,
  LightStatusInterval,
  RangeOption,
  SummaryStatsResponse,
} from "../types";
import { parseMetaTime, getOptimalBinSec } from "../utils/time";

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

type LightStatusTrack = {
  area: number;
  label: string;
  intervals: LightStatusInterval[];
};

const MIN_RANGE_SEC = 60;
const MIN_RANGE_RATIO = 1 / 7;
const AXIS_WINDOW_MULTIPLIER = 7;
const MAX_CACHE_SIZE = 20;

const RANGE_OPTIONS: RangeOption[] = [
  { id: "1h", label: "1H", seconds: 60 * 60, binSec: 60 },
  { id: "1d", label: "1D", seconds: 24 * 60 * 60, binSec: 5 * 60 },
  { id: "7d", label: "7D", seconds: 7 * 24 * 60 * 60, binSec: 5 * 60 },
  { id: "30d", label: "30D", seconds: 30 * 24 * 60 * 60, binSec: 15 * 60 },
];

const DEFAULT_OPTION = RANGE_OPTIONS.find((opt) => opt.id === "7d")!;
const API_ENDPOINT = `${import.meta.env.VITE_API_PATH}/access`;
const SUMMARY_ENDPOINT = `${import.meta.env.VITE_API_PATH}/total`;
const LIGHT_STATUS_ENDPOINT = "/api/v1/light-bot";
const LIGHT_STATUS_AREAS = [0, 1] as const;

function makeCacheKey(
  endTimeEpochMs: number,
  rangeSec: number,
  binSec: number,
) {
  return `${Math.round(endTimeEpochMs)}:${Math.round(rangeSec)}:${binSec}`;
}

function buildSummaryUrl() {
  return new URL(SUMMARY_ENDPOINT, window.location.origin).toString();
}

function buildLightStatusUrl(startTime: number, endTime: number) {
  const url = new URL(LIGHT_STATUS_ENDPOINT, window.location.origin);
  url.searchParams.set("startTime", `${Math.round(startTime)}`);
  url.searchParams.set("endTime", `${Math.round(endTime)}`);
  return url.toString();
}

const ChartSection = ({ theme, onMetaChange }: ChartSectionProps) => {
  const [selectedOption, setSelectedOption] = useState(DEFAULT_OPTION);
  const [zoomLimitSec, setZoomLimitSec] = useState(DEFAULT_OPTION.seconds);
  const [endTime, setEndTime] = useState(() => Date.now());
  const [chartData, setChartData] = useState<AccessStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableRange, setAvailableRange] = useState<{
    min?: number;
    max?: number;
  }>({});
  const [cachedData, setCachedData] = useState<Map<string, CacheItem>>(
    new Map(),
  );
  const [summaryRange, setSummaryRange] = useState<{
    min?: number;
    max?: number;
  }>({});
  const [lightStatusEvents, setLightStatusEvents] = useState<LightStatusEvent[]>(
    [],
  );

  const cacheRef = useRef(new Map<string, CacheItem>());
  const inFlightRef = useRef(new Map<string, Promise<AccessStatsResponse>>());
  const requestIdRef = useRef(0);
  const zoomDebounceRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);
  const [lightStatusLoadedKey, setLightStatusLoadedKey] = useState<
    string | null
  >(null);

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

  useEffect(() => {
    let isCancelled = false;

    const loadSummaryRange = async () => {
      try {
        const response = await fetch(buildSummaryUrl());
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as SummaryStatsResponse;
        if (isCancelled) {
          return;
        }
        const min = parseMetaTime(data.availableMin);
        const max = parseMetaTime(data.availableMax);
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
          return;
        }
        setSummaryRange({
          min: min as number,
          max: max as number,
        });
      } catch {
        // ignore summary range fetch errors and fallback to access metadata.
      }
    };

    void loadSummaryRange();

    return () => {
      isCancelled = true;
    };
  }, []);

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
      {
        id: "all",
        label: "ALL",
        seconds: allRangeSec,
        binSec: getOptimalBinSec(allRangeSec),
      },
    ];
  }, [allRangeSec]);

  const rangeSec = selectedOption.seconds;
  const binSec = selectedOption.binSec;
  const rangeStart = endTime - rangeSec * 1000;
  const xAxisLabelMode =
    selectedOption.id === "all"
      ? "date"
      : rangeSec <= 60 * 60
        ? "time"
        : "datetime";
  const minRangeSec = Math.min(
    zoomLimitSec,
    Math.max(MIN_RANGE_SEC, Math.round(zoomLimitSec * MIN_RANGE_RATIO)),
  );
  const minRangeMs = minRangeSec * 1000;
  const maxRangeMs = zoomLimitSec * 1000;

  const latestBin = chartData?.bins?.length
    ? chartData.bins[chartData.bins.length - 1]
    : undefined;
  const axisWindowMs = zoomLimitSec * AXIS_WINDOW_MULTIPLIER * 1000;
  const fallbackAxisMax = latestBin ?? endTime;
  const axisMax = availableRange.max ?? fallbackAxisMax;
  const axisMin =
    availableRange.min ?? Math.max(0, axisMax - axisWindowMs);
  const lightStatusFetchRange = useMemo(() => {
    const startMs = summaryRange.min ?? availableRange.min;
    const endMs = summaryRange.max ?? availableRange.max;
    if (startMs == null || endMs == null || endMs <= startMs) {
      return null;
    }
    return { startMs, endMs };
  }, [availableRange.max, availableRange.min, summaryRange.max, summaryRange.min]);

  const seriesData = useMemo(() => {
    const dataByType: Record<string, Map<number, number>> = {};

    const allTypes = new Set<string>();
    for (const cached of cachedData.values()) {
      if (cached.data.meta?.types) {
        cached.data.meta.types.forEach((type) => allTypes.add(type));
      }
    }

    allTypes.forEach((type) => {
      dataByType[type] = new Map();
    });

    for (const cached of cachedData.values()) {
      const { bins, countsByType } = cached.data;

      Object.entries(countsByType).forEach(([type, values]) => {
        if (!dataByType[type]) {
          dataByType[type] = new Map();
        }

        bins.forEach((bin, index) => {
          const value = values[index] ?? 0;
          const existing = dataByType[type].get(bin) ?? 0;
          dataByType[type].set(bin, existing + value);
        });
      });
    }

    const result: Record<string, [number, number][]> = {};

    Object.entries(dataByType).forEach(([type, map]) => {
      result[type] = Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([bin, value]) => [bin, value]);
    });

    return result;
  }, [cachedData]);

  // Filter series data to visible range for better Y-axis scaling
  const visibleSeriesData = useMemo(() => {
    const filtered: Record<string, [number, number][]> = {};

    Object.entries(seriesData).forEach(([type, data]) => {
      filtered[type] = data.filter(
        ([bin]) => bin >= rangeStart && bin <= endTime,
      );
    });

    return filtered;
  }, [seriesData, rangeStart, endTime]);

  const types = useMemo(() => {
    const allTypes = new Set<string>();

    if (chartData?.meta?.types) {
      chartData.meta.types.forEach((type) => allTypes.add(type));
    }

    for (const cached of cachedData.values()) {
      if (cached.data.meta?.types) {
        cached.data.meta.types.forEach((type) => allTypes.add(type));
      }
    }

    const typeOrder = ["cl", "cs", "ql", "qs", "qi", "na"];
    return Array.from(allTypes).sort((a, b) => {
      const indexA = typeOrder.indexOf(a);
      const indexB = typeOrder.indexOf(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [chartData, cachedData]);

  const lightStatusTracks = useMemo<LightStatusTrack[]>(() => {
    const byArea = new Map<number, LightStatusEvent[]>();
    lightStatusEvents.forEach((event) => {
      const existing = byArea.get(event.area);
      if (existing) {
        existing.push(event);
      } else {
        byArea.set(event.area, [event]);
      }
    });

    return LIGHT_STATUS_AREAS.map((area) => {
      const events = byArea.get(area) ?? [];
        const compacted: LightStatusEvent[] = [];

        events.forEach((event) => {
          const previous = compacted[compacted.length - 1];
          if (previous && previous.light === event.light) {
            return;
          }
          compacted.push(event);
        });

        const intervals: LightStatusInterval[] = compacted
          .map((event, index) => {
            const next = compacted[index + 1];
            const startMs = event.timestamp;
            const endMs =
              next?.timestamp ?? lightStatusFetchRange?.endMs ?? endTime;
            return {
              light: event.light,
              area: event.area,
              startMs,
              endMs,
            };
          })
          .filter((interval) => interval.endMs > interval.startMs);

        return {
          area,
          label: `R${area}`,
          intervals,
        };
      });
  }, [endTime, lightStatusEvents, lightStatusFetchRange]);

  const evictOldestCache = useCallback(() => {
    if (cacheRef.current.size <= MAX_CACHE_SIZE) {
      return;
    }

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    cacheRef.current.forEach((item, key) => {
      if (item.loadedAt < oldestTime) {
        oldestTime = item.loadedAt;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      cacheRef.current.delete(oldestKey);
      setCachedData(new Map(cacheRef.current));
    }
  }, []);

  const fetchStats = useCallback(
    async (
      targetEndTime: number,
      targetRangeSec: number,
      targetBinSec: number,
    ) => {
      const cacheKey = makeCacheKey(
        targetEndTime,
        targetRangeSec,
        targetBinSec,
      );
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        return cached.data;
      }

      const inFlight = inFlightRef.current.get(cacheKey);
      if (inFlight) {
        return inFlight;
      }

      const url = new URL(API_ENDPOINT, window.location.origin);
      url.searchParams.set("endTime", `${Math.round(targetEndTime)}`);
      url.searchParams.set("rangeSec", `${Math.round(targetRangeSec)}`);
      url.searchParams.set("binInterval", `${targetBinSec}`);

      const request = fetch(url.toString()).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const data = (await response.json()) as AccessStatsResponse;
        if (!Array.isArray(data.bins)) {
          throw new Error("Unexpected response shape.");
        }

        const normalized: AccessStatsResponse = {
          ...data,
          bins: data.bins.map((value) => Number(value)),
          total: data.total.map((value) => Number(value)),
          countsByType: Object.fromEntries(
            Object.entries(data.countsByType).map(([key, values]) => [
              key,
              values.map((value) => Number(value)),
            ]),
          ),
        };

        cacheRef.current.set(cacheKey, {
          data: normalized,
          loadedAt: Date.now(),
        });

        evictOldestCache();
        setCachedData(new Map(cacheRef.current));
        return normalized;
      });

      inFlightRef.current.set(cacheKey, request);
      try {
        return await request;
      } finally {
        inFlightRef.current.delete(cacheKey);
      }
    },
    [evictOldestCache],
  );

  const prefetchAdjacent = useCallback(
    async (
      targetEndTime: number,
      targetRangeSec: number,
      targetBinSec: number,
      data: AccessStatsResponse | null,
    ) => {
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
        fetchStats(prevEnd, targetRangeSec, targetBinSec).catch(
          () => undefined,
        );
      }
      if (canPrefetchNext) {
        fetchStats(nextEnd, targetRangeSec, targetBinSec).catch(
          () => undefined,
        );
      }
    },
    [availableRange, fetchStats],
  );

  const loadRange = useCallback(
    async (
      targetEndTime: number,
      targetRangeSec: number,
      targetBinSec: number,
    ) => {
      const requestId = ++requestIdRef.current;
      const cacheKey = makeCacheKey(
        targetEndTime,
        targetRangeSec,
        targetBinSec,
      );
      const cached = cacheRef.current.get(cacheKey);

      if (cached) {
        setChartData(cached.data);
        setError(null);
      }

      setLoading(!cached);
      try {
        const data =
          cached?.data ??
          (await fetchStats(targetEndTime, targetRangeSec, targetBinSec));
        if (requestId !== requestIdRef.current) {
          return;
        }
        setChartData(data);
        setError(null);
        isInitialLoadRef.current = false;

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

        void prefetchAdjacent(
          targetEndTime,
          targetRangeSec,
          targetBinSec,
          data,
        );
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
    loadRange(endTime, rangeSec, binSec);
  }, [endTime, rangeSec, binSec, loadRange]);

  useEffect(() => {
    if (!lightStatusFetchRange) {
      return;
    }
    const requestKey = `${lightStatusFetchRange.startMs}:${lightStatusFetchRange.endMs}`;
    if (lightStatusLoadedKey === requestKey) {
      return;
    }
    let isCancelled = false;

    const loadLightStatus = async () => {
      try {
        const response = await fetch(
          buildLightStatusUrl(
            lightStatusFetchRange.startMs,
            lightStatusFetchRange.endMs,
          ),
        );
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = (await response.json()) as LightStatusEvent[];
        if (!Array.isArray(data) || isCancelled) {
          return;
        }

        const normalized = data
          .map((item) => ({
            light: Boolean(item.light),
            area: Number(item.area),
            timestamp: Number(item.timestamp),
          }))
          .filter(
            (item) => Number.isFinite(item.area) && Number.isFinite(item.timestamp),
          )
          .sort((left, right) =>
            left.area === right.area
              ? left.timestamp - right.timestamp
              : left.area - right.area,
          );

        if (isCancelled) {
          return;
        }
        setLightStatusEvents(normalized);
        setLightStatusLoadedKey(requestKey);
      } catch {
        if (isCancelled) {
          return;
        }
        setLightStatusEvents([]);
        setLightStatusLoadedKey(null);
      }
    };

    void loadLightStatus();

    return () => {
      isCancelled = true;
    };
  }, [lightStatusFetchRange, lightStatusLoadedKey]);

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
    setSelectedOption(option);
    setZoomLimitSec(option.seconds);
    setEndTime(targetEnd);
    isInitialLoadRef.current = false;
  };

  const handleZoomRange = useCallback(
    (startMs: number, endMs: number) => {
      if (isInitialLoadRef.current) {
        return;
      }

      const actualStart = Math.min(startMs, endMs);
      const actualEnd = Math.max(startMs, endMs);

      const rawRangeSec = Math.round((actualEnd - actualStart) / 1000);
      const stickyRangeToleranceSec = Math.max(
        2,
        Math.round(selectedOption.seconds * 0.01),
      );
      const effectiveRawRangeSec =
        Math.abs(rawRangeSec - selectedOption.seconds) <=
        stickyRangeToleranceSec
          ? selectedOption.seconds
          : rawRangeSec;

      const boundedRangeSec = Math.max(
        Math.min(effectiveRawRangeSec, zoomLimitSec),
        minRangeSec,
      );

      const rangeDiff = effectiveRawRangeSec - boundedRangeSec;
      const nextEndTime =
        rangeDiff !== 0
          ? Math.round(actualStart + boundedRangeSec * 1000)
          : Math.round(actualEnd);

      if (
        Math.abs(nextEndTime - endTime) < 1000 &&
        Math.abs(boundedRangeSec - rangeSec) < 1
      ) {
        return;
      }

      if (zoomDebounceRef.current) {
        window.clearTimeout(zoomDebounceRef.current);
      }

      zoomDebounceRef.current = window.setTimeout(() => {
        const matchedOption = rangeOptions.find(
          (option) => Math.abs(option.seconds - boundedRangeSec) <= 1,
        );
        if (matchedOption) {
          setSelectedOption(matchedOption);
          setZoomLimitSec(matchedOption.seconds);
        } else if (Math.abs(boundedRangeSec - selectedOption.seconds) > 1) {
          setSelectedOption({
            id: "custom",
            label: "Custom",
            seconds: boundedRangeSec,
            binSec: selectedOption.binSec,
          });
        }
        setEndTime(nextEndTime);
      }, 250);
    },
    [
      endTime,
      minRangeSec,
      rangeOptions,
      rangeSec,
      selectedOption,
      zoomLimitSec,
    ],
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
  }, [cachedData, latestSampleLabel, onMetaChange]);

  const hasData = Object.values(visibleSeriesData).some(
    (data) => data.length > 0,
  );

  return (
    <section className="section fade-in delay-1">
      <div className="panel-header">
        <div>
          <h2 className="section-title">Access activity</h2>
          <p className="section-subtitle">
            Stacked area chart showing all access types. Click legend to toggle
            types. Pan or zoom to explore data.
          </p>
        </div>
        <div className="panel-actions">
          <div className="range-buttons">
            {rangeOptions.map((option) => {
              const isActive = selectedOption.id === option.id;
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
            <span>Selected interval:</span>
            <span>{rangeStartLabel}</span>
            <span>–</span>
            <span>{rangeEndLabel}</span>
          </div>
        </div>
      </div>
      <div className="chart-shell">
        <AccessChart
          seriesData={visibleSeriesData}
          types={types}
          lightStatusTracks={lightStatusTracks}
          rangeStart={rangeStart}
          endTime={endTime}
          xAxisLabelMode={xAxisLabelMode}
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
        {!loading && !error && !hasData && (
          <div className="chart-overlay">No data yet</div>
        )}
      </div>
    </section>
  );
};

export default ChartSection;
