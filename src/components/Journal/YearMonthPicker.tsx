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
  /** Optional initial selection (e.g. when re-opening from Compare to edit) */
  initialSelection?: MonthSelection[];
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-10">
          {/* Dim + blur backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Centered modal panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label="Select two months to compare"
            className={cn(
              "relative z-10 flex flex-col rounded-2xl bg-card/95 backdrop-blur-md border border-border/50 shadow-2xl overflow-hidden",
              // Sizing: ~80% of viewport, capped at 1200×800
              "w-[80vw] h-[80vh] max-w-[1200px] max-h-[800px]",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/40 shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">
                  Select two months to compare
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  Pick any two months from any year — they become Period A and Period B.
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                    className="text-base font-semibold tabular-nums min-w-[3.5rem] text-center"
                  >
                    {year}
                  </motion.span>
                </AnimatePresence>
                <button
                  onClick={handleNextYear}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Next year"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={onClose}
                  className="ml-2 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Year grid: 4 cols × 3 rows of mini month tiles. Body scrolls
                vertically when tiles don't fit so months are NEVER compressed. */}
            <div className="flex-1 min-h-0 px-8 py-6 overflow-y-auto overflow-x-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={year}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="grid grid-cols-4 gap-x-8 gap-y-12"
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
            </div>

            {/* Footer: chips + Compare */}
            <div className="px-6 py-4 border-t border-border/40 shrink-0 flex items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {selected.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    No months selected
                  </span>
                ) : (
                  selected.map((sel) => (
                    <span
                      key={`${sel.year}-${sel.month}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 text-primary text-xs font-medium px-2.5 py-1"
                    >
                      {monthLabel(sel.month, sel.year)}
                      <button
                        onClick={() => removeSelection(sel)}
                        className="p-0.5 rounded hover:bg-primary/20"
                        aria-label={`Remove ${monthLabel(sel.month, sel.year)}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {!canConfirm && (
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Select two months to compare.
                  </span>
                )}
                <motion.button
                  whileHover={canConfirm ? { scale: 1.02 } : undefined}
                  whileTap={canConfirm ? { scale: 0.98 } : undefined}
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold transition-colors",
                    canConfirm
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted/50 text-muted-foreground cursor-not-allowed",
                  )}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  Compare
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
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

  // Always pad to 6 weeks (42 cells) so EVERY tile is the same height
  // regardless of whether the month spans 4, 5, or 6 calendar rows.
  const days: Date[] = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }
  while (days.length < 42) {
    days.push(addDays(days[days.length - 1], 1));
  }

  const weekdayHeaders = ["S", "M", "T", "W", "T", "F", "S"];

  // Fixed cell size keeps every tile identical in height. 6 rows × 28px ≈ 168px
  // for the day grid alone, plus header + weekday + padding. Worst-case month
  // (6 rows) and best-case month (4 rows) render at the SAME size.
  const CELL_SIZE = "h-7"; // 28px

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-stretch rounded-xl p-3 text-left transition-colors",
        selected
          ? "bg-primary/20 ring-1 ring-inset ring-primary/50"
          : "bg-muted/20 hover:bg-muted/40",
      )}
    >
      {/* Month name */}
      <div
        className={cn(
          "text-xs font-semibold text-center px-1 pb-2 shrink-0",
          selected ? "text-primary" : "text-foreground",
        )}
      >
        {format(monthDate, "MMMM")}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 shrink-0 pb-1.5">
        {weekdayHeaders.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="text-center text-[10px] font-medium text-muted-foreground/70 leading-none h-3 flex items-center justify-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid — ALWAYS 6 rows × 7 cols, fixed cell height. Months that
          only need 5 rows render the trailing row as muted out-of-month days. */}
      <div className="grid grid-cols-7 grid-rows-6 gap-1 shrink-0">
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
            numberColorClass = "text-muted-foreground/25";
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
                "relative flex items-center justify-center text-[10px] leading-none rounded-md",
                CELL_SIZE,
                inMonth && hasTrade && "bg-primary/15 font-medium",
                inMonth && isToday && !hasTrade && "bg-primary/15 font-semibold",
                numberColorClass,
              )}
            >
              <span className="block -mt-0.5">{format(d, "d")}</span>
              {hasTrade && (
                <span
                  className={cn(
                    "absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
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
