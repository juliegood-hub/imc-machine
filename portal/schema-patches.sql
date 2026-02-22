-- ═══════════════════════════════════════════════════════════════
-- IMC Machine: Schema Patches (2026-02-21)
-- Run AFTER the initial supabase-init.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. Add run_of_show column to events (used by RunOfShow page)
ALTER TABLE events ADD COLUMN IF NOT EXISTS run_of_show jsonb default '[]'::jsonb;

-- 2. Add notification_preferences to profiles (used by Settings page)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb default '{}'::jsonb;

-- 3. Add api_tokens storage for OAuth connections (Facebook, YouTube, LinkedIn)
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 4. Add podcast_audio_url to events for Podcast Studio
ALTER TABLE events ADD COLUMN IF NOT EXISTS podcast_audio_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS podcast_youtube_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS podcast_source_doc text;

-- 5. Index for app_settings
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- 6. RLS for app_settings (admin only)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read app_settings" ON app_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = auth.jwt() ->> 'email' 
      AND (is_admin = true OR email = 'juliegood@goodcreativemedia.com')
    )
  );

CREATE POLICY "Admin write app_settings" ON app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = auth.jwt() ->> 'email' 
      AND (is_admin = true OR email = 'juliegood@goodcreativemedia.com')
    )
  );
