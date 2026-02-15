export type AccessStatsResponse = {
  meta: {
    startTime: string;
    endTime: string;
    rangeSec: number;
    binSec: number;
    types: string[];
    availableMin: string;
    availableMax: string;
    generatedAt: string;
  };
  bins: number[];
  countsByType: Record<string, number[]>;
  total: number[];
};

export type RangeOption = {
  id: string;
  label: string;
  seconds: number;
  binSec: number;
};

export type SummaryStatsResponse = {
  availableMin: string;
  availableMax: string;
  generatedAt?: string;
  totalHits: number;
  totalByType: Record<string, number>;
  uniqueUsers: number;
  uniqueGroups: number;
  totalUserHits: number;
  totalGroupHits: number;
};

export type LightStatusEvent = {
  light: boolean;
  timestamp: number;
  area: number;
};

export type LightStatusInterval = {
  light: boolean;
  area: number;
  startMs: number;
  endMs: number;
};

export type CardItem = {
  id: string;
  title: string;
  type: "kv" | "table";
  items?: { label: string; value: string }[];
  table?: { headers: string[]; rows: string[][] };
};

export type DayCountPoint = {
  date: string;
  count: number;
};

export type TypeMaxDailyRow = {
  type: string;
  last7d?: DayCountPoint | null;
  allTime?: DayCountPoint | null;
};

export type OutageInfo = {
  start: number;
  end: number;
  durationSec: number;
};

export type GlobalInsights = {
  maxRequestsDayAllTime?: DayCountPoint | null;
  maxRequestsDayLast7d?: DayCountPoint | null;
  maxDailyByType?: TypeMaxDailyRow[] | null;
  combinedOffDurationSec?: number | null;
};

export type AreaInsights = {
  totalOffDurationSec?: number | null;
  longestOutageSec?: number | null;
  outagesTotal?: number | null;
  lastOutage?: OutageInfo | null;
  uptimePct?: number | null;
  outagesLast7d?: number | null;
  avgOutagesPerWeekAllTime?: number | null;
  avgOutageSecAllTime?: number | null;
  avgOutageSecLast7d?: number | null;
  avgOutageSecLast30d?: number | null;
  medianOutageSecAllTime?: number | null;
};

export type CardsInsightsResponse = {
  range?: {
    startTime: number;
    endTime: number;
  };
  global?: GlobalInsights | null;
  areas?: {
    r0?: AreaInsights | null;
    r1?: AreaInsights | null;
    [key: string]: AreaInsights | null | undefined;
  } | null;
};
