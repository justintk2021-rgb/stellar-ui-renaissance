import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BrokerConnection {
  id: string;
  user_id: string;
  login: string;
  broker: string;
  account_id: string;
  created_at: string;
  updated_at: string;
}

export interface BrokerSyncStatus {
  id: string;
  broker_connection_id: string;
  last_sync_at: string | null;
  sync_status: string;
  trades_synced: number;
  last_error: string | null;
}

export function useBrokerConnections(userId: string | undefined) {
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, BrokerSyncStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!userId) {
      setConnections([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections(data || []);

      // Fetch sync statuses
      if (data && data.length > 0) {
        const connectionIds = data.map(c => c.id);
        const { data: statuses } = await supabase
          .from('broker_sync_status')
          .select('*')
          .in('broker_connection_id', connectionIds);

        const statusMap: Record<string, BrokerSyncStatus> = {};
        (statuses || []).forEach(s => {
          statusMap[s.broker_connection_id] = s;
        });
        setSyncStatuses(statusMap);
      }
    } catch (error) {
      console.error('Error fetching broker connections:', error);
      toast.error('Failed to load broker connections');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const connectAccount = async (accountId: string): Promise<{ success: boolean; accountInfo?: any }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to connect a broker account');
        return { success: false };
      }

      const response = await supabase.functions.invoke('sync-metaapi-trades', {
        body: { action: 'connect', accountId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to connect account');
      }

      return { success: true, accountInfo: response.data.accountInfo };
    } catch (error: any) {
      console.error('Error connecting account:', error);
      toast.error(error.message || 'Failed to connect account');
      return { success: false };
    }
  };

  const addConnection = async (accountId: string, accountInfo: any): Promise<BrokerConnection | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('broker_connections')
        .insert({
          user_id: userId,
          login: accountInfo.login || accountId,
          broker: accountInfo.broker || 'MetaTrader',
          account_id: accountId,
        })
        .select()
        .single();

      if (error) throw error;

      setConnections(prev => [data, ...prev]);
      toast.success('Broker account connected successfully!');
      return data;
    } catch (error: any) {
      console.error('Error adding connection:', error);
      toast.error(error.message || 'Failed to save connection');
      return null;
    }
  };

  const deleteConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('broker_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      setConnections(prev => prev.filter(c => c.id !== connectionId));
      toast.success('Broker connection removed');
    } catch (error) {
      console.error('Error deleting connection:', error);
      toast.error('Failed to remove connection');
    }
  };

  const syncTrades = async (connectionId: string, tradingAccountId: string) => {
    setIsSyncing(connectionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to sync trades');
        return;
      }

      const response = await supabase.functions.invoke('sync-metaapi-trades', {
        body: { 
          action: 'sync', 
          brokerConnectionId: connectionId,
          tradingAccountId: tradingAccountId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to sync trades');
      }

      toast.success(`Synced ${response.data.tradesImported} new trades!`);
      
      // Refresh sync statuses
      await fetchConnections();
    } catch (error: any) {
      console.error('Error syncing trades:', error);
      toast.error(error.message || 'Failed to sync trades');
    } finally {
      setIsSyncing(null);
    }
  };

  return {
    connections,
    syncStatuses,
    isLoading,
    isSyncing,
    connectAccount,
    addConnection,
    deleteConnection,
    syncTrades,
    refetch: fetchConnections,
  };
}
