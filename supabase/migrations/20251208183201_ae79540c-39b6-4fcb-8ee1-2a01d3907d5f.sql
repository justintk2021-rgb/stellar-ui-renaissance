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