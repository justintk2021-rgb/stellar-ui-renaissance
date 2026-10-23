import { ema, rsi } from "technicalindicators";
import type { Candle } from "./types";

export interface IndicatorPoint {
  time: number;
  value: number;
}

function align(candles: Candle[], values: number[]): IndicatorPoint[] {
  const offset = candles.length - values.length;
  const points: IndicatorPoint[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const candle = candles[i + offset];
    if (!candle || !Number.isFinite(value)) continue;
    points.push({ time: candle.time, value });
  }
  return points;
}

export function computeEma(candles: Candle[], period: number): IndicatorPoint[] {
  if (candles.length < period) return [];
  const values = ema({ period, values: candles.map((c) => c.close) });
  return align(candles, values);
}

export function computeRsi(candles: Candle[], period = 14): IndicatorPoint[] {
  if (candles.length <= period) return [];
  const values = rsi({ period, values: candles.map((c) => c.close) });
  return align(candles, values);
}
