-- Per-day broker gross P&L from TradeLocker (e.g. session day $418), keyed by YYYY-MM-DD.
ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS day_gross_pnl jsonb NOT NULL DEFAULT '{}'::jsonb;
