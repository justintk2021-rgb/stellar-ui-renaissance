import type { BrokerAdapter, ChartBrokerAccount } from "./types";
import { MockAdapter } from "./MockAdapter";

/**
 * Factory used by the Chart page. TradeLocker and MT5 adapters can replace
 * the mock implementation later without changing the UI.
 */
export function createBrokerAdapter(account: ChartBrokerAccount): BrokerAdapter {
  switch (account.platform) {
    case "tradelocker":
    case "mt5":
    case "mock":
    default:
      return new MockAdapter(account);
  }
}
