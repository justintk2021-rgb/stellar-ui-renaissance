-- Add notebook_font column to user_settings table
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notebook_font TEXT DEFAULT 'inter';