
-- Extend broker_connections for TradeLocker
ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS environment text DEFAULT 'demo',
  ADD COLUMN IF NOT EXISTS active_account_id text,
  ADD COLUMN IF NOT EXISTS active_acc_num bigint,
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_interval_seconds integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS token_expiry timestamp with time zone;

-- Create broker_accounts table
CREATE TABLE IF NOT EXISTS public.broker_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  account_id_external text NOT NULL,
  acc_num bigint NOT NULL,
  account_name text,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own broker accounts"
  ON public.broker_accounts FOR SELECT
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_accounts.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can insert their own broker accounts"
  ON public.broker_accounts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_accounts.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can update their own broker accounts"
  ON public.broker_accounts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_accounts.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can delete their own broker accounts"
  ON public.broker_accounts FOR DELETE
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_accounts.broker_connection_id AND bc.user_id = auth.uid()));

-- Create broker_orders table
CREATE TABLE IF NOT EXISTS public.broker_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  broker_order_id text NOT NULL,
  symbol text NOT NULL,
  order_type text NOT NULL,
  side text NOT NULL,
  size numeric NOT NULL,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  status text DEFAULT 'pending',
  created_broker_at timestamp with time zone,
  raw_payload jsonb,
  last_seen_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own broker orders"
  ON public.broker_orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_orders.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can insert their own broker orders"
  ON public.broker_orders FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_orders.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can update their own broker orders"
  ON public.broker_orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_orders.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can delete their own broker orders"
  ON public.broker_orders FOR DELETE
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_orders.broker_connection_id AND bc.user_id = auth.uid()));

-- Extend broker_positions with new columns
ALTER TABLE public.broker_positions
  ADD COLUMN IF NOT EXISTS side text,
  ADD COLUMN IF NOT EXISTS floating_pl numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone DEFAULT now();

-- Create broker_trade_history table
CREATE TABLE IF NOT EXISTS public.broker_trade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  broker_order_id text,
  broker_position_id text,
  symbol text NOT NULL,
  side text NOT NULL,
  size numeric NOT NULL,
  entry_price numeric NOT NULL,
  exit_price numeric,
  realized_pl numeric DEFAULT 0,
  fees numeric DEFAULT 0,
  opened_at timestamp with time zone NOT NULL,
  closed_at timestamp with time zone,
  raw_payload jsonb,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_trade_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trade history"
  ON public.broker_trade_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_trade_history.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can insert their own trade history"
  ON public.broker_trade_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_trade_history.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can update their own trade history"
  ON public.broker_trade_history FOR UPDATE
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_trade_history.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can delete their own trade history"
  ON public.broker_trade_history FOR DELETE
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_trade_history.broker_connection_id AND bc.user_id = auth.uid()));

-- Create broker_sync_logs table
CREATE TABLE IF NOT EXISTS public.broker_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  sync_type text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  error_message text,
  records_processed integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
  ON public.broker_sync_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_sync_logs.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can insert their own sync logs"
  ON public.broker_sync_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_sync_logs.broker_connection_id AND bc.user_id = auth.uid()));

CREATE POLICY "Users can update their own sync logs"
  ON public.broker_sync_logs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM broker_connections bc WHERE bc.id = broker_sync_logs.broker_connection_id AND bc.user_id = auth.uid()));

-- Extend trades table for broker journaling
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS broker_name text,
  ADD COLUMN IF NOT EXISTS broker_environment text,
  ADD COLUMN IF NOT EXISTS broker_account_id text,
  ADD COLUMN IF NOT EXISTS broker_acc_num bigint,
  ADD COLUMN IF NOT EXISTS broker_order_id text,
  ADD COLUMN IF NOT EXISTS broker_position_id text,
  ADD COLUMN IF NOT EXISTS imported_from_broker boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_broker_sync_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS execution_type text;

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_trade_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_sync_logs;

-- Add update triggers
CREATE TRIGGER update_broker_accounts_updated_at
  BEFORE UPDATE ON public.broker_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broker_orders_updated_at
  BEFORE UPDATE ON public.broker_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broker_trade_history_updated_at
  BEFORE UPDATE ON public.broker_trade_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
