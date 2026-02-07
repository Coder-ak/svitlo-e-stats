export function parseMetaTime(
  value: string | undefined | null,
): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toEpochMs(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function normalizeZoomRange(
  startValue: number | undefined,
  endValue: number | undefined,
): { startMs: number; endMs: number } | null {
  if (startValue == null || endValue == null) return null;
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) return null;
  if (startValue >= endValue) return null;
  return { startMs: startValue, endMs: endValue };
}

/**
 * Determine optimal bin size based on time range
 */
export function getOptimalBinSec(rangeSec: number): number {
  if (rangeSec <= 6 * 60 * 60) {
    // ≤ 6 hours: 1-minute bins
    return 60;
  } else if (rangeSec <= 3 * 24 * 60 * 60) {
    // ≤ 3 days: 5-minute bins
    return 5 * 60;
  } else if (rangeSec <= 14 * 24 * 60 * 60) {
    // ≤ 14 days: 15-minute bins
    return 15 * 60;
  } else if (rangeSec <= 60 * 24 * 60 * 60) {
    // ≤ 60 days: 1-hour bins
    return 60 * 60;
  } else {
    // > 60 days: 4-hour bins
    return 4 * 60 * 60;
  }
}
