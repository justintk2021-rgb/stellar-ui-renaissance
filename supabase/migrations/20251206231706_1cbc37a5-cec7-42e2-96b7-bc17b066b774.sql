-- Create checklists table
CREATE TABLE public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own checklists"
ON public.checklists
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checklists"
ON public.checklists
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklists"
ON public.checklists
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checklists"
ON public.checklists
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_checklists_updated_at
BEFORE UPDATE ON public.checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();