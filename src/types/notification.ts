export type NotificationType =
  | "unjournaled_trade"
  | "sync_error"
  | "prop_firm_limit"
  | "goal";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  link?: string;
  read: boolean;
}

export interface UnjournaledTradePayload {
  tradeId: string;
  pair: string;
  direction: "Long" | "Short";
  pnl: number;
}

export interface NotificationSource<T = unknown> {
  id: string;
  notifications: Notification[];
  isLoading?: boolean;
  payloads?: Record<string, T>;
}
