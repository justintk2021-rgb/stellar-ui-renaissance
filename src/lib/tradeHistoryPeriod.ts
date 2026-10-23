import { startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subHours } from "date-fns";
import { parseLocalDateKey } from "@/lib/tradeFormat";

export type HistoryPeriod =
  | "today"
  | "thisWeek"
  | "thisMonth"
  | "thisYear"
  | "last24h"
  | "last7d"
  | "last30d"
  | "all";

export const PERIOD_OPTIONS: { value: HistoryPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "thisWeek", label: "This week" },
  { value: "thisMonth", label: "This month" },
  { value: "thisYear", label: "This year" },
  { value: "last24h", label: "Last 24 hours" },
  { value: "last7d", label: "Last 7 days" },
  { value: "last30d", label: "Last 30 days" },
  { value: "all", label: "All" },
];

/** Inclusive lower bound for the selected history window. `null` means All. */
export function getPeriodStart(period: HistoryPeriod, now: Date = new Date()): Date | null {
  switch (period) {
    case "all":
      return null;
    case "today":
      return startOfDay(now);
    case "thisWeek":
      return startOfWeek(now, { weekStartsOn: 1 });
    case "thisMonth":
      return startOfMonth(now);
    case "thisYear":
      return startOfYear(now);
    case "last24h":
      return subHours(now, 24);
    case "last7d":
      return subDays(now, 7);
    case "last30d":
      return subDays(now, 30);
  }
}

type HistoryTrade = {
  closeTime?: string | null;
  openTime?: string | null;
  date?: string | null;
};

/** Close time, then open time, then the local date key at midnight. */
export function getTradeHistoryTime(trade: HistoryTrade): number | null {
  for (const raw of [trade.closeTime, trade.openTime]) {
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  const key = (trade.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const local = parseLocalDateKey(key);
  return Number.isNaN(local.getTime()) ? null : local.getTime();
}

export function tradeMatchesHistoryPeriod(
  trade: HistoryTrade,
  period: HistoryPeriod,
  now: Date = new Date(),
): boolean {
  const start = getPeriodStart(period, now);
  if (!start) return true;
  const time = getTradeHistoryTime(trade);
  if (time == null) return false;
  return time >= start.getTime() && time <= now.getTime();
}
