import { supabase } from "@/integrations/supabase/client";
import { mapConnectedAccounts, type BrokerAccountRow } from "./accountMap";
import type { ChartBrokerAccount } from "./types";

export { mapConnectedAccounts } from "./accountMap";
export type { BrokerAccountRow, BrokerConnectionRow } from "./accountMap";

export async function loadChartAccounts(): Promise<ChartBrokerAccount[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: connections, error } = await supabase
    .from("broker_connections")
    .select("id, platform, broker_name, environment, connection_status, login")
    .eq("user_id", user.id)
    .neq("connection_status", "disconnected");

  if (error || !connections?.length) return [];

  const accountsByConnection: Record<string, BrokerAccountRow[]> = {};
  for (const conn of connections) {
    const { data: accs } = await supabase
      .from("broker_accounts")
      .select("id, account_id_external, acc_num, account_name")
      .eq("broker_connection_id", conn.id);
    accountsByConnection[conn.id] = accs || [];
  }

  return mapConnectedAccounts(connections, accountsByConnection);
}
