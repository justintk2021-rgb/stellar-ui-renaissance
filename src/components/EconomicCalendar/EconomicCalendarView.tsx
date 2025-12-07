import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Calendar, Clock, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  countryCode: string;
  date: string;
  time: string;
  impact: "low" | "medium" | "high";
  actual?: string;
  forecast?: string;
  previous?: string;
  currency: string;
}

const impactColors = {
  low: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  medium: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  high: "bg-red-500/20 text-red-400 border-red-500/50",
};

const impactDots = {
  low: "bg-yellow-400",
  medium: "bg-orange-400",
  high: "bg-red-400",
};

const countryFlags: Record<string, string> = {
  US: "🇺🇸",
  GB: "🇬🇧",
  EU: "🇪🇺",
  JP: "🇯🇵",
  AU: "🇦🇺",
  CA: "🇨🇦",
  NZ: "🇳🇿",
  CH: "🇨🇭",
  CN: "🇨🇳",
  DE: "🇩🇪",
  FR: "🇫🇷",
};

export function EconomicCalendarView() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "medium" | "high">("all");

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('economic-calendar');
      
      if (fnError) {
        throw new Error(fnError.message);
      }
      
      if (data?.events) {
        setEvents(data.events);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching economic calendar:', err);
      setError('Failed to load economic calendar data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = events.filter(event => 
    filter === "all" || event.impact === filter
  );

  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const date = event.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, EconomicEvent[]>);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (dateStr === today.toISOString().split('T')[0]) {
      return "Today";
    } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
      return "Tomorrow";
    }
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const getValueIndicator = (actual?: string, forecast?: string) => {
    if (!actual || !forecast) return null;
    
    const actualNum = parseFloat(actual.replace(/[%K]/g, ''));
    const forecastNum = parseFloat(forecast.replace(/[%K]/g, ''));
    
    if (isNaN(actualNum) || isNaN(forecastNum)) return null;
    
    if (actualNum > forecastNum) {
      return <TrendingUp className="w-4 h-4 text-green-400" />;
    } else if (actualNum < forecastNum) {
      return <TrendingDown className="w-4 h-4 text-red-400" />;
    }
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Economic Calendar</h2>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEvents}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Impact Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All Events
        </Button>
        <Button
          variant={filter === "high" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("high")}
          className="gap-2"
        >
          <span className={cn("w-2 h-2 rounded-full", impactDots.high)} />
          High Impact
        </Button>
        <Button
          variant={filter === "medium" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("medium")}
          className="gap-2"
        >
          <span className={cn("w-2 h-2 rounded-full", impactDots.medium)} />
          Medium Impact
        </Button>
        <Button
          variant={filter === "low" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("low")}
          className="gap-2"
        >
          <span className={cn("w-2 h-2 rounded-full", impactDots.low)} />
          Low Impact
        </Button>
      </div>

      {/* Legend */}
      <Card className="glass-strong border-border/50">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted-foreground">Impact Level:</span>
            <div className="flex items-center gap-2">
              <span className={cn("w-3 h-3 rounded-full", impactDots.low)} />
              <span className="text-yellow-400">Low</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("w-3 h-3 rounded-full", impactDots.medium)} />
              <span className="text-orange-400">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("w-3 h-3 rounded-full", impactDots.high)} />
              <span className="text-red-400">High</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="glass-strong border-destructive/50">
          <CardContent className="py-6 flex items-center justify-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchEvents}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
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

      {/* Events by Date */}
      {!isLoading && !error && Object.keys(groupedEvents).length === 0 && (
        <Card className="glass-strong border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No economic events found for the selected filter.</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <Card key={date} className="glass-strong border-border/50 overflow-hidden">
          <CardHeader className="pb-2 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {formatDate(date)}
              <Badge variant="secondary" className="ml-auto">
                {dateEvents.length} events
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {dateEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Time & Country */}
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="text-sm font-mono">{event.time}</span>
                      </div>
                      <span className="text-lg">
                        {countryFlags[event.countryCode] || "🌍"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {event.currency}
                      </Badge>
                    </div>

                    {/* Impact Indicator */}
                    <div className={cn(
                      "w-3 h-3 rounded-full shrink-0",
                      impactDots[event.impact]
                    )} />

                    {/* Event Title */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.country}</p>
                    </div>

                    {/* Values */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center min-w-[60px]">
                        <p className="text-[10px] uppercase text-muted-foreground">Actual</p>
                        <p className={cn(
                          "font-mono font-medium",
                          event.actual ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {event.actual || "-"}
                        </p>
                      </div>
                      <div className="text-center min-w-[60px]">
                        <p className="text-[10px] uppercase text-muted-foreground">Forecast</p>
                        <p className="font-mono text-muted-foreground">
                          {event.forecast || "-"}
                        </p>
                      </div>
                      <div className="text-center min-w-[60px]">
                        <p className="text-[10px] uppercase text-muted-foreground">Previous</p>
                        <p className="font-mono text-muted-foreground">
                          {event.previous || "-"}
                        </p>
                      </div>
                      {getValueIndicator(event.actual, event.forecast)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
