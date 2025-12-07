-- Create trading_accounts table
CREATE TABLE public.trading_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  broker TEXT,
  starting_balance NUMERIC NOT NULL DEFAULT 10000,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for trading accounts
CREATE POLICY "Users can view their own accounts" 
ON public.trading_accounts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own accounts" 
ON public.trading_accounts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts" 
ON public.trading_accounts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts" 
ON public.trading_accounts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_trading_accounts_updated_at
BEFORE UPDATE ON public.trading_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add account_id to trades table (nullable for backward compatibility)
ALTER TABLE public.trades 
ADD COLUMN account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX idx_trades_account_id ON public.trades(account_id);
CREATE INDEX idx_trading_accounts_user_id ON public.trading_accounts(user_id);

-- Function to create a default account for existing users
-- This will be triggered when a user first accesses the app
CREATE OR REPLACE FUNCTION public.ensure_default_account(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Check if user already has an account
  SELECT id INTO v_account_id FROM trading_accounts WHERE user_id = p_user_id AND is_default = true LIMIT 1;
  
  -- If no default account exists, create one
  IF v_account_id IS NULL THEN
    INSERT INTO trading_accounts (user_id, name, is_default)
    VALUES (p_user_id, 'Main Account', true)
    RETURNING id INTO v_account_id;
    
    -- Link existing trades to this account
    UPDATE trades SET account_id = v_account_id WHERE user_id = p_user_id AND account_id IS NULL;
  END IF;
  
  RETURN v_account_id;
END;
$$;