import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bridge-key",
};

type SupabaseClient = ReturnType<typeof createClient>;

type BridgeAuth = {
  bridge: {
    id: string;
    broker_connection_id: string;
    token_hash: string;
  };
  connection: {
    id: string;
    user_id: string;
    active_account_id: string | null;
    active_acc_num: number | null;
    environment: string | null;
    mt5_login: string | null;
    mt5_server: string | null;
    mt5_password_enc: string | null;
  };
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function getSession(date: Date): string {
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 8) return "Asia";
  if (hour >= 8 && hour < 13) return "London";
  return "New York";
}

function isoToLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mapDirection(side: string): "Long" | "Short" {
  return side?.toLowerCase() === "sell" ? "Short" : "Long";
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function isoOrNow(value: unknown): string {
  if (!value) return new Date().toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function randomSecret(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function credentialKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("MT5_CREDENTIAL_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Missing MT5 credential encryption secret");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptCredential(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await credentialKey();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );

  return JSON.stringify({
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  });
}

async function decryptCredential(value: string): Promise<string> {
  const parsed = JSON.parse(value) as { iv: string; ciphertext: string };
  const key = await credentialKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(parsed.iv) },
    key,
    base64ToBytes(parsed.ciphertext),
  );

  return new TextDecoder().decode(plaintext);
}

async function requireUser(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { user: null, response: jsonResponse({ error: "Missing authorization header" }, 401) };

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { user: null, response: jsonResponse({ error: "Unauthorized" }, 401) };

  return { user, response: null };
}

async function requireBridge(req: Request, body: Record<string, unknown>, supabase: SupabaseClient): Promise<{ auth: BridgeAuth | null; response: Response | null }> {
  const bridgeKey = String(req.headers.get("x-bridge-key") || body.bridgeKey || "");
  const [bridgeId] = bridgeKey.split(".");
  if (!bridgeKey || !bridgeId) {
    return { auth: null, response: jsonResponse({ error: "Missing bridge key" }, 401) };
  }

  const tokenHash = await sha256Hex(bridgeKey);
  const { data: bridge, error } = await supabase
    .from("broker_bridges")
    .select("id, broker_connection_id, token_hash, status")
    .eq("id", bridgeId)
    .maybeSingle();

  if (error || !bridge || bridge.token_hash !== tokenHash || bridge.status === "revoked") {
    return { auth: null, response: jsonResponse({ error: "Invalid bridge key" }, 401) };
  }

  const { data: connection } = await supabase
    .from("broker_connections")
    .select("id, user_id, active_account_id, active_acc_num, environment, mt5_login, mt5_server, mt5_password_enc")
    .eq("id", bridge.broker_connection_id)
    .eq("platform", "mt5")
    .maybeSingle();

  if (!connection) {
    return { auth: null, response: jsonResponse({ error: "MT5 connection not found" }, 404) };
  }

  return {
    auth: { bridge, connection } as BridgeAuth,
    response: null,
  };
}

async function createConnection(req: Request, body: Record<string, unknown>, supabase: SupabaseClient) {
  const { user, response } = await requireUser(req, supabase);
  if (response || !user) return response;

  const brokerName = String(body.brokerName || "MetaTrader 5");
  const server = String(body.server || body.mt5Server || "");
  const login = String(body.login || body.mt5Login || "");
  const password = String(body.password || body.mt5Password || "");
  const accountCurrency = String(body.accountCurrency || "USD");

  if (!login || !password || !server) {
    return jsonResponse({ error: "MT5 login, password, and server are required" }, 400);
  }

  const encryptedPassword = await encryptCredential(password);

  const { data: connection, error: connectionError } = await supabase
    .from("broker_connections")
    .insert({
      user_id: user.id,
      platform: "mt5",
      broker_name: brokerName,
      server,
      login,
      mt5_login: login,
      mt5_server: server,
      mt5_password_enc: encryptedPassword,
      connection_status: "connecting",
      environment: "local",
      account_currency: accountCurrency,
      auto_sync_enabled: true,
      sync_interval_seconds: 30,
    })
    .select()
    .single();

  if (connectionError || !connection) {
    console.error("MT5 connection insert error:", connectionError);
    return jsonResponse({ error: "Failed to create MT5 connection" }, 500);
  }

  const bridgeId = crypto.randomUUID();
  const bridgeKey = `${bridgeId}.${randomSecret()}`;
  const tokenHash = await sha256Hex(bridgeKey);

  const { error: bridgeError } = await supabase
    .from("broker_bridges")
    .insert({
      id: bridgeId,
      broker_connection_id: connection.id,
      token_hash: tokenHash,
      name: String(body.bridgeName || "Local MT5 Bridge"),
      status: "pending",
    });

  if (bridgeError) {
    console.error("MT5 bridge insert error:", bridgeError);
    await supabase.from("broker_connections").delete().eq("id", connection.id);
    return jsonResponse({ error: "Failed to create bridge pairing key" }, 500);
  }

  return jsonResponse({
    success: true,
    connectionId: connection.id,
    bridgeKey,
    message: "MT5 connection created. Start the local bridge with this key.",
  });
}

