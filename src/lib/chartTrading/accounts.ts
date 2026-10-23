import { supabase } from "@/integrations/supabase/client";
import {
  platformLabel,
  type AccountEnvironment,
  type BrokerPlatform,
  type ChartBrokerAccount,
} from "./types";

export const MOCK_CHART_ACCOUNTS: ChartBrokerAccount[] = [
  {
    id: "mock-tl-live-12345",
    label: "TradeLocker - Live 12345",
    platform: "tradelocker",
    environment: "live",
    accountNumber: "12345",
    brokerName: "TradeLocker",
  },
  {
    id: "mock-mt5-demo-67890",
    label: "MT5 - Demo 67890",
    platform: "mt5",
    environment: "demo",
    accountNumber: "67890",
    brokerName: "MetaTrader 5",
  },
];

function asPlatform(value: string | null | undefined): BrokerPlatform {
  if (value === "mt5") return "mt5";
  if (value === "tradelocker") return "tradelocker";
  return "mock";
}

function asEnvironment(value: string | null | undefined): AccountEnvironment {
  return value === "live" ? "live" : "demo";
}

export async function loadChartAccounts(): Promise<ChartBrokerAccount[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return MOCK_CHART_ACCOUNTS;

    const { data: connections, error: connError } = await supabase
      .from("broker_connections")
      .select("id, platform, broker_name, environment, connection_status, login")
      .eq("user_id", user.id)
      .neq("connection_status", "disconnected");

    if (!connError && connections?.length) {
      const visible = connections.filter(
        (conn) =>
          conn.connection_status === "connected" ||
          conn.connection_status === "expired" ||
          (conn.platform === "mt5" &&
            (conn.connection_status === "connecting" || conn.connection_status === "pending")),
      );

      const mapped: ChartBrokerAccount[] = [];
      for (const conn of visible) {
        const { data: accs } = await supabase
          .from("broker_accounts")
          .select("id, account_id_external, acc_num, account_name")
          .eq("broker_connection_id", conn.id);

        if (accs?.length) {
          for (const acc of accs) {
            const platform = asPlatform(conn.platform);
            const environment = asEnvironment(conn.environment);
            const number = acc.account_id_external || String(acc.acc_num);
            mapped.push({
              id: `broker-${conn.id}-${acc.acc_num}`,
              label: `${platformLabel(platform)} - ${environment.toUpperCase()} ${number}`,
              platform,
              environment,
              accountNumber: number,
              brokerName: conn.broker_name || platformLabel(platform),
            });
          }
        } else {
          const platform = asPlatform(conn.platform);
          const environment = asEnvironment(conn.environment);
          const number = conn.login || conn.id.slice(0, 6);
          mapped.push({
            id: `conn-${conn.id}`,
            label: `${platformLabel(platform)} - ${environment.toUpperCase()} ${number}`,
            platform,
            environment,
            accountNumber: number,
            brokerName: conn.broker_name || platformLabel(platform),
          });
        }
      }

      if (mapped.length) return mapped;
    }

    const { data: journals } = await supabase
      .from("trading_accounts")
      .select("id, name, broker")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });

    if (journals?.length) {
      return journals.map((acc) => ({
        id: `journal-${acc.id}`,
        label: `${acc.broker || acc.name} - ${acc.name}`,
        platform: "mock" as const,
        environment: "demo" as const,
        accountNumber: acc.id.slice(0, 6).toUpperCase(),
        brokerName: acc.broker || acc.name,
      }));
    }
  } catch {
    // Chart mockup stays usable even if account lookups fail.
  }

  return MOCK_CHART_ACCOUNTS;
}
