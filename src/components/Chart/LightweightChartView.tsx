import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CandlestickData, Time } from "lightweight-charts";
import { createChartDatafeed, type ChartBar } from "@/lib/chartDatafeed";
import { getSymbolSpec, type Candle, type Position } from "@/lib/chartTrading/types";
import { CandleChart, type ChartApi } from "./CandleChart";
import { getChartPalette } from "./chartTheme";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";

interface LightweightChartViewProps {
  symbol: string;
  interval: string;
  positions: Position[];
  onLastPrice?: (price: number, fromSymbol?: string) => void;
}

function toUtcSeconds(time: number): number {
  return time > 1e12 ? Math.floor(time / 1000) : Math.floor(time);
}

function barToCandle(bar: ChartBar): Candle {
  return {
    time: toUtcSeconds(bar.time),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume ?? 0,
  };
}

function intervalSeconds(interval: string): number {
  const key = interval.trim().toUpperCase();
  if (key === "1D" || key === "D") return 86_400;
  if (key === "1W" || key === "W") return 604_800;
  if (key === "1M" || key === "M") return 2_592_000;
  const mapped: Record<string, number> = {
    "1M": 60,
    "5M": 300,
    "15M": 900,
    "30M": 1800,
    "1H": 3600,
    "4H": 14_400,
  };
  if (mapped[key]) return mapped[key];
  const n = Number(key);
  if (Number.isFinite(n) && n > 0) return n * 60;
  return 900;
}

function intervalLabel(interval: string): string {
  const labels: Record<string, string> = {
    "1": "1m",
    "5": "5m",
    "15": "15m",
    "30": "30m",
    "60": "1H",
    "240": "4H",
    D: "1D",
    "1D": "1D",
    W: "1W",
    "1W": "1W",
    M: "1M",
    "1M": "1M",
  };
  return labels[interval.trim()] ?? interval;
}

