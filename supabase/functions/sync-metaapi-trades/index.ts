import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ====================== INTERFACES ======================

interface MetaApiPosition {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  profit: number;
  swap: number;
  commission: number;
  time: string;
  magic?: number;
  comment?: string;
}

interface MetaApiDeal {
  id: string;
  positionId?: string;
  symbol: string;
  type: string;
  volume: number;
  price: number;
  profit: number;
  swap: number;
  commission: number;
  time: string;
  magic?: number;
  comment?: string;
}

interface TradeLockerPosition {
  id: number;
  tradableInstrumentId: number;
  side: string;
  qty: number;
  avgPrice: number;
  openTime: string;
  unrealizedPl: number;
  instrument?: string;
}

interface TradeLockerOrder {
  id: number;
  tradableInstrumentId: number;
  side: string;
  qty: number;
  filledQty: number;
  avgFilledPrice: number;
  status: string;
  createdAt: string;
  filledAt?: string;
  realizedPl?: number;
  instrument?: string;
}

// ====================== HELPERS ======================

function getSession(date: Date): string {
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 8) return 'Asia';
  if (hour >= 8 && hour < 13) return 'London';
  return 'New York';
}

// ====================== TRADELOCKER API ======================

async function tradeLockerAuth(email: string, password: string, server: string): Promise<{ accessToken: string; refreshToken: string; accounts: any[] } | null> {
  const baseUrl = server.includes('demo') ? 'https://demo.tradelocker.com' : 'https://live.tradelocker.com';
  
  try {
    // Get JWT token
    const authResponse = await fetch(`${baseUrl}/backend-api/auth/jwt/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, server }),
    });

    if (!authResponse.ok) {
      console.error('TradeLocker auth failed:', await authResponse.text());
      return null;
    }

    const authData = await authResponse.json();
    
    // Get all accounts
    const accountsResponse = await fetch(`${baseUrl}/backend-api/auth/jwt/all-accounts`, {
      headers: { 
        'Authorization': `Bearer ${authData.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!accountsResponse.ok) {
      console.error('TradeLocker accounts failed:', await accountsResponse.text());
      return null;
    }

    const accountsData = await accountsResponse.json();
    
    return {
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      accounts: accountsData.accounts || [],
    };
  } catch (e) {
    console.error('TradeLocker auth error:', e);
    return null;
  }
}

async function tradeLockerGetPositions(accessToken: string, accountId: string, accNum: number, server: string): Promise<TradeLockerPosition[]> {
  const baseUrl = server.includes('demo') ? 'https://demo.tradelocker.com' : 'https://live.tradelocker.com';
  
  try {
    const response = await fetch(`${baseUrl}/backend-api/trade/accounts/${accountId}/positions`, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'accNum': String(accNum),
      },
    });

    if (!response.ok) {
      console.error('TradeLocker positions failed:', await response.text());
      return [];
    }

    const data = await response.json();
    return data.d?.positions || [];
  } catch (e) {
    console.error('TradeLocker positions error:', e);
    return [];
  }
}

async function tradeLockerGetOrders(accessToken: string, accountId: string, accNum: number, server: string): Promise<TradeLockerOrder[]> {
  const baseUrl = server.includes('demo') ? 'https://demo.tradelocker.com' : 'https://live.tradelocker.com';
  
  try {
    const response = await fetch(`${baseUrl}/backend-api/trade/accounts/${accountId}/ordersHistory`, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'accNum': String(accNum),
      },
    });

    if (!response.ok) {
      console.error('TradeLocker orders failed:', await response.text());
      return [];
    }

    const data = await response.json();
    return data.d?.ordersHistory || [];
  } catch (e) {
    console.error('TradeLocker orders error:', e);
    return [];
  }
}

async function tradeLockerGetAccountInfo(accessToken: string, accountId: string, accNum: number, server: string): Promise<{ balance: number; equity: number } | null> {
  const baseUrl = server.includes('demo') ? 'https://demo.tradelocker.com' : 'https://live.tradelocker.com';
  
  try {
    const response = await fetch(`${baseUrl}/backend-api/trade/accounts/${accountId}/state`, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'accNum': String(accNum),
      },
    });

    if (!response.ok) {
      console.error('TradeLocker account info failed:', await response.text());
      return null;
    }

    const data = await response.json();
    return {
      balance: data.d?.balance || 0,
      equity: data.d?.equity || 0,
    };
  } catch (e) {
    console.error('TradeLocker account info error:', e);
    return null;
  }
}

