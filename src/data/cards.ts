import type { CardItem } from "../types";

export const CARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "r0", label: "Р0 (1-11)" },
  { id: "r1", label: "Р1-Р2 (12-24)" },
];

export const CARD_SETS: Record<string, CardItem[]> = {
  overview: [
    {
      id: "overview-traffic",
      title: "Traffic snapshot",
      type: "kv",
      items: [
        { label: "Total hits", value: "12,480" },
        { label: "Unique chats", value: "2,130" },
        { label: "Peak hour", value: "18:00" },
      ],
    },
    {
      id: "overview-commands",
      title: "Top commands",
      type: "table",
      table: {
        headers: ["Command", "Count"],
        rows: [
          ["/start", "4,120"],
          ["/stats", "2,870"],
          ["/help", "1,960"],
        ],
      },
    },
    {
      id: "overview-segments",
      title: "Segments",
      type: "kv",
      items: [
        { label: "Returning", value: "62%" },
        { label: "New", value: "38%" },
        { label: "Avg. session", value: "3m 12s" },
      ],
    },
  ],
  r0: [
    {
      id: "r0-sessions",
      title: "Morning run",
      type: "kv",
      items: [
        { label: "06-09", value: "1,240" },
        { label: "09-11", value: "1,980" },
        { label: "Short hops", value: "74%" },
      ],
    },
    {
      id: "r0-rooms",
      title: "Active rooms",
      type: "table",
      table: {
        headers: ["Room", "Hits"],
        rows: [
          ["Lobby", "620"],
          ["Updates", "540"],
          ["Support", "390"],
        ],
      },
    },
    {
      id: "r0-latency",
      title: "Latency",
      type: "kv",
      items: [
        { label: "Median", value: "180ms" },
        { label: "p95", value: "420ms" },
        { label: "Timeouts", value: "0.6%" },
      ],
    },
  ],
  r1: [
    {
      id: "r1-evening",
      title: "Evening run",
      type: "kv",
      items: [
        { label: "12-18", value: "2,310" },
        { label: "18-24", value: "2,890" },
        { label: "Long sessions", value: "41%" },
      ],
    },
    {
      id: "r1-topics",
      title: "Top topics",
      type: "table",
      table: {
        headers: ["Topic", "Hits"],
        rows: [
          ["Alerts", "740"],
          ["Reports", "610"],
          ["Exports", "520"],
        ],
      },
    },
    {
      id: "r1-stability",
      title: "Stability",
      type: "kv",
      items: [
        { label: "Errors", value: "0.9%" },
        { label: "Retries", value: "2.4%" },
        { label: "Drops", value: "0.2%" },
      ],
    },
  ],
};
