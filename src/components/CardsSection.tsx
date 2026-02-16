import { useEffect, useMemo, useRef, useState } from "react";
import type { FC } from "react";
import { TYPE_LABELS } from "../const/typeLabels";
import { useSummary } from "../context/useSummary";
import type {
  AreaInsights,
  CardsInsightsResponse,
  DayCountPoint,
  OutageInfo,
  TypeMaxDailyRow,
} from "../types";
import { resolveApiEndpoint } from "../utils/api";

const CARDS_INSIGHTS_ENDPOINT = `${import.meta.env.VITE_API_PATH}/insights`;
const AREA_TABS = [
  { id: "r0", label: "R0" },
  { id: "r1", label: "R1 – R2" },
] as const;

type AreaTabId = (typeof AREA_TABS)[number]["id"];

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "--";
  }
  return value.toLocaleString("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
}

function formatDurationHuman(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) {
    return "--";
  }
  const safeSeconds = Math.max(0, Math.round(seconds));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function formatDurationSummary(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) {
    return "--";
  }
  const human = formatDurationHuman(seconds);
  const hours = `${Math.round(seconds / 3600).toLocaleString("en-GB")}h`;
  const secs = `${Math.round(seconds).toLocaleString("en-GB")}s`;
  return `${human} (${hours} | ${secs})`;
}

function formatDateLabel(
  dateValue: string | number | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (dateValue == null) {
    return "--";
  }

  if (typeof dateValue === "string") {
    const parsed = new Date(`${dateValue}T12:00:00Z`).getTime();
    if (Number.isFinite(parsed)) {
      return formatter.format(new Date(parsed));
    }
    return dateValue;
  }

  if (!Number.isFinite(dateValue)) {
    return "--";
  }

  return formatter.format(new Date(dateValue));
}

function formatDayCount(
  point: DayCountPoint | null | undefined,
  dateFormatter: Intl.DateTimeFormat,
) {
  if (!point) {
    return "--";
  }
  return `${formatDateLabel(point.date, dateFormatter)} (${formatNumber(point.count)})`;
}

function formatOutageRange(
  outage: OutageInfo | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!outage) {
    return "--";
  }
  const start = formatDateLabel(outage.start, formatter);
  const end = formatDateLabel(outage.end, formatter);
  return `${start} - ${end}`;
}

function normalizeTypeRows(rows: TypeMaxDailyRow[] | null | undefined) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.filter((row) => row && typeof row.type === "string");
}

function getAreaInsights(
  insights: CardsInsightsResponse | null,
  areaId: AreaTabId,
): AreaInsights | null {
  const area = insights?.areas?.[areaId];
  return area ?? null;
}

