export type AccessStatsResponse = {
  meta?: {
    availableMin?: string;
    availableMax?: string;
    totalHits?: number;
  };
  bins: number[];
  countsByType?: Record<string, number[]>;
  total: number[];
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

export type RangeOption = {
  id: string;
  label: string;
  seconds: number;
};

export type CardItem = {
  id: string;
  title: string;
  type: "kv" | "table";
  items?: { label: string; value: string }[];
  table?: { headers: string[]; rows: string[][] };
};
