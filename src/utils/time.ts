export function formatRangeLabel(rangeSec: number) {
  if (rangeSec >= 86400) {
    return `${Math.round(rangeSec / 86400)}d`;
  }
  if (rangeSec >= 3600) {
    return `${Math.round(rangeSec / 3600)}h`;
  }
  if (rangeSec >= 60) {
    return `${Math.round(rangeSec / 60)}m`;
  }
  return `${Math.round(rangeSec)}s`;
}

export function parseMetaTime(value?: string) {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toEpochMs(value: unknown) {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeZoomRange(startMs?: number, endMs?: number) {
  if (startMs == null || endMs == null) {
    return undefined;
  }
  return startMs <= endMs
    ? { startMs, endMs }
    : { startMs: endMs, endMs: startMs };
}