// ====================== MAIN HANDLER ======================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaApiToken = Deno.env.get('METAAPI_TOKEN');

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, connectionId, platform, brokerName, server, login, password, tradingAccountId, metaapiAccountId } = await req.json();
    console.log(`Action: ${action}, Platform: ${platform}, User: ${user.id}`);

    // ====================== CONNECT ======================
    if (action === 'connect') {
      // TradeLocker direct connection
      if (platform === 'tradelocker') {
        console.log(`Connecting to TradeLocker - ${server}`);
        
        const authResult = await tradeLockerAuth(login, password, server);
        
        if (!authResult) {
          return new Response(JSON.stringify({ error: 'Failed to authenticate with TradeLocker. Please check your credentials.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get first account info
        const firstAccount = authResult.accounts[0];
        if (!firstAccount) {
          return new Response(JSON.stringify({ error: 'No TradeLocker accounts found.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const accountInfo = await tradeLockerGetAccountInfo(
          authResult.accessToken, 
          String(firstAccount.id), 
          firstAccount.accNum,
          server
        );

        // Save connection
        const { data: connection, error: insertError } = await supabase
          .from('broker_connections')
          .insert({
            user_id: user.id,
            platform: platform,
            broker_name: brokerName || 'TradeLocker',
            server: server,
            login: login,
            metaapi_account_id: `tl_${firstAccount.id}_${firstAccount.accNum}`, // Store TL account info
            connection_status: 'connected',
            account_balance: accountInfo?.balance,
            account_equity: accountInfo?.equity,
            last_connected_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error saving connection:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to save connection' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          connection,
          message: 'TradeLocker connected successfully!',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // MT4/MT5 via MetaAPI Account ID
      if (platform === 'mt4' || platform === 'mt5') {
        if (!metaApiToken) {
          return new Response(JSON.stringify({ error: 'MetaAPI token not configured. Please add METAAPI_TOKEN secret.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // If user provides MetaAPI Account ID directly
        if (metaapiAccountId) {
          console.log(`Using existing MetaAPI account: ${metaapiAccountId}`);
          
          // Verify the account exists
          const verifyResponse = await fetch(
            `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${metaapiAccountId}`,
            {
              headers: { 'auth-token': metaApiToken },
            }
          );

          if (!verifyResponse.ok) {
            return new Response(JSON.stringify({ error: 'Invalid MetaAPI Account ID. Please check and try again.' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const accountData = await verifyResponse.json();
          
          // Get account metrics
          let balance = null;
          let equity = null;
          
          if (accountData.state === 'DEPLOYED' && accountData.connectionStatus === 'CONNECTED') {
            try {
              const metricsResponse = await fetch(
                `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${metaapiAccountId}/account-information`,
                {
                  headers: { 'auth-token': metaApiToken },
                }
              );
              
              if (metricsResponse.ok) {
                const metrics = await metricsResponse.json();
                balance = metrics.balance;
                equity = metrics.equity;
              }
            } catch (e) {
              console.log('Could not fetch metrics:', e);
            }
          }

          // Save connection
          const { data: connection, error: insertError } = await supabase
            .from('broker_connections')
            .insert({
              user_id: user.id,
              platform: platform,
              broker_name: brokerName || accountData.name,
              server: accountData.server || server,
              login: accountData.login || login,
              metaapi_account_id: metaapiAccountId,
              connection_status: accountData.connectionStatus === 'CONNECTED' ? 'connected' : 'connecting',
              account_balance: balance,
              account_equity: equity,
              last_connected_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error saving connection:', insertError);
            return new Response(JSON.stringify({ error: 'Failed to save connection' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ 
            success: true, 
            connection,
            message: 'MT account connected via MetaAPI!',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Try to create account (may fail if subscription doesn't support it)
        console.log(`Creating MetaAPI account for ${platform} - ${server} - ${login}`);
        
        const createAccountResponse = await fetch(
          'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts',
          {
            method: 'POST',
            headers: {
              'auth-token': metaApiToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              login: login,
              password: password,
              name: `${brokerName}-${login}`,
              server: server,
              platform: platform,
              magic: 0,
              type: 'cloud-g2',
              region: 'new-york',
            }),
          }
        );

        if (!createAccountResponse.ok) {
          const errorText = await createAccountResponse.text();
          console.error('MetaAPI create account error:', errorText);
          
          // Check if it's a permission error
          if (errorText.includes('do not have access')) {
            return new Response(JSON.stringify({ 
              error: 'MetaAPI account creation requires a paid subscription. Please either:\n1. Upgrade your MetaAPI plan, or\n2. Create the account in MetaAPI dashboard and enter the Account ID here.',
              requiresAccountId: true,
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          return new Response(JSON.stringify({ error: 'Failed to connect to broker. Please check your credentials.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const accountData = await createAccountResponse.json();
        console.log('MetaAPI account created:', accountData.id);

        // Deploy the account
        await fetch(
          `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountData.id}/deploy`,
          {
            method: 'POST',
            headers: { 'auth-token': metaApiToken },
          }
        );

        // Save connection
        const { data: connection, error: insertError } = await supabase
          .from('broker_connections')
          .insert({
            user_id: user.id,
            platform: platform,
            broker_name: brokerName,
            server: server,
            login: login,
            metaapi_account_id: accountData.id,
            connection_status: 'connecting',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error saving connection:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to save connection' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          connection,
          message: 'Account connected. It may take a few moments to fully sync.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Unsupported platform' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ====================== STATUS ======================
    if (action === 'status') {
      const { data: connection, error: connError } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (connError || !connection) {
        return new Response(JSON.stringify({ error: 'Connection not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // TradeLocker status check
      if (connection.platform === 'tradelocker') {
        // For TradeLocker, we need to re-auth to check status
        // In production, you'd store encrypted credentials or use refresh token
        return new Response(JSON.stringify({ 
          success: true,
          status: connection.connection_status,
          balance: connection.account_balance,
          equity: connection.account_equity,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // MetaAPI status check
      if (!connection.metaapi_account_id || !metaApiToken) {
        return new Response(JSON.stringify({ error: 'No MetaAPI account linked or token missing' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accountResponse = await fetch(
        `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${connection.metaapi_account_id}`,
        {
          headers: { 'auth-token': metaApiToken },
        }
      );

      if (!accountResponse.ok) {
        await supabase
          .from('broker_connections')
          .update({ connection_status: 'error', last_error: 'Failed to get account status' })
          .eq('id', connectionId);
          
        return new Response(JSON.stringify({ error: 'Failed to get account status' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accountInfo = await accountResponse.json();
      
      let balance = null;
      let equity = null;
      
      if (accountInfo.state === 'DEPLOYED' && accountInfo.connectionStatus === 'CONNECTED') {
        try {
          const metricsResponse = await fetch(
            `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${connection.metaapi_account_id}/account-information`,
            {
              headers: { 'auth-token': metaApiToken },
            }
          );
          
          if (metricsResponse.ok) {
            const metrics = await metricsResponse.json();
            balance = metrics.balance;
            equity = metrics.equity;
          }
        } catch (e) {
          console.log('Could not fetch metrics:', e);
        }
      }

      const connectionStatus = accountInfo.connectionStatus === 'CONNECTED' ? 'connected' : 
                               accountInfo.state === 'DEPLOYING' ? 'connecting' : 'disconnected';
      
      await supabase
        .from('broker_connections')
        .update({ 
          connection_status: connectionStatus,
          last_connected_at: connectionStatus === 'connected' ? new Date().toISOString() : connection.last_connected_at,
          account_balance: balance,
          account_equity: equity,
          last_error: null,
        })
        .eq('id', connectionId);

      return new Response(JSON.stringify({ 
        success: true,
        status: connectionStatus,
        state: accountInfo.state,
        balance,
        equity,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ====================== POSITIONS ======================
    if (action === 'positions') {
      const { data: connection, error: connError } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (connError || !connection) {
        return new Response(JSON.stringify({ error: 'Connection not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // TradeLocker positions
      if (connection.platform === 'tradelocker' && password) {
        const authResult = await tradeLockerAuth(connection.login, password, connection.server);
        
        if (!authResult || authResult.accounts.length === 0) {
          return new Response(JSON.stringify({ error: 'Failed to authenticate with TradeLocker' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const firstAccount = authResult.accounts[0];
        const positions = await tradeLockerGetPositions(
          authResult.accessToken,
          String(firstAccount.id),
          firstAccount.accNum,
          connection.server
        );

        // Update positions in database
        await supabase.from('broker_positions').delete().eq('broker_connection_id', connectionId);
        
        if (positions.length > 0) {
          const positionsToInsert = positions.map(p => ({
            broker_connection_id: connectionId,
            position_id: String(p.id),
            symbol: p.instrument || `ID:${p.tradableInstrumentId}`,
            type: p.side.toLowerCase(),
            volume: p.qty,
            open_price: p.avgPrice,
            current_price: null,
            profit: p.unrealizedPl,
            open_time: p.openTime,
          }));

          await supabase.from('broker_positions').insert(positionsToInsert);
        }

        return new Response(JSON.stringify({ success: true, positions: positions.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // MetaAPI positions
      if (!connection.metaapi_account_id || !metaApiToken) {
        return new Response(JSON.stringify({ error: 'No MetaAPI account linked' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const positionsResponse = await fetch(
        `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${connection.metaapi_account_id}/positions`,
        {
          headers: { 'auth-token': metaApiToken },
        }
      );

      if (!positionsResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch positions' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const positions: MetaApiPosition[] = await positionsResponse.json();
      
      await supabase.from('broker_positions').delete().eq('broker_connection_id', connectionId);
      
      if (positions.length > 0) {
        const positionsToInsert = positions.map(p => ({
          broker_connection_id: connectionId,
          position_id: p.id,
          symbol: p.symbol,
          type: p.type === 'POSITION_TYPE_BUY' ? 'buy' : 'sell',
          volume: p.volume,
          open_price: p.openPrice,
          current_price: p.currentPrice,
          stop_loss: p.stopLoss,
          take_profit: p.takeProfit,
          profit: p.profit,
          swap: p.swap,
          commission: p.commission,
          open_time: p.time,
          magic_number: p.magic,
          comment: p.comment,
        }));

        await supabase.from('broker_positions').insert(positionsToInsert);
      }

      return new Response(JSON.stringify({ success: true, positions: positions.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ====================== SYNC TRADES ======================
    if (action === 'sync-trades') {
      const { data: connection, error: connError } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (connError || !connection) {
        return new Response(JSON.stringify({ error: 'Connection not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // TradeLocker sync
      if (connection.platform === 'tradelocker' && password) {
        const authResult = await tradeLockerAuth(connection.login, password, connection.server);
        
        if (!authResult || authResult.accounts.length === 0) {
          return new Response(JSON.stringify({ error: 'Failed to authenticate with TradeLocker' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const firstAccount = authResult.accounts[0];
        const orders = await tradeLockerGetOrders(
          authResult.accessToken,
          String(firstAccount.id),
          firstAccount.accNum,
          connection.server
        );

        // Filter for filled orders
        const filledOrders = orders.filter(o => o.status === 'filled' && o.realizedPl !== undefined);
        
        // Get existing trades
        const { data: existingTrades } = await supabase
          .from('broker_trades')
          .select('trade_id')
          .eq('broker_connection_id', connectionId);

        const existingIds = new Set((existingTrades || []).map(t => t.trade_id));

        const newTrades = filledOrders
          .filter(o => !existingIds.has(String(o.id)))
          .map(o => ({
            broker_connection_id: connectionId,
            trade_id: String(o.id),
            symbol: o.instrument || `ID:${o.tradableInstrumentId}`,
            type: o.side.toLowerCase(),
            volume: o.filledQty,
            open_price: o.avgFilledPrice,
            close_price: o.avgFilledPrice,
            profit: o.realizedPl || 0,
            open_time: o.createdAt,
            close_time: o.filledAt || o.createdAt,
          }));

        if (newTrades.length > 0) {
          await supabase.from('broker_trades').insert(newTrades);

          // Auto-journal
          if (tradingAccountId) {
            const journalTrades = newTrades.map(t => ({
              user_id: user.id,
              account_id: tradingAccountId,
              date: new Date(t.close_time).toISOString().split('T')[0],
              pair: t.symbol,
              direction: t.type === 'buy' ? 'Long' : 'Short',
              result: t.profit,
              session: getSession(new Date(t.close_time)),
              strategy: 'Synced from TradeLocker',
              notes: `Trade ID: ${t.trade_id}\nVolume: ${t.volume}`,
            }));

            await supabase.from('trades').insert(journalTrades);
          }
        }

        return new Response(JSON.stringify({ 
          success: true,
          totalDeals: filledOrders.length,
          newTradesImported: newTrades.length,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // MetaAPI sync
      if (!connection.metaapi_account_id || !metaApiToken) {
        return new Response(JSON.stringify({ error: 'No MetaAPI account linked' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 90);

      const historyResponse = await fetch(
        `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${connection.metaapi_account_id}/history-deals/time/${startTime.toISOString()}/${new Date().toISOString()}`,
        {
          headers: { 'auth-token': metaApiToken },
        }
      );

      if (!historyResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch trade history. Account may still be syncing.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const deals: MetaApiDeal[] = await historyResponse.json();
      const closedDeals = deals.filter(d => 
        (d.type === 'DEAL_TYPE_BUY' || d.type === 'DEAL_TYPE_SELL') && d.profit !== 0
      );

      const { data: existingTrades } = await supabase
        .from('broker_trades')
        .select('trade_id')
        .eq('broker_connection_id', connectionId);

      const existingIds = new Set((existingTrades || []).map(t => t.trade_id));

      const newTrades = closedDeals
        .filter(d => !existingIds.has(d.id))
        .map(d => ({
          broker_connection_id: connectionId,
          trade_id: d.id,
          symbol: d.symbol,
          type: d.type === 'DEAL_TYPE_BUY' ? 'buy' : 'sell',
          volume: d.volume,
          open_price: d.price,
          close_price: d.price,
          profit: d.profit,
          swap: d.swap,
          commission: d.commission,
          open_time: d.time,
          close_time: d.time,
          magic_number: d.magic,
          comment: d.comment,
        }));

      if (newTrades.length > 0) {
        await supabase.from('broker_trades').insert(newTrades);

        if (tradingAccountId) {
          const journalTrades = newTrades.map(t => ({
            user_id: user.id,
            account_id: tradingAccountId,
            date: new Date(t.close_time).toISOString().split('T')[0],
            pair: t.symbol,
            direction: t.type === 'buy' ? 'Long' : 'Short',
            result: t.profit + (t.swap || 0) + (t.commission || 0),
            session: getSession(new Date(t.close_time)),
            strategy: 'Synced from Broker',
            notes: `Trade ID: ${t.trade_id}\nVolume: ${t.volume}`,
          }));

          await supabase.from('trades').insert(journalTrades);
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        totalDeals: closedDeals.length,
        newTradesImported: newTrades.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ====================== DISCONNECT ======================
    if (action === 'disconnect') {
      const { data: connection, error: connError } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (connError || !connection) {
        return new Response(JSON.stringify({ error: 'Connection not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete MetaAPI account if exists (not for TradeLocker)
      if (connection.metaapi_account_id && !connection.metaapi_account_id.startsWith('tl_') && metaApiToken) {
        try {
          await fetch(
            `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${connection.metaapi_account_id}`,
            {
              method: 'DELETE',
              headers: { 'auth-token': metaApiToken },
            }
          );
        } catch (e) {
          console.log('Error deleting MetaAPI account:', e);
        }
      }

      // Delete related data
      await supabase.from('broker_positions').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_trades').delete().eq('broker_connection_id', connectionId);
      await supabase.from('broker_connections').delete().eq('id', connectionId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
