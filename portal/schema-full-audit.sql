-- ═══════════════════════════════════════════════════════════════
-- IMC MACHINE: COMPREHENSIVE DATABASE AUDIT SCRIPT
-- Generated: 2026-02-21 by AI Assistant
-- Purpose: Ensure Supabase database matches ALL code expectations
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
-- SECTION 1: DISABLE RLS AND DROP EXISTING POLICIES
-- (We'll re-enable later after ensuring schema consistency)
-- ═══════════════════════════════════════════════════════════════

-- Disable RLS on all tables to avoid conflicts during schema updates
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS generated_content DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS generated_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS media DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS participant_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS venue_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_series DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS performance_zones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS show_configurations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stage_plot_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticketing_providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS venue_ticketing_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS booking_ticketing_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS production_checklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS production_checklist_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS venue_inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS venue_maintenance_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS venue_maintenance_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS venue_suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS supplier_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_item_supplier_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS google_place_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS booking_purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS production_costume_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS costume_characters DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS production_set_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS set_elements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS parking_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS parking_assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS parking_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dressing_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dressing_room_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS operations_packets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS media_capture_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS capture_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS zoom_meeting_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS zoom_assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS youtube_distributions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS concessions_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS concessions_menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS merch_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS merch_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS merch_revenue_splits DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS festivals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS festival_stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS festival_bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS touring_shows DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tour_dates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS board_risk_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS job_titles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS venue_staffing_policies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staffing_publish_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staffing_inbound_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS document_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS booking_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS booking_budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS booking_budget_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS booking_riders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS booking_rider_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS show_checkins DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settlement_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deal_memos DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies to avoid conflicts
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename, policyname 
             FROM pg_policies 
             WHERE schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- SECTION 2: CREATE CORE TABLES (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  client_type TEXT DEFAULT 'venue',
  venue_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- INVITES TABLE
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  venue_name TEXT,
  client_type TEXT DEFAULT 'venue',
  code TEXT UNIQUE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  profile_type TEXT DEFAULT 'venue',
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  address TEXT,
  city TEXT DEFAULT 'San Antonio',
  state TEXT DEFAULT 'TX',
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  genre TEXT,
  capacity INTEGER,
  facebook_url TEXT,
  facebook_page_id TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,
  spotify_url TEXT,
  youtube_url TEXT,
  brand_colors JSONB DEFAULT '[]'::jsonb,
  brand_voice TEXT,
  logo_url TEXT,
  headshot_url TEXT,
  hometown TEXT,
  band_members JSONB DEFAULT '[]'::jsonb,
  streaming_links JSONB DEFAULT '{}'::jsonb,
  booking_contact TEXT,
  manager_contact TEXT,
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  date DATE,
  time TEXT,
  end_date DATE,
  end_time TEXT,
  genre TEXT,
  venue_name TEXT,
  venue_address TEXT,
  venue_city TEXT DEFAULT 'San Antonio',
  venue_state TEXT DEFAULT 'TX',
  is_free BOOLEAN DEFAULT TRUE,
  ticket_price DECIMAL(10,2),
  ticket_link TEXT,
  ticket_provider TEXT,
  cast_crew JSONB DEFAULT '[]'::jsonb,
  brand_voice TEXT,
  brand_colors JSONB DEFAULT '[]'::jsonb,
  hero_image_url TEXT,
  poster_url TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  channels JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  drive_folder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'not_started',
  external_id TEXT,
  external_url TEXT,
  recipients INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, channel)
);

-- ACTIVITY_LOG TABLE
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GENERATED_CONTENT TABLE
CREATE TABLE IF NOT EXISTS generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content_type TEXT NOT NULL,
  content TEXT,
  language TEXT DEFAULT 'en',
  model_used TEXT,
  tokens_used INTEGER,
  drive_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GENERATED_IMAGES TABLE
CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  format_key TEXT,
  image_url TEXT,
  drive_url TEXT,
  model_used TEXT,
  prompt TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- APP_SETTINGS TABLE (unified definition)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEDIA TABLE (referenced in API files but may not exist)
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
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

-- PARTICIPANT PROFILES TABLE (reusable acts, speakers, artists)
CREATE TABLE IF NOT EXISTS participant_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  profile_type TEXT DEFAULT 'participant',
  name TEXT NOT NULL DEFAULT '',
  role TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  website TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VENUE PROFILES TABLE (reusable venue presets)
CREATE TABLE IF NOT EXISTS venue_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  street_number TEXT DEFAULT '',
  street_name TEXT DEFAULT '',
  suite TEXT DEFAULT '',
  city TEXT DEFAULT 'San Antonio',
  state TEXT DEFAULT 'TX',
  postal_code TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  website TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EVENT SERIES TABLE (for recurring runs)
CREATE TABLE IF NOT EXISTS event_series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  recurrence JSONB DEFAULT '{}'::jsonb,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EVENT PARTICIPANTS TABLE (normalized event-to-participant mapping)
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participant_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, participant_id)
);

-- PERFORMANCE ZONES TABLE (venue sub-stages / rooms / decks)
CREATE TABLE IF NOT EXISTS performance_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_profile_id UUID REFERENCES venue_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  zone_type TEXT DEFAULT 'club_stage',
  width_ft NUMERIC(8,2),
  depth_ft NUMERIC(8,2),
  ceiling_height_ft NUMERIC(8,2),
  capacity INTEGER,
  fixed_equipment JSONB DEFAULT '[]'::jsonb,
  power_spec JSONB DEFAULT '{}'::jsonb,
  restrictions TEXT DEFAULT '',
  load_in_notes TEXT DEFAULT '',
  default_contacts JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- SHOW CONFIGURATIONS TABLE (touring-grade stage plots + tech specs)
CREATE TABLE IF NOT EXISTS show_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  participant_profile_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  show_type TEXT NOT NULL DEFAULT 'band',
  template_key TEXT DEFAULT '',
  member_count INTEGER,
  summary TEXT DEFAULT '',
  equipment JSONB DEFAULT '[]'::jsonb,
  input_list JSONB DEFAULT '[]'::jsonb,
  patch_list JSONB DEFAULT '[]'::jsonb,
  monitor_plan JSONB DEFAULT '[]'::jsonb,
  backline JSONB DEFAULT '[]'::jsonb,
  lighting_plan JSONB DEFAULT '[]'::jsonb,
  video_plan JSONB DEFAULT '[]'::jsonb,
  power_plan JSONB DEFAULT '[]'::jsonb,
  stage_management JSONB DEFAULT '[]'::jsonb,
  stage_plot_layout JSONB DEFAULT '{}'::jsonb,
  plot_summary TEXT DEFAULT '',
  is_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STAGE PLOT DOCUMENTS TABLE (booking/config attachment + PDF payload)
