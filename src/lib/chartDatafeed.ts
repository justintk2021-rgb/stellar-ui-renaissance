/**
 * TradingView JS API datafeed backed by the `chart-datafeed` edge function.
 *
 * Pass `createChartDatafeed()` as the `datafeed` option in the Advanced
 * Charts widget constructor once the library is installed. No library
 * imports needed — the object mirrors the IBasicDataFeed contract.
 */
import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "chart-datafeed";

async function callDatafeed<T>(params: Record<string, string>): Promise<T> {
  const search = new URLSearchParams(params).toString();
  const { data, error } = await supabase.functions.invoke(`${FUNCTION_NAME}?${search}`, {
    method: "GET",
  });
  if (error) throw new Error(error.message);
  return data as T;
}

interface UdfHistory {
  s: "ok" | "no_data" | "error";
  errmsg?: string;
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
}

export interface ChartBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const LIVE_POLL_MS = 5_000;

type LiveSubscription = {
  timer: ReturnType<typeof setInterval>;
  symbol: string;
  resolution: string;
  onTick: (bar: ChartBar) => void;
  inFlight: boolean;
};

/** TradingView widget format ("15", "D") plus app timeframes ("15m", "4H"). */
function toUdfResolution(resolution: string): string {
  const key = resolution.trim();
  const mapped: Record<string, string> = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1H": "60",
    "1h": "60",
    "4H": "240",
    "4h": "240",
    D: "1D",
    "1D": "1D",
    W: "1W",
    "1W": "1W",
    M: "1M",
    "1M": "1M",
  };
  if (mapped[key]) return mapped[key];
  const upper = key.toUpperCase();
  if (mapped[upper]) return mapped[upper];
  return key;
}

function toFeedSymbol(symbol: string): string {
  const trimmed = symbol.trim();
  const colon = trimmed.lastIndexOf(":");
  return colon >= 0 ? trimmed.slice(colon + 1) : trimmed;
}

function asUnixSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return Math.floor(Date.now() / 1000);
  return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
}

function resolutionSeconds(resolution: string): number {
  const key = toUdfResolution(resolution).trim().toUpperCase();
  if (key === "1D" || key === "D") return 86_400;
  if (key === "1W" || key === "W") return 604_800;
  if (key === "1M" || key === "M") return 2_592_000;
  const minutes = Number(key);
  if (!Number.isFinite(minutes) || minutes <= 0) return 60;
  return minutes * 60;
}

function historyToBars(res: UdfHistory): ChartBar[] {
  if (res.s !== "ok" || !res.t?.length) return [];
  return res.t.map((time, i) => ({
    time: time * 1000,
    open: res.o![i],
    high: res.h![i],
    low: res.l![i],
    close: res.c![i],
    volume: res.v?.[i],
  }));
}

export function createChartDatafeed() {
  const liveSubs = new Map<string, LiveSubscription>();

  const clearLiveSub = (listenerGuid: string) => {
    const sub = liveSubs.get(listenerGuid);
    if (!sub) return;
    clearInterval(sub.timer);
    liveSubs.delete(listenerGuid);
  };

  const pollLatestBar = (sub: LiveSubscription) => {
    if (sub.inFlight) return;
    sub.inFlight = true;
    const nowSec = Math.floor(Date.now() / 1000);
    const step = resolutionSeconds(sub.resolution);
    const span = Math.max(step * 3, 300);
    void callDatafeed<UdfHistory>({
      action: "history",
      symbol: sub.symbol,
      resolution: sub.resolution,
      from: String(nowSec - span),
      to: String(nowSec + 60),
    })
      .then((res) => {
        const bars = historyToBars(res);
        if (!bars.length) return;
        sub.onTick(bars[bars.length - 1]);
      })
      .catch(() => {
        /* keep last candle; next poll retries */
      })
      .finally(() => {
        sub.inFlight = false;
      });
  };

  return {
    onReady(callback: (config: unknown) => void) {
      callDatafeed<Record<string, unknown>>({ action: "config" })
        .then((config) => setTimeout(() => callback(config), 0))
        .catch(() =>
          setTimeout(
            () =>
              callback({
                supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"],
              }),
            0,
          ),
        );
    },

    searchSymbols(
      userInput: string,
      _exchange: string,
      _symbolType: string,
      onResult: (items: unknown[]) => void,
    ) {
      callDatafeed<unknown[]>({ action: "search", query: userInput })
        .then(onResult)
        .catch(() => onResult([]));
    },

    resolveSymbol(
      symbolName: string,
      onResolve: (symbolInfo: unknown) => void,
      onError: (reason: string) => void,
    ) {
      callDatafeed<Record<string, unknown>>({ action: "symbols", symbol: symbolName })
        .then((info) => setTimeout(() => onResolve(info), 0))
        .catch((err) => onError(err instanceof Error ? err.message : "resolve failed"));
    },

    getBars(
      symbolInfo: { ticker?: string; name?: string },
      resolution: string,
      periodParams: { from: number; to: number; firstDataRequest: boolean },
      onResult: (bars: ChartBar[], meta: { noData: boolean }) => void,
      onError: (reason: string) => void,
    ) {
      const symbol = toFeedSymbol(symbolInfo.ticker ?? symbolInfo.name ?? "");
      const udfResolution = toUdfResolution(resolution);
      const from = asUnixSeconds(periodParams.from);
      const nowSec = Math.floor(Date.now() / 1000);
      const to = periodParams.firstDataRequest
        ? Math.max(asUnixSeconds(periodParams.to), nowSec + 60)
        : asUnixSeconds(periodParams.to);
      callDatafeed<UdfHistory>({
        action: "history",
        symbol,
        resolution: udfResolution,
        from: String(from),
        to: String(to),
      })
        .then((res) => {
          if (res.s === "no_data") {
            onResult([], { noData: true });
            return;
          }
          if (res.s !== "ok" || !res.t) {
            onError(res.errmsg ?? "history failed");
            return;
          }
          const bars = historyToBars(res);
          onResult(bars, { noData: bars.length === 0 });
        })
        .catch((err) => onError(err instanceof Error ? err.message : "history failed"));
    },

    subscribeBars(
      symbolInfo: { ticker?: string; name?: string },
      resolution: string,
      onTick: (bar: ChartBar) => void,
      listenerGuid: string,
    ) {
      clearLiveSub(listenerGuid);
      const symbol = toFeedSymbol(symbolInfo.ticker ?? symbolInfo.name ?? "");
      if (!symbol) return;
      const udfResolution = toUdfResolution(resolution);

      const sub: LiveSubscription = {
        timer: setInterval(() => {
          const current = liveSubs.get(listenerGuid);
          if (current) pollLatestBar(current);
        }, LIVE_POLL_MS),
        symbol,
        resolution: udfResolution,
        onTick,
        inFlight: false,
      };
      liveSubs.set(listenerGuid, sub);
      pollLatestBar(sub);
    },

    unsubscribeBars(listenerGuid: string) {
      clearLiveSub(listenerGuid);
    },
  };
}

export type ChartDatafeed = ReturnType<typeof createChartDatafeed>;
