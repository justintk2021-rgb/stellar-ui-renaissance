import { GradeCriteria, ChecklistItem } from "@/hooks/useChecklists";
import { ChecklistItemState } from "@/types/trade";

export interface GradeResult {
  grade: string;
  gradeLabel: string;
  percentage: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

// Helper to get all checked item IDs from checklist state (including sub-items)
function getCheckedItemIds(items: ChecklistItemState[]): Set<string> {
  const checkedIds = new Set<string>();
  
  items.forEach(item => {
    if (item.checked) {
      checkedIds.add(item.id);
    }
    // Also check sub-items
    item.subItems?.forEach(sub => {
      if (sub.checked) {
        checkedIds.add(sub.id);
      }
      // Check nested children
      sub.children?.forEach(child => {
        if (child.checked) {
          checkedIds.add(child.id);
        }
      });
    });
  });
  
  return checkedIds;
}

// Helper to check if all required items for a grade are checked
function areAllItemsChecked(requiredIds: string[], checkedIds: Set<string>): boolean {
  if (requiredIds.length === 0) return false;
  return requiredIds.every(id => checkedIds.has(id));
}

// Default percentages for each grade (used when no custom percentage is set)
const DEFAULT_GRADE_PERCENTAGES = {
  A: 100,
  B: 80,
  C: 60,
  D: 40,
};

/**
 * Get grade based on item-based criteria
 * Checks from A down - first grade where ALL required items are checked wins
 * If no criteria defined, falls back to percentage-based calculation
 */
export function getGradeFromCriteria(
  checklistState: ChecklistItemState[],
  gradeCriteria?: GradeCriteria
): GradeResult {
  // If no criteria or all grades have empty item arrays, use percentage fallback
  const hasAnyCriteria = gradeCriteria && (
    gradeCriteria.A.items.length > 0 ||
    gradeCriteria.B.items.length > 0 ||
    gradeCriteria.C.items.length > 0 ||
    gradeCriteria.D.items.length > 0
  );
  
  if (!hasAnyCriteria) {
    // Fallback to percentage-based grading
    return getGradeFromPercentage(checklistState);
  }
  
  const checkedIds = getCheckedItemIds(checklistState);
  
  // Check grades from highest to lowest, using custom percentages from criteria
  if (areAllItemsChecked(gradeCriteria!.A.items, checkedIds)) {
    return {
      grade: "A",
      gradeLabel: "A Setup",
      percentage: gradeCriteria!.A.percentage ?? DEFAULT_GRADE_PERCENTAGES.A,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/20",
      borderColor: "border-emerald-500/30",
    };
  }
  
  if (areAllItemsChecked(gradeCriteria!.B.items, checkedIds)) {
    return {
      grade: "B",
      gradeLabel: "B Setup",
      percentage: gradeCriteria!.B.percentage ?? DEFAULT_GRADE_PERCENTAGES.B,
      color: "text-blue-500",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/30",
    };
  }
  
  if (areAllItemsChecked(gradeCriteria!.C.items, checkedIds)) {
    return {
      grade: "C",
      gradeLabel: "C Setup",
      percentage: gradeCriteria!.C.percentage ?? DEFAULT_GRADE_PERCENTAGES.C,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/20",
      borderColor: "border-yellow-500/30",
    };
  }
  
  // D is the default when nothing else matches
  // Check D criteria if defined, otherwise just return D
  if (gradeCriteria!.D.items.length === 0 || areAllItemsChecked(gradeCriteria!.D.items, checkedIds)) {
    return {
      grade: "D",
      gradeLabel: "D Setup",
      percentage: gradeCriteria!.D.percentage ?? DEFAULT_GRADE_PERCENTAGES.D,
      color: "text-red-500",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
    };
  }
  
  // Nothing matched - return D as fallback
  return {
    grade: "D",
    gradeLabel: "D Setup",
    percentage: 0,
    color: "text-red-500",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
  };
}

/**
 * Fallback percentage-based grading when no item criteria is defined
 */
export function getGradeFromPercentage(
  checklistState: ChecklistItemState[]
): GradeResult {
  if (checklistState.length === 0) {
    return {
      grade: "D",
      gradeLabel: "D Setup",
      percentage: 0,
      color: "text-red-500",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
    };
  }
  
  // Calculate percentage based on checked items
  const hasCustomPercentages = checklistState.some(item => item.percentage !== undefined);
  let percentage: number;
  
  if (hasCustomPercentages) {
    percentage = checklistState
      .filter(item => item.checked)
      .reduce((sum, item) => sum + (item.percentage || 0), 0);
  } else {
    const checkedCount = checklistState.filter(item => item.checked).length;
    percentage = Math.round((checkedCount / checklistState.length) * 100);
  }
  
  // Determine grade from percentage
  if (percentage >= 90) {
    return {
      grade: "A",
      gradeLabel: "A Setup",
      percentage,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/20",
      borderColor: "border-emerald-500/30",
    };
  }
  if (percentage >= 75) {
    return {
      grade: "B",
      gradeLabel: "B Setup",
      percentage,
      color: "text-blue-500",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/30",
    };
  }
  if (percentage >= 60) {
    return {
      grade: "C",
      gradeLabel: "C Setup",
      percentage,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/20",
      borderColor: "border-yellow-500/30",
    };
  }
  return {
    grade: "D",
    gradeLabel: "D Setup",
    percentage,
    color: "text-red-500",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
  };
}

/**
 * Convert ChecklistItem[] to ChecklistItemState[] for grading
 */
export function convertItemsToState(items: ChecklistItem[]): ChecklistItemState[] {
  return items.map(item => ({
    id: item.id,
    text: item.text,
    checked: item.checked,
    percentage: item.percentage,
    percentageType: item.percentageType,
    subItems: item.subItems?.map(sub => ({
      id: sub.id,
      text: sub.text,
      checked: sub.checked,
      percentage: sub.percentage,
      children: sub.children?.map(child => ({
        id: child.id,
        text: child.text,
        checked: child.checked,
      })),
    })),
  }));
}
