-- Remove manual per-day overrides; calendar uses synced trades only.
UPDATE public.broker_connections
SET day_gross_pnl = '{}'::jsonb
WHERE platform = 'tradelocker';
