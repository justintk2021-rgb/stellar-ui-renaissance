-- Add grade_criteria column to store custom grade thresholds
-- This stores the minimum percentage required for each grade (A, B, C, D)
-- Example: { "A": 90, "B": 75, "C": 60, "D": 0 }
COMMENT ON COLUMN public.checklists.items IS 'Stores checklist items and configuration including optional grade_criteria for custom grading thresholds';