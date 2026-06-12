import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Calendar,
  CalendarX2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Zap,
  Activity,
  ChevronLeft,
  ChevronRight,
  History,
  FilterX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Sparkline } from "@/components/Dashboard/Sparkline";
import {
  type EconomicEvent,
  type EconomicImpact,
  type EconomicCalendarResponse,
  countryFlags,
  formatCalendarDate,
  formatCountdown,
  formatEventTime,
  formatLocalTime,
  formatWeekRangeLabel,
  getEventDateTime,
  getEventLocalDateKey,
  getWeekDayCells,
  isEventLive,
  isEventPast,
  startOfWeekMonday,
  toLocalDateKey,
} from "@/lib/economicCalendar";

/* ----------------------------- Filters (persisted) ----------------------------- */

const FILTERS_STORAGE_KEY = "nsync.economicCalendar.filters";

interface CalendarFilters {
  /** Empty array = all currencies. */
  currencies: string[];
  impacts: EconomicImpact[];
  showPast: boolean;
}

const DEFAULT_FILTERS: CalendarFilters = {
  currencies: [],
  impacts: ["low", "medium", "high"],
  showPast: true,
};

function loadFilters(): CalendarFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      currencies: Array.isArray(parsed.currencies) ? parsed.currencies : [],
      impacts:
        Array.isArray(parsed.impacts) && parsed.impacts.length > 0
          ? parsed.impacts
          : DEFAULT_FILTERS.impacts,
      showPast: typeof parsed.showPast === "boolean" ? parsed.showPast : true,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

/* ----------------------------- Data ----------------------------- */

type DayViewMode = "day" | "week" | "all";

async function fetchEconomicCalendar(): Promise<EconomicCalendarResponse> {
  const { data, error } = await supabase.functions.invoke<EconomicCalendarResponse>(
    "economic-calendar",
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data ?? { events: [] };
}

const SOURCE_LABELS: Record<string, string> = {
  forexfactory: "ForexFactory",
  finnhub: "Finnhub",
};

/* ----------------------------- Impact styling ----------------------------- */

const IMPACT_META: Record<
  EconomicImpact,
  { label: string; Icon: typeof Zap; pill: string; row: string }
> = {
  high: {
    label: "High",
    Icon: Zap,
    pill: "text-destructive border-destructive/40 bg-destructive/10",
    // subtle red glow on the left border
    row: "border-l-2 border-l-destructive/70 shadow-[inset_6px_0_12px_-8px_hsl(var(--destructive)/0.8)]",
  },
  medium: {
    label: "Med",
    Icon: Activity,
    pill: "text-amber-500 border-amber-500/40 bg-amber-500/10",
    row: "border-l-2 border-l-amber-500/60 shadow-[inset_6px_0_12px_-9px_rgb(245_158_11/0.7)]",
  },
  low: {
    label: "Low",
    Icon: Minus,
    pill: "text-muted-foreground border-border/60 bg-muted/30",
    row: "border-l-2 border-l-transparent",
  },
};

/* Preferred chip ordering for the currency filter */
const CURRENCY_ORDER = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "NZD", "CHF", "CNY"];