export function LightweightChartView({
  symbol,
  interval,
  positions,
  onLastPrice,
}: LightweightChartViewProps) {
  const theme = useDocumentTheme();
  const palette = getChartPalette(theme);
  const spec = getSymbolSpec(symbol);
  const chartApiRef = useRef<ChartApi | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const loadingOlderRef = useRef(false);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [legend, setLegend] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
    prevClose: number | null;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(0);

  candlesRef.current = candles;
  const feed = useMemo(() => createChartDatafeed(), []);

  const fmt = useCallback(
    (value: number) =>
      value.toLocaleString(undefined, {
        minimumFractionDigits: spec.precision,
        maximumFractionDigits: spec.precision,
      }),
    [spec.precision],
  );

  useEffect(() => {
    let cancelled = false;
    setCandles([]);
    candlesRef.current = [];
    setLoadError(null);
    setLegend(null);
    loadingOlderRef.current = false;

    const to = Math.floor(Date.now() / 1000);
    const from = to - intervalSeconds(interval) * 500;
    feed.getBars(
      { ticker: symbol, name: symbol },
      interval,
      { from, to, firstDataRequest: true },
      (bars) => {
        if (cancelled) return;
        const mapped = bars.map(barToCandle);
        setCandles(mapped);
        const last = mapped[mapped.length - 1];
        const prev = mapped[mapped.length - 2];
        if (last) {
          setLegend({
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            prevClose: prev?.close ?? null,
          });
          onLastPrice?.(last.close, symbol);
        }
      },
      (reason) => {
        if (!cancelled) setLoadError(reason);
      },
    );

    const guid = `${symbol}:${interval}`;
    feed.subscribeBars(
      { ticker: symbol, name: symbol },
      interval,
      (bar) => {
        if (cancelled) return;
        const candle = barToCandle(bar);
        const list = candlesRef.current;
        const last = list[list.length - 1];
        if (!last || candle.time < last.time) return;
        chartApiRef.current?.updateBar(candle);
        if (candle.time === last.time) {
          candlesRef.current = list.slice(0, -1).concat(candle);
        } else {
          candlesRef.current = list.concat(candle);
        }
        const prevClose =
          candle.time === last.time ? list[list.length - 2]?.close ?? last.open : last.close;
        setLegend({
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          prevClose,
        });
        onLastPrice?.(candle.close, symbol);
      },
      guid,
    );

    return () => {
      cancelled = true;
      feed.unsubscribeBars(guid);
    };
  }, [feed, interval, onLastPrice, symbol]);

  useEffect(() => {
    const api = chartApiRef.current;
    if (!chartReady || !api) return;
    return api.subscribeCrosshairMove((param) => {
      const series = api.getCandleSeries();
      const list = candlesRef.current;
      const last = list[list.length - 1];
      const prev = list[list.length - 2];
      if (param.time != null && series) {
        const raw = param.seriesData.get(series);
        const candle = raw as CandlestickData<Time> | undefined;
        if (candle && "close" in candle) {
          const idx = list.findIndex((c) => c.time === toUtcSeconds(Number(param.time)));
          const prevClose = idx > 0 ? list[idx - 1].close : prev?.close ?? null;
          setLegend({
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            prevClose,
          });
          return;
        }
      }
      if (last) {
        setLegend({
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
          prevClose: prev?.close ?? null,
        });
      }
    });
  }, [chartReady]);

  const loadOlder = useCallback(() => {
    const first = candlesRef.current[0];
    if (!first || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    const to = first.time - 1;
    const from = to - intervalSeconds(interval) * 500;
    feed.getBars(
      { ticker: symbol, name: symbol },
      interval,
      { from, to, firstDataRequest: false },
      (bars) => {
        const mapped = bars.map(barToCandle).filter((bar) => bar.time < first.time);
        if (mapped.length) {
          const merged = mapped.concat(candlesRef.current);
          const seen = new Set<number>();
          const unique: Candle[] = [];
          for (const bar of merged) {
            if (seen.has(bar.time)) continue;
            seen.add(bar.time);
            unique.push(bar);
          }
          unique.sort((a, b) => a.time - b.time);
          setCandles(unique);
        }
        loadingOlderRef.current = false;
      },
      () => {
        loadingOlderRef.current = false;
      },
    );
  }, [feed, interval, symbol]);

  const last = legend;
  const up = last ? last.close >= last.open : true;
  const change = last && last.prevClose != null ? last.close - last.prevClose : 0;
  const changePct = last && last.prevClose ? (change / last.prevClose) * 100 : 0;
  const color = up ? palette.up : "#9ca3af";

  return (
    <div className="relative h-full min-h-0 w-full">
      <CandleChart
        ref={chartApiRef}
        candles={candles}
        symbol={symbol}
        positions={positions}
        showEma20={showEma20}
        showEma50={showEma50}
        showRsi={showRsi}
        draggingId={null}
        onNeedMoreHistory={loadOlder}
        onReady={() => setChartReady((n) => n + 1)}
      />

      <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col gap-1">
        <div className="flex items-baseline gap-2 font-sans text-[11px] leading-none text-[#d1d4dc]">
          <span className="font-semibold tracking-wide">{symbol}</span>
          <span className="text-[#787b86]">{intervalLabel(interval)}</span>
          <span className="text-[#787b86]">Candles</span>
        </div>
        {last && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px]" style={{ color }}>
            <span>O {fmt(last.open)}</span>
            <span>H {fmt(last.high)}</span>
            <span>L {fmt(last.low)}</span>
            <span>C {fmt(last.close)}</span>
            {last.prevClose != null && (
              <span>
                {change >= 0 ? "+" : ""}
                {fmt(change)} ({changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setShowEma20((v) => !v)}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            showEma20 ? "bg-[#2962FF]/20 text-[#38bdf8]" : "text-[#787b86]"
          }`}
        >
          EMA20
        </button>
        <button
          type="button"
          onClick={() => setShowEma50((v) => !v)}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            showEma50 ? "bg-[#2962FF]/20 text-[#c084fc]" : "text-[#787b86]"
          }`}
        >
          EMA50
        </button>
        <button
          type="button"
          onClick={() => setShowRsi((v) => !v)}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            showRsi ? "bg-[#2962FF]/20 text-[#fbbf24]" : "text-[#787b86]"
          }`}
        >
          RSI
        </button>
      </div>

      {loadError && (
        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded bg-[#131722] px-3 py-1 text-[11px] text-amber-400">
          {loadError}
        </div>
      )}
    </div>
  );
}
