import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { X, ClipboardCheck, Award, ChevronRight, GitBranch, ListChecks, Plus, Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChecklistItemState, ChecklistSubItemState, ChecklistChildState } from "@/types/trade";
import { ChecklistType, ChecklistItem, ChecklistSubItem, ConditionalSubItem } from "@/hooks/useChecklists";

interface Checklist {
  id: string;
  name: string;
  type: ChecklistType;
  items: ChecklistItem[];
}

interface ChecklistPopupProps {
  isOpen: boolean;
  onClose: () => void;
  checklist: Checklist;
  onConfirm: (items: ChecklistItemState[]) => void;
  initialState?: ChecklistItemState[];
}

function getGrade(percentage: number): { grade: string; color: string; bgColor: string } {
  if (percentage >= 90) return { grade: "A Setup", color: "text-emerald-500", bgColor: "bg-emerald-500/20" };
  if (percentage >= 75) return { grade: "B Setup", color: "text-blue-500", bgColor: "bg-blue-500/20" };
  if (percentage >= 60) return { grade: "C Setup", color: "text-yellow-500", bgColor: "bg-yellow-500/20" };
  return { grade: "D Setup", color: "text-red-500", bgColor: "bg-red-500/20" };
}

// Convert checklist sub-items to state format
const convertSubItemsToState = (subItems?: ChecklistSubItem[]): ChecklistSubItemState[] | undefined => {
  if (!subItems) return undefined;
  return subItems.map(sub => ({
    id: sub.id,
    text: sub.text,
    checked: false,
    children: convertChildrenToState(sub.children),
  }));
};

const convertChildrenToState = (children?: ConditionalSubItem[]): ChecklistChildState[] | undefined => {
  if (!children) return undefined;
  return children.map(child => ({
    id: child.id,
    text: child.text,
    checked: false,
    children: convertChildrenToState(child.children),
  }));
};

// Merge initial state with checklist structure
const mergeWithInitialState = (
  subItems: ChecklistSubItemState[] | undefined,
  initialSubItems: ChecklistSubItemState[] | undefined
): ChecklistSubItemState[] | undefined => {
  if (!subItems) return undefined;
  if (!initialSubItems) return subItems;
  
  return subItems.map(sub => {
    const initial = initialSubItems.find(i => i.id === sub.id);
    return {
      ...sub,
      checked: initial?.checked ?? sub.checked,
      children: mergeChildrenWithInitial(sub.children, initial?.children),
    };
  });
};

const mergeChildrenWithInitial = (
  children: ChecklistChildState[] | undefined,
  initialChildren: ChecklistChildState[] | undefined
): ChecklistChildState[] | undefined => {
  if (!children) return undefined;
  if (!initialChildren) return children;
  
  return children.map(child => {
    const initial = initialChildren.find(i => i.id === child.id);
    return {
      ...child,
      checked: initial?.checked ?? child.checked,
      children: mergeChildrenWithInitial(child.children, initial?.children),
    };
  });
};

