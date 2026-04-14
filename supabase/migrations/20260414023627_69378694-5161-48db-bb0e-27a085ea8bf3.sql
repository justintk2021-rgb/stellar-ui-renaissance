ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS swap numeric DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS commission numeric DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS open_price numeric DEFAULT NULL;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS close_price numeric DEFAULT NULL;