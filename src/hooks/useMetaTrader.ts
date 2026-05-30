import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  AccountSummary,
  BrokerAccount,
  BrokerConnection,
  BrokerOrder,
  BrokerTradeHistory,
} from '@/hooks/useTradeLocker';
import type { BrokerPosition } from '@/types/broker';

type BridgeStatus = {
  id: string;
  status: string;
  last_heartbeat_at: string | null;
  last_error: string | null;
  bridge_version: string | null;
  machine_name: string | null;
  updated_at: string | null;
} | null;

export type Mt5Command = {
  id: string;
  command_type: string;
  status: string;
  error_message: string | null;
  result: unknown;
  requested_at: string;
  completed_at: string | null;
};

async function invokeMt5Bridge(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('mt5-bridge', {
    body: { action, ...body },
  });

  if (data?.error) throw new Error(String(data.error));

  if (error) {
    let message = error.message || 'MT5 bridge request failed';
    if ('context' in error && error.context instanceof Response) {
      try {
        const parsed = await error.context.json();
        if (parsed?.error) message = String(parsed.error);
      } catch {
        // keep default message
      }
    }
    throw new Error(message);
  }

  return data;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useMetaTrader() {
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(() => {
    return localStorage.getItem('activeMt5ConnectionId') || null;
  });
  const [latestBridgeKey, setLatestBridgeKey] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [history, setHistory] = useState<BrokerTradeHistory[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>(null);
  const [recentCommands, setRecentCommands] = useState<Mt5Command[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isQueuingCommand, setIsQueuingCommand] = useState(false);

  const selectConnection = useCallback((connectionId: string | null) => {
    setActiveConnectionId(connectionId);
    if (connectionId) {
      localStorage.setItem('activeMt5ConnectionId', connectionId);
    } else {
      localStorage.removeItem('activeMt5ConnectionId');
    }
    setAccounts([]);
    setPositions([]);
    setOrders([]);
    setHistory([]);
    setSummary(null);
    setBridgeStatus(null);
    setRecentCommands([]);
  }, []);

  const { data: connections = [], isLoading: loading, refetch: refetchConnections } = useQuery({
    queryKey: ['broker-connections', 'mt5'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', 'mt5')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as BrokerConnection[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (connections.length > 0) {
      const persisted = localStorage.getItem('activeMt5ConnectionId');
      const match = connections.find((connection) => connection.id === persisted);
      if (!match && activeConnectionId !== connections[0].id) {
        selectConnection(connections[0].id);
      }
    } else if (connections.length === 0 && activeConnectionId) {
      selectConnection(null);
    }
  }, [connections, activeConnectionId, selectConnection]);

  const connection = connections.find((item) => item.id === activeConnectionId) || null;

  const fetchStatus = useCallback(async (connectionId = activeConnectionId) => {
    if (!connectionId) return;
    const result = await invokeMt5Bridge('status', { connectionId });
    setBridgeStatus(result.bridge || null);
    setRecentCommands(result.recentCommands || []);
  }, [activeConnectionId]);

  const fetchAccounts = useCallback(async (connectionId = activeConnectionId) => {
    if (!connectionId) {
      setAccounts([]);
      return;
    }

    const { data, error } = await supabase
      .from('broker_accounts')
      .select('*')
      .eq('broker_connection_id', connectionId);
    if (error) throw error;
    setAccounts((data || []) as unknown as BrokerAccount[]);
  }, [activeConnectionId]);

  const fetchPositions = useCallback(async (connectionId = activeConnectionId) => {
    if (!connectionId) {
      setPositions([]);
      return;
    }

    const { data, error } = await supabase
      .from('broker_positions')
      .select('*')
      .eq('broker_connection_id', connectionId)
      .is('closed_at', null);
    if (error) throw error;
    setPositions((data || []) as unknown as BrokerPosition[]);
  }, [activeConnectionId]);

  const fetchOrders = useCallback(async (connectionId = activeConnectionId) => {
    if (!connectionId) {
      setOrders([]);
      return;
    }

    const { data, error } = await supabase
      .from('broker_orders')
      .select('*')
      .eq('broker_connection_id', connectionId);
    if (error) throw error;
    setOrders((data || []) as unknown as BrokerOrder[]);
  }, [activeConnectionId]);

  const fetchHistory = useCallback(async (connectionId = activeConnectionId) => {
    if (!connectionId) {
      setHistory([]);
      return;
    }

    const { data, error } = await supabase
      .from('broker_trade_history')
      .select('*')
      .eq('broker_connection_id', connectionId)
      .order('closed_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    setHistory((data || []) as unknown as BrokerTradeHistory[]);
  }, [activeConnectionId]);

  const refresh = useCallback(async (connectionId = activeConnectionId) => {
    if (!connectionId) return;
    setLoadingData(true);
    try {
      await Promise.all([
        refetchConnections(),
        fetchAccounts(connectionId),
        fetchPositions(connectionId),
        fetchOrders(connectionId),
        fetchHistory(connectionId),
        fetchStatus(connectionId),
      ]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to refresh MT5 data'));
    } finally {
      setLoadingData(false);
    }
  }, [activeConnectionId, fetchAccounts, fetchHistory, fetchOrders, fetchPositions, fetchStatus, refetchConnections]);

  const createConnection = async (params: { brokerName?: string; server: string; login: string; password: string }) => {
    try {
      const result = await invokeMt5Bridge('create-connection', params);
      setLatestBridgeKey(result.bridgeKey || null);
      if (result.connectionId) {
        selectConnection(result.connectionId);
        await refetchConnections();
      }
      toast.success('MT5 bridge connection created');
      return result;
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to create MT5 connection'));
      throw error;
    }
  };

  const disconnect = async () => {
    if (!connection) return;
    try {
      await invokeMt5Bridge('disconnect', { connectionId: connection.id });
      toast.success('MT5 connection removed');
      setLatestBridgeKey(null);
      const remaining = connections.filter((c) => c.id !== connection.id);
      selectConnection(remaining[0]?.id ?? null);
      await refetchConnections();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to disconnect MT5'));
    }
  };

  const queueCommand = async (commandType: string, payload: Record<string, unknown>) => {
    if (!connection) return null;
    setIsQueuingCommand(true);
    try {
      const result = await invokeMt5Bridge('queue-command', {
        connectionId: connection.id,
        commandType,
        payload,
      });
      toast.success(result.message || 'Command queued');
      await fetchStatus(connection.id);
      return result.command;
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to queue MT5 command'));
      throw error;
    } finally {
      setIsQueuingCommand(false);
    }
  };

  const buildSummary = useCallback(() => {
    if (!connection) {
      setSummary(null);
      return;
    }

    const floatingPl = positions.reduce((total, position) => total + Number(position.floating_pl || 0), 0);
    setSummary({
      balance: Number(connection.account_balance || 0),
      equity: Number(connection.account_equity || connection.account_balance || 0),
      marginUsed: 0,
      freeMargin: 0,
      floatingPl,
      openPositions: positions.length,
      pendingOrders: orders.length,
    });
  }, [connection, orders.length, positions]);

  useEffect(() => {
    if (activeConnectionId) {
      refresh(activeConnectionId);
    }
  }, [activeConnectionId, refresh]);

  useEffect(() => {
    buildSummary();
  }, [buildSummary]);

  return {
    connections,
    connection,
    activeConnectionId,
    selectConnection,
    latestBridgeKey,
    clearLatestBridgeKey: () => setLatestBridgeKey(null),
    accounts,
    positions,
    orders,
    history,
    summary,
    bridgeStatus,
    recentCommands,
    loading,
    loadingData,
    isQueuingCommand,
    createConnection,
    refresh,
    disconnect,
    queueCommand,
  };
}
