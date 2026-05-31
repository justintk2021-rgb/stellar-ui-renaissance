import { supabase } from '@/integrations/supabase/client';

const REFRESH_SOON_MS = 5 * 60 * 1000;

/** Attempt silent TradeLocker token refresh for stale or expired connections. */
export async function repairTradeLockerSessions(): Promise<{
  attempted: number;
  restored: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { attempted: 0, restored: 0 };

  const { data: connections } = await supabase
    .from('broker_connections')
    .select('id, connection_status, token_expiry')
    .eq('user_id', user.id)
    .eq('platform', 'tradelocker')
    .in('connection_status', ['connected', 'expired']);

  if (!connections?.length) return { attempted: 0, restored: 0 };

  const now = Date.now();
  const targets = connections.filter((conn) => {
    if (conn.connection_status === 'expired') return true;
    if (!conn.token_expiry) return false;
    return new Date(conn.token_expiry).getTime() - now < REFRESH_SOON_MS;
  });

  let restored = 0;
  for (const conn of targets) {
    const { data, error } = await supabase.functions.invoke('tradelocker', {
      body: { action: 'refresh-session', connectionId: conn.id },
    });
    if (!error && !data?.error) restored += 1;
  }

  return { attempted: targets.length, restored };
}