function parseNumeric(v?: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/* =================================================================== */

export function EconomicCalendarView() {
  const [filters, setFilters] = useState<CalendarFilters>(loadFilters);
  const [dayViewMode, setDayViewMode] = useState<DayViewMode>("day");
  const [now, setNow] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));

  // Persist filters
  useEffect(() => {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["economic-calendar"],
    queryFn: fetchEconomicCalendar,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const events = useMemo(() => data?.events ?? [], [data?.events]);
  const lastUpdated = data?.lastUpdated ? new Date(data.lastUpdated) : null;
  const sourceLabel = data?.source ? SOURCE_LABELS[data.source] ?? data.source : null;

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const todayStr = toLocalDateKey(now);
  const weekDays = useMemo(() => getWeekDayCells(weekStart), [weekStart]);
  const weekDateKeys = useMemo(() => new Set(weekDays.map((d) => d.dateKey)), [weekDays]);

  /* Currencies present in the feed, in preferred order */
  const availableCurrencies = useMemo(() => {
    const set = new Set(events.map((e) => e.currency));
    const ordered = CURRENCY_ORDER.filter((c) => set.has(c));
    const extras = [...set].filter((c) => !CURRENCY_ORDER.includes(c)).sort();
    return [...ordered, ...extras];
  }, [events]);

  const toggleCurrency = (ccy: string) => {
    setFilters((prev) => ({
      ...prev,
      currencies: prev.currencies.includes(ccy)
        ? prev.currencies.filter((c) => c !== ccy)
        : [...prev.currencies, ccy],
    }));
  };

  const toggleImpact = (impact: EconomicImpact) => {
    setFilters((prev) => {
      const next = prev.impacts.includes(impact)
        ? prev.impacts.filter((i) => i !== impact)
        : [...prev.impacts, impact];
      // Never allow zero impacts selected — keep at least one
      return { ...prev, impacts: next.length === 0 ? prev.impacts : next };
    });
  };

  const filtersActive =
    filters.currencies.length > 0 || filters.impacts.length < 3 || !filters.showPast;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const eventCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of events) {
      if (!filters.impacts.includes(event.impact)) continue;
      if (filters.currencies.length > 0 && !filters.currencies.includes(event.currency)) continue;
      const dateKey = getEventLocalDateKey(event);
      counts[dateKey] = (counts[dateKey] ?? 0) + 1;
    }
    return counts;
  }, [events, filters]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!filters.impacts.includes(event.impact)) return false;
      if (filters.currencies.length > 0 && !filters.currencies.includes(event.currency))
        return false;
      if (!filters.showPast && isEventPast(event, now) && !isEventLive(event, now)) return false;
      if (dayViewMode === "all") return true;
      const localDate = getEventLocalDateKey(event);
      if (dayViewMode === "week") return weekDateKeys.has(localDate);
      return localDate === selectedDate;
    });
  }, [events, filters, dayViewMode, selectedDate, weekDateKeys, now]);

  /* Flatten into rows: day headers + events + the "now" line */
  type ListRow =
    | { type: "header"; date: string; count: number }
    | { type: "event"; event: EconomicEvent }
    | { type: "now" };

  const listRows = useMemo<ListRow[]>(() => {
    const grouped = new Map<string, EconomicEvent[]>();
    for (const e of filteredEvents) {
      const dateKey = getEventLocalDateKey(e);
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)!.push(e);
    }
    const rows: ListRow[] = [];
    const nowMs = now.getTime();
    for (const [date, dayEvents] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      rows.push({ type: "header", date, count: dayEvents.length });
      const sorted = [...dayEvents].sort(
        (a, b) => getEventDateTime(a).getTime() - getEventDateTime(b).getTime(),
      );
      let nowInserted = date !== todayStr;
      for (const event of sorted) {
        if (!nowInserted && getEventDateTime(event).getTime() > nowMs) {
          rows.push({ type: "now" });
          nowInserted = true;
        }
        rows.push({ type: "event", event });
      }
      if (!nowInserted) rows.push({ type: "now" });
    }
    return rows;
  }, [filteredEvents, now, todayStr]);

  const shiftWeek = (deltaWeeks: number) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaWeeks * 7);
      return startOfWeekMonday(next);
    });
  };

  const highImpactToday = useMemo(
    () => events.filter((e) => getEventLocalDateKey(e) === todayStr && e.impact === "high").length,
    [events, todayStr],
  );

  const useVirtual = filteredEvents.length > 50;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* ============ Header ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight">Economic Calendar</h2>
              <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary text-[10px]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
                Live
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {events.filter((e) => getEventLocalDateKey(e) === todayStr).length} today
              {highImpactToday > 0 && (
                <> · <span className="text-destructive">{highImpactToday} high impact</span></>
              )}
              {" · "}{events.length} this week
              {sourceLabel && <> · via {sourceLabel}</>}
              {lastUpdated && (
                <> · updated {formatLocalTime(lastUpdated)}
                {isFetching && !isLoading ? " · syncing…" : ""}</>
              )}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* ============ Week strip ============ */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-2.5 sm:p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => shiftWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <p className="text-xs font-semibold tabular-nums">{formatWeekRangeLabel(weekStart)}</p>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => shiftWeek(1)} aria-label="Next week">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {weekDays.map((day) => {
            const count = eventCountByDate[day.dateKey] ?? 0;
            const isSelected = dayViewMode === "day" && selectedDate === day.dateKey;
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => { setSelectedDate(day.dateKey); setDayViewMode("day"); }}
                className={cn(
                  "relative flex flex-col items-center rounded-lg border py-1.5 px-0.5 transition-colors",
                  "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/40 bg-transparent text-muted-foreground",
                  day.isToday && !isSelected && "border-primary/30",
                )}
              >
                <span className={cn("text-[9px] font-semibold uppercase tracking-wider", isSelected && "text-primary")}>
                  {day.weekdayShort}
                </span>
                <span className={cn("text-sm font-bold tabular-nums leading-tight", isSelected && "text-primary", day.isToday && "text-primary")}>
                  {day.dayOfMonth}
                </span>
                <span className={cn("text-[9px] tabular-nums", count > 0 ? "text-foreground/70" : "text-muted-foreground/40")}>
                  {count === 0 ? "—" : count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { id: "day" as const, label: "Today" },
            { id: "week" as const, label: "Full week" },
            { id: "all" as const, label: "All events" },
          ]).map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setDayViewMode(mode.id);
                if (mode.id === "day") {
                  setSelectedDate(todayStr);
                  setWeekStart(startOfWeekMonday(now));
                }
              }}
              className={cn(
                "relative px-3 py-1 text-[11px] font-semibold rounded-md transition-colors",
                dayViewMode === mode.id ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {dayViewMode === mode.id && (
                <motion.span
                  layoutId="ecViewMode"
                  className="absolute inset-0 rounded-md bg-primary/10 border border-primary/30"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{mode.label}</span>
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"} shown
          </span>
        </div>
      </div>

      {/* ============ Filter bar ============ */}
      <div className="rounded-xl border border-border/50 bg-card/50 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Currency chips */}
        <div className="flex flex-wrap items-center gap-1">
          {availableCurrencies.map((ccy) => {
            const active = filters.currencies.length === 0 || filters.currencies.includes(ccy);
            const explicit = filters.currencies.includes(ccy);
            return (
              <motion.button
                key={ccy}
                whileTap={{ scale: 0.94 }}
                onClick={() => toggleCurrency(ccy)}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border transition-colors",
                  explicit
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : active
                      ? "border-border/40 bg-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      : "border-border/30 text-muted-foreground/40",
                )}
                title={explicit ? `Showing ${ccy} (click to remove)` : `Filter to ${ccy}`}
              >
                {ccy}
              </motion.button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-border/60 hidden sm:block" />

        {/* Impact pills */}
        <div className="flex items-center gap-1">
          {(["high", "medium", "low"] as const).map((impact) => {
            const meta = IMPACT_META[impact];
            const on = filters.impacts.includes(impact);
            return (
              <motion.button
                key={impact}
                whileTap={{ scale: 0.94 }}
                onClick={() => toggleImpact(impact)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all",
                  on ? meta.pill : "border-border/30 text-muted-foreground/40 grayscale",
                )}
              >
                <meta.Icon className="w-3 h-3" />
                {meta.label}
              </motion.button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-border/60 hidden sm:block" />

        {/* Past toggle */}
        <button
          onClick={() => setFilters((p) => ({ ...p, showPast: !p.showPast }))}
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors",
            filters.showPast
              ? "border-border/60 bg-muted/30 text-foreground"
              : "border-border/30 text-muted-foreground/50",
          )}
        >
          <History className="w-3 h-3" />
          Past events
        </button>

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <FilterX className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* ============ Error ============ */}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 py-5 px-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm text-center">
            {error instanceof Error ? error.message : "Failed to load calendar"}
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {/* ============ Loading skeleton ============ */}
      {isLoading && !events.length && (
        <div className="rounded-xl border border-border/50 bg-card/50 divide-y divide-border/30 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-4 flex-1 max-w-[300px]" />
              <Skeleton className="h-4 w-40 hidden sm:block" />
            </div>
          ))}
        </div>
      )}

      {/* ============ Empty state ============ */}
      {!isLoading && !error && listRows.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/50 bg-card/50 py-14 flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center mb-4">
            <CalendarX2 className="w-7 h-7 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium">No events match your filters</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Try another day, a different impact level, or clear your filters.
          </p>
          {filtersActive && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5">
              <FilterX className="w-3.5 h-3.5" />
              Clear filters
            </Button>
          )}
        </motion.div>
      )}

      {/* ============ Event list ============ */}
      {listRows.length > 0 && (
        useVirtual ? (
          <VirtualEventList rows={listRows} now={now} />
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
            <AnimatePresence mode="popLayout">
              {listRows.map((row, i) =>
                row.type === "header" ? (
                  <DayHeader key={`h-${row.date}`} date={row.date} count={row.count} sticky />
                ) : row.type === "now" ? (
                  <NowLine key={`now-${i}`} now={now} />
                ) : (
                  <motion.div
                    key={row.event.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.05 } }}
                    exit={{ opacity: 0 }}
                  >
                    <EventRow event={row.event} now={now} />
                  </motion.div>
                ),
              )}
            </AnimatePresence>
          </div>
        )
      )}
    </div>
  );
}

