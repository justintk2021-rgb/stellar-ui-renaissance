import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Sparkles, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface DayPnL {
  date: string;
  pnl: number;
}

interface MiniCalendarProps {
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
  dayPnLs?: DayPnL[];
}

export function MiniCalendar({ selectedDate, onSelectDate, dayPnLs = [] }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [direction, setDirection] = useState(0);

  // Create a map for quick lookup
  const pnlMap = new Map(dayPnLs.map(d => [d.date, d.pnl]));

  const handlePrevMonth = () => {
    setDirection(-1);
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
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
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
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
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
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

        days.push(
          <button
            key={day.toString()}
            onClick={() => onSelectDate?.(cloneDay)}
            className={cn(
              "relative aspect-square flex items-center justify-center text-xs rounded-md transition-all",
              !isCurrentMonth && "text-muted-foreground/40",
              isCurrentMonth && !hasTrade && "text-foreground hover:bg-muted",
              isToday && !isSelected && !hasTrade && "bg-muted font-semibold",
              isSelected && "bg-primary text-primary-foreground font-semibold",
              isWinning && !isSelected && "bg-emerald-500/20 text-emerald-500 font-medium",
              isLosing && !isSelected && "bg-red-500/20 text-red-500 font-medium",
              hasTrade && dayPnL === 0 && !isSelected && "bg-muted text-muted-foreground font-medium"
            )}
          >
            {format(day, "d")}
            {hasTrade && !isSelected && (
              <span className={cn(
                "absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                isWinning && "bg-emerald-500",
                isLosing && "bg-red-500",
                dayPnL === 0 && "bg-muted-foreground"
              )} />
            )}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-1">
          {days}
        </div>
      );
      days = [];
    }
    return rows;
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 20 : -20,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -20 : 20,
      opacity: 0,
    }),
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

      {/* Custom + Compare action buttons */}
      <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => toast.info("Custom month selection coming soon")}
          className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
          Custom
        </motion.button>
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
