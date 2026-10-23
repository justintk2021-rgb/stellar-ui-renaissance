import { Trade } from "@/types/trade";
import type {
  Notification,
  NotificationSource,
  UnjournaledTradePayload,
} from "@/types/notification";
import { dedupeTradesForPnL, getTradeNetResult } from "@/lib/tradeFormat";

export const UNJOURNALED_TRADE_TYPE = "unjournaled_trade" as const;
export const UNJOURNALED_JOURNAL_FILTER = "unjournaled" as const;

export type JournalFilter = "all" | "wins" | "losses" | "unjournaled";

export function tradeHasNotes(trade: Pick<Trade, "notes">): boolean {
  return Boolean(trade.notes?.trim());
}

export function isUnjournaledTrade(trade: Pick<Trade, "notes">): boolean {
  return !tradeHasNotes(trade);
}

export function tradeNotificationTimestamp(trade: Trade): string {
  if (trade.closeTime) {
    const close = new Date(trade.closeTime);
    if (!Number.isNaN(close.getTime())) return trade.closeTime;
  }
  if (trade.openTime) {
    const open = new Date(trade.openTime);
    if (!Number.isNaN(open.getTime())) return trade.openTime;
  }
  return trade.date || "";
}

export function unjournaledJournalLink(tradeId?: string, openNotes = false): string {
  const params = new URLSearchParams({ filter: UNJOURNALED_JOURNAL_FILTER });
  if (tradeId) params.set("trade", tradeId);
  if (openNotes) params.set("notes", "1");
  return `journal?${params.toString()}`;
}

export function parseNotificationLink(link?: string): {
  page: string;
  filter?: JournalFilter;
  tradeId?: string;
  openNotes: boolean;
} | null {
  if (!link) return null;
  const [page, query = ""] = link.split("?");
  if (!page) return null;
  const params = new URLSearchParams(query);
  const filter = params.get("filter");
  return {
    page,
    filter:
      filter === "all" || filter === "wins" || filter === "losses" || filter === "unjournaled"
        ? filter
        : undefined,
    tradeId: params.get("trade") ?? undefined,
    openNotes: params.get("notes") === "1",
  };
}

export function buildUnjournaledNotifications(trades: readonly Trade[]): {
  notifications: Notification[];
  payloads: Record<string, UnjournaledTradePayload>;
} {
  const rows = dedupeTradesForPnL(trades)
    .filter(isUnjournaledTrade)
    .map((trade) => {
      const timestamp = tradeNotificationTimestamp(trade);
      const pnl = getTradeNetResult(trade);
      const id = `${UNJOURNALED_TRADE_TYPE}:${trade.id}`;
      const notification: Notification = {
        id,
        type: UNJOURNALED_TRADE_TYPE,
        title: trade.pair || "Trade",
        message: "Add notes",
        timestamp,
        link: unjournaledJournalLink(trade.id, true),
        read: false,
      };
      const payload: UnjournaledTradePayload = {
        tradeId: trade.id,
        pair: trade.pair || "—",
        direction: trade.direction,
        pnl,
      };
      return { notification, payload };
    })
    .sort((a, b) => notificationTimeMs(b.notification.timestamp) - notificationTimeMs(a.notification.timestamp));

  const payloads: Record<string, UnjournaledTradePayload> = {};
  const notifications = rows.map(({ notification, payload }) => {
    payloads[notification.id] = payload;
    return notification;
  });

  return { notifications, payloads };
}

export function notificationTimeMs(timestamp: string): number {
  if (!timestamp) return 0;
  const parsed = Date.parse(timestamp);
  if (!Number.isNaN(parsed)) return parsed;
  return 0;
}

export function mergeNotificationSources(
  sources: readonly NotificationSource[],
): Notification[] {
  return sources
    .flatMap((source) => source.notifications)
    .sort((a, b) => notificationTimeMs(b.timestamp) - notificationTimeMs(a.timestamp));
}

export function unreadNotificationCount(notifications: readonly Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}
