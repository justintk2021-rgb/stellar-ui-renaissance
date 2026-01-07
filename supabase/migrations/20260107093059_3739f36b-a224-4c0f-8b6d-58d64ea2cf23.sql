-- Add notes column to checklists table for playbook strategy notes
ALTER TABLE public.checklists 
ADD COLUMN notes TEXT DEFAULT '';