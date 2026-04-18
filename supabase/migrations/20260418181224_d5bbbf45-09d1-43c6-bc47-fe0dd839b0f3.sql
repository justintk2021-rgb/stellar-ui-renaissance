-- Add Myfxbook-specific columns to broker_connections so each user can log in with their own Myfxbook credentials
ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS myfxbook_session text,
  ADD COLUMN IF NOT EXISTS myfxbook_password_enc text;

-- Helpful index for filtering by platform
CREATE INDEX IF NOT EXISTS idx_broker_connections_platform ON public.broker_connections(platform);
