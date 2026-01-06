-- Add checklist_state column to store the state of checklist items at trade time
ALTER TABLE public.trades 
ADD COLUMN checklist_state JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.trades.checklist_state IS 'Stores the checklist items and their checked state at the time of trade entry';