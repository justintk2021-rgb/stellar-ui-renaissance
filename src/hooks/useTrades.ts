import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trade } from '@/types/trade';
import { toast } from 'sonner';

export function useTrades(userId: string | undefined, accountId: string | null = null) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      
      // Filter by account if specified
      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedTrades: Trade[] = (data || []).map((t) => ({
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
        checklistId: (t as any).checklist_id || undefined,
      }));

      setTrades(formattedTrades);
    } catch (error: any) {
      console.error('Error fetching trades:', error);
      toast.error('Failed to load trades');
    } finally {
      setIsLoading(false);
    }
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
        })
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

      const { error } = await supabase
        .from('trades')
        .update(updateData)
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
