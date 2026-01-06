import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { X, ClipboardCheck, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChecklistItemState } from "@/types/trade";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number;
}

interface Checklist {
  id: string;
  name: string;
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

export function ChecklistPopup({ isOpen, onClose, checklist, onConfirm, initialState }: ChecklistPopupProps) {
  const [items, setItems] = useState<ChecklistItemState[]>([]);

  useEffect(() => {
    if (isOpen && checklist) {
      // Initialize from initialState or reset all items to unchecked
      if (initialState && initialState.length > 0) {
        setItems(initialState);
      } else {
        setItems(checklist.items.map(item => ({
          id: item.id,
          text: item.text,
          checked: false,
          percentage: item.percentage,
        })));
      }
    }
  }, [isOpen, checklist, initialState]);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const getCompletionPercentage = (): number => {
    if (items.length === 0) return 0;
    
    const hasCustomPercentages = items.some(item => item.percentage !== undefined);
    
    if (hasCustomPercentages) {
      const checkedPercentage = items
        .filter(item => item.checked)
        .reduce((sum, item) => sum + (item.percentage || 0), 0);
      return Math.min(100, checkedPercentage);
    }
    
    const checkedCount = items.filter(item => item.checked).length;
    return (checkedCount / items.length) * 100;
  };

  const completionPercentage = getCompletionPercentage();
  const { grade, color, bgColor } = getGrade(completionPercentage);

  const handleConfirm = () => {
    onConfirm(items);
    onClose();
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
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <ClipboardCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{checklist.name}</h2>
                      <p className="text-xs text-muted-foreground">Check off completed criteria</p>
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
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
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
                  </motion.div>
                ))}
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