async function getConnectionStatus(req: Request, body: Record<string, unknown>, supabase: SupabaseClient) {
  const { user, response } = await requireUser(req, supabase);
  if (response || !user) return response;

  const connectionId = String(body.connectionId || "");
  const { data: bridge } = await supabase
    .from("broker_bridges")
    .select("id, status, last_heartbeat_at, last_error, bridge_version, machine_name, updated_at")
    .eq("broker_connection_id", connectionId)
    .maybeSingle();

  const { data: recentCommands } = await supabase
    .from("broker_trade_commands")
    .select("id, command_type, status, error_message, result, requested_at, completed_at")
    .eq("broker_connection_id", connectionId)
    .order("requested_at", { ascending: false })
    .limit(10);

  return jsonResponse({ bridge, recentCommands: recentCommands || [] });
}

async function bridgeConfig(req: Request, body: Record<string, unknown>, supabase: SupabaseClient) {
  const { auth, response } = await requireBridge(req, body, supabase);
  if (response || !auth) return response;

  if (!auth.connection.mt5_login || !auth.connection.mt5_server || !auth.connection.mt5_password_enc) {
    return jsonResponse({ error: "MT5 credentials are not configured for this connection" }, 400);
  }

  const password = await decryptCredential(auth.connection.mt5_password_enc);
  return jsonResponse({
    mt5Login: auth.connection.mt5_login,
    mt5Password: password,
    mt5Server: auth.connection.mt5_server,
  });
}

async function heartbeat(req: Request, body: Record<string, unknown>, supabase: SupabaseClient) {
  const { auth, response } = await requireBridge(req, body, supabase);
  if (response || !auth) return response;

  const now = new Date().toISOString();
  await supabase
    .from("broker_bridges")
    .update({
      status: "online",
      last_heartbeat_at: now,
      last_error: body.error ? String(body.error) : null,
      bridge_version: body.bridgeVersion ? String(body.bridgeVersion) : null,
      machine_name: body.machineName ? String(body.machineName) : null,
    })
    .eq("id", auth.bridge.id);

  await supabase
    .from("broker_connections")
    .update({
      connection_status: "connected",
      last_connected_at: now,
      last_error: body.error ? String(body.error) : null,
    })
    .eq("id", auth.connection.id);

  return jsonResponse({ success: true, serverTime: now });
}

