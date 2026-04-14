import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getBaseUrl(environment: string): string {
  return environment === 'live'
    ? 'https://live.tradelocker.com/backend-api'
    : 'https://demo.tradelocker.com/backend-api';
}

function getSession(date: Date): string {
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 8) return 'Asia';
  if (hour >= 8 && hour < 13) return 'London';
  return 'New York';
}

function mapDirection(side: string): 'Long' | 'Short' {
  return side?.toLowerCase() === 'sell' ? 'Short' : 'Long';
}

// TradeLocker returns data in columnar format: arrays of arrays.
// This helper converts an array row into an object using column definitions.
function rowToObject(columns: { id: string }[], row: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (let i = 0; i < columns.length && i < row.length; i++) {
    obj[columns[i].id] = row[i];
  }
  return obj;
}

// Account details column indices (from /trade/config accountDetailsConfig)
const ACCOUNT_DETAILS_COLUMNS = [
  'balance', 'projectedBalance', 'availableFunds', 'blockedBalance',
  'cashBalance', 'unsettledCash', 'withdrawalAvailable', 'stocksValue',
  'optionValue', 'initialMarginReq', 'maintMarginReq', 'marginWarningLevel',
  'blockedForStocks', 'stockOrdersReq', 'stopOutLevel', 'warningMarginReq',
  'marginBeforeWarning', 'todayGross', 'todayNet', 'todayFees', 'todayVolume',
  'todayTradesCount', 'openGrossPnL', 'openNetPnL', 'positionsCount', 'ordersCount'
];

function parseAccountState(data: any): Record<string, number> | null {
  const arr = data?.d?.accountDetailsData;
  if (!Array.isArray(arr)) return null;
  const result: Record<string, number> = {};
  for (let i = 0; i < ACCOUNT_DETAILS_COLUMNS.length && i < arr.length; i++) {
    result[ACCOUNT_DETAILS_COLUMNS[i]] = Number(arr[i]) || 0;
  }
  // Add convenience aliases
  result.equity = result.projectedBalance || 0;
  result.freeMargin = result.availableFunds || 0;
  result.usedMargin = result.initialMarginReq || 0;
  result.unrealizedPl = result.openNetPnL || 0;
  return result;
}

// ====================== TRADELOCKER API HELPERS ======================

