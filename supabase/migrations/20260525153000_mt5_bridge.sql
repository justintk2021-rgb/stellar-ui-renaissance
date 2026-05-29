-- MT5 local bridge pairing and trade command queue.
-- The bridge syncs into the existing broker_* tables and polls commands from here.

CREATE TABLE IF NOT EXISTS public.broker_bridges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  name text NOT NULL DEFAULT 'Local MT5 Bridge',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'online', 'offline', 'revoked')),
  last_heartbeat_at timestamp with time zone,
  last_error text,
  bridge_version text,
  machine_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (broker_connection_id)
);

ALTER TABLE public.broker_bridges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own broker bridges"
  ON public.broker_bridges FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.broker_connections bc
    WHERE bc.id = broker_bridges.broker_connection_id
      AND bc.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own broker bridges"
  ON public.broker_bridges FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.broker_connections bc
    WHERE bc.id = broker_bridges.broker_connection_id
      AND bc.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own broker bridges"
  ON public.broker_bridges FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.broker_connections bc
    WHERE bc.id = broker_bridges.broker_connection_id
      AND bc.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own broker bridges"
  ON public.broker_bridges FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.broker_connections bc
    WHERE bc.id = broker_bridges.broker_connection_id
      AND bc.user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS public.broker_trade_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  command_type text NOT NULL CHECK (command_type IN ('place_order', 'modify_position', 'close_position', 'modify_order', 'cancel_order')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'running', 'completed', 'failed', 'cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  result jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_trade_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trade commands"
  ON public.broker_trade_commands FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.broker_connections bc
    WHERE bc.id = broker_trade_commands.broker_connection_id
      AND bc.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own trade commands"
  ON public.broker_trade_commands FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.broker_connections bc
    WHERE bc.id = broker_trade_commands.broker_connection_id
      AND bc.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own trade commands"
  ON public.broker_trade_commands FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.broker_connections bc
    WHERE bc.id = broker_trade_commands.broker_connection_id
      AND bc.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_broker_bridges_connection
  ON public.broker_bridges(broker_connection_id);

CREATE INDEX IF NOT EXISTS idx_broker_trade_commands_connection_status
  ON public.broker_trade_commands(broker_connection_id, status, requested_at);

CREATE TRIGGER update_broker_bridges_updated_at
  BEFORE UPDATE ON public.broker_bridges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broker_trade_commands_updated_at
  BEFORE UPDATE ON public.broker_trade_commands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_bridges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_trade_commands;
