import { useState, useEffect } from "react";
import { Plus, Trash2, Check, Edit2, X, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
  createdAt: string;
  isExpanded: boolean;
}

export function PlaybookView() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [newChecklistName, setNewChecklistName] = useState("");
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistName, setEditingChecklistName] = useState("");
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});

  // Load checklists from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('atp_playbook_checklists');
    if (saved) {
      try {
        setChecklists(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse checklists:', e);
      }
    }
  }, []);

  // Save checklists to localStorage
  useEffect(() => {
    localStorage.setItem('atp_playbook_checklists', JSON.stringify(checklists));
  }, [checklists]);

  const createChecklist = () => {
    if (!newChecklistName.trim()) return;
    
    const newChecklist: Checklist = {
      id: Date.now().toString(),
      name: newChecklistName.trim(),
      items: [],
      createdAt: new Date().toISOString(),
      isExpanded: true,
    };
    
    setChecklists([newChecklist, ...checklists]);
    setNewChecklistName("");
  };

  const deleteChecklist = (id: string) => {
    setChecklists(checklists.filter(c => c.id !== id));
  };

  const toggleExpanded = (id: string) => {
    setChecklists(checklists.map(c => 
      c.id === id ? { ...c, isExpanded: !c.isExpanded } : c
    ));
  };

  const startEditingChecklist = (checklist: Checklist) => {
    setEditingChecklistId(checklist.id);
    setEditingChecklistName(checklist.name);
  };

  const saveChecklistName = (id: string) => {
    if (!editingChecklistName.trim()) return;
    setChecklists(checklists.map(c => 
      c.id === id ? { ...c, name: editingChecklistName.trim() } : c
    ));
    setEditingChecklistId(null);
    setEditingChecklistName("");
  };

  const addItem = (checklistId: string) => {
    const text = newItemTexts[checklistId]?.trim();
    if (!text) return;

    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text,
      checked: false,
    };

    setChecklists(checklists.map(c => 
      c.id === checklistId ? { ...c, items: [...c.items, newItem] } : c
    ));
    setNewItemTexts({ ...newItemTexts, [checklistId]: "" });
  };

  const toggleItem = (checklistId: string, itemId: string) => {
    setChecklists(checklists.map(c => 
      c.id === checklistId 
        ? { 
            ...c, 
            items: c.items.map(item => 
              item.id === itemId ? { ...item, checked: !item.checked } : item
            ) 
          } 
        : c
    ));
  };

  const deleteItem = (checklistId: string, itemId: string) => {
    setChecklists(checklists.map(c => 
      c.id === checklistId 
        ? { ...c, items: c.items.filter(item => item.id !== itemId) } 
        : c
    ));
  };

  const getCompletionPercentage = (checklist: Checklist) => {
    if (checklist.items.length === 0) return 0;
    const checked = checklist.items.filter(item => item.checked).length;
    return Math.round((checked / checklist.items.length) * 100);
  };

  const resetChecklist = (checklistId: string) => {
    setChecklists(checklists.map(c => 
      c.id === checklistId 
        ? { ...c, items: c.items.map(item => ({ ...item, checked: false })) } 
        : c
    ));
  };

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
      </div>

      {/* Create New Checklist */}
      <div className="glass rounded-xl p-5 border border-border/40">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Create New Checklist
        </h3>
        <div className="flex gap-3">
          <Input
            placeholder="Enter checklist name (e.g., Pre-Trade Checklist)"
            value={newChecklistName}
            onChange={(e) => setNewChecklistName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createChecklist()}
            className="bg-background/50 border-border/50"
          />
          <Button onClick={createChecklist} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </div>
      </div>

      {/* Checklists */}
      {checklists.length === 0 ? (
        <div className="glass rounded-xl p-12 border border-border/40 text-center">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Checklists Yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first trading checklist to get started
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const percentage = getCompletionPercentage(checklist);
            const isComplete = percentage === 100 && checklist.items.length > 0;
            
            return (
              <div 
                key={checklist.id} 
                className={cn(
                  "glass rounded-xl border transition-all duration-300",
                  isComplete ? "border-primary/50 bg-primary/5" : "border-border/40"
                )}
              >
                {/* Checklist Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleExpanded(checklist.id)}
                      className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      {checklist.isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    
                    {editingChecklistId === checklist.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingChecklistName}
                          onChange={(e) => setEditingChecklistName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveChecklistName(checklist.id)}
                          className="h-8 bg-background/50"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => saveChecklistName(checklist.id)}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingChecklistId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{checklist.name}</h3>
                        <button 
                          onClick={() => startEditingChecklist(checklist)}
                          className="p-1 rounded hover:bg-muted/50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Percentage Badge */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-500",
                            isComplete ? "bg-primary" : "bg-primary/70"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-sm font-bold min-w-[3rem] text-right",
                        isComplete ? "text-primary" : "text-muted-foreground"
                      )}>
                        {percentage}%
                      </span>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => resetChecklist(checklist.id)}
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
                      description={`Are you sure you want to delete "${checklist.name}"? This action cannot be undone.`}
                      confirmLabel="Delete"
                      variant="destructive"
                      onConfirm={() => deleteChecklist(checklist.id)}
                    />
                  </div>
                </div>

                {/* Checklist Items */}
                {checklist.isExpanded && (
                  <div className="px-4 pb-4 space-y-2">
                    {checklist.items.map((item) => (
                      <div 
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg transition-all duration-200",
                          item.checked 
                            ? "bg-primary/10 border border-primary/30" 
                            : "bg-muted/30 border border-transparent hover:bg-muted/50"
                        )}
                      >
                        <button
                          onClick={() => toggleItem(checklist.id, item.id)}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
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
                        <button
                          onClick={() => deleteItem(checklist.id, item.id)}
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {/* Add New Item */}
                    <div className="flex gap-2 pt-2">
                      <Input
                        placeholder="Add new item..."
                        value={newItemTexts[checklist.id] || ""}
                        onChange={(e) => setNewItemTexts({ ...newItemTexts, [checklist.id]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && addItem(checklist.id)}
                        className="bg-background/50 border-border/50 h-9 text-sm"
                      />
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => addItem(checklist.id)}
                        className="shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
