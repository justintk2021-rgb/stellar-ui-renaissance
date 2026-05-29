-- Store MT5 credentials entered from the website.
-- Passwords are encrypted by the mt5-bridge Edge Function before being stored.

ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS mt5_login text,
  ADD COLUMN IF NOT EXISTS mt5_server text,
  ADD COLUMN IF NOT EXISTS mt5_password_enc text;
