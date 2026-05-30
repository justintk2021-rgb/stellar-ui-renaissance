import { supabase } from "@/integrations/supabase/client";
import { formatLocalDateKey } from "@/lib/tradeFormat";

export type BrokerPnLData = {
  byDay: Map<string, number>;
  byPosition: Map<string, number>;
};

/** Sum broker_trade_history realized P&L by local close day and position id. */
export async function fetchBrokerPnLData(
  connectionId: string,
): Promise<BrokerPnLData> {
  const byDay = new Map<string, number>();
  const byPosition = new Map<string, number>();

  const { data, error } = await supabase
    .from("broker_trade_history")
    .select("broker_position_id, realized_pl, closed_at")
    .eq("broker_connection_id", connectionId)
    .not("closed_at", "is", null);

  if (error) throw error;

  for (const row of data || []) {
    const pl = Number(row.realized_pl) || 0;
    const posId = row.broker_position_id as string | null;
    if (posId) byPosition.set(posId, pl);

    const closedAt = row.closed_at as string;
    const d = new Date(closedAt);
    if (isNaN(d.getTime())) continue;
    const key = formatLocalDateKey(d);
    byDay.set(key, (byDay.get(key) || 0) + pl);
  }

  return { byDay, byPosition };
}
