import { describe, expect, it } from "vitest";
import type { Trade } from "@/types/trade";
import {
  buildUnjournaledNotifications,
  isUnjournaledTrade,
  mergeNotificationSources,
  parseNotificationLink,
  tradeHasNotes,
  tradeNotificationTimestamp,
  unreadNotificationCount,
  unjournaledJournalLink,
} from "@/lib/notifications";
import type { Notification, NotificationSource } from "@/types/notification";

function trade(partial: Partial<Trade> & { id: string }): Trade {
  return {
    date: "2026-06-01",
    pair: "EURUSD",
    direction: "Long",
    result: 12.5,
    ...partial,
  };
}

describe("isUnjournaledTrade", () => {
  it("treats missing, empty, and whitespace-only notes as unjournaled", () => {
    expect(isUnjournaledTrade(trade({ id: "a" }))).toBe(true);
    expect(isUnjournaledTrade(trade({ id: "b", notes: "" }))).toBe(true);
    expect(isUnjournaledTrade(trade({ id: "c", notes: "   \n\t" }))).toBe(true);
    expect(isUnjournaledTrade(trade({ id: "d", notes: null as unknown as string }))).toBe(true);
  });

  it("treats notes with content as journaled", () => {
    expect(tradeHasNotes(trade({ id: "e", notes: "Setup was clean" }))).toBe(true);
    expect(isUnjournaledTrade(trade({ id: "e", notes: "Setup was clean" }))).toBe(false);
  });
});

describe("buildUnjournaledNotifications", () => {
  it("uses journal trades, drops journaled rows, and sorts newest first", () => {
    const { notifications, payloads } = buildUnjournaledNotifications([
      trade({
        id: "old",
        pair: "GBPUSD",
        direction: "Short",
        result: -8,
        closeTime: "2026-06-01T10:00:00.000Z",
      }),
      trade({
        id: "noted",
        notes: "already journaled",
        closeTime: "2026-06-03T10:00:00.000Z",
      }),
      trade({
        id: "new",
        pair: "XAUUSD",
        direction: "Long",
        result: 40,
        closeTime: "2026-06-02T15:00:00.000Z",
      }),
    ]);

    expect(notifications.map((n) => n.id)).toEqual([
      "unjournaled_trade:new",
      "unjournaled_trade:old",
    ]);
    expect(notifications[0]?.title).toBe("XAUUSD");
    expect(notifications[0]?.message).toBe("Add notes");
    expect(notifications[0]?.link).toBe(unjournaledJournalLink("new", true));
    expect(notifications[0]?.read).toBe(false);
    expect(payloads["unjournaled_trade:new"]).toEqual({
      tradeId: "new",
      pair: "XAUUSD",
      direction: "Long",
      pnl: 40,
    });
    expect(payloads["unjournaled_trade:old"]?.direction).toBe("Short");
  });

  it("dedupes broker re-syncs the same way as the journal", () => {
    const { notifications } = buildUnjournaledNotifications([
      trade({
        id: "stale",
        importedFromBroker: true,
        brokerPositionId: "pos-1",
        lastBrokerSyncAt: "2026-06-01T00:00:00.000Z",
        result: 10,
      }),
      trade({
        id: "fresh",
        importedFromBroker: true,
        brokerPositionId: "pos-1",
        lastBrokerSyncAt: "2026-06-02T00:00:00.000Z",
        result: 11,
      }),
      trade({ id: "manual", result: 5 }),
    ]);

    const ids = notifications.map((n) => payloadsTradeId(n.id));
    expect(ids).toContain("fresh");
    expect(ids).toContain("manual");
    expect(ids).not.toContain("stale");
    expect(ids).toHaveLength(2);
  });

  it("prefers close time, then open time, then the trade date", () => {
    expect(
      tradeNotificationTimestamp(
        trade({ id: "1", closeTime: "2026-06-02T12:00:00.000Z", openTime: "2026-06-01T12:00:00.000Z" }),
      ),
    ).toBe("2026-06-02T12:00:00.000Z");
    expect(
      tradeNotificationTimestamp(trade({ id: "2", openTime: "2026-06-01T12:00:00.000Z" })),
    ).toBe("2026-06-01T12:00:00.000Z");
    expect(tradeNotificationTimestamp(trade({ id: "3" }))).toBe("2026-06-01");
  });
});

describe("mergeNotificationSources", () => {
  it("merges sources newest first so later types can plug in", () => {
    const older: Notification = {
      id: "unjournaled_trade:a",
      type: "unjournaled_trade",
      title: "EURUSD",
      message: "Add notes",
      timestamp: "2026-06-01T00:00:00.000Z",
      read: false,
    };
    const newer: Notification = {
      id: "sync_error:1",
      type: "sync_error",
      title: "Sync failed",
      message: "TradeLocker timed out",
      timestamp: "2026-06-03T00:00:00.000Z",
      read: false,
    };
    const sources: NotificationSource[] = [
      { id: "unjournaled_trades", notifications: [older] },
      { id: "sync_errors", notifications: [newer] },
    ];

    expect(mergeNotificationSources(sources).map((n) => n.id)).toEqual([
      "sync_error:1",
      "unjournaled_trade:a",
    ]);
    expect(unreadNotificationCount(mergeNotificationSources(sources))).toBe(2);
  });
});

describe("notification links", () => {
  it("builds and parses a journal deep link that opens the notes editor", () => {
    const link = unjournaledJournalLink("trade-9", true);
    expect(parseNotificationLink(link)).toEqual({
      page: "journal",
      filter: "unjournaled",
      tradeId: "trade-9",
      openNotes: true,
    });
    expect(parseNotificationLink(unjournaledJournalLink())).toEqual({
      page: "journal",
      filter: "unjournaled",
      tradeId: undefined,
      openNotes: false,
    });
  });
});

function payloadsTradeId(notificationId: string): string {
  return notificationId.replace("unjournaled_trade:", "");
}
