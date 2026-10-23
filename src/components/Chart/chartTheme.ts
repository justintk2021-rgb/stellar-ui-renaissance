import type { AppTheme } from "@/lib/theme";
import type { DeepPartial, ChartOptions, Time } from "lightweight-charts";
import { ColorType, CrosshairMode, TickMarkType } from "lightweight-charts";

export interface ChartPalette {
  background: string;
  text: string;
  grid: string;
  border: string;
  crosshair: string;
  up: string;
  down: string;
  volumeUp: string;
  volumeDown: string;
  ema20: string;
  ema50: string;
  rsi: string;
  entry: string;
  sl: string;
  tp: string;
}

export function getChartPalette(theme: AppTheme): ChartPalette {
  const dark = theme === "dark";
  return {
    background: dark ? "#050505" : "#f5f6f8",
    text: dark ? "#e8eaed" : "#1a1d21",
    grid: dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)",
    border: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)",
    crosshair: dark ? "rgba(255,255,255,0.38)" : "rgba(15,23,42,0.35)",
    up: dark ? "#34d399" : "#059669",
    down: dark ? "#f87171" : "#dc2626",
    volumeUp: dark ? "rgba(52,211,153,0.38)" : "rgba(5,150,105,0.38)",
    volumeDown: dark ? "rgba(248,113,113,0.38)" : "rgba(220,38,38,0.38)",
    ema20: dark ? "#38bdf8" : "#0284c7",
    ema50: dark ? "#c084fc" : "#7c3aed",
    rsi: dark ? "#fbbf24" : "#d97706",
    entry: dark ? "#e5e7eb" : "#334155",
    sl: dark ? "#f87171" : "#dc2626",
    tp: dark ? "#34d399" : "#059669",
  };
}

export function buildChartOptions(palette: ChartPalette): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: palette.background },
      textColor: palette.text,
      attributionLogo: false,
      panes: {
        separatorColor: palette.border,
        separatorHoverColor: palette.crosshair,
      },
    },
    grid: {
      vertLines: { color: palette.grid },
      horzLines: { color: palette.grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: palette.crosshair,
        width: 1,
        style: 2,
        labelBackgroundColor: palette.background,
      },
      horzLine: {
        color: palette.crosshair,
        width: 1,
        style: 2,
        labelBackgroundColor: palette.background,
      },
    },
    rightPriceScale: {
      borderColor: palette.border,
      scaleMargins: { top: 0.08, bottom: 0.18 },
    },
    localization: {
      timeFormatter: (time: Time) => formatLocalChartTime(time, true),
    },
    timeScale: {
      borderColor: palette.border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 6,
      tickMarkFormatter: (time: Time, tickMarkType: TickMarkType, _locale: string) =>
        formatTickMark(time, tickMarkType),
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  };
}

export function asUtc(time: number): Time {
  return time as Time;
}

function asDate(time: Time): Date {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") return new Date(time);
  return new Date(Date.UTC(time.year, time.month - 1, time.day));
}

export function formatLocalChartTime(time: Time, withTime = false): string {
  const date = asDate(time);
  return withTime
    ? date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : date.toLocaleDateString();
}

function formatTickMark(time: Time, tickMarkType: TickMarkType): string {
  const date = asDate(time);
  if (tickMarkType === TickMarkType.Year) return String(date.getFullYear());
  if (tickMarkType === TickMarkType.Month) {
    return date.toLocaleDateString(undefined, { month: "short" });
  }
  if (tickMarkType === TickMarkType.DayOfMonth) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
