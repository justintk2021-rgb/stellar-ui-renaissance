
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
