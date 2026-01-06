-- Add goal_balance column to trading_accounts table
ALTER TABLE public.trading_accounts 
ADD COLUMN goal_balance numeric DEFAULT NULL;