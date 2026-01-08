import { GradeCriteria, DEFAULT_GRADE_CRITERIA } from "@/hooks/useChecklists";

export interface GradeResult {
  grade: string;
  gradeLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Get grade based on percentage and optional custom criteria
 * If no custom criteria is provided, uses default thresholds (A=90, B=75, C=60, D=0)
 */
export function getGradeFromPercentage(
  percentage: number,
  gradeCriteria?: GradeCriteria
): GradeResult {
  const criteria = gradeCriteria || DEFAULT_GRADE_CRITERIA;
  
  if (percentage >= criteria.A) {
    return {
      grade: "A",
      gradeLabel: "A Setup",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/20",
      borderColor: "border-emerald-500/30",
    };
  }
  if (percentage >= criteria.B) {
    return {
      grade: "B",
      gradeLabel: "B Setup",
      color: "text-blue-500",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/30",
    };
  }
  if (percentage >= criteria.C) {
    return {
      grade: "C",
      gradeLabel: "C Setup",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/20",
      borderColor: "border-yellow-500/30",
    };
  }
  return {
    grade: "D",
    gradeLabel: "D Setup",
    color: "text-red-500",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
  };
}
