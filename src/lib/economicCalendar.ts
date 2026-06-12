export type EconomicImpact = "low" | "medium" | "high";

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  countryCode: string;
  date: string;
  time: string;
  impact: EconomicImpact;
  actual?: string;
  forecast?: string;
  previous?: string;
  currency: string;
  timestamp?: number;
}

export interface EconomicCalendarResponse {
  events: EconomicEvent[];
  lastUpdated?: string;
  source?: string;
  error?: string;
}

export const countryFlags: Record<string, string> = {
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

export function getEventDateTime(event: EconomicEvent): Date {
  if (event.timestamp) return new Date(event.timestamp);
  const [h, m] = event.time.split(":").map(Number);
  const d = new Date(`${event.date}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Calendar date in the user's local timezone (YYYY-MM-DD). */
export function getEventLocalDateKey(event: EconomicEvent): string {
  return toLocalDateKey(getEventDateTime(event));
}

/** 12-hour clock in the user's locale and timezone. */
export function formatEventTime(event: EconomicEvent): string {
  return getEventDateTime(event).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** 12-hour clock for "now" / last-updated labels. */
export function formatLocalTime(
  date: Date,
  opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true },
): string {
  return date.toLocaleTimeString(undefined, opts);
}

export function isEventPast(event: EconomicEvent, now = new Date()): boolean {
  return getEventDateTime(event).getTime() < now.getTime();
}

export function isEventLive(event: EconomicEvent, now = new Date()): boolean {
  const t = getEventDateTime(event).getTime();
  const windowMs = 15 * 60 * 1000;
  return now.getTime() >= t && now.getTime() < t + windowMs;
}

export function formatCalendarDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(`${dateStr}T12:00:00`);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Now";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

/** Local calendar date as YYYY-MM-DD (avoids UTC drift from toISOString). */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface WeekDayCell {
  dateKey: string;
  weekdayShort: string;
  dayOfMonth: number;
  isToday: boolean;
}

/** Monday-based week containing `anchor`. */
export function startOfWeekMonday(anchor: Date): Date {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const dow = start.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + offset);
  return start;
}

export function getWeekDayCells(weekStartMonday: Date): WeekDayCell[] {
  const todayKey = toLocalDateKey(new Date());
  const cells: WeekDayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartMonday);
    d.setDate(weekStartMonday.getDate() + i);
    const dateKey = toLocalDateKey(d);
    cells.push({
      dateKey,
      weekdayShort: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayOfMonth: d.getDate(),
      isToday: dateKey === todayKey,
    });
  }
  return cells;
}

export function formatWeekRangeLabel(weekStartMonday: Date): string {
  const end = new Date(weekStartMonday);
  end.setDate(weekStartMonday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = weekStartMonday.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  if (weekStartMonday.getFullYear() !== end.getFullYear()) {
    return `${weekStartMonday.toLocaleDateString("en-US", { ...opts, year: "numeric" })} – ${endStr}`;
  }
  return `${startStr} – ${endStr}`;
}
