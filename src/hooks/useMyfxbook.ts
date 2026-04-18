import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MyfxbookAccount {
  id: string;
  name?: string;
  accountId?: string | number;
  balance?: number;
  equity?: number;
  gain?: number;
  drawdown?: number;
  profit?: number;
  server?: string;
  currency?: string;
}

export interface MyfxbookConnection {
  id: string;
  login: string;
  connection_status: string | null;
  account_balance: number | null;
  account_equity: number | null;
  account_currency: string | null;
  active_account_id: string | null;
  active_acc_num: number | null;
  last_connected_at: string | null;
  last_error: string | null;
}

export interface MyfxbookBrokerAccount {
  id: string;
  acc_num: number;
  account_id_external: string;
  account_name: string | null;
  is_active: boolean | null;
}

export function useMyfxbook() {
  const [connection, setConnection] = useState<MyfxbookConnection | null>(null);
  const [accounts, setAccounts] = useState<MyfxbookBrokerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setConnection(null);
      setAccounts([]);
      setLoading(false);
      return;
    }
    const { data: conns } = await supabase
      .from("broker_connections")
      .select(
        "id, login, connection_status, account_balance, account_equity, account_currency, active_account_id, active_acc_num, last_connected_at, last_error",
      )
      .eq("user_id", userData.user.id)
      .eq("platform", "myfxbook")
      .order("created_at", { ascending: false })
      .limit(1);

    const conn = conns?.[0] || null;
    setConnection(conn as MyfxbookConnection | null);

    if (conn) {
      const { data: accs } = await supabase
        .from("broker_accounts")
        .select("id, acc_num, account_id_external, account_name, is_active")
        .eq("broker_connection_id", conn.id)
        .order("acc_num");
      setAccounts((accs as MyfxbookBrokerAccount[]) || []);
    } else {
      setAccounts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.functions.invoke("myfxbook", {
        body: { action: "connect", email, password },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || "Login failed";
        toast.error(msg);
        return null;
      }
      toast.success(`Connected ${data.accounts?.length || 0} account(s)`);
      await refresh();
      return data.accounts as MyfxbookAccount[];
    },
    [refresh],
  );

  const selectAccount = useCallback(
    async (accountId: string) => {
      if (!connection) return false;
      const { data, error } = await supabase.functions.invoke("myfxbook", {
        body: {
          action: "selectAccount",
          connectionId: connection.id,
          accountId,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to select account");
        return false;
      }
      await refresh();
      return true;
    },
    [connection, refresh],
  );

  const sync = useCallback(async () => {
    if (!connection) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("myfxbook", {
        body: { action: "sync", connectionId: connection.id },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Sync failed");
        return;
      }
      toast.success(
        `Synced ${data.recordsProcessed} trades (${data.inserted} new)`,
      );
      await refresh();
    } finally {
      setSyncing(false);
    }
  }, [connection, refresh]);

  const disconnect = useCallback(async () => {
    if (!connection) return;
    const { error } = await supabase.functions.invoke("myfxbook", {
      body: { action: "disconnect", connectionId: connection.id },
    });
    if (error) {
      toast.error("Disconnect failed");
      return;
    }
    toast.success("Disconnected");
    await refresh();
  }, [connection, refresh]);

  return {
    connection,
    accounts,
    loading,
    syncing,
    connect,
    selectAccount,
    sync,
    disconnect,
    refresh,
  };
}
