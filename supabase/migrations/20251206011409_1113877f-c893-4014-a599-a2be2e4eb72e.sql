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