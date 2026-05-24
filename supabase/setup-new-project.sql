
-- ========== 20251205220355_d319c5bb-d618-422d-9c6f-80fc686a1cde.sql ==========
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(new.raw_user_meta_data ->> 'last_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN new;
END;
$$;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for updating timestamp
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20251206010703_3d75cf9c-4f22-4be9-94a8-dbd4ea954760.sql ==========
-- Create trades table for persisting user trade data
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('Long', 'Short')),
  result NUMERIC NOT NULL,
  session TEXT,
  strategy TEXT,
  notes TEXT,
  notebook TEXT,
  chart_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own trades"
ON public.trades
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades"
ON public.trades
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
ON public.trades
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades"
ON public.trades
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_trades_updated_at
BEFORE UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20251206011409_1113877f-c893-4014-a599-a2be2e4eb72e.sql ==========
-- Create broker_connections table to securely store broker connection data
CREATE TABLE public.broker_connections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    account_id TEXT NOT NULL,
    broker TEXT NOT NULL,
    login TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own broker connection"
ON public.broker_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own broker connection"
ON public.broker_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own broker connection"
ON public.broker_connections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own broker connection"
ON public.broker_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_broker_connections_updated_at
BEFORE UPDATE ON public.broker_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20251206231706_1cbc37a5-cec7-42e2-96b7-bc17b066b774.sql ==========
-- Create checklists table
CREATE TABLE public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own checklists"
ON public.checklists
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checklists"
ON public.checklists
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklists"
ON public.checklists
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checklists"
ON public.checklists
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_checklists_updated_at
BEFORE UPDATE ON public.checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20251207023751_c3aafb92-c6b3-4693-8700-cba945dd5810.sql ==========
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

-- ========== 20251208183201_ae79540c-39b6-4fcb-8ee1-2a01d3907d5f.sql ==========
-- Enable pg_cron and pg_net extensions for real-time sync
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create broker_connections table if it doesn't exist (it already exists but let's ensure structure)
-- Note: Table already exists from earlier migrations

-- Create a table to track sync status
CREATE TABLE IF NOT EXISTS public.broker_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_connection_id UUID NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'idle',
  trades_synced INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broker_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broker_sync_status
CREATE POLICY "Users can view their own sync status"
ON public.broker_sync_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.broker_connections bc 
    WHERE bc.id = broker_sync_status.broker_connection_id 
    AND bc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own sync status"
ON public.broker_sync_status
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.broker_connections bc 
    WHERE bc.id = broker_sync_status.broker_connection_id 
    AND bc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own sync status"
ON public.broker_sync_status
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.broker_connections bc 
    WHERE bc.id = broker_sync_status.broker_connection_id 
    AND bc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own sync status"
ON public.broker_sync_status
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.broker_connections bc 
    WHERE bc.id = broker_sync_status.broker_connection_id 
    AND bc.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_broker_sync_status_updated_at
BEFORE UPDATE ON public.broker_sync_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20251208184652_566e683a-157b-4920-a900-a16de76c9713.sql ==========
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

-- ========== 20251209200628_86be94f7-c7ff-48d9-8117-e33d1e9f0113.sql ==========
-- Add checklist_id column to trades table to link trades to checklists
ALTER TABLE public.trades 
ADD COLUMN checklist_id uuid REFERENCES public.checklists(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_trades_checklist_id ON public.trades(checklist_id);

-- ========== 20251209214320_077ffda7-1aef-4c01-b1b4-68ddbc0e241f.sql ==========
-- Create notebook_entries table
CREATE TABLE public.notebook_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  date TEXT NOT NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  folder_id TEXT,
  folder_color TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notebook entries"
ON public.notebook_entries
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notebook entries"
ON public.notebook_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notebook entries"
ON public.notebook_entries
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notebook entries"
ON public.notebook_entries
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_notebook_entries_updated_at
BEFORE UPDATE ON public.notebook_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_notebook_entries_user_id ON public.notebook_entries(user_id);
CREATE INDEX idx_notebook_entries_trade_id ON public.notebook_entries(trade_id);

-- ========== 20251209214610_c4bbbff5-82ad-4279-9165-8da31ce39cfb.sql ==========
-- Create user_settings table for syncing preferences across devices
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  theme TEXT NOT NULL DEFAULT 'dark',
  accent_color TEXT NOT NULL DEFAULT 'emerald',
  custom_color TEXT DEFAULT '#10b981',
  custom_gradient JSONB,
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own settings"
ON public.user_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
ON public.user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);

-- ========== 20260106121732_15340200-e5e9-43ed-b9f5-0afb147864ab.sql ==========
-- Add goal_balance column to trading_accounts table
ALTER TABLE public.trading_accounts 
ADD COLUMN goal_balance numeric DEFAULT NULL;

-- ========== 20260106131003_674bfde1-967d-4261-a806-d7f786eecc8f.sql ==========
-- Add checklist_state column to store the state of checklist items at trade time
ALTER TABLE public.trades 
ADD COLUMN checklist_state JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.trades.checklist_state IS 'Stores the checklist items and their checked state at the time of trade entry';

-- ========== 20260107033723_abb83942-80fd-4fa8-9117-ff39d3bf4f3d.sql ==========
-- Add notebook_font column to user_settings table
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notebook_font TEXT DEFAULT 'inter';

-- ========== 20260107093059_3739f36b-a224-4c0f-8b6d-58d64ea2cf23.sql ==========
-- Add notes column to checklists table for playbook strategy notes
ALTER TABLE public.checklists 
ADD COLUMN notes TEXT DEFAULT '';

