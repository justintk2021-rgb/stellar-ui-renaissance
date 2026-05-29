import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrokerPosition } from '@/types/broker';
import { queryKeys } from '@/lib/queries/keys';
import {
  fetchBrokerPositions,
  getActiveBrokerConnectionId,
  subscribeBrokerPositionsRealtime,
} from '@/lib/queries/broker';

/** Shared broker positions query — replaces duplicate fetches in StatsGrid, DashboardStatsLayout, RecentTrades */
export function useBrokerPositions(connectionId: string | null) {
  const queryClient = useQueryClient();

  const { data: positions = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.broker.positions(connectionId ?? ''),
    queryFn: () => fetchBrokerPositions(connectionId!),
    enabled: !!connectionId,
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (!connectionId) return;
    return subscribeBrokerPositionsRealtime(connectionId, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.broker.positions(connectionId) });
    });
  }, [connectionId, queryClient]);

  return { positions, isLoading, refetch };
}
/** Tracks activeBrokerConnectionId from localStorage with cross-tab sync */
export function useActiveBrokerConnectionId() {
  const [connectionId, setConnectionId] = useState<string | null>(() => getActiveBrokerConnectionId());

  useEffect(() => {
    const sync = () => setConnectionId(getActiveBrokerConnectionId());
    window.addEventListener('storage', sync);
    const interval = setInterval(sync, 5000);
    return () => {
      window.removeEventListener('storage', sync);
      clearInterval(interval);
    };
  }, []);

  return connectionId;
}

export function sumFloatingPl(positions: BrokerPosition[]): number {
  return positions.reduce((sum, p) => sum + (p.floating_pl || 0), 0);
}
