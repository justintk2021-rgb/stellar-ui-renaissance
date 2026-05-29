import { acquireSharedPostgresChannel } from '@/lib/queries/realtimeChannel';

export function subscribeChecklistsRealtime(userId: string, onInvalidate: () => void) {
  return acquireSharedPostgresChannel(
    `checklists-realtime-${userId}`,
    [{
      event: '*',
      schema: 'public',
      table: 'checklists',
      filter: `user_id=eq.${userId}`,
    }],
    onInvalidate,
  );
}
