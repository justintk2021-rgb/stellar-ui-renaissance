import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 20 * 60 * 1000;

const TIMEFRAME_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
};

const TL_RESOLUTIONS: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1H": "1H",
  "4H": "4H",
  "1D": "1D",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBaseUrl(environment: string): string {
  return environment === "live"
    ? "https://live.tradelocker.com/backend-api"
    : "https://demo.tradelocker.com/backend-api";
}

function classifyTlError(status: number, body: unknown) {
  const text = typeof body === "string" ? body : JSON.stringify(body ?? "");
  const lower = text.toLowerCase();
  if (status === 401 || status === 403 || /expired|unauthorized|invalid session|refresh token/.test(lower)) {
    return { error: "Session expired. Reconnect TradeLocker in Settings.", code: "expired" };
  }
  if (status === 429 || /rate limit|too many requests|throttle/.test(lower)) {
    return { error: "TradeLocker rate limit reached. Retrying shortly.", code: "rate_limit" };
  }
  if (/market.?closed|not tradable|outside trading/.test(lower)) {
    return { error: "Market is closed for this symbol.", code: "market_closed" };
  }
  return { error: text || `TradeLocker request failed (${status})`, code: "unknown" };
}

function rowToObject(columns: { id: string }[], row: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columns.length && i < row.length; i++) {
    obj[columns[i].id] = row[i];
  }
  return obj;
}

function alignBarTimeUtc(unixSeconds: number, timeframe: string): number {
  const step = TIMEFRAME_SECONDS[timeframe] ?? 900;
  return Math.floor(unixSeconds / step) * step;
}

function mapHistoryBars(bars: Record<string, unknown>[], timeframe: string) {
  const unique = new Map<number, Record<string, number>>();
  for (const bar of bars) {
    const rawTime = Number(bar.t ?? bar.time);
    if (!Number.isFinite(rawTime)) continue;
    const seconds = rawTime > 1e12 ? Math.floor(rawTime / 1000) : Math.floor(rawTime);
    const open = Number(bar.o ?? bar.open);
    const high = Number(bar.h ?? bar.high);
    const low = Number(bar.l ?? bar.low);
    const close = Number(bar.c ?? bar.close);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    const time = alignBarTimeUtc(seconds, timeframe);
    unique.set(time, {
      time,
      open,
      high,
      low,
      close,
      volume: Number(bar.v ?? bar.volume) || 0,
    });
  }
  return [...unique.values()].sort((a, b) => a.time - b.time);
}

function inferPrecision(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.includes("JPY")) return 3;
  if (s.includes("XAU") || s.includes("XAG")) return 2;
  if (s.includes("NAS") || s.includes("US30") || s.includes("US500") || s.includes("SPX")) return 1;
  if (s.includes("BTC") || s.includes("ETH")) return 1;
  if (/^[A-Z]{6}$/.test(s)) return 5;
  return 2;
}

function routeIdFor(inst: { routes?: Array<{ id?: number; type?: string }> }, type: "INFO" | "TRADE") {
  const routes = inst.routes || [];
  const match = routes.find((route) => String(route.type).toUpperCase() === type);
  return Number(match?.id ?? routes[0]?.id);
}

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeTokens(data: Record<string, unknown> | null) {
  if (!data) return null;
  const accessToken = data.accessToken || data.access_token;
  const refreshToken = data.refreshToken || data.refresh_token;
  if (!accessToken) return null;
  return {
    accessToken: String(accessToken),
    refreshToken: refreshToken ? String(refreshToken) : undefined,
  };
}