-- ========== 20260107100046_3eb82e20-8af9-423d-bd38-52ad5dcbfc67.sql ==========
-- Enable REPLICA IDENTITY FULL for realtime updates with complete row data
ALTER TABLE public.trades REPLICA IDENTITY FULL;
ALTER TABLE public.trading_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;
ALTER TABLE public.notebook_entries REPLICA IDENTITY FULL;
ALTER TABLE public.checklists REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notebook_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklists;

-- ========== 20260316201651_a7f4b05c-7f17-48d3-9319-eb71780ac093.sql ==========

-- Community channels table
CREATE TABLE public.community_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Community messages table
CREATE TABLE public.community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.community_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  image_url text,
  parent_id uuid REFERENCES public.community_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Message reactions
CREATE TABLE public.community_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.community_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Direct messages table
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  image_url text,
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Channels: everyone authenticated can read
CREATE POLICY "Anyone can view channels" ON public.community_channels FOR SELECT TO authenticated USING (true);

-- Messages: authenticated users can CRUD
CREATE POLICY "Anyone can view messages" ON public.community_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert messages" ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messages" ON public.community_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.community_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reactions
CREATE POLICY "Anyone can view reactions" ON public.community_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add reactions" ON public.community_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.community_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- DMs: only sender/receiver
CREATE POLICY "Users can view own DMs" ON public.direct_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send DMs" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own DMs" ON public.direct_messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Enable realtime for messages and reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Seed default channels
INSERT INTO public.community_channels (name, description, is_default) VALUES
  ('General', 'General trading discussion', true),
  ('Chart Breakdowns', 'Share and discuss chart analysis', false),
  ('Signals', 'Trading signals and setups', false),
  ('Off Topic', 'Non-trading conversations', false);

-- Storage bucket for chat images
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true);

-- Storage policies for chat images
CREATE POLICY "Anyone can view chat images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-images');
CREATE POLICY "Users can upload chat images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-images');


-- ========== 20260316201914_a39652a5-f8cc-4fec-9ed0-7cf96a40cf1b.sql ==========

DROP POLICY "Users can view their own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


-- ========== 20260414010820_e0998f57-a72e-4677-9b38-23a69ef4feb2.sql ==========
DROP FUNCTION IF EXISTS public.ensure_default_account(uuid);

-- ========== 20260414011258_98dc405d-4703-4973-b40f-8469f9561682.sql ==========
ALTER TABLE public.trading_accounts ADD COLUMN profit_target numeric DEFAULT NULL;

-- ========== 20260414014157_42561b62-d0a8-42e3-9adb-ee6aba430b2f.sql ==========

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


-- ========== 20260414020211_c0543aba-3813-4c0c-b66b-f3dfae488408.sql ==========
CREATE POLICY "Users can delete their own sync logs"
ON public.broker_sync_logs
FOR DELETE
USING (EXISTS ( SELECT 1
   FROM broker_connections bc
  WHERE ((bc.id = broker_sync_logs.broker_connection_id) AND (bc.user_id = auth.uid()))));

-- ========== 20260414023627_69378694-5161-48db-bb0e-27a085ea8bf3.sql ==========
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS swap numeric DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS commission numeric DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS open_price numeric DEFAULT NULL;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS close_price numeric DEFAULT NULL;

-- ========== 20260414145239_81a03805-b7de-4064-a73a-1ba052f301f6.sql ==========
ALTER TABLE public.broker_positions DROP CONSTRAINT broker_positions_type_check;

-- ========== 20260417023137_4b23b120-e9e9-4308-acb6-ad5bae5418da.sql ==========
DELETE FROM public.notebook_entries
WHERE trade_id IS NOT NULL
  AND category = 'trade-notes'
  AND content LIKE '%Trade Plan%'
  AND content LIKE '%Post-Trade Review%';

-- ========== 20260417023643_f624f2e8-04cc-42fd-b18a-a5fa0bc8d478.sql ==========
DELETE FROM public.notebook_entries
WHERE trade_id IS NOT NULL;

-- ========== 20260417024140_c963e0f0-aae8-42d3-808f-de36aaedad79.sql ==========
DELETE FROM public.notebook_entries;

-- ========== 20260418181224_d5bbbf45-09d1-43c6-bc47-fe0dd839b0f3.sql ==========
-- Add Myfxbook-specific columns to broker_connections so each user can log in with their own Myfxbook credentials
ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS myfxbook_session text,
  ADD COLUMN IF NOT EXISTS myfxbook_password_enc text;

-- Helpful index for filtering by platform
CREATE INDEX IF NOT EXISTS idx_broker_connections_platform ON public.broker_connections(platform);


-- ========== 20260418181841_699f060e-2bdb-4c77-9f0e-c1ce05314625.sql ==========
ALTER TABLE public.broker_connections DROP CONSTRAINT IF EXISTS broker_connections_platform_check;
ALTER TABLE public.broker_connections ADD CONSTRAINT broker_connections_platform_check CHECK (platform IN ('mt4', 'mt5', 'tradelocker', 'myfxbook'));

-- ========== 20260419080038_fa43804e-1d7e-403e-8abe-3a4ff70dafac.sql ==========
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS glass_mode boolean NOT NULL DEFAULT false;

-- ========== 20260419081049_996bc26c-73e0-43b8-a498-b31d469fb719.sql ==========
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS glass_mode;

-- ========== 20260421011449_4096703e-c77b-4d50-b28c-d44d7fb225a7.sql ==========
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
