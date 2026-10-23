import type { BrokerAdapter, ChartBrokerAccount } from "./types";
import { TradeLockerAdapter } from "./TradeLockerAdapter";
import { UnavailableAdapter } from "./UnavailableAdapter";

export function createBrokerAdapter(account: ChartBrokerAccount): BrokerAdapter {
  if (account.platform === "tradelocker" && account.connectionId) {
    return new TradeLockerAdapter(account);
  }
  return new UnavailableAdapter(account);
}

export function adapterAvailable(account: ChartBrokerAccount | null): boolean {
  return Boolean(account?.platform === "tradelocker" && account.connectionId);
}
