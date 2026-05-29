import { supabase } from '@/integrations/supabase/client';
import type { BrokerPosition } from '@/types/broker';
import { acquireSharedPostgresChannel } from '@/lib/queries/realtimeChannel';

export async function fetchBrokerPositions(connectionId: string): Promise<BrokerPosition[]> {
  const { data, error } = await supabase
    .from('broker_positions')
    .select('*')
    .eq('broker_connection_id', connectionId)
    .is('closed_at', null);

  if (error) throw error;

  return (data || []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    broker_connection_id: p.broker_connection_id as string,
    position_id: p.position_id as string,
    symbol: p.symbol as string,
    type: p.type as string,
    side: (p.side as string) || null,
    volume: Number(p.volume),
    open_price: Number(p.open_price),
    current_price: p.current_price != null ? Number(p.current_price) : null,
    stop_loss: p.stop_loss != null ? Number(p.stop_loss) : null,
    take_profit: p.take_profit != null ? Number(p.take_profit) : null,
    floating_pl: Number(p.floating_pl),
    open_time: p.open_time as string,
  }));
}

export function subscribeBrokerPositionsRealtime(connectionId: string | null, onInvalidate: () => void) {
  if (!connectionId) return () => {};

  return acquireSharedPostgresChannel(
    `broker-positions-${connectionId}`,
    [
      { event: '*', schema: 'public', table: 'broker_positions' },
      { event: '*', schema: 'public', table: 'broker_connections' },
    ],
    onInvalidate,
  );
}

export function getActiveBrokerConnectionId(): string | null {
  return localStorage.getItem('activeBrokerConnectionId');
}

export function subscribeBrokerOrdersRealtime(connectionId: string, onInvalidate: () => void) {
  return acquireSharedPostgresChannel(
    `broker-orders-${connectionId}`,
    [{
      event: '*',
      schema: 'public',
      table: 'broker_orders',
    }],
    onInvalidate,
  );
}
