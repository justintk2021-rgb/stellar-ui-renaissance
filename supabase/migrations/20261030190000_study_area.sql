-- Study Area. Separate from notebook_entries.

CREATE TABLE public.study_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.study_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.study_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.study_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.study_note_trades (
  note_id UUID NOT NULL REFERENCES public.study_notes(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, trade_id)
);

ALTER TABLE public.study_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_note_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own study folders"
ON public.study_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own study folders"
ON public.study_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own study folders"
ON public.study_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own study folders"
ON public.study_folders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own study notes"
ON public.study_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own study notes"
ON public.study_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own study notes"
ON public.study_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own study notes"
ON public.study_notes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view trades linked from their study notes"
ON public.study_note_trades FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.study_notes n
    WHERE n.id = note_id AND n.user_id = auth.uid()
  )
);
CREATE POLICY "Users can link their own trades to their study notes"
ON public.study_note_trades FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.study_notes n
    WHERE n.id = note_id AND n.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.trades t
    WHERE t.id = trade_id AND t.user_id = auth.uid()
  )
);
CREATE POLICY "Users can unlink trades from their study notes"
ON public.study_note_trades FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.study_notes n
    WHERE n.id = note_id AND n.user_id = auth.uid()
  )
);

CREATE TRIGGER update_study_folders_updated_at
BEFORE UPDATE ON public.study_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_study_notes_updated_at
BEFORE UPDATE ON public.study_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_study_folders_user_id ON public.study_folders(user_id);
CREATE INDEX idx_study_folders_parent_id ON public.study_folders(parent_id);
CREATE INDEX idx_study_notes_user_id ON public.study_notes(user_id);
CREATE INDEX idx_study_notes_folder_id ON public.study_notes(folder_id);
CREATE INDEX idx_study_note_trades_trade_id ON public.study_note_trades(trade_id);