/* ----------------------------- Virtualized list ----------------------------- */

function VirtualEventList({
  rows,
  now,
}: {
  rows: ({ type: "header"; date: string; count: number } | { type: "event"; event: EconomicEvent } | { type: "now" })[];
  now: Date;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i].type === "header" ? 40 : rows[i].type === "now" ? 28 : 56),
    overscan: 12,
  });

  return (
    <div
      ref={scrollRef}
      className="rounded-xl border border-border/50 bg-card/50 overflow-y-auto custom-scrollbar max-h-[70vh]"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const row = rows[vi.index];
          return (
            <div
              key={vi.key}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {row.type === "header" ? (
                <DayHeader date={row.date} count={row.count} />
              ) : row.type === "now" ? (
                <NowLine now={now} />
              ) : (
                <EventRow event={row.event} now={now} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------- Day header ----------------------------- */

function DayHeader({ date, count, sticky = false }: { date: string; count: number; sticky?: boolean }) {
  return (
    <div
      className={cn(
        "relative px-4 py-2 bg-background/95 backdrop-blur-sm flex items-baseline gap-2 border-b border-border/30",
        sticky && "sticky top-0 z-10",
      )}
    >
      <h3 className="text-sm font-bold tracking-tight">{formatCalendarDate(date)}</h3>
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {count} event{count === 1 ? "" : "s"}
      </span>
      {/* soft gradient underline */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-primary/50 via-primary/15 to-transparent"
      />
    </div>
  );
}

/* ----------------------------- "Now" indicator ----------------------------- */

function NowLine({ now }: { now: Date }) {
  return (
    <div className="relative flex items-center gap-2 px-4 py-1.5" aria-label="Current time">
      <motion.span
        className="w-2 h-2 rounded-full bg-primary shrink-0"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: "0 0 8px hsl(var(--primary))" }}
      />
      <div className="flex-1 h-px bg-gradient-to-r from-primary/70 via-primary/30 to-transparent" />
      <span className="text-[10px] font-mono font-semibold text-primary tabular-nums shrink-0">
        {formatLocalTime(now)}
      </span>
    </div>
  );
}

/* ----------------------------- Event row ----------------------------- */

function surpriseDirection(actual?: string, forecast?: string) {
  const a = parseNumeric(actual);
  const f = parseNumeric(forecast);
  if (a == null || f == null) return null;
  if (a > f) return "up";
  if (a < f) return "down";
  return "flat";
}

function EventRow({ event, now }: { event: EconomicEvent; now: Date }) {
  const past = isEventPast(event, now);
  const live = isEventLive(event, now);
  const released = Boolean(event.actual?.trim());
  const meta = IMPACT_META[event.impact];
  const direction = surpriseDirection(event.actual, event.forecast);
  const dt = getEventDateTime(event);
  const msUntil = dt.getTime() - now.getTime();

  // Mini sparkline from previous → forecast → actual when numeric
  const sparkData = useMemo(() => {
    const pts = [parseNumeric(event.previous), parseNumeric(event.forecast), parseNumeric(event.actual)]
      .filter((n): n is number => n != null);
    return pts.length >= 2 ? pts : null;
  }, [event.previous, event.forecast, event.actual]);

  return (
    <div
      className={cn(
        "group px-3 sm:px-4 py-2.5 border-b border-border/20 transition-colors hover:bg-muted/20",
        meta.row,
        live && "bg-primary/[0.04]",
        past && !released && !live && "opacity-55",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
        {/* Time + flag + currency */}
        <div className="flex items-center gap-3 sm:w-[168px] shrink-0">
          <span className={cn(
            "font-mono text-base font-semibold tabular-nums leading-none",
            past && !live ? "text-muted-foreground" : "text-foreground",
            live && "text-primary",
          )}>
            {formatEventTime(event)}
          </span>
          <span className="text-base leading-none">{countryFlags[event.countryCode] || "🌍"}</span>
          <span className="font-mono text-[11px] font-bold text-muted-foreground">{event.currency}</span>
          {live && (
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-destructive">
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-destructive"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              Live
            </span>
          )}
        </div>

        {/* Title + impact */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{event.title}</p>
          <span className={cn(
            "hidden sm:inline-flex items-center gap-1 px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider border shrink-0",
            meta.pill,
          )}>
            <meta.Icon className="w-2.5 h-2.5" />
            {meta.label}
          </span>
          {!past && !live && msUntil > 0 && msUntil < 24 * 3600 * 1000 && (
            <span className="hidden lg:inline text-[10px] text-muted-foreground tabular-nums shrink-0">
              in {formatCountdown(msUntil)}
            </span>
          )}
        </div>

        {/* Values: actual / forecast / previous + sparkline */}
        <div className="flex items-center gap-3 sm:gap-2 shrink-0">
          <span className={cn(
            "sm:hidden inline-flex items-center gap-1 px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider border",
            meta.pill,
          )}>
            <meta.Icon className="w-2.5 h-2.5" />
            {meta.label}
          </span>
          <div className="grid grid-cols-3 gap-x-3 text-right tabular-nums">
            <ValueCell
              label="Act"
              value={event.actual}
              className={cn(
                released && direction === "up" && "text-primary",
                released && direction === "down" && "text-destructive",
                released && !direction && "text-foreground",
              )}
            />
            <ValueCell label="Fcst" value={event.forecast} />
            <ValueCell label="Prev" value={event.previous} />
          </div>
          {direction === "up" && <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />}
          {direction === "down" && <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />}
          {sparkData && (
            <Sparkline
              data={sparkData}
              width={44}
              height={16}
              positive={direction !== "down"}
              className="hidden md:block opacity-70 shrink-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ValueCell({ label, value, className }: { label: string; value?: string; className?: string }) {
  return (
    <div className="min-w-[52px]">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 leading-none mb-0.5">{label}</p>
      <p className={cn("font-mono text-xs font-semibold leading-none", className ?? "text-muted-foreground")}>
        {value?.trim() || "–"}
      </p>
    </div>
  );
}
