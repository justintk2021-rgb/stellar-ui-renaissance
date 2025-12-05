import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const METAAPI_TOKEN = Deno.env.get('METAAPI_TOKEN');
    if (!METAAPI_TOKEN) {
      throw new Error('METAAPI_TOKEN is not configured');
    }

    const { action, accountId, login, password, server, platform } = await req.json();
    console.log(`Broker sync action: ${action}`);

    // MetaApi base URLs - using regional endpoints for better reliability
    const METAAPI_BASE = 'https://mt-provisioning-api-v1.new-york.agiliumtrade.ai';
    const METAAPI_RPC = 'https://mt-client-api-v1.new-york.agiliumtrade.ai';

    if (action === 'create-account') {
      // Create a MetaApi account to connect to the broker
      console.log('Creating MetaApi account for broker connection...');
      
      const response = await fetch(`${METAAPI_BASE}/users/current/accounts`, {
        method: 'POST',
        headers: {
          'auth-token': METAAPI_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `NSYNC-${login}`,
          type: 'cloud',
          login: login,
          password: password,
          server: server,
          platform: platform || 'mt5',
          magic: 0,
        }),
      });

      const data = await response.json();
      console.log('MetaApi account creation response:', JSON.stringify(data));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create MetaApi account');
      }

      return new Response(JSON.stringify({ 
        success: true, 
        accountId: data.id,
        message: 'Broker account connected successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'deploy-account') {
      // Deploy the account to start syncing
      console.log(`Deploying account: ${accountId}`);
      
      const response = await fetch(`${METAAPI_BASE}/users/current/accounts/${accountId}/deploy`, {
        method: 'POST',
        headers: {
          'auth-token': METAAPI_TOKEN,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to deploy account');
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Account deployed and syncing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-trades') {
      // Fetch trades from the connected account
      console.log(`Fetching trades for account: ${accountId}`);
      
      // Get account info first
      const accountResponse = await fetch(`${METAAPI_BASE}/users/current/accounts/${accountId}`, {
        headers: {
          'auth-token': METAAPI_TOKEN,
        },
      });
      
      if (!accountResponse.ok) {
        throw new Error('Failed to fetch account info');
      }
      
      const accountData = await accountResponse.json();
      console.log('Account state:', accountData.state);
      
      if (accountData.state !== 'DEPLOYED') {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Account is not deployed yet. Please wait for deployment to complete.',
          state: accountData.state
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch historical trades
      const historyResponse = await fetch(
        `${METAAPI_RPC}/users/current/accounts/${accountId}/history-deals/time/${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}/${new Date().toISOString()}`,
        {
          headers: {
            'auth-token': METAAPI_TOKEN,
          },
        }
      );

      if (!historyResponse.ok) {
        const error = await historyResponse.json();
        throw new Error(error.message || 'Failed to fetch trade history');
      }

      const trades = await historyResponse.json();
      console.log(`Fetched ${trades.length} trades`);

      return new Response(JSON.stringify({ 
        success: true, 
        trades: trades
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-account-status') {
      // Check account status
      console.log(`Checking status for account: ${accountId}`);
      
      const response = await fetch(`${METAAPI_BASE}/users/current/accounts/${accountId}`, {
        headers: {
          'auth-token': METAAPI_TOKEN,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get account status');
      }

      const data = await response.json();
      
      return new Response(JSON.stringify({ 
        success: true,
        state: data.state,
        connectionStatus: data.connectionStatus,
        name: data.name
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disconnect') {
      // Undeploy and remove account
      console.log(`Disconnecting account: ${accountId}`);
      
      // First undeploy
      await fetch(`${METAAPI_BASE}/users/current/accounts/${accountId}/undeploy`, {
        method: 'POST',
        headers: {
          'auth-token': METAAPI_TOKEN,
        },
      });

      // Then delete
      const deleteResponse = await fetch(`${METAAPI_BASE}/users/current/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'auth-token': METAAPI_TOKEN,
        },
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Broker disconnected successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in broker-sync:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