async function tlRefresh(refreshToken: string, environment: string) {
  const res = await fetch(`${getBaseUrl(environment)}/auth/jwt/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    return { ok: false as const, permanent: res.status === 400 || res.status === 401 || res.status === 403 };
  }
  const tokens = normalizeTokens(await res.json());
  if (!tokens) return { ok: false as const, permanent: true };
  return { ok: true as const, ...tokens };
}

async function recoverRotatedToken(supabase: ReturnType<typeof createClient>, connectionId: string, previousAccessToken?: string) {
  const { data: latest } = await supabase
    .from("broker_connections")
    .select("metaapi_account_id, token_expiry")
    .eq("id", connectionId)
    .maybeSingle();
  if (!latest?.token_expiry) return null;
  if (new Date(latest.token_expiry).getTime() < Date.now() + 60_000) return null;
  let parsed: { accessToken?: string; refreshToken?: string };
  try {
    parsed = JSON.parse(latest.metaapi_account_id || "{}");
  } catch {
    return null;
  }
  if (!parsed.accessToken || parsed.accessToken === previousAccessToken) return null;
  return parsed;
}

function tokenNeedsRefresh(conn: { token_expiry?: string | null; connection_status?: string | null }) {
  if (conn.connection_status === "expired") return true;
  if (!conn.token_expiry) return false;
  return new Date(conn.token_expiry).getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS;
}

async function refreshConnectionTokens(
  supabase: ReturnType<typeof createClient>,
  conn: { id: string; environment?: string | null; metaapi_account_id?: string | null },
) {
  let tokenData: { accessToken?: string; refreshToken?: string };
  try {
    tokenData = JSON.parse(conn.metaapi_account_id || "{}");
  } catch {
    return { ok: false as const, permanent: true };
  }
  if (!tokenData.refreshToken) return { ok: false as const, permanent: true };

  const refreshResult = await tlRefresh(tokenData.refreshToken, conn.environment || "demo");
  if (!refreshResult.ok) {
    if (!refreshResult.permanent) return { ok: false as const, permanent: false };
    const recovered = await recoverRotatedToken(supabase, conn.id, tokenData.accessToken);
    if (recovered?.accessToken) return { ok: true as const, accessToken: recovered.accessToken, refreshToken: recovered.refreshToken };
    await supabase
      .from("broker_connections")
      .update({
        connection_status: "expired",
        last_error: "Token refresh failed — reconnect in Settings",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conn.id);
    return { ok: false as const, permanent: true };
  }

  await supabase
    .from("broker_connections")
    .update({
      metaapi_account_id: JSON.stringify({
        accessToken: refreshResult.accessToken,
        refreshToken: refreshResult.refreshToken || tokenData.refreshToken,
      }),
      token_expiry: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      connection_status: "connected",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return { ok: true as const, accessToken: refreshResult.accessToken, refreshToken: refreshResult.refreshToken };
}

async function getSession(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  connectionId: string,
  accountId?: string,
  accNum?: number,
) {
  const { data: conn, error } = await supabase
    .from("broker_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !conn) return { error: "Connection not found", code: "unauthorized", status: 404 };
  if (conn.platform !== "tradelocker") {
    return { error: "Chart data not available for this broker yet", code: "unavailable", status: 400 };
  }

  let tokenData: { accessToken?: string; refreshToken?: string };
  try {
    tokenData = JSON.parse(conn.metaapi_account_id || "{}");
  } catch {
    return { error: "Session expired. Reconnect TradeLocker in Settings.", code: "expired", status: 401 };
  }

  let accessToken = tokenData.accessToken;
  if (!accessToken || tokenNeedsRefresh(conn)) {
    const refreshed = await refreshConnectionTokens(supabase, conn);
    if (!refreshed.ok) {
      return {
        error: "Session expired. Reconnect TradeLocker in Settings.",
        code: "expired",
        status: 401,
      };
    }
    accessToken = refreshed.accessToken;
  }

  const resolvedAccountId = accountId || conn.active_account_id;
  const resolvedAccNum = accNum ?? conn.active_acc_num;
  if (!accessToken || !resolvedAccountId || resolvedAccNum == null) {
    return { error: "Session expired. Reconnect TradeLocker in Settings.", code: "expired", status: 401 };
  }

  return {
    accessToken,
    environment: conn.environment === "live" ? "live" : "demo",
    accountId: String(resolvedAccountId),
    accNum: Number(resolvedAccNum),
  };
}

async function tlFetch(
  session: { accessToken: string; environment: string; accNum: number },
  path: string,
) {
  const res = await fetch(`${getBaseUrl(session.environment)}${path}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      accNum: String(session.accNum),
    },
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

function extractConfigLimits(config: Record<string, unknown> | null) {
  const limits = (config?.limits as Record<string, unknown>) || {};
  const rateLimits = (config?.rateLimits as unknown[]) || (config?.rate_limits as unknown[]) || [];
  return { limits, rateLimits };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization header", code: "unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);
    if (authError || !user) return jsonResponse({ error: "Unauthorized", code: "unauthorized" }, 401);

    const body = await req.json();
    const action = String(body.action || "");
    const connectionId = String(body.connectionId || "");
    if (!connectionId) return jsonResponse({ error: "Missing connectionId", code: "unknown" }, 400);

    const sessionResult = await getSession(
      supabase,
      user.id,
      connectionId,
      body.accountId ? String(body.accountId) : undefined,
      body.accNum != null ? Number(body.accNum) : undefined,
    );
    if ("error" in sessionResult) {
      return jsonResponse({ error: sessionResult.error, code: sessionResult.code }, sessionResult.status);
    }
    const session = sessionResult;

    if (action === "instruments") {
      const res = await tlFetch(session, `/trade/accounts/${session.accountId}/instruments`);
      if (!res.ok) return jsonResponse(classifyTlError(res.status, res.body), res.status === 429 ? 429 : 400);
      const payload = res.body as { d?: { instruments?: Record<string, unknown>[] } };
      const instruments = (payload?.d?.instruments || []).map((inst) => {
        const symbol = String(inst.name || inst.symbol || inst.tradableInstrumentId || "");
        const precision = inferPrecision(symbol);
        return {
          symbol,
          name: String(inst.name || symbol),
          type: String(inst.type || ""),
          tradableInstrumentId: Number(inst.tradableInstrumentId),
          infoRouteId: routeIdFor(inst as { routes?: Array<{ id?: number; type?: string }> }, "INFO"),
          tradeRouteId: routeIdFor(inst as { routes?: Array<{ id?: number; type?: string }> }, "TRADE"),
          precision,
          minMove: Number((10 ** -precision).toFixed(precision)),
        };
      }).filter((inst) => inst.symbol && Number.isFinite(inst.tradableInstrumentId) && Number.isFinite(inst.infoRouteId));

      let rateLimits: unknown = null;
      const configRes = await tlFetch(session, "/trade/config");
      if (configRes.ok) {
        const config = (configRes.body as { d?: Record<string, unknown> })?.d ?? null;
        rateLimits = extractConfigLimits(config);
      } else if (configRes.status === 429) {
        return jsonResponse(classifyTlError(429, configRes.body), 429);
      }

      return jsonResponse({ instruments, rateLimits });
    }

    if (action === "candles") {
      const timeframe = String(body.timeframe || "15m");
      const resolution = TL_RESOLUTIONS[timeframe];
      if (!resolution) return jsonResponse({ error: "Unsupported timeframe", code: "unknown" }, 400);

      const tradableInstrumentId = Number(body.tradableInstrumentId);
      const routeId = Number(body.routeId);
      if (!Number.isFinite(tradableInstrumentId) || !Number.isFinite(routeId)) {
        return jsonResponse({ error: "Missing instrument route", code: "unknown" }, 400);
      }

      const now = Date.now();
      const to = Number(body.toMs) || now;
      const from = Number(body.fromMs) || to - (TIMEFRAME_SECONDS[timeframe] ?? 900) * 300 * 1000;
      const params = new URLSearchParams({
        routeId: String(routeId),
        tradableInstrumentId: String(tradableInstrumentId),
        from: String(Math.floor(from)),
        to: String(Math.floor(to)),
        resolution,
      });

      const res = await tlFetch(session, `/trade/history?${params.toString()}`);
      if (!res.ok) return jsonResponse(classifyTlError(res.status, res.body), res.status === 429 ? 429 : 400);

      const payload = res.body as {
        s?: string;
        d?: { barDetails?: Record<string, unknown>[] };
        nb?: number;
      };
      if (payload?.s === "no_data") {
        return jsonResponse({
          candles: [],
          code: "market_closed",
          message: "No TradeLocker bars in this range. The market may be closed.",
        });
      }

      const bars = payload?.d?.barDetails || [];
      return jsonResponse({ candles: mapHistoryBars(bars, timeframe) });
    }

    if (action === "quote") {
      const tradableInstrumentId = Number(body.tradableInstrumentId);
      const routeId = Number(body.routeId);
      if (!Number.isFinite(tradableInstrumentId) || !Number.isFinite(routeId)) {
        return jsonResponse({ error: "Missing instrument route", code: "unknown" }, 400);
      }
      const params = new URLSearchParams({
        routeId: String(routeId),
        tradableInstrumentId: String(tradableInstrumentId),
      });
      const res = await tlFetch(session, `/trade/quotes?${params.toString()}`);
      if (!res.ok) return jsonResponse(classifyTlError(res.status, res.body), res.status === 429 ? 429 : 400);
      const quote = (res.body as { d?: Record<string, unknown> })?.d || {};
      const bid = finiteNumber(quote.bp);
      const ask = finiteNumber(quote.ap);
      const last = ask != null && bid != null ? (ask + bid) / 2 : ask ?? bid;
      if (last == null) {
        return jsonResponse({
          error: "Market is closed for this symbol.",
          code: "market_closed",
        }, 409);
      }
      return jsonResponse({
        quote: {
          bid,
          ask,
          last,
          time: Math.floor(Date.now() / 1000),
        },
      });
    }

    if (action === "positions" || action === "orders") {
      const configRes = await tlFetch(session, "/trade/config");
      if (!configRes.ok && configRes.status === 429) {
        return jsonResponse(classifyTlError(429, configRes.body), 429);
      }
      const config = configRes.ok ? (configRes.body as { d?: Record<string, unknown> })?.d : null;
      const instRes = await tlFetch(session, `/trade/accounts/${session.accountId}/instruments`);
      const instrumentMap: Record<string, string> = {};
      if (instRes.ok) {
        const instruments = (instRes.body as { d?: { instruments?: Record<string, unknown>[] } })?.d?.instruments || [];
        for (const inst of instruments) {
          if (inst.tradableInstrumentId && inst.name) {
            instrumentMap[String(inst.tradableInstrumentId)] = String(inst.name);
          }
        }
      }

      if (action === "positions") {
        const columns = (config?.positionsConfig as { columns?: { id: string }[] } | undefined)?.columns || [];
        const res = await tlFetch(session, `/trade/accounts/${session.accountId}/positions`);
        if (!res.ok) return jsonResponse(classifyTlError(res.status, res.body), res.status === 429 ? 429 : 400);
        const rows = (res.body as { d?: { positions?: unknown[] } })?.d?.positions || [];
        const positions = rows.map((row) => {
          const pos = Array.isArray(row) && columns.length ? rowToObject(columns, row) : (row as Record<string, unknown>);
          const symbol = instrumentMap[String(pos.tradableInstrumentId)] || String(pos.symbol || pos.tradableInstrumentId || "");
          return {
            id: String(pos.id ?? pos.positionId ?? ""),
            symbol,
            side: String(pos.side || "buy").toLowerCase() === "sell" ? "sell" : "buy",
            lots: Number(pos.qty ?? pos.volume ?? pos.size) || 0,
            entryPrice: Number(pos.avgPrice ?? pos.openPrice ?? pos.price) || 0,
            stopLoss: finiteNumber(pos.stopLoss ?? pos.sl ?? pos.stopLossPrice),
            takeProfit: finiteNumber(pos.takeProfit ?? pos.tp ?? pos.takeProfitPrice),
            currentPrice: Number(pos.currentPrice ?? pos.markPrice ?? pos.price ?? pos.avgPrice) || 0,
            pnl: Number(pos.unrealizedPl ?? pos.pnl ?? pos.netPl) || 0,
            openedAt: Number(pos.openDate ?? pos.openedAt ?? Date.now()),
          };
        }).filter((pos) => pos.id);
        return jsonResponse({ positions });
      }

      const columns = (config?.ordersConfig as { columns?: { id: string }[] } | undefined)?.columns || [];
      const res = await tlFetch(session, `/trade/accounts/${session.accountId}/orders`);
      if (!res.ok) return jsonResponse(classifyTlError(res.status, res.body), res.status === 429 ? 429 : 400);
      const rows = (res.body as { d?: { orders?: unknown[] } })?.d?.orders || [];
      const orders = rows.map((row) => {
        const ord = Array.isArray(row) && columns.length ? rowToObject(columns, row) : (row as Record<string, unknown>);
        const type = String(ord.type || "limit").toLowerCase();
        return {
          id: String(ord.id ?? ""),
          symbol: instrumentMap[String(ord.tradableInstrumentId)] || String(ord.symbol || ""),
          side: String(ord.side || "buy").toLowerCase() === "sell" ? "sell" : "buy",
          type: type === "stop" ? "stop" : "limit",
          lots: Number(ord.qty ?? ord.size) || 0,
          entryPrice: Number(ord.price ?? ord.stopPrice) || 0,
          stopLoss: finiteNumber(ord.stopLoss),
          takeProfit: finiteNumber(ord.takeProfit),
          createdAt: Number(ord.createdDate ?? Date.now()),
        };
      }).filter((ord) => ord.id);
      return jsonResponse({ orders });
    }

    if (action === "history") {
      const { data } = await supabase
        .from("broker_trade_history")
        .select("*")
        .eq("broker_connection_id", connectionId)
        .order("closed_at", { ascending: false })
        .limit(100);
      const history = (data || []).map((row) => ({
        id: String(row.id),
        symbol: String(row.symbol || ""),
        side: String(row.side || "buy").toLowerCase() === "sell" ? "sell" : "buy",
        lots: Number(row.size) || 0,
        entryPrice: Number(row.entry_price) || 0,
        exitPrice: Number(row.exit_price) || 0,
        pnl: Number(row.realized_pl) || 0,
        openedAt: row.opened_at ? new Date(row.opened_at).getTime() : Date.now(),
        closedAt: row.closed_at ? new Date(row.closed_at).getTime() : Date.now(),
      }));
      return jsonResponse({ history });
    }

    return jsonResponse({ error: `Unknown action: ${action}`, code: "unknown" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("tradelocker-market error:", error);
    return jsonResponse({ error: message, code: "unknown" }, 500);
  }
});
