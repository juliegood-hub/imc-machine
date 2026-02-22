-- ═══════════════════════════════════════════════════════════════
-- IMC Machine: Granular Fields Schema Update
-- Add granular, parseable fields for better data segmentation
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- USERS TABLE UPDATES
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE users ADD COLUMN first_name text;
ALTER TABLE users ADD COLUMN last_name text;
ALTER TABLE users ADD COLUMN cell_phone text;
ALTER TABLE users ADD COLUMN work_phone text;
ALTER TABLE users ADD COLUMN title text; -- job title/role

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE UPDATES - CONTACT INFO
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN first_name text;
ALTER TABLE profiles ADD COLUMN last_name text;
ALTER TABLE profiles ADD COLUMN dba_name text; -- doing business as / display name
ALTER TABLE profiles ADD COLUMN title text; -- Owner, Booking Manager, etc.
ALTER TABLE profiles ADD COLUMN work_phone text;
ALTER TABLE profiles ADD COLUMN cell_phone text;
ALTER TABLE profiles ADD COLUMN preferred_contact text CHECK (preferred_contact IN ('email', 'phone', 'text'));

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE UPDATES - BUSINESS INFO
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN business_type text CHECK (business_type IN ('venue', 'bar_restaurant', 'theater', 'gallery', 'church', 'outdoor', 'other'));
ALTER TABLE profiles ADD COLUMN tax_id text;
ALTER TABLE profiles ADD COLUMN year_established integer;

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE UPDATES - ADDRESS (GRANULAR)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN street_number text;
ALTER TABLE profiles ADD COLUMN street_name text;
ALTER TABLE profiles ADD COLUMN suite_number text;
ALTER TABLE profiles ADD COLUMN zip_code text;
ALTER TABLE profiles ADD COLUMN country text DEFAULT 'US';

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE UPDATES - ADDITIONAL SOCIAL FIELDS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN twitter_url text;
ALTER TABLE profiles ADD COLUMN tiktok_url text;
ALTER TABLE profiles ADD COLUMN yelp_url text;
ALTER TABLE profiles ADD COLUMN google_business_url text;

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE UPDATES - VENUE-SPECIFIC
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN has_stage boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN has_sound boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN has_lighting boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN parking_type text CHECK (parking_type IN ('street', 'lot', 'valet', 'none'));
ALTER TABLE profiles ADD COLUMN ada_accessible boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN age_restriction text CHECK (age_restriction IN ('all_ages', '18_plus', '21_plus'));
ALTER TABLE profiles ADD COLUMN liquor_license boolean DEFAULT false;

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE UPDATES - ARTIST MANAGEMENT CONTACTS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN manager_name text;
ALTER TABLE profiles ADD COLUMN manager_email text;
ALTER TABLE profiles ADD COLUMN manager_phone text;
ALTER TABLE profiles ADD COLUMN booking_name text;
ALTER TABLE profiles ADD COLUMN booking_email text;
ALTER TABLE profiles ADD COLUMN booking_phone text;

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE UPDATES - ARTIST PROFESSIONAL
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN subgenres jsonb DEFAULT '[]'::jsonb; -- tags/chips array
ALTER TABLE profiles ADD COLUMN years_active integer;
ALTER TABLE profiles ADD COLUMN record_label text;
ALTER TABLE profiles ADD COLUMN performing_rights_org text; -- ASCAP, BMI, SESAC
ALTER TABLE profiles ADD COLUMN union_member text; -- SAG-AFTRA, AFM, etc.

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE UPDATES - ARTIST STREAMING PLATFORMS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN soundcloud_url text;
ALTER TABLE profiles ADD COLUMN bandcamp_url text;
ALTER TABLE profiles ADD COLUMN apple_music_url text;

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE UPDATES - ARTIST TECHNICAL
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN has_own_sound boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN has_own_lighting boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN typical_set_length text CHECK (typical_set_length IN ('30min', '45min', '1hr', '1_5hr', '2hr', '2_5hr', '3hr'));
ALTER TABLE profiles ADD COLUMN rider_requirements text;
ALTER TABLE profiles ADD COLUMN tech_rider_url text;

-- ═══════════════════════════════════════════════════════════════
-- EVENTS TABLE UPDATES - VENUE ADDRESS GRANULAR
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE events ADD COLUMN venue_street_number text;
ALTER TABLE events ADD COLUMN venue_street_name text;
ALTER TABLE events ADD COLUMN venue_suite text;
ALTER TABLE events ADD COLUMN venue_zip text;

-- ═══════════════════════════════════════════════════════════════
-- DATA MIGRATION HELPERS
-- ═══════════════════════════════════════════════════════════════

-- Migrate existing names if they exist in users table
UPDATE users SET 
  first_name = CASE 
    WHEN name IS NOT NULL AND position(' ' in name) > 0 
    THEN split_part(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN name IS NOT NULL AND position(' ' in name) > 0 
    THEN substring(name from position(' ' in name) + 1)
    ELSE NULL
  END
WHERE name IS NOT NULL;

-- Migrate existing venue/artist names from profiles
UPDATE profiles SET
  first_name = CASE 
    WHEN name IS NOT NULL AND position(' ' in name) > 0 
    THEN split_part(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN name IS NOT NULL AND position(' ' in name) > 0 
    THEN substring(name from position(' ' in name) + 1)
    ELSE NULL
  END,
  zip_code = postal_code,
  country = 'US'
WHERE name IS NOT NULL;

-- Set default preferred contact method
UPDATE profiles SET preferred_contact = 'email' WHERE preferred_contact IS NULL;

-- Set default business type based on profile type
UPDATE profiles SET 
  business_type = CASE profile_type 
    WHEN 'venue' THEN 'venue'
    WHEN 'artist' THEN 'venue' -- will be updated by user
    ELSE 'venue'
  END
WHERE business_type IS NULL;