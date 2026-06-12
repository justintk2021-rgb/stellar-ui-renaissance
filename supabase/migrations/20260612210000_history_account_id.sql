-- broker_trade_history rows were only keyed by connection, but one TradeLocker
-- connection can hold multiple accounts. Add the external account id so the
-- calendar / P&L day totals can be filtered to the selected account.

ALTER TABLE public.broker_trade_history
  ADD COLUMN IF NOT EXISTS account_id_external text;

CREATE INDEX IF NOT EXISTS idx_broker_trade_history_account
  ON public.broker_trade_history (broker_connection_id, account_id_external);

-- Backfill from the journal: synced journal rows carry broker_account_id and
-- share the broker position id with their history row.
UPDATE public.broker_trade_history h
SET account_id_external = t.broker_account_id
FROM public.trades t
WHERE h.account_id_external IS NULL
  AND h.broker_position_id IS NOT NULL
  AND t.broker_position_id = h.broker_position_id
  AND t.imported_from_broker = true
  AND t.broker_account_id IS NOT NULL;
