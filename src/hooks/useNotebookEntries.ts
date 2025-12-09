import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NotebookEntry } from '@/types/trade';
import { toast } from 'sonner';

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

function mapDbToEntry(db: DbNotebookEntry): NotebookEntry {
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

export function useNotebookEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch entries from database
  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notebook_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEntries((data as DbNotebookEntry[]).map(mapDbToEntry));
    } catch (error) {
      console.error('Error fetching notebook entries:', error);
      toast.error('Failed to load notebook entries');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Migrate localStorage entries to database (one-time migration)
  const migrateFromLocalStorage = useCallback(async () => {
    if (!userId) return;

    const localStorageKey = 'atp_notebook_v1';
    const localData = localStorage.getItem(localStorageKey);
    
    if (!localData) return;

    try {
      const localEntries: NotebookEntry[] = JSON.parse(localData);
      
      if (localEntries.length === 0) return;

      // Check if already migrated by looking for existing entries
      const { data: existingEntries } = await supabase
        .from('notebook_entries')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (existingEntries && existingEntries.length > 0) {
        // Already has entries, clear localStorage
        localStorage.removeItem(localStorageKey);
        return;
      }

      // Migrate each entry
      const entriesToInsert = localEntries.map(entry => ({
        id: entry.id.startsWith('trade-note-') ? undefined : entry.id, // Let DB generate new IDs for trade notes
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

      const { error } = await supabase
        .from('notebook_entries')
        .insert(entriesToInsert);

      if (error) throw error;

      // Clear localStorage after successful migration
      localStorage.removeItem(localStorageKey);
      toast.success('Notes migrated to cloud successfully!');
      
      // Refresh entries
      fetchEntries();
    } catch (error) {
      console.error('Error migrating notebook entries:', error);
    }
  }, [userId, fetchEntries]);

  useEffect(() => {
    if (userId) {
      migrateFromLocalStorage();
    }
  }, [userId, migrateFromLocalStorage]);

  // Add or update entry
  const saveEntry = useCallback(async (entry: NotebookEntry): Promise<boolean> => {
    if (!userId) return false;

    try {
      const existingEntry = entries.find(e => e.id === entry.id);

      if (existingEntry) {
        // Update existing entry
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

        setEntries(prev => prev.map(e => e.id === entry.id ? entry : e));
      } else {
        // Insert new entry
        const { data, error } = await supabase
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
          })
          .select()
          .single();

        if (error) throw error;

        const newEntry = mapDbToEntry(data as DbNotebookEntry);
        setEntries(prev => [newEntry, ...prev]);
      }

      return true;
    } catch (error) {
      console.error('Error saving notebook entry:', error);
      toast.error('Failed to save note');
      return false;
    }
  }, [userId, entries]);

  // Delete entry permanently
  const deleteEntry = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('notebook_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      setEntries(prev => prev.filter(e => e.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting notebook entry:', error);
      toast.error('Failed to delete note');
      return false;
    }
  }, [userId]);

  // Soft delete (move to trash)
  const softDeleteEntry = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('notebook_entries')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      setEntries(prev => prev.map(e => 
        e.id === id 
          ? { ...e, isDeleted: true, deletedAt: new Date().toISOString() }
          : e
      ));
      return true;
    } catch (error) {
      console.error('Error soft deleting notebook entry:', error);
      toast.error('Failed to move note to trash');
      return false;
    }
  }, [userId]);

  // Restore from trash
  const restoreEntry = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('notebook_entries')
        .update({
          is_deleted: false,
          deleted_at: null,
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      setEntries(prev => prev.map(e => 
        e.id === id 
          ? { ...e, isDeleted: false, deletedAt: undefined }
          : e
      ));
      return true;
    } catch (error) {
      console.error('Error restoring notebook entry:', error);
      toast.error('Failed to restore note');
      return false;
    }
  }, [userId]);

  return {
    entries,
    isLoading,
    saveEntry,
    deleteEntry,
    softDeleteEntry,
    restoreEntry,
    refetch: fetchEntries,
  };
}