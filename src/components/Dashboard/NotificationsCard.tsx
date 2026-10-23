import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Bell, Check, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { NotebookEntry, Trade } from "@/types/trade";
import { useNotifications } from "@/hooks/useNotifications";
import {
  parseNotificationLink,
  type JournalFilter,
} from "@/lib/notifications";
import { formatPnL } from "@/lib/tradeFormat";
import { cn } from "@/lib/utils";
import type { UnjournaledTradePayload } from "@/types/notification";

const iconVariants = {
  initial: { rotate: 0 },
  hover: { rotate: 15, scale: 1.1 },
};

export interface OpenJournalTarget {
  filter?: JournalFilter;
  tradeId?: string;
  openNotes?: boolean;
}

interface NotificationsCardProps {
  trades: Trade[];
  notebookEntries?: NotebookEntry[];
  isLoading?: boolean;
  onOpenJournal?: (target: OpenJournalTarget) => void;
}

function formatNotificationTime(timestamp: string): string {
  if (!timestamp) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(timestamp)
    ? new Date(`${timestamp}T00:00:00`)
    : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function NotificationsCard({
  trades,
  notebookEntries,
  isLoading = false,
  onOpenJournal,
}: NotificationsCardProps) {
  const { notifications, payloads, isLoading: loading, markRead } = useNotifications({
    trades,
    notebookEntries,
    isLoading,
  });
  const readTimers = useRef(new Map<string, number>());

  useEffect(() => {
    const timers = readTimers.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  const scheduleRead = (tradeId?: string) => {
    if (!tradeId || readTimers.current.has(tradeId)) return;
    const timer = window.setTimeout(() => {
      markRead(tradeId);
      readTimers.current.delete(tradeId);
    }, 280);
    readTimers.current.set(tradeId, timer);
  };

  const cancelRead = (tradeId?: string) => {
    if (!tradeId) return;
    const timer = readTimers.current.get(tradeId);
    if (timer) {
      window.clearTimeout(timer);
      readTimers.current.delete(tradeId);
    }
  };

  const openJournal = (target: OpenJournalTarget) => {
    onOpenJournal?.(target);
  };

  const handleRowClick = (link?: string, payload?: UnjournaledTradePayload) => {
    const parsed = parseNotificationLink(link);
    openJournal({
      filter: parsed?.filter ?? "unjournaled",
      tradeId: payload?.tradeId ?? parsed?.tradeId,
      openNotes: parsed?.openNotes ?? true,
    });
  };

  return (
    <div className="relative h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <motion.div
            variants={iconVariants}
            initial="initial"
            whileHover="hover"
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/15"
          >
            <Bell className="w-5 h-5 text-primary" />
          </motion.div>
          <span className="text-sm font-medium text-muted-foreground">Notifications</span>
        </div>
        <span
          data-testid="notifications-count"
          className={cn(
            "min-w-6 h-6 px-1.5 rounded-full text-[11px] font-semibold font-mono tabular-nums",
            "flex items-center justify-center",
            notifications.length > 0
              ? "bg-primary/15 text-primary"
              : "bg-muted/60 text-muted-foreground",
          )}
        >
          {loading ? "—" : notifications.length}
        </span>
      </div>

      {loading ? (
        <NotificationsSkeleton />
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Check className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground tracking-normal">
            All trades journaled
          </p>
        </div>
      ) : (
        <>
          <div className="max-h-[7.5rem] overflow-y-auto custom-scrollbar -mx-1 px-1 space-y-1.5">
            <AnimatePresence initial={false}>
            {notifications.map((item) => {
              const payload = payloads[item.id];
              const pnl = payload?.pnl ?? 0;
              const win = pnl >= 0;
              const tradeId = payload?.tradeId;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: item.read && !payload?.journaled ? 0.72 : 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  onPointerEnter={() => scheduleRead(tradeId)}
                  onPointerLeave={() => cancelRead(tradeId)}
                  onFocus={() => scheduleRead(tradeId)}
                  onBlur={() => cancelRead(tradeId)}
                  onClick={() => {
                    if (tradeId) {
                      cancelRead(tradeId);
                      markRead(tradeId);
                    }
                    handleRowClick(item.link, payload);
                  }}
                  className={cn(
                    "w-full text-left rounded-xl px-3 py-2",
                    "bg-foreground/[0.03] hover:bg-primary/10 border border-transparent hover:border-primary/20",
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        win ? "bg-primary/15" : "bg-destructive/15",
                      )}
                      aria-label={win ? "Win" : "Loss"}
                    >
                      {win ? (
                        <ArrowUp className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-destructive" strokeWidth={2.5} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">
                            {payload?.pair ?? item.title}
                          </span>
                          {payload?.direction && (
                            <span
                              className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                                payload.direction === "Long"
                                  ? "text-primary bg-primary/10"
                                  : "text-destructive bg-destructive/10",
                              )}
                            >
                              {payload.direction}
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-mono font-semibold tabular-nums shrink-0",
                            win ? "text-primary" : "text-destructive",
                          )}
                        >
                          {formatPnL(pnl)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {formatNotificationTime(item.timestamp)}
                        </span>
                        <span className="text-[11px] text-primary/80">{item.message}</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
            </AnimatePresence>
          </div>
          <button
            type="button"
            onClick={() => openJournal({ filter: "unjournaled", openNotes: false })}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View all
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl px-3 py-2.5 bg-muted/40 animate-pulse">
          <div className="h-3 w-24 rounded bg-muted-foreground/15" />
          <div className="mt-2 h-2.5 w-16 rounded bg-muted-foreground/10" />
        </div>
      ))}
    </div>
  );
}
