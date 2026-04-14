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

// ====================== TRADELOCKER API HELPERS ======================

async function tlAuth(email: string, password: string, server: string, environment: string) {
  const baseUrl = getBaseUrl(environment);
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
}

async function tlRefresh(refreshToken: string, environment: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/auth/jwt/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  return await res.json();
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
  if (!res.ok) return null;
  const data = await res.json();
  return data.d || null;
}

async function tlGetPositions(accessToken: string, accountId: string, accNum: number, environment: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/positions`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.d?.positions || [];
}

async function tlGetOrders(accessToken: string, accountId: string, accNum: number, environment: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/orders`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.d?.orders || [];
}

async function tlGetOrdersHistory(accessToken: string, accountId: string, accNum: number, environment: string) {
  const baseUrl = getBaseUrl(environment);
  const res = await fetch(`${baseUrl}/trade/accounts/${accountId}/ordersHistory`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'accNum': String(accNum) },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.d?.ordersHistory || [];
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
  // Tokens are stored as secrets in broker_connections.metaapi_account_id as JSON
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

  // Check if token might be expired (stored expiry or try refresh)
  if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
    // Try refresh
    const refreshResult = await tlRefresh(tokenData.refreshToken, environment);
    if (!refreshResult) return null;

    const newTokenData = {
      accessToken: refreshResult.accessToken,
      refreshToken: refreshResult.refreshToken,
    };

    await supabase
      .from('broker_connections')
      .update({
        metaapi_account_id: JSON.stringify(newTokenData),
        token_expiry: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // ~20 min
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
      if (!authResult) {
        return jsonResponse({ error: 'Failed to authenticate with TradeLocker. Please check your credentials.' }, 400);
      }

      // Get accounts
      const accounts = await tlGetAccounts(authResult.accessToken, environment);
      if (!accounts.length) {
        return jsonResponse({ error: 'No TradeLocker accounts found.' }, 400);
      }

      // Store tokens securely
      const tokenData = JSON.stringify({
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
      });

      // Create connection
      const { data: connection, error: insertError } = await supabase
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

      if (insertError) {
        console.error('Insert error:', insertError);
        return jsonResponse({ error: 'Failed to save connection' }, 500);
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

      // Mark all accounts inactive, then activate selected
      await supabase
        .from('broker_accounts')
        .update({ is_active: false })
        .eq('broker_connection_id', connectionId);

      await supabase
        .from('broker_accounts')
        .update({ is_active: true })
        .eq('broker_connection_id', connectionId)
        .eq('account_id_external', accountId);

      // Update connection with active account
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

      // Fetch account state
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
        .insert({ broker_connection_id: connectionId, sync_type: 'full', status: 'running' })
        .select()
        .single();

      let recordsProcessed = 0;

      try {
        const { accessToken, environment, accountId, accNum } = tokenInfo;

        // 1. Sync account state
        const state = await tlGetAccountState(accessToken, accountId, accNum, environment);
        if (state) {
          await supabase
            .from('broker_connections')
            .update({
              account_balance: state.balance,
              account_equity: state.equity,
              last_connected_at: new Date().toISOString(),
              connection_status: 'connected',
              last_error: null,
            })
            .eq('id', connectionId);
        }

        // 2. Sync positions
        const positions = await tlGetPositions(accessToken, accountId, accNum, environment);
        // Clear old positions for this connection
        await supabase.from('broker_positions').delete().eq('broker_connection_id', connectionId);
        for (const pos of positions) {
          await supabase.from('broker_positions').insert({
            broker_connection_id: connectionId,
            position_id: String(pos.id),
            symbol: pos.instrument || String(pos.tradableInstrumentId),
            type: pos.side === 'buy' ? 'POSITION_TYPE_BUY' : 'POSITION_TYPE_SELL',
            side: pos.side,
            volume: pos.qty,
            open_price: pos.avgPrice,
            floating_pl: pos.unrealizedPl || 0,
            open_time: pos.openTime || new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            raw_payload: pos,
          });
          recordsProcessed++;
        }

        // 3. Sync pending orders
        const orders = await tlGetOrders(accessToken, accountId, accNum, environment);
        await supabase.from('broker_orders').delete().eq('broker_connection_id', connectionId);
        for (const ord of orders) {
          if (ord.status === 'working' || ord.status === 'pending' || ord.status === 'new') {
            await supabase.from('broker_orders').insert({
              broker_connection_id: connectionId,
              broker_order_id: String(ord.id),
              symbol: ord.instrument || String(ord.tradableInstrumentId),
              order_type: ord.type || 'limit',
              side: ord.side || 'buy',
              size: ord.qty,
              entry_price: ord.price || ord.stopPrice || 0,
              stop_loss: ord.stopLoss,
              take_profit: ord.takeProfit,
              status: ord.status,
              created_broker_at: ord.createdAt,
              raw_payload: ord,
              last_seen_at: new Date().toISOString(),
            });
            recordsProcessed++;
          }
        }

        // 4. Sync trade history
        const history = await tlGetOrdersHistory(accessToken, accountId, accNum, environment);
        for (const trade of history) {
          if (trade.status !== 'filled' && trade.status !== 'closed') continue;

          // Check if already exists
          const { data: existing } = await supabase
            .from('broker_trade_history')
            .select('id')
            .eq('broker_connection_id', connectionId)
            .eq('broker_order_id', String(trade.id))
            .maybeSingle();

          if (!existing) {
            await supabase.from('broker_trade_history').insert({
              broker_connection_id: connectionId,
              broker_order_id: String(trade.id),
              broker_position_id: trade.positionId ? String(trade.positionId) : null,
              symbol: trade.instrument || String(trade.tradableInstrumentId),
              side: trade.side || 'buy',
              size: trade.filledQty || trade.qty,
              entry_price: trade.avgFilledPrice || 0,
              exit_price: trade.closePrice || trade.avgFilledPrice || 0,
              realized_pl: trade.realizedPl || 0,
              fees: (trade.commission || 0) + (trade.swap || 0),
              opened_at: trade.createdAt || new Date().toISOString(),
              closed_at: trade.filledAt || trade.closedAt || new Date().toISOString(),
              raw_payload: trade,
              synced_at: new Date().toISOString(),
            });
            recordsProcessed++;

            // 5. Auto-journal this trade
            const tradeDate = new Date(trade.filledAt || trade.closedAt || trade.createdAt || Date.now());
            const dateStr = tradeDate.toISOString().split('T')[0];
            const sym = trade.instrument || String(trade.tradableInstrumentId);
            const side = trade.side || 'buy';
            const realizedPl = trade.realizedPl || 0;

            // Check for existing journal entry
            const { data: existingJournal } = await supabase
              .from('trades')
              .select('id')
              .eq('user_id', user.id)
              .eq('broker_order_id', String(trade.id))
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
                direction: side,
                result: realizedPl,
                date: dateStr,
                session: getSession(tradeDate),
                broker_name: 'TradeLocker',
                broker_environment: conn?.environment || 'demo',
                broker_account_id: conn?.active_account_id,
                broker_acc_num: conn?.active_acc_num,
                broker_order_id: String(trade.id),
                broker_position_id: trade.positionId ? String(trade.positionId) : null,
                imported_from_broker: true,
                last_broker_sync_at: new Date().toISOString(),
                execution_type: 'market',
              });
            }
          }
        }

        // Update sync log
        if (syncLog) {
          await supabase
            .from('broker_sync_logs')
            .update({ status: 'completed', ended_at: new Date().toISOString(), records_processed: recordsProcessed })
            .eq('id', syncLog.id);
        }

        // Update last sync
        await supabase
          .from('broker_connections')
          .update({ last_connected_at: new Date().toISOString() })
          .eq('id', connectionId);

        return jsonResponse({ success: true, recordsProcessed, message: `Synced ${recordsProcessed} records` });
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

    // ====================== ACCOUNT SUMMARY ======================
    if (action === 'account-summary') {
      const { connectionId } = body;
      const tokenInfo = await getValidToken(supabase, connectionId);
      if (!tokenInfo) return jsonResponse({ error: 'Invalid session' }, 401);

      const state = await tlGetAccountState(tokenInfo.accessToken, tokenInfo.accountId, tokenInfo.accNum, tokenInfo.environment);
      if (!state) return jsonResponse({ error: 'Failed to get account state' }, 500);

      // Count positions and orders
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
      const { data } = await supabase
        .from('broker_positions')
        .select('*')
        .eq('broker_connection_id', connectionId);
      return jsonResponse({ positions: data || [] });
    }

    // ====================== GET ORDERS ======================
    if (action === 'orders') {
      const { connectionId } = body;
      const { data } = await supabase
        .from('broker_orders')
        .select('*')
        .eq('broker_connection_id', connectionId);
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

      const orderPayload: any = {
        tradableInstrumentId,
        side,
        type: type || 'market',
        qty,
      };
      if (price && type !== 'market') orderPayload.price = price;
      if (stopLoss) orderPayload.stopLoss = stopLoss;
      if (takeProfit) orderPayload.takeProfit = takeProfit;

      const result = await tlPlaceOrder(tokenInfo.accessToken, tokenInfo.accountId, tokenInfo.accNum, tokenInfo.environment, orderPayload);
      if (!result.ok) {
        return jsonResponse({ error: 'Failed to place order', details: result.data }, 400);
      }

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

      // Delete related data
      await supabase.from('broker_positions').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_orders').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_trade_history').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_accounts').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_sync_logs').delete().eq('broker_connection_id', connectionId);
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

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error('TradeLocker function error:', e);
    return jsonResponse({ error: e.message || 'Internal server error' }, 500);
  }
});