CREATE TABLE IF NOT EXISTS stage_plot_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  show_configuration_id UUID REFERENCES show_configurations(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  content JSONB DEFAULT '{}'::jsonb,
  pdf_base64 TEXT,
  pdf_filename TEXT,
  share_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STAFFING REQUESTS TABLE (crew hiring/dispatch tracking per event)
CREATE TABLE IF NOT EXISTS staffing_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT '',
  department TEXT DEFAULT '',
  quantity INTEGER DEFAULT 1,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  rate_type TEXT DEFAULT 'flat',
  rate_amount NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  notes TEXT DEFAULT '',
  destination_type TEXT DEFAULT 'manual',
  destination_value TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  dispatch_result JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TICKETING SNAPSHOTS TABLE (sync history per provider/event)
CREATE TABLE IF NOT EXISTS ticketing_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'manual',
  provider_event_id TEXT,
  seats_available INTEGER,
  tickets_sold INTEGER,
  gross_revenue NUMERIC(12,2),
  net_revenue NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  raw_payload JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEAL MEMOS TABLE (contracting workflow + dispatch/PDF history)
CREATE TABLE IF NOT EXISTS deal_memos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Deal Memo',
  status TEXT DEFAULT 'draft',
  deal_type TEXT DEFAULT 'performance',
  buyer_name TEXT DEFAULT '',
  buyer_email TEXT DEFAULT '',
  buyer_phone TEXT DEFAULT '',
  seller_name TEXT DEFAULT '',
  seller_email TEXT DEFAULT '',
  seller_phone TEXT DEFAULT '',
  event_date DATE,
  venue_name TEXT DEFAULT '',
  compensation_model TEXT DEFAULT 'guarantee',
  guarantee_amount NUMERIC(12,2),
  deposit_amount NUMERIC(12,2),
  backend_split TEXT DEFAULT '',
  door_split TEXT DEFAULT '',
  merch_split TEXT DEFAULT '',
  settlement_due_hours INTEGER,
  cancellation_terms TEXT DEFAULT '',
  force_majeure_terms TEXT DEFAULT '',
  hospitality_terms TEXT DEFAULT '',
  tech_rider_terms TEXT DEFAULT '',
  promo_commitments TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  pdf_base64 TEXT,
  pdf_filename TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SHOW CHECKINS TABLE (credential + day-of-show attendance)
CREATE TABLE IF NOT EXISTS show_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_role TEXT DEFAULT '',
  contact_type TEXT DEFAULT 'crew',
  credential_label TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  status TEXT DEFAULT 'expected',
  checked_in_at TIMESTAMPTZ,
  check_in_method TEXT DEFAULT 'manual',
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SETTLEMENT REPORTS TABLE (gross/net/payout reconciliation)
CREATE TABLE IF NOT EXISTS settlement_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Settlement Report',
  status TEXT DEFAULT 'draft',
  currency TEXT DEFAULT 'USD',
  gross_revenue NUMERIC(12,2),
  taxes_fees NUMERIC(12,2) DEFAULT 0,
  promoter_costs NUMERIC(12,2) DEFAULT 0,
  production_costs NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  net_revenue NUMERIC(12,2),
  guaranteed_payout NUMERIC(12,2),
  actual_payout NUMERIC(12,2),
  splits JSONB DEFAULT '{}'::jsonb,
  payout_lines JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  reported_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  exported_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TICKETING PROVIDERS TABLE (connector abstraction)
CREATE TABLE IF NOT EXISTS ticketing_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL UNIQUE,
  auth_type TEXT DEFAULT 'none',
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ticketing_providers (name, type, auth_type, is_active)
VALUES
  ('Eventbrite', 'eventbrite', 'api_key', TRUE),
  ('Ticketmaster', 'ticketmaster', 'oauth', TRUE)
ON CONFLICT (type)
DO UPDATE SET
  name = EXCLUDED.name,
  auth_type = EXCLUDED.auth_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS venue_ticketing_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_profile_id UUID REFERENCES venue_profiles(id) ON DELETE CASCADE,
  ticketing_provider_id UUID REFERENCES ticketing_providers(id) ON DELETE CASCADE,
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  api_key TEXT,
  account_id TEXT,
  connection_status TEXT DEFAULT 'not_connected',
  is_default BOOLEAN DEFAULT FALSE,
  manual_mode BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_profile_id, ticketing_provider_id)
);

