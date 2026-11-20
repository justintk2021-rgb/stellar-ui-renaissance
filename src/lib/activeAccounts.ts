import { supabase } from "@/integrations/supabase/client";

export type ActiveAccountIdSets = {
  manualIds: Set<string>;
  brokerExternalIds: Set<string>;
};

const VISIBLE_BROKER_STATUSES = new Set([
  "connected",
  "expired",
  "connecting",
  "pending",
]);

/**
 * Manual trading_accounts + broker_accounts still attached to a live connection.
 * Trades from deleted/disconnected accounts must not appear anywhere in the app.
 */
export async function fetchActiveAccountIdSets(
  userId: string,
): Promise<ActiveAccountIdSets> {
  const [{ data: manuals }, { data: connections }] = await Promise.all([
    supabase.from("trading_accounts").select("id").eq("user_id", userId),
    supabase
      .from("broker_connections")
      .select("id, connection_status")
      .eq("user_id", userId)
      .neq("connection_status", "disconnected"),
  ]);

  const manualIds = new Set((manuals || []).map((row) => String(row.id)));
  const brokerExternalIds = new Set<string>();

  const visibleConnections = (connections || []).filter((conn) =>
    VISIBLE_BROKER_STATUSES.has(String(conn.connection_status || "")),
  );

  for (const conn of visibleConnections) {
    const { data: accounts } = await supabase
      .from("broker_accounts")
      .select("account_id_external")
      .eq("broker_connection_id", conn.id);
    for (const account of accounts || []) {
      if (account.account_id_external) {
        brokerExternalIds.add(String(account.account_id_external));
      }
    }
  }

  return { manualIds, brokerExternalIds };
}

export function tradeBelongsToActiveAccount(
  trade: { accountId?: string | null; brokerAccountId?: string | null },
  manualIds: Set<string>,
  brokerExternalIds: Set<string>,
): boolean {
  if (trade.brokerAccountId) return brokerExternalIds.has(trade.brokerAccountId);
  if (trade.accountId) return manualIds.has(trade.accountId);
  return false;
}

export function filterTradesToActiveAccounts<
  T extends { accountId?: string | null; brokerAccountId?: string | null },
>(trades: readonly T[], sets: ActiveAccountIdSets): T[] {
  return trades.filter((trade) =>
    tradeBelongsToActiveAccount(trade, sets.manualIds, sets.brokerExternalIds),
  );
}
