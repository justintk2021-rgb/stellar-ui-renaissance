import {
  TIMEFRAME_SECONDS,
  getSymbolSpec,
  type Candle,
  type ChartTimeframe,
} from "./types";

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function alignTime(unixSeconds: number, timeframe: ChartTimeframe): number {
  const step = TIMEFRAME_SECONDS[timeframe];
  return Math.floor(unixSeconds / step) * step;
}

function roundPrice(value: number, minMove: number): number {
  return Math.round(value / minMove) * minMove;
}

export function generateMockCandles(
  symbol: string,
  timeframe: ChartTimeframe,
  count = 280,
  seedKey = "",
): Candle[] {
  const spec = getSymbolSpec(symbol);
  const step = TIMEFRAME_SECONDS[timeframe];
  const now = alignTime(Math.floor(Date.now() / 1000), timeframe);
  const rand = mulberry32(hashSeed(`${symbol}:${timeframe}:${seedKey}`));

  const candles: Candle[] = [];
  let price = spec.basePrice * (0.97 + rand() * 0.06);
  let drift = (rand() - 0.5) * spec.volatility * 0.15;

  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * step;
    const session = 0.55 + 0.45 * Math.abs(Math.sin((time / step) * 0.17));
    const shock = rand() < 0.035 ? (rand() - 0.5) * spec.volatility * 4 : 0;
    drift += (rand() - 0.5) * spec.volatility * 0.04;
    drift *= 0.96;

    const range = spec.volatility * session * (0.6 + rand() * 0.9);
    const open = price;
    const close = open + drift + (rand() - 0.5) * range + shock;
    const high = Math.max(open, close) + rand() * range * 0.7;
    const low = Math.min(open, close) - rand() * range * 0.7;
    const volume = Math.round((420 + rand() * 1800) * session * (timeframe === "1D" ? 8 : 1));

    candles.push({
      time,
      open: roundPrice(open, spec.minMove),
      high: roundPrice(high, spec.minMove),
      low: roundPrice(low, spec.minMove),
      close: roundPrice(close, spec.minMove),
      volume,
    });
    price = close;
  }

  return candles;
}

export function tickLastCandle(candle: Candle, symbol: string): Candle {
  const spec = getSymbolSpec(symbol);
  const wobble = (Math.random() - 0.5) * spec.volatility * 0.55;
  const nextClose = roundPrice(candle.close + wobble, spec.minMove);
  return {
    ...candle,
    close: nextClose,
    high: roundPrice(Math.max(candle.high, nextClose, candle.open), spec.minMove),
    low: roundPrice(Math.min(candle.low, nextClose, candle.open), spec.minMove),
    volume: candle.volume + Math.round(Math.random() * 12),
  };
}
