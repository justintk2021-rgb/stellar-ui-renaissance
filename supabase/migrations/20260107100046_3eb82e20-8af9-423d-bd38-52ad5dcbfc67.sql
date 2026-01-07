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