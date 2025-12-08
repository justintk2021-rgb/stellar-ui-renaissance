import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaApiAccount {
  _id: string;
  login: string;
  name: string;
  server: string;
  platform: string;
  state: string;
  connectionStatus: string;
  type: string;
}

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

    if (!metaApiToken) {
      return new Response(JSON.stringify({ error: 'MetaAPI token not configured. Please add METAAPI_TOKEN secret.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, connectionId, platform, brokerName, server, login, password, tradingAccountId } = await req.json();
    console.log(`Action: ${action}, User: ${user.id}`);

    // ACTION: Create a new MetaAPI account with broker credentials
    if (action === 'connect') {
      console.log(`Creating MetaAPI account for ${platform} - ${server} - ${login}`);
      
      // Step 1: Create account in MetaAPI
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
        
        let errorMessage = 'Failed to connect to broker. Please check your credentials.';
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch {}
        
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accountData = await createAccountResponse.json();
      console.log('MetaAPI account created:', accountData.id);

      // Step 2: Deploy the account
      const deployResponse = await fetch(
        `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountData.id}/deploy`,
        {
          method: 'POST',
          headers: {
            'auth-token': metaApiToken,
          },
        }
      );

      if (!deployResponse.ok) {
        console.error('Failed to deploy account');
      }

      // Step 3: Save connection to database
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

    // ACTION: Check connection status and update account info
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

      if (!connection.metaapi_account_id) {
        return new Response(JSON.stringify({ error: 'No MetaAPI account linked' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get account status from MetaAPI
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

      const accountInfo: MetaApiAccount = await accountResponse.json();
      
      // Get account metrics if connected
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

      // Update connection in database
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

    // ACTION: Fetch open positions
    if (action === 'positions') {
      const { data: connection, error: connError } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (connError || !connection || !connection.metaapi_account_id) {
        return new Response(JSON.stringify({ error: 'Connection not found' }), {
          status: 404,
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
      
      // Update positions in database
      // First, delete old positions
      await supabase
        .from('broker_positions')
        .delete()
        .eq('broker_connection_id', connectionId);
      
      // Insert current positions
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

      return new Response(JSON.stringify({ 
        success: true,
        positions: positions.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Sync historical trades
    if (action === 'sync-trades') {
      const { data: connection, error: connError } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (connError || !connection || !connection.metaapi_account_id) {
        return new Response(JSON.stringify({ error: 'Connection not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch history deals from last 90 days
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 90);

      const historyResponse = await fetch(
        `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${connection.metaapi_account_id}/history-deals/time/${startTime.toISOString()}/${new Date().toISOString()}`,
        {
          headers: { 'auth-token': metaApiToken },
        }
      );

      if (!historyResponse.ok) {
        const errorText = await historyResponse.text();
        console.error('Failed to fetch history:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to fetch trade history. Account may still be syncing.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const deals: MetaApiDeal[] = await historyResponse.json();
      
      // Filter for closing deals (entries are DEAL_ENTRY_OUT or DEAL_ENTRY_INOUT)
      const closedDeals = deals.filter(d => 
        (d.type === 'DEAL_TYPE_BUY' || d.type === 'DEAL_TYPE_SELL') &&
        d.profit !== 0
      );

      console.log(`Found ${closedDeals.length} closed deals`);

      // Get existing broker trades to avoid duplicates
      const { data: existingTrades } = await supabase
        .from('broker_trades')
        .select('trade_id')
        .eq('broker_connection_id', connectionId);

      const existingIds = new Set((existingTrades || []).map(t => t.trade_id));

      // Insert new trades
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
      }

      // Auto-journal: Create trade entries for new closed trades
      if (tradingAccountId && newTrades.length > 0) {
        const journalTrades = newTrades.map(t => ({
          user_id: user.id,
          account_id: tradingAccountId,
          date: new Date(t.close_time).toISOString().split('T')[0],
          pair: t.symbol,
          direction: t.type === 'buy' ? 'long' : 'short',
          result: t.profit + (t.swap || 0) + (t.commission || 0),
          session: getSession(new Date(t.close_time)),
          strategy: 'Synced from Broker',
          notes: `Auto-synced from ${connection.broker_name}\nTrade ID: ${t.trade_id}\nVolume: ${t.volume}`,
        }));

        await supabase.from('trades').insert(journalTrades);
      }

      return new Response(JSON.stringify({ 
        success: true,
        totalDeals: closedDeals.length,
        newTradesImported: newTrades.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Disconnect and remove MetaAPI account
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

      // Delete from MetaAPI if account exists
      if (connection.metaapi_account_id) {
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

      // Delete from database (cascade will delete positions and trades)
      await supabase
        .from('broker_connections')
        .delete()
        .eq('id', connectionId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getSession(date: Date): string {
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 8) return 'Asia';
  if (hour >= 8 && hour < 12) return 'London';
  if (hour >= 12 && hour < 17) return 'New York AM';
  if (hour >= 17 && hour < 21) return 'New York PM';
  return 'Asia';
}
