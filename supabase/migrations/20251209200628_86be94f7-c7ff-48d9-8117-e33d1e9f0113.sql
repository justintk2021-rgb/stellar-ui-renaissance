-- Add checklist_id column to trades table to link trades to checklists
ALTER TABLE public.trades 
ADD COLUMN checklist_id uuid REFERENCES public.checklists(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_trades_checklist_id ON public.trades(checklist_id);