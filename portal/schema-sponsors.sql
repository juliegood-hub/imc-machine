-- Sponsors JSONB column on events
-- Format: [{ name, logo_url, tagline, contact_name, contact_email, contact_phone, website, tier }]
ALTER TABLE events ADD COLUMN IF NOT EXISTS sponsors JSONB DEFAULT '[]'::jsonb;
