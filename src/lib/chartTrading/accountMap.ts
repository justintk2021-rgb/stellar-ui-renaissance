import {
  platformLabel,
  type AccountEnvironment,
  type BrokerPlatform,
  type ChartBrokerAccount,
} from "./types";

export interface BrokerAccountRow {
  id: string;
  account_id_external: string;
  acc_num: number;
  account_name: string | null;
}

export interface BrokerConnectionRow {
  id: string;
  platform: string | null;
  broker_name: string | null;
  environment: string | null;
  connection_status: string | null;
  login: string | null;
}

function asPlatform(value: string | null | undefined): BrokerPlatform {
  if (value === "mt5") return "mt5";
  if (value === "tradelocker") return "tradelocker";
  return "mock";
}

function asEnvironment(value: string | null | undefined): AccountEnvironment {
  return value === "live" ? "live" : "demo";
}

export function mapConnectedAccounts(
  connections: BrokerConnectionRow[],
  accountsByConnection: Record<string, BrokerAccountRow[]>,
): ChartBrokerAccount[] {
  const mapped: ChartBrokerAccount[] = [];

  for (const conn of connections) {
    const visible =
      conn.connection_status === "connected" ||
      conn.connection_status === "expired" ||
      (conn.platform === "mt5" &&
        (conn.connection_status === "connecting" || conn.connection_status === "pending"));
    if (!visible) continue;

    const platform = asPlatform(conn.platform);
    const environment = asEnvironment(conn.environment);
    const accs = accountsByConnection[conn.id] || [];

    if (accs.length) {
      for (const acc of accs) {
        const number = acc.account_id_external || String(acc.acc_num);
        mapped.push({
          id: `broker-${conn.id}-${acc.acc_num}`,
          label: `${platformLabel(platform)} - ${environment.toUpperCase()} ${number}`,
          platform,
          environment,
          accountNumber: number,
          brokerName: conn.broker_name || platformLabel(platform),
          connectionId: conn.id,
          accountId: acc.account_id_external,
          accNum: acc.acc_num,
        });
      }
    } else {
      const number = conn.login || conn.id.slice(0, 6);
      mapped.push({
        id: `conn-${conn.id}`,
        label: `${platformLabel(platform)} - ${environment.toUpperCase()} ${number}`,
        platform,
        environment,
        accountNumber: number,
        brokerName: conn.broker_name || platformLabel(platform),
        connectionId: conn.id,
        accountId: null,
        accNum: null,
      });
    }
  }

  return mapped;
}
