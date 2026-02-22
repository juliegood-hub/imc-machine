-- ═══════════════════════════════════════════════════════════════
-- IMC Machine: Google Drive Integration Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drive_root_folder_id TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drive_brand_folder_id TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS drive_event_folder_id TEXT DEFAULT '';

-- App settings table for storing the IMC Machine root folder ID
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