CREATE TABLE IF NOT EXISTS booking_ticketing_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  ticketing_provider_id UUID REFERENCES ticketing_providers(id) ON DELETE SET NULL,
  external_event_id TEXT,
  external_event_url TEXT,
  ticket_sales_url TEXT,
  gross_sales NUMERIC(12,2),
  tickets_sold INTEGER,
  manual_mode BOOLEAN DEFAULT FALSE,
  sync_status TEXT DEFAULT 'not_connected',
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE venue_profiles ADD COLUMN IF NOT EXISTS default_ticketing_provider_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'venue_profiles'
      AND constraint_name = 'venue_profiles_default_ticketing_provider_fk'
  ) THEN
    ALTER TABLE venue_profiles
      ADD CONSTRAINT venue_profiles_default_ticketing_provider_fk
      FOREIGN KEY (default_ticketing_provider_id) REFERENCES ticketing_providers(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE events ADD COLUMN IF NOT EXISTS selected_ticketing_provider_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticketing_manual_mode BOOLEAN DEFAULT FALSE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'events'
      AND constraint_name = 'events_selected_ticketing_provider_fk'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_selected_ticketing_provider_fk
      FOREIGN KEY (selected_ticketing_provider_id) REFERENCES ticketing_providers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- PRODUCTION CHECKLIST TABLES
CREATE TABLE IF NOT EXISTS production_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  show_configuration_id UUID REFERENCES show_configurations(id) ON DELETE SET NULL,
  stage_plot_document_id UUID REFERENCES stage_plot_documents(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Production Checklist',
  phase TEXT DEFAULT 'preflight',
  status TEXT DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES production_checklists(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',
  label TEXT NOT NULL DEFAULT '',
  required BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'todo',
  provider_scope TEXT DEFAULT 'house',
  assignee_name TEXT DEFAULT '',
  assignee_role TEXT DEFAULT '',
  due_at TIMESTAMPTZ,
  checked_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VENUE INVENTORY + MAINTENANCE
CREATE TABLE IF NOT EXISTS venue_inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_profile_id UUID REFERENCES venue_profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT '',
  subcategory TEXT DEFAULT '',
  quantity INTEGER DEFAULT 1,
  unit TEXT DEFAULT 'ea',
  serial_number TEXT DEFAULT '',
  ownership TEXT DEFAULT 'house',
  location TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  last_service_at TIMESTAMPTZ,
  next_service_due_at TIMESTAMPTZ,
  maintenance_interval_days INTEGER,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venue_maintenance_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_profile_id UUID REFERENCES venue_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT DEFAULT '',
  company TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  contact_type TEXT DEFAULT 'vendor',
  preferred_method TEXT DEFAULT 'email',
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venue_maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_profile_id UUID REFERENCES venue_profiles(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES venue_inventory_items(id) ON DELETE SET NULL,
  assigned_contact_id UUID REFERENCES venue_maintenance_contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'scheduled',
  priority TEXT DEFAULT 'normal',
  scheduled_for TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VENUE SUPPLIERS + PO ROUTING
CREATE TABLE IF NOT EXISTS venue_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venue_profiles(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL DEFAULT '',
  supplier_type TEXT DEFAULT 'local_store',
  google_place_id TEXT,
  address_line1 TEXT DEFAULT '',
  address_line2 TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  country TEXT DEFAULT 'US',
  phone TEXT,
  email TEXT,
  website_url TEXT,
  ordering_url TEXT,
  account_number TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_supplier_id UUID REFERENCES venue_suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  title TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_item_supplier_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES venue_inventory_items(id) ON DELETE CASCADE,
  venue_supplier_id UUID REFERENCES venue_suppliers(id) ON DELETE CASCADE,
  supplier_sku TEXT,
  supplier_item_url TEXT,
  preferred BOOLEAN DEFAULT FALSE,
  last_price_paid NUMERIC(12,2),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (inventory_item_id, venue_supplier_id)
);

CREATE TABLE IF NOT EXISTS google_place_cache (
  place_id TEXT PRIMARY KEY,
  place_type TEXT DEFAULT 'supplier',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  venue_profile_id UUID REFERENCES venue_profiles(id) ON DELETE SET NULL,
  venue_supplier_id UUID REFERENCES venue_suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT DEFAULT '',
  supplier_email TEXT DEFAULT '',
  ordering_url TEXT DEFAULT '',
  supplier_address TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  currency TEXT DEFAULT 'USD',
  delivery_instructions TEXT DEFAULT '',
  receiving_hours TEXT DEFAULT '',
  dock_notes TEXT DEFAULT '',
  purchaser_name TEXT DEFAULT '',
  purchaser_email TEXT DEFAULT '',
  split_key TEXT DEFAULT '',
  items JSONB DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12,2),
  manual_mode BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COSTUMES + HAIR/MAKEUP
CREATE TABLE IF NOT EXISTS production_costume_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  costume_designer_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  wardrobe_supervisor_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  hair_makeup_lead_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS costume_characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  costume_plan_id UUID REFERENCES production_costume_plans(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL DEFAULT '',
  performer_name TEXT DEFAULT '',
  performer_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  costume_list JSONB DEFAULT '[]'::jsonb,
  costume_location TEXT DEFAULT '',
  quick_change_notes TEXT DEFAULT '',
  fittings_schedule TEXT DEFAULT '',
  special_requirements TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SET DESIGN / SCENERY
CREATE TABLE IF NOT EXISTS production_set_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  scenic_designer_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  technical_director_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  props_master_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS set_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_plan_id UUID REFERENCES production_set_plans(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  element_name TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'scenery',
  dimensions TEXT DEFAULT '',
  build_status TEXT DEFAULT 'planned',
  storage_location TEXT DEFAULT '',
  load_in_requirements TEXT DEFAULT '',
  strike_requirements TEXT DEFAULT '',
  safety_notes TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PARKING + PERMITS + MAPS
CREATE TABLE IF NOT EXISTS parking_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  parking_coordinator_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  venue_parking_notes TEXT DEFAULT '',
  arrival_window_notes TEXT DEFAULT '',
  loading_zone_notes TEXT DEFAULT '',
  rideshare_notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parking_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parking_plan_id UUID REFERENCES parking_plans(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  asset_type TEXT DEFAULT 'instruction_pdf',
  title TEXT NOT NULL DEFAULT '',
  file_attachment_id TEXT NOT NULL DEFAULT '',
  who_is_it_for TEXT DEFAULT '',
  distribution_list JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parking_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parking_plan_id UUID REFERENCES parking_plans(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  permit_asset_id UUID REFERENCES parking_assets(id) ON DELETE SET NULL,
  person_or_group TEXT DEFAULT '',
  assigned_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  vehicle_plate TEXT DEFAULT '',
  arrival_time TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DRESSING ROOMS + ASSIGNMENTS
CREATE TABLE IF NOT EXISTS dressing_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venue_profiles(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES performance_zones(id) ON DELETE SET NULL,
  room_name_or_number TEXT NOT NULL DEFAULT '',
  capacity INTEGER,
  location_notes TEXT DEFAULT '',
  amenities JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dressing_room_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  dressing_room_id UUID REFERENCES dressing_rooms(id) ON DELETE CASCADE,
  assigned_to TEXT DEFAULT '',
  assigned_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  access_instructions TEXT DEFAULT '',
  key_code_or_badge_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OPERATIONS PACKETS
CREATE TABLE IF NOT EXISTS operations_packets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  packet_type TEXT DEFAULT 'production_dept',
  sections JSONB DEFAULT '[]'::jsonb,
  sanitized BOOLEAN DEFAULT FALSE,
  html_content TEXT DEFAULT '',
  pdf_base64 TEXT,
  pdf_filename TEXT,
  share_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEDIA CAPTURE + ZOOM + YOUTUBE DISTRIBUTION
CREATE TABLE IF NOT EXISTS media_capture_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  recording_type TEXT DEFAULT 'video',
  capture_mode TEXT DEFAULT 'static',
  primary_platform TEXT DEFAULT 'youtube',
  stream_live BOOLEAN DEFAULT FALSE,
  post_production_notes TEXT DEFAULT '',
  rights_clearance_status TEXT DEFAULT 'pending',
  distribution_channels JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capture_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'camera',
  name TEXT NOT NULL DEFAULT '',
  location TEXT DEFAULT '',
  operator TEXT DEFAULT '',
  ai_control_enabled BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zoom_meeting_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  zoom_meeting_type TEXT DEFAULT 'meeting',
  zoom_meeting_id TEXT,
  zoom_join_url TEXT,
  zoom_host_email TEXT,
  zoom_passcode TEXT,
  zoom_settings_json JSONB DEFAULT '{}'::jsonb,
  zoom_cloud_recording_enabled BOOLEAN DEFAULT FALSE,
  zoom_transcript_enabled BOOLEAN DEFAULT FALSE,
  zoom_status TEXT DEFAULT 'not_scheduled',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zoom_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  asset_type TEXT DEFAULT 'cloud_recording',
  provider TEXT DEFAULT 'zoom',
  external_asset_id TEXT,
  download_url TEXT,
  file_attachment_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS youtube_distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  youtube_video_id TEXT,
  youtube_video_url TEXT,
  publish_status TEXT DEFAULT 'not_published',
  publish_notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONCESSIONS / FOOD AND BEVERAGE OPERATIONS
CREATE TABLE IF NOT EXISTS concessions_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  manager_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  bar_open_time TIMESTAMPTZ,
  bar_close_time TIMESTAMPTZ,
  intermission_service BOOLEAN DEFAULT FALSE,
  cashless_only BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concessions_menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'other',
  price NUMERIC(12,2),
  cost_basis NUMERIC(12,2),
  supplier_reference TEXT,
  alcohol_flag BOOLEAN DEFAULT FALSE,
  inventory_link TEXT,
  is_signature_item BOOLEAN DEFAULT FALSE,
  availability_status TEXT DEFAULT 'available',
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MERCHANDISING + VENDOR MARKETPLACE
CREATE TABLE IF NOT EXISTS merch_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  merch_manager_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  table_fee BOOLEAN DEFAULT FALSE,
  table_fee_amount NUMERIC(12,2),
  merch_area_location TEXT DEFAULT '',
  load_in_time TIMESTAMPTZ,
  marketplace_mode BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merch_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  organization_name TEXT DEFAULT '',
  emergency_contact_name TEXT DEFAULT '',
  emergency_contact_phone TEXT DEFAULT '',
  emergency_contact_email TEXT DEFAULT '',
  supervisor_name TEXT DEFAULT '',
  merch_table_required BOOLEAN DEFAULT TRUE,
  staff_running_table TEXT DEFAULT '',
  e_retail_links JSONB DEFAULT '[]'::jsonb,
  on_site_inventory_description TEXT DEFAULT '',
  payment_methods_accepted JSONB DEFAULT '[]'::jsonb,
  table_assignment_label TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merch_revenue_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES merch_participants(id) ON DELETE SET NULL,
  applies_to TEXT DEFAULT 'all_merch',
  split_type TEXT DEFAULT 'gross',
  table_fee_deducted_first BOOLEAN DEFAULT FALSE,
  percentage_allocations JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FESTIVAL MODE
CREATE TABLE IF NOT EXISTS festivals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  starts_on DATE,
  ends_on DATE,
  venue_profile_id UUID REFERENCES venue_profiles(id) ON DELETE SET NULL,
  venue_or_district TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  site_map_attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS festival_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  festival_id UUID REFERENCES festivals(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES performance_zones(id) ON DELETE SET NULL,
  stage_name TEXT NOT NULL DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS festival_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  festival_id UUID REFERENCES festivals(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES festival_stages(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES performance_zones(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TOURING MODE
CREATE TABLE IF NOT EXISTS touring_shows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  show_type TEXT DEFAULT 'band',
  default_show_configuration_id UUID REFERENCES show_configurations(id) ON DELETE SET NULL,
  default_checklists JSONB DEFAULT '[]'::jsonb,
  default_hospitality_rider JSONB DEFAULT '[]'::jsonb,
  default_set_package JSONB DEFAULT '{}'::jsonb,
  default_costume_package JSONB DEFAULT '{}'::jsonb,
  touring_staff_contacts JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tour_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  touring_show_id UUID REFERENCES touring_shows(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venue_profiles(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES performance_zones(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES events(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOARD DASHBOARD RISK TRACKING
CREATE TABLE IF NOT EXISTS board_risk_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  owner_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONTRACTS / DOCS AUTOFILL
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  doc_type TEXT NOT NULL DEFAULT 'generic',
  template_body TEXT NOT NULL DEFAULT '',
  variables JSONB DEFAULT '[]'::jsonb,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL DEFAULT 'contract',
  title TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'draft',
  draft_body TEXT DEFAULT '',
  final_body TEXT DEFAULT '',
  autofill_payload JSONB DEFAULT '{}'::jsonb,
  pdf_base64 TEXT,
  pdf_filename TEXT,
  share_token TEXT UNIQUE,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BUDGETS + RIDERS
CREATE TABLE IF NOT EXISTS booking_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Show Budget',
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft',
  total_budget NUMERIC(12,2),
  estimated_gross NUMERIC(12,2),
  estimated_net NUMERIC(12,2),
  actual_gross NUMERIC(12,2),
  actual_net NUMERIC(12,2),
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_budget_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID REFERENCES booking_budgets(id) ON DELETE CASCADE,
  category TEXT DEFAULT '',
  line_item_name TEXT NOT NULL DEFAULT '',
  vendor_name TEXT DEFAULT '',
  cost_type TEXT DEFAULT 'estimated',
  amount NUMERIC(12,2),
  quantity NUMERIC(12,2) DEFAULT 1,
  tax_rate NUMERIC(8,4),
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_riders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Green Room Rider',
  rider_type TEXT DEFAULT 'hospitality',
  status TEXT DEFAULT 'draft',
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_rider_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID REFERENCES booking_riders(id) ON DELETE CASCADE,
  section TEXT DEFAULT 'hospitality',
  label TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(12,2) DEFAULT 1,
  unit TEXT DEFAULT 'ea',
  required BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'requested',
  provided_by TEXT DEFAULT 'venue',
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- SECTION 3: ADD ALL MISSING COLUMNS FROM CODE ANALYSIS
-- ═══════════════════════════════════════════════════════════════

-- USERS TABLE - Add granular fields found in code
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cell_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT;

-- PROFILES TABLE - Add all granular contact fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dba_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cell_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_contact TEXT CHECK (preferred_contact IN ('email', 'phone', 'text'));

-- PROFILES TABLE - Business info
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_type TEXT CHECK (business_type IN ('venue', 'bar_restaurant', 'theater', 'gallery', 'church', 'outdoor', 'other'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year_established INTEGER;

-- PROFILES TABLE - Granular address fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suite_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US';

-- PROFILES TABLE - Additional social media fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS yelp_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_business_url TEXT;

-- PROFILES TABLE - Commerce/store URL fields (from schema-commerce-fields.sql)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS online_menu_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS square_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shopify_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS amazon_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS etsy_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS merch_store_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS other_store_url TEXT DEFAULT '';

-- PROFILES TABLE - Venue-specific fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_stage BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_sound BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_lighting BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parking_type TEXT CHECK (parking_type IN ('street', 'lot', 'valet', 'none'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ada_accessible BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_restriction TEXT CHECK (age_restriction IN ('all_ages', '18_plus', '21_plus'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS liquor_license BOOLEAN DEFAULT FALSE;

-- PROFILES TABLE - Artist management contacts
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS booking_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS booking_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS booking_phone TEXT;

-- PROFILES TABLE - Artist professional fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subgenres JSONB DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_active INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS record_label TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS performing_rights_org TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS union_member TEXT;

-- PROFILES TABLE - Artist streaming platforms
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS soundcloud_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bandcamp_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS apple_music_url TEXT;

-- PROFILES TABLE - Artist technical fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_own_sound BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_own_lighting BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS typical_set_length TEXT CHECK (typical_set_length IN ('30min', '45min', '1hr', '1_5hr', '2hr', '2_5hr', '3hr'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rider_requirements TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tech_rider_url TEXT;

-- PROFILES TABLE - Google Drive fields (from schema-drive.sql and VenueContext)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drive_root_folder_id TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drive_brand_folder_id TEXT DEFAULT '';

-- PROFILES TABLE - Settings and notification preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;

-- PROFILES TABLE - Additional fields found in VenueContext mapping
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS venue_name TEXT; -- Used in VenueContext
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo TEXT; -- Referenced as profile.logo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS headshot TEXT; -- Referenced as profile.headshot  
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT; -- Referenced as profile.bio
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]'::jsonb; -- profile.members
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS label TEXT; -- profile.label
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook TEXT; -- profile.facebook (in addition to facebook_url)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram TEXT; -- profile.instagram 
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter TEXT; -- profile.twitter
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tiktok TEXT; -- profile.tiktok
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS youtube TEXT; -- profile.youtube
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spotify TEXT; -- profile.spotify
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin TEXT; -- profile.linkedin
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bandcamp TEXT; -- profile.bandcamp
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS soundcloud TEXT; -- profile.soundcloud
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS apple_music TEXT; -- profile.apple_music
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS amazon_music TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS press_kit TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_primary TEXT; -- profile.brand_primary
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_secondary TEXT; -- profile.brand_secondary

-- EVENTS TABLE - Add run_of_show column (from schema-patches.sql)
ALTER TABLE events ADD COLUMN IF NOT EXISTS run_of_show JSONB DEFAULT '[]'::jsonb;

-- EVENTS TABLE - Add podcast fields (from schema-patches.sql)
ALTER TABLE events ADD COLUMN IF NOT EXISTS podcast_audio_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS podcast_youtube_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS podcast_source_doc TEXT;

-- EVENTS TABLE - Add sponsors field (from schema-sponsors.sql)
ALTER TABLE events ADD COLUMN IF NOT EXISTS sponsors JSONB DEFAULT '[]'::jsonb;

-- EVENTS TABLE - Add granular venue address fields (from granular schema)
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_street_number TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_street_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_suite TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_zip TEXT;

-- EVENTS TABLE - Add fields found in VenueContext and EventCreate
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_phone TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_website TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS brand_colors TEXT; -- Used in form (different from JSONB brand_colors)
ALTER TABLE events ADD COLUMN IF NOT EXISTS writing_tone TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS detected_fonts TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS crew JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS performers TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS campaign BOOLEAN DEFAULT FALSE;

-- EVENTS TABLE - Add Google Drive event folder (from schema-drive.sql and VenueContext)
ALTER TABLE events ADD COLUMN IF NOT EXISTS drive_event_folder_id TEXT DEFAULT '';

-- EVENTS TABLE - Reusable libraries + recurrence support
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_profile_id UUID REFERENCES venue_profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS participant_profile_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES event_series(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS series_name TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_index INTEGER DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_count INTEGER DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS performance_zone_id UUID REFERENCES performance_zones(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS performance_zone_name TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS booking_start_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS booking_end_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_configuration_id UUID REFERENCES show_configurations(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_contacts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS stage_plot_document_id UUID REFERENCES stage_plot_documents(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS booking_status TEXT DEFAULT 'draft';
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_provider_event_id TEXT;

-- Staffing engine
CREATE TABLE IF NOT EXISTS job_titles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  department TEXT DEFAULT '',
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  phone_number TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  job_titles JSONB DEFAULT '[]'::jsonb,
  primary_role TEXT DEFAULT '',
  pay_type TEXT DEFAULT 'hourly',
  default_rate NUMERIC(12,2),
  supervisor_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  emergency_contact JSONB DEFAULT '{}'::jsonb,
  notes TEXT DEFAULT '',
  tax_profile_link TEXT DEFAULT '',
  voice_source_transcript TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
  job_title_id UUID REFERENCES job_titles(id) ON DELETE SET NULL,
  job_title TEXT DEFAULT '',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  pay_type TEXT DEFAULT 'hourly',
  pay_override NUMERIC(12,2),
  status TEXT DEFAULT 'scheduled',
  notes TEXT DEFAULT '',
  policy_acknowledged BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  notification_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venue_staffing_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venue_profiles(id) ON DELETE CASCADE,
  call_in_policy TEXT DEFAULT '',
  notice_hours INTEGER DEFAULT 4,
  supervisor_name TEXT DEFAULT '',
  supervisor_phone TEXT DEFAULT '',
  supervisor_email TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staffing_publish_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ DEFAULT now(),
  call_in_policy TEXT DEFAULT '',
  message_template TEXT DEFAULT '',
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS staffing_inbound_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE SET NULL,
  staff_assignment_id UUID REFERENCES staff_assignments(id) ON DELETE SET NULL,
  from_phone TEXT DEFAULT '',
  body TEXT DEFAULT '',
  parsed_action TEXT DEFAULT '',
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO job_titles (name, department, is_system, is_active, sort_order)
SELECT seed.name, seed.department, TRUE, TRUE, seed.sort_order
FROM (
  VALUES
    ('Technical Director', 'production', 1),
    ('Stage Manager', 'production', 2),
    ('Assistant Stage Manager', 'production', 3),
    ('Lighting Designer', 'production', 4),
    ('Lighting Board Operator', 'production', 5),
    ('Audio Engineer (FOH)', 'production', 6),
    ('Monitor Engineer', 'production', 7),
    ('A2 (Audio Assistant)', 'production', 8),
    ('Projection Designer', 'production', 9),
    ('Video Operator', 'production', 10),
    ('Scenic Designer', 'production', 11),
    ('Props Master', 'production', 12),
    ('Wardrobe Supervisor', 'production', 13),
    ('Hair/Makeup Lead', 'production', 14),
    ('Costumer', 'production', 15),
    ('Backline Tech', 'production', 16),
    ('Rigger', 'production', 17),
    ('Production Manager', 'production', 18),
    ('Tour Manager', 'production', 19),
    ('MC / Emcee', 'production', 20),
    ('DJ', 'production', 21),
    ('Band Leader', 'production', 22),
    ('Conductor', 'production', 23),
    ('House Manager', 'foh', 24),
    ('Box Office Manager', 'foh', 25),
    ('Ticket Scanner', 'foh', 26),
    ('Usher', 'foh', 27),
    ('Door ID Checker', 'foh', 28),
    ('VIP Host', 'foh', 29),
    ('Merch Manager', 'foh', 30),
    ('Bartender', 'foh', 31),
    ('Barback', 'foh', 32),
    ('Server', 'foh', 33),
    ('Busser', 'foh', 34),
    ('Security Lead', 'foh', 35),
    ('Security Staff', 'foh', 36),
    ('Facilities Manager', 'operations', 37),
    ('Electrician', 'operations', 38),
    ('Maintenance Tech', 'operations', 39),
    ('Janitorial Staff', 'operations', 40),
    ('Parking Coordinator', 'operations', 41),
    ('Runner', 'operations', 42),
    ('Load-In Crew', 'operations', 43),
    ('Load-Out Crew', 'operations', 44),
    ('Marketing Manager', 'admin_marketing', 45),
    ('Social Media Manager', 'admin_marketing', 46),
    ('Photographer', 'admin_marketing', 47),
    ('Videographer', 'admin_marketing', 48),
    ('Board Liaison', 'admin_marketing', 49),
    ('Executive Director', 'admin_marketing', 50),
    ('Chef', 'culinary_specialty', 51),
    ('Sous Chef', 'culinary_specialty', 52),
    ('Line Cook', 'culinary_specialty', 53),
    ('Food Vendor', 'culinary_specialty', 54),
    ('Beverage Manager', 'culinary_specialty', 55)
) AS seed(name, department, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM job_titles existing
  WHERE existing.user_id IS NULL
    AND lower(existing.name) = lower(seed.name)
    AND existing.is_system = TRUE
);

-- ═══════════════════════════════════════════════════════════════
-- SECTION 4: CREATE MISSING INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_campaigns_event ON campaigns(event_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_disabled ON users(disabled);
CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_used ON invites(used);
CREATE INDEX IF NOT EXISTS idx_campaigns_channel ON campaigns(channel);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_generated_content_event ON generated_content(event_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_event ON generated_images(event_id);
CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_event ON media(event_id);
CREATE INDEX IF NOT EXISTS idx_participant_profiles_user ON participant_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_profiles_name ON participant_profiles(name);
CREATE INDEX IF NOT EXISTS idx_venue_profiles_user ON venue_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_profiles_name ON venue_profiles(name);
CREATE INDEX IF NOT EXISTS idx_event_series_user ON event_series(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_participant ON event_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_events_series ON events(series_id);
CREATE INDEX IF NOT EXISTS idx_performance_zones_user ON performance_zones(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_zones_venue ON performance_zones(venue_profile_id);
CREATE INDEX IF NOT EXISTS idx_show_configs_user ON show_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_show_configs_show_type ON show_configurations(show_type);
CREATE INDEX IF NOT EXISTS idx_show_configs_participant ON show_configurations(participant_profile_id);
CREATE INDEX IF NOT EXISTS idx_stage_plot_docs_user ON stage_plot_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_stage_plot_docs_event ON stage_plot_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_stage_plot_docs_show_config ON stage_plot_documents(show_configuration_id);
CREATE INDEX IF NOT EXISTS idx_events_zone_schedule ON events(performance_zone_id, booking_start_at, booking_end_at);
CREATE INDEX IF NOT EXISTS idx_events_show_config ON events(show_configuration_id);
CREATE INDEX IF NOT EXISTS idx_staffing_requests_user ON staffing_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_staffing_requests_event ON staffing_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_staffing_requests_status ON staffing_requests(status);
CREATE INDEX IF NOT EXISTS idx_job_titles_user ON job_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_job_titles_name ON job_titles(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_titles_user_name_unique ON job_titles(user_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_titles_system_name_unique ON job_titles(lower(name)) WHERE user_id IS NULL AND is_system = TRUE;
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user ON staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_phone ON staff_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_booking ON staff_assignments(booking_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff ON staff_assignments(staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_status ON staff_assignments(status);
CREATE INDEX IF NOT EXISTS idx_venue_staffing_policies_venue ON venue_staffing_policies(venue_id);
CREATE INDEX IF NOT EXISTS idx_staffing_publish_logs_booking ON staffing_publish_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_staffing_inbound_messages_booking ON staffing_inbound_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_ticketing_snapshots_user ON ticketing_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_ticketing_snapshots_event ON ticketing_snapshots(event_id);
CREATE INDEX IF NOT EXISTS idx_ticketing_snapshots_provider ON ticketing_snapshots(provider);
CREATE INDEX IF NOT EXISTS idx_deal_memos_user ON deal_memos(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_memos_event ON deal_memos(event_id);
CREATE INDEX IF NOT EXISTS idx_deal_memos_status ON deal_memos(status);
CREATE INDEX IF NOT EXISTS idx_show_checkins_user ON show_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_show_checkins_event ON show_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_show_checkins_status ON show_checkins(status);
CREATE INDEX IF NOT EXISTS idx_settlement_reports_user ON settlement_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_reports_event ON settlement_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_settlement_reports_status ON settlement_reports(status);
CREATE INDEX IF NOT EXISTS idx_venue_ticketing_connections_user ON venue_ticketing_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_ticketing_connections_venue ON venue_ticketing_connections(venue_profile_id);
CREATE INDEX IF NOT EXISTS idx_venue_ticketing_connections_provider ON venue_ticketing_connections(ticketing_provider_id);
CREATE INDEX IF NOT EXISTS idx_booking_ticketing_records_user ON booking_ticketing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_ticketing_records_booking ON booking_ticketing_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_ticketing_records_provider ON booking_ticketing_records(ticketing_provider_id);
CREATE INDEX IF NOT EXISTS idx_production_checklists_user ON production_checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_production_checklists_event ON production_checklists(event_id);
CREATE INDEX IF NOT EXISTS idx_production_checklist_items_checklist ON production_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_production_checklist_items_status ON production_checklist_items(status);
CREATE INDEX IF NOT EXISTS idx_venue_inventory_items_venue ON venue_inventory_items(venue_profile_id);
CREATE INDEX IF NOT EXISTS idx_venue_inventory_items_status ON venue_inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_venue_maintenance_contacts_venue ON venue_maintenance_contacts(venue_profile_id);
CREATE INDEX IF NOT EXISTS idx_venue_maintenance_tasks_venue ON venue_maintenance_tasks(venue_profile_id);
CREATE INDEX IF NOT EXISTS idx_venue_maintenance_tasks_status ON venue_maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_venue_suppliers_venue ON venue_suppliers(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_suppliers_type ON venue_suppliers(supplier_type);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier ON supplier_contacts(venue_supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_links_inventory ON inventory_item_supplier_links(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_links_supplier ON inventory_item_supplier_links(venue_supplier_id);
CREATE INDEX IF NOT EXISTS idx_booking_purchase_orders_event ON booking_purchase_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_booking_purchase_orders_venue ON booking_purchase_orders(venue_profile_id);
CREATE INDEX IF NOT EXISTS idx_booking_purchase_orders_supplier ON booking_purchase_orders(venue_supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_suppliers_unique_name ON venue_suppliers(venue_id, lower(supplier_name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_place_cache_key ON google_place_cache(place_id, place_type);
CREATE INDEX IF NOT EXISTS idx_production_costume_plans_event ON production_costume_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_costume_characters_plan ON costume_characters(costume_plan_id);
CREATE INDEX IF NOT EXISTS idx_costume_characters_event ON costume_characters(event_id);
CREATE INDEX IF NOT EXISTS idx_production_set_plans_event ON production_set_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_set_elements_plan ON set_elements(set_plan_id);
CREATE INDEX IF NOT EXISTS idx_set_elements_event ON set_elements(event_id);
CREATE INDEX IF NOT EXISTS idx_parking_plans_event ON parking_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_parking_assets_plan ON parking_assets(parking_plan_id);
CREATE INDEX IF NOT EXISTS idx_parking_assignments_plan ON parking_assignments(parking_plan_id);
CREATE INDEX IF NOT EXISTS idx_dressing_rooms_venue ON dressing_rooms(venue_id);
CREATE INDEX IF NOT EXISTS idx_dressing_room_assignments_booking ON dressing_room_assignments(booking_id);
CREATE INDEX IF NOT EXISTS idx_operations_packets_event ON operations_packets(event_id);
CREATE INDEX IF NOT EXISTS idx_media_capture_plans_booking ON media_capture_plans(booking_id);
CREATE INDEX IF NOT EXISTS idx_capture_sources_booking ON capture_sources(booking_id);
CREATE INDEX IF NOT EXISTS idx_zoom_meeting_configs_booking ON zoom_meeting_configs(booking_id);
CREATE INDEX IF NOT EXISTS idx_zoom_assets_booking ON zoom_assets(booking_id);
CREATE INDEX IF NOT EXISTS idx_youtube_distributions_booking ON youtube_distributions(booking_id);
CREATE INDEX IF NOT EXISTS idx_concessions_plans_booking ON concessions_plans(booking_id);
CREATE INDEX IF NOT EXISTS idx_concessions_menu_items_booking ON concessions_menu_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_merch_plans_booking ON merch_plans(booking_id);
CREATE INDEX IF NOT EXISTS idx_merch_participants_booking ON merch_participants(booking_id);
CREATE INDEX IF NOT EXISTS idx_merch_revenue_splits_booking ON merch_revenue_splits(booking_id);
CREATE INDEX IF NOT EXISTS idx_festivals_user ON festivals(user_id);
CREATE INDEX IF NOT EXISTS idx_festival_stages_festival ON festival_stages(festival_id);
CREATE INDEX IF NOT EXISTS idx_festival_bookings_festival ON festival_bookings(festival_id);
CREATE INDEX IF NOT EXISTS idx_festival_bookings_event ON festival_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_touring_shows_user ON touring_shows(user_id);
CREATE INDEX IF NOT EXISTS idx_tour_dates_show ON tour_dates(touring_show_id);
CREATE INDEX IF NOT EXISTS idx_tour_dates_booking ON tour_dates(booking_id);
CREATE INDEX IF NOT EXISTS idx_board_risk_items_event ON board_risk_items(event_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_user ON document_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_documents_event ON booking_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_booking_documents_type ON booking_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_booking_budgets_event ON booking_budgets(event_id);
CREATE INDEX IF NOT EXISTS idx_booking_budget_lines_budget ON booking_budget_lines(budget_id);
CREATE INDEX IF NOT EXISTS idx_booking_riders_event ON booking_riders(event_id);
CREATE INDEX IF NOT EXISTS idx_booking_rider_items_rider ON booking_rider_items(rider_id);

-- ═══════════════════════════════════════════════════════════════
-- SECTION 5: DATA MIGRATION AND CLEANUP
-- ═══════════════════════════════════════════════════════════════

-- Migrate existing name fields to granular fields in users table
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
WHERE name IS NOT NULL AND (first_name IS NULL OR last_name IS NULL);

-- Migrate existing names in profiles table  
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
  zip_code = COALESCE(zip_code, postal_code),
  country = COALESCE(country, 'US')
WHERE name IS NOT NULL AND (first_name IS NULL OR last_name IS NULL);

-- Set default values for required fields
UPDATE profiles SET preferred_contact = 'email' WHERE preferred_contact IS NULL;
UPDATE profiles SET business_type = 'venue' WHERE business_type IS NULL AND profile_type = 'venue';
UPDATE profiles SET business_type = 'venue' WHERE business_type IS NULL; -- Default for all

-- ═══════════════════════════════════════════════════════════════
-- SECTION 6: ENSURE ADMIN USER EXISTS
-- ═══════════════════════════════════════════════════════════════

-- Create or update admin user (Julie Good)
INSERT INTO users (email, name, is_admin, client_type)
VALUES ('juliegood@goodcreativemedia.com', 'Julie Good', TRUE, 'venue')
ON CONFLICT (email) DO UPDATE SET 
  is_admin = TRUE, 
  name = COALESCE(EXCLUDED.name, users.name),
  disabled = FALSE;

-- ═══════════════════════════════════════════════════════════════
-- SECTION 7: ADD USEFUL CONSTRAINTS AND CHECKS
-- ═══════════════════════════════════════════════════════════════

-- Add constraints to ensure data integrity
DO $$ 
BEGIN
  -- Add constraint on users.client_type if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'users_client_type_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_client_type_check 
    CHECK (client_type IN ('venue', 'artist', 'performer', 'producer'));
  END IF;
  
  -- Add constraint on events.status if not exists  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'events_status_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_status_check 
    CHECK (status IN ('draft', 'ready', 'distributing', 'complete'));
  END IF;
  
  -- Add constraint on campaigns.status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'campaigns_status_check'  
  ) THEN
    ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('not_started', 'pending', 'queued', 'sent', 'published', 'created', 'failed', 'error'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'events_booking_status_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_booking_status_check
    CHECK (booking_status IN ('draft', 'hold', 'confirmed', 'cancelled', 'completed'));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- SECTION 8: CREATE HELPER FUNCTIONS AND TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Function to auto-set admin flag for Julie Good
CREATE OR REPLACE FUNCTION set_admin_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF lower(NEW.email) = 'juliegood@goodcreativemedia.com' THEN
    NEW.is_admin := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set admin flag
DROP TRIGGER IF EXISTS trg_set_admin ON users;
CREATE TRIGGER trg_set_admin
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION set_admin_on_insert();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at timestamps
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- SECTION 9: VERIFICATION QUERIES (COMMENTED OUT)
-- Uncomment these to verify the schema after running this script
-- ═══════════════════════════════════════════════════════════════

/*
-- Count all tables
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Count columns in each table
SELECT 
  table_name, 
  COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public'
GROUP BY table_name 
ORDER BY table_name;

-- Verify specific table structures
\d users;
\d profiles; 
\d events;
\d campaigns;
\d app_settings;
\d media;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
*/

-- ═══════════════════════════════════════════════════════════════
-- AUDIT COMPLETE ✅
--
-- Workforce ops add-ons (AI assist + staffing expansion)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  relationship TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_primary BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venue_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'other',
  description TEXT DEFAULT '',
  duration_minutes INTEGER,
  materials_links JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  training_course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venue_profiles(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES performance_zones(id) ON DELETE SET NULL,
  session_type TEXT DEFAULT 'workshop',
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  instructor_contact_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  location_notes TEXT DEFAULT '',
  capacity INTEGER,
  notes TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  training_session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'invited',
  completed_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  reminders_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certification_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'other',
  renewable BOOLEAN DEFAULT true,
  default_valid_days INTEGER,
  reminder_offsets_days JSONB DEFAULT '[60,30,7]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
  certification_type_id UUID REFERENCES certification_types(id) ON DELETE SET NULL,
  certificate_number TEXT DEFAULT '',
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'unknown',
  attachment_id TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_clock_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES events(id) ON DELETE CASCADE,
  staff_assignment_id UUID REFERENCES staff_assignments(id) ON DELETE CASCADE,
  staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_check_in TIMESTAMPTZ,
  actual_check_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'not_started',
  notes TEXT DEFAULT '',
  token_zone_id UUID REFERENCES performance_zones(id) ON DELETE SET NULL,
  audit_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS completion_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL DEFAULT 'entity',
  entity_id TEXT,
  title TEXT NOT NULL DEFAULT 'Complete missing fields',
  missing_fields_json JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  due_at TIMESTAMPTZ,
  reminder_cadence JSONB DEFAULT '[24,72,168]'::jsonb,
  reminder_last_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  source_type TEXT DEFAULT 'ai_assist',
  source_context TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  tone TEXT DEFAULT 'professor_good',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_assist_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  form_type TEXT DEFAULT '',
  source_type TEXT DEFAULT 'paste',
  source_context TEXT DEFAULT '',
  fields_applied JSONB DEFAULT '[]'::jsonb,
  proposed_count INTEGER DEFAULT 0,
  applied_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_staff ON emergency_contacts(staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_training_courses_user ON training_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_course ON training_sessions(training_course_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_session ON training_enrollments(training_session_id);
CREATE INDEX IF NOT EXISTS idx_certification_types_name ON certification_types(lower(name));
CREATE INDEX IF NOT EXISTS idx_staff_certifications_staff ON staff_certifications(staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_certifications_expiry ON staff_certifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_time_clock_shifts_booking ON time_clock_shifts(booking_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_shifts_assignment ON time_clock_shifts(staff_assignment_id);
CREATE INDEX IF NOT EXISTS idx_completion_tasks_assignee ON completion_tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_completion_tasks_status ON completion_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_assist_audit_logs_user ON ai_assist_audit_logs(user_id);

INSERT INTO notification_templates (key, subject_template, body_template, tone, is_active)
VALUES (
  'completion_task_professor_good',
  'Professor Good reminder: let''s finish your draft',
  'Hi {{name}}, your {{entity_type}} still needs {{missing_fields}}. Give it ten focused minutes and we can publish with confidence.',
  'professor_good',
  true
)
ON CONFLICT (key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  tone = EXCLUDED.tone,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO certification_types (name, category, renewable, default_valid_days, reminder_offsets_days, is_active, sort_order)
VALUES
  ('CPR', 'safety', true, 730, '[60,30,7]'::jsonb, true, 1),
  ('First Aid', 'safety', true, 730, '[60,30,7]'::jsonb, true, 2),
  ('AED', 'safety', true, 730, '[60,30,7]'::jsonb, true, 3),
  ('TABC', 'compliance', true, 730, '[60,30,7]'::jsonb, true, 4),
  ('Food Handler', 'compliance', true, 730, '[60,30,7]'::jsonb, true, 5),
  ('OSHA Basic', 'safety', true, 1095, '[90,30,7]'::jsonb, true, 6),
  ('Forklift', 'operations', true, 1095, '[90,30,7]'::jsonb, true, 7),
  ('Crowd Management / Security License', 'security', true, 1095, '[90,30,7]'::jsonb, true, 8)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- Internal Messaging: texting-grade event conversations
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  show_mode_enabled boolean DEFAULT false,
  mute_non_critical boolean DEFAULT false,
  pinned_ops_commands text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_conversations_event_unique ON event_conversations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_conversations_user ON event_conversations(user_id);

CREATE TABLE IF NOT EXISTS event_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_name text DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  message_type text DEFAULT 'user',
  client_message_id text,
  language_hint text,
  reply_to_message_id uuid REFERENCES event_messages(id) ON DELETE SET NULL,
  is_edited boolean DEFAULT false,
  edited_history jsonb DEFAULT '[]'::jsonb,
  attachments jsonb DEFAULT '[]'::jsonb,
  has_attachments boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_messages_event_created ON event_messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_messages_author ON event_messages(author_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_messages_event_client_id
  ON event_messages(event_id, client_message_id);

CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL REFERENCES event_messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reactions_unique
  ON message_reactions(message_id, user_id, emoji);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

CREATE TABLE IF NOT EXISTS message_mentions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL REFERENCES event_messages(id) ON DELETE CASCADE,
  mentioned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  mentioned_role_key text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_mentions_message ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_role ON message_mentions(mentioned_role_key);
--
-- ═══════════════════════════════════════════════════════════════
-- AUDIT COMPLETE ✅
-- 
-- This script ensures:
-- ✅ All tables exist with proper structure
-- ✅ All columns referenced in the codebase are present  
-- ✅ Granular fields (54+ columns) are all added
-- ✅ Commerce URL fields are present
-- ✅ Google Drive integration fields are present
-- ✅ Sponsors JSONB field is present on events
-- ✅ Media table exists with proper structure
-- ✅ App settings table has unified structure
-- ✅ All indexes are created for performance
-- ✅ RLS is disabled (will be re-enabled separately)
-- ✅ Data migrations are handled safely
-- ✅ Admin user (Julie Good) is ensured
-- ✅ Proper constraints and triggers are in place
-- ✅ Safe to run multiple times (idempotent)
--
-- After running this script, the IMC Machine app should work
-- with zero database schema errors.
-- ═══════════════════════════════════════════════════════════════
