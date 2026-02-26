-- Video variant transcode queue table
-- Run in Supabase SQL editor before using video variant worker.

CREATE TABLE IF NOT EXISTS video_transcode_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  status TEXT NOT NULL DEFAULT 'pending',
  source_url TEXT NOT NULL,
  source_path TEXT,
  source_meta JSONB DEFAULT '{}'::jsonb,
  targets TEXT[] DEFAULT ARRAY['vertical_9_16', 'square_1_1', 'landscape_16_9'],
  outputs JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE video_transcode_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE video_transcode_jobs NO FORCE ROW LEVEL SECURITY;
GRANT ALL ON video_transcode_jobs TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
