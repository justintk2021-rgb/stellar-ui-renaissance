import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trade } from '@/types/trade';
import { TradingAccount } from '@/lib/queries/accounts';
import {
  computeNetPnL,
  computeProjectionMetrics,
  deriveStartBalance,
} from '@/lib/accountProjection';

export interface BrokerAccountProjection {
  id: string;
  accountName: string | null;
  brokerName: string | null;
  starting_balance: number | null;
  goal_balance: number | null;
  profit_target: number | null;
}

function brokerProjectionStorageKey(accountExternalId: string) {
  return `nsync-broker-projection-${accountExternalId}`;
}

function readLocalBrokerProjection(accountExternalId: string) {
  try {
    const raw = localStorage.getItem(brokerProjectionStorageKey(accountExternalId));
    return raw ? JSON.parse(raw) as Partial<Pick<BrokerAccountProjection, 'starting_balance' | 'goal_balance' | 'profit_target'>> : {};
  } catch {
    return {};
  }
}

function writeLocalBrokerProjection(
  accountExternalId: string,
  patch: Partial<Pick<BrokerAccountProjection, 'starting_balance' | 'goal_balance' | 'profit_target'>>,
) {
  const current = readLocalBrokerProjection(accountExternalId);
  localStorage.setItem(
    brokerProjectionStorageKey(accountExternalId),
    JSON.stringify({ ...current, ...patch }),
  );
}

async function fetchBrokerProjection(accountExternalId: string): Promise<BrokerAccountProjection | null> {
  const { data, error } = await supabase
    .from('broker_accounts')
    .select('id, account_name, starting_balance, goal_balance, profit_target, broker_connection_id')
    .eq('account_id_external', accountExternalId)
    .maybeSingle();

  const local = readLocalBrokerProjection(accountExternalId);

  if (error) {
    const { data: basic, error: basicError } = await supabase
      .from('broker_accounts')
      .select('id, account_name, broker_connection_id')
      .eq('account_id_external', accountExternalId)
      .maybeSingle();
    if (basicError || !basic) throw basicError ?? error;

    let brokerName: string | null = null;
    if (basic.broker_connection_id) {
      const { data: conn } = await supabase
        .from('broker_connections')
        .select('broker_name')
        .eq('id', basic.broker_connection_id)
        .maybeSingle();
      brokerName = conn?.broker_name ?? null;
    }

    return {
      id: basic.id as string,
      accountName: basic.account_name as string | null,
      brokerName,
      starting_balance: local.starting_balance ?? null,
      goal_balance: local.goal_balance ?? null,
      profit_target: local.profit_target ?? null,
    };
  }

  if (!data) return null;

  let brokerName: string | null = null;
  if (data.broker_connection_id) {
    const { data: conn } = await supabase
      .from('broker_connections')
      .select('broker_name')
      .eq('id', data.broker_connection_id)
      .maybeSingle();
    brokerName = conn?.broker_name ?? null;
  }

  const row = data as Record<string, unknown>;
  return {
    id: data.id as string,
    accountName: data.account_name as string | null,
    brokerName,
    starting_balance: row.starting_balance != null ? Number(row.starting_balance) : (local.starting_balance ?? null),
    goal_balance: row.goal_balance != null ? Number(row.goal_balance) : (local.goal_balance ?? null),
    profit_target: row.profit_target != null ? Number(row.profit_target) : (local.profit_target ?? null),
  };
}

