import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaStatsTrade {
  _id: string;
  positionId: string;
  type: string;
  symbol: string;
  volume: number;
  profit: number;
  success: string;
  openTime: string;
  closeTime: string;
  openPrice: number;
  closePrice: number;
  pips?: number;
  durationInMinutes?: number;
  gain?: number;
  swap?: number;
  commission?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaApiToken = Deno.env.get('METAAPI_TOKEN');

    if (!metaApiToken) {
      console.error('METAAPI_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'MetaAPI token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, accountId, brokerConnectionId, tradingAccountId } = await req.json();
    console.log(`Action: ${action}, User: ${user.id}, Account: ${accountId}`);

    if (action === 'connect') {
      // Connect to MetaAPI account and verify connection
      console.log('Connecting to MetaAPI account:', accountId);
      
      let accountInfoResponse;
      try {
        // Try the main MetaAPI endpoint
        accountInfoResponse = await fetch(
          `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}`,
          {
            headers: {
              'auth-token': metaApiToken,
            },
          }
        );
      } catch (fetchError) {
        console.error('MetaAPI fetch error:', fetchError);
        // Check if it's a certificate error
        const errorMessage = String(fetchError);
        if (errorMessage.includes('certificate') || errorMessage.includes('Expired')) {
          return new Response(JSON.stringify({ 
            error: 'MetaAPI service is temporarily unavailable due to a certificate issue on their end. Please try again later or contact MetaAPI support.' 
          }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Failed to connect to MetaAPI. Please check your network and try again.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!accountInfoResponse.ok) {
        const errorText = await accountInfoResponse.text();
        console.error('MetaAPI account info error:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to connect to MetaAPI account. Please check the account ID and ensure your MetaAPI token is valid.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accountInfo = await accountInfoResponse.json();
      console.log('MetaAPI account info:', accountInfo);

      return new Response(JSON.stringify({ 
        success: true, 
        accountInfo: {
          name: accountInfo.name,
          login: accountInfo.login,
          server: accountInfo.server,
          type: accountInfo.type,
          platform: accountInfo.platform,
          broker: accountInfo.broker || accountInfo.server?.split('-')[0] || 'Unknown',
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync') {
      // Sync trades from MetaAPI
      console.log('Syncing trades for broker connection:', brokerConnectionId);

      // Get the broker connection details
      const { data: connection, error: connError } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('id', brokerConnectionId)
        .eq('user_id', user.id)
        .single();

      if (connError || !connection) {
        console.error('Broker connection not found:', connError);
        return new Response(JSON.stringify({ error: 'Broker connection not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch closed trades from MetaStats API (last 90 days)
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 90);
      
      console.log('Fetching trades from MetaStats API for account:', connection.account_id);
      
      let tradesResponse;
      try {
        // Use MetaStats API for historical trades
        tradesResponse = await fetch(
          `https://metastats-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${connection.account_id}/historical-trades/${startTime.toISOString()}/${new Date().toISOString()}`,
          {
            headers: {
              'auth-token': metaApiToken,
            },
          }
        );
      } catch (fetchError) {
        console.error('MetaStats fetch error:', fetchError);
        const errorMessage = String(fetchError);
        if (errorMessage.includes('certificate') || errorMessage.includes('Expired')) {
          return new Response(JSON.stringify({ 
            error: 'MetaAPI service is temporarily unavailable due to a certificate issue. Please try again later.' 
          }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Failed to connect to MetaAPI for trade sync.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!tradesResponse.ok) {
        const errorText = await tradesResponse.text();
        console.error('MetaStats trades fetch error:', errorText);
        
        // If MetaStats fails, the account may need to be deployed first
        if (tradesResponse.status === 404) {
          return new Response(JSON.stringify({ 
            error: 'Account not found in MetaStats. The account may need to deploy/connect first in MetaAPI dashboard before syncing trades.' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        return new Response(JSON.stringify({ error: 'Failed to fetch trades. Please ensure your MetaAPI account is deployed and connected.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tradesData = await tradesResponse.json();
      const trades = tradesData.trades || tradesData || [];
      console.log(`Fetched ${trades.length} trades from MetaStats`);

      // Filter for completed trades
      const closedTrades = trades.filter((trade: MetaStatsTrade) => 
        trade.closeTime && trade.profit !== undefined
      );

      console.log(`Processing ${closedTrades.length} closed trades`);

      // Get existing trades to avoid duplicates
      const { data: existingTrades } = await supabase
        .from('trades')
        .select('notes')
        .eq('user_id', user.id)
        .eq('account_id', tradingAccountId);

      const existingMetaIds = new Set(
        (existingTrades || [])
          .filter(t => t.notes?.includes('MetaAPI ID:'))
          .map(t => t.notes?.match(/MetaAPI ID: (\S+)/)?.[1])
          .filter(Boolean)
      );

      // Prepare new trades for insertion
      const newTrades = closedTrades
        .filter((trade: MetaStatsTrade) => !existingMetaIds.has(trade._id || trade.positionId))
        .map((trade: MetaStatsTrade) => {
          const totalProfit = (trade.profit || 0) + (trade.swap || 0) + (trade.commission || 0);
          const direction = trade.type === 'DEAL_TYPE_BUY' ? 'long' : 'short';
          const tradeDate = new Date(trade.closeTime || trade.openTime);
          
          return {
            user_id: user.id,
            account_id: tradingAccountId,
            date: tradeDate.toISOString().split('T')[0],
            pair: trade.symbol,
            direction: direction,
            result: totalProfit,
            session: getSession(tradeDate),
            strategy: 'Synced from MT4/MT5',
            notes: `MetaAPI ID: ${trade._id || trade.positionId}\nVolume: ${trade.volume}\nOpen: ${trade.openPrice}\nClose: ${trade.closePrice}${trade.pips ? `\nPips: ${trade.pips}` : ''}`,
          };
        });

      console.log(`Inserting ${newTrades.length} new trades`);

      if (newTrades.length > 0) {
        const { error: insertError } = await supabase
          .from('trades')
          .insert(newTrades);

        if (insertError) {
          console.error('Error inserting trades:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to save trades' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Update sync status
      const { data: existingStatus } = await supabase
        .from('broker_sync_status')
        .select('id')
        .eq('broker_connection_id', brokerConnectionId)
        .single();

      if (existingStatus) {
        await supabase
          .from('broker_sync_status')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_status: 'success',
            trades_synced: newTrades.length,
            last_error: null,
          })
          .eq('id', existingStatus.id);
      } else {
        await supabase
          .from('broker_sync_status')
          .insert({
            broker_connection_id: brokerConnectionId,
            last_sync_at: new Date().toISOString(),
            sync_status: 'success',
            trades_synced: newTrades.length,
          });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        tradesImported: newTrades.length,
        totalDeals: closedTrades.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-metaapi-trades:', error);
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
