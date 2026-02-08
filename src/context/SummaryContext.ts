import { createContext } from "react";
import type { SummaryStatsResponse } from "../types";

export type SummaryContextValue = {
  summary: SummaryStatsResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshSignal: number;
  refresh: () => Promise<void>;
};

export const SummaryContext = createContext<SummaryContextValue | null>(null);
