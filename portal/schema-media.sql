-- Media Library table
CREATE TABLE IF NOT EXISTS media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  label TEXT DEFAULT '',
  original_url TEXT NOT NULL,
  mime_type TEXT DEFAULT 'image/jpeg',
  width INTEGER,
  height INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own media" ON media FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own media" ON media FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own media" ON media FOR DELETE USING (auth.uid() = user_id);
