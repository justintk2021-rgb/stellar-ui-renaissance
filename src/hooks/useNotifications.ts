import { useCallback, useMemo } from "react";
import { NotebookEntry, Trade } from "@/types/trade";
import type { Notification, NotificationSource, UnjournaledTradePayload } from "@/types/notification";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  addReadNotificationId,
  buildUnjournaledNotifications,
  mergeNotificationSources,
  NOTIFICATION_READ_STORAGE_KEY,
  unreadNotificationCount,
} from "@/lib/notifications";

export interface UseNotificationsInput {
  trades: readonly Trade[];
  notebookEntries?: readonly NotebookEntry[];
  isLoading?: boolean;
  extraSources?: NotificationSource[];
  storageKey?: string;
}

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  unjournaledCount: number;
  payloads: Record<string, UnjournaledTradePayload>;
  isLoading: boolean;
  markRead: (tradeId: string) => void;
}

const EMPTY_SOURCES: NotificationSource[] = [];
const EMPTY_ENTRIES: NotebookEntry[] = [];

export function useNotifications({
  trades,
  notebookEntries = EMPTY_ENTRIES,
  isLoading = false,
  extraSources = EMPTY_SOURCES,
  storageKey = NOTIFICATION_READ_STORAGE_KEY,
}: UseNotificationsInput): UseNotificationsResult {
  const [readIds, setReadIds] = useLocalStorage<string[]>(storageKey, []);
  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const unjournaled = useMemo(
    () => buildUnjournaledNotifications(trades, { notebookEntries, readIds: readSet }),
    [trades, notebookEntries, readSet],
  );

  const sources = useMemo<NotificationSource[]>(() => {
    return [
      {
        id: "unjournaled_trades",
        notifications: unjournaled.notifications,
        isLoading,
        payloads: unjournaled.payloads,
      },
      ...extraSources,
    ];
  }, [unjournaled, isLoading, extraSources]);

  const notifications = useMemo(() => mergeNotificationSources(sources), [sources]);
  const unreadCount = useMemo(() => unreadNotificationCount(notifications), [notifications]);
  const unjournaledCount = useMemo(
    () => notifications.filter((item) => !unjournaled.payloads[item.id]?.journaled).length,
    [notifications, unjournaled.payloads],
  );

  const markRead = useCallback((tradeId: string) => {
    setReadIds((prev) => addReadNotificationId(prev, tradeId));
  }, [setReadIds]);

  return {
    notifications,
    unreadCount,
    unjournaledCount,
    payloads: unjournaled.payloads,
    isLoading: sources.some((source) => source.isLoading),
    markRead,
  };
}
