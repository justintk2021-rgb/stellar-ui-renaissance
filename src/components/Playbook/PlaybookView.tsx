import { useState, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Plus, Trash2, Check, Edit2, X, ClipboardList, ChevronDown, Loader2, Percent, TrendingUp, TrendingDown, BarChart3, GripVertical, ChevronRight, GitBranch, ListChecks, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChecklists, ChecklistItem, ChecklistSubItem, ConditionalSubItem, ChecklistType, PercentageType } from "@/hooks/useChecklists";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ChecklistMetrics {
  checklistId: string;
  checklistName: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
}

export function PlaybookView() {
  const { checklists, loading, isAuthenticated, createChecklist, updateChecklist, deleteChecklist } = useChecklists();
  const [newChecklistName, setNewChecklistName] = useState("");
  const [newChecklistType, setNewChecklistType] = useState<ChecklistType | null>(null);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistName, setEditingChecklistName] = useState("");
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [isTypeSelectOpen, setIsTypeSelectOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPercentage, setEditingPercentage] = useState<string>("");
  const [addingItemToChecklist, setAddingItemToChecklist] = useState<string | null>(null);
  const [checklistMetrics, setChecklistMetrics] = useState<ChecklistMetrics[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  // State for sub-items (fixed checklists)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [addingSubItemTo, setAddingSubItemTo] = useState<string | null>(null);
  const [newSubItemText, setNewSubItemText] = useState("");
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null);
  const [editingSubItemText, setEditingSubItemText] = useState("");
  // State for conditional checklist deep nesting
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null); // "parentId:subItemId:childId..." path
  const [newChildText, setNewChildText] = useState("");
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  // State for sub-item percentage editing
  const [editingSubItemPercentageId, setEditingSubItemPercentageId] = useState<string | null>(null);
  const [editingSubItemPercentage, setEditingSubItemPercentage] = useState<string>("");
  const [editingChildText, setEditingChildText] = useState("");

  const selectedChecklist = checklists.find(c => c.id === selectedChecklistId) || null;
  const selectedMetrics = checklistMetrics.find(m => m.checklistId === selectedChecklistId);

  // Fetch metrics for all checklists
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!isAuthenticated || checklists.length === 0) return;
      
      setMetricsLoading(true);
      try {
        const { data: trades, error } = await supabase
          .from('trades')
          .select('checklist_id, result')
          .not('checklist_id', 'is', null);
        
        if (error) throw error;

        const metricsMap = new Map<string, { wins: number; losses: number; totalPnL: number }>();
        
        (trades || []).forEach((trade: any) => {
          const checklistId = trade.checklist_id;
          if (!checklistId) return;
          
          const existing = metricsMap.get(checklistId) || { wins: 0, losses: 0, totalPnL: 0 };
          const result = Number(trade.result);
          
          if (result > 0) {
            existing.wins++;
          } else if (result < 0) {
            existing.losses++;
          }
          existing.totalPnL += result;
          
          metricsMap.set(checklistId, existing);
        });

        const metrics: ChecklistMetrics[] = checklists.map(checklist => {
          const data = metricsMap.get(checklist.id) || { wins: 0, losses: 0, totalPnL: 0 };
          const total = data.wins + data.losses;
          return {
            checklistId: checklist.id,
            checklistName: checklist.name,
            totalTrades: total,
            winningTrades: data.wins,
            losingTrades: data.losses,
            totalPnL: data.totalPnL,
            winRate: total > 0 ? (data.wins / total) * 100 : 0,
          };
        });

        setChecklistMetrics(metrics);
      } catch (error) {
        console.error('Error fetching checklist metrics:', error);
      } finally {
        setMetricsLoading(false);
      }
    };

    fetchMetrics();
  }, [isAuthenticated, checklists]);

  const handleCreateChecklist = async () => {
    if (!newChecklistName.trim() || !newChecklistType) return;
    const newChecklist = await createChecklist(newChecklistName, newChecklistType);
    if (newChecklist) {
      setSelectedChecklistId(newChecklist.id);
    }
    setNewChecklistName("");
    setNewChecklistType(null);
    setIsCreateDialogOpen(false);
  };

  const openTypeSelect = () => {
    setIsTypeSelectOpen(true);
  };

  const selectType = (type: ChecklistType) => {
    setNewChecklistType(type);
    setIsTypeSelectOpen(false);
    setIsCreateDialogOpen(true);
  };

  const handleDeleteChecklist = async (id: string) => {
    await deleteChecklist(id);
    if (selectedChecklistId === id) {
      setSelectedChecklistId(checklists.length > 1 ? checklists.find(c => c.id !== id)?.id || null : null);
    }
  };

  const startEditingChecklist = (id: string, name: string) => {
    setEditingChecklistId(id);
    setEditingChecklistName(name);
  };

  const saveChecklistName = async (id: string) => {
    if (!editingChecklistName.trim()) return;
    await updateChecklist(id, { name: editingChecklistName.trim() });
    setEditingChecklistId(null);
    setEditingChecklistName("");
  };

  const addItem = async (checklistId: string) => {
    const text = newItemTexts[checklistId]?.trim();
    if (!text) return;

    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const newItem = {
      id: Date.now().toString(),
      text,
      checked: false,
    };

    await updateChecklist(checklistId, { items: [...checklist.items, newItem] });
    setNewItemTexts({ ...newItemTexts, [checklistId]: "" });
  };

  const toggleItem = async (checklistId: string, itemId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const updatedItems = checklist.items.map(item => {
      if (item.id === itemId) {
        const newChecked = !item.checked;
        // Auto-expand sub-items when parent is checked
        if (newChecked && item.subItems && item.subItems.length > 0) {
          setExpandedItems(prev => new Set(prev).add(itemId));
        }
        return { ...item, checked: newChecked };
      }
      return item;
    });
    await updateChecklist(checklistId, { items: updatedItems });
  };

  const deleteItem = async (checklistId: string, itemId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const updatedItems = checklist.items.filter(item => item.id !== itemId);
    await updateChecklist(checklistId, { items: updatedItems });
    // Clean up expanded state
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  // Sub-item functions
  const addSubItem = async (checklistId: string, parentItemId: string) => {
    if (!newSubItemText.trim()) return;
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const newSubItem: ChecklistSubItem = {
      id: Date.now().toString(),
      text: newSubItemText.trim(),
      checked: false,
    };

    const updatedItems = checklist.items.map(item => {
      if (item.id === parentItemId) {
        return {
          ...item,
          subItems: [...(item.subItems || []), newSubItem],
        };
      }
      return item;
    });

    await updateChecklist(checklistId, { items: updatedItems });
    setNewSubItemText("");
    setAddingSubItemTo(null);
  };

  const toggleSubItem = async (checklistId: string, parentItemId: string, subItemId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const updatedItems = checklist.items.map(item => {
      if (item.id === parentItemId && item.subItems) {
        return {
          ...item,
          subItems: item.subItems.map(sub =>
            sub.id === subItemId ? { ...sub, checked: !sub.checked } : sub
          ),
        };
      }
      return item;
    });

    await updateChecklist(checklistId, { items: updatedItems });
  };

  const deleteSubItem = async (checklistId: string, parentItemId: string, subItemId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const updatedItems = checklist.items.map(item => {
      if (item.id === parentItemId && item.subItems) {
        return {
          ...item,
          subItems: item.subItems.filter(sub => sub.id !== subItemId),
        };
      }
      return item;
    });

    await updateChecklist(checklistId, { items: updatedItems });
  };

  const updateSubItemText = async (checklistId: string, parentItemId: string, subItemId: string, newText: string) => {
    if (!newText.trim()) return;
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const updatedItems = checklist.items.map(item => {
      if (item.id === parentItemId && item.subItems) {
        return {
          ...item,
          subItems: item.subItems.map(sub =>
            sub.id === subItemId ? { ...sub, text: newText.trim() } : sub
          ),
        };
      }
      return item;
    });

    await updateChecklist(checklistId, { items: updatedItems });
    setEditingSubItemId(null);
    setEditingSubItemText("");
  };

  const toggleExpandItem = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Toggle percentageType for a category (fixed = full % on any selection, conditional = sum of selections)
  const toggleCategoryPercentageType = async (checklistId: string, itemId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const updatedItems = checklist.items.map(item => {
      if (item.id === itemId) {
        const currentType = item.percentageType || "conditional";
        const newType: PercentageType = currentType === "conditional" ? "fixed" : "conditional";
        return { ...item, percentageType: newType };
      }
      return item;
    });

    await updateChecklist(checklistId, { items: updatedItems });
  };

  // Deep nesting helpers for conditional checklists
  const resetNestedChildren = (children?: ConditionalSubItem[]): ConditionalSubItem[] | undefined => {
    if (!children) return undefined;
    return children.map(child => ({
      ...child,
      checked: false,
      children: resetNestedChildren(child.children),
    }));
  };

  // Check if a category has at least one sub-item checked (unlocks next category)
  const isCategoryStarted = (item: ChecklistItem): boolean => {
    if (!item.subItems || item.subItems.length === 0) return item.checked;
    return item.subItems.some(sub => sub.checked);
  };

  // Get the index of the current unlocked category for conditional checklists
  // A category is unlocked if at least one item in previous category is checked
  const getUnlockedCategoryIndex = (items: ChecklistItem[]): number => {
    for (let i = 0; i < items.length; i++) {
      if (!isCategoryStarted(items[i])) {
        return i;
      }
    }
    return items.length; // All started
  };

  // Check if a category is accessible (unlocked)
  const isCategoryUnlocked = (items: ChecklistItem[], categoryIndex: number): boolean => {
    const unlockedIndex = getUnlockedCategoryIndex(items);
    return categoryIndex <= unlockedIndex;
  };

  // Count started categories (at least 1 sub-item checked)
  const getStartedCategoriesCount = (items: ChecklistItem[]): number => {
    return items.filter(item => isCategoryStarted(item)).length;
  };

  const addChildToSubItem = async (
    checklistId: string, 
    parentItemId: string, 
    path: string[], // Array of subItem IDs to traverse
    text: string
  ) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist || !text.trim()) return;

    const newChild: ConditionalSubItem = {
      id: Date.now().toString(),
      text: text.trim(),
      checked: false,
    };

    const addToPath = (subItems: ChecklistSubItem[], pathIndex: number): ChecklistSubItem[] => {
      return subItems.map(sub => {
        if (sub.id === path[pathIndex]) {
          if (pathIndex === path.length - 1) {
            // Target found, add child here
            return { ...sub, children: [...(sub.children || []), newChild] };
          } else if (sub.children) {
            // Traverse deeper
            return { 
              ...sub, 
              children: addToPathNested(sub.children, pathIndex + 1) 
            };
          }
        }
        return sub;
      });
    };

    const addToPathNested = (children: ConditionalSubItem[], pathIndex: number): ConditionalSubItem[] => {
      return children.map(child => {
        if (child.id === path[pathIndex]) {
          if (pathIndex === path.length - 1) {
            return { ...child, children: [...(child.children || []), newChild] };
          } else if (child.children) {
            return { ...child, children: addToPathNested(child.children, pathIndex + 1) };
          }
        }
        return child;
      });
    };

    const updatedItems = checklist.items.map(item => {
      if (item.id === parentItemId && item.subItems) {
        return { ...item, subItems: addToPath(item.subItems, 0) };
      }
      return item;
    });

    await updateChecklist(checklistId, { items: updatedItems });
    setNewChildText("");
    setAddingChildTo(null);
  };

  const toggleNestedChild = async (
    checklistId: string,
    parentItemId: string,
    path: string[] // Array of IDs to traverse to the target
  ) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const toggleInSubItems = (subItems: ChecklistSubItem[], pathIndex: number): ChecklistSubItem[] => {
      return subItems.map(sub => {
        if (sub.id === path[pathIndex]) {
          if (pathIndex === path.length - 1) {
            const newChecked = !sub.checked;
            if (newChecked) {
              setExpandedItems(prev => new Set(prev).add(sub.id));
            }
            return { ...sub, checked: newChecked };
          } else if (sub.children) {
            return { ...sub, children: toggleInNested(sub.children, pathIndex + 1) };
          }
        }
        return sub;
      });
    };

    const toggleInNested = (children: ConditionalSubItem[], pathIndex: number): ConditionalSubItem[] => {
      return children.map(child => {
        if (child.id === path[pathIndex]) {
          if (pathIndex === path.length - 1) {
            const newChecked = !child.checked;
            if (newChecked) {
              setExpandedItems(prev => new Set(prev).add(child.id));
            }
            return { ...child, checked: newChecked };
          } else if (child.children) {
            return { ...child, children: toggleInNested(child.children, pathIndex + 1) };
          }
        }
        return child;
      });
    };

    const updatedItems = checklist.items.map(item => {
      if (item.id === parentItemId && item.subItems) {
        return { ...item, subItems: toggleInSubItems(item.subItems, 0) };
      }
      return item;
    });

    await updateChecklist(checklistId, { items: updatedItems });
  };

  const deleteNestedChild = async (
    checklistId: string,
    parentItemId: string,
    path: string[]
  ) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const deleteFromSubItems = (subItems: ChecklistSubItem[], pathIndex: number): ChecklistSubItem[] => {
      if (pathIndex === path.length - 1) {
        return subItems.filter(sub => sub.id !== path[pathIndex]);
      }
      return subItems.map(sub => {
        if (sub.id === path[pathIndex] && sub.children) {
          return { ...sub, children: deleteFromNested(sub.children, pathIndex + 1) };
        }
        return sub;
      });
    };

    const deleteFromNested = (children: ConditionalSubItem[], pathIndex: number): ConditionalSubItem[] => {
      if (pathIndex === path.length - 1) {
        return children.filter(child => child.id !== path[pathIndex]);
      }
      return children.map(child => {
        if (child.id === path[pathIndex] && child.children) {
          return { ...child, children: deleteFromNested(child.children, pathIndex + 1) };
        }
        return child;
      });
    };

    const updatedItems = checklist.items.map(item => {
      if (item.id === parentItemId && item.subItems) {
        return { ...item, subItems: deleteFromSubItems(item.subItems, 0) };
      }
      return item;
    });

    await updateChecklist(checklistId, { items: updatedItems });
  };

  const updateNestedChildText = async (
    checklistId: string,
    parentItemId: string,
    path: string[],
    newText: string
  ) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist || !newText.trim()) return;

    const updateInSubItems = (subItems: ChecklistSubItem[], pathIndex: number): ChecklistSubItem[] => {
      return subItems.map(sub => {
        if (sub.id === path[pathIndex]) {
          if (pathIndex === path.length - 1) {
            return { ...sub, text: newText.trim() };
          } else if (sub.children) {
            return { ...sub, children: updateInNested(sub.children, pathIndex + 1) };
          }
        }
        return sub;
      });
    };

    const updateInNested = (children: ConditionalSubItem[], pathIndex: number): ConditionalSubItem[] => {
      return children.map(child => {
        if (child.id === path[pathIndex]) {
          if (pathIndex === path.length - 1) {
            return { ...child, text: newText.trim() };
          } else if (child.children) {
            return { ...child, children: updateInNested(child.children, pathIndex + 1) };
          }
        }
        return child;
      });
    };

    const updatedItems = checklist.items.map(item => {
      if (item.id === parentItemId && item.subItems) {
        return { ...item, subItems: updateInSubItems(item.subItems, 0) };
      }
      return item;
    });

    await updateChecklist(checklistId, { items: updatedItems });
    setEditingChildId(null);
    setEditingChildText("");
  };

  // Count all nested items recursively for conditional checklist percentage
  const countNestedItems = (children?: ConditionalSubItem[]): { total: number; checked: number } => {
    if (!children || children.length === 0) return { total: 0, checked: 0 };
    
    let total = 0;
    let checked = 0;
    
    children.forEach(child => {
      total++;
      if (child.checked) checked++;
      const nested = countNestedItems(child.children);
      total += nested.total;
      checked += nested.checked;
    });
    
    return { total, checked };
  };

  const getConditionalCompletionPercentage = (items: ChecklistItem[]) => {
    if (items.length === 0) return 0;
    
    // For sequential conditional checklists, each category contributes its percentage
    // Categories can be "fixed" (full % when ANY sub-item selected) or "conditional" (sum of selected sub-items)
    let totalPercentage = 0;
    const categoryWeight = 100 / items.length;
    
    items.forEach((item, index) => {
      if (!isCategoryUnlocked(items, index)) return;
      
      if (item.subItems && item.subItems.length > 0) {
        const checkedSubItems = item.subItems.filter(sub => sub.checked);
        
        // Check if this category uses "fixed" percentage type
        // Fixed: give full category weight when ANY sub-item is checked
        if (item.percentageType === "fixed") {
          if (checkedSubItems.length > 0) {
            totalPercentage += categoryWeight;
          }
        } else {
          // Conditional (default): sum the percentages of checked sub-items
          const subItemPercentages = checkedSubItems.reduce((sum, sub) => {
            return sum + (sub.percentage ?? Math.round(100 / item.subItems!.length));
          }, 0);
          // Category contribution = (sub-item completion %) * category weight
          totalPercentage += (subItemPercentages / 100) * categoryWeight;
        }
      } else if (item.checked) {
        totalPercentage += categoryWeight;
      }
    });
    
    return Math.round(totalPercentage);
  };

  const getCompletionPercentage = (items: ChecklistItem[], type?: ChecklistType) => {
    // Use conditional calculation for conditional checklists
    if (type === "conditional") {
      return getConditionalCompletionPercentage(items);
    }
    
    if (items.length === 0) return 0;
    
    // Check if any items have custom percentages
    const hasCustomPercentages = items.some(item => item.percentage !== undefined);
    
    if (hasCustomPercentages) {
      // Use custom percentages - sum up the percentages of checked items
      const totalPercentage = items.reduce((sum, item) => {
        const itemPercentage = item.percentage ?? Math.round(100 / items.length);
        
        if (item.subItems && item.subItems.length > 0) {
          // For trading checklists: sum the checked sub-item percentages
          // Users don't need to check all sub-items - just the ones relevant to their trade
          if (item.checked) {
            const checkedSubItems = item.subItems.filter(sub => sub.checked);
            const subItemPercentages = checkedSubItems.reduce((subSum, sub) => {
              return subSum + (sub.percentage ?? Math.round(100 / item.subItems!.length));
            }, 0);
            // Item contribution = item % * (sum of checked sub-item %s / 100)
            return sum + (itemPercentage * (subItemPercentages / 100));
          }
          return sum;
        } else {
          // Simple item without sub-items
          if (item.checked) {
            return sum + itemPercentage;
          }
          return sum;
        }
      }, 0);
      return Math.min(100, Math.round(totalPercentage));
    } else {
      // Default equal distribution - sum checked sub-item percentages
      let totalPercentage = 0;
      const itemWeight = 100 / items.length;
      
      items.forEach(item => {
        if (item.subItems && item.subItems.length > 0) {
          if (item.checked) {
            // Sum the percentages of checked sub-items
            const checkedSubItems = item.subItems.filter(sub => sub.checked);
            const subItemPercentages = checkedSubItems.reduce((sum, sub) => {
              return sum + (sub.percentage ?? Math.round(100 / item.subItems!.length));
            }, 0);
            totalPercentage += (itemWeight * (subItemPercentages / 100));
          }
        } else {
          if (item.checked) {
            totalPercentage += itemWeight;
          }
        }
      });
      
      return Math.round(totalPercentage);
    }
  };

  const updateItemPercentage = async (checklistId: string, itemId: string, percentage: number) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    const updatedItems = checklist.items.map(item =>
      item.id === itemId ? { ...item, percentage: clampedPercentage } : item
    );
    await updateChecklist(checklistId, { items: updatedItems });
    setEditingItemId(null);
  };

  const startEditingPercentage = (itemId: string, currentPercentage: number | undefined, totalItems: number) => {
    setEditingItemId(itemId);
    setEditingPercentage(String(currentPercentage ?? Math.round(100 / totalItems)));
  };

  // Sub-item percentage functions
  const updateSubItemPercentage = async (checklistId: string, parentItemId: string, subItemId: string, percentage: number) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    const updatedItems = checklist.items.map(item => {
      if (item.id === parentItemId && item.subItems) {
        return {
          ...item,
          subItems: item.subItems.map(sub =>
            sub.id === subItemId ? { ...sub, percentage: clampedPercentage } : sub
          ),
        };
      }
      return item;
    });
    await updateChecklist(checklistId, { items: updatedItems });
    setEditingSubItemPercentageId(null);
  };

  const startEditingSubItemPercentage = (subItemId: string, currentPercentage: number | undefined, totalSubItems: number) => {
    setEditingSubItemPercentageId(subItemId);
    setEditingSubItemPercentage(String(currentPercentage ?? Math.round(100 / totalSubItems)));
  };

  const resetSubItemChildren = (subItems?: ChecklistSubItem[]): ChecklistSubItem[] | undefined => {
    if (!subItems) return undefined;
    return subItems.map(sub => ({
      ...sub,
      checked: false,
      children: resetNestedChildren(sub.children),
    }));
  };

  const resetChecklist = async (checklistId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const resetItems = checklist.items.map(item => ({
      ...item,
      checked: false,
      subItems: resetSubItemChildren(item.subItems),
    }));
    await updateChecklist(checklistId, { items: resetItems });
    setExpandedItems(new Set());
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Trading Playbook</h2>
            <p className="text-xs text-muted-foreground">Create and manage your trading checklists</p>
          </div>
        </div>
        <div className="glass rounded-xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
          <p className="text-sm text-muted-foreground">
            Please sign in to access your trading checklists
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Trading Playbook</h2>
            <p className="text-xs text-muted-foreground">Create and manage your trading checklists</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Trading Playbook</h2>
            <p className="text-xs text-muted-foreground">Create and manage your trading checklists</p>
          </div>
        </div>
        <Button 
          onClick={openTypeSelect}
          className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary transition-all duration-300 hover:scale-105 hover:shadow-glow-sm active:scale-95"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
          <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" />
          New Checklist
        </Button>
      </div>

      {/* Type Selection Dialog */}
      <Dialog open={isTypeSelectOpen} onOpenChange={setIsTypeSelectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose Checklist Type</DialogTitle>
            <DialogDescription>
              Select the type of checklist you want to create
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 grid grid-cols-2 gap-4">
            {/* Fixed Checklist Option */}
            <motion.button
              onClick={() => selectType("fixed")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative p-6 rounded-xl border-2 border-border/50 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all duration-300 text-left"
            >
              <div className="absolute top-3 right-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                  <ListChecks className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="pr-10">
                <h3 className="font-semibold text-base mb-2">Fixed Checklist</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Standard checklist with items you check off one by one. Great for simple pre-trade routines.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
                <span className="text-[10px] text-muted-foreground ml-1">Linear items</span>
              </div>
            </motion.button>

            {/* Conditional Checklist Option */}
            <motion.button
              onClick={() => selectType("conditional")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative p-6 rounded-xl border-2 border-border/50 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all duration-300 text-left"
            >
              <div className="absolute top-3 right-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center transition-colors">
                  <GitBranch className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div className="pr-10">
                <h3 className="font-semibold text-base mb-2">Conditional Checklist</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Branching checklist where checking an item reveals sub-conditions. Perfect for complex decision trees.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-amber-500/40" />
                <div className="flex flex-col gap-0.5 ml-1">
                  <div className="w-2 h-2 rounded-full border border-amber-500/30" />
                  <div className="w-2 h-2 rounded-full border border-amber-500/30" />
                </div>
                <span className="text-[10px] text-muted-foreground ml-1">Branching</span>
              </div>
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Checklist Dialog (Name Input) */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) setNewChecklistType(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newChecklistType === "conditional" ? (
                <GitBranch className="w-5 h-5 text-amber-500" />
              ) : (
                <ListChecks className="w-5 h-5 text-primary" />
              )}
              Create {newChecklistType === "conditional" ? "Conditional" : "Fixed"} Checklist
            </DialogTitle>
            <DialogDescription>
              {newChecklistType === "conditional" 
                ? "Items will reveal sub-conditions when checked"
                : "A standard checklist with linear items"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter checklist name (e.g., Pre-Trade Checklist)"
              value={newChecklistName}
              onChange={(e) => setNewChecklistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChecklist()}
              className="bg-background/50 border-border/50"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setIsTypeSelectOpen(true);
            }}>
              Back
            </Button>
            <Button onClick={handleCreateChecklist} disabled={!newChecklistName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist Selector */}
      {checklists.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-fit justify-between bg-background/50">
              <span className="flex items-center gap-2">
                {selectedChecklist?.type === "conditional" ? (
                  <GitBranch className="w-3.5 h-3.5 text-amber-500" />
                ) : selectedChecklist ? (
                  <ListChecks className="w-3.5 h-3.5 text-primary" />
                ) : null}
                <span className="truncate">
                  {selectedChecklist ? selectedChecklist.name : "Select a checklist"}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 ml-2 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[250px] max-h-[300px] overflow-y-auto bg-popover">
            {checklists.map((checklist) => (
              <DropdownMenuItem
                key={checklist.id}
                onClick={() => setSelectedChecklistId(checklist.id)}
                className={cn(
                  "cursor-pointer flex items-center gap-2",
                  selectedChecklistId === checklist.id && "bg-primary/10"
                )}
              >
                {checklist.type === "conditional" ? (
                  <GitBranch className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />
                )}
                <span className="truncate flex-1">{checklist.name}</span>
                <span className="text-xs text-muted-foreground">
                  {getCompletionPercentage(checklist.items, checklist.type)}%
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Main Content Layout */}
      <div className="flex gap-6">
        {/* Left Side - Checklist */}
        <div className="flex-1">
          {/* Selected Checklist Display */}
          {checklists.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Checklists Yet</h3>
              <p className="text-sm text-muted-foreground">
                Create your first trading checklist to get started
              </p>
            </div>
          ) : !selectedChecklist ? (
            <div className="glass rounded-xl p-12 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Checklist</h3>
              <p className="text-sm text-muted-foreground">
                Choose a checklist from the dropdown above
              </p>
            </div>
          ) : (
            <div 
              className={cn(
                "glass rounded-xl transition-all duration-300",
                getCompletionPercentage(selectedChecklist.items, selectedChecklist.type) === 100 && selectedChecklist.items.length > 0
                  && "bg-primary/5"
              )}
        >
          {/* Checklist Header */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {editingChecklistId === selectedChecklist.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingChecklistName}
                    onChange={(e) => setEditingChecklistName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveChecklistName(selectedChecklist.id)}
                    className="h-8 bg-background/50"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={() => saveChecklistName(selectedChecklist.id)}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingChecklistId(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {selectedChecklist.type === "conditional" ? (
                    <GitBranch className="w-4 h-4 text-amber-500" />
                  ) : (
                    <ListChecks className="w-4 h-4 text-primary" />
                  )}
                  <h3 className="font-semibold text-lg">{selectedChecklist.name}</h3>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    selectedChecklist.type === "conditional" 
                      ? "bg-amber-500/10 text-amber-500" 
                      : "bg-primary/10 text-primary"
                  )}>
                    {selectedChecklist.type === "conditional" ? "Branching" : "Fixed"}
                  </span>
                  <button 
                    onClick={() => startEditingChecklist(selectedChecklist.id, selectedChecklist.name)}
                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>

            {/* Percentage Badge & Grade */}
            <div className="flex items-center gap-3">
              {/* Grade Badge */}
              {selectedChecklist.items.length > 0 && (() => {
                const percentage = getCompletionPercentage(selectedChecklist.items, selectedChecklist.type);
                let grade: string;
                let gradeColor: string;
                let gradeLabel: string;
                
                if (percentage >= 90) {
                  grade = "A";
                  gradeColor = "bg-emerald-500/20 text-emerald-500 border-emerald-500/30";
                  gradeLabel = "A Setup";
                } else if (percentage >= 75) {
                  grade = "B";
                  gradeColor = "bg-amber-500/20 text-amber-500 border-amber-500/30";
                  gradeLabel = "B Setup";
                } else if (percentage >= 60) {
                  grade = "C";
                  gradeColor = "bg-orange-500/20 text-orange-500 border-orange-500/30";
                  gradeLabel = "C Setup";
                } else {
                  grade = "D";
                  gradeColor = "bg-rose-500/20 text-rose-500 border-rose-500/30";
                  gradeLabel = "D Setup";
                }
                
                return (
                  <motion.div
                    key={grade}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-bold border",
                      gradeColor
                    )}
                  >
                    {gradeLabel}
                  </motion.div>
                );
              })()}
              
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      getCompletionPercentage(selectedChecklist.items, selectedChecklist.type) === 100 && selectedChecklist.items.length > 0
                        ? "bg-primary" 
                        : "bg-primary/70"
                    )}
                    style={{ width: `${getCompletionPercentage(selectedChecklist.items, selectedChecklist.type)}%` }}
                  />
                </div>
                <span className={cn(
                  "text-sm font-bold min-w-[3rem] text-right",
                  getCompletionPercentage(selectedChecklist.items, selectedChecklist.type) === 100 && selectedChecklist.items.length > 0
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}>
                  {getCompletionPercentage(selectedChecklist.items, selectedChecklist.type)}%
                </span>
              </div>

              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => resetChecklist(selectedChecklist.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>

              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                }
                title="Delete Checklist"
                description={`Are you sure you want to delete "${selectedChecklist.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={() => handleDeleteChecklist(selectedChecklist.id)}
              />
            </div>
          </div>

          {/* Checklist Items */}
          <div className="p-4 space-y-2">
            {selectedChecklist.items.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-8 text-muted-foreground text-sm"
              >
                {selectedChecklist.type === "conditional" 
                  ? "No categories yet. Add your first category (e.g., Trend, Structure, Entry) below."
                  : "No items yet. Add your first item below."}
              </motion.div>
            ) : selectedChecklist.type === "conditional" ? (
              /* CONDITIONAL CHECKLIST - Sequential Category View */
              <div className="space-y-3">
                {/* Progress Overview */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 pb-3 border-b border-border/30">
                  <span>Category Progress</span>
                  <span className="font-medium">
                    {getStartedCategoriesCount(selectedChecklist.items)} / {selectedChecklist.items.length} categories
                  </span>
                </div>
                
                <AnimatePresence mode="popLayout">
                  {selectedChecklist.items.map((item: ChecklistItem, categoryIndex: number) => {
                    const isUnlocked = isCategoryUnlocked(selectedChecklist.items, categoryIndex);
                    const isStarted = isCategoryStarted(item);
                    const isCurrentCategory = categoryIndex === getUnlockedCategoryIndex(selectedChecklist.items);
                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    const isExpanded = expandedItems.has(item.id) || isCurrentCategory;
                    const subItemsCompleted = item.subItems?.filter(s => s.checked).length || 0;
                    const subItemsTotal = item.subItems?.length || 0;
                    
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ 
                          opacity: isUnlocked ? 1 : 0.4, 
                          y: 0,
                          scale: isUnlocked ? 1 : 0.98 
                        }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ 
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                          delay: categoryIndex * 0.05
                        }}
                        className="space-y-2"
                      >
                        {/* Category Header */}
                        <motion.div
                          className={cn(
                            "relative flex items-center gap-3 p-4 rounded-xl transition-all duration-300",
                            isStarted
                              ? "bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30"
                              : isCurrentCategory
                                ? "bg-gradient-to-r from-amber-500/15 to-amber-500/5 border border-amber-500/30"
                                : isUnlocked
                                  ? "bg-muted/40 hover:bg-muted/60 border border-border/30"
                                  : "bg-muted/20 border border-border/20 cursor-not-allowed"
                          )}
                          whileHover={isUnlocked && !isStarted ? { scale: 1.01 } : {}}
                        >
                          {/* Category Number / Status Icon */}
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-300 shrink-0",
                            isStarted
                              ? "bg-primary text-primary-foreground"
                              : isCurrentCategory
                                ? "bg-amber-500/20 text-amber-500 border-2 border-amber-500/50"
                                : isUnlocked
                                  ? "bg-muted-foreground/20 text-muted-foreground"
                                  : "bg-muted-foreground/10 text-muted-foreground/40"
                          )}>
                            {isStarted ? (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                              >
                                <Check className="w-5 h-5" />
                              </motion.div>
                            ) : !isUnlocked ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              categoryIndex + 1
                            )}
                          </div>
                          
                          {/* Category Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-semibold text-base transition-all",
                                isStarted && "text-primary",
                                !isUnlocked && "text-muted-foreground/50"
                              )}>
                                {item.text}
                              </span>
                              {isCurrentCategory && !isStarted && (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-medium"
                                >
                                  Current
                                </motion.span>
                              )}
                              {/* Percentage Type Toggle */}
                              {hasSubItems && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCategoryPercentageType(selectedChecklist.id, item.id);
                                  }}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                                    item.percentageType === "fixed"
                                      ? "bg-blue-500/20 text-blue-500 hover:bg-blue-500/30"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  )}
                                  title={item.percentageType === "fixed" 
                                    ? "Fixed: Full category % when any sub-item is selected" 
                                    : "Conditional: Sum of selected sub-item percentages"
                                  }
                                >
                                  {item.percentageType === "fixed" ? "Fixed %" : "Sum %"}
                                </button>
                              )}
                            </div>
                            {hasSubItems && (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[150px]">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${subItemsTotal > 0 ? (subItemsCompleted / subItemsTotal) * 100 : 0}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className={cn(
                                      "h-full rounded-full",
                                      isStarted ? "bg-primary" : "bg-amber-500"
                                    )}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {subItemsCompleted}/{subItemsTotal}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Expand/Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {hasSubItems && isUnlocked && (
                              <motion.button
                                onClick={() => toggleExpandItem(item.id)}
                                className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              >
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </motion.button>
                            )}
                            
                            {/* Add Sub-item Button */}
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                setAddingSubItemTo(item.id);
                                setExpandedItems(prev => new Set(prev).add(item.id));
                              }}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                isUnlocked 
                                  ? "hover:bg-primary/20 text-muted-foreground hover:text-primary"
                                  : "opacity-30 cursor-not-allowed"
                              )}
                              disabled={!isUnlocked}
                              title="Add condition"
                            >
                              <Plus className="w-4 h-4" />
                            </motion.button>
                            
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => deleteItem(selectedChecklist.id, item.id)}
                              className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </motion.div>
                        
                        {/* Sub-items (Conditions) for this Category */}
                        <AnimatePresence>
                          {isUnlocked && isExpanded && (hasSubItems || addingSubItemTo === item.id) && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 25 }}
                              className="ml-6 pl-4 border-l-2 border-primary/30 space-y-2 overflow-hidden"
                            >
                              {item.subItems?.map((subItem, subIndex) => (
                                <motion.div
                                  key={subItem.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -10 }}
                                  transition={{ delay: subIndex * 0.03 }}
                                  className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg transition-all duration-200",
                                    subItem.checked 
                                      ? "bg-primary/10 border border-primary/20" 
                                      : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                                  )}
                                >
                                  <button
                                    onClick={() => toggleSubItem(selectedChecklist.id, item.id, subItem.id)}
                                    className={cn(
                                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                                      subItem.checked
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground/40 hover:border-primary"
                                    )}
                                  >
                                    {subItem.checked && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                      >
                                        <Check className="w-3 h-3" />
                                      </motion.div>
                                    )}
                                  </button>
                                  
                                  {editingSubItemId === subItem.id ? (
                                    <div className="flex-1 flex gap-1">
                                      <Input
                                        value={editingSubItemText}
                                        onChange={(e) => setEditingSubItemText(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            updateSubItemText(selectedChecklist.id, item.id, subItem.id, editingSubItemText);
                                          } else if (e.key === 'Escape') {
                                            setEditingSubItemId(null);
                                            setEditingSubItemText("");
                                          }
                                        }}
                                        onBlur={() => {
                                          if (editingSubItemText.trim()) {
                                            updateSubItemText(selectedChecklist.id, item.id, subItem.id, editingSubItemText);
                                          } else {
                                            setEditingSubItemId(null);
                                          }
                                        }}
                                        className="h-7 text-sm bg-background/50"
                                        autoFocus
                                      />
                                    </div>
                                  ) : (
                                    <span 
                                      className={cn(
                                        "flex-1 text-sm transition-all cursor-pointer hover:text-primary",
                                        subItem.checked && "line-through text-muted-foreground"
                                      )}
                                      onClick={() => {
                                        setEditingSubItemId(subItem.id);
                                        setEditingSubItemText(subItem.text);
                                      }}
                                    >
                                      {subItem.text}
                                    </span>
                                  )}
                                  
                                  {/* Sub-item Percentage Editor */}
                                  {editingSubItemPercentageId === subItem.id ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={editingSubItemPercentage}
                                        onChange={(e) => setEditingSubItemPercentage(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            updateSubItemPercentage(selectedChecklist.id, item.id, subItem.id, parseInt(editingSubItemPercentage) || 0);
                                          } else if (e.key === 'Escape') {
                                            setEditingSubItemPercentageId(null);
                                          }
                                        }}
                                        onBlur={() => updateSubItemPercentage(selectedChecklist.id, item.id, subItem.id, parseInt(editingSubItemPercentage) || 0)}
                                        className="w-14 h-7 text-xs text-center p-1"
                                        autoFocus
                                      />
                                      <span className="text-xs text-muted-foreground">%</span>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => startEditingSubItemPercentage(subItem.id, subItem.percentage, item.subItems?.length || 1)}
                                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                      title="Edit percentage weight"
                                    >
                                      <Percent className="w-3 h-3" />
                                      <span>{subItem.percentage ?? Math.round(100 / (item.subItems?.length || 1))}%</span>
                                    </button>
                                  )}
                                  
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => deleteSubItem(selectedChecklist.id, item.id, subItem.id)}
                                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground/50 hover:text-destructive transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </motion.button>
                                </motion.div>
                              ))}
                              
                              {/* Add New Condition Input */}
                              {addingSubItemTo === item.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="flex gap-2"
                                >
                                  <Input
                                    placeholder="Add condition (e.g., Uptrend, Downtrend)..."
                                    value={newSubItemText}
                                    onChange={(e) => setNewSubItemText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        addSubItem(selectedChecklist.id, item.id);
                                      } else if (e.key === 'Escape') {
                                        setAddingSubItemTo(null);
                                        setNewSubItemText("");
                                      }
                                    }}
                                    className="h-9 text-sm bg-background/50 border-primary/30"
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => addSubItem(selectedChecklist.id, item.id)}
                                    className="h-9 px-3"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setAddingSubItemTo(null);
                                      setNewSubItemText("");
                                    }}
                                    className="h-9 px-3"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </motion.div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              /* FIXED CHECKLIST - Original View */
              <Reorder.Group 
                axis="y" 
                values={selectedChecklist.items} 
                onReorder={(newItems) => updateChecklist(selectedChecklist.id, { items: newItems })}
                className="space-y-2"
              >
                <AnimatePresence mode="popLayout">
                  {selectedChecklist.items.map((item: ChecklistItem) => {
                    return (
                      <Reorder.Item
                        key={item.id}
                        value={item}
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        whileDrag={{ 
                          scale: 1.02, 
                          boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                          zIndex: 50
                        }}
                        transition={{ 
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                          opacity: { duration: 0.2 }
                        }}
                        className="space-y-1"
                      >
                        {/* Main Item */}
                        <div
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg transition-colors duration-200 cursor-grab active:cursor-grabbing",
                            item.checked 
                              ? "bg-primary/10" 
                              : "bg-muted/30 hover:bg-muted/50"
                          )}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                          
                          <button
                            onClick={() => toggleItem(selectedChecklist.id, item.id)}
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                              item.checked
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/50 hover:border-primary"
                            )}
                          >
                            {item.checked && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              >
                                <Check className="w-3 h-3" />
                              </motion.div>
                            )}
                          </button>
                          <span className={cn(
                            "flex-1 text-sm transition-all",
                            item.checked && "line-through text-muted-foreground"
                          )}>
                            {item.text}
                          </span>
                          
                          {/* Percentage Editor */}
                          {editingItemId === item.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={editingPercentage}
                                onChange={(e) => setEditingPercentage(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateItemPercentage(selectedChecklist.id, item.id, parseInt(editingPercentage) || 0);
                                  } else if (e.key === 'Escape') {
                                    setEditingItemId(null);
                                  }
                                }}
                                onBlur={() => updateItemPercentage(selectedChecklist.id, item.id, parseInt(editingPercentage) || 0)}
                                className="w-16 h-7 text-xs text-center p-1"
                                autoFocus
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditingPercentage(item.id, item.percentage, selectedChecklist.items.length)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                              title="Edit percentage weight"
                            >
                              <Percent className="w-3 h-3" />
                              <span>{item.percentage ?? Math.round(100 / selectedChecklist.items.length)}%</span>
                            </button>
                          )}
                          
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => deleteItem(selectedChecklist.id, item.id)}
                            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </AnimatePresence>
              </Reorder.Group>
            )}

            {/* Add New Item/Category */}
            <div className="pt-2">
              {addingItemToChecklist === selectedChecklist.id ? (
                <div className="flex gap-2 animate-fade-in">
                  <Input
                    placeholder={selectedChecklist.type === "conditional" 
                      ? "Add new category (e.g., Trend, Structure, Entry)..." 
                      : "Add new item..."}
                    value={newItemTexts[selectedChecklist.id] || ""}
                    onChange={(e) => setNewItemTexts({ ...newItemTexts, [selectedChecklist.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addItem(selectedChecklist.id);
                        setAddingItemToChecklist(null);
                      } else if (e.key === 'Escape') {
                        setAddingItemToChecklist(null);
                        setNewItemTexts({ ...newItemTexts, [selectedChecklist.id]: "" });
                      }
                    }}
                    className="bg-background/50 border-border/50 h-9 text-sm"
                    autoFocus
                  />
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => {
                      addItem(selectedChecklist.id);
                      setAddingItemToChecklist(null);
                    }}
                    className="shrink-0"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setAddingItemToChecklist(null);
                      setNewItemTexts({ ...newItemTexts, [selectedChecklist.id]: "" });
                    }}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setAddingItemToChecklist(selectedChecklist.id)}
                  className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground border border-dashed border-border/50 hover:border-primary/50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {selectedChecklist.type === "conditional" ? "Add Category" : "Add Item"}
                </Button>
              )}
            </div>
          </div>
            </div>
          )}
        </div>

        {/* Right Side - Metrics Panel */}
        {selectedChecklist && selectedMetrics && (
          <div className="w-80 flex-shrink-0 space-y-4 animate-fade-in">
            {/* Profitability Chart */}
            <div className="glass rounded-xl p-5 border border-border/40 relative overflow-hidden group hover:border-primary/30 transition-all duration-300 hover:shadow-glow-sm">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Checklist Performance</h3>
                    <p className="text-[10px] text-muted-foreground">{selectedChecklist.name}</p>
                  </div>
                </div>
                
                {selectedMetrics.totalTrades > 0 ? (
                  <>
                    <div className="h-52 relative">
                      {/* Glow effect behind chart */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={cn(
                          "w-24 h-24 rounded-full blur-2xl opacity-30 transition-all duration-1000",
                          selectedMetrics.winRate >= 50 ? "bg-primary" : "bg-destructive"
                        )} />
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Wins', value: selectedMetrics.winningTrades, color: 'hsl(var(--primary))' },
                              { name: 'Losses', value: selectedMetrics.losingTrades, color: 'hsl(var(--destructive))' },
                            ]}
                            cx="50%"
                            cy="45%"
                            innerRadius={60}
                            outerRadius={72}
                            paddingAngle={6}
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={800}
                            animationEasing="ease-out"
                            strokeWidth={0}
                            cornerRadius={8}
                          >
                            <Cell fill="hsl(var(--primary))" />
                            <Cell fill="hsl(var(--destructive))" />
                          </Pie>
                          <Legend 
                            verticalAlign="bottom" 
                            height={40}
                            content={({ payload }) => (
                              <div className="flex items-center justify-center gap-4 mt-2">
                                {payload?.map((entry, index) => (
                                  <div 
                                    key={index} 
                                    className={cn(
                                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105",
                                      entry.value === 'Wins' 
                                        ? "bg-primary/15 text-primary" 
                                        : "bg-destructive/15 text-destructive"
                                    )}
                                  >
                                    <span 
                                      className={cn(
                                        "w-2.5 h-2.5 rounded-full",
                                        entry.value === 'Wins' ? "bg-primary" : "bg-destructive"
                                      )}
                                    />
                                    {entry.value}
                                  </div>
                                ))}
                              </div>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center text */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ bottom: '40px', top: '0' }}>
                        <div className="text-center">
                          <div className={cn(
                            "text-2xl font-bold transition-all duration-500",
                            selectedMetrics.winRate >= 50 ? "text-primary" : "text-destructive"
                          )}>
                            {selectedMetrics.winRate.toFixed(0)}%
                          </div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Win Rate</div>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid with staggered animation */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-muted/30 rounded-xl p-3 text-center hover:bg-muted/50 transition-all duration-300 hover:scale-105 cursor-default animate-fade-in" style={{ animationDelay: '100ms' }}>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Trades</div>
                        <div className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                          {selectedMetrics.totalTrades}
                        </div>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 text-center hover:bg-muted/50 transition-all duration-300 hover:scale-105 cursor-default animate-fade-in" style={{ animationDelay: '150ms' }}>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Win Rate</div>
                        <div className={cn(
                          "text-xl font-bold",
                          selectedMetrics.winRate >= 50 ? "text-primary" : "text-destructive"
                        )}>
                          {selectedMetrics.winRate.toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-primary/10 rounded-xl p-3 text-center hover:bg-primary/20 transition-all duration-300 hover:scale-105 cursor-default group/stat animate-fade-in" style={{ animationDelay: '200ms' }}>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrendingUp className="w-3 h-3 text-primary group-hover/stat:animate-bounce" />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Wins</span>
                        </div>
                        <div className="text-xl font-bold text-primary">{selectedMetrics.winningTrades}</div>
                      </div>
                      <div className="bg-destructive/10 rounded-xl p-3 text-center hover:bg-destructive/20 transition-all duration-300 hover:scale-105 cursor-default group/stat animate-fade-in" style={{ animationDelay: '250ms' }}>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrendingDown className="w-3 h-3 text-destructive group-hover/stat:animate-bounce" />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Losses</span>
                        </div>
                        <div className="text-xl font-bold text-destructive">{selectedMetrics.losingTrades}</div>
                      </div>
                    </div>

                    {/* Total P&L with enhanced styling */}
                    <div className={cn(
                      "mt-4 p-4 rounded-xl text-center relative overflow-hidden group/pnl transition-all duration-300 hover:scale-[1.02] animate-fade-in",
                      selectedMetrics.totalPnL >= 0 
                        ? "bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5" 
                        : "bg-gradient-to-br from-destructive/20 via-destructive/10 to-destructive/5"
                    )} style={{ animationDelay: '300ms' }}>
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover/pnl:translate-x-[100%] transition-transform duration-700" />
                      
                      <div className="relative z-10">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Total P&L</div>
                        <div className={cn(
                          "text-3xl font-bold font-mono tracking-tight transition-all duration-300",
                          selectedMetrics.totalPnL >= 0 ? "text-primary" : "text-destructive"
                        )}>
                          {selectedMetrics.totalPnL >= 0 ? "+" : ""}${selectedMetrics.totalPnL.toFixed(2)}
                        </div>
                        <div className={cn(
                          "mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                          selectedMetrics.totalPnL >= 0 
                            ? "bg-primary/20 text-primary" 
                            : "bg-destructive/20 text-destructive"
                        )}>
                          {selectedMetrics.totalPnL >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {selectedMetrics.totalPnL >= 0 ? "Profitable" : "In drawdown"}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No trades linked yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px] mx-auto">
                      Select this checklist when journaling trades to track performance
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
