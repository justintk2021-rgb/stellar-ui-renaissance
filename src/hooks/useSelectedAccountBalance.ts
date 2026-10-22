import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { accountBalanceForRoi, type PnlTrade } from "@/lib/tradePnl";
import { sumPnL } from "@/lib/tradeFormat";

const BROKER_ACCOUNT_KEY = "selectedBrokerAccountId";
const MANUAL_ACCOUNT_KEY = "selectedManualAccountId";

function mapTradeRow(row: Record<string, unknown>): PnlTrade {
  return {
    id: String(row.id),
    result: row.result as number | null,
    swap: row.swap as number | null,
    commission: row.commission as number | null,
    importedFromBroker: Boolean(row.imported_from_broker),
    brokerPositionId: (row.broker_position_id as string | null) ?? null,
    lastBrokerSyncAt: (row.last_broker_sync_at as string | null) ?? null,
  };
}

/**
 * Balance of the account selected in the dashboard.
 * Broker accounts use the live connection balance. Manual accounts use
 * starting balance plus realized net P&L. Missing or non-positive balances
 * fall back inside `accountBalanceForRoi`.
 */
export function useSelectedAccountBalance(): { balance: number; ready: boolean } {
  const [resolved, setResolved] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const brokerId = localStorage.getItem(BROKER_ACCOUNT_KEY);
      const manualId = localStorage.getItem(MANUAL_ACCOUNT_KEY);
      let balance: number | null = null;

      if (brokerId) {
        const { data: account } = await supabase
          .from("broker_accounts")
          .select("broker_connection_id")
          .eq("account_id_external", brokerId)
          .maybeSingle();

        if (account?.broker_connection_id) {
          const { data: connection } = await supabase
            .from("broker_connections")
            .select("account_balance")
            .eq("id", account.broker_connection_id)
            .maybeSingle();
          if (connection?.account_balance != null) {
            balance = Number(connection.account_balance);
          }
        }
      } else if (manualId) {
        const { data: account } = await supabase
          .from("trading_accounts")
          .select("starting_balance")
          .eq("id", manualId)
          .maybeSingle();
        const start =
          account?.starting_balance != null ? Number(account.starting_balance) : 0;
        const { data: rows } = await supabase
          .from("trades")
          .select(
            "id, result, swap, commission, imported_from_broker, broker_position_id, last_broker_sync_at",
          )
          .eq("account_id", manualId);
        const net = sumPnL((rows || []).map((row) => mapTradeRow(row as Record<string, unknown>)));
        const current = (Number.isFinite(start) ? start : 0) + net;
        if (current > 0) balance = current;
      }

      if (!cancelled) {
        setResolved(balance);
        setReady(true);
      }
    })().catch(() => {
      if (!cancelled) {
        setResolved(null);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { balance: accountBalanceForRoi(resolved), ready };
}
