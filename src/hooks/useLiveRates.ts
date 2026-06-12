import { useQuery } from "@tanstack/react-query";
import { FALLBACK_USD_RATES } from "@/lib/positionSizing";

/**
 * Live market data for the position-size calculator.
 *
 * - FX rates: open.er-api.com (free, no key, CORS-enabled; USD-based table)
 * - Crypto spot prices: Binance public API
 *
 * Both fall back gracefully — FX falls back to approximate static rates so
 * the calculator always produces a result, just flagged as not-live.
 */

const FX_RATES_URL = "https://open.er-api.com/v6/latest/USD";
const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price";

interface FxRatesResult {
  rates: Record<string, number>;
  updatedAt: string | null;
}

async function fetchFxRates(): Promise<FxRatesResult> {
  const res = await fetch(FX_RATES_URL);
  if (!res.ok) throw new Error(`FX rates unavailable (${res.status})`);
  const data = await res.json();
  if (data?.result !== "success" || !data?.rates) {
    throw new Error("Unexpected FX rates response");
  }
  return {
    rates: data.rates as Record<string, number>,
    updatedAt: data.time_last_update_utc ?? null,
  };
}

async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  const url = `${BINANCE_TICKER_URL}?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance unavailable (${res.status})`);
  const rows = await res.json();
  const prices: Record<string, number> = {};
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const price = Number(row.price);
      if (Number.isFinite(price)) prices[row.symbol] = price;
    }
  }
  return prices;
}

export function useLiveRates(cryptoSymbols: string[] = []) {
  const fxQuery = useQuery({
    queryKey: ["live-fx-rates"],
    queryFn: fetchFxRates,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  const cryptoQuery = useQuery({
    queryKey: ["live-crypto-prices", [...cryptoSymbols].sort().join(",")],
    queryFn: () => fetchCryptoPrices(cryptoSymbols),
    enabled: cryptoSymbols.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  return {
    /** USD→currency rate table (live, or static fallback when offline). */
    usdRates: fxQuery.data?.rates ?? FALLBACK_USD_RATES,
    fxIsLive: fxQuery.isSuccess,
    fxUpdatedAt: fxQuery.data?.updatedAt ?? null,
    /** Binance symbol → last price. */
    cryptoPrices: cryptoQuery.data ?? {},
    cryptoIsLive: cryptoQuery.isSuccess,
    isLoading: fxQuery.isLoading,
  };
}
