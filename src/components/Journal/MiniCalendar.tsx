import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, GitCompare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWithinInterval,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IOSDatePicker } from "./IOSDatePicker";

interface DayPnL {
  date: string;
  pnl: number;
}

interface CustomRange {
  start: Date;
  end: Date;
}

interface MiniCalendarProps {
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
  dayPnLs?: DayPnL[];
  onRangeChange?: (range: { start: Date; end: Date } | null) => void;
}

export function MiniCalendar({ selectedDate, onSelectDate, dayPnLs = [], onRangeChange }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [direction, setDirection] = useState(0);

  // Custom date-range popover state
  const [customOpen, setCustomOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [draftEnd, setDraftEnd] = useState<Date>(new Date());
  const [appliedRange, setAppliedRange] = useState<CustomRange | null>(null);

  // Create a map for quick lookup
  const pnlMap = new Map(dayPnLs.map((d) => [d.date, d.pnl]));

  // Boundary months for the applied custom range (first day of month).
  const rangeMinMonth = appliedRange ? startOfMonth(appliedRange.start) : null;
  const rangeMaxMonth = appliedRange ? startOfMonth(appliedRange.end) : null;
  const canGoPrev = !rangeMinMonth || startOfMonth(currentMonth) > rangeMinMonth;
  const canGoNext = !rangeMaxMonth || startOfMonth(currentMonth) < rangeMaxMonth;

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setDirection(-1);
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    setDirection(1);
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleApplyCustom = () => {
    // Normalize: ensure start <= end
    const [s, e] = draftStart <= draftEnd ? [draftStart, draftEnd] : [draftEnd, draftStart];
    const start = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    setAppliedRange({ start, end });
    setCurrentMonth(start);
    setCustomOpen(false);
    onRangeChange?.({ start, end });
    toast.success(`Showing ${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`);
  };

  const clearCustomRange = () => {
    setAppliedRange(null);
    onRangeChange?.(null);
    toast.info("Custom range cleared");
  };

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            canGoPrev ? "hover:bg-muted" : "opacity-30 cursor-not-allowed",
          )}
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <AnimatePresence mode="wait">
          <motion.span
            key={format(currentMonth, "yyyy-MM")}
            initial={{ opacity: 0, y: direction * 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction * -10 }}
            transition={{ duration: 0.2 }}
            className="text-sm font-medium"
          >
            {format(currentMonth, "MMMM yyyy")}
          </motion.span>
        </AnimatePresence>
        <button
          onClick={handleNextMonth}
          disabled={!canGoNext}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            canGoNext ? "hover:bg-muted" : "opacity-30 cursor-not-allowed",
          )}
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    return (
      <div className="grid grid-cols-7 gap-1 mb-2">
        {days.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const dateStr = format(day, "yyyy-MM-dd");
        const dayPnL = pnlMap.get(dateStr);
        const hasTrade = dayPnL !== undefined;
        const isWinning = hasTrade && dayPnL > 0;
        const isLosing = hasTrade && dayPnL < 0;
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isToday = isSameDay(day, new Date());
        const inRange =
          appliedRange &&
          isWithinInterval(day, { start: appliedRange.start, end: appliedRange.end });
        const isRangeStart = appliedRange && isSameDay(day, appliedRange.start);
        const isRangeEnd = appliedRange && isSameDay(day, appliedRange.end);
        const isOutOfRange = !!appliedRange && !inRange;

        days.push(
          <button
            key={day.toString()}
            onClick={() => !isOutOfRange && onSelectDate?.(cloneDay)}
            disabled={isOutOfRange}
            className={cn(
              "relative aspect-square flex items-center justify-center text-xs rounded-md transition-all",
              !isCurrentMonth && "text-muted-foreground/40",
              isCurrentMonth && !hasTrade && !isOutOfRange && "text-foreground hover:bg-muted",
              isToday && !isSelected && !hasTrade && !isOutOfRange && "bg-primary/15 text-primary font-semibold",
              isSelected && !isOutOfRange && "bg-primary text-primary-foreground font-semibold",
              // Accent pill for any day with trades; date number inherits win/loss semantic color
              hasTrade && !isSelected && !isOutOfRange && "bg-primary/15 font-medium",
              hasTrade && !isSelected && !isOutOfRange && isWinning && "text-emerald-500",
              hasTrade && !isSelected && !isOutOfRange && isLosing && "text-red-500",
              hasTrade && !isSelected && !isOutOfRange && dayPnL === 0 && "text-foreground",
              // Soft per-day tint for custom range (no continuous line)
              inRange && !isSelected && !hasTrade && "bg-primary/15 text-primary",
              inRange && !isSelected && hasTrade && "ring-1 ring-inset ring-primary/40",
              (isRangeStart || isRangeEnd) && !isSelected && "bg-primary/25 text-primary font-semibold",
              isOutOfRange && "text-muted-foreground/30 opacity-40 cursor-not-allowed",
            )}
          >
            {format(day, "d")}
            {hasTrade && !isSelected && !isOutOfRange && (
              <span
                className={cn(
                  "absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                  isWinning && "bg-emerald-500",
                  isLosing && "bg-red-500",
                  dayPnL === 0 && "bg-muted-foreground",
                )}
              />
            )}
          </button>,
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-1">
          {days}
        </div>,
      );
      days = [];
    }
    return rows;
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 20 : -20, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -20 : 20, opacity: 0 }),
  };

  return (
    <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm overflow-hidden">
      {renderHeader()}
      {renderDays()}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={format(currentMonth, "yyyy-MM")}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="space-y-1"
        >
          {renderCells()}
        </motion.div>
      </AnimatePresence>

      {/* Active range chip */}
      <AnimatePresence>
        {appliedRange && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5"
          >
            <span className="text-[11px] text-foreground tabular-nums truncate">
              {format(appliedRange.start, "MMM d")} – {format(appliedRange.end, "MMM d, yyyy")}
            </span>
            <button
              onClick={clearCustomRange}
              className="p-0.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear range"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom + Compare action buttons */}
      <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-2">
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-colors",
                appliedRange
                  ? "bg-primary/15 text-primary hover:bg-primary/20"
                  : "bg-muted/50 hover:bg-muted text-foreground",
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Custom
            </motion.button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            sideOffset={8}
            className="w-auto p-4 rounded-2xl border-border/60 shadow-xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Custom range</span>
                <button
                  onClick={() => setCustomOpen(false)}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-start gap-4">
                <IOSDatePicker
                  label="Start date"
                  value={draftStart}
                  onChange={setDraftStart}
                />
                <div className="w-px self-stretch bg-border/40 mt-6" />
                <IOSDatePicker
                  label="End date"
                  value={draftEnd}
                  onChange={setDraftEnd}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {format(draftStart, "MMM d, yyyy")} → {format(draftEnd, "MMM d, yyyy")}
                </span>
                <div className="flex items-center gap-2">
                  {appliedRange && (
                    <button
                      onClick={() => {
                        clearCustomRange();
                        setCustomOpen(false);
                      }}
                      className="h-8 px-3 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleApplyCustom}
                    className="h-8 px-4 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Apply
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </PopoverContent>
        </Popover>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => toast.info("Compare months coming soon")}
          className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors"
        >
          <GitCompare className="w-3.5 h-3.5 text-muted-foreground" />
          Compare
        </motion.button>
      </div>
    </div>
  );
}