export function ChecklistPopup({ isOpen, onClose, checklist, onConfirm, initialState }: ChecklistPopupProps) {
  const [items, setItems] = useState<ChecklistItemState[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && checklist) {
      if (initialState && initialState.length > 0) {
        // Merge initial state with current checklist structure
        const merged = checklist.items.map(item => {
          const initial = initialState.find(i => i.id === item.id);
          const subItems = convertSubItemsToState(item.subItems);
          return {
            id: item.id,
            text: item.text,
            checked: initial?.checked ?? false,
            percentage: item.percentage,
            subItems: mergeWithInitialState(subItems, initial?.subItems),
          };
        });
        setItems(merged);
        
        // Auto-expand checked items
        const expanded = new Set<string>();
        merged.forEach(item => {
          if (item.checked && item.subItems?.length) {
            expanded.add(item.id);
          }
        });
        setExpandedItems(expanded);
      } else {
        setItems(checklist.items.map(item => ({
          id: item.id,
          text: item.text,
          checked: false,
          percentage: item.percentage,
          subItems: convertSubItemsToState(item.subItems),
        })));
        setExpandedItems(new Set());
      }
    }
  }, [isOpen, checklist, initialState]);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newChecked = !item.checked;
        // Auto-expand when checking in conditional mode
        if (newChecked && checklist.type === "conditional" && item.subItems?.length) {
          setExpandedItems(prev => new Set(prev).add(id));
        }
        return { ...item, checked: newChecked };
      }
      return item;
    }));
  };

  const toggleSubItem = (itemId: string, subItemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId && item.subItems) {
        return {
          ...item,
          subItems: item.subItems.map(sub => {
            if (sub.id === subItemId) {
              const newChecked = !sub.checked;
              if (newChecked && checklist.type === "conditional" && sub.children?.length) {
                setExpandedItems(prev => new Set(prev).add(subItemId));
              }
              return { ...sub, checked: newChecked };
            }
            return sub;
          }),
        };
      }
      return item;
    }));
  };

  const toggleNestedChild = (itemId: string, path: string[]) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId && item.subItems) {
        return {
          ...item,
          subItems: toggleInSubItems(item.subItems, path, 0),
        };
      }
      return item;
    }));
  };

  const toggleInSubItems = (subItems: ChecklistSubItemState[], path: string[], index: number): ChecklistSubItemState[] => {
    return subItems.map(sub => {
      if (sub.id === path[index]) {
        if (index === path.length - 1) {
          const newChecked = !sub.checked;
          if (newChecked && sub.children?.length) {
            setExpandedItems(prev => new Set(prev).add(sub.id));
          }
          return { ...sub, checked: newChecked };
        } else if (sub.children) {
          return { ...sub, children: toggleInChildren(sub.children, path, index + 1) };
        }
      }
      return sub;
    });
  };

  const toggleInChildren = (children: ChecklistChildState[], path: string[], index: number): ChecklistChildState[] => {
    return children.map(child => {
      if (child.id === path[index]) {
        if (index === path.length - 1) {
          const newChecked = !child.checked;
          if (newChecked && child.children?.length) {
            setExpandedItems(prev => new Set(prev).add(child.id));
          }
          return { ...child, checked: newChecked };
        } else if (child.children) {
          return { ...child, children: toggleInChildren(child.children, path, index + 1) };
        }
      }
      return child;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Sequential category helpers for conditional checklists
  // A category is "started" if at least one sub-item is checked (unlocks next category)
  const isCategoryStarted = (item: ChecklistItemState): boolean => {
    if (!item.subItems || item.subItems.length === 0) return item.checked;
    return item.subItems.some(sub => sub.checked);
  };

  const getUnlockedCategoryIndex = (): number => {
    for (let i = 0; i < items.length; i++) {
      if (!isCategoryStarted(items[i])) {
        return i;
      }
    }
    return items.length;
  };

  const isCategoryUnlocked = (categoryIndex: number): boolean => {
    return categoryIndex <= getUnlockedCategoryIndex();
  };

  const getStartedCategoriesCount = (): number => {
    return items.filter(item => isCategoryStarted(item)).length;
  };

  // Count all checked items recursively for conditional checklists
  const countNestedChecked = (children?: ChecklistChildState[]): { total: number; checked: number } => {
    if (!children) return { total: 0, checked: 0 };
    let total = 0;
    let checked = 0;
    children.forEach(child => {
      total++;
      if (child.checked) checked++;
      const nested = countNestedChecked(child.children);
      total += nested.total;
      checked += nested.checked;
    });
    return { total, checked };
  };

  const getCompletionPercentage = (): number => {
    if (items.length === 0) return 0;
    
    if (checklist.type === "conditional") {
      // Sequential conditional: each category contributes its weight
      // Sub-items use their custom percentages - users only check relevant ones
      let totalPercentage = 0;
      const categoryWeight = 100 / items.length;
      
      items.forEach((item, index) => {
        if (!isCategoryUnlocked(index)) return;
        
        if (item.subItems && item.subItems.length > 0) {
          // Sum the percentages of checked sub-items
          const checkedSubItems = item.subItems.filter(sub => sub.checked);
          const subItemPercentages = checkedSubItems.reduce((sum, sub) => {
            return sum + (sub.percentage ?? Math.round(100 / item.subItems!.length));
          }, 0);
          totalPercentage += (subItemPercentages / 100) * categoryWeight;
        } else if (item.checked) {
          totalPercentage += categoryWeight;
        }
      });
      
      return totalPercentage;
    }
    
    // Fixed checklist logic
    const hasCustomPercentages = items.some(item => item.percentage !== undefined);
    
    if (hasCustomPercentages) {
      let totalPercentage = 0;
      items.forEach(item => {
        const itemPercentage = item.percentage ?? Math.round(100 / items.length);
        if (item.subItems && item.subItems.length > 0) {
          if (item.checked) {
            // Sum the percentages of checked sub-items only
            const checkedSubItems = item.subItems.filter(sub => sub.checked);
            const subItemPercentages = checkedSubItems.reduce((sum, sub) => {
              return sum + (sub.percentage ?? Math.round(100 / item.subItems!.length));
            }, 0);
            totalPercentage += itemPercentage * (subItemPercentages / 100);
          }
        } else if (item.checked) {
          totalPercentage += itemPercentage;
        }
      });
      return Math.min(100, totalPercentage);
    }
    
    // Default equal distribution - sum checked sub-item percentages
    let totalPercentage = 0;
    const itemWeight = 100 / items.length;
    
    items.forEach(item => {
      if (item.subItems && item.subItems.length > 0) {
        if (item.checked) {
          const checkedSubItems = item.subItems.filter(sub => sub.checked);
          const subItemPercentages = checkedSubItems.reduce((sum, sub) => {
            return sum + (sub.percentage ?? Math.round(100 / item.subItems!.length));
          }, 0);
          totalPercentage += itemWeight * (subItemPercentages / 100);
        }
      } else {
        if (item.checked) totalPercentage += itemWeight;
      }
    });
    
    return totalPercentage;
  };

  const completionPercentage = getCompletionPercentage();
  const { grade, color, bgColor } = getGrade(completionPercentage);

  const handleConfirm = () => {
    onConfirm(items);
    onClose();
  };

  // Render nested children recursively
  const renderNestedChildren = (
    children: ChecklistChildState[],
    itemId: string,
    parentPath: string[],
    depth: number
  ) => {
    return (
      <div className="space-y-1.5">
        {children.map((child, childIndex) => {
          const currentPath = [...parentPath, child.id];
          const hasChildren = child.children && child.children.length > 0;
          const isExpanded = expandedItems.has(child.id);
          const showChildren = checklist.type === "conditional" ? child.checked && hasChildren : isExpanded && hasChildren;
          
          return (
            <motion.div
              key={child.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: childIndex * 0.02 }}
            >
              <div
                onClick={() => toggleNestedChild(itemId, currentPath)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all",
                  "border border-border/20 hover:border-primary/20",
                  child.checked 
                    ? "bg-primary/5 border-primary/20" 
                    : "bg-muted/20 hover:bg-muted/30"
                )}
              >
                {hasChildren && checklist.type === "conditional" && (
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(child.id);
                    }}
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    className="p-0.5 shrink-0"
                  >
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  </motion.button>
                )}
                <Checkbox
                  checked={child.checked}
                  onCheckedChange={() => toggleNestedChild(itemId, currentPath)}
                  className="pointer-events-none w-3.5 h-3.5"
                />
                <span className={cn(
                  "flex-1 text-xs transition-all",
                  child.checked && "line-through text-muted-foreground"
                )}>
                  {child.text}
                </span>
                {hasChildren && (
                  <span className="text-[9px] text-muted-foreground">
                    {child.children?.filter(c => c.checked).length}/{child.children?.length}
                  </span>
                )}
              </div>
              
              {/* Deeper nested children */}
              <AnimatePresence>
                {showChildren && child.children && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "ml-4 pl-3 mt-1 border-l-2",
                      checklist.type === "conditional" ? "border-amber-500/30" : "border-primary/20"
                    )}
                  >
                    {renderNestedChildren(child.children, itemId, currentPath, depth + 1)}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    );
  };

  // Render sub-items
  const renderSubItems = (item: ChecklistItemState) => {
    if (!item.subItems?.length) return null;
    
    const showSubItems = checklist.type === "conditional" 
      ? item.checked 
      : expandedItems.has(item.id) || item.checked;
    
    return (
      <AnimatePresence>
        {showSubItems && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn(
              "ml-8 pl-3 mt-2 border-l-2 space-y-1.5",
              checklist.type === "conditional" ? "border-amber-500/30" : "border-primary/20"
            )}
          >
            {item.subItems.map((sub, subIndex) => {
              const hasChildren = sub.children && sub.children.length > 0;
              const isExpanded = expandedItems.has(sub.id);
              const showChildren = checklist.type === "conditional" ? sub.checked && hasChildren : isExpanded && hasChildren;
              
              return (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: subIndex * 0.03 }}
                >
                  <div
                    onClick={() => toggleSubItem(item.id, sub.id)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-md cursor-pointer transition-all",
                      "border border-border/20 hover:border-primary/20",
                      sub.checked 
                        ? "bg-primary/5 border-primary/20" 
                        : "bg-muted/20 hover:bg-muted/30"
                    )}
                  >
                    {hasChildren && checklist.type === "conditional" && (
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(sub.id);
                        }}
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        className="p-0.5 shrink-0"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </motion.button>
                    )}
                    <Checkbox
                      checked={sub.checked}
                      onCheckedChange={() => toggleSubItem(item.id, sub.id)}
                      className="pointer-events-none w-4 h-4"
                    />
                    <span className={cn(
                      "flex-1 text-xs transition-all",
                      sub.checked && "line-through text-muted-foreground"
                    )}>
                      {sub.text}
                    </span>
                    {hasChildren && (
                      <span className="text-[10px] text-muted-foreground">
                        {sub.children?.filter(c => c.checked).length}/{sub.children?.length}
                      </span>
                    )}
                  </div>
                  
                  {/* Nested children */}
                  <AnimatePresence>
                    {showChildren && sub.children && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn(
                          "ml-4 pl-3 mt-1 border-l-2",
                          checklist.type === "conditional" ? "border-amber-500/30" : "border-primary/20"
                        )}
                      >
                        {renderNestedChildren(sub.children, item.id, [sub.id], 0)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[150] bg-background/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[151] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-card rounded-2xl border border-border/40 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      checklist.type === "conditional" 
                        ? "bg-gradient-to-br from-amber-500/20 to-amber-500/5"
                        : "bg-gradient-to-br from-primary/20 to-primary/5"
                    )}>
                      {checklist.type === "conditional" ? (
                        <GitBranch className="w-5 h-5 text-amber-500" />
                      ) : (
                        <ClipboardCheck className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">{checklist.name}</h2>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-medium",
                          checklist.type === "conditional" 
                            ? "bg-amber-500/10 text-amber-500" 
                            : "bg-primary/10 text-primary"
                        )}>
                          {checklist.type === "conditional" ? "Branching" : "Fixed"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {checklist.type === "conditional" 
                          ? "Check items to reveal conditions"
                          : "Check off completed criteria"
                        }
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 rounded-full hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Progress & Grade */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completion</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium">{completionPercentage.toFixed(0)}%</span>
                      <motion.div
                        key={grade}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn("px-2 py-0.5 rounded-md text-xs font-bold", bgColor, color)}
                      >
                        <div className="flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          {grade}
                        </div>
                      </motion.div>
                    </div>
                  </div>
                  <Progress value={completionPercentage} className="h-2" />
                </div>
              </div>

              {/* Checklist Items */}
              <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-2">
                {checklist.type === "conditional" ? (
                  /* Sequential Conditional View */
                  <div className="space-y-3">
                    {/* Category Progress */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/20">
                      <span>Category Progress</span>
                      <span className="font-medium">{getStartedCategoriesCount()} / {items.length}</span>
                    </div>
                    
                    {items.map((item, index) => {
                      const isUnlocked = isCategoryUnlocked(index);
                      const isStarted = isCategoryStarted(item);
                      const isCurrentCategory = index === getUnlockedCategoryIndex();
                      const hasSubItems = item.subItems && item.subItems.length > 0;
                      const subItemsCompleted = item.subItems?.filter(s => s.checked).length || 0;
                      const subItemsTotal = item.subItems?.length || 0;
                      
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ 
                            opacity: isUnlocked ? 1 : 0.4, 
                            y: 0 
                          }}
                          transition={{ delay: index * 0.05 }}
                          className="space-y-2"
                        >
                          {/* Category Header */}
                          <div
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl transition-all",
                              isStarted
                                ? "bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30"
                                : isCurrentCategory
                                  ? "bg-gradient-to-r from-amber-500/15 to-amber-500/5 border border-amber-500/30"
                                  : isUnlocked
                                    ? "bg-muted/40 border border-border/30"
                                    : "bg-muted/20 border border-border/10 cursor-not-allowed"
                            )}
                          >
                            {/* Category Number / Status */}
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0",
                              isStarted
                                ? "bg-primary text-primary-foreground"
                                : isCurrentCategory
                                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/50"
                                  : isUnlocked
                                    ? "bg-muted-foreground/20 text-muted-foreground"
                                    : "bg-muted-foreground/10 text-muted-foreground/40"
                            )}>
                              {isStarted ? (
                                <Check className="w-4 h-4" />
                              ) : !isUnlocked ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "font-medium text-sm",
                                  isStarted && "text-primary",
                                  !isUnlocked && "text-muted-foreground/50"
                                )}>
                                  {item.text}
                                </span>
                                {isCurrentCategory && !isStarted && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[9px] font-medium">
                                    Current
                                  </span>
                                )}
                              </div>
                              {hasSubItems && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[100px]">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${subItemsTotal > 0 ? (subItemsCompleted / subItemsTotal) * 100 : 0}%` }}
                                      className={cn(
                                        "h-full rounded-full",
                                        isStarted ? "bg-primary" : "bg-amber-500"
                                      )}
                                    />
                                  </div>
                                  <span className="text-[9px] text-muted-foreground">
                                    {subItemsCompleted}/{subItemsTotal}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Sub-items for this Category */}
                          <AnimatePresence>
                            {isUnlocked && hasSubItems && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="ml-5 pl-3 border-l-2 border-primary/30 space-y-1.5"
                              >
                                {item.subItems?.map((sub, subIndex) => (
                                  <motion.div
                                    key={sub.id}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: subIndex * 0.02 }}
                                    onClick={() => toggleSubItem(item.id, sub.id)}
                                    className={cn(
                                      "flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all",
                                      "border border-border/20 hover:border-primary/20",
                                      sub.checked 
                                        ? "bg-primary/10 border-primary/20" 
                                        : "bg-muted/20 hover:bg-muted/30"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                      sub.checked
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground/40"
                                    )}>
                                      {sub.checked && <Check className="w-2.5 h-2.5" />}
                                    </div>
                                    <span className={cn(
                                      "flex-1 text-xs transition-all",
                                      sub.checked && "line-through text-muted-foreground"
                                    )}>
                                      {sub.text}
                                    </span>
                                  </motion.div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  /* Fixed Checklist - Simple View without sub-items */
                  items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <div
                        onClick={() => toggleItem(item.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                          "border border-border/30 hover:border-primary/30",
                          item.checked 
                            ? "bg-primary/10 border-primary/30" 
                            : "bg-muted/30 hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="pointer-events-none"
                        />
                        <span className={cn(
                          "flex-1 text-sm transition-all",
                          item.checked && "line-through text-muted-foreground"
                        )}>
                          {item.text}
                        </span>
                        
                        {item.percentage !== undefined && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {item.percentage}%
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/30 flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose} className="text-sm">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 shadow-glow-sm text-sm font-semibold"
                >
                  <ClipboardCheck className="w-4 h-4 mr-1" />
                  Confirm Checklist
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}