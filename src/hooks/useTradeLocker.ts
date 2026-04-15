import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export interface BrokerPosition {
  id: string;
  broker_connection_id: string;
  position_id: string;
  symbol: string;
  type: string;
  side: string | null;
  volume: number;
  open_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  floating_pl: number;
  open_time: string;
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

async function invokeTradeLocker(action: string, body: Record<string, unknown> = {}) {
  const response = await supabase.functions.invoke('tradelocker', {
    body: { action, ...body },
  });
  if (response.error) throw new Error(response.error.message || 'Request failed');
  if (response.data?.error) throw new Error(response.data.error);
  return response.data;
}

export function useTradeLocker() {
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(() => {
    return localStorage.getItem('activeBrokerConnectionId') || null;
  });
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [history, setHistory] = useState<BrokerTradeHistory[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived active connection
  const connection = connections.find(c => c.id === activeConnectionId) || null;

  // Persist active connection
  const selectConnection = useCallback((connectionId: string | null) => {
    setActiveConnectionId(connectionId);
    if (connectionId) {
      localStorage.setItem('activeBrokerConnectionId', connectionId);
    } else {
      localStorage.removeItem('activeBrokerConnectionId');
    }
    // Reset connection-specific data
    setPositions([]);
    setOrders([]);
    setHistory([]);
    setSummary(null);
  }, []);

  // Fetch all connections
  const fetchConnections = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', 'tradelocker')
        .order('created_at', { ascending: true });

      if (error) throw error;
      const conns = (data || []) as unknown as BrokerConnection[];
      setConnections(conns);

      // Auto-select if needed
      if (conns.length > 0) {
        const persisted = localStorage.getItem('activeBrokerConnectionId');
        const match = conns.find(c => c.id === persisted);
        if (!match) {
          selectConnection(conns[0].id);
        }
      } else {
        selectConnection(null);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  }, [selectConnection]);

  // Fetch accounts for active connection
  const fetchAccounts = useCallback(async () => {
    if (!activeConnectionId) {
      setAccounts([]);
      return;
    }
    try {
      const { data: accs } = await supabase
        .from('broker_accounts')
        .select('*')
        .eq('broker_connection_id', activeConnectionId);
      setAccounts((accs || []) as unknown as BrokerAccount[]);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }, [activeConnectionId]);

  // Connect
  const connect = async (email: string, password: string, server: string, environment: string) => {
    try {
      const result = await invokeTradeLocker('connect', { email, password, server, environment });
      toast.success(result.message || 'Connected!');
      await fetchConnections();
      // Select the newly created connection
      if (result.connectionId) {
        selectConnection(result.connectionId);
      }
      return result;
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    }
  };

  // Select account within a connection
  const selectAccount = async (accountId: string, accNum: number) => {
    if (!connection) return;
    try {
      await invokeTradeLocker('select-account', { connectionId: connection.id, accountId, accNum });
      toast.success('Account selected');
      await fetchConnections();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Sync
  const sync = async () => {
    if (!connection || !connection.active_account_id) return;
    setSyncing(true);
    try {
      const result = await invokeTradeLocker('sync', { connectionId: connection.id });
      toast.success(result.message || 'Synced');
      await Promise.all([fetchPositions(), fetchOrders(), fetchHistory(), fetchSummary(), fetchConnections()]);
    } catch (error: any) {
      // Suppress sync errors when session is expired - don't show toast for background syncs
      if (!error.message?.includes('expired')) {
        toast.error(error.message);
      }
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
    if (!connection) return;
    try {
      await invokeTradeLocker('close-position', { connectionId: connection.id, positionId, qty });
      toast.success('Position closed');
      await sync();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Modify position
  const modifyPosition = async (positionId: string, stopLoss?: number, takeProfit?: number) => {
    if (!connection) return;
    try {
      await invokeTradeLocker('modify-position', { connectionId: connection.id, positionId, stopLoss, takeProfit });
      toast.success('Position modified');
      await sync();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Cancel order
  const cancelOrder = async (orderId: string) => {
    if (!connection) return;
    try {
      await invokeTradeLocker('cancel-order', { connectionId: connection.id, orderId });
      toast.success('Order cancelled');
      await sync();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Modify order
  const modifyOrder = async (orderId: string, params: { stopLoss?: number; takeProfit?: number; price?: number }) => {
    if (!connection) return;
    try {
      await invokeTradeLocker('modify-order', { connectionId: connection.id, orderId, ...params });
      toast.success('Order modified');
      await sync();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Disconnect
  const disconnect = async () => {
    if (!connection) return;
    try {
      await invokeTradeLocker('disconnect', { connectionId: connection.id });
      toast.success('Disconnected');
      // Remove from local list and select another
      const remaining = connections.filter(c => c.id !== connection.id);
      setConnections(remaining);
      selectConnection(remaining[0]?.id || null);
      setAccounts([]);
      setPositions([]);
      setOrders([]);
      setHistory([]);
      setSummary(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Reconnect
  const reconnect = async (email: string, password: string) => {
    if (!connection) return;
    try {
      await invokeTradeLocker('reconnect', { connectionId: connection.id, email, password });
      toast.success('Reconnected');
      await fetchConnections();
    } catch (error: any) {
      toast.error(error.message);
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

  // Initial load
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Fetch accounts when active connection changes
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

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
        sync();
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
    syncing,
    connect,
    selectAccount,
    sync,
    disconnect,
    reconnect,
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
