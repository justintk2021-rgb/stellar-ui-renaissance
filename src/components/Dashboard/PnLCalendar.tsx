import { useState } from "react";
import { Trade, DailyStats } from "@/types/trade";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PnLCalendarProps {
  trades: Trade[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PnLCalendar({ trades }: PnLCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const dailyStats: Record<string, DailyStats> = {};
  trades.forEach((trade) => {
    if (!trade.date) return;
    if (!dailyStats[trade.date]) {
      dailyStats[trade.date] = { pnl: 0, trades: 0 };
    }
    dailyStats[trade.date].pnl += trade.result || 0;
    dailyStats[trade.date].trades += 1;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  return (
    <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">PnL Calendar</h3>
          <p className="text-xs text-muted-foreground mt-1">Daily profit/loss overview</p>
        </div>
        <Badge variant="outline" className="border-secondary/40 text-muted-foreground text-xs">
          Calendar
        </Badge>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={prevMonth}
          className="w-8 h-8 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/10"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="px-4 py-1.5 rounded-full border border-border/50 bg-muted/30 text-sm font-medium min-w-[140px] text-center">
          {MONTH_NAMES[month]} {year}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={nextMonth}
          className="w-8 h-8 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/10"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {DAY_NAMES.map((day) => (
          <div key={day} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground pb-2">
            {day}
          </div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const stat = dailyStats[dateStr];

          return (
            <div
              key={day}
              className={cn(
                "min-h-[72px] rounded-xl border p-2 flex flex-col gap-1 transition-all duration-200",
                stat
                  ? stat.pnl > 0
                    ? "calendar-cell-positive"
                    : stat.pnl < 0
                    ? "calendar-cell-negative"
                    : "calendar-cell-flat"
                  : "border-border/30 bg-muted/20 hover:bg-muted/40"
              )}
            >
              <span className="text-xs text-muted-foreground">{day}</span>
              {stat && (
                <>
                  <span className={cn(
                    "text-sm font-bold font-mono",
                    stat.pnl > 0 ? "text-primary" : stat.pnl < 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {stat.pnl > 0 ? '+' : ''}{stat.pnl.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {stat.trades} trade{stat.trades !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
