import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queries/keys';
import { readTradeLockerConnectionId, writeTradeLockerConnectionId } from '@/lib/brokerStorage';
import { getClientDayBoundsISO } from '@/lib/tradeFormat';
import { repairTradeLockerSessions } from '@/lib/repairBrokerSession';
import type { BrokerPosition } from '@/types/broker';

export type { BrokerPosition };

export interface BrokerConnection {
  id: string;
  user_id: string;
  platform: string;
  broker_name: string;
  server: string;
  login: string;
  connection_status: string;
  environment: string;
  active_account_id: string | null;
  active_acc_num: number | null;
  auto_sync_enabled: boolean;
  sync_interval_seconds: number;
  account_balance: number | null;
  account_equity: number | null;
  account_currency: string;
  last_connected_at: string | null;
  last_error: string | null;
  token_expiry: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrokerAccount {
  id: string;
  broker_connection_id: string;
  account_id_external: string;
  acc_num: number;
  account_name: string | null;
  is_active: boolean;
}

export interface BrokerOrder {
  id: string;
  broker_connection_id: string;
  broker_order_id: string;
  symbol: string;
  order_type: string;
  side: string;
  size: number;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  created_broker_at: string | null;
}

export interface BrokerTradeHistory {
  id: string;
  broker_connection_id: string;
  broker_order_id: string | null;
  broker_position_id: string | null;
  symbol: string;
  side: string;
  size: number;
  entry_price: number;
  exit_price: number | null;
  realized_pl: number;
  fees: number;
  opened_at: string;
  closed_at: string | null;
  synced_at: string | null;
}

export interface AccountSummary {
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  floatingPl: number;
  openPositions: number;
  pendingOrders: number;
}

async function invokeTradeLockerOnce(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('tradelocker', {
    body: { action, ...body },
  });

  if (data?.error) throw new Error(String(data.error));

  if (error) {
    let message = error.message || 'Request failed';
    if ('context' in error && error.context instanceof Response) {
      try {
        const parsed = await error.context.json();
        if (parsed?.error) message = String(parsed.error);
      } catch {
        // Keep default message when response body isn't JSON.
      }
    }
    throw new Error(message);
  }

  return data;
}

function isSessionError(message: string): boolean {
  return /expired|reconnect|invalid session|refresh token/i.test(message);
}

async function invokeTradeLocker(action: string, body: Record<string, unknown> = {}) {
  try {
    return await invokeTradeLockerOnce(action, body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const connectionId = body.connectionId as string | undefined;
    if (
      action !== 'refresh-session' &&
      action !== 'reconnect' &&
      action !== 'connect' &&
      connectionId &&
      isSessionError(message)
    ) {
      try {
        await invokeTradeLockerOnce('refresh-session', { connectionId });
        return await invokeTradeLockerOnce(action, body);
      } catch {
        // Fall through to original error.
      }
    }
    throw error;
  }
}

export function useTradeLocker() {
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(() => {
    return readTradeLockerConnectionId();
  });
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [history, setHistory] = useState<BrokerTradeHistory[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectConnection = useCallback((connectionId: string | null) => {
    setActiveConnectionId(connectionId);
    writeTradeLockerConnectionId(connectionId);
    setPositions([]);
    setOrders([]);
    setHistory([]);
    setSummary(null);
  }, []);

  // Fetch all connections via React Query
  const { data: connections = [], isLoading: loading, refetch: refetchConnections } = useQuery({
    queryKey: queryKeys.broker.connections('current'),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', 'tradelocker')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as BrokerConnection[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (connections.length === 0) return;
    let cancelled = false;
    (async () => {
      const { restored } = await repairTradeLockerSessions();
      if (!cancelled && restored > 0) {
        await refetchConnections();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connections.length, refetchConnections]);

  useEffect(() => {
    if (connections.length === 0) {
      if (activeConnectionId) selectConnection(null);
      return;
    }
    const persisted = readTradeLockerConnectionId();
    const match = connections.find((c) => c.id === persisted);
    if (match) {
      if (activeConnectionId !== match.id) selectConnection(match.id);
      return;
    }
    if (!connections.some((c) => c.id === activeConnectionId)) {
      selectConnection(connections[0].id);
    }
  }, [connections, activeConnectionId, selectConnection]);

  const fetchConnections = useCallback(async () => {
    await refetchConnections();
  }, [refetchConnections]);

  const connection = connections.find(c => c.id === activeConnectionId) || null;

  // Fetch accounts for active connection
  const fetchAccounts = useCallback(async (connectionId?: string | null) => {
    const connId = connectionId ?? activeConnectionId;
    if (!connId) {
      setAccounts([]);
      return [];
    }
    setAccountsLoading(true);
    try {
      const { data: accs, error } = await supabase
        .from('broker_accounts')
        .select('*')
        .eq('broker_connection_id', connId);
      if (error) throw error;
      const brokerAccounts = (accs || []) as unknown as BrokerAccount[];
      setAccounts(brokerAccounts);
      return brokerAccounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setAccounts([]);
      return [];
    } finally {
      setAccountsLoading(false);
    }
  }, [activeConnectionId]);

  // Connect
  const connect = async (email: string, password: string, server: string, environment: string) => {
    try {
      const result = await invokeTradeLocker('connect', { email, password, server, environment });
      toast.success(result.message || 'Connected!');

      if (result.connectionId) {
        selectConnection(result.connectionId);
        await fetchConnections();
        const brokerAccounts = await fetchAccounts(result.connectionId);

        if (brokerAccounts.length === 1) {
          const acc = brokerAccounts[0];
          await invokeTradeLocker('select-account', {
            connectionId: result.connectionId,
            accountId: acc.account_id_external,
            accNum: acc.acc_num,
          });
          toast.success('Account selected');
          await fetchConnections();
          return { ...result, autoSelected: true };
        }
      } else {
        await fetchConnections();
      }

      return { ...result, autoSelected: false };
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    }
  };

  // Select account within a connection
  const selectAccount = async (accountId: string, accNum: number, connectionId?: string) => {
    const connId = connectionId || connection?.id;
    if (!connId) return false;
    try {
      await invokeTradeLocker('select-account', { connectionId: connId, accountId, accNum });
      toast.success('Account selected');
      await fetchConnections();
      await fetchAccounts(connId);
      return true;
    } catch (error: any) {
      toast.error(error.message);
      return false;
    }
  };

  // Sync
  const sync = async (options?: { quiet?: boolean }) => {
    if (!connection || !connection.active_account_id) {
      if (!options?.quiet) {
        toast.warning('Select a trading account before syncing.');
      }
      return false;
    }
    setSyncing(true);
    try {
      const dayBounds = getClientDayBoundsISO();
      const result = await invokeTradeLocker('sync', {
        connectionId: connection.id,
        clientToday: dayBounds.dateKey,
        clientDayStart: dayBounds.start,
        clientDayEnd: dayBounds.end,
      });
      window.dispatchEvent(new CustomEvent('broker-sync-complete'));
      toast.success(result.message || 'Synced');
      await Promise.all([fetchPositions(), fetchOrders(), fetchHistory(), fetchSummary(), fetchConnections()]);
      return true;
    } catch (error: any) {
      // Suppress sync errors when session is expired - don't show toast for background syncs
      if (!options?.quiet && !error.message?.includes('expired')) {
        toast.error(error.message);
      }
      return false;
    } finally {
      setSyncing(false);
    }
  };

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    if (!connection) return;
    try {
      const result = await invokeTradeLocker('positions', { connectionId: connection.id });
      setPositions(result.positions || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  }, [connection?.id]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!connection) return;
    try {
      const result = await invokeTradeLocker('orders', { connectionId: connection.id });
      setOrders(result.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  }, [connection?.id]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!connection) return;
    try {
      const result = await invokeTradeLocker('history', { connectionId: connection.id });
      setHistory(result.history || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }, [connection?.id]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    if (!connection) return;
    try {
      const result = await invokeTradeLocker('account-summary', { connectionId: connection.id });
      setSummary(result);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, [connection?.id]);

  // Place order
  const placeOrder = async (params: { symbol: string; side: string; type: string; qty: number; price?: number; stopLoss?: number; takeProfit?: number; tradableInstrumentId: number }) => {
    if (!connection) return;
    try {
      const result = await invokeTradeLocker('place-order', { connectionId: connection.id, ...params });
      toast.success(result.message || 'Order placed');
      await sync();
      return result;
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    }
  };

  // Close position
  const closePosition = async (positionId: string, qty?: number) => {
    if (!connection) return false;
    try {
      await invokeTradeLocker('close-position', { connectionId: connection.id, positionId, qty });
      toast.success('Position closed');
      await sync({ quiet: true });
      return true;
    } catch (error: any) {
      toast.error(error.message);
      return false;
    }
  };

  // Modify position
  const modifyPosition = async (positionId: string, stopLoss?: number, takeProfit?: number) => {
    if (!connection) return false;
    try {
      await invokeTradeLocker('modify-position', { connectionId: connection.id, positionId, stopLoss, takeProfit });
      toast.success('Position modified');
      await sync({ quiet: true });
      return true;
    } catch (error: any) {
      toast.error(error.message);
      return false;
    }
  };

  // Cancel order
  const cancelOrder = async (orderId: string) => {
    if (!connection) return false;
    try {
      await invokeTradeLocker('cancel-order', { connectionId: connection.id, orderId });
      toast.success('Order cancelled');
      await sync({ quiet: true });
      return true;
    } catch (error: any) {
      toast.error(error.message);
      return false;
    }
  };

  // Modify order
  const modifyOrder = async (orderId: string, params: { stopLoss?: number; takeProfit?: number; price?: number }) => {
    if (!connection) return false;
    try {
      await invokeTradeLocker('modify-order', { connectionId: connection.id, orderId, ...params });
      toast.success('Order modified');
      await sync({ quiet: true });
      return true;
    } catch (error: any) {
      toast.error(error.message);
      return false;
    }
  };

  // Disconnect
  const disconnect = async () => {
    if (!connection) return;
    try {
      await invokeTradeLocker('disconnect', { connectionId: connection.id });
      toast.success('Disconnected');
      const remaining = connections.filter((c) => c.id !== connection.id);
      selectConnection(remaining[0]?.id ?? null);
      setAccounts([]);
      setPositions([]);
      setOrders([]);
      setHistory([]);
      setSummary(null);
      await refetchConnections();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const refreshSession = useCallback(async (connectionId?: string) => {
    const connId = connectionId || connection?.id;
    if (!connId) return false;
    try {
      await invokeTradeLocker('refresh-session', { connectionId: connId });
      await refetchConnections();
      return true;
    } catch {
      return false;
    }
  }, [connection?.id, refetchConnections]);

  // Reconnect
  const reconnect = async (email: string, password: string) => {
    if (!connection) return false;
    try {
      const result = await invokeTradeLocker('reconnect', {
        connectionId: connection.id,
        email: email.trim(),
        password,
      });
      toast.success(result.message || 'Reconnected');
      selectConnection(connection.id);
      writeTradeLockerConnectionId(connection.id);
      await fetchConnections();
      await fetchAccounts(connection.id);
      await Promise.all([fetchPositions(), fetchOrders(), fetchHistory(), fetchSummary()]);
      await sync({ quiet: true });
      return true;
    } catch (error: any) {
      toast.error(error.message);
      return false;
    }
  };

  // Run diagnostic
  const runDiagnostic = async () => {
    if (!connection) return null;
    try {
      const result = await invokeTradeLocker('diagnostic', { connectionId: connection.id });
      return result.results || [];
    } catch (error: any) {
      toast.error('Diagnostic failed: ' + error.message);
      return null;
    }
  };

  // Fetch sync logs
  const fetchSyncLogs = async () => {
    if (!connection) return [];
    try {
      const result = await invokeTradeLocker('sync-logs', { connectionId: connection.id });
      return result.logs || [];
    } catch {
      return [];
    }
  };

  // Update sync settings
  const updateSyncSettings = async (autoSyncEnabled: boolean, syncIntervalSeconds: number) => {
    if (!connection) return;
    try {
      await invokeTradeLocker('update-sync-settings', { connectionId: connection.id, autoSyncEnabled, syncIntervalSeconds });
      toast.success('Sync settings updated');
      await fetchConnections();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Fetch accounts when active connection changes
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Try silent token refresh when expired or nearing expiry
  useEffect(() => {
    if (!connection?.id) return;
    const needsRefresh =
      connection.connection_status === 'expired' ||
      (connection.token_expiry &&
        new Date(connection.token_expiry).getTime() - Date.now() < 5 * 60 * 1000);
    if (!needsRefresh) return;

    let cancelled = false;
    (async () => {
      const ok = await refreshSession(connection.id);
      if (!cancelled && ok) {
        await refetchConnections();
        if (connection.connection_status === 'expired') {
          toast.success('TradeLocker session restored');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection?.id, connection?.connection_status, connection?.token_expiry, refreshSession, refetchConnections]);

  // Load data when connection is active
  useEffect(() => {
    if (connection?.active_account_id && connection.connection_status === 'connected') {
      fetchPositions();
      fetchOrders();
      fetchHistory();
      fetchSummary();
    }
  }, [connection?.id, connection?.active_account_id, connection?.connection_status]);

  // Auto-sync interval
  useEffect(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    if (connection?.auto_sync_enabled && connection.connection_status === 'connected' && connection.active_account_id) {
      const interval = (connection.sync_interval_seconds || 60) * 1000;
      syncIntervalRef.current = setInterval(() => {
        sync({ quiet: true });
      }, interval);
    }

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [connection?.auto_sync_enabled, connection?.sync_interval_seconds, connection?.connection_status, connection?.active_account_id]);

  return {
    connections,
    connection,
    activeConnectionId,
    selectConnection,
    accounts,
    positions,
    orders,
    history,
    summary,
    loading,
    accountsLoading,
    syncing,
    connect,
    selectAccount,
    sync,
    disconnect,
    reconnect,
    refreshSession,
    placeOrder,
    closePosition,
    modifyPosition,
    cancelOrder,
    modifyOrder,
    updateSyncSettings,
    fetchConnection: fetchConnections,
    runDiagnostic,
    fetchSyncLogs,
  };
}
