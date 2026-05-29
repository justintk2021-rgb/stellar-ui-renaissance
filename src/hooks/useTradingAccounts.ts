import { useEffect, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queries/keys';
import {
  fetchTradingAccounts,
  subscribeAccountsRealtime,
  type TradingAccount,
} from '@/lib/queries/accounts';

export type { TradingAccount };

export function useTradingAccounts(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(() => {
    return localStorage.getItem('selectedManualAccountId') || null;
  });

  const setSelectedAccountId = useCallback((id: string | null) => {
    setSelectedAccountIdState(id);
    if (id) {
      localStorage.setItem('selectedManualAccountId', id);
    } else {
      localStorage.removeItem('selectedManualAccountId');
    }
  }, []);

  const { data: accounts = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.accounts.list(userId ?? ''),
    queryFn: () => fetchTradingAccounts(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Auto-select account on first load
  useEffect(() => {
    if (accounts.length === 0) return;
    const persistedManual = localStorage.getItem('selectedManualAccountId');
    const persistedBroker = localStorage.getItem('selectedBrokerAccountId');

    if (persistedBroker) {
      if (!selectedAccountId) {
        const defaultAccount = accounts.find(a => a.is_default) || accounts[0];
        if (defaultAccount) setSelectedAccountId(defaultAccount.id);
      }
    } else if (!persistedManual || !accounts.find(a => a.id === persistedManual)) {
      const defaultAccount = accounts.find(a => a.is_default) || accounts[0];
      if (defaultAccount) setSelectedAccountId(defaultAccount.id);
    }
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeAccountsRealtime(userId, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    });
  }, [userId, queryClient]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
  }, [queryClient]);

  const addAccount = useCallback(async (accountData: { name: string; broker?: string; starting_balance?: number; currency?: string }) => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .insert({
          user_id: userId,
          name: accountData.name,
          broker: accountData.broker || null,
          starting_balance: accountData.starting_balance || 10000,
          currency: accountData.currency || 'USD',
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      invalidate();
      toast.success('Account created successfully');
      return {
        id: data.id,
        user_id: data.user_id,
        name: data.name,
        broker: data.broker,
        starting_balance: Number(data.starting_balance),
        goal_balance: data.goal_balance ? Number(data.goal_balance) : null,
        profit_target: data.profit_target ? Number(data.profit_target) : null,
        currency: data.currency,
        is_default: data.is_default,
        created_at: data.created_at,
        updated_at: data.updated_at,
      } as TradingAccount;
    } catch (error) {
      console.error('Error adding account:', error);
      toast.error('Failed to create account');
      return null;
    }
  }, [userId, invalidate]);

  const updateAccount = useCallback(async (id: string, accountData: Partial<TradingAccount>) => {
    if (!userId) return false;
    try {
      const updateData: Record<string, unknown> = {};
      if (accountData.name !== undefined) updateData.name = accountData.name;
      if (accountData.broker !== undefined) updateData.broker = accountData.broker;
      if (accountData.starting_balance !== undefined) updateData.starting_balance = accountData.starting_balance;
      if (accountData.goal_balance !== undefined) updateData.goal_balance = accountData.goal_balance;
      if (accountData.profit_target !== undefined) updateData.profit_target = accountData.profit_target;
      if (accountData.currency !== undefined) updateData.currency = accountData.currency;

      const { error } = await supabase.from('trading_accounts').update(updateData).eq('id', id).eq('user_id', userId);
      if (error) throw error;
      invalidate();
      toast.success('Account updated');
      return true;
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error('Failed to update account');
      return false;
    }
  }, [userId, invalidate]);

  const deleteAccount = useCallback(async (id: string) => {
    if (!userId) return false;
    try {
      const { error } = await supabase.from('trading_accounts').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      if (selectedAccountId === id) {
        const remaining = accounts.filter(a => a.id !== id);
        const defaultAcc = remaining.find(a => a.is_default) || remaining[0];
        setSelectedAccountId(defaultAcc?.id || null);
      }
      invalidate();
      toast.success('Account deleted');
      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
      return false;
    }
  }, [userId, accounts, selectedAccountId, setSelectedAccountId, invalidate]);

  const setDefaultAccount = useCallback(async (id: string) => {
    if (!userId) return false;
    try {
      await supabase.from('trading_accounts').update({ is_default: false }).eq('user_id', userId);
      const { error } = await supabase.from('trading_accounts').update({ is_default: true }).eq('id', id).eq('user_id', userId);
      if (error) throw error;
      invalidate();
      toast.success('Default account updated');
      return true;
    } catch (error) {
      console.error('Error setting default account:', error);
      toast.error('Failed to update default account');
      return false;
    }
  }, [userId, invalidate]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || null;

  return {
    accounts,
    selectedAccount,
    selectedAccountId,
    setSelectedAccountId,
    isLoading,
    addAccount,
    updateAccount,
    deleteAccount,
    setDefaultAccount,
    refetch,
  };
}
