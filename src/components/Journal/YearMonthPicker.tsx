import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, GitCompare } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface MonthSelection {
  /** 0–11 */
  month: number;
  year: number;
}

interface DayPnL {
  date: string;
  pnl: number;
}

interface YearMonthPickerProps {
  /** Whether the overlay is open */
  open: boolean;
  /** Year to default to when opening */
  initialYear?: number;
  /** P&L per day (YYYY-MM-DD) — used for trade-day highlighting / win-loss dots */
  dayPnLs?: DayPnL[];
  /** Cancel/close (Escape, outside click, ✕) */
  onClose: () => void;
  /** Confirm with exactly two months selected */
  onConfirm: (a: MonthSelection, b: MonthSelection) => void;
}

const monthLabel = (m: number, y: number) =>
  format(new Date(y, m, 1), "MMMM yyyy");

const monthShortLabel = (m: number, y: number) =>
  format(new Date(y, m, 1), "MMM yyyy");

const sameSel = (a: MonthSelection, b: MonthSelection) =>
  a.month === b.month && a.year === b.year;

/**
 * Year-view month picker. Renders in place of the standard mini calendar
 * (the parent hides the mini-calendar visually while this is open) and lets
 * the user pick TWO months to compare. Selection is FIFO at max=2.
 */
export function YearMonthPicker({
  open,
  initialYear,
  dayPnLs = [],
  onClose,
  onConfirm,
}: YearMonthPickerProps) {
  const [year, setYear] = useState<number>(
    initialYear ?? new Date().getFullYear(),
  );
  const [direction, setDirection] = useState(0);
  const [selected, setSelected] = useState<MonthSelection[]>([]);

  // Reset to current year + clear selection whenever the picker is opened.
  useEffect(() => {
    if (open) {
      setYear(initialYear ?? new Date().getFullYear());
      setSelected([]);
      setDirection(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const pnlMap = useMemo(
    () => new Map(dayPnLs.map((d) => [d.date, d.pnl])),
    [dayPnLs],
  );

  const handlePrevYear = () => {
    setDirection(-1);
    setYear((y) => y - 1);
  };
  const handleNextYear = () => {
    setDirection(1);
    setYear((y) => y + 1);
  };

  const isMonthSelected = (m: number, y: number) =>
    selected.some((s) => s.month === m && s.year === y);

  const toggleMonth = (m: number, y: number) => {
    const next: MonthSelection = { month: m, year: y };
    setSelected((prev) => {
      const existingIdx = prev.findIndex((s) => sameSel(s, next));
      if (existingIdx !== -1) {
        // Deselect
        return prev.filter((_, i) => i !== existingIdx);
      }
      if (prev.length < 2) return [...prev, next];
      // FIFO: drop oldest, append new
      return [prev[1], next];
    });
  };

  const removeSelection = (sel: MonthSelection) => {
    setSelected((prev) => prev.filter((s) => !sameSel(s, sel)));
  };

  const canConfirm = selected.length === 2;

  const handleConfirm = () => {
    if (!canConfirm) return;
    // Sort chronologically so the older month is always Period A.
    const sorted = [...selected].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    onConfirm(sorted[0], sorted[1]);
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 20 : -20, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -20 : 20, opacity: 0 }),
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Outside-click backdrop — invisible, just catches clicks */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Popover panel — replaces the mini calendar in place */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-50 p-4 rounded-xl bg-card/95 backdrop-blur-sm border border-border/40 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: year nav + close */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={handlePrevYear}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                aria-label="Previous year"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <AnimatePresence mode="wait">
                <motion.span
                  key={year}
                  initial={{ opacity: 0, y: direction * 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: direction * -8 }}
                  transition={{ duration: 0.18 }}
                  className="text-sm font-semibold tabular-nums"
                >
                  {year}
                </motion.span>
              </AnimatePresence>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNextYear}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Next year"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Year grid: 4 cols × 3 rows of mini month tiles */}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={year}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="grid grid-cols-4 gap-2"
              >
                {Array.from({ length: 12 }, (_, m) => (
                  <MonthTile
                    key={m}
                    month={m}
                    year={year}
                    selected={isMonthSelected(m, year)}
                    onClick={() => toggleMonth(m, year)}
                    pnlMap={pnlMap}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Selection chips */}
            <div className="mt-3 min-h-[28px] flex flex-wrap items-center gap-1.5">
              {selected.length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  No months selected
                </span>
              )}
              {selected.map((sel) => (
                <span
                  key={`${sel.year}-${sel.month}`}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary text-[11px] font-medium px-2 py-0.5"
                >
                  {monthShortLabel(sel.month, sel.year)}
                  <button
                    onClick={() => removeSelection(sel)}
                    className="p-0.5 rounded hover:bg-primary/20"
                    aria-label={`Remove ${monthShortLabel(sel.month, sel.year)}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>

            {/* Confirm */}
            <div className="mt-3 pt-3 border-t border-border/40">
              <motion.button
                whileHover={canConfirm ? { scale: 1.01 } : undefined}
                whileTap={canConfirm ? { scale: 0.98 } : undefined}
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors",
                  canConfirm
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted/50 text-muted-foreground cursor-not-allowed",
                )}
              >
                <GitCompare className="w-3.5 h-3.5" />
                Compare
              </motion.button>
              {!canConfirm && (
                <p className="mt-1.5 text-[10px] text-center text-muted-foreground">
                  Select two months to compare.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------- Month tile ------------------------------ */

const MonthTile: React.FC<{
  month: number;
  year: number;
  selected: boolean;
  onClick: () => void;
  pnlMap: Map<string, number>;
}> = ({ month, year, selected, onClick, pnlMap }) => {
  const monthDate = new Date(year, month, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const today = new Date();

  const days: Date[] = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weekdayHeaders = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-stretch gap-1 rounded-lg p-1.5 text-left transition-colors",
        selected
          ? "bg-primary/20 ring-1 ring-inset ring-primary/50"
          : "bg-muted/20 hover:bg-muted/40",
      )}
    >
      {/* Month name */}
      <div
        className={cn(
          "text-[10px] font-semibold text-center px-1 py-0.5 rounded",
          selected ? "text-primary" : "text-foreground",
        )}
      >
        {format(monthDate, "MMM")}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-[1px]">
        {weekdayHeaders.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="text-center text-[7px] font-medium text-muted-foreground/70 leading-tight"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-[1px]">
        {days.map((d) => {
          const inMonth = isSameMonth(d, monthStart);
          const dateKey = format(d, "yyyy-MM-dd");
          const dayPnL = pnlMap.get(dateKey);
          const hasTrade = inMonth && dayPnL !== undefined;
          const isWinning = hasTrade && (dayPnL as number) > 0;
          const isLosing = hasTrade && (dayPnL as number) < 0;
          const isToday = isSameDay(d, today) && inMonth;

          // Same number-color rules as the standard mini calendar.
          let numberColorClass = "text-foreground";
          if (!inMonth) {
            numberColorClass = "text-muted-foreground/30";
          } else if (hasTrade) {
            if (isWinning) numberColorClass = "text-emerald-500";
            else if (isLosing) numberColorClass = "text-red-500";
          } else if (isToday) {
            numberColorClass = "text-primary";
          }

          return (
            <div
              key={d.toString()}
              className={cn(
                "relative aspect-square flex items-center justify-center text-[7px] leading-none rounded-[3px]",
                inMonth && hasTrade && "bg-primary/15 font-medium",
                inMonth && isToday && !hasTrade && "bg-primary/15 font-semibold",
                numberColorClass,
              )}
            >
              {format(d, "d")}
              {hasTrade && (
                <span
                  className={cn(
                    "absolute -bottom-px left-1/2 -translate-x-1/2 w-[2px] h-[2px] rounded-full",
                    isWinning && "bg-emerald-500",
                    isLosing && "bg-red-500",
                    dayPnL === 0 && "bg-muted-foreground",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </motion.button>
  );
};
