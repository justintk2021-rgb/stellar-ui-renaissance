import { useState, useEffect, useCallback, useRef } from "react";
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

// Item-based grade criteria - defines which items must be checked for each grade
// Each grade contains an array of item IDs that must ALL be checked to achieve that grade
// The system checks from A down - first matching grade wins
interface GradeCriteria {
  A: string[]; // Item IDs required for grade A (highest)
  B: string[]; // Item IDs required for grade B
  C: string[]; // Item IDs required for grade C
  D: string[]; // Item IDs required for grade D (can be empty = default)
}

interface Checklist {
  id: string;
  name: string;
  type: ChecklistType;
  items: ChecklistItem[];
  notes: string;
  gradeCriteria?: GradeCriteria; // Item-based grade rules
  createdAt: string;
}

export type { ChecklistItem, ChecklistSubItem, ConditionalSubItem, Checklist, ChecklistType, PercentageType, GradeCriteria };

// Default empty grade criteria (percentage-based fallback when no criteria defined)
export const DEFAULT_GRADE_CRITERIA: GradeCriteria = {
  A: [],
  B: [],
  C: [],
  D: [],
};

export function useChecklists() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
        const itemsData = c.items as unknown as { items?: ChecklistItem[]; type?: ChecklistType; gradeCriteria?: GradeCriteria } | ChecklistItem[];
        
        // Handle both old format (array) and new format (object with type)
        if (Array.isArray(itemsData)) {
          return {
            id: c.id,
            name: c.name,
            type: "fixed" as ChecklistType,
            items: itemsData || [],
            notes: c.notes || '',
            gradeCriteria: undefined,
            createdAt: c.created_at,
          };
        } else {
          return {
            id: c.id,
            name: c.name,
            type: (itemsData?.type || "fixed") as ChecklistType,
            items: itemsData?.items || [],
            notes: c.notes || '',
            gradeCriteria: itemsData?.gradeCriteria,
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

  // Set up realtime subscription
  useEffect(() => {
    if (!userId) return;

    // Clean up existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `checklists-realtime-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checklists',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Checklists realtime update:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            const itemsData = payload.new.items as unknown as { items?: ChecklistItem[]; type?: ChecklistType; gradeCriteria?: GradeCriteria } | ChecklistItem[];
            let newChecklist: Checklist;
            
            if (Array.isArray(itemsData)) {
              newChecklist = {
                id: payload.new.id,
                name: payload.new.name,
                type: "fixed" as ChecklistType,
                items: itemsData || [],
                notes: payload.new.notes || '',
                gradeCriteria: undefined,
                createdAt: payload.new.created_at,
              };
            } else {
              newChecklist = {
                id: payload.new.id,
                name: payload.new.name,
                type: (itemsData?.type || "fixed") as ChecklistType,
                items: itemsData?.items || [],
                notes: payload.new.notes || '',
                gradeCriteria: itemsData?.gradeCriteria,
                createdAt: payload.new.created_at,
              };
            }
            
            setChecklists(prev => {
              if (prev.some(c => c.id === newChecklist.id)) return prev;
              return [newChecklist, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const itemsData = payload.new.items as unknown as { items?: ChecklistItem[]; type?: ChecklistType; gradeCriteria?: GradeCriteria } | ChecklistItem[];
            
            setChecklists(prev => prev.map(c => {
              if (c.id !== payload.new.id) return c;
              
              if (Array.isArray(itemsData)) {
                return {
                  ...c,
                  name: payload.new.name,
                  items: itemsData || [],
                  notes: payload.new.notes || '',
                };
              } else {
                return {
                  ...c,
                  name: payload.new.name,
                  type: (itemsData?.type || c.type) as ChecklistType,
                  items: itemsData?.items || [],
                  notes: payload.new.notes || '',
                  gradeCriteria: itemsData?.gradeCriteria,
                };
              }
            }));
          } else if (payload.eventType === 'DELETE') {
            setChecklists(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

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

  const updateChecklist = async (id: string, updates: Partial<Pick<Checklist, 'name' | 'items' | 'notes' | 'gradeCriteria'>>) => {
    try {
      const checklist = checklists.find(c => c.id === id);
      const dbUpdates: { name?: string; items?: Json; notes?: string } = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      
      // If items or gradeCriteria is being updated, we need to update the items JSON column
      if (updates.items !== undefined || updates.gradeCriteria !== undefined) {
        // Store with type, items, and gradeCriteria preserved
        dbUpdates.items = { 
          type: checklist?.type || "fixed", 
          items: updates.items ?? checklist?.items ?? [],
          gradeCriteria: updates.gradeCriteria ?? checklist?.gradeCriteria,
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
