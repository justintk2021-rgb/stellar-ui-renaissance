import { NotebookEntry, Trade } from "@/types/trade";
import type {
  Notification,
  NotificationSource,
  UnjournaledTradePayload,
} from "@/types/notification";
import { dedupeTradesForPnL, getTradeNetResult } from "@/lib/tradeFormat";

export const UNJOURNALED_TRADE_TYPE = "unjournaled_trade" as const;
export const UNJOURNALED_JOURNAL_FILTER = "unjournaled" as const;
export const NOTIFICATION_READ_STORAGE_KEY = "nsync-notification-read-ids";

export type JournalFilter = "all" | "wins" | "losses" | "unjournaled";

export type JournalNoteTrade = Pick<Trade, "id" | "notes" | "notebook">;

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function tradeHasNotesField(trade: Pick<Trade, "notes">): boolean {
  return Boolean(trade.notes?.trim());
}

/** @deprecated Use tradeHasJournalNotes — kept for existing tests. */
export function tradeHasNotes(trade: Pick<Trade, "notes">): boolean {
  return tradeHasNotesField(trade);
}

export function notebookEntryHasContent(
  entry?: Pick<NotebookEntry, "content" | "isDeleted"> | null,
): boolean {
  if (!entry || entry.isDeleted) return false;
  return htmlToPlainText(entry.content || "").length > 0;
}

export function tradeHasJournalNotes(
  trade: JournalNoteTrade,
  notebookEntries: readonly NotebookEntry[] = [],
): boolean {
  if (tradeHasNotesField(trade)) return true;
  if (trade.notebook?.trim()) return true;
  const entry = notebookEntries.find((e) => e.tradeId === trade.id && !e.isDeleted);
  return notebookEntryHasContent(entry);
}

export function isUnjournaledTrade(
  trade: JournalNoteTrade,
  notebookEntries: readonly NotebookEntry[] = [],
): boolean {
  return !tradeHasJournalNotes(trade, notebookEntries);
}

/**
 * A trade stays in the card until it is read (hover). After that:
 * - no notes → stay until the user journals it
 * - has notes → classified as journaled and removed
 *
 * Trades that already have a notes field never enter the list, so historical
 * journaled rows do not flood the card. Notebook-journaled rows (empty notes
 * field) stay until hover, which is what the dashboard is showing today.
 */
export function isNotificationVisible(args: {
  hasNotesField: boolean;
  hasJournalNotes: boolean;
  read: boolean;
}): boolean {
  if (args.hasJournalNotes && args.read) return false;
  if (!args.hasJournalNotes) return true;
  return !args.hasNotesField;
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

export function notificationIdForTrade(tradeId: string): string {
  return `${UNJOURNALED_TRADE_TYPE}:${tradeId}`;
}

export function buildUnjournaledNotifications(
  trades: readonly Trade[],
  options: {
    notebookEntries?: readonly NotebookEntry[];
    readIds?: ReadonlySet<string>;
  } = {},
): {
  notifications: Notification[];
  payloads: Record<string, UnjournaledTradePayload>;
} {
  const notebookEntries = options.notebookEntries ?? [];
  const readIds = options.readIds ?? new Set<string>();

  const rows = dedupeTradesForPnL(trades)
    .filter((trade) =>
      isNotificationVisible({
        hasNotesField: tradeHasNotesField(trade),
        hasJournalNotes: tradeHasJournalNotes(trade, notebookEntries),
        read: readIds.has(trade.id),
      }),
    )
    .map((trade) => {
      const timestamp = tradeNotificationTimestamp(trade);
      const pnl = getTradeNetResult(trade);
      const journaled = tradeHasJournalNotes(trade, notebookEntries);
      const read = readIds.has(trade.id);
      const id = notificationIdForTrade(trade.id);
      const notification: Notification = {
        id,
        type: UNJOURNALED_TRADE_TYPE,
        title: trade.pair || "Trade",
        message: journaled ? "Journaled" : "Add notes",
        timestamp,
        link: unjournaledJournalLink(trade.id, true),
        read,
      };
      const payload: UnjournaledTradePayload = {
        tradeId: trade.id,
        pair: trade.pair || "—",
        direction: trade.direction,
        pnl,
        journaled,
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

export function addReadNotificationId(ids: readonly string[], tradeId: string): string[] {
  return ids.includes(tradeId) ? [...ids] : [...ids, tradeId];
}
