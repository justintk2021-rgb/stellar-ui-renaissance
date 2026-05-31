import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Radio,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  type EconomicEvent,
  type EconomicImpact,
  type EconomicCalendarResponse,
  countryFlags,
  formatCalendarDate,
  formatCountdown,
  formatWeekRangeLabel,
  getEventDateTime,
  getWeekDayCells,
  isEventLive,
  isEventPast,
  startOfWeekMonday,
  toLocalDateKey,
} from "@/lib/economicCalendar";

const impactColors: Record<EconomicImpact, string> = {
  low: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  medium: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  high: "bg-red-500/20 text-red-400 border-red-500/50",
};

const impactDots: Record<EconomicImpact, string> = {
  low: "bg-yellow-400",
  medium: "bg-orange-400",
  high: "bg-red-400",
};

type ImpactFilter = "all" | EconomicImpact;
type DayViewMode = "day" | "week" | "all";

async function fetchEconomicCalendar(): Promise<EconomicCalendarResponse> {
  const { data, error } = await supabase.functions.invoke<EconomicCalendarResponse>(
    "economic-calendar",
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data ?? { events: [] };
}

function getValueIndicator(actual?: string, forecast?: string) {
  if (!actual || !forecast) return null;
  const actualNum = parseFloat(actual.replace(/[%KMB]/gi, ""));
  const forecastNum = parseFloat(forecast.replace(/[%KMB]/gi, ""));
  if (Number.isNaN(actualNum) || Number.isNaN(forecastNum)) return null;
  if (actualNum > forecastNum) return <TrendingUp className="w-4 h-4 text-green-400" />;
  if (actualNum < forecastNum) return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export function EconomicCalendarView() {
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [dayViewMode, setDayViewMode] = useState<DayViewMode>("day");
  const [now, setNow] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["economic-calendar"],
    queryFn: fetchEconomicCalendar,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const events = data?.events ?? [];
  const lastUpdated = data?.lastUpdated ? new Date(data.lastUpdated) : null;
  const source = data?.source;

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const todayStr = toLocalDateKey(now);
  const weekDays = useMemo(() => getWeekDayCells(weekStart), [weekStart]);
  const weekDateKeys = useMemo(
    () => new Set(weekDays.map((d) => d.dateKey)),
    [weekDays],
  );

  const eventCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of events) {
      if (impactFilter !== "all" && event.impact !== impactFilter) continue;
      counts[event.date] = (counts[event.date] ?? 0) + 1;
    }
    return counts;
  }, [events, impactFilter]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (impactFilter !== "all" && event.impact !== impactFilter) return false;
      if (dayViewMode === "all") return true;
      if (dayViewMode === "week") return weekDateKeys.has(event.date);
      return event.date === selectedDate;
    });
  }, [events, impactFilter, dayViewMode, selectedDate, weekDateKeys]);

  const shiftWeek = (deltaWeeks: number) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaWeeks * 7);
      return startOfWeekMonday(next);
    });
  };

  const goToThisWeek = () => {
    const start = startOfWeekMonday(now);
    setWeekStart(start);
    setSelectedDate(todayStr);
    setDayViewMode("day");
  };

  const selectDay = (dateKey: string) => {
    setSelectedDate(dateKey);
    setDayViewMode("day");
  };

  const upcoming = useMemo(() => {
    return events
      .filter((e) => !isEventPast(e, now) && e.impact !== "low")
      .sort((a, b) => getEventDateTime(a).getTime() - getEventDateTime(b).getTime())
      .slice(0, 4);
  }, [events, now]);

  const liveNow = useMemo(
    () => events.find((e) => isEventLive(e, now)),
    [events, now],
  );

  const groupedEvents = useMemo(() => {
    return filteredEvents.reduce(
      (acc, event) => {
        if (!acc[event.date]) acc[event.date] = [];
        acc[event.date].push(event);
        return acc;
      },
      {} as Record<string, EconomicEvent[]>,
    );
  }, [filteredEvents]);

  const highImpactToday = useMemo(
    () =>
      events.filter((e) => e.date === todayStr && e.impact === "high").length,
    [events, todayStr],
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">Economic Calendar</h2>
              <Badge
                variant="outline"
                className="gap-1 border-primary/40 text-primary text-[10px]"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Live
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {source && <span>{source}</span>}
              {lastUpdated && (
                <span>
                  {source ? " · " : ""}
                  Updated {lastUpdated.toLocaleTimeString()}
                  {isFetching && !isLoading ? " · syncing…" : ""}
                </span>
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

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass-strong border-border/50">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] uppercase text-muted-foreground">Today</p>
            <p className="text-lg font-bold">{events.filter((e) => e.date === todayStr).length}</p>
          </CardContent>
        </Card>
        <Card className="glass-strong border-border/50">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] uppercase text-muted-foreground">High impact today</p>
            <p className="text-lg font-bold text-red-400">{highImpactToday}</p>
          </CardContent>
        </Card>
        <Card className="glass-strong border-border/50">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] uppercase text-muted-foreground">Upcoming</p>
            <p className="text-lg font-bold">{upcoming.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-strong border-border/50">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] uppercase text-muted-foreground">This week</p>
            <p className="text-lg font-bold">{events.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Live / next up */}
      {(liveNow || upcoming.length > 0) && (
        <Card className="glass-strong border-primary/30 overflow-hidden">
          <CardHeader className="py-3 bg-primary/5">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              {liveNow ? "Happening now" : "Coming up"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/30">
            {liveNow && (
              <UpcomingRow event={liveNow} now={now} badge="Live" badgeClass="bg-red-500/20 text-red-400" />
            )}
            {upcoming
              .filter((e) => e.id !== liveNow?.id)
              .map((event) => (
                <UpcomingRow key={event.id} event={event} now={now} />
              ))}
          </CardContent>
        </Card>
      )}

      {/* Week day picker */}
      <Card className="glass-strong border-border/50 overflow-hidden">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => shiftWeek(-1)}
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{formatWeekRangeLabel(weekStart)}</p>
              <p className="text-[10px] text-muted-foreground">Tap a day to view its releases</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => shiftWeek(1)}
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {weekDays.map((day) => {
              const count = eventCountByDate[day.dateKey] ?? 0;
              const isSelected = dayViewMode === "day" && selectedDate === day.dateKey;
              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => selectDay(day.dateKey)}
                  className={cn(
                    "flex flex-col items-center rounded-lg border py-2 px-0.5 sm:px-1 transition-colors",
                    "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary/15 text-foreground shadow-sm"
                      : "border-border/50 bg-muted/10 text-muted-foreground",
                    day.isToday && !isSelected && "border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] sm:text-xs font-medium uppercase tracking-wide",
                      isSelected && "text-primary",
                    )}
                  >
                    {day.weekdayShort}
                  </span>
                  <span
                    className={cn(
                      "text-base sm:text-lg font-bold tabular-nums leading-tight mt-0.5",
                      isSelected && "text-primary",
                      day.isToday && "underline decoration-primary decoration-2 underline-offset-2",
                    )}
                  >
                    {day.dayOfMonth}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] sm:text-[10px] mt-1 tabular-nums",
                      count > 0 ? "text-foreground/80" : "text-muted-foreground/60",
                    )}
                  >
                    {count === 0 ? "—" : `${count} evt`}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            <Button
              variant={dayViewMode === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDayViewMode("day");
                setSelectedDate(todayStr);
                setWeekStart(startOfWeekMonday(now));
              }}
            >
              Today
            </Button>
            <Button
              variant={dayViewMode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setDayViewMode("week")}
            >
              Full week
            </Button>
            <Button
              variant={dayViewMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setDayViewMode("all")}
            >
              All events
            </Button>
            {toLocalDateKey(weekStart) !== toLocalDateKey(startOfWeekMonday(now)) && (
              <Button variant="ghost" size="sm" onClick={goToThisWeek}>
                This week
              </Button>
            )}
          </div>

          {dayViewMode === "day" && (
            <p className="text-xs text-center sm:text-left text-muted-foreground">
              Showing <span className="font-medium text-foreground">{formatCalendarDate(selectedDate)}</span>
              {" · "}
              {filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"}
            </p>
          )}
          {dayViewMode === "week" && (
            <p className="text-xs text-center sm:text-left text-muted-foreground">
              Showing all {filteredEvents.length} events for {formatWeekRangeLabel(weekStart)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Impact filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={impactFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setImpactFilter("all")}
        >
          All impact
        </Button>
        {(["high", "medium", "low"] as const).map((level) => (
          <Button
            key={level}
            variant={impactFilter === level ? "default" : "outline"}
            size="sm"
            onClick={() => setImpactFilter(level)}
            className="gap-2 capitalize"
          >
            <span className={cn("w-2 h-2 rounded-full", impactDots[level])} />
            {level}
          </Button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Card className="glass-strong border-destructive/50">
          <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm text-center">
              {error instanceof Error ? error.message : "Failed to load calendar"}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && !events.length && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="glass-strong border-border/50">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && Object.keys(groupedEvents).length === 0 && (
        <Card className="glass-strong border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              No events for {dayViewMode === "day" ? formatCalendarDate(selectedDate) : "this view"}.
              Try another day, &quot;Full week&quot;, or &quot;All events&quot;.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Events by date */}
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <Card key={date} className="glass-strong border-border/50 overflow-hidden">
          <CardHeader className="pb-2 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {formatCalendarDate(date)}
              <Badge variant="secondary" className="ml-auto">
                {dateEvents.length} events
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {dateEvents.map((event) => (
                <EventRow key={event.id} event={event} now={now} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UpcomingRow({
  event,
  now,
  badge,
  badgeClass,
}: {
  event: EconomicEvent;
  now: Date;
  badge?: string;
  badgeClass?: string;
}) {
  const dt = getEventDateTime(event);
  const ms = dt.getTime() - now.getTime();
  const released = Boolean(event.actual?.trim());

  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
      <span className="text-lg">{countryFlags[event.countryCode] || "🌍"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{event.title}</p>
        <p className="text-xs text-muted-foreground">
          {event.time} · {event.currency}
          {!released && ms > 0 && ` · in ${formatCountdown(ms)}`}
        </p>
      </div>
      {badge ? (
        <Badge className={cn("text-[10px]", badgeClass)}>{badge}</Badge>
      ) : (
        <Badge variant="outline" className={cn("text-[10px]", impactColors[event.impact])}>
          {event.impact}
        </Badge>
      )}
    </div>
  );
}

function EventRow({ event, now }: { event: EconomicEvent; now: Date }) {
  const past = isEventPast(event, now);
  const live = isEventLive(event, now);
  const released = Boolean(event.actual?.trim());

  return (
    <div
      className={cn(
        "p-4 hover:bg-muted/20 transition-colors",
        live && "bg-primary/5",
        past && !released && "opacity-70",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-[150px]">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-sm font-mono">{event.time}</span>
          </div>
          <span className="text-lg">{countryFlags[event.countryCode] || "🌍"}</span>
          <Badge variant="outline" className="text-xs">
            {event.currency}
          </Badge>
          {live && (
            <Badge className="text-[10px] gap-0.5 bg-red-500/20 text-red-400 border-red-500/40">
              <Zap className="w-3 h-3" /> Live
            </Badge>
          )}
          {released && (
            <Badge variant="secondary" className="text-[10px]">
              Released
            </Badge>
          )}
        </div>

        <div className={cn("w-3 h-3 rounded-full shrink-0", impactDots[event.impact])} />

        <div className="flex-1 min-w-0">
          <p className="font-medium">{event.title}</p>
          <p className="text-xs text-muted-foreground">{event.country}</p>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <ValueCell label="Actual" value={event.actual} highlight={released} />
          <ValueCell label="Forecast" value={event.forecast} />
          <ValueCell label="Previous" value={event.previous} />
          {getValueIndicator(event.actual, event.forecast)}
        </div>
      </div>
    </div>
  );
}

function ValueCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center min-w-[60px]">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono font-medium",
          highlight ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {value?.trim() || "-"}
      </p>
    </div>
  );
}
