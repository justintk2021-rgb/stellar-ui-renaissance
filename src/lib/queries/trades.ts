import { supabase } from '@/integrations/supabase/client';
import { Trade } from '@/types/trade';
import { acquireSharedPostgresChannel } from '@/lib/queries/realtimeChannel';

export const TRADES_FETCH_LIMIT = 1000;

/** Slim column list — excludes chart_image, notebook, checklist_state for list fetches */
export const TRADE_LIST_SELECT =
  'id, date, pair, direction, result, session, notes, account_id, checklist_id, broker_name, broker_environment, broker_account_id, broker_acc_num, broker_order_id, broker_position_id, imported_from_broker, last_broker_sync_at, execution_type, swap, commission, open_price, close_price, open_time, close_time';

export const TRADE_DETAIL_SELECT = '*';

export function mapDbToTrade(t: Record<string, unknown>, includeHeavy = false): Trade {
  const trade: Trade = {
    id: t.id as string,
    date: t.date as string,
    pair: t.pair as string,
    direction: t.direction as 'Long' | 'Short',
    result: Number(t.result),
    session: (t.session as string) || undefined,
    notes: (t.notes as string) || undefined,
    accountId: (t.account_id as string) || undefined,
    checklistId: (t.checklist_id as string) || undefined,
    brokerName: (t.broker_name as string) || undefined,
    brokerEnvironment: (t.broker_environment as string) || undefined,
    brokerAccountId: (t.broker_account_id as string) || undefined,
    brokerAccNum: t.broker_acc_num != null ? Number(t.broker_acc_num) : undefined,
    brokerOrderId: (t.broker_order_id as string) || undefined,
    brokerPositionId: (t.broker_position_id as string) || undefined,
    importedFromBroker: (t.imported_from_broker as boolean) || false,
    lastBrokerSyncAt: (t.last_broker_sync_at as string) || undefined,
    executionType: (t.execution_type as string) || undefined,
    swap: t.swap != null ? Number(t.swap) : undefined,
    commission: t.commission != null ? Number(t.commission) : undefined,
    openPrice: t.open_price != null ? Number(t.open_price) : undefined,
    closePrice: t.close_price != null ? Number(t.close_price) : undefined,
    openTime: (t.open_time as string) || undefined,
    closeTime: (t.close_time as string) || undefined,
  };

  if (includeHeavy) {
    trade.notebook = (t.notebook as string) || undefined;
    trade.chartImage = (t.chart_image as string) || undefined;
    trade.checklistState = (t.checklist_state as Trade['checklistState']) || undefined;
  }

  return trade;
}

export async function fetchTradesList(
  userId: string,
  accountId: string | null,
  brokerAccountId: string | null
): Promise<Trade[]> {
  let query = supabase
    .from('trades')
    .select(TRADE_LIST_SELECT)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(TRADES_FETCH_LIMIT);

  if (brokerAccountId) {
    query = query.eq('broker_account_id', brokerAccountId).eq('imported_from_broker', true);
  } else if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((t) => mapDbToTrade(t as Record<string, unknown>));
}

export async function fetchTradeDetail(tradeId: string, userId: string): Promise<Trade | null> {
  const { data, error } = await supabase
    .from('trades')
    .select(TRADE_DETAIL_SELECT)
    .eq('id', tradeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapDbToTrade(data as Record<string, unknown>, true);
}

export function subscribeTradesRealtime(
  userId: string,
  onInvalidate: () => void
) {
  return acquireSharedPostgresChannel(
    `trades-realtime-${userId}`,
    [{
      event: '*',
      schema: 'public',
      table: 'trades',
      filter: `user_id=eq.${userId}`,
    }],
    onInvalidate,
  );
}
