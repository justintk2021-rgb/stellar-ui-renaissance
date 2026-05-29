import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trade } from '@/types/trade';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queries/keys';
import {
  fetchTradesList,
  fetchTradeDetail,
  mapDbToTrade,
  subscribeTradesRealtime,
} from '@/lib/queries/trades';

export function useTradeDetail(userId: string | undefined, tradeId: string | null) {
  return useQuery({
    queryKey: queryKeys.trades.detail(tradeId ?? ''),
    queryFn: () => fetchTradeDetail(tradeId!, userId!),
    enabled: !!userId && !!tradeId,
    staleTime: 60_000,
  });
}

export function useTrades(userId: string | undefined, accountId: string | null = null, brokerAccountId: string | null = null) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.trades.list(userId ?? '', accountId, brokerAccountId);

  const { data: trades = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchTradesList(userId!, accountId, brokerAccountId),
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!userId) return;
    return subscribeTradesRealtime(userId, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trades.all });
    });
  }, [userId, queryClient]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.trades.all });
  }, [queryClient]);

  const addTradeMutation = useMutation({
    mutationFn: async (tradeData: Omit<Trade, 'id'>) => {
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
          checklist_state: tradeData.checklistState as unknown || null,
        } as Record<string, unknown>)
        .select()
        .single();
      if (error) throw error;
      return mapDbToTrade(data as Record<string, unknown>, true);
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to add trade'),
  });

  const updateTradeMutation = useMutation({
    mutationFn: async ({ id, tradeData }: { id: string; tradeData: Partial<Trade> }) => {
      const updateData: Record<string, unknown> = {};
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
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to update trade'),
  });

  const deleteTradeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trades').delete().eq('id', id).eq('user_id', userId!);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to delete trade'),
  });

  const addTrade = useCallback(async (tradeData: Omit<Trade, 'id'>) => {
    if (!userId) return null;
    try {
      return await addTradeMutation.mutateAsync(tradeData);
    } catch {
      return null;
    }
  }, [userId, addTradeMutation]);

  const updateTrade = useCallback(async (id: string, tradeData: Partial<Trade>) => {
    if (!userId) return false;
    try {
      await updateTradeMutation.mutateAsync({ id, tradeData });
      return true;
    } catch {
      return false;
    }
  }, [userId, updateTradeMutation]);

  const deleteTrade = useCallback(async (id: string) => {
    if (!userId) return false;
    try {
      await deleteTradeMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  }, [userId, deleteTradeMutation]);

  const clearAllTrades = useCallback(async () => {
    if (!userId) return false;
    try {
      let query = supabase.from('trades').delete().eq('user_id', userId);
      if (accountId) query = query.eq('account_id', accountId);
      const { error } = await query;
      if (error) throw error;
      invalidate();
      return true;
    } catch (error) {
      console.error('Error clearing trades:', error);
      toast.error('Failed to clear trades');
      return false;
    }
  }, [userId, accountId, invalidate]);

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
      const { error } = await supabase.from('trades').insert(tradesData);
      if (error) throw error;
      invalidate();
      return true;
    } catch (error) {
      console.error('Error importing trades:', error);
      toast.error('Failed to import trades');
      return false;
    }
  }, [userId, accountId, invalidate]);

  return {
    trades,
    isLoading,
    addTrade,
    updateTrade,
    deleteTrade,
    clearAllTrades,
    importTrades,
    refetch,
  };
}

export { TRADES_FETCH_LIMIT } from '@/lib/queries/trades';
