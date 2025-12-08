-- Drop existing tables to rebuild with new structure
DROP TABLE IF EXISTS public.broker_sync_status CASCADE;
DROP TABLE IF EXISTS public.broker_connections CASCADE;

-- Create broker_connections table with direct credentials
CREATE TABLE public.broker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mt4', 'mt5', 'tradelocker', 'ctrader')),
  broker_name TEXT NOT NULL,
  server TEXT NOT NULL,
  login TEXT NOT NULL,
  -- MetaAPI account ID (created when user connects)
  metaapi_account_id TEXT,
  -- Connection status
  connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connecting', 'connected', 'disconnected', 'error')),
  last_connected_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  -- Account info from broker
  account_balance NUMERIC,
  account_equity NUMERIC,
  account_currency TEXT DEFAULT 'USD',
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for open positions (real-time)
CREATE TABLE public.broker_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_connection_id UUID REFERENCES public.broker_connections(id) ON DELETE CASCADE NOT NULL,
  position_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  volume NUMERIC NOT NULL,
  open_price NUMERIC NOT NULL,
  current_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  profit NUMERIC DEFAULT 0,
  swap NUMERIC DEFAULT 0,
  commission NUMERIC DEFAULT 0,
  open_time TIMESTAMP WITH TIME ZONE NOT NULL,
  magic_number INTEGER,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(broker_connection_id, position_id)
);

-- Create table for synced historical trades
CREATE TABLE public.broker_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_connection_id UUID REFERENCES public.broker_connections(id) ON DELETE CASCADE NOT NULL,
  trade_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  volume NUMERIC NOT NULL,
  open_price NUMERIC NOT NULL,
  close_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  profit NUMERIC DEFAULT 0,
  swap NUMERIC DEFAULT 0,
  commission NUMERIC DEFAULT 0,
  open_time TIMESTAMP WITH TIME ZONE NOT NULL,
  close_time TIMESTAMP WITH TIME ZONE,
  magic_number INTEGER,
  comment TEXT,
  -- Link to journal trade
  journal_trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(broker_connection_id, trade_id)
);

-- Enable RLS on all tables
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_trades ENABLE ROW LEVEL SECURITY;

-- RLS policies for broker_connections
CREATE POLICY "Users can view their own broker connections"
ON public.broker_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own broker connections"
ON public.broker_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own broker connections"
ON public.broker_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own broker connections"
ON public.broker_connections FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for broker_positions (via broker_connection)
CREATE POLICY "Users can view their own positions"
ON public.broker_positions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.broker_connections bc
  WHERE bc.id = broker_connection_id AND bc.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own positions"
ON public.broker_positions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.broker_connections bc
  WHERE bc.id = broker_connection_id AND bc.user_id = auth.uid()
));

CREATE POLICY "Users can update their own positions"
ON public.broker_positions FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.broker_connections bc
  WHERE bc.id = broker_connection_id AND bc.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own positions"
ON public.broker_positions FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.broker_connections bc
  WHERE bc.id = broker_connection_id AND bc.user_id = auth.uid()
));

-- RLS policies for broker_trades (via broker_connection)
CREATE POLICY "Users can view their own broker trades"
ON public.broker_trades FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.broker_connections bc
  WHERE bc.id = broker_connection_id AND bc.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own broker trades"
ON public.broker_trades FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.broker_connections bc
  WHERE bc.id = broker_connection_id AND bc.user_id = auth.uid()
));

CREATE POLICY "Users can update their own broker trades"
ON public.broker_trades FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.broker_connections bc
  WHERE bc.id = broker_connection_id AND bc.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own broker trades"
ON public.broker_trades FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.broker_connections bc
  WHERE bc.id = broker_connection_id AND bc.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_broker_connections_updated_at
BEFORE UPDATE ON public.broker_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broker_positions_updated_at
BEFORE UPDATE ON public.broker_positions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broker_trades_updated_at
BEFORE UPDATE ON public.broker_trades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for positions (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_connections;