async function syncSnapshot(req: Request, body: Record<string, unknown>, supabase: SupabaseClient) {
  const { auth, response } = await requireBridge(req, body, supabase);
  if (response || !auth) return response;

  const now = new Date().toISOString();
  const account = (body.account || {}) as Record<string, unknown>;
  const positions = Array.isArray(body.positions) ? body.positions as Record<string, unknown>[] : [];
  const orders = Array.isArray(body.orders) ? body.orders as Record<string, unknown>[] : [];
  const history = Array.isArray(body.history) ? body.history as Record<string, unknown>[] : [];

  const accountId = String(account.login || account.account_id || auth.connection.active_account_id || "mt5-local");
  const accNum = Number(account.login) || auth.connection.active_acc_num || 1;
  const server = account.server ? String(account.server) : undefined;
  const brokerName = account.company ? String(account.company) : "MetaTrader 5";

  await supabase
    .from("broker_connections")
    .update({
      broker_name: brokerName,
      server,
      login: accountId,
      active_account_id: accountId,
      active_acc_num: accNum,
      account_balance: numberOrNull(account.balance),
      account_equity: numberOrNull(account.equity),
      account_currency: account.currency ? String(account.currency) : "USD",
      connection_status: "connected",
      last_connected_at: now,
      last_error: null,
    })
    .eq("id", auth.connection.id);

  const { data: existingAccount } = await supabase
    .from("broker_accounts")
    .select("id")
    .eq("broker_connection_id", auth.connection.id)
    .eq("account_id_external", accountId)
    .maybeSingle();

  const accountPayload = {
    broker_connection_id: auth.connection.id,
    account_id_external: accountId,
    acc_num: accNum,
    account_name: String(account.name || `${brokerName} ${accountId}`),
    is_active: true,
  };

  if (existingAccount) {
    await supabase.from("broker_accounts").update(accountPayload).eq("id", existingAccount.id);
  } else {
    await supabase.from("broker_accounts").insert(accountPayload);
  }

  const positionIds = new Set(positions.map((position) => String(position.ticket || position.position_id)).filter(Boolean));
  const { data: existingPositions } = await supabase
    .from("broker_positions")
    .select("id, position_id")
    .eq("broker_connection_id", auth.connection.id);

  for (const existing of existingPositions || []) {
    if (!positionIds.has(String(existing.position_id))) {
      await supabase.from("broker_positions").delete().eq("id", existing.id);
    }
  }

  for (const position of positions) {
    const positionId = String(position.ticket || position.position_id);
    if (!positionId) continue;
    const side = String(position.side || position.type || "buy").toLowerCase().includes("sell") ? "sell" : "buy";
    const payload = {
      broker_connection_id: auth.connection.id,
      position_id: positionId,
      symbol: String(position.symbol || "UNKNOWN"),
      type: side === "buy" ? "POSITION_TYPE_BUY" : "POSITION_TYPE_SELL",
      side,
      volume: numberOrZero(position.volume),
      open_price: numberOrZero(position.open_price || position.price_open),
      current_price: numberOrNull(position.current_price || position.price_current),
      stop_loss: numberOrNull(position.stop_loss || position.sl),
      take_profit: numberOrNull(position.take_profit || position.tp),
      profit: numberOrZero(position.profit),
      floating_pl: numberOrZero(position.profit),
      swap: numberOrZero(position.swap),
      commission: numberOrZero(position.commission),
      open_time: isoOrNow(position.open_time || position.time),
      magic_number: numberOrNull(position.magic),
      comment: position.comment ? String(position.comment) : null,
      raw_payload: position,
      last_seen_at: now,
    };

    const { data: existing } = await supabase
      .from("broker_positions")
      .select("id")
      .eq("broker_connection_id", auth.connection.id)
      .eq("position_id", positionId)
      .maybeSingle();

    if (existing) {
      await supabase.from("broker_positions").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("broker_positions").insert(payload);
    }
  }

  const orderIds = new Set(orders.map((order) => String(order.ticket || order.order_id)).filter(Boolean));
  const { data: existingOrders } = await supabase
    .from("broker_orders")
    .select("id, broker_order_id")
    .eq("broker_connection_id", auth.connection.id);

  for (const existing of existingOrders || []) {
    if (!orderIds.has(String(existing.broker_order_id))) {
      await supabase.from("broker_orders").delete().eq("id", existing.id);
    }
  }

  for (const order of orders) {
    const orderId = String(order.ticket || order.order_id);
    if (!orderId) continue;
    const side = String(order.side || order.type || "buy").toLowerCase().includes("sell") ? "sell" : "buy";
    const payload = {
      broker_connection_id: auth.connection.id,
      broker_order_id: orderId,
      symbol: String(order.symbol || "UNKNOWN"),
      order_type: String(order.order_type || order.type || "pending"),
      side,
      size: numberOrZero(order.volume || order.size),
      entry_price: numberOrNull(order.price_open || order.price || order.entry_price),
      stop_loss: numberOrNull(order.stop_loss || order.sl),
      take_profit: numberOrNull(order.take_profit || order.tp),
      status: String(order.status || "pending"),
      created_broker_at: isoOrNull(order.created_at || order.time_setup || order.time),
      raw_payload: order,
      last_seen_at: now,
    };

    const { data: existing } = await supabase
      .from("broker_orders")
      .select("id")
      .eq("broker_connection_id", auth.connection.id)
      .eq("broker_order_id", orderId)
      .maybeSingle();

    if (existing) {
      await supabase.from("broker_orders").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("broker_orders").insert(payload);
    }
  }

  for (const trade of history) {
    const orderId = trade.order_id || trade.ticket ? String(trade.order_id || trade.ticket) : null;
    const positionId = trade.position_id ? String(trade.position_id) : orderId;
    const openedAt = isoOrNow(trade.opened_at || trade.open_time || trade.time);
    const closedAt = isoOrNull(trade.closed_at || trade.close_time || trade.time_done) || now;
    const side = String(trade.side || trade.type || "buy").toLowerCase().includes("sell") ? "sell" : "buy";
    const tradePayload = {
      broker_connection_id: auth.connection.id,
      broker_order_id: orderId,
      broker_position_id: positionId,
      symbol: String(trade.symbol || "UNKNOWN"),
      side,
      size: numberOrZero(trade.volume || trade.size),
      entry_price: numberOrZero(trade.entry_price || trade.price_open || trade.price),
      exit_price: numberOrNull(trade.exit_price || trade.price_close),
      realized_pl: numberOrZero(trade.realized_pl || trade.profit) +
        numberOrZero(trade.swap) +
        numberOrZero(trade.commission),
      fees: numberOrZero(trade.fees) + numberOrZero(trade.commission) + numberOrZero(trade.swap),
      opened_at: openedAt,
      closed_at: closedAt,
      raw_payload: trade,
      synced_at: now,
    };

    let existingQuery = supabase
      .from("broker_trade_history")
      .select("id")
      .eq("broker_connection_id", auth.connection.id);

    if (orderId) {
      existingQuery = existingQuery.eq("broker_order_id", orderId);
    } else if (positionId) {
      existingQuery = existingQuery.eq("broker_position_id", positionId).eq("closed_at", closedAt);
    }

    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) {
      await supabase.from("broker_trade_history").update(tradePayload).eq("id", existing.id);
    } else {
      await supabase.from("broker_trade_history").insert(tradePayload);
    }

    const journalMatch = supabase
      .from("trades")
      .select("id")
      .eq("user_id", auth.connection.user_id);
    const { data: existingJournal } = orderId
      ? await journalMatch.eq("broker_order_id", orderId).maybeSingle()
      : await journalMatch.eq("broker_position_id", positionId).maybeSingle();

    const tradeDate = new Date(closedAt);
    const swap = numberOrZero(trade.swap);
    const commission = numberOrZero(trade.commission);
    const gross = numberOrZero(trade.realized_pl || trade.profit);
    const netPl = gross + swap + commission;
    const journalPayload = {
      user_id: auth.connection.user_id,
      pair: String(trade.symbol || "UNKNOWN"),
      direction: mapDirection(side),
      result: netPl,
      date: isoToLocalDateKey(closedAt),
      session: getSession(tradeDate),
      broker_name: brokerName,
      broker_environment: "local",
      broker_account_id: accountId,
      broker_acc_num: accNum,
      broker_order_id: orderId,
      broker_position_id: positionId,
      imported_from_broker: true,
      last_broker_sync_at: now,
      execution_type: "market",
      open_price: numberOrNull(trade.entry_price || trade.price_open || trade.price),
      close_price: numberOrNull(trade.exit_price || trade.price_close),
      open_time: openedAt,
      close_time: closedAt,
      swap: 0,
      commission: 0,
    };

    if (existingJournal) {
      await supabase.from("trades").update(journalPayload).eq("id", existingJournal.id);
    } else {
      await supabase.from("trades").insert(journalPayload);
    }
  }

  await supabase.from("broker_sync_logs").insert({
    broker_connection_id: auth.connection.id,
    sync_type: "mt5_snapshot",
    status: "completed",
    started_at: now,
    ended_at: new Date().toISOString(),
    records_processed: positions.length + orders.length + history.length,
    error_message: JSON.stringify({ positions: positions.length, orders: orders.length, history: history.length }),
  });

  await supabase
    .from("broker_bridges")
    .update({ status: "online", last_heartbeat_at: now, last_error: null })
    .eq("id", auth.bridge.id);

  return jsonResponse({
    success: true,
    stats: { positions: positions.length, orders: orders.length, history: history.length },
  });
}

