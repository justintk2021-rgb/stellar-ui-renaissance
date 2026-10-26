-- New manual accounts must use the starting balance the user entered.
-- Do not invent a $10,000 placeholder at the database layer.
ALTER TABLE public.trading_accounts
  ALTER COLUMN starting_balance SET DEFAULT 0;
