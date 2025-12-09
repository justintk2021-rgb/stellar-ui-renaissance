-- Create notebook_entries table
CREATE TABLE public.notebook_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  date TEXT NOT NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  folder_id TEXT,
  folder_color TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notebook entries"
ON public.notebook_entries
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notebook entries"
ON public.notebook_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notebook entries"
ON public.notebook_entries
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notebook entries"
ON public.notebook_entries
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_notebook_entries_updated_at
BEFORE UPDATE ON public.notebook_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_notebook_entries_user_id ON public.notebook_entries(user_id);
CREATE INDEX idx_notebook_entries_trade_id ON public.notebook_entries(trade_id);