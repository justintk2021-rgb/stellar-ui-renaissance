ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS open_time timestamptz,
  ADD COLUMN IF NOT EXISTS close_time timestamptz;

-- Backfill from broker_trade_history when matching by broker_position_id
UPDATE public.trades t
SET open_time = bth.opened_at,
    close_time = bth.closed_at
FROM public.broker_trade_history bth
WHERE t.broker_position_id IS NOT NULL
  AND bth.broker_position_id = t.broker_position_id
  AND (t.open_time IS NULL OR t.close_time IS NULL);

-- Backfill remaining by broker_order_id
UPDATE public.trades t
SET open_time = COALESCE(t.open_time, bth.opened_at),
    close_time = COALESCE(t.close_time, bth.closed_at)
FROM public.broker_trade_history bth
WHERE t.broker_order_id IS NOT NULL
  AND bth.broker_order_id = t.broker_order_id
  AND (t.open_time IS NULL OR t.close_time IS NULL);