/** Platform-specific localStorage keys for broker UI state. */
export const BROKER_STORAGE_KEYS = {
  tradeLockerConnection: "activeTradeLockerConnectionId",
  mt5Connection: "activeMt5ConnectionId",
  /** @deprecated Use platform-specific keys; migrated on read. */
  legacyConnection: "activeBrokerConnectionId",
  selectedBroker: "selectedBrokerInternalId",
  defaultAccount: "defaultDashboardAccount",
} as const;

export function readTradeLockerConnectionId(): string | null {
  return (
    localStorage.getItem(BROKER_STORAGE_KEYS.tradeLockerConnection) ||
    localStorage.getItem(BROKER_STORAGE_KEYS.legacyConnection)
  );
}

export function writeTradeLockerConnectionId(connectionId: string | null) {
  if (connectionId) {
    localStorage.setItem(BROKER_STORAGE_KEYS.tradeLockerConnection, connectionId);
  } else {
    localStorage.removeItem(BROKER_STORAGE_KEYS.tradeLockerConnection);
  }
  localStorage.removeItem(BROKER_STORAGE_KEYS.legacyConnection);
}

export function writeMt5ConnectionId(connectionId: string | null) {
  if (connectionId) {
    localStorage.setItem(BROKER_STORAGE_KEYS.mt5Connection, connectionId);
  } else {
    localStorage.removeItem(BROKER_STORAGE_KEYS.mt5Connection);
  }
}
