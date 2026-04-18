import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// Myfxbook Integration
// ----------------------------------------------------------------------------
// Each user logs in with their own Myfxbook email + password. The session
// token is cached in broker_connections; the password is stored encrypted so
// we can re-login automatically when the session expires. Trades flow into
// the standard `trades` table so the dashboard widgets work unchanged.
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MYFXBOOK_BASE = "https://www.myfxbook.com/api";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ----- Tiny symmetric encryption (AES-GCM) for stored passwords ------------
// We derive a key from SUPABASE_SERVICE_ROLE_KEY (always present in the
// function env) so we don't need a dedicated secret to deploy.
async function getEncKey() {
  const seed = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_DB_URL") ||
    "myfxbook-fallback-key";
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(seed),
  );
  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function b64encode(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function encryptText(plain: string): Promise<string> {
  const key = await getEncKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${b64encode(iv)}.${b64encode(cipher)}`;
}

async function decryptText(payload: string): Promise<string | null> {
  try {
    const [ivB64, cipherB64] = payload.split(".");
    if (!ivB64 || !cipherB64) return null;
    const key = await getEncKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64decode(ivB64) },
      key,
      b64decode(cipherB64),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

// ----- Myfxbook helpers -----------------------------------------------------

async function mfxLogin(email: string, password: string) {
  const url = `${MYFXBOOK_BASE}/login.json?email=${
    encodeURIComponent(email)
  }&password=${encodeURIComponent(password)}`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; NsyncJournal/1.0)",
    },
  });
  const data = await res.json().catch(() => null);
  // Myfxbook returns error as boolean OR string "false"/"true"
  const hasError = data?.error === true || data?.error === "true";
  if (!data || hasError || !data.session) {
    return {
      ok: false,
      message: data?.message || "Login failed — check your Myfxbook email and password",
    } as const;
  }
  return { ok: true, session: String(data.session) } as const;
}

async function mfxLogout(session: string) {
  try {
    await fetch(
      `${MYFXBOOK_BASE}/logout.json?session=${encodeURIComponent(session)}`,
    );
  } catch { /* ignore */ }
}

async function mfxAccounts(
  session: string,
): Promise<{ accounts: any[] | null; error?: string; invalidSession?: boolean }> {
  const url = `${MYFXBOOK_BASE}/get-my-accounts.json?session=${
    encodeURIComponent(session)
  }`;
  // Retry up to 3 times with backoff — Myfxbook intermittently
  // rejects a freshly-issued session with "Invalid session."
  let lastErr: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt));
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; NsyncJournal/1.0)",
      },
    });
    const data = await res.json().catch(() => null);
    if (!data) {
      lastErr = "Empty response from Myfxbook";
      continue;
    }
    const hasError = data.error === true || data.error === "true";
    if (hasError) {
      lastErr = data.message || "Myfxbook returned error";
      const invalid = /invalid session/i.test(lastErr);
      // On invalid-session, keep retrying; on other errors, fail fast
      if (!invalid) {
        return { accounts: null, error: lastErr };
      }
      continue;
    }
    return { accounts: (data.accounts as any[]) || [] };
  }
  return {
    accounts: null,
    error: lastErr || "Invalid session",
    invalidSession: /invalid session/i.test(lastErr || ""),
  };
}

async function mfxHistory(session: string, accountId: string | number) {
  const res = await fetch(
    `${MYFXBOOK_BASE}/get-history.json?session=${
      encodeURIComponent(session)
    }&id=${accountId}`,
  );
  const data = await res.json().catch(() => null);
  if (!data || data.error) return null;
  return data.history as any[];
}

async function mfxOpenTrades(session: string, accountId: string | number) {
  const res = await fetch(
    `${MYFXBOOK_BASE}/get-open-trades.json?session=${
      encodeURIComponent(session)
    }&id=${accountId}`,
  );
  const data = await res.json().catch(() => null);
  if (!data || data.error) return [];
  return (data.openTrades as any[]) || [];
}

async function mfxDailyGain(
  session: string,
  accountId: string | number,
  start: string,
  end: string,
) {
  const url = `${MYFXBOOK_BASE}/get-daily-gain.json?session=${
    encodeURIComponent(session)
  }&id=${accountId}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!data || data.error) return [];
  return (data.dailyGain as any[]) || [];
}

