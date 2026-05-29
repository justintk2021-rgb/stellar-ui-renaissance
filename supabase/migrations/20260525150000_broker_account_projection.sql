-- Per-broker-account projection targets (synced across devices)
ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS starting_balance numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS goal_balance numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS profit_target numeric DEFAULT NULL;
