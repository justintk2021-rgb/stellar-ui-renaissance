import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readTradeLockerConnectionId } from "@/lib/brokerStorage";
import { fetchBrokerPnLData } from "@/lib/queries/brokerPnl";
import { repairTradeLockerSessions } from "@/lib/repairBrokerSession";
import {
  formatLocalDateKey,
  setBrokerPlByPositionCache,
  type BrokerTodayPnL,
} from "@/lib/tradeFormat";

function parseTodayFromConnection(row: {
  today_gross_pnl?: number | string | null;
  today_net_pnl?: number | string | null;
  today_pnl_synced_at?: string | null;
}): BrokerTodayPnL | null {
  const value =
    row.today_gross_pnl != null
      ? Number(row.today_gross_pnl)
      : row.today_net_pnl != null
        ? Number(row.today_net_pnl)
        : null;
  if (value == null || !Number.isFinite(value)) return null;
  return { net: value, syncedAt: row.today_pnl_synced_at ?? null };
}

async function resolveConnectionId(
  userId: string,
  brokerAccountExternalId: string | null,
): Promise<string | null> {
  if (brokerAccountExternalId) {
    const { data: acc } = await supabase
      .from("broker_accounts")
      .select("broker_connection_id")
      .eq("account_id_external", brokerAccountExternalId)
      .maybeSingle();
    if (acc?.broker_connection_id) return acc.broker_connection_id;
  }

  const stored = readTradeLockerConnectionId();
  if (stored) return stored;

  const { data: conn } = await supabase
    .from("broker_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", "tradelocker")
    .in("connection_status", ["connected", "expired"])
    .not("active_account_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return conn?.id ?? null;
}

/** Live today gross from TradeLocker account state (dashboard only). */
async function fetchLiveBrokerToday(connectionId: string): Promise<BrokerTodayPnL | null> {
  const { data, error } = await supabase.functions.invoke("tradelocker", {
    body: { action: "account-summary", connectionId },
  });
  if (error || data?.error) return null;

  const gross = data.todayGross != null ? Number(data.todayGross) : null;
  const net = data.todayNet != null ? Number(data.todayNet) : null;
  const value = gross ?? net;
  if (value == null || !Number.isFinite(value)) return null;

  return { net: value, syncedAt: new Date().toISOString() };
}

/**
 * Broker per-position P/L cache + optional today gross for account widgets.
 * Calendar day totals come from synced trades only (buildDailyPnLMap).
 */
export function useBrokerTodayPnL(
  userId: string | undefined,
  brokerAccountExternalId: string | null,
) {
  const [brokerToday, setBrokerToday] = useState<BrokerTodayPnL | null>(null);
  const [brokerDayTotals, setBrokerDayTotals] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [connectionId, setConnectionId] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { live?: boolean }) => {
      if (!userId) {
        setBrokerToday(null);
        setBrokerDayTotals(new Map());
        setConnectionId(null);
        setBrokerPlByPositionCache(null);
        return;
      }

      let connId = await resolveConnectionId(userId, brokerAccountExternalId);
      if (!connId) {
        setBrokerToday(null);
        setBrokerDayTotals(new Map());
        setConnectionId(null);
        setBrokerPlByPositionCache(null);
        return;
      }

      await repairTradeLockerSessions();
      connId = (await resolveConnectionId(userId, brokerAccountExternalId)) ?? connId;
      setConnectionId(connId);

      let byDay = new Map<string, number>();
      let byPosition = new Map<string, number>();
      try {
        const data = await fetchBrokerPnLData(connId, brokerAccountExternalId);
        byDay = data.byDay;
        byPosition = data.byPosition;
        setBrokerDayTotals(byDay);
        setBrokerPlByPositionCache(byPosition);
      } catch {
        setBrokerDayTotals(new Map());
        setBrokerPlByPositionCache(null);
      }

      let stored: BrokerTodayPnL | null = null;
      if (opts?.live) {
        stored = await fetchLiveBrokerToday(connId);
        if (!stored) {
          await repairTradeLockerSessions();
          stored = await fetchLiveBrokerToday(connId);
        }
      }

      if (stored == null) {
        const { data: conn, error: connErr } = await supabase
          .from("broker_connections")
          .select("today_gross_pnl, today_net_pnl, today_pnl_synced_at")
          .eq("id", connId)
          .maybeSingle();
        if (!connErr && conn) {
          stored = parseTodayFromConnection(conn);
        }
      }

      setBrokerToday(stored);
    },
    [userId, brokerAccountExternalId],
  );

  useEffect(() => {
    load({ live: true });
  }, [load]);

  useEffect(() => {
    if (!userId || !connectionId) return;

    const channel = supabase
      .channel(`broker-today-${connectionId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "broker_connections", filter: `id=eq.${connectionId}` },
        () => {
          load({ live: false });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "broker_trade_history" },
        () => {
          load({ live: false });
        },
      )
      .subscribe();

    const onSyncDone = () => {
      load({ live: true });
    };
    window.addEventListener("broker-sync-complete", onSyncDone);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("broker-sync-complete", onSyncDone);
    };
  }, [userId, connectionId, load]);

  return { brokerToday, brokerDayTotals, connectionId, refetch: load };
}
