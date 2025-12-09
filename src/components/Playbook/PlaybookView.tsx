import { useState } from "react";
import { Plus, Trash2, Check, Edit2, X, ClipboardList, ChevronDown, Loader2, Percent } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChecklists } from "@/hooks/useChecklists";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number;
}

export function PlaybookView() {
  const { checklists, loading, isAuthenticated, createChecklist, updateChecklist, deleteChecklist } = useChecklists();
  const [newChecklistName, setNewChecklistName] = useState("");
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistName, setEditingChecklistName] = useState("");
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPercentage, setEditingPercentage] = useState<string>("");

  const selectedChecklist = checklists.find(c => c.id === selectedChecklistId) || null;

  const handleCreateChecklist = async () => {
    if (!newChecklistName.trim()) return;
    const newChecklist = await createChecklist(newChecklistName);
    if (newChecklist) {
      setSelectedChecklistId(newChecklist.id);
    }
    setNewChecklistName("");
    setIsCreateDialogOpen(false);
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

    const updatedItems = checklist.items.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    await updateChecklist(checklistId, { items: updatedItems });
  };

  const deleteItem = async (checklistId: string, itemId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const updatedItems = checklist.items.filter(item => item.id !== itemId);
    await updateChecklist(checklistId, { items: updatedItems });
  };

  const getCompletionPercentage = (items: ChecklistItem[]) => {
    if (items.length === 0) return 0;
    
    // Check if any items have custom percentages
    const hasCustomPercentages = items.some(item => item.percentage !== undefined);
    
    if (hasCustomPercentages) {
      // Use custom percentages - sum up the percentages of checked items
      const totalPercentage = items.reduce((sum, item) => {
        if (item.checked) {
          return sum + (item.percentage ?? Math.round(100 / items.length));
        }
        return sum;
      }, 0);
      return Math.min(100, Math.round(totalPercentage));
    } else {
      // Default equal distribution
      const checked = items.filter(item => item.checked).length;
      return Math.round((checked / items.length) * 100);
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

  const resetChecklist = async (checklistId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const resetItems = checklist.items.map(item => ({ ...item, checked: false }));
    await updateChecklist(checklistId, { items: resetItems });
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
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Checklist
        </Button>
      </div>

      {/* Create Checklist Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Checklist</DialogTitle>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
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
              <span className="truncate">
                {selectedChecklist ? selectedChecklist.name : "Select a checklist"}
              </span>
              <ChevronDown className="w-4 h-4 ml-2 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px] max-h-[300px] overflow-y-auto bg-popover">
            {checklists.map((checklist) => (
              <DropdownMenuItem
                key={checklist.id}
                onClick={() => setSelectedChecklistId(checklist.id)}
                className={cn(
                  "cursor-pointer",
                  selectedChecklistId === checklist.id && "bg-primary/10"
                )}
              >
                <span className="truncate">{checklist.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {getCompletionPercentage(checklist.items)}%
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

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
            getCompletionPercentage(selectedChecklist.items) === 100 && selectedChecklist.items.length > 0
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
                  <h3 className="font-semibold text-lg">{selectedChecklist.name}</h3>
                  <button 
                    onClick={() => startEditingChecklist(selectedChecklist.id, selectedChecklist.name)}
                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>

            {/* Percentage Badge & Actions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      getCompletionPercentage(selectedChecklist.items) === 100 && selectedChecklist.items.length > 0
                        ? "bg-primary" 
                        : "bg-primary/70"
                    )}
                    style={{ width: `${getCompletionPercentage(selectedChecklist.items)}%` }}
                  />
                </div>
                <span className={cn(
                  "text-sm font-bold min-w-[3rem] text-right",
                  getCompletionPercentage(selectedChecklist.items) === 100 && selectedChecklist.items.length > 0
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}>
                  {getCompletionPercentage(selectedChecklist.items)}%
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
              <div className="text-center py-8 text-muted-foreground text-sm">
                No items yet. Add your first item below.
              </div>
            ) : (
              selectedChecklist.items.map((item: ChecklistItem) => (
                <div 
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all duration-200",
                    item.checked 
                      ? "bg-primary/10" 
                      : "bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <button
                    onClick={() => toggleItem(selectedChecklist.id, item.id)}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                      item.checked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/50 hover:border-primary"
                    )}
                  >
                    {item.checked && <Check className="w-3 h-3" />}
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
                  
                  <button
                    onClick={() => deleteItem(selectedChecklist.id, item.id)}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}

            {/* Add New Item */}
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Add new item..."
                value={newItemTexts[selectedChecklist.id] || ""}
                onChange={(e) => setNewItemTexts({ ...newItemTexts, [selectedChecklist.id]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addItem(selectedChecklist.id)}
                className="bg-background/50 border-border/50 h-9 text-sm"
              />
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => addItem(selectedChecklist.id)}
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
