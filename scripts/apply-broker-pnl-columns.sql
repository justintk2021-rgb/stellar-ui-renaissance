-- Run once in Supabase SQL Editor if today P&L columns are missing:
-- Dashboard → SQL → New query → paste → Run

ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS today_net_pnl numeric,
  ADD COLUMN IF NOT EXISTS today_gross_pnl numeric,
  ADD COLUMN IF NOT EXISTS today_fees numeric,
  ADD COLUMN IF NOT EXISTS today_pnl_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS day_gross_pnl jsonb NOT NULL DEFAULT '{}'::jsonb;
