import { useEffect, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queries/keys';
import { subscribeChecklistsRealtime } from '@/lib/queries/checklists';

interface ConditionalSubItem {
  id: string;
  text: string;
  checked: boolean;
  children?: ConditionalSubItem[];
}

type PercentageType = 'fixed' | 'conditional';

interface ChecklistSubItem {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number;
  children?: ConditionalSubItem[];
}

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number;
  percentageType?: PercentageType;
  subItems?: ChecklistSubItem[];
}

type ChecklistType = 'fixed' | 'conditional';

interface Checklist {
  id: string;
  name: string;
  type: ChecklistType;
  items: ChecklistItem[];
  notes: string;
  createdAt: string;
}

export type { ChecklistItem, ChecklistSubItem, ConditionalSubItem, Checklist, ChecklistType, PercentageType };

function mapDbToChecklist(c: Record<string, unknown>): Checklist {
  const items = c.items as unknown as { items?: ChecklistItem[]; type?: ChecklistType } | ChecklistItem[];

  if (Array.isArray(items)) {
    return {
      id: c.id as string,
      name: c.name as string,
      type: 'fixed',
      items: items || [],
      notes: (c.notes as string) || '',
      createdAt: c.created_at as string,
    };
  }

  return {
    id: c.id as string,
    name: c.name as string,
    type: (items?.type || 'fixed') as ChecklistType,
    items: items?.items || [],
    notes: (c.notes as string) || '',
    createdAt: c.created_at as string,
  };
}

async function fetchChecklists(userId: string): Promise<Checklist[]> {
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((c) => mapDbToChecklist(c as Record<string, unknown>));
}

export function useChecklists() {
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data: checklists = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.checklists.list(userId ?? ''),
    queryFn: () => fetchChecklists(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!userId) return;
    return subscribeChecklistsRealtime(userId, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklists.all });
    });
  }, [userId, queryClient]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.checklists.all });
  }, [queryClient]);

  const createChecklist = async (name: string, type: ChecklistType = 'fixed'): Promise<Checklist | null> => {
    if (!userId || !name.trim()) return null;

    try {
      const { data, error } = await supabase
        .from('checklists')
        .insert({
          user_id: userId,
          name: name.trim(),
          items: { type, items: [] } as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      invalidate();
      return mapDbToChecklist(data as Record<string, unknown>);
    } catch (error) {
      console.error('Error creating checklist:', error);
      toast({ title: 'Error', description: 'Failed to create checklist', variant: 'destructive' });
      return null;
    }
  };

  const updateChecklist = async (id: string, updates: Partial<Pick<Checklist, 'name' | 'items' | 'notes'>>) => {
    try {
      const checklist = checklists.find(c => c.id === id);
      const dbUpdates: { name?: string; items?: Json; notes?: string } = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.items !== undefined) {
        dbUpdates.items = {
          type: checklist?.type || 'fixed',
          items: updates.items,
        } as unknown as Json;
      }

      const { error } = await supabase.from('checklists').update(dbUpdates).eq('id', id);
      if (error) throw error;
      invalidate();
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast({ title: 'Error', description: 'Failed to update checklist', variant: 'destructive' });
    }
  };

  const deleteChecklist = async (id: string) => {
    try {
      const { error } = await supabase.from('checklists').delete().eq('id', id);
      if (error) throw error;
      invalidate();
    } catch (error) {
      console.error('Error deleting checklist:', error);
      toast({ title: 'Error', description: 'Failed to delete checklist', variant: 'destructive' });
    }
  };

  return {
    checklists,
    loading,
    isAuthenticated: !!userId,
    createChecklist,
    updateChecklist,
    deleteChecklist,
  };
}
