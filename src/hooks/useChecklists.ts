import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

// Deep nested sub-item for conditional checklists (can have unlimited depth)
interface ConditionalSubItem {
  id: string;
  text: string;
  checked: boolean;
  children?: ConditionalSubItem[]; // For conditional checklists - reveals when parent is checked
}

type PercentageType = "fixed" | "conditional";

interface ChecklistSubItem {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number; // Custom percentage weight for sub-items
  children?: ConditionalSubItem[]; // Support deep nesting for conditional checklists
}

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number; // Custom percentage weight (defaults to equal distribution)
  percentageType?: PercentageType; // "fixed" = full % when any sub-item selected, "conditional" = sum of selected sub-items
  subItems?: ChecklistSubItem[]; // Conditional sub-items that appear when parent is checked
}

type ChecklistType = "fixed" | "conditional";

interface Checklist {
  id: string;
  name: string;
  type: ChecklistType;
  items: ChecklistItem[];
  notes: string;
  createdAt: string;
}

export type { ChecklistItem, ChecklistSubItem, ConditionalSubItem, Checklist, ChecklistType, PercentageType };

export function useChecklists() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Get current user
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

  // Fetch checklists from database
  const fetchChecklists = useCallback(async () => {
    if (!userId) {
      setChecklists([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((c) => {
        const items = c.items as unknown as { items?: ChecklistItem[]; type?: ChecklistType } | ChecklistItem[];
        
        // Handle both old format (array) and new format (object with type)
        if (Array.isArray(items)) {
          return {
            id: c.id,
            name: c.name,
            type: "fixed" as ChecklistType,
            items: items || [],
            notes: c.notes || '',
            createdAt: c.created_at,
          };
        } else {
          return {
            id: c.id,
            name: c.name,
            type: (items?.type || "fixed") as ChecklistType,
            items: items?.items || [],
            notes: c.notes || '',
            createdAt: c.created_at,
          };
        }
      });

      setChecklists(mapped);
    } catch (error) {
      console.error('Error fetching checklists:', error);
      toast({
        title: "Error",
        description: "Failed to load checklists",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const createChecklist = async (name: string, type: ChecklistType = "fixed"): Promise<Checklist | null> => {
    if (!userId || !name.trim()) return null;

    try {
      // Store type alongside items in the JSON column
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

      const newChecklist: Checklist = {
        id: data.id,
        name: data.name,
        type,
        items: [],
        notes: '',
        createdAt: data.created_at,
      };

      setChecklists(prev => [newChecklist, ...prev]);
      return newChecklist;
    } catch (error) {
      console.error('Error creating checklist:', error);
      toast({
        title: "Error",
        description: "Failed to create checklist",
        variant: "destructive",
      });
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
        // Store with type preserved
        dbUpdates.items = { 
          type: checklist?.type || "fixed", 
          items: updates.items 
        } as unknown as Json;
      }
      
      const { error } = await supabase
        .from('checklists')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setChecklists(prev => prev.map(c => 
        c.id === id ? { ...c, ...updates } : c
      ));
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast({
        title: "Error",
        description: "Failed to update checklist",
        variant: "destructive",
      });
    }
  };

  const deleteChecklist = async (id: string) => {
    try {
      const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setChecklists(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting checklist:', error);
      toast({
        title: "Error",
        description: "Failed to delete checklist",
        variant: "destructive",
      });
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
