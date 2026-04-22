import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface WheelProps {
  items: (string | number)[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: string;
}

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 5; // odd number so there's a clear center
const PADDING = Math.floor(VISIBLE_ITEMS / 2);

/**
 * iOS-style scrollable wheel column.
 * Uses native scroll + snap, with a transparent gradient fade and a fixed center band.
 */
function Wheel({ items, selectedIndex, onChange, width = "auto" }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);

  // Sync external selectedIndex -> scroll position
  useEffect(() => {
    if (!ref.current) return;
    const target = selectedIndex * ITEM_HEIGHT;
    if (Math.abs(ref.current.scrollTop - target) > 1) {
      isProgrammaticScroll.current = true;
      ref.current.scrollTo({ top: target, behavior: "smooth" });
      window.setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 250);
    }
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    if (!ref.current || isProgrammaticScroll.current) return;
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      // Snap precisely
      const snapTop = clamped * ITEM_HEIGHT;
      if (Math.abs(ref.current.scrollTop - snapTop) > 0.5) {
        isProgrammaticScroll.current = true;
        ref.current.scrollTo({ top: snapTop, behavior: "smooth" });
        window.setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 200);
      }
      if (clamped !== selectedIndex) onChange(clamped);
    }, 90);
  }, [items.length, onChange, selectedIndex]);

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width }}
    >
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        <div style={{ height: ITEM_HEIGHT * PADDING }} />
        {items.map((item, i) => {
          const distance = Math.abs(i - selectedIndex);
          const opacity = Math.max(0.25, 1 - distance * 0.28);
          const scale = Math.max(0.85, 1 - distance * 0.06);
          return (
            <button
              key={`${item}-${i}`}
              type="button"
              onClick={() => onChange(i)}
              className={cn(
                "snap-center flex items-center justify-center w-full select-none transition-[opacity,transform] duration-150 ease-out",
                "text-foreground tabular-nums font-medium",
                distance === 0 ? "text-base" : "text-sm",
              )}
              style={{
                height: ITEM_HEIGHT,
                opacity,
                transform: `scale(${scale})`,
              }}
            >
              {item}
            </button>
          );
        })}
        <div style={{ height: ITEM_HEIGHT * PADDING }} />
      </div>

      {/* Center selection band */}
      <div
        className="pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 rounded-lg bg-muted/60"
        style={{ height: ITEM_HEIGHT }}
      />

      {/* Top + bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-popover to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-popover to-transparent" />
    </div>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

interface IOSDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minYear?: number;
  maxYear?: number;
  label?: string;
}

/**
 * iOS-style three-column date picker (Month / Day / Year).
 */
export function IOSDatePicker({
  value,
  onChange,
  minYear,
  maxYear,
  label,
}: IOSDatePickerProps) {
  const currentYear = new Date().getFullYear();
  const min = minYear ?? currentYear - 10;
  const max = maxYear ?? currentYear + 5;
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const [monthIdx, setMonthIdx] = useState(value.getMonth());
  const [yearIdx, setYearIdx] = useState(years.indexOf(value.getFullYear()));
  const [dayIdx, setDayIdx] = useState(value.getDate() - 1);

  // Recompute days whenever month/year changes
  const days = Array.from(
    { length: daysInMonth(years[yearIdx] ?? currentYear, monthIdx) },
    (_, i) => i + 1,
  );

  // Clamp day if month/year changes shrinks day range
  useEffect(() => {
    if (dayIdx > days.length - 1) setDayIdx(days.length - 1);
  }, [days.length, dayIdx]);

  // Emit changes
  useEffect(() => {
    const y = years[yearIdx] ?? currentYear;
    const newDate = new Date(y, monthIdx, dayIdx + 1);
    if (
      newDate.getFullYear() !== value.getFullYear() ||
      newDate.getMonth() !== value.getMonth() ||
      newDate.getDate() !== value.getDate()
    ) {
      onChange(newDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthIdx, dayIdx, yearIdx]);

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-1">
          {label}
        </span>
      )}
      <div className="flex items-center justify-center gap-1 rounded-xl bg-popover">
        <Wheel
          items={MONTHS}
          selectedIndex={monthIdx}
          onChange={setMonthIdx}
          width="110px"
        />
        <Wheel
          items={days}
          selectedIndex={dayIdx}
          onChange={setDayIdx}
          width="56px"
        />
        <Wheel
          items={years}
          selectedIndex={yearIdx}
          onChange={setYearIdx}
          width="72px"
        />
      </div>
    </div>
  );
}
