import { supabase } from '@/integrations/supabase/client';
import { acquireSharedPostgresChannel } from '@/lib/queries/realtimeChannel';

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

export function mapDbToAccount(a: Record<string, unknown>): TradingAccount {
  return {
    id: a.id as string,
    user_id: a.user_id as string,
    name: a.name as string,
    broker: a.broker as string | null,
    starting_balance: Number(a.starting_balance),
    goal_balance: a.goal_balance ? Number(a.goal_balance) : null,
    profit_target: a.profit_target ? Number(a.profit_target) : null,
    currency: a.currency as string,
    is_default: a.is_default as boolean,
    created_at: a.created_at as string,
    updated_at: a.updated_at as string,
  };
}

export async function fetchTradingAccounts(userId: string): Promise<TradingAccount[]> {
  const { data, error } = await supabase
    .from('trading_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((a) => mapDbToAccount(a as Record<string, unknown>));
}

export function subscribeAccountsRealtime(userId: string, onInvalidate: () => void) {
  return acquireSharedPostgresChannel(
    `accounts-realtime-${userId}`,
    [{
      event: '*',
      schema: 'public',
      table: 'trading_accounts',
      filter: `user_id=eq.${userId}`,
    }],
    onInvalidate,
  );
}
