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

export function getChartPalette(_theme: AppTheme): ChartPalette {
  return {
    background: "#131722",
    text: "#d1d4dc",
    grid: "rgba(42, 46, 57, 0.7)",
    border: "#2a2e39",
    crosshair: "rgba(255,255,255,0.28)",
    up: "#2962FF",
    down: "#000000",
    volumeUp: "rgba(41, 98, 255, 0.32)",
    volumeDown: "rgba(156, 163, 175, 0.38)",
    ema20: "#38bdf8",
    ema50: "#c084fc",
    rsi: "#fbbf24",
    entry: "#e5e7eb",
    sl: "#f87171",
    tp: "#34d399",
  };
}

export function buildChartOptions(palette: ChartPalette): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: palette.background },
      textColor: palette.text,
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
