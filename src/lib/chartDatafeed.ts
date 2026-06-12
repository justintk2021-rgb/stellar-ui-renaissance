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

export function createChartDatafeed() {
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
      onResult: (bars: unknown[], meta: { noData: boolean }) => void,
      onError: (reason: string) => void,
    ) {
      const symbol = symbolInfo.ticker ?? symbolInfo.name ?? "";
      callDatafeed<UdfHistory>({
        action: "history",
        symbol,
        resolution,
        from: String(periodParams.from),
        to: String(periodParams.to),
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
          const bars = res.t.map((time, i) => ({
            time: time * 1000,
            open: res.o![i],
            high: res.h![i],
            low: res.l![i],
            close: res.c![i],
            volume: res.v?.[i],
          }));
          onResult(bars, { noData: bars.length === 0 });
        })
        .catch((err) => onError(err instanceof Error ? err.message : "history failed"));
    },

    // Realtime streaming not implemented yet — charts still work, they just
    // update on reload / resolution change rather than tick-by-tick.
    subscribeBars() {
      /* no-op */
    },
    unsubscribeBars() {
      /* no-op */
    },
  };
}

export type ChartDatafeed = ReturnType<typeof createChartDatafeed>;
