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

/**
 * Parse a YYYY-MM-DD key as a LOCAL Date (not UTC). Using `new Date("2025-04-07")`
 * parses as UTC midnight which can shift to the previous day when displayed via
 * `toLocaleDateString` in negative-UTC zones — this helper avoids that.
 */
export const parseLocalDateKey = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Sum trade results at full precision. Always sum first, round/truncate later. */
export const sumPnL = (trades: Trade[]): number =>
  trades.reduce((acc, t) => acc + (t.result || 0), 0);

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
