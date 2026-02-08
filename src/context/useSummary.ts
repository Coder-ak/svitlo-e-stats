import { useContext } from "react";
import { SummaryContext } from "./SummaryContext";

export function useSummary() {
  const context = useContext(SummaryContext);
  if (!context) {
    throw new Error("useSummary must be used within SummaryProvider.");
  }
  return context;
}
