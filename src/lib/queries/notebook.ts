import { supabase } from '@/integrations/supabase/client';
import { NotebookEntry } from '@/types/trade';
import { acquireSharedPostgresChannel } from '@/lib/queries/realtimeChannel';

interface DbNotebookEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  date: string;
  trade_id: string | null;
  folder_id: string | null;
  folder_color: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapDbToEntry(db: DbNotebookEntry): NotebookEntry {
  return {
    id: db.id,
    title: db.title,
    content: db.content,
    category: db.category,
    date: db.date,
    tradeId: db.trade_id || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    isDeleted: db.is_deleted,
    deletedAt: db.deleted_at || undefined,
  };
}

export async function fetchNotebookEntries(userId: string): Promise<NotebookEntry[]> {
  const { data, error } = await supabase
    .from('notebook_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as DbNotebookEntry[]).map(mapDbToEntry);
}

export function subscribeNotebookRealtime(userId: string, onInvalidate: () => void) {
  return acquireSharedPostgresChannel(
    `notebook-realtime-${userId}`,
    [{
      event: '*',
      schema: 'public',
      table: 'notebook_entries',
      filter: `user_id=eq.${userId}`,
    }],
    onInvalidate,
  );
}
