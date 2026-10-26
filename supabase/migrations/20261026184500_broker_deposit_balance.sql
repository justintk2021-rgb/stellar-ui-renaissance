-- Funded size of a broker account (deposits minus withdrawals).
-- Projection and starting balance use this instead of inferring from trades.
ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS deposit_balance numeric DEFAULT NULL;
