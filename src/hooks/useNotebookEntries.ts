import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NotebookEntry } from '@/types/trade';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queries/keys';
import { fetchNotebookEntries, mapDbToEntry, subscribeNotebookRealtime } from '@/lib/queries/notebook';

export function useNotebookEntries(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.notebook.list(userId ?? '');

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchNotebookEntries(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notebook.all });
  }, [queryClient]);

  useEffect(() => {
    if (!userId) return;
    return subscribeNotebookRealtime(userId, invalidate);
  }, [userId, invalidate]);

  const migrateFromLocalStorage = useCallback(async () => {
    if (!userId) return;
    const localStorageKey = 'atp_notebook_v1';
    const localData = localStorage.getItem(localStorageKey);
    if (!localData) return;

    try {
      const localEntries: NotebookEntry[] = JSON.parse(localData);
      if (localEntries.length === 0) return;

      const { data: existingEntries } = await supabase
        .from('notebook_entries')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (existingEntries && existingEntries.length > 0) {
        localStorage.removeItem(localStorageKey);
        return;
      }

      const entriesToInsert = localEntries.map(entry => ({
        id: entry.id.startsWith('trade-note-') ? undefined : entry.id,
        user_id: userId,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        date: entry.date,
        trade_id: entry.tradeId || null,
        is_deleted: entry.isDeleted || false,
        deleted_at: entry.deletedAt || null,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      }));

      const { error } = await supabase.from('notebook_entries').insert(entriesToInsert);
      if (error) throw error;

      localStorage.removeItem(localStorageKey);
      toast.success('Notes migrated to cloud successfully!');
      invalidate();
    } catch (error) {
      console.error('Error migrating notebook entries:', error);
    }
  }, [userId, invalidate]);

  useEffect(() => {
    if (userId) migrateFromLocalStorage();
  }, [userId, migrateFromLocalStorage]);

  const saveEntry = useCallback(async (entry: NotebookEntry): Promise<boolean> => {
    if (!userId) return false;

    try {
      const currentEntries = queryClient.getQueryData<NotebookEntry[]>(queryKey) ?? [];
      const existingEntry = currentEntries.find(e => e.id === entry.id);

      if (existingEntry) {
        const { error } = await supabase
          .from('notebook_entries')
          .update({
            title: entry.title,
            content: entry.content,
            category: entry.category,
            date: entry.date,
            trade_id: entry.tradeId || null,
            is_deleted: entry.isDeleted || false,
            deleted_at: entry.deletedAt || null,
          })
          .eq('id', entry.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notebook_entries')
          .insert({
            user_id: userId,
            title: entry.title,
            content: entry.content,
            category: entry.category,
            date: entry.date,
            trade_id: entry.tradeId || null,
            is_deleted: entry.isDeleted || false,
            deleted_at: entry.deletedAt || null,
            created_at: entry.createdAt,
            updated_at: entry.updatedAt,
          });
        if (error) throw error;
      }

      invalidate();
      return true;
    } catch (error) {
      console.error('Error saving notebook entry:', error);
      toast.error('Failed to save note');
      return false;
    }
  }, [userId, queryClient, queryKey, invalidate]);

  const deleteEntry = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const { error } = await supabase.from('notebook_entries').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      invalidate();
      return true;
    } catch (error) {
      console.error('Error deleting notebook entry:', error);
      toast.error('Failed to delete note');
      return false;
    }
  }, [userId, invalidate]);

  const softDeleteEntry = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const { error } = await supabase
        .from('notebook_entries')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      invalidate();
      return true;
    } catch (error) {
      console.error('Error soft deleting notebook entry:', error);
      toast.error('Failed to move note to trash');
      return false;
    }
  }, [userId, invalidate]);

  const restoreEntry = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const { error } = await supabase
        .from('notebook_entries')
        .update({ is_deleted: false, deleted_at: null })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      invalidate();
      return true;
    } catch (error) {
      console.error('Error restoring notebook entry:', error);
      toast.error('Failed to restore note');
      return false;
    }
  }, [userId, invalidate]);

  return {
    entries,
    isLoading,
    saveEntry,
    deleteEntry,
    softDeleteEntry,
    restoreEntry,
    refetch,
  };
}
