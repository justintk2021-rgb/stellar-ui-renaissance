-- Playbook additions: A+ grading, market type tags, ideal setup image.
-- Existing RLS on trades and checklists already covers these columns.

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS grade TEXT CHECK (grade IN ('A+', 'A', 'B', 'C'));

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS market_type TEXT CHECK (market_type IN ('trending', 'ranging'));

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS ideal_image TEXT;
