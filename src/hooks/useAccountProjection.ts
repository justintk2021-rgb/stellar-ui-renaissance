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
  parseDepositFromAccountName,
  resolveBrokerStartBalance,
} from '@/lib/accountProjection';

export interface BrokerAccountProjection {
  id: string;
  accountName: string | null;
  brokerName: string | null;
  starting_balance: number | null;
  deposit_balance: number | null;
  goal_balance: number | null;
  profit_target: number | null;
}

function brokerProjectionStorageKey(accountExternalId: string) {
  return `nsync-broker-projection-${accountExternalId}`;
}

type LocalBrokerProjection = Partial<
  Pick<BrokerAccountProjection, 'starting_balance' | 'deposit_balance' | 'goal_balance' | 'profit_target'>
>;

function readLocalBrokerProjection(accountExternalId: string) {
  try {
    const raw = localStorage.getItem(brokerProjectionStorageKey(accountExternalId));
    return raw ? JSON.parse(raw) as LocalBrokerProjection : {};
  } catch {
    return {};
  }
}

function writeLocalBrokerProjection(
  accountExternalId: string,
  patch: LocalBrokerProjection,
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
    .select('id, account_name, starting_balance, deposit_balance, goal_balance, profit_target, broker_connection_id')
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
      deposit_balance: local.deposit_balance ?? null,
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
    deposit_balance: row.deposit_balance != null ? Number(row.deposit_balance) : (local.deposit_balance ?? null),
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
  brokerRealizedPnL = 0,
  brokerDayTotals = null,
  brokerHistoryReady = false,
  updateManualAccount,
}: {
  userId: string | undefined;
  trades: Trade[];
  manualAccount: TradingAccount | null;
  selectedAccountId: string | null;
  brokerAccountExternalId: string | null;
  brokerBalance: number | null;
  brokerEquity: number | null;
  /** Closed-trade realized P&L from broker_trade_history for this account. */
  brokerRealizedPnL?: number;
  brokerDayTotals?: Map<string, number> | null;
  brokerHistoryReady?: boolean;
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
      const deposit =
        brokerProjection?.deposit_balance
        ?? parseDepositFromAccountName(brokerProjection?.accountName)
        ?? brokerProjection?.starting_balance;
      return resolveBrokerStartBalance(deposit, brokerBalance, brokerRealizedPnL);
    }
    return deriveStartBalance(manualAccount?.starting_balance, null, netPnL);
  }, [
    isBroker,
    brokerProjection?.deposit_balance,
    brokerProjection?.accountName,
    brokerProjection?.starting_balance,
    brokerBalance,
    brokerRealizedPnL,
    netPnL,
    manualAccount?.starting_balance,
  ]);

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
      dailyPnL: isBroker ? brokerDayTotals : null,
    }),
    [trades, startBalance, currentBalance, goalBalance, profitTarget, isBroker, brokerDayTotals],
  );

  const invalidateBroker = useCallback(() => {
    if (brokerAccountExternalId) {
      queryClient.invalidateQueries({ queryKey: ['broker-projection', brokerAccountExternalId] });
    }
  }, [queryClient, brokerAccountExternalId]);

  useEffect(() => {
    if (!isBroker || !brokerProjection?.id || !brokerAccountExternalId) return;
    if (brokerProjection.deposit_balance != null && brokerProjection.deposit_balance > 0) return;
    const fromName = parseDepositFromAccountName(brokerProjection.accountName);
    const storedStart = brokerProjection.starting_balance != null && brokerProjection.starting_balance > 0
      ? brokerProjection.starting_balance
      : null;
    const deposit = fromName ?? storedStart;
    if (deposit == null) return;
    let cancelled = false;
    supabase
      .from('broker_accounts')
      .update({ deposit_balance: deposit })
      .eq('id', brokerProjection.id)
      .then(({ error }) => {
        if (cancelled || error) return;
        invalidateBroker();
      });
    return () => {
      cancelled = true;
    };
  }, [
    isBroker,
    brokerProjection?.id,
    brokerProjection?.deposit_balance,
    brokerProjection?.accountName,
    brokerProjection?.starting_balance,
    brokerAccountExternalId,
    invalidateBroker,
  ]);

  const setGoalBalance = useCallback(async (value: number) => {
    if (isBroker) {
      if (!brokerProjection?.id || !brokerAccountExternalId) {
        toast.error('Broker account not loaded yet');
        return false;
      }
      const { error } = await supabase
        .from('broker_accounts')
        .update({ goal_balance: value })
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

  const setStartingBalance = useCallback(async (value: number) => {
    if (isBroker) {
      if (!brokerProjection?.id || !brokerAccountExternalId) {
        toast.error('Broker account not loaded yet');
        return false;
      }
      const { error } = await supabase
        .from('broker_accounts')
        .update({ starting_balance: value, deposit_balance: value })
        .eq('id', brokerProjection.id);
      if (error) {
        await supabase
          .from('broker_accounts')
          .update({ starting_balance: value })
          .eq('id', brokerProjection.id);
        writeLocalBrokerProjection(brokerAccountExternalId, {
          starting_balance: value,
          deposit_balance: value,
        });
        invalidateBroker();
        return true;
      }
      writeLocalBrokerProjection(brokerAccountExternalId, {
        starting_balance: value,
        deposit_balance: value,
      });
      invalidateBroker();
      return true;
    }
    if (!selectedAccountId) {
      toast.error('Select an account to set a starting balance');
      return false;
    }
    return updateManualAccount(selectedAccountId, { starting_balance: value });
  }, [isBroker, brokerProjection?.id, brokerAccountExternalId, selectedAccountId, updateManualAccount, invalidateBroker]);

  const setProfitTarget = useCallback(async (value: number) => {
    if (isBroker) {
      if (!brokerProjection?.id || !brokerAccountExternalId) {
        toast.error('Broker account not loaded yet');
        return false;
      }
      const { error } = await supabase
        .from('broker_accounts')
        .update({ profit_target: value })
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
    isLoading: isBroker && (brokerLoading || brokerBalance == null || !brokerHistoryReady),
    accountLabel,
    accountSubtitle,
    startBalance,
    currentBalance,
    goalBalance,
    profitTarget,
    metrics,
    setGoalBalance,
    setProfitTarget,
    setStartingBalance,
  };
}
