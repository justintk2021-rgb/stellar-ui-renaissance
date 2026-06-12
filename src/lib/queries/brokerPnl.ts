import { supabase } from "@/integrations/supabase/client";
import { formatLocalDateKey } from "@/lib/tradeFormat";

export type BrokerPnLData = {
  byDay: Map<string, number>;
  byPosition: Map<string, number>;
};

/**
 * Sum broker_trade_history realized P&L by local close day and position id.
 * When `accountIdExternal` is set, only that account's rows are included —
 * one connection can hold several accounts and the calendar must not mix them.
 */
export async function fetchBrokerPnLData(
  connectionId: string,
  accountIdExternal?: string | null,
): Promise<BrokerPnLData> {
  const byDay = new Map<string, number>();
  const byPosition = new Map<string, number>();

  let query = supabase
    .from("broker_trade_history")
    .select("broker_position_id, realized_pl, closed_at")
    .eq("broker_connection_id", connectionId)
    .not("closed_at", "is", null);

  if (accountIdExternal) {
    query = query.eq("account_id_external", accountIdExternal);
  }

  const { data, error } = await query;

  if (error) throw error;

  // One row per position (latest close) — duplicate history rows were inflating day totals.
  const latestByPosition = new Map<
    string,
    { realized_pl: number; closed_at: string }
  >();

  for (const row of data || []) {
    const posId = row.broker_position_id as string | null;
    const closedAt = row.closed_at as string;
    if (!posId || !closedAt) continue;
    const pl = Number(row.realized_pl) || 0;
    const prev = latestByPosition.get(posId);
    if (!prev || closedAt >= prev.closed_at) {
      latestByPosition.set(posId, { realized_pl: pl, closed_at: closedAt });
    }
  }

  for (const [posId, row] of latestByPosition) {
    byPosition.set(posId, row.realized_pl);
    const d = new Date(row.closed_at);
    if (isNaN(d.getTime())) continue;
    const key = formatLocalDateKey(d);
    byDay.set(key, (byDay.get(key) || 0) + row.realized_pl);
  }

  return { byDay, byPosition };
}
