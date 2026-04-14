import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trade } from '@/types/trade';
import { toast } from 'sonner';

export function useTrades(userId: string | undefined, accountId: string | null = null, brokerAccountId: string | null = null) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch trades from database
  const fetchTrades = useCallback(async () => {
    if (!userId) {
      setTrades([]);
      setIsLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      
      // Filter by broker account if specified
      if (brokerAccountId) {
        query = query.eq('broker_account_id', brokerAccountId).eq('imported_from_broker', true);
      } else if (accountId) {
        // Filter by manual account if specified
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedTrades: Trade[] = (data || []).map((t: any) => ({
        id: t.id,
        date: t.date,
        pair: t.pair,
        direction: t.direction as 'Long' | 'Short',
        result: Number(t.result),
        session: t.session || undefined,
        notes: t.notes || undefined,
        notebook: t.notebook || undefined,
        chartImage: t.chart_image || undefined,
        accountId: t.account_id || undefined,
        checklistId: t.checklist_id || undefined,
        checklistState: t.checklist_state || undefined,
        brokerName: t.broker_name || undefined,
        brokerEnvironment: t.broker_environment || undefined,
        brokerAccountId: t.broker_account_id || undefined,
        brokerAccNum: t.broker_acc_num || undefined,
        brokerOrderId: t.broker_order_id || undefined,
        brokerPositionId: t.broker_position_id || undefined,
        importedFromBroker: t.imported_from_broker || false,
        lastBrokerSyncAt: t.last_broker_sync_at || undefined,
        executionType: t.execution_type || undefined,
      }));

      setTrades(formattedTrades);
    } catch (error: any) {
      console.error('Error fetching trades:', error);
      toast.error('Failed to load trades');
    } finally {
      setIsLoading(false);
    }
  }, [userId, accountId, brokerAccountId]);

  // Set up realtime subscription
  useEffect(() => {
    if (!userId) return;

    // Clean up existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `trades-realtime-${userId}-${accountId || 'all'}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Trades realtime update:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            const newTrade: Trade = {
              id: payload.new.id,
              date: payload.new.date,
              pair: payload.new.pair,
              direction: payload.new.direction as 'Long' | 'Short',
              result: Number(payload.new.result),
              session: payload.new.session || undefined,
              notes: payload.new.notes || undefined,
              notebook: payload.new.notebook || undefined,
              chartImage: payload.new.chart_image || undefined,
              accountId: payload.new.account_id || undefined,
              checklistId: payload.new.checklist_id || undefined,
              checklistState: payload.new.checklist_state || undefined,
            };
            // Only add if matches current account filter
            if (!accountId || payload.new.account_id === accountId) {
              setTrades(prev => {
                if (prev.some(t => t.id === newTrade.id)) return prev;
                return [newTrade, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            setTrades(prev => prev.map(t => 
              t.id === payload.new.id ? {
                ...t,
                date: payload.new.date,
                pair: payload.new.pair,
                direction: payload.new.direction as 'Long' | 'Short',
                result: Number(payload.new.result),
                session: payload.new.session || undefined,
                notes: payload.new.notes || undefined,
                notebook: payload.new.notebook || undefined,
                chartImage: payload.new.chart_image || undefined,
                checklistId: payload.new.checklist_id || undefined,
                checklistState: payload.new.checklist_state || undefined,
              } : t
            ));
          } else if (payload.eventType === 'DELETE') {
            setTrades(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, accountId]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Add a new trade
  const addTrade = useCallback(async (tradeData: Omit<Trade, 'id'>) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('trades')
        .insert({
          user_id: userId,
          account_id: accountId,
          date: tradeData.date,
          pair: tradeData.pair,
          direction: tradeData.direction,
          result: tradeData.result,
          session: tradeData.session || null,
          notes: tradeData.notes || null,
          notebook: tradeData.notebook || null,
          chart_image: tradeData.chartImage || null,
          checklist_id: tradeData.checklistId || null,
          checklist_state: tradeData.checklistState as any || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const newTrade: Trade = {
        id: data.id,
        date: data.date,
        pair: data.pair,
        direction: data.direction as 'Long' | 'Short',
        result: Number(data.result),
        session: data.session || undefined,
        notes: data.notes || undefined,
        notebook: data.notebook || undefined,
        chartImage: data.chart_image || undefined,
        accountId: data.account_id || undefined,
        checklistId: (data as any).checklist_id || undefined,
        checklistState: (data as any).checklist_state || undefined,
      };

      setTrades(prev => [newTrade, ...prev]);
      return newTrade;
    } catch (error: any) {
      console.error('Error adding trade:', error);
      toast.error('Failed to add trade');
      return null;
    }
  }, [userId, accountId]);

  // Update an existing trade
  const updateTrade = useCallback(async (id: string, tradeData: Partial<Trade>) => {
    if (!userId) return false;

    try {
      const updateData: Record<string, any> = {};
      if (tradeData.date !== undefined) updateData.date = tradeData.date;
      if (tradeData.pair !== undefined) updateData.pair = tradeData.pair;
      if (tradeData.direction !== undefined) updateData.direction = tradeData.direction;
      if (tradeData.result !== undefined) updateData.result = tradeData.result;
      if (tradeData.session !== undefined) updateData.session = tradeData.session || null;
      if (tradeData.notes !== undefined) updateData.notes = tradeData.notes || null;
      if (tradeData.notebook !== undefined) updateData.notebook = tradeData.notebook || null;
      if (tradeData.chartImage !== undefined) updateData.chart_image = tradeData.chartImage || null;
      if (tradeData.checklistId !== undefined) updateData.checklist_id = tradeData.checklistId || null;
      if (tradeData.checklistState !== undefined) updateData.checklist_state = tradeData.checklistState || null;

      const { error } = await supabase
        .from('trades')
        .update(updateData as any)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      setTrades(prev => prev.map(t => 
        t.id === id ? { ...t, ...tradeData } : t
      ));
      return true;
    } catch (error: any) {
      console.error('Error updating trade:', error);
      toast.error('Failed to update trade');
      return false;
    }
  }, [userId]);

  // Delete a trade
  const deleteTrade = useCallback(async (id: string) => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      setTrades(prev => prev.filter(t => t.id !== id));
      return true;
    } catch (error: any) {
      console.error('Error deleting trade:', error);
      toast.error('Failed to delete trade');
      return false;
    }
  }, [userId]);

  // Clear all trades for the current account
  const clearAllTrades = useCallback(async () => {
    if (!userId) return false;

    try {
      let query = supabase
        .from('trades')
        .delete()
        .eq('user_id', userId);
      
      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { error } = await query;

      if (error) throw error;

      setTrades([]);
      return true;
    } catch (error: any) {
      console.error('Error clearing trades:', error);
      toast.error('Failed to clear trades');
      return false;
    }
  }, [userId, accountId]);

  // Import trades (for broker sync)
  const importTrades = useCallback(async (importedTrades: Omit<Trade, 'id'>[]) => {
    if (!userId || importedTrades.length === 0) return false;

    try {
      const tradesData = importedTrades.map(t => ({
        user_id: userId,
        account_id: accountId,
        date: t.date,
        pair: t.pair,
        direction: t.direction,
        result: t.result,
        session: t.session || null,
        notes: t.notes || null,
        notebook: t.notebook || null,
        chart_image: t.chartImage || null,
      }));

      const { data, error } = await supabase
        .from('trades')
        .insert(tradesData)
        .select();

      if (error) throw error;

      const newTrades: Trade[] = (data || []).map(t => ({
        id: t.id,
        date: t.date,
        pair: t.pair,
        direction: t.direction as 'Long' | 'Short',
        result: Number(t.result),
        session: t.session || undefined,
        strategy: t.strategy || undefined,
        notes: t.notes || undefined,
        notebook: t.notebook || undefined,
        chartImage: t.chart_image || undefined,
        accountId: t.account_id || undefined,
      }));

      setTrades(prev => [...newTrades, ...prev]);
      return true;
    } catch (error: any) {
      console.error('Error importing trades:', error);
      toast.error('Failed to import trades');
      return false;
    }
  }, [userId, accountId]);

  return {
    trades,
    isLoading,
    addTrade,
    updateTrade,
    deleteTrade,
    clearAllTrades,
    importTrades,
    refetch: fetchTrades,
  };
}