async function mfxGain(
  session: string,
  accountId: string | number,
  start: string,
  end: string,
) {
  const url = `${MYFXBOOK_BASE}/get-gain.json?session=${
    encodeURIComponent(session)
  }&id=${accountId}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!data || data.error) return null;
  return data.value ?? null;
}

// Wrap any Myfxbook call so an "invalid session" response triggers a single
// re-login + retry. Returns the call result, plus whether the session was
// refreshed so the caller can persist the new token.
async function withSessionRetry<T>(
  supabase: any,
  conn: any,
  call: (session: string) => Promise<{ ok: boolean; data: T } | T>,
): Promise<{ data: T | null; session: string | null; refreshed: boolean }> {
  const trySession = conn.myfxbook_session;
  if (trySession) {
    const result: any = await call(trySession);
    const isInvalid = result && typeof result === "object" &&
      ((result.error === true && /invalid session/i.test(result.message || "")) ||
        result.ok === false);
    if (!isInvalid) {
      return { data: result, session: trySession, refreshed: false };
    }
  }
  // Re-login
  if (!conn.myfxbook_password_enc) {
    return { data: null, session: null, refreshed: false };
  }
  const password = await decryptText(conn.myfxbook_password_enc);
  if (!password) return { data: null, session: null, refreshed: false };
  const login = await mfxLogin(conn.login, password);
  if (!login.ok) return { data: null, session: null, refreshed: false };
  await supabase
    .from("broker_connections")
    .update({ myfxbook_session: login.session })
    .eq("id", conn.id);
  const retry: any = await call(login.session);
  return { data: retry, session: login.session, refreshed: true };
}

// Get a valid session — uses cached one or re-logs in.
async function ensureSession(
  supabase: any,
  conn: any,
): Promise<{ session: string | null; updated: boolean }> {
  // Try cached session first by hitting a cheap endpoint
  if (conn.myfxbook_session) {
    const result = await mfxAccounts(conn.myfxbook_session);
    if (result.accounts) return { session: conn.myfxbook_session, updated: false };
  }
  // Re-login using stored encrypted password
  if (!conn.myfxbook_password_enc) return { session: null, updated: false };
  const password = await decryptText(conn.myfxbook_password_enc);
  if (!password) return { session: null, updated: false };
  const login = await mfxLogin(conn.login, password);
  if (!login.ok) return { session: null, updated: false };
  await supabase
    .from("broker_connections")
    .update({ myfxbook_session: login.session })
    .eq("id", conn.id);
  return { session: login.session, updated: true };
}

// ----- Mapping helpers -----------------------------------------------------

function normalizeDirection(action: string): "Long" | "Short" {
  const a = (action || "").toLowerCase();
  if (a.includes("sell") || a === "short") return "Short";
  return "Long";
}

function getSession(date: Date): string {
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 8) return "Asia";
  if (hour >= 8 && hour < 13) return "London";
  return "New York";
}

function parseMfxDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  // Myfxbook returns "MM/DD/YYYY HH:mm" in account timezone
  const d = new Date(s.replace(" ", "T") + "Z");
  if (!isNaN(d.getTime())) return d;
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// ----------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsErr || !claims?.claims?.sub) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = claims.claims.sub as string;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const action = body?.action as string | undefined;

  try {
    // ---------------- CONNECT ----------------
    if (action === "connect") {
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      if (!email || !password) {
        return jsonResponse({ error: "Email and password required" }, 400);
      }
      const login = await mfxLogin(email, password);
      if (!login.ok) {
        return jsonResponse({ error: login.message }, 401);
      }
      let activeSession = login.session;
      let accountsResult = await mfxAccounts(activeSession);
      // If Myfxbook rejected the freshly-issued session, log in again once.
      if (accountsResult.invalidSession) {
        console.log("[myfxbook] connect: session rejected, re-logging in");
        const relogin = await mfxLogin(email, password);
        if (relogin.ok) {
          activeSession = relogin.session;
          accountsResult = await mfxAccounts(activeSession);
        }
      }
      const accounts = accountsResult.accounts || [];
      if (accountsResult.error) {
        console.error("mfxAccounts error on connect:", accountsResult.error);
      }
      console.log(`[myfxbook] connect: fetched ${accounts.length} accounts for ${email}`);
      const enc = await encryptText(password);

      // Upsert one connection row per (user, login)
      const { data: existing } = await adminClient
        .from("broker_connections")
        .select("id")
        .eq("user_id", userId)
        .eq("platform", "myfxbook")
        .eq("login", email)
        .maybeSingle();

      let connectionId: string;
      if (existing) {
        connectionId = existing.id;
        await adminClient.from("broker_connections").update({
          connection_status: "connected",
          last_connected_at: new Date().toISOString(),
          myfxbook_session: login.session,
          myfxbook_password_enc: enc,
          last_error: null,
        }).eq("id", connectionId);
      } else {
        const { data: inserted, error: insErr } = await adminClient
          .from("broker_connections")
          .insert({
            user_id: userId,
            broker_name: "Myfxbook",
            platform: "myfxbook",
            login: email,
            server: "myfxbook.com",
            environment: "live",
            connection_status: "connected",
            last_connected_at: new Date().toISOString(),
            myfxbook_session: login.session,
            myfxbook_password_enc: enc,
            auto_sync_enabled: true,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        connectionId = inserted.id;
      }

      // Upsert broker_accounts rows
      for (const acc of accounts) {
        const accNum = Number(acc.id);
        await adminClient.from("broker_accounts").upsert({
          broker_connection_id: connectionId,
          acc_num: accNum,
          account_id_external: String(acc.id),
          account_name: acc.name || acc.accountId || `Account ${acc.id}`,
          is_active: false,
        }, { onConflict: "broker_connection_id,acc_num" });
      }

      return jsonResponse({
        success: true,
        connectionId,
        warning: accounts.length === 0
          ? (accountsResult.error ||
            "No accounts found on this Myfxbook profile. In Myfxbook, open Portfolio → your account → Settings → set Privacy to 'Public' or 'Custom' (with stats enabled), then click Sync.")
          : undefined,
        accounts: accounts.map((a) => ({
          id: String(a.id),
          name: a.name,
          accountId: a.accountId,
          balance: a.balance,
          equity: a.equity,
          gain: a.gain,
          drawdown: a.drawdown,
          profit: a.profit,
          server: a.server?.name || a.serverName,
          currency: a.currency,
        })),
      });
    }

    // ---------------- SELECT ACCOUNT ----------------
    if (action === "selectAccount") {
      const connectionId = String(body.connectionId || "");
      const accountIdExternal = String(body.accountId || "");
      if (!connectionId || !accountIdExternal) {
        return jsonResponse({ error: "Missing connectionId or accountId" }, 400);
      }
      const { data: conn } = await adminClient
        .from("broker_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!conn) return jsonResponse({ error: "Connection not found" }, 404);

      // Mark all accounts inactive, then activate the chosen one
      await adminClient
        .from("broker_accounts")
        .update({ is_active: false })
        .eq("broker_connection_id", connectionId);

      const { data: acc } = await adminClient
        .from("broker_accounts")
        .update({ is_active: true })
        .eq("broker_connection_id", connectionId)
        .eq("account_id_external", accountIdExternal)
        .select("acc_num")
        .maybeSingle();

      await adminClient.from("broker_connections").update({
        active_account_id: accountIdExternal,
        active_acc_num: acc?.acc_num || null,
      }).eq("id", connectionId);

      return jsonResponse({ success: true });
    }

    // ---------------- SYNC ----------------
    if (action === "sync") {
      const connectionId = String(body.connectionId || "");
      if (!connectionId) {
        return jsonResponse({ error: "Missing connectionId" }, 400);
      }

      const { data: conn } = await adminClient
        .from("broker_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!conn) return jsonResponse({ error: "Connection not found" }, 404);

      const accountIdExternal = body.accountId
        ? String(body.accountId)
        : conn.active_account_id;
      if (!accountIdExternal) {
        return jsonResponse({ error: "No active account selected" }, 400);
      }

      // Sync log
      const { data: logRow } = await adminClient
        .from("broker_sync_logs")
        .insert({
          broker_connection_id: connectionId,
          sync_type: "myfxbook",
          status: "started",
        })
        .select("id")
        .single();

      const { session, updated } = await ensureSession(adminClient, conn);
      if (!session) {
        await adminClient.from("broker_sync_logs").update({
          status: "failed",
          error_message: "Could not establish Myfxbook session",
          ended_at: new Date().toISOString(),
        }).eq("id", logRow?.id);
        await adminClient.from("broker_connections").update({
          connection_status: "error",
          last_error: "Myfxbook login required — please reconnect",
        }).eq("id", connectionId);
        return jsonResponse({
          error: "Session expired. Please reconnect.",
          needsReconnect: true,
        }, 401);
      }

      // Pull account snapshot
      const accountsResult = await mfxAccounts(session);
      const accounts = accountsResult.accounts || [];
      const acc = accounts.find((a) => String(a.id) === String(accountIdExternal));
      if (acc) {
        await adminClient.from("broker_connections").update({
          account_balance: acc.balance ?? null,
          account_equity: acc.equity ?? null,
          account_currency: acc.currency || "USD",
          last_connected_at: new Date().toISOString(),
          connection_status: "connected",
          last_error: null,
        }).eq("id", connectionId);
      }

      // Pull history
      const history = await mfxHistory(session, accountIdExternal) || [];
      let inserted = 0;

      for (const h of history) {
        // Skip non-trade entries (deposits/withdrawals)
        const action = String(h.action || "").toLowerCase();
        if (!action.includes("buy") && !action.includes("sell")) continue;

        const closeDate = parseMfxDate(h.closeTime || h.endTime);
        const openDate = parseMfxDate(h.openTime || h.startTime);
        if (!closeDate) continue;

        const profit = Number(h.profit || 0);
        const swap = Number(h.swap || 0);
        const commission = Number(h.commission || 0);
        const result = profit + swap + commission;

        const symbol = String(h.symbol || h.tradeSymbol || "Unknown");
        const direction = normalizeDirection(h.action);
        const dateStr = closeDate.toISOString().slice(0, 10);
        const sessionLabel = getSession(openDate || closeDate);
        const positionId = String(h.ticket || h.openTicket || h.id || "");

        // Upsert into trades table — dedupe by user_id + broker_position_id
        const { data: existing } = await adminClient
          .from("trades")
          .select("id")
          .eq("user_id", userId)
          .eq("broker_position_id", positionId)
          .eq("broker_name", "Myfxbook")
          .maybeSingle();

        const tradeRow = {
          user_id: userId,
          date: dateStr,
          pair: symbol,
          direction,
          result,
          session: sessionLabel,
          open_price: h.openPrice != null ? Number(h.openPrice) : null,
          close_price: h.closePrice != null ? Number(h.closePrice) : null,
          swap,
          commission,
          execution_type: "Market",
          broker_name: "Myfxbook",
          broker_environment: "live",
          broker_account_id: String(accountIdExternal),
          broker_acc_num: Number(accountIdExternal) || null,
          broker_position_id: positionId,
          imported_from_broker: true,
          last_broker_sync_at: new Date().toISOString(),
        };

        if (existing) {
          await adminClient.from("trades").update(tradeRow).eq("id", existing.id);
        } else {
          await adminClient.from("trades").insert(tradeRow);
          inserted++;
        }
      }

      await adminClient.from("broker_sync_logs").update({
        status: "completed",
        records_processed: history.length,
        ended_at: new Date().toISOString(),
      }).eq("id", logRow?.id);

      return jsonResponse({
        success: true,
        recordsProcessed: history.length,
        inserted,
        sessionRefreshed: updated,
      });
    }

    // ---------------- ACCOUNT INSIGHTS ----------------
    if (action === "insights") {
      const connectionId = String(body.connectionId || "");
      const { data: conn } = await adminClient
        .from("broker_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!conn) return jsonResponse({ error: "Connection not found" }, 404);

      const { session } = await ensureSession(adminClient, conn);
      if (!session) {
        return jsonResponse({ error: "Session expired", needsReconnect: true }, 401);
      }
      const accounts = await mfxAccounts(session) || [];
      const accountIdExternal = body.accountId || conn.active_account_id;
      const acc = accounts.find((a) => String(a.id) === String(accountIdExternal));
      const open = accountIdExternal
        ? await mfxOpenTrades(session, accountIdExternal)
        : [];
      return jsonResponse({ success: true, account: acc || null, openTrades: open });
    }

    // ---------------- ANALYTICS (clean structured data for UI) ----------------
    if (action === "analytics") {
      const connectionId = String(body.connectionId || "");
      const { data: conn } = await adminClient
        .from("broker_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!conn) return jsonResponse({ error: "Connection not found" }, 404);

      const { session } = await ensureSession(adminClient, conn);
      if (!session) {
        return jsonResponse({ error: "Session expired", needsReconnect: true }, 401);
      }
      const accountIdExternal = body.accountId || conn.active_account_id;
      if (!accountIdExternal) {
        return jsonResponse({ error: "No account selected" }, 400);
      }

      const accountsResult = await mfxAccounts(session);
      const acc = (accountsResult.accounts || []).find(
        (a) => String(a.id) === String(accountIdExternal),
      );
      const open = await mfxOpenTrades(session, accountIdExternal);
      const history = await mfxHistory(session, accountIdExternal) || [];

      // Date range (default last 90 days)
      const today = new Date();
      const start = body.start ||
        new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);
      const end = body.end || today.toISOString().slice(0, 10);
      const dailyGain = await mfxDailyGain(session, accountIdExternal, start, end);
      const totalGain = await mfxGain(session, accountIdExternal, start, end);

      // Win rate from closed history
      const closed = history.filter((h: any) => {
        const a = String(h.action || "").toLowerCase();
        return a.includes("buy") || a.includes("sell");
      });
      const wins = closed.filter((h: any) => Number(h.profit || 0) > 0).length;
      const winRate = closed.length ? (wins / closed.length) * 100 : 0;

      return jsonResponse({
        success: true,
        account: acc
          ? {
            id: String(acc.id),
            name: acc.name,
            balance: acc.balance ?? 0,
            equity: acc.equity ?? 0,
            profit: acc.profit ?? 0,
            gain: acc.gain ?? 0,
            drawdown: acc.drawdown ?? 0,
            currency: acc.currency || "USD",
          }
          : null,
        openTrades: open,
        closedTrades: closed,
        dailyGain,
        totalGain,
        winRate: Number(winRate.toFixed(2)),
        totalTrades: closed.length,
      });
    }

    // ---------------- DISCONNECT ----------------
    if (action === "disconnect") {
      const connectionId = String(body.connectionId || "");
      const { data: conn } = await adminClient
        .from("broker_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (conn?.myfxbook_session) {
        await mfxLogout(conn.myfxbook_session);
      }
      await adminClient.from("broker_connections").update({
        connection_status: "disconnected",
        myfxbook_session: null,
      }).eq("id", connectionId);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error("Myfxbook function error:", e);
    return jsonResponse({ error: e?.message || "Internal error" }, 500);
  }
});
