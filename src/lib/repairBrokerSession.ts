import { supabase } from "@/integrations/supabase/client";

const REFRESH_SOON_MS = 5 * 60 * 1000;

export type SessionRefreshOutcome = "ok" | "permanent" | "transient";

const refreshInFlight = new Map<string, Promise<SessionRefreshOutcome>>();
let repairInFlight: Promise<{ attempted: number; restored: number }> | null = null;

async function readFunctionBody(error: unknown): Promise<Record<string, unknown> | null> {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try {
    return (await context.clone().json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Refresh one TradeLocker connection. Concurrent callers for the same id share
 * a single `refresh-session` request so a rotating refresh token is not spent twice.
 */
export function refreshTradeLockerConnection(connectionId: string): Promise<SessionRefreshOutcome> {
  const existing = refreshInFlight.get(connectionId);
  if (existing) return existing;

  const pending = (async (): Promise<SessionRefreshOutcome> => {
    const { data, error } = await supabase.functions.invoke("tradelocker", {
      body: { action: "refresh-session", connectionId },
    });
    if (!error && !data?.error) return "ok";

    const body =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : await readFunctionBody(error);
    if (body?.permanent === false) return "transient";
    if (body?.permanent === true) return "permanent";
    // Older function builds omit `permanent` but already mark the row expired.
    return "transient";
  })().finally(() => {
    refreshInFlight.delete(connectionId);
  });

  refreshInFlight.set(connectionId, pending);
  return pending;
}

async function repairTradeLockerSessionsInner(): Promise<{
  attempted: number;
  restored: number;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { attempted: 0, restored: 0 };

  const { data: connections } = await supabase
    .from("broker_connections")
    .select("id, connection_status, token_expiry")
    .eq("user_id", user.id)
    .eq("platform", "tradelocker")
    .in("connection_status", ["connected", "expired"]);

  if (!connections?.length) return { attempted: 0, restored: 0 };

  const now = Date.now();
  const targets = connections.filter((conn) => {
    if (conn.connection_status === "expired") return true;
    if (!conn.token_expiry) return false;
    return new Date(conn.token_expiry).getTime() - now < REFRESH_SOON_MS;
  });

  let restored = 0;
  for (const conn of targets) {
    const outcome = await refreshTradeLockerConnection(conn.id);
    if (outcome === "ok") restored += 1;
  }

  return { attempted: targets.length, restored };
}

/** Attempt silent TradeLocker token refresh for stale or expired connections. */
export function repairTradeLockerSessions(): Promise<{
  attempted: number;
  restored: number;
}> {
  if (repairInFlight) return repairInFlight;
  repairInFlight = repairTradeLockerSessionsInner().finally(() => {
    repairInFlight = null;
  });
  return repairInFlight;
}