export function useAccountProjection({
  userId,
  trades,
  manualAccount,
  selectedAccountId,
  brokerAccountExternalId,
  brokerBalance,
  brokerEquity,
  updateManualAccount,
}: {
  userId: string | undefined;
  trades: Trade[];
  manualAccount: TradingAccount | null;
  selectedAccountId: string | null;
  brokerAccountExternalId: string | null;
  brokerBalance: number | null;
  brokerEquity: number | null;
  updateManualAccount: (id: string, data: Partial<TradingAccount>) => Promise<boolean>;
}) {
  const queryClient = useQueryClient();
  const isBroker = !!brokerAccountExternalId;

  const { data: brokerProjection, isLoading: brokerLoading } = useQuery({
    queryKey: ['broker-projection', brokerAccountExternalId ?? ''],
    queryFn: () => fetchBrokerProjection(brokerAccountExternalId!),
    enabled: isBroker && !!brokerAccountExternalId,
    staleTime: 30_000,
  });

  const netPnL = useMemo(() => computeNetPnL(trades), [trades]);

  const accountLabel = isBroker
    ? brokerProjection?.accountName || 'Broker account'
    : manualAccount?.name || 'Manual account';

  const accountSubtitle = isBroker
    ? brokerProjection?.brokerName || 'Connected broker'
    : manualAccount?.broker || 'Manual journal account';

  const startBalance = useMemo(() => {
    if (isBroker) {
      // Broker profit targets must be based on live account balance vs the
      // account's starting balance. Do not back into the start from trade P&L.
      return deriveStartBalance(brokerProjection?.starting_balance, null, 0);
    }
    return deriveStartBalance(manualAccount?.starting_balance, null, netPnL);
  }, [isBroker, brokerProjection?.starting_balance, netPnL, manualAccount?.starting_balance]);

  const currentBalance = useMemo(() => {
    if (isBroker) {
      // The projection card is balance-based; equity/floating P&L belongs in
      // the separate Equity card.
      if (brokerBalance != null) return brokerBalance;
    }
    return startBalance + netPnL;
  }, [isBroker, brokerBalance, startBalance, netPnL]);

  const goalBalance = isBroker ? (brokerProjection?.goal_balance ?? null) : (manualAccount?.goal_balance ?? null);
  const profitTarget = isBroker ? (brokerProjection?.profit_target ?? null) : (manualAccount?.profit_target ?? null);

  const metrics = useMemo(
    () => computeProjectionMetrics({
      trades,
      startBalance,
      currentBalance,
      goalBalance,
      profitTarget,
    }),
    [trades, startBalance, currentBalance, goalBalance, profitTarget],
  );

  const invalidateBroker = useCallback(() => {
    if (brokerAccountExternalId) {
      queryClient.invalidateQueries({ queryKey: ['broker-projection', brokerAccountExternalId] });
    }
  }, [queryClient, brokerAccountExternalId]);

  const setGoalBalance = useCallback(async (value: number) => {
    if (isBroker) {
      if (!brokerProjection?.id || !brokerAccountExternalId) {
        toast.error('Broker account not loaded yet');
        return false;
      }
      const { error } = await supabase
        .from('broker_accounts')
        .update({ goal_balance: value } as Record<string, unknown>)
        .eq('id', brokerProjection.id);
      if (error) {
        writeLocalBrokerProjection(brokerAccountExternalId, { goal_balance: value });
        invalidateBroker();
        return true;
      }
      writeLocalBrokerProjection(brokerAccountExternalId, { goal_balance: value });
      invalidateBroker();
      return true;
    }
    if (!selectedAccountId) {
      toast.error('Select a manual account to set a goal');
      return false;
    }
    return updateManualAccount(selectedAccountId, { goal_balance: value });
  }, [isBroker, brokerProjection?.id, brokerAccountExternalId, selectedAccountId, updateManualAccount, invalidateBroker]);

  const setProfitTarget = useCallback(async (value: number) => {
    if (isBroker) {
      if (!brokerProjection?.id || !brokerAccountExternalId) {
        toast.error('Broker account not loaded yet');
        return false;
      }
      const { error } = await supabase
        .from('broker_accounts')
        .update({ profit_target: value } as Record<string, unknown>)
        .eq('id', brokerProjection.id);
      if (error) {
        writeLocalBrokerProjection(brokerAccountExternalId, { profit_target: value });
        invalidateBroker();
        return true;
      }
      writeLocalBrokerProjection(brokerAccountExternalId, { profit_target: value });
      invalidateBroker();
      return true;
    }
    if (!selectedAccountId) {
      toast.error('Select an account to set a profit target');
      return false;
    }
    return updateManualAccount(selectedAccountId, { profit_target: value });
  }, [isBroker, brokerProjection?.id, brokerAccountExternalId, selectedAccountId, updateManualAccount, invalidateBroker]);

  return {
    isBroker,
    isLoading: isBroker && brokerLoading,
    accountLabel,
    accountSubtitle,
    startBalance,
    currentBalance,
    goalBalance,
    profitTarget,
    metrics,
    setGoalBalance,
    setProfitTarget,
  };
}
