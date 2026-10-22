/**
 * Single definition of net P&L and win rate.
 *
 * Dashboard stats, the PnL calendar, compare, playbook, rank, and the journal
 * must not sum `trade.result` on their own. Use `netTradeResult` for one trade
 * and `aggregateTradeStats` for a set. `tradeFormat.ts` wraps both with the
 * live broker-position cache (`getTradeNetResult`, `journalTradeStats`).
 *
 * Net P&L:
 * 1. Imported TradeLocker / MT5 rows prefer `broker_trade_history.realized_pl`
 *    when that position is in `brokerPlByPosition`. The history value is the
 *    broker's realized P&L. Swap and commission are not added on top — stacking
 *    them inflated totals (the $583 vs $418 class of bug).
 * 2. Otherwise an imported row uses `result`. Sync writes the net figure there
 *    and stores journal swap/commission as 0.
 * 3. Manual rows use `result + swap + commission`. Fee columns are applied
 *    once. Zero fees leave the entered result unchanged.
 *
 * Win rate is wins / deduped trades. Breakeven trades stay in the denominator.
 * Imported rows that share a broker position id count once; the latest
 * `lastBrokerSyncAt` wins. A tie keeps the later row.
 */

export interface PnlTrade {
  id: string;
  result?: number | null;
  swap?: number | null;
  commission?: number | null;
  importedFromBroker?: boolean | null;
  brokerPositionId?: string | null;
  lastBrokerSyncAt?: string | null;
}

export interface NetResultOptions {
  /** Realized P&L from broker_trade_history, keyed by position id. Already net. */
  brokerPlByPosition?: ReadonlyMap<string, number> | null;
}

/** Used when the selected account has no positive balance on file. */
export const FALLBACK_ACCOUNT_BALANCE = 10_000;

export function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Signed swap + commission. Costs are negative, matching MT5's net formula. */
export function tradeFees(trade: Pick<PnlTrade, "swap" | "commission">): number {
  return (finiteNumber(trade.swap) ?? 0) + (finiteNumber(trade.commission) ?? 0);
}

export function netTradeResult(trade: PnlTrade, options?: NetResultOptions): number {
  const journal = finiteNumber(trade.result) ?? 0;
  const posId = trade.brokerPositionId;
  const cache = options?.brokerPlByPosition;

  if (trade.importedFromBroker && posId && cache?.has(posId)) {
    const cached = cache.get(posId);
    if (cached != null && Number.isFinite(cached)) return cached;
  }

  if (trade.importedFromBroker) return journal;
  return journal + tradeFees(trade);
}

/** Drop duplicate broker journal rows (same position synced more than once). */
export function dedupeTradesForPnL<T extends PnlTrade>(trades: readonly T[]): T[] {
  const manual: T[] = [];
  const byPosition = new Map<string, T>();

  for (const trade of trades) {
    const posId = trade.brokerPositionId;
    if (!trade.importedFromBroker || !posId) {
      manual.push(trade);
      continue;
    }
    const prev = byPosition.get(posId);
    const prevAt = prev?.lastBrokerSyncAt || "";
    const nextAt = trade.lastBrokerSyncAt || "";
    if (!prev || nextAt >= prevAt) byPosition.set(posId, trade);
  }

  return [...manual, ...byPosition.values()];
}

export type TradeOutcome = "win" | "loss" | "breakeven";

export function tradeOutcome(net: number): TradeOutcome {
  if (net > 0) return "win";
  if (net < 0) return "loss";
  return "breakeven";
}

export interface TradeAggregate {
  netPnL: number;
  wins: number;
  losses: number;
  breakeven: number;
  /** Deduped count, including breakeven. */
  total: number;
  /** 0–100. Wins divided by total. */
  winRate: number;
  grossProfit: number;
  /** Positive magnitude of losing trades. */
  grossLoss: number;
  avgWin: number;
  /** Positive magnitude. */
  avgLoss: number;
  /** Infinity when there are wins and no losses. */
  profitFactor: number;
  expectancy: number;
  /** Signed fees included in manual nets. Not stacked onto broker rows. */
  feesApplied: number;
}

export function aggregateTradeStats(
  trades: readonly PnlTrade[],
  options?: NetResultOptions,
): TradeAggregate {
  const rows = dedupeTradesForPnL(trades);
  let netPnL = 0;
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let feesApplied = 0;

  for (const trade of rows) {
    const net = netTradeResult(trade, options);
    netPnL += net;
    const outcome = tradeOutcome(net);
    if (outcome === "win") {
      wins += 1;
      grossProfit += net;
    } else if (outcome === "loss") {
      losses += 1;
      grossLoss += Math.abs(net);
    } else {
      breakeven += 1;
    }
    if (!trade.importedFromBroker) feesApplied += tradeFees(trade);
  }

  const total = rows.length;
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  return {
    netPnL,
    wins,
    losses,
    breakeven,
    total,
    winRate: total > 0 ? (wins / total) * 100 : 0,
    grossProfit,
    grossLoss,
    avgWin: wins > 0 ? grossProfit / wins : 0,
    avgLoss: losses > 0 ? grossLoss / losses : 0,
    profitFactor,
    expectancy: total > 0 ? netPnL / total : 0,
    feesApplied,
  };
}

/**
 * Positive finite account balance, otherwise the previous $10,000 placeholder
 * so ROI stays finite when no account is selected.
 */
export function accountBalanceForRoi(balance: number | null | undefined): number {
  if (balance == null || !Number.isFinite(balance) || balance <= 0) {
    return FALLBACK_ACCOUNT_BALANCE;
  }
  return balance;
}

export function tradeRoiPercent(
  netResult: number,
  accountBalance: number | null | undefined,
): number {
  return (netResult / accountBalanceForRoi(accountBalance)) * 100;
}
