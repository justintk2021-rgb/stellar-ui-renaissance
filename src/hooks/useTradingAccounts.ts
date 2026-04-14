import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TradingAccount {
  id: string;
  user_id: string;
  name: string;
  broker: string | null;
  starting_balance: number;
  goal_balance: number | null;
  profit_target: number | null;
  currency: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useTradingAccounts(userId: string | undefined) {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch accounts from database
  const fetchAccounts = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch all accounts
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedAccounts: TradingAccount[] = (data || []).map((a: any) => ({
        id: a.id,
        user_id: a.user_id,
        name: a.name,
        broker: a.broker,
        starting_balance: Number(a.starting_balance),
        goal_balance: a.goal_balance ? Number(a.goal_balance) : null,
        profit_target: a.profit_target ? Number(a.profit_target) : null,
        currency: a.currency,
        is_default: a.is_default,
        created_at: a.created_at,
        updated_at: a.updated_at,
      }));

      setAccounts(formattedAccounts);
      
      // Set selected account to default or first account
      if (!selectedAccountId || !formattedAccounts.find(a => a.id === selectedAccountId)) {
        const defaultAccount = formattedAccounts.find(a => a.is_default) || formattedAccounts[0];
        if (defaultAccount) {
          setSelectedAccountId(defaultAccount.id);
        }
      }
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load trading accounts');
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedAccountId]);

  // Set up realtime subscription
  useEffect(() => {
    if (!userId) return;

    // Clean up existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `accounts-realtime-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trading_accounts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Accounts realtime update:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            const newAccount: TradingAccount = {
              id: payload.new.id,
              user_id: payload.new.user_id,
              name: payload.new.name,
              broker: payload.new.broker,
              starting_balance: Number(payload.new.starting_balance),
              goal_balance: payload.new.goal_balance ? Number(payload.new.goal_balance) : null,
              profit_target: payload.new.profit_target ? Number(payload.new.profit_target) : null,
              currency: payload.new.currency,
              is_default: payload.new.is_default,
              created_at: payload.new.created_at,
              updated_at: payload.new.updated_at,
            };
            setAccounts(prev => {
              if (prev.some(a => a.id === newAccount.id)) return prev;
              return [...prev, newAccount];
            });
          } else if (payload.eventType === 'UPDATE') {
            setAccounts(prev => prev.map(a => 
              a.id === payload.new.id ? {
                ...a,
                name: payload.new.name,
                broker: payload.new.broker,
                starting_balance: Number(payload.new.starting_balance),
                goal_balance: payload.new.goal_balance ? Number(payload.new.goal_balance) : null,
                profit_target: payload.new.profit_target ? Number(payload.new.profit_target) : null,
                currency: payload.new.currency,
                is_default: payload.new.is_default,
                updated_at: payload.new.updated_at,
              } : a
            ));
          } else if (payload.eventType === 'DELETE') {
            setAccounts(prev => prev.filter(a => a.id !== payload.old.id));
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
  }, [userId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Add a new account
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

      const newAccount: TradingAccount = {
        id: data.id,
        user_id: data.user_id,
        name: data.name,
        broker: data.broker,
        starting_balance: Number(data.starting_balance),
        goal_balance: (data as any).goal_balance ? Number((data as any).goal_balance) : null,
        currency: data.currency,
        is_default: data.is_default,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setAccounts(prev => [...prev, newAccount]);
      toast.success('Account created successfully');
      return newAccount;
    } catch (error: any) {
      console.error('Error adding account:', error);
      toast.error('Failed to create account');
      return null;
    }
  }, [userId]);

  // Update an account
  const updateAccount = useCallback(async (id: string, accountData: Partial<TradingAccount>) => {
    if (!userId) return false;

    try {
      const updateData: Record<string, any> = {};
      if (accountData.name !== undefined) updateData.name = accountData.name;
      if (accountData.broker !== undefined) updateData.broker = accountData.broker;
      if (accountData.starting_balance !== undefined) updateData.starting_balance = accountData.starting_balance;
      if (accountData.goal_balance !== undefined) updateData.goal_balance = accountData.goal_balance;
      if (accountData.profit_target !== undefined) updateData.profit_target = accountData.profit_target;
      if (accountData.currency !== undefined) updateData.currency = accountData.currency;

      const { error } = await supabase
        .from('trading_accounts')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      setAccounts(prev => prev.map(a => 
        a.id === id ? { ...a, ...accountData } : a
      ));
      toast.success('Account updated');
      return true;
    } catch (error: any) {
      console.error('Error updating account:', error);
      toast.error('Failed to update account');
      return false;
    }
  }, [userId]);

  // Delete an account
  const deleteAccount = useCallback(async (id: string) => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      setAccounts(prev => prev.filter(a => a.id !== id));
      
      // If deleted account was selected, select another
      if (selectedAccountId === id) {
        const remaining = accounts.filter(a => a.id !== id);
        const defaultAcc = remaining.find(a => a.is_default) || remaining[0];
        setSelectedAccountId(defaultAcc?.id || null);
      }
      
      toast.success('Account deleted');
      return true;
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
      return false;
    }
  }, [userId, accounts, selectedAccountId]);

  // Set default account
  const setDefaultAccount = useCallback(async (id: string) => {
    if (!userId) return false;

    try {
      // First, unset all defaults
      await supabase
        .from('trading_accounts')
        .update({ is_default: false })
        .eq('user_id', userId);

      // Then set the new default
      const { error } = await supabase
        .from('trading_accounts')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      setAccounts(prev => prev.map(a => ({
        ...a,
        is_default: a.id === id
      })));
      
      toast.success('Default account updated');
      return true;
    } catch (error: any) {
      console.error('Error setting default account:', error);
      toast.error('Failed to update default account');
      return false;
    }
  }, [userId]);

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
    refetch: fetchAccounts,
  };
}