const CardsSection: FC = () => {
  const { refreshSignal } = useSummary();
  const [activeTab, setActiveTab] = useState<AreaTabId>(AREA_TABS[0].id);
  const [insights, setInsights] = useState<CardsInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const hasInsightsRef = useRef(false);

  const dayDateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );

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
    const requestId = ++requestIdRef.current;
    const hasCachedInsights = hasInsightsRef.current;

    if (hasCachedInsights) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    const loadInsights = async () => {
      try {
        const response = await fetch(
          resolveApiEndpoint(CARDS_INSIGHTS_ENDPOINT),
        );
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = (await response.json()) as CardsInsightsResponse;
        if (requestId !== requestIdRef.current) {
          return;
        }

        setInsights(data);
        hasInsightsRef.current = true;
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to load cards insights.";
        setError(message);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadInsights();

    return () => {
      requestIdRef.current += 1;
    };
  }, [refreshSignal]);

  const globalInsights = insights?.global ?? null;
  const areaInsights = getAreaInsights(insights, activeTab);
  const maxByTypeRows = normalizeTypeRows(globalInsights?.maxDailyByType);
  const showOverlay = loading || refreshing;
  const rangeLabel = useMemo(() => {
    const range = insights?.range;
    if (!range) {
      return "--";
    }
    const start = formatDateLabel(range.startTime, dateTimeFormat);
    const end = formatDateLabel(range.endTime, dateTimeFormat);
    return `${start} - ${end}`;
  }, [dateTimeFormat, insights?.range]);

  return (
    <section className="section fade-in delay-2">
      <div className="panel-header">
        <div>
          <h2 className="section-title">Insights</h2>
          <p className="section-subtitle">
            Key metrics for request load and outage trends.
          </p>
        </div>
        <div className="panel-actions cards-panel-actions">
          {error ? <span className="cards-error">{error}</span> : null}
          <span className="cards-range">Range: {rangeLabel}</span>
        </div>
      </div>

      <div className="cards-shell">
        <div className="cards-grid cards-grid-insights">
          <div className="cards-global-column">
            <div className="card">
              <h3 className="card-title">Global load and outages</h3>
              <ul className="kv-list">
                <li className="kv-item">
                  <span className="kv-label">Max requests (All)</span>
                  <span className="kv-value">
                    {formatDayCount(
                      globalInsights?.maxRequestsDayAllTime,
                      dayDateFormat,
                    )}
                  </span>
                </li>
                <li className="kv-item">
                  <span className="kv-label">Max requests (7d)</span>
                  <span className="kv-value">
                    {formatDayCount(
                      globalInsights?.maxRequestsDayLast7d,
                      dayDateFormat,
                    )}
                  </span>
                </li>
                <li className="kv-item kv-item-stack">
                  <span className="kv-label">Total off duration</span>
                  <span className="kv-value">
                    {formatDurationSummary(
                      globalInsights?.combinedOffDurationSec,
                    )}
                  </span>
                </li>
              </ul>
              <div className="insights-table">
                <div className="insights-table-row insights-table-header">
                  <span>Type</span>
                  <span>Max day (7d)</span>
                  <span>Max day (all)</span>
                </div>
                {maxByTypeRows.length === 0 ? (
                  <div className="insights-table-row">
                    <span>--</span>
                    <span>--</span>
                    <span>--</span>
                  </div>
                ) : (
                  maxByTypeRows.map((row) => (
                    <div key={row.type} className="insights-table-row">
                      <span>
                        {TYPE_LABELS[row.type] ?? row.type.toUpperCase()}
                      </span>
                      <span>{formatDayCount(row.last7d, dayDateFormat)}</span>
                      <span>{formatDayCount(row.allTime, dayDateFormat)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="cards-tab-panel">
            <div className="cards-tabs-row">
              <div className="tabs tabs-segmented">
                {AREA_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`tab-button${activeTab === tab.id ? " active" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div key={activeTab} className="cards-tab-content">
              <div className="card card-area">
                <h3 className="card-title">Outage impact</h3>
                <ul className="kv-list">
                  <li className="kv-item kv-item-stack">
                    <span className="kv-label">Total off duration</span>
                    <span className="kv-value">
                      {formatDurationSummary(areaInsights?.totalOffDurationSec)}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Longest outage</span>
                    <span className="kv-value">
                      {formatDurationHuman(areaInsights?.longestOutageSec)}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Outages total</span>
                    <span className="kv-value">
                      {formatNumber(areaInsights?.outagesTotal)}
                    </span>
                  </li>
                  <li className="kv-item kv-item-stack">
                    <span className="kv-label">Last outage</span>
                    <span className="kv-value">
                      {formatOutageRange(
                        areaInsights?.lastOutage,
                        dateTimeFormat,
                      )}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Last outage duration</span>
                    <span className="kv-value">
                      {formatDurationHuman(
                        areaInsights?.lastOutage?.durationSec,
                      )}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Uptime</span>
                    <span className="kv-value">
                      {formatPercent(areaInsights?.uptimePct)}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="card card-area">
                <h3 className="card-title">Outage tempo</h3>
                <ul className="kv-list">
                  <li className="kv-item">
                    <span className="kv-label">Outages last 7d</span>
                    <span className="kv-value">
                      {formatNumber(areaInsights?.outagesLast7d)}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Avg outages/week (all)</span>
                    <span className="kv-value">
                      {formatNumber(areaInsights?.avgOutagesPerWeekAllTime, 1)}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Avg outage (all)</span>
                    <span className="kv-value">
                      {formatDurationHuman(areaInsights?.avgOutageSecAllTime)}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Avg outage (7d)</span>
                    <span className="kv-value">
                      {formatDurationHuman(areaInsights?.avgOutageSecLast7d)}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Avg outage (30d)</span>
                    <span className="kv-value">
                      {formatDurationHuman(areaInsights?.avgOutageSecLast30d)}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Median outage</span>
                    <span className="kv-value">
                      {formatDurationHuman(
                        areaInsights?.medianOutageSecAllTime,
                      )}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {showOverlay ? (
          <div className="overlay">
            <div className="spinner spinner-small" aria-label="Loading" />
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default CardsSection;
