import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FC } from "react";
import type { SummaryStatsResponse } from "../types";

const SUMMARY_ENDPOINT = `${import.meta.env.VITE_API_PATH}/total`;

const TYPE_LABELS: Record<string, string> = {
  na: "Unknown",
  cl: "Chat /light",
  cs: "Chat /schedule",
  ql: "Query light",
  qs: "Query schedule",
  qi: "Query info",
};

function buildSummaryUrl(refresh: boolean) {
  const url = new URL(SUMMARY_ENDPOINT, window.location.origin);
  if (refresh) {
    url.searchParams.set("refresh", "true");
  }
  return url.toString();
}

const TotalsSection: FC = () => {
  const [summary, setSummary] = useState<SummaryStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const loadSummary = useCallback(
    async (refresh: boolean) => {
      const requestId = ++requestIdRef.current;
      if (refresh) {
        setLoading(true);
        setError(null);
      }
      try {
        const response = await fetch(buildSummaryUrl(refresh));
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
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadSummary(false);

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadSummary]);

  const handleRefresh = useCallback(() => {
    void loadSummary(true);
  }, [loadSummary]);

  const dateTimeCompact = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const availableMin = summary?.availableMin
    ? Date.parse(summary.availableMin)
    : null;
  const availableMax = summary?.availableMax
    ? Date.parse(summary.availableMax)
    : null;
  const generatedAtValue = summary?.generatedAt
    ? Date.parse(summary.generatedAt)
    : null;
  const totalDays =
    availableMin && availableMax
      ? Math.max(
          1,
          Math.ceil((availableMax - availableMin) / (24 * 60 * 60 * 1000)),
        )
      : null;
  const totalByTypeRows = useMemo(() => {
    const entries = summary?.totalByType
      ? Object.entries(summary.totalByType)
      : [];
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({
        key,
        label: TYPE_LABELS[key] ?? key.toUpperCase(),
        value,
      }));
  }, [summary]);
  const generatedAtLabel = Number.isFinite(generatedAtValue)
    ? dateTimeCompact.format(new Date(generatedAtValue as number))
    : "--";

  return (
    <section className="section totals-section fade-in">
      <div className="totals-bar">
        <div className="totals-head">
          <div>
            <p className="eyebrow">Access dashboard</p>
            <h1 className="totals-title">Total coverage</h1>
          </div>
          <div className="totals-actions">
            {error ? <span className="totals-error">{error}</span> : null}
            <button
              type="button"
              className="totals-refresh"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
        <div className="totals-meta">
          <div className="totals-aside">
            <p className="eyebrow">Summary guide</p>
            <p>
              This panel shows all-time coverage and totals. Use the chart
              slider below to inspect specific time windows.
            </p>
            <p>
              Totals include user and group activity, plus a type breakdown to
              spot which surfaces drive most traffic.
            </p>
          </div>
          <div className="meta-card">
            <div className="meta-label">Totals</div>
            {loading ? (
              <div className="totals-card-loading">
                <div
                  className="spinner spinner-small"
                  aria-label="Loading totals"
                />
              </div>
            ) : (
              <>
                <div className="meta-value meta-value-strong">
                  {summary?.totalHits?.toLocaleString("en-GB") ?? "--"}
                </div>
                <div className="meta-sub">all access hits</div>
                <ul className="kv-list">
                  <li className="kv-item">
                    <span className="kv-label">Total days</span>
                    <span className="kv-value">
                      {totalDays ? `${totalDays}` : "--"}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Start</span>
                    <span className="kv-value">
                      {availableMin
                        ? dateTimeCompact.format(new Date(availableMin))
                        : "--"}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">End</span>
                    <span className="kv-value">
                      {availableMax
                        ? dateTimeCompact.format(new Date(availableMax))
                        : "--"}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Cached at</span>
                    <span className="kv-value">{generatedAtLabel}</span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Unique users</span>
                    <span className="kv-value">
                      {summary?.uniqueUsers?.toLocaleString("en-GB") ?? "--"}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Unique groups</span>
                    <span className="kv-value">
                      {summary?.uniqueGroups?.toLocaleString("en-GB") ?? "--"}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">User hits</span>
                    <span className="kv-value">
                      {summary?.totalUserHits?.toLocaleString("en-GB") ?? "--"}
                    </span>
                  </li>
                  <li className="kv-item">
                    <span className="kv-label">Group hits</span>
                    <span className="kv-value">
                      {summary?.totalGroupHits?.toLocaleString("en-GB") ?? "--"}
                    </span>
                  </li>
                </ul>
              </>
            )}
          </div>
          <div className="meta-card">
            <div className="meta-label">By type</div>
            {loading ? (
              <div className="totals-card-loading">
                <div
                  className="spinner spinner-small"
                  aria-label="Loading types"
                />
              </div>
            ) : (
              <div className="table">
                <div className="table-header">
                  <span>Query Type</span>
                  <span>Total Users</span>
                </div>
                {totalByTypeRows.map((row) => (
                  <div key={row.key} className="table-row">
                    <span>{row.label}</span>
                    <span>{row.value.toLocaleString("en-GB")}</span>
                  </div>
                ))}
                {totalByTypeRows.length === 0 ? (
                  <div className="table-row">
                    <span>--</span>
                    <span>--</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TotalsSection;