async function tlAuth(email: string, password: string, server: string, environment: string) {
  const baseUrl = getBaseUrl(environment);
  try {
    const res = await fetch(`${baseUrl}/auth/jwt/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, server }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('TL auth failed:', text);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('TL auth error:', e);
    return null;
  }
}

async function tlRefresh(refreshToken: string, environment: string) {
  const baseUrl = getBaseUrl(environment);
  try {
    const res = await fetch(`${baseUrl}/auth/jwt/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function tlGetAccounts(accessToken: string, environment: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/auth/jwt/all-accounts`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.accounts || [];
}

async function tlGetAccountState(accessToken: string, accountId: string, accNum: number, environment: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/state`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) {
    const t = await res.text();
    console.error('TL state error:', res.status, t);
    return null;
  }
  const data = await res.json();
  return parseAccountState(data);
}

async function tlGetConfig(accessToken: string, accNum: number, environment: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/config`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.d || null;
}

async function tlGetPositions(accessToken: string, accountId: string, accNum: number, environment: string, posColumns?: { id: string }[]) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/positions`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const rows = data.d?.positions || [];
  if (!posColumns || rows.length === 0) return rows;
  // Convert columnar format to objects
  return rows.map((row: any[]) => rowToObject(posColumns, row));
}

async function tlGetOrders(accessToken: string, accountId: string, accNum: number, environment: string, ordColumns?: { id: string }[]) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/orders`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const rows = data.d?.orders || [];
  if (!ordColumns || rows.length === 0) return rows;
  return rows.map((row: any[]) => rowToObject(ordColumns, row));
}

async function tlGetOrdersHistory(accessToken: string, accountId: string, accNum: number, environment: string, columns?: { id: string }[]) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/ordersHistory`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const rows = data.d?.ordersHistory || [];
  if (!columns || rows.length === 0) return rows;
  return rows.map((row: any[]) => rowToObject(columns, row));
}

async function tlGetPositionsHistory(accessToken: string, accountId: string, accNum: number, environment: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/positionsHistory`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) return []; // Many servers return 404 for this endpoint
  const data = await res.json();
  return data.d?.positions || [];
}

async function tlGetInstruments(accessToken: string, accountId: string, accNum: number, environment: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/instruments`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.d?.instruments || [];
}

async function tlPlaceOrder(accessToken: string, accountId: string, accNum: number, environment: string, orderPayload: any) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'accNum': String(accNum),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

async function tlModifyOrder(accessToken: string, accountId: string, accNum: number, environment: string, orderId: string, payload: any) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/orders/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'accNum': String(accNum),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

async function tlCancelOrder(accessToken: string, accountId: string, accNum: number, environment: string, orderId: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/orders/${orderId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  return { ok: res.ok };
}

async function tlClosePosition(accessToken: string, accountId: string, accNum: number, environment: string, positionId: string, qty?: number) {
  const baseUrl = getBaseUrl(environment);
  const body: any = {};
  if (qty) body.qty = qty;
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/positions/${positionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'accNum': String(accNum),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok };
}

async function tlModifyPosition(accessToken: string, accountId: string, accNum: number, environment: string, positionId: string, payload: any) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/positions/${positionId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'accNum': String(accNum),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// ====================== TOKEN MANAGEMENT ======================

async function getValidToken(supabase: any, connectionId: string): Promise<{ accessToken: string; environment: string; accountId: string; accNum: number } | null> {
  const { data: conn } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (!conn) return null;

  let tokenData: any;
  try {
    tokenData = JSON.parse(conn.metaapi_account_id || '{}');
  } catch {
    return null;
  }

  const environment = conn.environment || 'demo';
  const accountId = conn.active_account_id;
  const accNum = conn.active_acc_num;

  if (!tokenData.accessToken || !accountId || !accNum) return null;

  // Check if token is expired
  if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
    if (!tokenData.refreshToken) return null;
    const refreshResult = await tlRefresh(tokenData.refreshToken, environment);
    if (!refreshResult) {
      // Mark as expired
      await supabase
        .from('broker_connections')
        .update({ connection_status: 'expired', last_error: 'Token refresh failed automatically' })
        .eq('id', connectionId);
      return null;
    }

    const newTokenData = {
      accessToken: refreshResult.accessToken,
      refreshToken: refreshResult.refreshToken,
    };

    await supabase
      .from('broker_connections')
      .update({
        metaapi_account_id: JSON.stringify(newTokenData),
        token_expiry: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        connection_status: 'connected',
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    return { accessToken: refreshResult.accessToken, environment, accountId, accNum };
  }

  return { accessToken: tokenData.accessToken, environment, accountId, accNum };
}

// ====================== MAIN HANDLER ======================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const { action } = body;
    console.log(`TradeLocker action: ${action}, user: ${user.id}`);

    // ====================== CONNECT ======================
    if (action === 'connect') {
      const { email, password, server, environment } = body;
      if (!email || !password || !server || !environment) {
        return jsonResponse({ error: 'Missing required fields' }, 400);
      }

      const authResult = await tlAuth(email, password, server, environment);
      if (!authResult || !authResult.accessToken) {
        return jsonResponse({ error: 'Failed to authenticate with TradeLocker. Check credentials and server name.' }, 400);
      }

      const accounts = await tlGetAccounts(authResult.accessToken, environment);
      if (!accounts.length) {
        return jsonResponse({ error: 'No TradeLocker accounts found.' }, 400);
      }

      const tokenData = JSON.stringify({
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
      });

      // Check for existing connection and update, or create new
      const { data: existingConn } = await supabase
        .from('broker_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'tradelocker')
        .maybeSingle();

      let connection;
      if (existingConn) {
        // Update existing connection
        const { data, error } = await supabase
          .from('broker_connections')
          .update({
            server,
            login: email,
            metaapi_account_id: tokenData,
            connection_status: 'connected',
            environment,
            token_expiry: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            last_connected_at: new Date().toISOString(),
            last_error: null,
            active_account_id: null,
            active_acc_num: null,
          })
          .eq('id', existingConn.id)
          .select()
          .single();
        if (error) {
          console.error('Update error:', error);
          return jsonResponse({ error: 'Failed to update connection' }, 500);
        }
        connection = data;
        // Clear old accounts
        await supabase.from('broker_accounts').delete().eq('broker_connection_id', connection.id);
      } else {
        const { data, error } = await supabase
          .from('broker_connections')
          .insert({
            user_id: user.id,
            platform: 'tradelocker',
            broker_name: 'TradeLocker',
            server,
            login: email,
            metaapi_account_id: tokenData,
            connection_status: 'connected',
            environment,
            token_expiry: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            last_connected_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) {
          console.error('Insert error:', error);
          return jsonResponse({ error: 'Failed to save connection' }, 500);
        }
        connection = data;
      }

      // Store broker accounts
      for (const acc of accounts) {
        await supabase.from('broker_accounts').insert({
          broker_connection_id: connection.id,
          account_id_external: String(acc.id),
          acc_num: acc.accNum,
          account_name: acc.name || `Account ${acc.accNum}`,
        });
      }

      return jsonResponse({
        success: true,
        connection: { ...connection, metaapi_account_id: undefined },
        accounts: accounts.map((a: any) => ({ id: String(a.id), accNum: a.accNum, name: a.name || `Account ${a.accNum}` })),
        message: 'TradeLocker connected successfully!',
      });
    }

    // ====================== SELECT ACCOUNT ======================
    if (action === 'select-account') {
      const { connectionId, accountId, accNum } = body;

      await supabase
        .from('broker_accounts')
        .update({ is_active: false })
        .eq('broker_connection_id', connectionId);

      await supabase
        .from('broker_accounts')
        .update({ is_active: true })
        .eq('broker_connection_id', connectionId)
        .eq('account_id_external', accountId);

      const { error } = await supabase
        .from('broker_connections')
        .update({
          active_account_id: accountId,
          active_acc_num: accNum,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId)
        .eq('user_id', user.id);

      if (error) return jsonResponse({ error: 'Failed to select account' }, 500);

      // Fetch initial account state
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (tokenInfo) {
        const state = await tlGetAccountState(tokenInfo.accessToken, accountId, accNum, tokenInfo.environment);
        if (state) {
          await supabase
            .from('broker_connections')
            .update({
              account_balance: state.balance,
              account_equity: state.equity,
              last_connected_at: new Date().toISOString(),
            })
            .eq('id', connectionId);
        }
      }

      return jsonResponse({ success: true, message: 'Account selected' });
    }

    // ====================== REFRESH SESSION ======================
    if (action === 'refresh-session') {
      const { connectionId } = body;
      const { data: conn } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (!conn) return jsonResponse({ error: 'Connection not found' }, 404);

      let tokenData: any;
      try { tokenData = JSON.parse(conn.metaapi_account_id || '{}'); } catch { return jsonResponse({ error: 'Invalid token data' }, 400); }

      const refreshResult = await tlRefresh(tokenData.refreshToken, conn.environment || 'demo');
      if (!refreshResult) {
        await supabase
          .from('broker_connections')
          .update({ connection_status: 'expired', last_error: 'Token refresh failed' })
          .eq('id', connectionId);
        return jsonResponse({ error: 'Session expired. Please reconnect.' }, 401);
      }

      await supabase
        .from('broker_connections')
        .update({
          metaapi_account_id: JSON.stringify({ accessToken: refreshResult.accessToken, refreshToken: refreshResult.refreshToken }),
          token_expiry: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          connection_status: 'connected',
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      return jsonResponse({ success: true, message: 'Session refreshed' });
    }

    // ====================== SYNC (full) ======================
    if (action === 'sync') {
      const { connectionId } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid or expired session. Please reconnect.' }, 401);

      // Create sync log
      const { data: syncLog } = await supabase
        .from('broker_sync_logs')
        .insert({ broker_connection_id: connectionId, sync_type: 'full', status: 'running', started_at: new Date().toISOString() })
        .select()
        .single();

      const stats = { positionsUpserted: 0, ordersUpserted: 0, historyInserted: 0, journalCreated: 0, journalUpdated: 0 };

      try {
        const { accessToken, environment, accountId, accNum } = tokenInfo;

        // 0. Fetch config for column definitions
        const config = await tlGetConfig(accessToken, accNum, environment);
        const posColumns = config?.positionsConfig?.columns || [];
        const ordColumns = config?.ordersConfig?.columns || [];
        const ordHistColumns = config?.ordersHistoryConfig?.columns || [];

        // 0b. Fetch instruments to resolve tradableInstrumentId → symbol name
        const rawInstruments = await tlGetInstruments(accessToken, accountId, accNum, environment);
        const instrumentMap: Record<string, string> = {};
        for (const inst of rawInstruments) {
          if (inst.tradableInstrumentId && inst.name) {
            instrumentMap[String(inst.tradableInstrumentId)] = inst.name;
          }
        }
        const resolveSymbol = (tradableId: any) => {
          const id = String(tradableId);
          return instrumentMap[id] || id;
        };

        // 1. Sync account state (now properly parsed from columnar array)
        const state = await tlGetAccountState(accessToken, accountId, accNum, environment);
        if (state) {
          await supabase
            .from('broker_connections')
            .update({
              account_balance: state.balance,
              account_equity: state.projectedBalance,
              last_connected_at: new Date().toISOString(),
              connection_status: 'connected',
              last_error: null,
            })
            .eq('id', connectionId);
        }

        // 2. Upsert positions (columnar format now parsed via config)
        const positions = await tlGetPositions(accessToken, accountId, accNum, environment, posColumns);
        const now = new Date().toISOString();

        const currentPosIds = new Set(positions.map((p: any) => String(p.id)));

        const { data: existingPositions } = await supabase
          .from('broker_positions')
          .select('id, position_id')
          .eq('broker_connection_id', connectionId);

        if (existingPositions) {
          for (const ep of existingPositions) {
            if (!currentPosIds.has(ep.position_id)) {
              await supabase.from('broker_positions').delete().eq('id', ep.id);
            }
          }
        }

        for (const pos of positions) {
          const posData = {
            broker_connection_id: connectionId,
            position_id: String(pos.id),
            symbol: String(pos.tradableInstrumentId),
            type: pos.side === 'buy' ? 'POSITION_TYPE_BUY' : 'POSITION_TYPE_SELL',
            side: pos.side,
            volume: Number(pos.qty) || 0,
            open_price: Number(pos.avgPrice) || 0,
            stop_loss: null,
            take_profit: null,
            floating_pl: Number(pos.unrealizedPl) || 0,
            open_time: pos.openDate ? new Date(Number(pos.openDate)).toISOString() : now,
            last_seen_at: now,
            raw_payload: pos,
          };

          const { data: existingPos } = await supabase
            .from('broker_positions')
            .select('id')
            .eq('broker_connection_id', connectionId)
            .eq('position_id', String(pos.id))
            .maybeSingle();

          if (existingPos) {
            await supabase.from('broker_positions').update(posData).eq('id', existingPos.id);
          } else {
            await supabase.from('broker_positions').insert(posData);
          }
          stats.positionsUpserted++;
        }

        // 3. Upsert pending orders (columnar format)
        const orders = await tlGetOrders(accessToken, accountId, accNum, environment, ordColumns);
        const currentOrdIds = new Set(orders.map((o: any) => String(o.id)));

        const { data: existingOrders } = await supabase
          .from('broker_orders')
          .select('id, broker_order_id')
          .eq('broker_connection_id', connectionId);

        if (existingOrders) {
          for (const eo of existingOrders) {
            if (!currentOrdIds.has(eo.broker_order_id)) {
              await supabase.from('broker_orders').delete().eq('id', eo.id);
            }
          }
        }

        for (const ord of orders) {
          const ordData = {
            broker_connection_id: connectionId,
            broker_order_id: String(ord.id),
            symbol: String(ord.tradableInstrumentId),
            order_type: ord.type || 'limit',
            side: ord.side || 'buy',
            size: Number(ord.qty) || 0,
            entry_price: Number(ord.price) || Number(ord.stopPrice) || 0,
            stop_loss: ord.stopLoss ? Number(ord.stopLoss) : null,
            take_profit: ord.takeProfit ? Number(ord.takeProfit) : null,
            status: ord.status,
            created_broker_at: ord.createdDate ? new Date(Number(ord.createdDate)).toISOString() : null,
            raw_payload: ord,
            last_seen_at: now,
          };

          const { data: existingOrd } = await supabase
            .from('broker_orders')
            .select('id')
            .eq('broker_connection_id', connectionId)
            .eq('broker_order_id', String(ord.id))
            .maybeSingle();

          if (existingOrd) {
            await supabase.from('broker_orders').update(ordData).eq('id', existingOrd.id);
          } else {
            await supabase.from('broker_orders').insert(ordData);
          }
          stats.ordersUpserted++;
        }

        // 4. Sync trade history from ordersHistory (columnar format)
        // Group filled orders by positionId to reconstruct trades
        const ordersHistory = await tlGetOrdersHistory(accessToken, accountId, accNum, environment, ordHistColumns);
        
        // Build trade pairs: group by positionId, find open (isOpen=true) and close (isOpen=false) orders
        const positionGroups: Record<string, any[]> = {};
        for (const oh of ordersHistory) {
          if (oh.status !== 'Filled') continue;
          const posId = oh.positionId ? String(oh.positionId) : null;
          if (!posId) continue;
          if (!positionGroups[posId]) positionGroups[posId] = [];
          positionGroups[posId].push(oh);
        }

        const { data: conn } = await supabase
          .from('broker_connections')
          .select('environment, active_account_id, active_acc_num')
          .eq('id', connectionId)
          .single();

        for (const [posId, filledOrders] of Object.entries(positionGroups)) {
          // Find open order (isOpen === "true") and close order (isOpen === "false")
          const openOrder = filledOrders.find((o: any) => o.isOpen === 'true' || o.isOpen === true);
          const closeOrder = filledOrders.find((o: any) => o.isOpen === 'false' || o.isOpen === false);
          
          if (!openOrder) continue; // Need at least an open order

          const sym = String(openOrder.tradableInstrumentId);
          const side = openOrder.side || 'buy';
          const entryPrice = Number(openOrder.avgPrice) || 0;
          const exitPrice = closeOrder ? Number(closeOrder.avgPrice) || 0 : 0;
          const qty = Number(openOrder.filledQty || openOrder.qty) || 0;
          const isClosed = !!closeOrder;

          // Calculate realized P/L for closed trades
          let realizedPl = 0;
          if (isClosed && entryPrice && exitPrice) {
            if (side === 'buy') {
              realizedPl = (exitPrice - entryPrice) * qty;
            } else {
              realizedPl = (entryPrice - exitPrice) * qty;
            }
          }

          const openedAt = openOrder.createdDate ? new Date(Number(openOrder.createdDate)).toISOString() : now;
          const closedAt = closeOrder?.lastModified ? new Date(Number(closeOrder.lastModified)).toISOString() : (isClosed ? now : null);

          // Upsert into broker_trade_history
          const { data: existingHist } = await supabase
            .from('broker_trade_history')
            .select('id')
            .eq('broker_connection_id', connectionId)
            .eq('broker_position_id', posId)
            .maybeSingle();

          const histData = {
            broker_connection_id: connectionId,
            broker_position_id: posId,
            broker_order_id: String(openOrder.id),
            symbol: sym,
            side,
            size: qty,
            entry_price: entryPrice,
            exit_price: exitPrice || null,
            realized_pl: realizedPl,
            fees: 0,
            opened_at: openedAt,
            closed_at: closedAt,
            raw_payload: { openOrder, closeOrder },
            synced_at: now,
          };

          if (existingHist) {
            await supabase.from('broker_trade_history').update(histData).eq('id', existingHist.id);
          } else {
            await supabase.from('broker_trade_history').insert(histData);
            stats.historyInserted++;
          }

          // Auto-journal: create/update journal entry
          const tradeDate = new Date(closedAt || openedAt);
          const dateStr = tradeDate.toISOString().split('T')[0];

          const { data: existingJournal } = await supabase
            .from('trades')
            .select('id, notes, notebook, session, strategy')
            .eq('user_id', user.id)
            .eq('broker_position_id', posId)
            .maybeSingle();

          if (existingJournal) {
            await supabase.from('trades').update({
              pair: sym,
              direction: mapDirection(side),
              result: realizedPl,
              date: dateStr,
              last_broker_sync_at: now,
              execution_type: 'market',
            }).eq('id', existingJournal.id);
            stats.journalUpdated++;
          } else {
            await supabase.from('trades').insert({
              user_id: user.id,
              pair: sym,
              direction: mapDirection(side),
              result: realizedPl,
              date: dateStr,
              session: getSession(tradeDate),
              broker_name: 'TradeLocker',
              broker_environment: conn?.environment || 'demo',
              broker_account_id: conn?.active_account_id,
              broker_acc_num: conn?.active_acc_num,
              broker_position_id: posId,
              broker_order_id: trade.orderId ? String(trade.orderId) : null,
              imported_from_broker: true,
              last_broker_sync_at: now,
              execution_type: 'market',
            });
            stats.journalCreated++;
          }
        }

        // Also process orders history for trades not in positions history
        for (const trade of ordersHistory) {
          if (trade.status !== 'filled' && trade.status !== 'closed') continue;

          const ordId = String(trade.id);
          
          // Skip if we already have this from positions history
          const { data: alreadyExists } = await supabase
            .from('broker_trade_history')
            .select('id')
            .eq('broker_connection_id', connectionId)
            .eq('broker_order_id', ordId)
            .maybeSingle();
          
          if (alreadyExists) continue;

          // Also check if a position history entry covers this
          if (trade.positionId) {
            const { data: posHist } = await supabase
              .from('broker_trade_history')
              .select('id')
              .eq('broker_connection_id', connectionId)
              .eq('broker_position_id', String(trade.positionId))
              .maybeSingle();
            if (posHist) continue;
          }

          const sym = trade.instrument || String(trade.tradableInstrumentId);
          const side = trade.side || 'buy';
          const realizedPl = trade.realizedPl || 0;

          await supabase.from('broker_trade_history').insert({
            broker_connection_id: connectionId,
            broker_order_id: ordId,
            broker_position_id: trade.positionId ? String(trade.positionId) : null,
            symbol: sym,
            side,
            size: trade.filledQty || trade.qty,
            entry_price: trade.avgFilledPrice || 0,
            exit_price: trade.closePrice || trade.avgFilledPrice || 0,
            realized_pl: realizedPl,
            fees: (trade.commission || 0) + (trade.swap || 0),
            opened_at: trade.createdAt || now,
            closed_at: trade.filledAt || trade.closedAt || now,
            raw_payload: trade,
            synced_at: now,
          });
          stats.historyInserted++;

          // Journal entry for order-based trades
          if (realizedPl !== 0) {
            const tradeDate = new Date(trade.filledAt || trade.closedAt || trade.createdAt || Date.now());
            const dateStr = tradeDate.toISOString().split('T')[0];

            const { data: existingJournal } = await supabase
              .from('trades')
              .select('id')
              .eq('user_id', user.id)
              .eq('broker_order_id', ordId)
              .maybeSingle();

            if (!existingJournal) {
              const { data: conn } = await supabase
                .from('broker_connections')
                .select('environment, active_account_id, active_acc_num')
                .eq('id', connectionId)
                .single();

              await supabase.from('trades').insert({
                user_id: user.id,
                pair: sym,
                direction: mapDirection(side),
                result: realizedPl,
                date: dateStr,
                session: getSession(tradeDate),
                broker_name: 'TradeLocker',
                broker_environment: conn?.environment || 'demo',
                broker_account_id: conn?.active_account_id,
                broker_acc_num: conn?.active_acc_num,
                broker_order_id: ordId,
                broker_position_id: trade.positionId ? String(trade.positionId) : null,
                imported_from_broker: true,
                last_broker_sync_at: now,
                execution_type: 'market',
              });
              stats.journalCreated++;
            }
          }
        }

        // Update sync log
        const totalRecords = stats.positionsUpserted + stats.ordersUpserted + stats.historyInserted + stats.journalCreated + stats.journalUpdated;
        if (syncLog) {
          await supabase
            .from('broker_sync_logs')
            .update({
              status: 'completed',
              ended_at: now,
              records_processed: totalRecords,
              error_message: JSON.stringify(stats),
            })
            .eq('id', syncLog.id);
        }

        await supabase
          .from('broker_connections')
          .update({ last_connected_at: now })
          .eq('id', connectionId);

        return jsonResponse({ success: true, stats, message: `Synced: ${stats.positionsUpserted} positions, ${stats.ordersUpserted} orders, ${stats.historyInserted} history, ${stats.journalCreated} new journal, ${stats.journalUpdated} updated journal` });
      } catch (e: any) {
        console.error('Sync error:', e);
        if (syncLog) {
          await supabase
            .from('broker_sync_logs')
            .update({ status: 'failed', ended_at: new Date().toISOString(), error_message: e.message })
            .eq('id', syncLog.id);
        }
        return jsonResponse({ error: 'Sync failed: ' + e.message }, 500);
      }
    }

    // ====================== DIAGNOSTIC ======================
    if (action === 'diagnostic') {
      const { connectionId } = body;
      const results: { step: string; status: 'pass' | 'fail'; detail: string }[] = [];

      // 1. Check secrets
      const hasUrl = !!Deno.env.get('SUPABASE_URL');
      const hasKey = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      results.push({ step: 'Backend secrets configured', status: hasUrl && hasKey ? 'pass' : 'fail', detail: hasUrl && hasKey ? 'SUPABASE_URL and SERVICE_ROLE_KEY present' : 'Missing backend secrets' });

      if (!connectionId) {
        results.push({ step: 'Connection exists', status: 'fail', detail: 'No connectionId provided' });
        return jsonResponse({ results });
      }

      // 2. Check connection record
      const { data: conn } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (!conn) {
        results.push({ step: 'Connection exists', status: 'fail', detail: 'Connection not found in database' });
        return jsonResponse({ results });
      }
      results.push({ step: 'Connection exists', status: 'pass', detail: `Platform: ${conn.platform}, Status: ${conn.connection_status}` });

      // 3. Check accountId and accNum
      const hasAccount = !!conn.active_account_id && !!conn.active_acc_num;
      results.push({ step: 'Account selected (accountId + accNum)', status: hasAccount ? 'pass' : 'fail', detail: hasAccount ? `accountId: ${conn.active_account_id}, accNum: ${conn.active_acc_num}` : 'No active account selected' });

      // 4. Check tokens
      let tokenData: any;
      try {
        tokenData = JSON.parse(conn.metaapi_account_id || '{}');
        const hasTokens = !!tokenData.accessToken && !!tokenData.refreshToken;
        results.push({ step: 'Tokens stored', status: hasTokens ? 'pass' : 'fail', detail: hasTokens ? 'Access and refresh tokens present' : 'Missing tokens' });
      } catch {
        results.push({ step: 'Tokens stored', status: 'fail', detail: 'Token data corrupted' });
        return jsonResponse({ results });
      }

      // 5. Test token refresh
      const refreshResult = await tlRefresh(tokenData.refreshToken, conn.environment || 'demo');
      if (refreshResult) {
        results.push({ step: 'Token refresh', status: 'pass', detail: 'Token refreshed successfully' });
        // Save new tokens
        await supabase.from('broker_connections').update({
          metaapi_account_id: JSON.stringify({ accessToken: refreshResult.accessToken, refreshToken: refreshResult.refreshToken }),
          token_expiry: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          connection_status: 'connected',
          last_error: null,
        }).eq('id', connectionId);
        tokenData = refreshResult;
      } else {
        results.push({ step: 'Token refresh', status: 'fail', detail: 'Refresh failed - session expired, reconnect required' });
        return jsonResponse({ results });
      }

      const accessToken = tokenData.accessToken;
      const environment = conn.environment || 'demo';

      // 6. Test fetch accounts
      const accounts = await tlGetAccounts(accessToken, environment);
      results.push({ step: 'Fetch accounts', status: accounts.length > 0 ? 'pass' : 'fail', detail: `Found ${accounts.length} accounts` });

      if (!hasAccount) {
        return jsonResponse({ results });
      }

      const accountId = conn.active_account_id;
      const accNum = conn.active_acc_num;

      // 7. Test account state
      const state = await tlGetAccountState(accessToken, accountId, accNum, environment);
      results.push({ step: 'Fetch account state', status: state ? 'pass' : 'fail', detail: state ? `Balance: ${state.balance}, Equity: ${state.equity}` : 'Failed to get state' });

      // 8. Test positions
      const positions = await tlGetPositions(accessToken, accountId, accNum, environment);
      results.push({ step: 'Fetch positions', status: 'pass', detail: `${positions.length} open positions` });

      // 9. Test orders
      const orders = await tlGetOrders(accessToken, accountId, accNum, environment);
      results.push({ step: 'Fetch orders', status: 'pass', detail: `${orders.length} pending orders` });

      // 10. Test history
      const posHistory = await tlGetPositionsHistory(accessToken, accountId, accNum, environment);
      const ordHistory = await tlGetOrdersHistory(accessToken, accountId, accNum, environment);
      results.push({ step: 'Fetch trade history', status: 'pass', detail: `${posHistory.length} closed positions, ${ordHistory.length} order history` });

      // 11. Test instruments
      const instruments = await tlGetInstruments(accessToken, accountId, accNum, environment);
      results.push({ step: 'Fetch instruments', status: instruments.length > 0 ? 'pass' : 'fail', detail: `${instruments.length} instruments available` });

      // 12. Check journal writes
      const { count: journalCount } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('imported_from_broker', true);
      results.push({ step: 'Journal entries from broker', status: 'pass', detail: `${journalCount || 0} imported journal entries` });

      return jsonResponse({ results });
    }

    // ====================== SYNC LOGS ======================
    if (action === 'sync-logs') {
      const { connectionId } = body;
      const { data } = await supabase
        .from('broker_sync_logs')
        .select('*')
        .eq('broker_connection_id', connectionId)
        .order('created_at', { ascending: false })
        .limit(20);
      return jsonResponse({ logs: data || [] });
    }

    // ====================== ACCOUNT SUMMARY ======================
    if (action === 'account-summary') {
      const { connectionId } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid session' }, 401);

      const state = await tlGetAccountState(tokenInfo.accessToken, tokenInfo.accountId, tokenInfo.accNum, tokenInfo.environment);
      if (!state) return jsonResponse({ error: 'Failed to get account state' }, 500);

      const { count: posCount } = await supabase.from('broker_positions').select('*', { count: 'exact', head: true }).eq('broker_connection_id', connectionId);
      const { count: ordCount } = await supabase.from('broker_orders').select('*', { count: 'exact', head: true }).eq('broker_connection_id', connectionId);

      return jsonResponse({
        balance: state.balance,
        equity: state.equity,
        marginUsed: state.usedMargin || 0,
        freeMargin: state.freeMargin || (state.equity - (state.usedMargin || 0)),
        floatingPl: state.unrealizedPl || 0,
        openPositions: posCount || 0,
        pendingOrders: ordCount || 0,
      });
    }

    // ====================== GET POSITIONS ======================
    if (action === 'positions') {
      const { connectionId } = body;
      const { data } = await supabase.from('broker_positions').select('*').eq('broker_connection_id', connectionId);
      return jsonResponse({ positions: data || [] });
    }

    // ====================== GET ORDERS ======================
    if (action === 'orders') {
      const { connectionId } = body;
      const { data } = await supabase.from('broker_orders').select('*').eq('broker_connection_id', connectionId);
      return jsonResponse({ orders: data || [] });
    }

    // ====================== GET HISTORY ======================
    if (action === 'history') {
      const { connectionId } = body;
      const { data } = await supabase
        .from('broker_trade_history')
        .select('*')
        .eq('broker_connection_id', connectionId)
        .order('closed_at', { ascending: false })
        .limit(100);
      return jsonResponse({ history: data || [] });
    }

    // ====================== PLACE ORDER ======================
    if (action === 'place-order') {
      const { connectionId, symbol, side, type, qty, price, stopLoss, takeProfit, tradableInstrumentId } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid session' }, 401);

      const orderPayload: any = { tradableInstrumentId, side, type: type || 'market', qty };
      if (price && type !== 'market') orderPayload.price = price;
      if (stopLoss) orderPayload.stopLoss = stopLoss;
      if (takeProfit) orderPayload.takeProfit = takeProfit;

      const result = await tlPlaceOrder(tokenInfo.accessToken, tokenInfo.accountId, tokenInfo.accNum, tokenInfo.environment, orderPayload);
      if (!result.ok) return jsonResponse({ error: 'Failed to place order', details: result.data }, 400);
      return jsonResponse({ success: true, order: result.data, message: 'Order placed successfully' });
    }

    // ====================== MODIFY ORDER ======================
    if (action === 'modify-order') {
      const { connectionId, orderId, stopLoss, takeProfit, price } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid session' }, 401);

      const payload: any = {};
      if (stopLoss !== undefined) payload.stopLoss = stopLoss;
      if (takeProfit !== undefined) payload.takeProfit = takeProfit;
      if (price !== undefined) payload.price = price;

      const result = await tlModifyOrder(tokenInfo.accessToken, tokenInfo.accountId, tokenInfo.accNum, tokenInfo.environment, orderId, payload);
      if (!result.ok) return jsonResponse({ error: 'Failed to modify order' }, 400);
      return jsonResponse({ success: true, message: 'Order modified' });
    }

    // ====================== CANCEL ORDER ======================
    if (action === 'cancel-order') {
      const { connectionId, orderId } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid session' }, 401);

      const result = await tlCancelOrder(tokenInfo.accessToken, tokenInfo.accountId, tokenInfo.accNum, tokenInfo.environment, orderId);
      if (!result.ok) return jsonResponse({ error: 'Failed to cancel order' }, 400);
      return jsonResponse({ success: true, message: 'Order cancelled' });
    }

    // ====================== CLOSE POSITION ======================
    if (action === 'close-position') {
      const { connectionId, positionId, qty } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid session' }, 401);

      const result = await tlClosePosition(tokenInfo.accessToken, tokenInfo.accountId, tokenInfo.accNum, tokenInfo.environment, positionId, qty);
      if (!result.ok) return jsonResponse({ error: 'Failed to close position' }, 400);
      return jsonResponse({ success: true, message: 'Position closed' });
    }

    // ====================== MODIFY POSITION ======================
    if (action === 'modify-position') {
      const { connectionId, positionId, stopLoss, takeProfit } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid session' }, 401);

      const payload: any = {};
      if (stopLoss !== undefined) payload.stopLoss = stopLoss;
      if (takeProfit !== undefined) payload.takeProfit = takeProfit;

      const result = await tlModifyPosition(tokenInfo.accessToken, tokenInfo.accountId, tokenInfo.accNum, tokenInfo.environment, positionId, payload);
      if (!result.ok) return jsonResponse({ error: 'Failed to modify position' }, 400);
      return jsonResponse({ success: true, message: 'Position modified' });
    }

    // ====================== GET INSTRUMENTS ======================
    if (action === 'instruments') {
      const { connectionId } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid session' }, 401);

      const instruments = await tlGetInstruments(tokenInfo.accessToken, tokenInfo.accountId, tokenInfo.accNum, tokenInfo.environment);
      return jsonResponse({ instruments });
    }

    // ====================== DISCONNECT ======================
    if (action === 'disconnect') {
      const { connectionId } = body;

      await supabase.from('broker_positions').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_orders').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_trade_history').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_sync_logs').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_accounts').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_connections').delete().eq('id', connectionId).eq('user_id', user.id);

      return jsonResponse({ success: true, message: 'Broker disconnected' });
    }

    // ====================== UPDATE SYNC SETTINGS ======================
    if (action === 'update-sync-settings') {
      const { connectionId, autoSyncEnabled, syncIntervalSeconds } = body;
      await supabase
        .from('broker_connections')
        .update({
          auto_sync_enabled: autoSyncEnabled,
          sync_interval_seconds: syncIntervalSeconds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId)
        .eq('user_id', user.id);

      return jsonResponse({ success: true, message: 'Sync settings updated' });
    }

    // ====================== RECONNECT ======================
    if (action === 'reconnect') {
      const { connectionId, email, password } = body;
      const { data: conn } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (!conn) return jsonResponse({ error: 'Connection not found' }, 404);

      const authResult = await tlAuth(email, password, conn.server, conn.environment || 'demo');
      if (!authResult) {
        return jsonResponse({ error: 'Failed to re-authenticate. Check credentials.' }, 400);
      }

      await supabase
        .from('broker_connections')
        .update({
          metaapi_account_id: JSON.stringify({ accessToken: authResult.accessToken, refreshToken: authResult.refreshToken }),
          connection_status: 'connected',
          token_expiry: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          last_connected_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', connectionId);

      return jsonResponse({ success: true, message: 'Reconnected successfully' });
    }

    // ====================== DEBUG RAW ======================
    if (action === 'debug-raw') {
      const { connectionId } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid session' }, 401);

      const { accessToken, environment, accountId, accNum } = tokenInfo;
      const baseUrl = getBaseUrl(environment);

      // Fetch raw responses
      const rawResults: Record<string, any> = {};

      // Account state
      try {
        const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/state`, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
        });
        rawResults.accountState = { status: res.status, body: res.ok ? await res.json() : await res.text() };
      } catch (e: any) { rawResults.accountState = { error: e.message }; }

      // Positions
      try {
        const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/positions`, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
        });
        rawResults.positions = { status: res.status, body: res.ok ? await res.json() : await res.text() };
      } catch (e: any) { rawResults.positions = { error: e.message }; }

      // Orders
      try {
        const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/orders`, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
        });
        rawResults.orders = { status: res.status, body: res.ok ? await res.json() : await res.text() };
      } catch (e: any) { rawResults.orders = { error: e.message }; }

      // Orders history
      try {
        const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/ordersHistory`, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
        });
        rawResults.ordersHistory = { status: res.status, body: res.ok ? await res.json() : await res.text() };
      } catch (e: any) { rawResults.ordersHistory = { error: e.message }; }

      // Positions history
      try {
        const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/positionsHistory`, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
        });
        rawResults.positionsHistory = { status: res.status, body: res.ok ? await res.json() : await res.text() };
      } catch (e: any) { rawResults.positionsHistory = { error: e.message }; }

      // Config
      try {
        const res = await fetch(`${baseUrl}/trade/config`, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
        });
        rawResults.config = { status: res.status, body: res.ok ? await res.json() : await res.text() };
      } catch (e: any) { rawResults.config = { error: e.message }; }

      return jsonResponse({ rawResults });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error('TradeLocker function error:', e);
    return jsonResponse({ error: e.message || 'Internal server error' }, 500);
  }
});