async function queueCommand(req: Request, body: Record<string, unknown>, supabase: SupabaseClient) {
  const { user, response } = await requireUser(req, supabase);
  if (response || !user) return response;

  const connectionId = String(body.connectionId || "");
  const commandType = String(body.commandType || "");
  const payload = (body.payload || {}) as Record<string, unknown>;

  const { data: connection } = await supabase
    .from("broker_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .eq("platform", "mt5")
    .maybeSingle();

  if (!connection) return jsonResponse({ error: "MT5 connection not found" }, 404);

  const { data: command, error } = await supabase
    .from("broker_trade_commands")
    .insert({
      broker_connection_id: connectionId,
      command_type: commandType,
      payload,
      requested_by: user.id,
      status: "pending",
    })
    .select()
    .single();

  if (error || !command) {
    console.error("MT5 command insert error:", error);
    return jsonResponse({ error: "Failed to queue MT5 command" }, 500);
  }

  return jsonResponse({ success: true, command, message: "Command queued for the MT5 bridge." });
}

async function pollCommands(req: Request, body: Record<string, unknown>, supabase: SupabaseClient) {
  const { auth, response } = await requireBridge(req, body, supabase);
  if (response || !auth) return response;

  const now = new Date().toISOString();
  const { data: commands } = await supabase
    .from("broker_trade_commands")
    .select("id, command_type, payload, requested_at")
    .eq("broker_connection_id", auth.connection.id)
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(10);

  const ids = (commands || []).map((command: { id: string }) => command.id);
  if (ids.length) {
    await supabase
      .from("broker_trade_commands")
      .update({ status: "sent", sent_at: now })
      .in("id", ids);
  }

  return jsonResponse({ commands: commands || [] });
}

async function disconnectConnection(req: Request, body: Record<string, unknown>, supabase: SupabaseClient) {
  const { user, response } = await requireUser(req, supabase);
  if (response || !user) return response;

  const connectionId = String(body.connectionId || "");
  if (!connectionId) {
    return jsonResponse({ error: "Missing connectionId" }, 400);
  }

  const { data: owned } = await supabase
    .from("broker_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .eq("platform", "mt5")
    .maybeSingle();

  if (!owned) {
    return jsonResponse({ error: "Connection not found" }, 404);
  }

  await supabase.from("broker_positions").delete().eq("broker_connection_id", connectionId);
  await supabase.from("broker_orders").delete().eq("broker_connection_id", connectionId);
  await supabase.from("broker_trade_history").delete().eq("broker_connection_id", connectionId);
  await supabase.from("broker_sync_logs").delete().eq("broker_connection_id", connectionId);
  await supabase.from("broker_trade_commands").delete().eq("broker_connection_id", connectionId);
  await supabase.from("broker_bridges").delete().eq("broker_connection_id", connectionId);
  await supabase.from("broker_accounts").delete().eq("broker_connection_id", connectionId);

  const { error: deleteError } = await supabase
    .from("broker_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("MT5 disconnect delete error:", deleteError);
    return jsonResponse({ error: deleteError.message || "Failed to remove connection" }, 500);
  }

  return jsonResponse({ success: true, message: "MT5 connection removed" });
}

async function commandResult(req: Request, body: Record<string, unknown>, supabase: SupabaseClient) {
  const { auth, response } = await requireBridge(req, body, supabase);
  if (response || !auth) return response;

  const commandId = String(body.commandId || "");
  const ok = Boolean(body.success);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("broker_trade_commands")
    .update({
      status: ok ? "completed" : "failed",
      completed_at: now,
      result: (body.result || null) as Record<string, unknown> | null,
      error_message: body.error ? String(body.error) : null,
    })
    .eq("id", commandId)
    .eq("broker_connection_id", auth.connection.id);

  if (error) {
    console.error("MT5 command result update error:", error);
    return jsonResponse({ error: "Failed to update command result" }, 500);
  }

  return jsonResponse({ success: true });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    switch (action) {
      case "create-connection":
        return await createConnection(req, body, supabase);
      case "disconnect":
        return await disconnectConnection(req, body, supabase);
      case "status":
        return await getConnectionStatus(req, body, supabase);
      case "bridge-config":
        return await bridgeConfig(req, body, supabase);
      case "heartbeat":
        return await heartbeat(req, body, supabase);
      case "sync-snapshot":
        return await syncSnapshot(req, body, supabase);
      case "queue-command":
        return await queueCommand(req, body, supabase);
      case "poll-commands":
        return await pollCommands(req, body, supabase);
      case "command-result":
        return await commandResult(req, body, supabase);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("MT5 bridge function error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
