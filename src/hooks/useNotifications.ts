import { useMemo } from "react";
import { Trade } from "@/types/trade";
import type { Notification, NotificationSource, UnjournaledTradePayload } from "@/types/notification";
import {
  buildUnjournaledNotifications,
  mergeNotificationSources,
  unreadNotificationCount,
} from "@/lib/notifications";

export interface UseNotificationsInput {
  trades: readonly Trade[];
  isLoading?: boolean;
  extraSources?: NotificationSource[];
}

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  unjournaledCount: number;
  payloads: Record<string, UnjournaledTradePayload>;
  isLoading: boolean;
}

const EMPTY_SOURCES: NotificationSource[] = [];

export function useNotifications({
  trades,
  isLoading = false,
  extraSources = EMPTY_SOURCES,
}: UseNotificationsInput): UseNotificationsResult {
  const unjournaled = useMemo(() => buildUnjournaledNotifications(trades), [trades]);

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

  return {
    notifications,
    unreadCount,
    unjournaledCount: unjournaled.notifications.length,
    payloads: unjournaled.payloads,
    isLoading: sources.some((source) => source.isLoading),
  };
}
