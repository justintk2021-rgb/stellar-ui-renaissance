ALTER TABLE public.study_folders
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'individual';

ALTER TABLE public.study_notes
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'individual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_folders_category_check'
  ) THEN
    ALTER TABLE public.study_folders
      ADD CONSTRAINT study_folders_category_check
      CHECK (category IN ('individual', 'collaborative', 'case'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_notes_category_check'
  ) THEN
    ALTER TABLE public.study_notes
      ADD CONSTRAINT study_notes_category_check
      CHECK (category IN ('individual', 'collaborative', 'case'));
  END IF;
END $$;
