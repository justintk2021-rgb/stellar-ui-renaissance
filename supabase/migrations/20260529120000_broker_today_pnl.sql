ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS today_net_pnl numeric,
  ADD COLUMN IF NOT EXISTS today_gross_pnl numeric,
  ADD COLUMN IF NOT EXISTS today_fees numeric,
  ADD COLUMN IF NOT EXISTS today_pnl_synced_at timestamptz;
