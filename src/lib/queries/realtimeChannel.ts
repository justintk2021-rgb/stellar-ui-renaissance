import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Listener = () => void;

interface ChannelState {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
}

const sharedChannels = new Map<string, ChannelState>();

/** Outer ref-count: multiple React hooks share one inner channel */
const acquireRefCounts = new Map<string, number>();
const acquireListeners = new Map<string, Set<Listener>>();
const acquireUnsubscribes = new Map<string, () => void>();

export type PostgresChangeBinding = {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  filter?: string;
};

function realtimeTopic(channelKey: string) {
  return `realtime:${channelKey}`;
}

function removeOrphanedChannel(channelKey: string) {
  const topic = realtimeTopic(channelKey);
  for (const ch of supabase.getChannels()) {
    if (ch.topic === topic) {
      supabase.removeChannel(ch);
    }
  }
}

function createSharedChannel(
  channelKey: string,
  bindings: PostgresChangeBinding[],
  listeners: Set<Listener>,
): RealtimeChannel {
  removeOrphanedChannel(channelKey);

  let builder = supabase.channel(channelKey);
  for (const binding of bindings) {
    builder = builder.on('postgres_changes', binding, () => {
      listeners.forEach((listener) => listener());
    });
  }
  return builder.subscribe();
}

/** Low-level shared channel — one Supabase channel, many listeners in one registry entry */
function subscribeSharedPostgresChannel(
  channelKey: string,
  bindings: PostgresChangeBinding[],
  onInvalidate: Listener,
): () => void {
  let state = sharedChannels.get(channelKey);

  if (!state) {
    const listeners = new Set<Listener>();
    state = { channel: null as unknown as RealtimeChannel, listeners };
    sharedChannels.set(channelKey, state);
    state.channel = createSharedChannel(channelKey, bindings, listeners);
  }

  state.listeners.add(onInvalidate);

  return () => {
    const current = sharedChannels.get(channelKey);
    if (!current) return;

    current.listeners.delete(onInvalidate);
    if (current.listeners.size === 0) {
      supabase.removeChannel(current.channel);
      sharedChannels.delete(channelKey);
    }
  };
}

/**
 * Hook-safe subscription — multiple components can call this for the same channelKey.
 * Each gets its own invalidate callback; only one Supabase channel is created.
 */
export function acquireSharedPostgresChannel(
  channelKey: string,
  bindings: PostgresChangeBinding[],
  onInvalidate: Listener,
): () => void {
  let listeners = acquireListeners.get(channelKey);

  if (!listeners) {
    listeners = new Set<Listener>();
    acquireListeners.set(channelKey, listeners);
    acquireUnsubscribes.set(
      channelKey,
      subscribeSharedPostgresChannel(channelKey, bindings, () => {
        acquireListeners.get(channelKey)?.forEach((listener) => listener());
      }),
    );
  }

  listeners.add(onInvalidate);
  acquireRefCounts.set(channelKey, (acquireRefCounts.get(channelKey) ?? 0) + 1);

  return () => {
    const set = acquireListeners.get(channelKey);
    set?.delete(onInvalidate);

    const next = (acquireRefCounts.get(channelKey) ?? 1) - 1;
    if (next <= 0) {
      acquireRefCounts.delete(channelKey);
      acquireListeners.delete(channelKey);
      acquireUnsubscribes.get(channelKey)?.();
      acquireUnsubscribes.delete(channelKey);
    } else {
      acquireRefCounts.set(channelKey, next);
    }
  };
}
