import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BrokerConnection {
  id: string;
  user_id: string;
  platform: string;
  broker_name: string;
  server: string;
  login: string;
  metaapi_account_id: string | null;
  connection_status: string;
  last_connected_at: string | null;
  last_error: string | null;
  account_balance: number | null;
  account_equity: number | null;
  account_currency: string;
  created_at: string;
  updated_at: string;
}

export interface BrokerPosition {
  id: string;
  broker_connection_id: string;
  position_id: string;
  symbol: string;
  type: string;
  volume: number;
  open_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
  swap: number;
  commission: number;
  open_time: string;
  magic_number: number | null;
  comment: string | null;
}

export interface BrokerTrade {
  id: string;
  broker_connection_id: string;
  trade_id: string;
  symbol: string;
  type: string;
  volume: number;
  open_price: number;
  close_price: number | null;
  profit: number;
  swap: number;
  commission: number;
  open_time: string;
  close_time: string | null;
  journal_trade_id: string | null;
}

export function useBrokerConnections() {
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [trades, setTrades] = useState<BrokerTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchConnections = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections((data || []) as unknown as BrokerConnection[]);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPositions = useCallback(async (connectionId: string) => {
    try {
      const { data, error } = await supabase
        .from('broker_positions')
        .select('*')
        .eq('broker_connection_id', connectionId);

      if (error) throw error;
      setPositions((data || []) as unknown as BrokerPosition[]);
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  }, []);

  const fetchTrades = useCallback(async (connectionId: string) => {
    try {
      const { data, error } = await supabase
        .from('broker_trades')
        .select('*')
        .eq('broker_connection_id', connectionId)
        .order('close_time', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTrades((data || []) as unknown as BrokerTrade[]);
    } catch (error) {
      console.error('Error fetching trades:', error);
    }
  }, []);

  const connectBroker = async (
    platform: string,
    brokerName: string,
    server: string,
    login: string,
    password: string
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('sync-metaapi-trades', {
        body: {
          action: 'connect',
          platform,
          brokerName,
          server,
          login,
          password,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Connection failed');
      }

      const result = response.data;
      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: 'Broker Connected',
        description: result.message || 'Your broker account is being connected.',
      });

      await fetchConnections();
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to broker';
      console.error('Error connecting broker:', error);
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const checkStatus = async (connectionId: string) => {
    try {
      const response = await supabase.functions.invoke('sync-metaapi-trades', {
        body: { action: 'status', connectionId },
      });

      if (response.error) throw response.error;
      
      await fetchConnections();
      return response.data;
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const refreshPositions = async (connectionId: string) => {
    try {
      const response = await supabase.functions.invoke('sync-metaapi-trades', {
        body: { action: 'positions', connectionId },
      });

      if (response.error) throw response.error;
      
      await fetchPositions(connectionId);
      return response.data;
    } catch (error) {
      console.error('Error refreshing positions:', error);
    }
  };

  const syncTrades = async (connectionId: string, tradingAccountId?: string) => {
    try {
      const response = await supabase.functions.invoke('sync-metaapi-trades', {
        body: { action: 'sync-trades', connectionId, tradingAccountId },
      });

      if (response.error) throw response.error;
      
      const result = response.data;
      if (result.error) throw new Error(result.error);

      toast({
        title: 'Trades Synced',
        description: `Imported ${result.newTradesImported} new trades.`,
      });

      await fetchTrades(connectionId);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync trades';
      console.error('Error syncing trades:', error);
      toast({
        title: 'Sync Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const disconnectBroker = async (connectionId: string) => {
    try {
      const response = await supabase.functions.invoke('sync-metaapi-trades', {
        body: { action: 'disconnect', connectionId },
      });

      if (response.error) throw response.error;

      toast({
        title: 'Broker Disconnected',
        description: 'Your broker account has been disconnected.',
      });

      await fetchConnections();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect broker';
      console.error('Error disconnecting:', error);
      toast({
        title: 'Disconnect Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchConnections();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('broker-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'broker_positions' },
        () => {
          if (connections.length > 0) {
            connections.forEach(c => fetchPositions(c.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'broker_connections' },
        () => {
          fetchConnections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConnections, fetchPositions, connections.length]);

  return {
    connections,
    positions,
    trades,
    loading,
    connectBroker,
    disconnectBroker,
    checkStatus,
    refreshPositions,
    syncTrades,
    fetchConnections,
    fetchPositions,
    fetchTrades,
  };
}
