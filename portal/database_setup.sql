-- ═══════════════════════════════════════════════════════════════
-- IMC Machine: Database Setup for OAuth Connections
-- Run this in your Supabase SQL editor to create the required table
-- ═══════════════════════════════════════════════════════════════

-- Create app_settings table for storing OAuth tokens and other app-wide settings
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster key lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Enable RLS (Row Level Security) but allow all operations for now
-- In production, you may want to restrict this to admin users only
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (adjust for your security needs)
CREATE POLICY "Allow all operations on app_settings" 
ON app_settings FOR ALL 
TO authenticated, anon
USING (true) 
WITH CHECK (true);

-- Sample entries that will be created by the OAuth flows:
-- oauth_facebook: { platform: 'facebook', access_token: '...', page_id: '...', etc. }
-- oauth_youtube: { platform: 'youtube', access_token: '...', refresh_token: '...', etc. }
-- oauth_linkedin: { platform: 'linkedin', access_token: '...', expires_at: '...', etc. }
-- oauth_state_*: Temporary CSRF state storage for OAuth flows