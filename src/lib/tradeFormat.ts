import { Trade } from "@/types/trade";

/**
 * Shared helpers used by the Dashboard PnL Calendar, Journal Trade Log, and
 * Journal Mini Calendar so they ALWAYS bucket trades by the same local date
 * and display the same P&L value down to the cent.
 *
 * Two classes of bug this prevents:
 *   1) Off-by-one-day: parsing a UTC ISO string into a Date and then formatting
 *      it back to a string can shift the day in negative-UTC timezones. We
 *      instead extract the local YYYY/MM/DD components directly.
 *   2) Off-by-one-cent: rounding each leg before summing produces different
 *      totals than summing raw values then rounding once. We truncate (NOT
 *      round) the final sum to match the Dashboard's existing display.
 */

/** Format a Date as YYYY-MM-DD using its LOCAL components. */
export const formatLocalDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/**
 * Resolve the bucket date for a trade using its open timestamp in the user's
 * local timezone. Falls back to `trade.date` (manual entries) when openTime
 * is missing or invalid.
 */
export const getTradeLocalDateKey = (trade: Trade): string => {
  if (trade.openTime) {
    const d = new Date(trade.openTime);
    if (!isNaN(d.getTime())) return formatLocalDateKey(d);
  }
  return (trade.date || "").slice(0, 10);
};

/** Resolve the close/exit bucket date in the user's local timezone. */
export const getTradeCloseLocalDateKey = (trade: Trade): string => {
  if (trade.closeTime) {
    const d = new Date(trade.closeTime);
    if (!isNaN(d.getTime())) return formatLocalDateKey(d);
  }
  return getTradeLocalDateKey(trade);
};

/** True when entry and exit fall on the same local calendar day. */
export const isSameDayEntryExit = (trade: Trade): boolean => {
  if (!trade.openTime && !trade.closeTime) return true;
  const openKey = getTradeLocalDateKey(trade);
  const closeKey = getTradeCloseLocalDateKey(trade);
  return !!openKey && !!closeKey && openKey === closeKey;
};

/** True when a trade opened and closed on different local calendar days. */
export const isMultiDayTrade = (trade: Trade): boolean => !isSameDayEntryExit(trade);

/**
 * Parse a YYYY-MM-DD key as a LOCAL Date (not UTC). Using `new Date("2025-04-07")`
 * parses as UTC midnight which can shift to the previous day when displayed via
 * `toLocaleDateString` in negative-UTC zones — this helper avoids that.
 */
export const parseLocalDateKey = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Set by useBrokerDayPnL — broker_trade_history realized P/L per position. */
let brokerPlByPositionCache: Map<string, number> | null = null;

export function setBrokerPlByPositionCache(map: Map<string, number> | null): void {
  brokerPlByPositionCache = map;
}

/**
 * P&L for a trade as the broker reports it (broker history / today gross).
 * TradeLocker journal rows prefer synced broker_trade_history over inflated result.
 */
export const getTradeNetResult = (trade: Trade): number => {
  const posId = trade.brokerPositionId;
  if (
    trade.importedFromBroker &&
    posId &&
    brokerPlByPositionCache?.has(posId)
  ) {
    return brokerPlByPositionCache.get(posId)!;
  }

  const base = trade.result || 0;
  if (!trade.importedFromBroker) return base;

  const broker = trade.brokerName || "";
  const swap = trade.swap ?? 0;
  const commission = trade.commission ?? 0;
  const fees = swap + commission;

  if (
    fees !== 0 &&
    (broker === "TradeLocker" ||
      broker === "MetaTrader 5" ||
      broker === "MT5")
  ) {
    const withFees = base + fees;
    if (Math.abs(withFees) > Math.abs(base)) return withFees;
  }

  return base;
};

/** Drop duplicate broker journal rows (same position synced more than once). */
export const dedupeTradesForPnL = (trades: Trade[]): Trade[] => {
  const manual: Trade[] = [];
  const byPosition = new Map<string, Trade>();

  for (const trade of trades) {
    const posId = trade.brokerPositionId;
    if (!trade.importedFromBroker || !posId) {
      manual.push(trade);
      continue;
    }
    const prev = byPosition.get(posId);
    const prevAt = prev?.lastBrokerSyncAt || "";
    const nextAt = trade.lastBrokerSyncAt || "";
    if (!prev || nextAt >= prevAt) {
      byPosition.set(posId, trade);
    }
  }

  return [...manual, ...byPosition.values()];
};

export type BrokerTodayPnL = {
  net: number;
  syncedAt: string | null;
};

/** Local calendar day bounds for sync/reconcile (browser timezone). */
export const getClientDayBoundsISO = (): {
  dateKey: string;
  start: string;
  end: string;
} => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return {
    dateKey: formatLocalDateKey(now),
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

/** Build per-day P&L keyed by local close date (broker gross when available). */
export const buildDailyPnLMap = (
  trades: Trade[],
  brokerToday?: BrokerTodayPnL | null,
  brokerDayTotals?: Map<string, number> | null,
): Map<string, number> => {
  const map = new Map<string, number>();
  const deduped = dedupeTradesForPnL(trades);

  for (const trade of deduped) {
    const key = getTradeCloseLocalDateKey(trade);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + getTradeNetResult(trade));
  }

  // Broker history totals (TradeLocker gross per day) override journal sums.
  if (brokerDayTotals?.size) {
    for (const [day, pnl] of brokerDayTotals) {
      map.set(day, pnl);
    }
  }

  const todayKey = formatLocalDateKey(new Date());
  if (brokerToday != null && Number.isFinite(brokerToday.net)) {
    map.set(todayKey, brokerToday.net);
  }

  return map;
};

/** Sum net trade P&L at full precision. Always sum first, round/truncate later. */
export const sumPnL = (trades: Trade[]): number =>
  dedupeTradesForPnL(trades).reduce((acc, t) => acc + getTradeNetResult(t), 0);

/**
 * Per-trade P&L for UI when the day total was overridden (e.g. broker today gross).
 * Scales each trade proportionally so rows sum to `dayPnL`.
 */
export const getTradesDisplayPnL = (
  trades: Trade[],
  dayPnL: number,
): Map<string, number> => {
  const deduped = dedupeTradesForPnL(trades);
  const map = new Map<string, number>();
  if (!deduped.length) return map;

  const rawSum = deduped.reduce((s, t) => s + getTradeNetResult(t), 0);
  if (Math.abs(rawSum) < 1e-9 || Math.abs(rawSum - dayPnL) < 0.01) {
    deduped.forEach((t) => map.set(t.id, getTradeNetResult(t)));
    return map;
  }

  const scale = dayPnL / rawSum;
  deduped.forEach((t) => map.set(t.id, getTradeNetResult(t) * scale));
  return map;
};

/**
 * Format a P&L value the same way the Dashboard calendar does: truncate (not
 * round) to two decimals so the sign and magnitude match the calendar cells.
 * Returns e.g. "+$26.33", "-$54.35", "$0.00".
 */
export const formatPnL = (
  value: number,
  opts: { showPlus?: boolean; withSymbol?: boolean } = {}
): string => {
  const { showPlus = true, withSymbol = true } = opts;
  const abs = Math.abs(value);
  const truncated = Math.trunc(abs * 100) / 100;
  const sign = value < 0 ? "-" : showPlus ? "+" : "";
  const symbol = withSymbol ? "$" : "";
  return `${sign}${symbol}${truncated.toFixed(2)}`;
};
