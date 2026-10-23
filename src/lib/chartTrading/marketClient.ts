import { supabase } from "@/integrations/supabase/client";
import { refreshTradeLockerConnection } from "@/lib/repairBrokerSession";
import { ChartMarketError, classifyMarketError } from "./tradeLockerMap";

export interface MarketRequest {
  action: "instruments" | "candles" | "quote" | "positions" | "orders" | "history";
  connectionId: string;
  accountId?: string | null;
  accNum?: number | null;
  [key: string]: unknown;
}

async function invokeOnce(body: MarketRequest) {
  const { data, error } = await supabase.functions.invoke("tradelocker-market", { body });
  if (data?.error) {
    throw classifyMarketError(
      typeof data.status === "number" ? data.status : 0,
      data,
    );
  }
  if (error) {
    let payload: unknown = error.message;
    if ("context" in error && error.context instanceof Response) {
      try {
        payload = await error.context.json();
      } catch {
        payload = error.message;
      }
    }
    const status = "context" in error && error.context instanceof Response ? error.context.status : 0;
    throw classifyMarketError(status, payload);
  }
  return data;
}

export async function invokeTradeLockerMarket<T = Record<string, unknown>>(body: MarketRequest): Promise<T> {
  try {
    return (await invokeOnce(body)) as T;
  } catch (error) {
    const expired = error instanceof ChartMarketError && error.code === "expired";
    if (expired && body.connectionId) {
      const refreshed = await refreshTradeLockerConnection(body.connectionId);
      if (refreshed === "ok") return (await invokeOnce(body)) as T;
    }
    throw error;
  }
}
