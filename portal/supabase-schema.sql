-- ═══════════════════════════════════════════════════════════════
-- IMC Machine: Supabase Database Schema
-- Replaces localStorage with persistent, shared database
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
-- USERS
-- ═══════════════════════════════════════════════════════════════
create table users (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique,
  email text unique not null,
  name text,
  password_hash text, -- bcrypt hash (or null for passwordless)
  client_type text default 'venue' check (client_type in ('venue', 'artist', 'performer', 'producer')),
  venue_name text,
  is_admin boolean default false,
  disabled boolean default false,
  created_at timestamptz default now(),
  last_login timestamptz,
  metadata jsonb default '{}'::jsonb -- flexible extra fields
);

alter table users add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'users' and constraint_name = 'users_auth_user_fk'
  ) then
    alter table users
      add constraint users_auth_user_fk
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
exception
  when undefined_table then
    -- auth.users is unavailable outside Supabase auth context.
    null;
end $$;

create unique index if not exists idx_users_auth_user_id_unique
  on users(auth_user_id)
  where auth_user_id is not null;

-- Auto-admin for Julie
create or replace function set_admin_on_insert()
returns trigger as $$
begin
  if lower(NEW.email) = 'juliegood@goodcreativemedia.com' then
    NEW.is_admin := true;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_set_admin
  before insert on users
  for each row execute function set_admin_on_insert();

-- ═══════════════════════════════════════════════════════════════
-- INVITE CODES
-- ═══════════════════════════════════════════════════════════════
create table invites (
  id uuid primary key default uuid_generate_v4(),
  email text,
  venue_name text,
  client_type text default 'venue',
  code text unique not null,
  used boolean default false,
  used_by uuid references users(id),
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- VENUES / ARTIST PROFILES
-- ═══════════════════════════════════════════════════════════════
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  profile_type text default 'venue' check (profile_type in ('venue', 'artist', 'performer', 'producer')),
  name text not null,
  description text,
  address text,
  city text default 'San Antonio',
  state text default 'TX',
  postal_code text,
  phone text,
  email text,
  website text,
  genre text,
  capacity integer,
  -- Social links
  facebook_url text,
  facebook_page_id text,
  instagram_url text,
  linkedin_url text,
  spotify_url text,
  youtube_url text,
  -- Brand
  brand_colors jsonb default '[]'::jsonb,
  brand_voice text,
  logo_url text,
  headshot_url text,
  -- Artist-specific
  hometown text,
  band_members jsonb default '[]'::jsonb,
  streaming_links jsonb default '{}'::jsonb,
  booking_contact text,
  manager_contact text,
  -- Drive
  drive_folder_id text,
  drive_folder_url text,
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_profiles_user on profiles(user_id);

-- ═══════════════════════════════════════════════════════════════
-- EVENTS
-- ═══════════════════════════════════════════════════════════════
create table events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  profile_id uuid references profiles(id),
  title text not null,
  description text,
  date date,
  time text,
  end_date date,
  end_time text,
  genre text,
  -- Venue info (may differ from profile if artist playing at another venue)
  venue_name text,
  venue_address text,
  venue_city text default 'San Antonio',
  venue_state text default 'TX',
  -- Tickets
  is_free boolean default true,
  ticket_price decimal(10,2),
  ticket_link text,
  ticket_provider text, -- eventbrite, square, etc.
  -- Cast & Crew
  cast_crew jsonb default '[]'::jsonb,
  -- Brand & Voice
  brand_voice text,
  brand_colors jsonb default '[]'::jsonb,
  -- Media
  hero_image_url text,
  poster_url text,
  media_urls jsonb default '[]'::jsonb,
  -- Distribution channels selected
  channels jsonb default '[]'::jsonb,
  -- Status
  status text default 'draft' check (status in ('draft', 'ready', 'distributing', 'complete')),
  -- Drive
  drive_folder_id text,
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_events_user on events(user_id);
create index idx_events_date on events(date);
create index idx_events_status on events(status);

-- Reusable entity + recurrence support for faster event creation
alter table events add column if not exists venue_profile_id uuid;
alter table events add column if not exists participant_profile_ids jsonb default '[]'::jsonb;
alter table events add column if not exists series_id uuid;
alter table events add column if not exists series_name text default '';
alter table events add column if not exists recurrence_index integer default 1;
alter table events add column if not exists recurrence_count integer default 1;

-- Reusable participant (acts/artists/speakers) profiles
create table if not exists participant_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  profile_type text default 'participant',
  name text not null default '',
  role text default '',
  genre text default '',
  bio text default '',
  contact_email text default '',
  contact_phone text default '',
  website text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_participant_profiles_user on participant_profiles(user_id);
create index if not exists idx_participant_profiles_name on participant_profiles(name);

-- Reusable venue profiles
create table if not exists venue_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null default '',
  street_number text default '',
  street_name text default '',
  suite text default '',
  city text default 'San Antonio',
  state text default 'TX',
  postal_code text default '',
  phone text default '',
  website text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_venue_profiles_user on venue_profiles(user_id);
create index if not exists idx_venue_profiles_name on venue_profiles(name);

-- Recurring series metadata
create table if not exists event_series (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null default '',
  recurrence jsonb default '{}'::jsonb,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_event_series_user on event_series(user_id);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'events' and constraint_name = 'events_venue_profile_fk'
  ) then
    alter table events
      add constraint events_venue_profile_fk
      foreign key (venue_profile_id) references venue_profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'events' and constraint_name = 'events_series_fk'
  ) then
    alter table events
      add constraint events_series_fk
      foreign key (series_id) references event_series(id) on delete set null;
  end if;
end $$;

create index if not exists idx_events_series on events(series_id);

-- Event-to-participant linkage
create table if not exists event_participants (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  participant_id uuid references participant_profiles(id) on delete cascade,
  role text default '',
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique(event_id, participant_id)
);

create index if not exists idx_event_participants_event on event_participants(event_id);
create index if not exists idx_event_participants_participant on event_participants(participant_id);

-- Venue performance zones (sub-stages / rooms / decks)
create table if not exists performance_zones (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  venue_profile_id uuid references venue_profiles(id) on delete set null,
  name text not null,
  zone_type text default 'club_stage',
  width_ft numeric(8,2),
  depth_ft numeric(8,2),
  ceiling_height_ft numeric(8,2),
  capacity integer,
  fixed_equipment jsonb default '[]'::jsonb,
  power_spec jsonb default '{}'::jsonb,
  restrictions text default '',
  load_in_notes text default '',
  default_contacts jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, name)
);

create index if not exists idx_performance_zones_user on performance_zones(user_id);
create index if not exists idx_performance_zones_venue on performance_zones(venue_profile_id);

-- Act show configurations (touring specs, stage plots, patch lists)
create table if not exists show_configurations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  participant_profile_id uuid references participant_profiles(id) on delete set null,
  name text not null default '',
  show_type text not null default 'band',
  template_key text default '',
  member_count integer,
  summary text default '',
  equipment jsonb default '[]'::jsonb,
  input_list jsonb default '[]'::jsonb,
  patch_list jsonb default '[]'::jsonb,
  monitor_plan jsonb default '[]'::jsonb,
  backline jsonb default '[]'::jsonb,
  lighting_plan jsonb default '[]'::jsonb,
  video_plan jsonb default '[]'::jsonb,
  power_plan jsonb default '[]'::jsonb,
  stage_management jsonb default '[]'::jsonb,
  stage_plot_layout jsonb default '{}'::jsonb,
  plot_summary text default '',
  is_template boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_show_configs_user on show_configurations(user_id);
create index if not exists idx_show_configs_show_type on show_configurations(show_type);
create index if not exists idx_show_configs_participant on show_configurations(participant_profile_id);

-- Saved stage plot documents and exported PDFs
create table if not exists stage_plot_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  show_configuration_id uuid references show_configurations(id) on delete set null,
  title text not null default '',
  content jsonb default '{}'::jsonb,
  pdf_base64 text,
  pdf_filename text,
  share_token text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_stage_plot_docs_user on stage_plot_documents(user_id);
create index if not exists idx_stage_plot_docs_event on stage_plot_documents(event_id);
create index if not exists idx_stage_plot_docs_show_config on stage_plot_documents(show_configuration_id);

-- Events extended as zone-aware bookings
alter table events add column if not exists performance_zone_id uuid references performance_zones(id) on delete set null;
alter table events add column if not exists performance_zone_name text default '';
alter table events add column if not exists booking_start_at timestamptz;
alter table events add column if not exists booking_end_at timestamptz;
alter table events add column if not exists show_configuration_id uuid references show_configurations(id) on delete set null;
alter table events add column if not exists show_contacts jsonb default '[]'::jsonb;
alter table events add column if not exists stage_plot_document_id uuid references stage_plot_documents(id) on delete set null;
alter table events add column if not exists booking_status text default 'draft';
alter table events add column if not exists ticket_provider_event_id text;

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'events_booking_status_check'
  ) then
    alter table events add constraint events_booking_status_check
      check (booking_status in ('draft', 'hold', 'confirmed', 'cancelled', 'completed'));
  end if;
end $$;

create index if not exists idx_events_zone_schedule on events(performance_zone_id, booking_start_at, booking_end_at);
create index if not exists idx_events_show_config on events(show_configuration_id);

-- Staffing requests (crew hiring dispatch pipeline)
create table if not exists staffing_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  role text not null default '',
  department text default '',
  quantity integer default 1,
  starts_at timestamptz,
  ends_at timestamptz,
  rate_type text default 'flat',
  rate_amount numeric(10,2),
  currency text default 'USD',
  notes text default '',
  destination_type text default 'manual',
  destination_value text default '',
  status text default 'draft',
  dispatch_result jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_staffing_requests_user on staffing_requests(user_id);
create index if not exists idx_staffing_requests_event on staffing_requests(event_id);
create index if not exists idx_staffing_requests_status on staffing_requests(status);

-- Ticketing sync snapshots (Eventbrite/manual + future providers)
create table if not exists ticketing_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  provider text default 'manual',
  provider_event_id text,
  seats_available integer,
  tickets_sold integer,
  gross_revenue numeric(12,2),
  net_revenue numeric(12,2),
  currency text default 'USD',
  raw_payload jsonb default '{}'::jsonb,
  synced_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_ticketing_snapshots_user on ticketing_snapshots(user_id);
create index if not exists idx_ticketing_snapshots_event on ticketing_snapshots(event_id);
create index if not exists idx_ticketing_snapshots_provider on ticketing_snapshots(provider);

-- Deal memos / contracting workflow
create table if not exists deal_memos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  title text not null default 'Deal Memo',
  status text default 'draft',
  deal_type text default 'performance',
  buyer_name text default '',
  buyer_email text default '',
  buyer_phone text default '',
  seller_name text default '',
  seller_email text default '',
  seller_phone text default '',
  event_date date,
  venue_name text default '',
  compensation_model text default 'guarantee',
  guarantee_amount numeric(12,2),
  deposit_amount numeric(12,2),
  backend_split text default '',
  door_split text default '',
  merch_split text default '',
  settlement_due_hours integer,
  cancellation_terms text default '',
  force_majeure_terms text default '',
  hospitality_terms text default '',
  tech_rider_terms text default '',
  promo_commitments text default '',
  notes text default '',
  sent_at timestamptz,
  signed_at timestamptz,
  version integer default 1,
  pdf_base64 text,
  pdf_filename text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_deal_memos_user on deal_memos(user_id);
create index if not exists idx_deal_memos_event on deal_memos(event_id);
create index if not exists idx_deal_memos_status on deal_memos(status);

-- Credential + day-of-show attendance tracking
create table if not exists show_checkins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  contact_name text not null default '',
  contact_role text default '',
  contact_type text default 'crew',
  credential_label text default '',
  phone text default '',
  email text default '',
  status text default 'expected',
  checked_in_at timestamptz,
  check_in_method text default 'manual',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_show_checkins_user on show_checkins(user_id);
create index if not exists idx_show_checkins_event on show_checkins(event_id);
create index if not exists idx_show_checkins_status on show_checkins(status);

-- Financial settlement + reconciliation snapshots
create table if not exists settlement_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  title text not null default 'Settlement Report',
  status text default 'draft',
  currency text default 'USD',
  gross_revenue numeric(12,2),
  taxes_fees numeric(12,2) default 0,
  promoter_costs numeric(12,2) default 0,
  production_costs numeric(12,2) default 0,
  other_deductions numeric(12,2) default 0,
  net_revenue numeric(12,2),
  guaranteed_payout numeric(12,2),
  actual_payout numeric(12,2),
  splits jsonb default '{}'::jsonb,
  payout_lines jsonb default '[]'::jsonb,
  notes text default '',
  reported_at timestamptz,
  approved_at timestamptz,
  exported_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_settlement_reports_user on settlement_reports(user_id);
create index if not exists idx_settlement_reports_event on settlement_reports(event_id);
create index if not exists idx_settlement_reports_status on settlement_reports(status);

-- Ticketing connector registry (extensible provider model)
create table if not exists ticketing_providers (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  type text not null unique,
  auth_type text default 'none',
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into ticketing_providers (name, type, auth_type, is_active)
values
  ('Eventbrite', 'eventbrite', 'api_key', true),
  ('Ticketmaster', 'ticketmaster', 'oauth', true)
on conflict (type)
do update set
  name = excluded.name,
  auth_type = excluded.auth_type,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists venue_ticketing_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  venue_profile_id uuid references venue_profiles(id) on delete cascade,
  ticketing_provider_id uuid references ticketing_providers(id) on delete cascade,
  oauth_access_token text,
  oauth_refresh_token text,
  api_key text,
  account_id text,
  connection_status text default 'not_connected',
  is_default boolean default false,
  manual_mode boolean default false,
  metadata jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (venue_profile_id, ticketing_provider_id)
);

create index if not exists idx_venue_ticketing_connections_user on venue_ticketing_connections(user_id);
create index if not exists idx_venue_ticketing_connections_venue on venue_ticketing_connections(venue_profile_id);
create index if not exists idx_venue_ticketing_connections_provider on venue_ticketing_connections(ticketing_provider_id);

create table if not exists booking_ticketing_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  ticketing_provider_id uuid references ticketing_providers(id) on delete set null,
  external_event_id text,
  external_event_url text,
  ticket_sales_url text,
  gross_sales numeric(12,2),
  tickets_sold integer,
  manual_mode boolean default false,
  sync_status text default 'not_connected',
  last_synced_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_booking_ticketing_records_user on booking_ticketing_records(user_id);
create index if not exists idx_booking_ticketing_records_booking on booking_ticketing_records(booking_id);
create index if not exists idx_booking_ticketing_records_provider on booking_ticketing_records(ticketing_provider_id);

alter table venue_profiles add column if not exists default_ticketing_provider_id uuid;
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'venue_profiles'
      and constraint_name = 'venue_profiles_default_ticketing_provider_fk'
  ) then
    alter table venue_profiles
      add constraint venue_profiles_default_ticketing_provider_fk
      foreign key (default_ticketing_provider_id) references ticketing_providers(id) on delete set null;
  end if;
end $$;

alter table events add column if not exists selected_ticketing_provider_id uuid;
alter table events add column if not exists ticketing_manual_mode boolean default false;
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'events'
      and constraint_name = 'events_selected_ticketing_provider_fk'
  ) then
    alter table events
      add constraint events_selected_ticketing_provider_fk
      foreign key (selected_ticketing_provider_id) references ticketing_providers(id) on delete set null;
  end if;
end $$;

-- Production checklist engine tied to stage plots / show configs
create table if not exists production_checklists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  show_configuration_id uuid references show_configurations(id) on delete set null,
  stage_plot_document_id uuid references stage_plot_documents(id) on delete set null,
  title text not null default 'Production Checklist',
  phase text default 'preflight',
  status text default 'draft',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists production_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  checklist_id uuid references production_checklists(id) on delete cascade,
  sort_order integer default 0,
  category text default 'general',
  label text not null default '',
  required boolean default true,
  status text default 'todo',
  provider_scope text default 'house',
  assignee_name text default '',
  assignee_role text default '',
  due_at timestamptz,
  checked_at timestamptz,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_production_checklists_user on production_checklists(user_id);
create index if not exists idx_production_checklists_event on production_checklists(event_id);
create index if not exists idx_production_checklist_items_checklist on production_checklist_items(checklist_id);
create index if not exists idx_production_checklist_items_status on production_checklist_items(status);

-- Venue inventory + maintenance operations
create table if not exists venue_inventory_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  venue_profile_id uuid references venue_profiles(id) on delete cascade,
  item_name text not null default '',
  category text default '',
  subcategory text default '',
  quantity integer default 1,
  unit text default 'ea',
  serial_number text default '',
  ownership text default 'house',
  location text default '',
  status text default 'active',
  last_service_at timestamptz,
  next_service_due_at timestamptz,
  maintenance_interval_days integer,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists venue_maintenance_contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  venue_profile_id uuid references venue_profiles(id) on delete cascade,
  name text not null default '',
  role text default '',
  company text default '',
  phone text default '',
  email text default '',
  contact_type text default 'vendor',
  preferred_method text default 'email',
  is_primary boolean default false,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists venue_maintenance_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  venue_profile_id uuid references venue_profiles(id) on delete cascade,
  inventory_item_id uuid references venue_inventory_items(id) on delete set null,
  assigned_contact_id uuid references venue_maintenance_contacts(id) on delete set null,
  title text not null default '',
  description text default '',
  status text default 'scheduled',
  priority text default 'normal',
  scheduled_for timestamptz,
  completed_at timestamptz,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_venue_inventory_items_venue on venue_inventory_items(venue_profile_id);
create index if not exists idx_venue_inventory_items_status on venue_inventory_items(status);
create index if not exists idx_venue_maintenance_contacts_venue on venue_maintenance_contacts(venue_profile_id);
create index if not exists idx_venue_maintenance_tasks_venue on venue_maintenance_tasks(venue_profile_id);
create index if not exists idx_venue_maintenance_tasks_status on venue_maintenance_tasks(status);

-- Venue supplier directory + vendor routing
create table if not exists venue_suppliers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  venue_id uuid references venue_profiles(id) on delete cascade,
  supplier_name text not null default '',
  supplier_type text default 'local_store',
  google_place_id text,
  address_line1 text default '',
  address_line2 text default '',
  city text default '',
  state text default '',
  postal_code text default '',
  country text default 'US',
  phone text,
  email text,
  website_url text,
  ordering_url text,
  account_number text,
  notes text,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists supplier_contacts (
  id uuid primary key default uuid_generate_v4(),
  venue_supplier_id uuid references venue_suppliers(id) on delete cascade,
  name text not null default '',
  title text default '',
  phone text default '',
  email text default '',
  notes text default '',
  is_primary boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists inventory_item_supplier_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  inventory_item_id uuid references venue_inventory_items(id) on delete cascade,
  venue_supplier_id uuid references venue_suppliers(id) on delete cascade,
  supplier_sku text,
  supplier_item_url text,
  preferred boolean default false,
  last_price_paid numeric(12,2),
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (inventory_item_id, venue_supplier_id)
);

create table if not exists google_place_cache (
  place_id text primary key,
  place_type text default 'supplier',
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists booking_purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  venue_profile_id uuid references venue_profiles(id) on delete set null,
  venue_supplier_id uuid references venue_suppliers(id) on delete set null,
  supplier_name text default '',
  supplier_email text default '',
  ordering_url text default '',
  supplier_address text default '',
  status text default 'draft',
  currency text default 'USD',
  delivery_instructions text default '',
  receiving_hours text default '',
  dock_notes text default '',
  purchaser_name text default '',
  purchaser_email text default '',
  split_key text default '',
  items jsonb default '[]'::jsonb,
  total_amount numeric(12,2),
  manual_mode boolean default false,
  metadata jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_venue_suppliers_venue on venue_suppliers(venue_id);
create index if not exists idx_venue_suppliers_type on venue_suppliers(supplier_type);
create index if not exists idx_supplier_contacts_supplier on supplier_contacts(venue_supplier_id);
create index if not exists idx_inventory_supplier_links_inventory on inventory_item_supplier_links(inventory_item_id);
create index if not exists idx_inventory_supplier_links_supplier on inventory_item_supplier_links(venue_supplier_id);
create index if not exists idx_booking_purchase_orders_event on booking_purchase_orders(event_id);
create index if not exists idx_booking_purchase_orders_venue on booking_purchase_orders(venue_profile_id);
create index if not exists idx_booking_purchase_orders_supplier on booking_purchase_orders(venue_supplier_id);
create unique index if not exists idx_venue_suppliers_unique_name on venue_suppliers (venue_id, lower(supplier_name));
create unique index if not exists idx_google_place_cache_key on google_place_cache (place_id, place_type);

-- Costumes + hair/makeup planning
create table if not exists production_costume_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade unique,
  costume_designer_contact_id uuid references participant_profiles(id) on delete set null,
  wardrobe_supervisor_contact_id uuid references participant_profiles(id) on delete set null,
  hair_makeup_lead_contact_id uuid references participant_profiles(id) on delete set null,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists costume_characters (
  id uuid primary key default uuid_generate_v4(),
  costume_plan_id uuid references production_costume_plans(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  character_name text not null default '',
  performer_name text default '',
  performer_contact_id uuid references participant_profiles(id) on delete set null,
  costume_list jsonb default '[]'::jsonb,
  costume_location text default '',
  quick_change_notes text default '',
  fittings_schedule text default '',
  special_requirements text default '',
  attachments jsonb default '[]'::jsonb,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Set design / scenery planning
create table if not exists production_set_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade unique,
  scenic_designer_contact_id uuid references participant_profiles(id) on delete set null,
  technical_director_contact_id uuid references participant_profiles(id) on delete set null,
  props_master_contact_id uuid references participant_profiles(id) on delete set null,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists set_elements (
  id uuid primary key default uuid_generate_v4(),
  set_plan_id uuid references production_set_plans(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  element_name text not null default '',
  category text default 'scenery',
  dimensions text default '',
  build_status text default 'planned',
  storage_location text default '',
  load_in_requirements text default '',
  strike_requirements text default '',
  safety_notes text default '',
  attachments jsonb default '[]'::jsonb,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Parking / permits / maps
create table if not exists parking_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade unique,
  parking_coordinator_contact_id uuid references participant_profiles(id) on delete set null,
  venue_parking_notes text default '',
  arrival_window_notes text default '',
  loading_zone_notes text default '',
  rideshare_notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists parking_assets (
  id uuid primary key default uuid_generate_v4(),
  parking_plan_id uuid references parking_plans(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  asset_type text default 'instruction_pdf',
  title text not null default '',
  file_attachment_id text not null default '',
  who_is_it_for text default '',
  distribution_list jsonb default '[]'::jsonb,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists parking_assignments (
  id uuid primary key default uuid_generate_v4(),
  parking_plan_id uuid references parking_plans(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  permit_asset_id uuid references parking_assets(id) on delete set null,
  person_or_group text default '',
  assigned_contact_id uuid references participant_profiles(id) on delete set null,
  vehicle_plate text default '',
  arrival_time timestamptz,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Dressing rooms + assignments
create table if not exists dressing_rooms (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  venue_id uuid references venue_profiles(id) on delete cascade,
  zone_id uuid references performance_zones(id) on delete set null,
  room_name_or_number text not null default '',
  capacity integer,
  location_notes text default '',
  amenities jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists dressing_room_assignments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  dressing_room_id uuid references dressing_rooms(id) on delete cascade,
  assigned_to text default '',
  assigned_contact_id uuid references participant_profiles(id) on delete set null,
  notes text default '',
  access_instructions text default '',
  key_code_or_badge_notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Packet exports for operations modules
create table if not exists operations_packets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  packet_type text default 'production_dept',
  sections jsonb default '[]'::jsonb,
  sanitized boolean default false,
  html_content text default '',
  pdf_base64 text,
  pdf_filename text,
  share_token text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Media capture + Zoom + YouTube distribution
create table if not exists media_capture_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade unique,
  recording_type text default 'video',
  capture_mode text default 'static',
  primary_platform text default 'youtube',
  stream_live boolean default false,
  post_production_notes text default '',
  rights_clearance_status text default 'pending',
  distribution_channels jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists capture_sources (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  type text default 'camera',
  name text not null default '',
  location text default '',
  operator text default '',
  ai_control_enabled boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists zoom_meeting_configs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade unique,
  zoom_meeting_type text default 'meeting',
  zoom_meeting_id text,
  zoom_join_url text,
  zoom_host_email text,
  zoom_passcode text,
  zoom_settings_json jsonb default '{}'::jsonb,
  zoom_cloud_recording_enabled boolean default false,
  zoom_transcript_enabled boolean default false,
  zoom_status text default 'not_scheduled',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists zoom_assets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  asset_type text default 'cloud_recording',
  provider text default 'zoom',
  external_asset_id text,
  download_url text,
  file_attachment_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists youtube_distributions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade unique,
  youtube_video_id text,
  youtube_video_url text,
  publish_status text default 'not_published',
  publish_notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Concessions / food and beverage operations
create table if not exists concessions_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade unique,
  is_active boolean default true,
  manager_contact_id uuid references participant_profiles(id) on delete set null,
  bar_open_time timestamptz,
  bar_close_time timestamptz,
  intermission_service boolean default false,
  cashless_only boolean default false,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists concessions_menu_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  name text not null default '',
  category text default 'other',
  price numeric(12,2),
  cost_basis numeric(12,2),
  supplier_reference text,
  alcohol_flag boolean default false,
  inventory_link text,
  is_signature_item boolean default false,
  availability_status text default 'available',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists concessions_menu_library_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete set null,
  source_booking_id uuid references events(id) on delete set null,
  source_venue_profile_id uuid,
  name text not null default '',
  category text default 'other',
  price numeric(12,2),
  cost_basis numeric(12,2),
  supplier_reference text,
  alcohol_flag boolean default false,
  inventory_link text,
  is_signature_item boolean default false,
  availability_status text default 'available',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  is_public boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Merchandising + vendor marketplace
create table if not exists merch_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade unique,
  merch_manager_contact_id uuid references participant_profiles(id) on delete set null,
  table_fee boolean default false,
  table_fee_amount numeric(12,2),
  merch_area_location text default '',
  load_in_time timestamptz,
  marketplace_mode boolean default false,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists merch_participants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  contact_id uuid references participant_profiles(id) on delete set null,
  name text not null default '',
  organization_name text default '',
  emergency_contact_name text default '',
  emergency_contact_phone text default '',
  emergency_contact_email text default '',
  supervisor_name text default '',
  merch_table_required boolean default true,
  staff_running_table text default '',
  e_retail_links jsonb default '[]'::jsonb,
  on_site_inventory_description text default '',
  payment_methods_accepted jsonb default '[]'::jsonb,
  table_assignment_label text default '',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists merch_revenue_splits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  participant_id uuid references merch_participants(id) on delete set null,
  applies_to text default 'all_merch',
  split_type text default 'gross',
  table_fee_deducted_first boolean default false,
  percentage_allocations jsonb default '[]'::jsonb,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Festival mode
create table if not exists festivals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null default '',
  starts_on date,
  ends_on date,
  venue_profile_id uuid references venue_profiles(id) on delete set null,
  venue_or_district text default '',
  notes text default '',
  site_map_attachments jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists festival_stages (
  id uuid primary key default uuid_generate_v4(),
  festival_id uuid references festivals(id) on delete cascade,
  zone_id uuid references performance_zones(id) on delete set null,
  stage_name text not null default '',
  sort_order integer default 0,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists festival_bookings (
  id uuid primary key default uuid_generate_v4(),
  festival_id uuid references festivals(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  stage_id uuid references festival_stages(id) on delete set null,
  zone_id uuid references performance_zones(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Touring mode
create table if not exists touring_shows (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null default '',
  show_type text default 'band',
  default_show_configuration_id uuid references show_configurations(id) on delete set null,
  default_checklists jsonb default '[]'::jsonb,
  default_hospitality_rider jsonb default '[]'::jsonb,
  default_set_package jsonb default '{}'::jsonb,
  default_costume_package jsonb default '{}'::jsonb,
  touring_staff_contacts jsonb default '[]'::jsonb,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tour_dates (
  id uuid primary key default uuid_generate_v4(),
  touring_show_id uuid references touring_shows(id) on delete cascade,
  venue_id uuid references venue_profiles(id) on delete set null,
  zone_id uuid references performance_zones(id) on delete set null,
  booking_id uuid references events(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Board dashboard risk/issues
create table if not exists board_risk_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  title text not null default '',
  severity text default 'medium',
  status text default 'open',
  owner_contact_id uuid references participant_profiles(id) on delete set null,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Safety, security, compliance, and risk management
create table if not exists event_safety_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  venue_profile_id uuid references venue_profiles(id) on delete set null,
  organization_label text default '',
  indoor_outdoor text default 'indoor',
  expected_attendance integer default 0,
  alcohol_present boolean default false,
  ticketed_event boolean default false,
  security_staff_count integer default 0,
  weather_exposure text default 'low',
  generator_use boolean default false,
  fire_risk_factors jsonb default '[]'::jsonb,
  vip_attendance boolean default false,
  local_crime_risk text default '',
  security_staffing_ratio numeric(10,2),
  risk_score integer default 0,
  risk_level text default 'low',
  recommendations jsonb default '[]'::jsonb,
  responsible_person text default '',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_permits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  permit_type text not null default '',
  status text default 'pending',
  permit_number text default '',
  issuing_authority text default '',
  expires_at timestamptz,
  file_url text default '',
  responsible_person text default '',
  alert_days integer default 30,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_insurance_policies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  policy_type text not null default '',
  policy_number text default '',
  coverage_limits text default '',
  deductible numeric(12,2),
  carrier text default '',
  expires_at timestamptz,
  additional_insured text default '',
  coi_file_url text default '',
  status text default 'active',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_surveillance_assets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  asset_type text default 'fixed_camera',
  camera_id text default '',
  location text default '',
  coverage_zone text default '',
  power_source text default '',
  network_type text default '',
  recording_status text default 'active',
  retention_days integer default 30,
  monitoring_station text default '',
  monitoring_assignee text default '',
  live_feed_url text default '',
  access_level text default 'restricted',
  permissions jsonb default '[]'::jsonb,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_access_control_points (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  control_type text default 'checkpoint',
  label text default '',
  location text default '',
  clearance_level text default 'general',
  assigned_staff text default '',
  access_hours text default '',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_crowd_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  barricade_plan text default '',
  queue_plan text default '',
  vip_lane_plan text default '',
  ada_access_plan text default '',
  emergency_assembly_points text default '',
  staffing_ratio text default '',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_medical_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  first_aid_station text default '',
  emt_staffing text default '',
  aed_locations text default '',
  cooling_stations text default '',
  hydration_stations text default '',
  narcan_kits text default '',
  ambulance_staging text default '',
  emergency_numbers text default '',
  staff_briefing_notes text default '',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_sanitation_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  restrooms text default '',
  hand_washing_stations text default '',
  sanitizer_stations text default '',
  waste_bins text default '',
  grease_disposal text default '',
  food_vendor_permits_verified boolean default false,
  ada_restroom_notes text default '',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_weather_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  heat_index_threshold text default '',
  rain_plan text default '',
  wind_threshold text default '',
  lightning_protocol text default '',
  evacuation_shelter_location text default '',
  backup_indoor_venue text default '',
  weather_monitor_assignee text default '',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_city_coordination (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  police_liaison text default '',
  off_duty_officers_count integer default 0,
  fire_department_contact text default '',
  ems_contact text default '',
  city_event_contact text default '',
  command_center_location text default '',
  communication_plan text default '',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_incidents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  occurred_at timestamptz default now(),
  location text default '',
  incident_type text default 'other',
  description text default '',
  staff_involved text default '',
  resolution text default '',
  follow_up_required boolean default false,
  follow_up_notes text default '',
  file_url text default '',
  visibility text default 'internal',
  status text default 'open',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_emergency_action_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  version_number integer default 1,
  title text default 'Emergency Action Plan',
  risk_level text default 'low',
  content_json jsonb default '{}'::jsonb,
  generated_by text default '',
  generated_at timestamptz default now(),
  share_slug text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_safety_checklists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  title text default 'Safety Checklist',
  phase text default 'pre_show',
  status text default 'draft',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_safety_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  checklist_id uuid references event_safety_checklists(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  sort_order integer default 0,
  category text default 'general',
  label text not null default '',
  required boolean default true,
  status text default 'todo',
  assignee_name text default '',
  due_at timestamptz,
  checked_at timestamptz,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_production_costume_plans_event on production_costume_plans(event_id);
create index if not exists idx_costume_characters_plan on costume_characters(costume_plan_id);
create index if not exists idx_costume_characters_event on costume_characters(event_id);
create index if not exists idx_production_set_plans_event on production_set_plans(event_id);
create index if not exists idx_set_elements_plan on set_elements(set_plan_id);
create index if not exists idx_set_elements_event on set_elements(event_id);
create index if not exists idx_parking_plans_event on parking_plans(event_id);
create index if not exists idx_parking_assets_plan on parking_assets(parking_plan_id);
create index if not exists idx_parking_assignments_plan on parking_assignments(parking_plan_id);
create index if not exists idx_dressing_rooms_venue on dressing_rooms(venue_id);
create index if not exists idx_dressing_room_assignments_booking on dressing_room_assignments(booking_id);
create index if not exists idx_operations_packets_event on operations_packets(event_id);
create index if not exists idx_media_capture_plans_booking on media_capture_plans(booking_id);
create index if not exists idx_capture_sources_booking on capture_sources(booking_id);
create index if not exists idx_zoom_meeting_configs_booking on zoom_meeting_configs(booking_id);
create index if not exists idx_zoom_assets_booking on zoom_assets(booking_id);
create index if not exists idx_youtube_distributions_booking on youtube_distributions(booking_id);
create index if not exists idx_concessions_plans_booking on concessions_plans(booking_id);
create index if not exists idx_concessions_menu_items_booking on concessions_menu_items(booking_id);
create index if not exists idx_concessions_menu_library_items_name on concessions_menu_library_items(name);
create index if not exists idx_concessions_menu_library_items_category on concessions_menu_library_items(category);
create index if not exists idx_concessions_menu_library_items_public on concessions_menu_library_items(is_public, is_active);
create index if not exists idx_merch_plans_booking on merch_plans(booking_id);
create index if not exists idx_merch_participants_booking on merch_participants(booking_id);
create index if not exists idx_merch_revenue_splits_booking on merch_revenue_splits(booking_id);
create index if not exists idx_festivals_user on festivals(user_id);
create index if not exists idx_festival_stages_festival on festival_stages(festival_id);
create index if not exists idx_festival_bookings_festival on festival_bookings(festival_id);
create index if not exists idx_festival_bookings_event on festival_bookings(event_id);
create index if not exists idx_touring_shows_user on touring_shows(user_id);
create index if not exists idx_tour_dates_show on tour_dates(touring_show_id);
create index if not exists idx_tour_dates_booking on tour_dates(booking_id);
create index if not exists idx_board_risk_items_event on board_risk_items(event_id);
create unique index if not exists idx_event_safety_profiles_unique_event on event_safety_profiles(event_id);
create index if not exists idx_event_safety_profiles_risk_level on event_safety_profiles(risk_level);
create index if not exists idx_event_permits_event on event_permits(event_id);
create index if not exists idx_event_permits_expiry on event_permits(expires_at);
create index if not exists idx_event_insurance_event on event_insurance_policies(event_id);
create index if not exists idx_event_insurance_expiry on event_insurance_policies(expires_at);
create index if not exists idx_event_surveillance_assets_event on event_surveillance_assets(event_id);
create index if not exists idx_event_access_control_points_event on event_access_control_points(event_id);
create unique index if not exists idx_event_crowd_plans_unique_event on event_crowd_plans(event_id);
create unique index if not exists idx_event_medical_plans_unique_event on event_medical_plans(event_id);
create unique index if not exists idx_event_sanitation_plans_unique_event on event_sanitation_plans(event_id);
create unique index if not exists idx_event_weather_plans_unique_event on event_weather_plans(event_id);
create unique index if not exists idx_event_city_coordination_unique_event on event_city_coordination(event_id);
create index if not exists idx_event_incidents_event on event_incidents(event_id);
create index if not exists idx_event_incidents_type on event_incidents(incident_type);
create index if not exists idx_event_eap_event on event_emergency_action_plans(event_id);
create index if not exists idx_event_safety_checklists_event on event_safety_checklists(event_id);
create index if not exists idx_event_safety_checklist_items_checklist on event_safety_checklist_items(checklist_id);

-- Staffing engine
create table if not exists job_titles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  department text default '',
  is_system boolean default false,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists staff_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  first_name text default '',
  last_name text default '',
  display_name text default '',
  phone_number text not null default '',
  email text default '',
  job_titles jsonb default '[]'::jsonb,
  primary_role text default '',
  pay_type text default 'hourly',
  default_rate numeric(12,2),
  supervisor_contact_id uuid references participant_profiles(id) on delete set null,
  emergency_contact jsonb default '{}'::jsonb,
  notes text default '',
  tax_profile_link text default '',
  voice_source_transcript text default '',
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists staff_assignments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  staff_profile_id uuid references staff_profiles(id) on delete cascade,
  job_title_id uuid references job_titles(id) on delete set null,
  job_title text default '',
  start_time timestamptz,
  end_time timestamptz,
  pay_type text default 'hourly',
  pay_override numeric(12,2),
  status text default 'scheduled',
  notes text default '',
  policy_acknowledged boolean default false,
  published_at timestamptz,
  confirmed_at timestamptz,
  declined_at timestamptz,
  notification_log jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists venue_staffing_policies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  venue_id uuid references venue_profiles(id) on delete cascade,
  call_in_policy text default '',
  notice_hours integer default 4,
  supervisor_name text default '',
  supervisor_phone text default '',
  supervisor_email text default '',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists staffing_publish_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  published_at timestamptz default now(),
  call_in_policy text default '',
  message_template text default '',
  sent_count integer default 0,
  failed_count integer default 0,
  metadata jsonb default '{}'::jsonb
);

create table if not exists staffing_inbound_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete set null,
  staff_assignment_id uuid references staff_assignments(id) on delete set null,
  from_phone text default '',
  body text default '',
  parsed_action text default '',
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_job_titles_user on job_titles(user_id);
create index if not exists idx_job_titles_name on job_titles(name);
create index if not exists idx_staff_profiles_user on staff_profiles(user_id);
create index if not exists idx_staff_profiles_phone on staff_profiles(phone_number);
create index if not exists idx_staff_assignments_booking on staff_assignments(booking_id);
create index if not exists idx_staff_assignments_staff on staff_assignments(staff_profile_id);
create index if not exists idx_staff_assignments_status on staff_assignments(status);
create index if not exists idx_venue_staffing_policies_venue on venue_staffing_policies(venue_id);
create index if not exists idx_staffing_publish_logs_booking on staffing_publish_logs(booking_id);
create index if not exists idx_staffing_inbound_messages_booking on staffing_inbound_messages(booking_id);
create unique index if not exists idx_job_titles_user_name_unique on job_titles(user_id, lower(name));
create unique index if not exists idx_job_titles_system_name_unique on job_titles(lower(name)) where user_id is null and is_system = true;

insert into job_titles (name, department, is_system, is_active, sort_order)
values
  ('Technical Director', 'production', true, true, 1),
  ('Stage Manager', 'production', true, true, 2),
  ('Assistant Stage Manager', 'production', true, true, 3),
  ('Lighting Designer', 'production', true, true, 4),
  ('Lighting Board Operator', 'production', true, true, 5),
  ('Audio Engineer (FOH)', 'production', true, true, 6),
  ('Monitor Engineer', 'production', true, true, 7),
  ('A2 (Audio Assistant)', 'production', true, true, 8),
  ('Projection Designer', 'production', true, true, 9),
  ('Video Operator', 'production', true, true, 10),
  ('Scenic Designer', 'production', true, true, 11),
  ('Props Master', 'production', true, true, 12),
  ('Wardrobe Supervisor', 'production', true, true, 13),
  ('Hair/Makeup Lead', 'production', true, true, 14),
  ('Costumer', 'production', true, true, 15),
  ('Backline Tech', 'production', true, true, 16),
  ('Rigger', 'production', true, true, 17),
  ('Production Manager', 'production', true, true, 18),
  ('Tour Manager', 'production', true, true, 19),
  ('MC / Emcee', 'production', true, true, 20),
  ('DJ', 'production', true, true, 21),
  ('Band Leader', 'production', true, true, 22),
  ('Conductor', 'production', true, true, 23),
  ('House Manager', 'foh', true, true, 24),
  ('Box Office Manager', 'foh', true, true, 25),
  ('Ticket Scanner', 'foh', true, true, 26),
  ('Usher', 'foh', true, true, 27),
  ('Door ID Checker', 'foh', true, true, 28),
  ('VIP Host', 'foh', true, true, 29),
  ('Merch Manager', 'foh', true, true, 30),
  ('Bartender', 'foh', true, true, 31),
  ('Barback', 'foh', true, true, 32),
  ('Server', 'foh', true, true, 33),
  ('Busser', 'foh', true, true, 34),
  ('Security Lead', 'foh', true, true, 35),
  ('Security Staff', 'foh', true, true, 36),
  ('Facilities Manager', 'operations', true, true, 37),
  ('Electrician', 'operations', true, true, 38),
  ('Maintenance Tech', 'operations', true, true, 39),
  ('Janitorial Staff', 'operations', true, true, 40),
  ('Parking Coordinator', 'operations', true, true, 41),
  ('Runner', 'operations', true, true, 42),
  ('Load-In Crew', 'operations', true, true, 43),
  ('Load-Out Crew', 'operations', true, true, 44),
  ('Marketing Manager', 'admin_marketing', true, true, 45),
  ('Social Media Manager', 'admin_marketing', true, true, 46),
  ('Photographer', 'admin_marketing', true, true, 47),
  ('Videographer', 'admin_marketing', true, true, 48),
  ('Board Liaison', 'admin_marketing', true, true, 49),
  ('Executive Director', 'admin_marketing', true, true, 50),
  ('Chef', 'culinary_specialty', true, true, 51),
  ('Sous Chef', 'culinary_specialty', true, true, 52),
  ('Line Cook', 'culinary_specialty', true, true, 53),
  ('Food Vendor', 'culinary_specialty', true, true, 54),
  ('Beverage Manager', 'culinary_specialty', true, true, 55)
on conflict do nothing;

-- Contracts + forms autofill
create table if not exists document_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null default '',
  doc_type text not null default 'generic',
  template_body text not null default '',
  variables jsonb default '[]'::jsonb,
  is_system boolean default false,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists booking_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  template_id uuid references document_templates(id) on delete set null,
  doc_type text not null default 'contract',
  title text not null default '',
  status text default 'draft',
  draft_body text default '',
  final_body text default '',
  autofill_payload jsonb default '{}'::jsonb,
  pdf_base64 text,
  pdf_filename text,
  share_token text unique,
  sent_at timestamptz,
  signed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_document_templates_user on document_templates(user_id);
create index if not exists idx_booking_documents_event on booking_documents(event_id);
create index if not exists idx_booking_documents_type on booking_documents(doc_type);

-- Show budgets + line items
create table if not exists booking_budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  title text not null default 'Show Budget',
  currency text default 'USD',
  status text default 'draft',
  total_budget numeric(12,2),
  estimated_gross numeric(12,2),
  estimated_net numeric(12,2),
  actual_gross numeric(12,2),
  actual_net numeric(12,2),
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists booking_budget_lines (
  id uuid primary key default uuid_generate_v4(),
  budget_id uuid references booking_budgets(id) on delete cascade,
  category text default '',
  line_item_name text not null default '',
  vendor_name text default '',
  cost_type text default 'estimated',
  amount numeric(12,2),
  quantity numeric(12,2) default 1,
  tax_rate numeric(8,4),
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_booking_budgets_event on booking_budgets(event_id);
create index if not exists idx_booking_budget_lines_budget on booking_budget_lines(budget_id);

-- Hospitality + green room rider
create table if not exists booking_riders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  title text not null default 'Green Room Rider',
  rider_type text default 'hospitality',
  status text default 'draft',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists booking_rider_items (
  id uuid primary key default uuid_generate_v4(),
  rider_id uuid references booking_riders(id) on delete cascade,
  section text default 'hospitality',
  label text not null default '',
  quantity numeric(12,2) default 1,
  unit text default 'ea',
  required boolean default true,
  status text default 'requested',
  provided_by text default 'venue',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_booking_riders_event on booking_riders(event_id);
create index if not exists idx_booking_rider_items_rider on booking_rider_items(rider_id);

-- ═══════════════════════════════════════════════════════════════
-- CAMPAIGNS (distribution tracking per event per channel)
-- ═══════════════════════════════════════════════════════════════
create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id),
  channel text not null, -- press, calendar_do210, eventbrite, social_facebook, social_instagram, social_linkedin, email, sms, bilingual, press_page, podcast, etc.
  status text default 'not_started' check (status in ('not_started', 'pending', 'queued', 'sent', 'published', 'created', 'failed', 'error')),
  -- Channel-specific data
  external_id text, -- eventbrite event id, fb event id, etc.
  external_url text, -- link to the published item
  recipients integer,
  error_message text,
  metadata jsonb default '{}'::jsonb, -- flexible per-channel data
  -- Timestamps
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_campaigns_event on campaigns(event_id);
create index idx_campaigns_user on campaigns(user_id);
create index idx_campaigns_channel on campaigns(channel);

-- ═══════════════════════════════════════════════════════════════
-- ACTIVITY LOG
-- ═══════════════════════════════════════════════════════════════
create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete set null,
  action text not null, -- login, signup, event_create, content_generate, distribution_send, etc.
  details jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz default now()
);

create index idx_activity_user on activity_log(user_id);
create index idx_activity_action on activity_log(action);
create index idx_activity_created on activity_log(created_at desc);

-- ═══════════════════════════════════════════════════════════════
-- GENERATED CONTENT (press releases, social posts, etc.)
-- ═══════════════════════════════════════════════════════════════
create table generated_content (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id),
  content_type text not null, -- press_release, social_facebook, social_instagram, social_linkedin, email, sms, calendar_listing, bilingual_press, bilingual_social, podcast_script
  content text,
  language text default 'en',
  model_used text, -- gpt-4o, gemini, etc.
  tokens_used integer,
  drive_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_content_event on generated_content(event_id);
create index idx_content_user on generated_content(user_id);

-- ═══════════════════════════════════════════════════════════════
-- GENERATED IMAGES
-- ═══════════════════════════════════════════════════════════════
create table generated_images (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id),
  format_key text, -- ig_post_square, fb_event_banner, poster_11x17, etc.
  image_url text,
  drive_url text,
  model_used text, -- nano-banana, dall-e-3, etc.
  prompt text,
  width integer,
  height integer,
  created_at timestamptz default now()
);

create index idx_images_event on generated_images(event_id);

-- ═══════════════════════════════════════════════════════════════
-- CALENDAR SUBMISSION QUEUE (Do210 / SA Current / Evvnt workers)
-- ═══════════════════════════════════════════════════════════════
create table if not exists calendar_submissions (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  event_data jsonb not null default '{}'::jsonb,
  platforms text[] default array['do210', 'sacurrent', 'evvnt']::text[],
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  results jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  processed_at timestamptz,
  updated_at timestamptz default now(),
  error text
);

create index if not exists idx_calendar_submissions_event on calendar_submissions(event_id);
create index if not exists idx_calendar_submissions_status on calendar_submissions(status, created_at desc);

-- ═══════════════════════════════════════════════════════════════
-- VIDEO TRANSCODE / VARIANT JOBS (worker queue)
-- ═══════════════════════════════════════════════════════════════
create table if not exists video_transcode_jobs (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  source_url text not null,
  source_path text,
  source_meta jsonb default '{}'::jsonb,
  targets jsonb default '[]'::jsonb,
  outputs jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  processed_at timestamptz,
  error text
);

create index if not exists idx_video_transcode_jobs_event on video_transcode_jobs(event_id);
create index if not exists idx_video_transcode_jobs_status on video_transcode_jobs(status, created_at desc);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Users can only see their own data; admins see everything
-- ═══════════════════════════════════════════════════════════════

alter table users enable row level security;
alter table profiles enable row level security;
alter table events enable row level security;
alter table campaigns enable row level security;
alter table activity_log enable row level security;
alter table generated_content enable row level security;
alter table generated_images enable row level security;
alter table invites enable row level security;

-- Public read for auth (login/signup checks)
create policy "Users can read own record" on users
  for select using (
    auth.uid()::text = coalesce(auth_user_id::text, id::text)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "Users can update own record" on users
  for update using (
    auth.uid()::text = coalesce(auth_user_id::text, id::text)
  );

-- Profiles: own data
create policy "Users see own profiles" on profiles
  for all using (
    exists (
      select 1
      from users u
      where u.id = profiles.user_id
        and (
          u.auth_user_id = auth.uid()
          or u.id::text = auth.uid()::text
          or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

-- Events: own data
create policy "Users see own events" on events
  for all using (
    exists (
      select 1
      from users u
      where u.id = events.user_id
        and (
          u.auth_user_id = auth.uid()
          or u.id::text = auth.uid()::text
          or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

-- Campaigns: own data
create policy "Users see own campaigns" on campaigns
  for all using (
    exists (
      select 1
      from users u
      where u.id = campaigns.user_id
        and (
          u.auth_user_id = auth.uid()
          or u.id::text = auth.uid()::text
          or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

-- Activity: own data
create policy "Users see own activity" on activity_log
  for select using (
    exists (
      select 1
      from users u
      where u.id = activity_log.user_id
        and (
          u.auth_user_id = auth.uid()
          or u.id::text = auth.uid()::text
          or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

-- Content: own data
create policy "Users see own content" on generated_content
  for all using (
    exists (
      select 1
      from users u
      where u.id = generated_content.user_id
        and (
          u.auth_user_id = auth.uid()
          or u.id::text = auth.uid()::text
          or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

-- Images: own data
create policy "Users see own images" on generated_images
  for all using (
    exists (
      select 1
      from users u
      where u.id = generated_images.user_id
        and (
          u.auth_user_id = auth.uid()
          or u.id::text = auth.uid()::text
          or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

-- Invites: public read for signup validation
create policy "Anyone can read invites" on invites
  for select using (true);

-- ═══════════════════════════════════════════════════════════════
-- ADMIN SERVICE ROLE bypasses RLS automatically
-- Use supabase.service_role key for admin dashboard queries
-- ═══════════════════════════════════════════════════════════════

-- Seed admin user
insert into users (email, name, is_admin, client_type)
values ('juliegood@goodcreativemedia.com', 'Julie Good', true, 'venue')
on conflict (email) do update set is_admin = true;

-- ═══════════════════════════════════════════════════════════════
-- Workforce Ops: Emergency Contacts, Training, Certifications, Time Clock,
-- Payroll exports helpers, AI completion tasks and audit logs.
-- ═══════════════════════════════════════════════════════════════

create table if not exists emergency_contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  staff_profile_id uuid references staff_profiles(id) on delete cascade,
  name text not null default '',
  relationship text default '',
  phone text default '',
  email text default '',
  notes text default '',
  is_primary boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists training_courses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  venue_id uuid references venue_profiles(id) on delete set null,
  title text not null default '',
  category text default 'other',
  description text default '',
  duration_minutes integer,
  materials_links jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists training_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  training_course_id uuid references training_courses(id) on delete cascade,
  venue_id uuid references venue_profiles(id) on delete set null,
  zone_id uuid references performance_zones(id) on delete set null,
  session_type text default 'workshop',
  start_datetime timestamptz,
  end_datetime timestamptz,
  instructor_contact_id uuid references participant_profiles(id) on delete set null,
  location_notes text default '',
  capacity integer,
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists training_enrollments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  training_session_id uuid references training_sessions(id) on delete cascade,
  staff_profile_id uuid references staff_profiles(id) on delete cascade,
  status text default 'invited',
  completed_at timestamptz,
  notes text default '',
  reminders_sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists certification_types (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null default '',
  category text default 'other',
  renewable boolean default true,
  default_valid_days integer,
  reminder_offsets_days jsonb default '[60,30,7]'::jsonb,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists staff_certifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  staff_profile_id uuid references staff_profiles(id) on delete cascade,
  certification_type_id uuid references certification_types(id) on delete set null,
  certificate_number text default '',
  issued_at timestamptz,
  expires_at timestamptz,
  status text default 'unknown',
  attachment_id text,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists time_clock_shifts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  booking_id uuid references events(id) on delete cascade,
  staff_assignment_id uuid references staff_assignments(id) on delete cascade,
  staff_profile_id uuid references staff_profiles(id) on delete cascade,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_check_in timestamptz,
  actual_check_out timestamptz,
  break_minutes integer default 0,
  status text default 'not_started',
  notes text default '',
  token_zone_id uuid references performance_zones(id) on delete set null,
  audit_log jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists completion_tasks (
  id uuid primary key default uuid_generate_v4(),
  assigned_to_user_id uuid references users(id) on delete cascade,
  created_by_user_id uuid references users(id) on delete set null,
  entity_type text not null default 'entity',
  entity_id text,
  title text not null default 'Complete missing fields',
  missing_fields_json jsonb default '[]'::jsonb,
  status text default 'open',
  priority text default 'normal',
  due_at timestamptz,
  reminder_cadence jsonb default '[24,72,168]'::jsonb,
  reminder_last_sent_at timestamptz,
  reminder_count integer default 0,
  source_type text default 'ai_assist',
  source_context text default '',
  metadata jsonb default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists notification_templates (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  subject_template text not null,
  body_template text not null,
  tone text default 'professor_good',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ai_assist_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  form_type text default '',
  source_type text default 'paste',
  source_context text default '',
  fields_applied jsonb default '[]'::jsonb,
  proposed_count integer default 0,
  applied_count integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_emergency_contacts_staff on emergency_contacts(staff_profile_id);
create index if not exists idx_emergency_contacts_user on emergency_contacts(user_id);
create index if not exists idx_training_courses_user on training_courses(user_id);
create index if not exists idx_training_sessions_course on training_sessions(training_course_id);
create index if not exists idx_training_sessions_start on training_sessions(start_datetime);
create index if not exists idx_training_enrollments_session on training_enrollments(training_session_id);
create index if not exists idx_training_enrollments_staff on training_enrollments(staff_profile_id);
create index if not exists idx_certification_types_name on certification_types(lower(name));
create index if not exists idx_staff_certifications_staff on staff_certifications(staff_profile_id);
create index if not exists idx_staff_certifications_expiry on staff_certifications(expires_at);
create index if not exists idx_time_clock_shifts_booking on time_clock_shifts(booking_id);
create index if not exists idx_time_clock_shifts_assignment on time_clock_shifts(staff_assignment_id);
create index if not exists idx_completion_tasks_assignee on completion_tasks(assigned_to_user_id);
create index if not exists idx_completion_tasks_status on completion_tasks(status);
create index if not exists idx_ai_assist_audit_logs_user on ai_assist_audit_logs(user_id);
create index if not exists idx_ai_assist_audit_logs_event on ai_assist_audit_logs(event_id);

-- ═══════════════════════════════════════════════════════════════
-- Rehearsal + Production Calendar (Org + Google Sync)
-- ═══════════════════════════════════════════════════════════════

create table if not exists calendar_event_types (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  org_id uuid references venue_profiles(id) on delete set null,
  type_key text not null,
  name text not null default '',
  category text default 'general',
  default_duration_minutes integer default 120,
  typical_roles jsonb default '[]'::jsonb,
  department_tags text[] default array[]::text[],
  checklist_links jsonb default '[]'::jsonb,
  is_system boolean default false,
  is_active boolean default true,
  sort_order integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists rehearsal_calendar_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  org_id uuid references venue_profiles(id) on delete set null,
  event_id uuid references events(id) on delete cascade,
  title text not null default '',
  type_key text default '',
  type_name text default '',
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  timezone text default 'America/Chicago',
  location text default '',
  description text default '',
  department_tags text[] default array[]::text[],
  assigned_roles text[] default array[]::text[],
  required_attendance text default 'required' check (required_attendance in ('required', 'optional')),
  status text default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  internal_notes text default '',
  shareable_notes text default '',
  attachments jsonb default '[]'::jsonb,
  reminder_settings jsonb default '[]'::jsonb,
  source_kind text default 'manual',
  source_ref_id text default '',
  source_payload jsonb default '{}'::jsonb,
  google_sync_enabled boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists calendar_entry_assignments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  calendar_entry_id uuid references rehearsal_calendar_entries(id) on delete cascade,
  assignee_user_id uuid references users(id) on delete set null,
  assignee_name text default '',
  assignee_role text default '',
  assignee_type text default 'user' check (assignee_type in ('user', 'role', 'group', 'external')),
  attendance_required boolean default true,
  rsvp_status text default 'pending' check (rsvp_status in ('pending', 'yes', 'no', 'maybe')),
  invited_at timestamptz,
  responded_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists calendar_entry_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  calendar_entry_id uuid references rehearsal_calendar_entries(id) on delete cascade,
  assignment_id uuid references calendar_entry_assignments(id) on delete set null,
  notification_type text default 'email' check (notification_type in ('in_app', 'email', 'sms', 'push')),
  recipient text default '',
  subject text default '',
  body text default '',
  status text default 'queued' check (status in ('queued', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists google_calendar_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  org_id uuid references venue_profiles(id) on delete set null,
  account_email text default '',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  default_calendar_id text default 'primary',
  auto_sync_types text[] default array['performance','tech_rehearsal','soundcheck','load_in','load_out']::text[],
  sync_enabled boolean default true,
  status text default 'not_connected' check (status in ('not_connected', 'connected', 'error')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists google_calendar_event_mappings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  calendar_entry_id uuid references rehearsal_calendar_entries(id) on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  last_synced_at timestamptz,
  last_sync_direction text default 'imc_to_google',
  sync_hash text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_calendar_event_types_key on calendar_event_types(type_key);
create index if not exists idx_calendar_event_types_user on calendar_event_types(user_id);
create index if not exists idx_calendar_event_types_org on calendar_event_types(org_id);
create index if not exists idx_calendar_entries_user_start on rehearsal_calendar_entries(user_id, start_datetime);
create index if not exists idx_calendar_entries_event on rehearsal_calendar_entries(event_id);
create index if not exists idx_calendar_entries_type on rehearsal_calendar_entries(type_key);
create index if not exists idx_calendar_entries_source on rehearsal_calendar_entries(source_kind, source_ref_id);
create index if not exists idx_calendar_assignments_entry on calendar_entry_assignments(calendar_entry_id);
create index if not exists idx_calendar_assignments_user on calendar_entry_assignments(assignee_user_id);
create index if not exists idx_calendar_notifications_entry on calendar_entry_notifications(calendar_entry_id);
create index if not exists idx_google_calendar_connections_user on google_calendar_connections(user_id);
create index if not exists idx_google_calendar_connections_org on google_calendar_connections(org_id);
create unique index if not exists idx_google_calendar_mappings_unique
  on google_calendar_event_mappings(calendar_entry_id, google_calendar_id);
create index if not exists idx_google_calendar_mappings_google_event on google_calendar_event_mappings(google_event_id);

insert into calendar_event_types (type_key, name, category, default_duration_minutes, typical_roles, department_tags, is_system, is_active, sort_order)
values
  ('first_rehearsal', 'First Rehearsal', 'theatre', 180, '["Stage Manager","Director","Cast"]'::jsonb, array['SM','Cast'], true, true, 1),
  ('table_read', 'Table Work / Table Read', 'theatre', 120, '["Stage Manager","Director","Cast"]'::jsonb, array['SM','Cast'], true, true, 2),
  ('blocking_rehearsal', 'Staging / Blocking Rehearsal', 'theatre', 180, '["Director","Stage Manager","Cast"]'::jsonb, array['SM','Cast'], true, true, 3),
  ('choreo_rehearsal', 'Choreo Rehearsal', 'theatre', 150, '["Choreographer","Dance Captain","Cast"]'::jsonb, array['Cast'], true, true, 4),
  ('music_rehearsal', 'Music Rehearsal', 'theatre', 150, '["Music Director","Band","Cast"]'::jsonb, array['Band','Cast'], true, true, 5),
  ('sitzprobe', 'Sitzprobe', 'theatre', 180, '["Music Director","Orchestra","Cast"]'::jsonb, array['Band','Cast'], true, true, 6),
  ('spacing_rehearsal', 'Spacing Rehearsal', 'theatre', 180, '["Stage Manager","Cast","Deck"]'::jsonb, array['SM','Deck','Cast'], true, true, 7),
  ('paper_tech', 'Paper Tech', 'theatre', 120, '["Stage Manager","Lighting","Sound","Projection"]'::jsonb, array['SM','LX','SND','PROJ'], true, true, 8),
  ('dry_tech', 'Dry Tech', 'theatre', 180, '["Stage Manager","Lighting","Sound","Projection","Deck"]'::jsonb, array['SM','LX','SND','PROJ','DECK'], true, true, 9),
  ('cue_to_cue', 'Cue-to-Cue', 'theatre', 240, '["Stage Manager","Lighting","Sound","Deck","Projection"]'::jsonb, array['SM','LX','SND','DECK','PROJ'], true, true, 10),
  ('tech_rehearsal', 'Tech Rehearsal', 'theatre', 240, '["Stage Manager","All Departments"]'::jsonb, array['SM','LX','SND','DECK','PROJ','OPS'], true, true, 11),
  ('dress_rehearsal', 'Dress Rehearsal', 'theatre', 240, '["Stage Manager","Cast","Wardrobe","Hair/Makeup"]'::jsonb, array['SM','Cast','Wardrobe'], true, true, 12),
  ('preview', 'Preview', 'theatre', 210, '["Stage Manager","FOH","Cast","Crew"]'::jsonb, array['SM','FOH','Cast','Crew'], true, true, 13),
  ('performance', 'Performance', 'production', 210, '["Stage Manager","FOH","Cast","Crew"]'::jsonb, array['SM','FOH','Cast','Crew'], true, true, 14),
  ('notes_session', 'Notes Session', 'theatre', 60, '["Director","Stage Manager","Department Heads"]'::jsonb, array['SM','Dept Heads'], true, true, 15),
  ('brush_up', 'Brush-Up / Put-In', 'theatre', 150, '["Stage Manager","Director","Understudy"]'::jsonb, array['SM','Cast'], true, true, 16),
  ('fight_call', 'Fight Call', 'theatre', 45, '["Fight Captain","Cast","Stage Manager"]'::jsonb, array['SM','Cast'], true, true, 17),
  ('warmup_call', 'Warmup Call', 'theatre', 30, '["Cast","SM"]'::jsonb, array['SM','Cast'], true, true, 18),
  ('half_hour_call', 'Half-Hour Call', 'theatre', 30, '["Cast","Crew","FOH"]'::jsonb, array['SM','Cast','Crew','FOH'], true, true, 19),
  ('places_call', 'Places Call', 'theatre', 15, '["Cast","Crew","SM"]'::jsonb, array['SM','Cast','Crew'], true, true, 20),
  ('strike', 'Strike', 'production', 180, '["Deck","Lighting","Sound","Wardrobe","Props"]'::jsonb, array['DECK','LX','SND','Wardrobe','Props'], true, true, 21),
  ('band_rehearsal', 'Band Rehearsal', 'music', 180, '["Band Leader","Band"]'::jsonb, array['Band'], true, true, 22),
  ('sectional_rehearsal', 'Sectional Rehearsal', 'music', 120, '["Section Leader","Band"]'::jsonb, array['Band'], true, true, 23),
  ('soundcheck', 'Soundcheck', 'music', 90, '["A1","A2","Band","Stage Manager"]'::jsonb, array['SND','Band','SM'], true, true, 24),
  ('line_check', 'Line Check', 'music', 45, '["A1","A2"]'::jsonb, array['SND'], true, true, 25),
  ('load_in', 'Load-In', 'ops', 120, '["Production Manager","Deck","Stagehands"]'::jsonb, array['OPS','DECK'], true, true, 26),
  ('load_out', 'Load-Out', 'ops', 120, '["Production Manager","Deck","Stagehands"]'::jsonb, array['OPS','DECK'], true, true, 27),
  ('gear_prep', 'Gear Pack / Prep', 'ops', 90, '["Backline Tech","Audio","Lighting"]'::jsonb, array['SND','LX','OPS'], true, true, 28),
  ('truck_call', 'Van/Truck Call', 'ops', 45, '["Tour Manager","Driver","Crew"]'::jsonb, array['OPS'], true, true, 29),
  ('backline_pickup', 'Backline Pickup/Return', 'ops', 60, '["Backline Tech","Runner"]'::jsonb, array['OPS','SND'], true, true, 30),
  ('staffing_call', 'Staffing Call', 'ops', 30, '["Staff Scheduler","Department Heads"]'::jsonb, array['OPS','FOH','BOH'], true, true, 31),
  ('doors', 'Doors', 'ops', 240, '["FOH Manager","Security","Ticketing"]'::jsonb, array['FOH','Security'], true, true, 32),
  ('security_briefing', 'Security Briefing', 'ops', 30, '["Security Lead","Venue Manager"]'::jsonb, array['Security','OPS'], true, true, 33),
  ('settlement', 'Settlement', 'ops', 45, '["Promoter","Venue Rep","Production Manager"]'::jsonb, array['OPS'], true, true, 34),
  ('vendor_load', 'Vendor Load-In/Load-Out', 'ops', 120, '["Vendor Coordinator","Ops Lead"]'::jsonb, array['OPS','Vendors'], true, true, 35),
  ('inventory_pull', 'Inventory Pull / Pack', 'ops', 90, '["Inventory Manager","Ops Lead"]'::jsonb, array['OPS'], true, true, 36),
  ('shop_build', 'Shop Build / Prop Build', 'ops', 180, '["Technical Director","Deck","Props"]'::jsonb, array['DECK','Props'], true, true, 37),
  ('costume_fittings', 'Costume Fittings', 'ops', 120, '["Wardrobe Supervisor","Cast"]'::jsonb, array['Wardrobe','Cast'], true, true, 38),
  ('rental_pickup', 'Tech Pickup / Rental Return', 'ops', 60, '["Production Manager","Runner"]'::jsonb, array['OPS'], true, true, 39),
  ('delivery_install', 'Deliveries / Install / Turnover', 'ops', 120, '["Ops Lead","Deck"]'::jsonb, array['OPS','DECK'], true, true, 40)
on conflict (type_key) do nothing;

insert into notification_templates (key, subject_template, body_template, tone, is_active)
values (
  'completion_task_professor_good',
  'Professor Good reminder: let''s finish your draft',
  'Hi {{name}}, your {{entity_type}} still needs {{missing_fields}}. Give it ten focused minutes and we can publish with confidence.',
  'professor_good',
  true
)
on conflict (key) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  tone = excluded.tone,
  is_active = excluded.is_active,
  updated_at = now();

insert into certification_types (name, category, renewable, default_valid_days, reminder_offsets_days, is_active, sort_order)
values
  ('CPR', 'safety', true, 730, '[60,30,7]'::jsonb, true, 1),
  ('First Aid', 'safety', true, 730, '[60,30,7]'::jsonb, true, 2),
  ('AED', 'safety', true, 730, '[60,30,7]'::jsonb, true, 3),
  ('TABC', 'compliance', true, 730, '[60,30,7]'::jsonb, true, 4),
  ('Food Handler', 'compliance', true, 730, '[60,30,7]'::jsonb, true, 5),
  ('OSHA Basic', 'safety', true, 1095, '[90,30,7]'::jsonb, true, 6),
  ('Forklift', 'operations', true, 1095, '[90,30,7]'::jsonb, true, 7),
  ('Crowd Management / Security License', 'security', true, 1095, '[90,30,7]'::jsonb, true, 8)
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════
-- Internal Messaging: texting-grade event conversations
-- ═══════════════════════════════════════════════════════════════

create table if not exists event_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  show_mode_enabled boolean default false,
  mute_non_critical boolean default false,
  pinned_ops_commands text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_event_conversations_event_unique on event_conversations(event_id);
create index if not exists idx_event_conversations_user on event_conversations(user_id);

create table if not exists event_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  author_name text default '',
  body_text text not null default '',
  message_type text default 'user',
  client_message_id text,
  language_hint text,
  reply_to_message_id uuid references event_messages(id) on delete set null,
  is_edited boolean default false,
  edited_history jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  has_attachments boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_event_messages_event_created on event_messages(event_id, created_at desc);
create index if not exists idx_event_messages_author on event_messages(author_user_id);
create unique index if not exists idx_event_messages_event_client_id
  on event_messages(event_id, client_message_id);

create table if not exists message_reactions (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references event_messages(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now()
);

create unique index if not exists idx_message_reactions_unique
  on message_reactions(message_id, user_id, emoji);
create index if not exists idx_message_reactions_message on message_reactions(message_id);

create table if not exists message_mentions (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references event_messages(id) on delete cascade,
  mentioned_user_id uuid references users(id) on delete set null,
  mentioned_role_key text,
  created_at timestamptz default now()
);

create index if not exists idx_message_mentions_message on message_mentions(message_id);
create index if not exists idx_message_mentions_user on message_mentions(mentioned_user_id);
create index if not exists idx_message_mentions_role on message_mentions(mentioned_role_key);

-- ═══════════════════════════════════════════════════════════════
-- RLS HARDENING PASS (OWNER / EVENT / ORG SCOPE)
-- Compatibility-safe: works whether users.auth_user_id exists or not.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.imc_current_app_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
  has_auth_user_id boolean;
begin
  if auth.uid() is null then
    return null;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'auth_user_id'
  ) into has_auth_user_id;

  if has_auth_user_id then
    execute 'select u.id
             from public.users u
             where u.auth_user_id::text = $1::text
             order by u.created_at asc
             limit 1'
      into resolved_user_id
      using auth.uid();
  end if;

  if resolved_user_id is null then
    select u.id
      into resolved_user_id
    from public.users u
    where lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    order by u.created_at asc
    limit 1;
  end if;

  return resolved_user_id;
end;
$$;

create or replace function public.imc_is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_is_admin boolean;
  admin_value boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'is_admin'
  ) into has_is_admin;

  if has_is_admin then
    select coalesce(u.is_admin, false)
      into admin_value
    from public.users u
    where u.id::text = public.imc_current_app_user_id()::text
    limit 1;
  end if;

  return coalesce(admin_value, false)
    or lower(coalesce(auth.jwt() ->> 'email', '')) = lower('juliegood@goodcreativemedia.com');
end;
$$;

do $$
declare
  t record;
  p record;
  has_auth_user_id boolean;
  has_user_id boolean;
  has_event_id boolean;
  has_booking_id boolean;
  has_venue_id boolean;
  has_org_id boolean;
  has_assigned_to_user_id boolean;
  has_created_by_user_id boolean;
  has_is_system boolean;
  has_venue_profiles_table boolean;
  has_organizations_table boolean;
  using_expr text;
  check_expr text;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'venue_profiles'
  ) into has_venue_profiles_table;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'organizations'
  ) into has_organizations_table;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'auth_user_id'
  ) into has_auth_user_id;

  execute 'alter table public.users enable row level security';
  execute 'drop policy if exists "Users can read own record" on public.users';
  execute 'drop policy if exists "Users can update own record" on public.users';
  execute 'drop policy if exists imc_users_select on public.users';
  execute 'drop policy if exists imc_users_update on public.users';
  execute 'drop policy if exists imc_users_insert on public.users';
  execute 'drop policy if exists imc_users_delete on public.users';

  if has_auth_user_id then
    execute 'create policy imc_users_select on public.users for select using (
      public.imc_is_admin()
      or id::text = public.imc_current_app_user_id()::text
      or auth_user_id::text = auth.uid()::text
      or lower(coalesce(email, )) = lower(coalesce(auth.jwt() ->> email, ))
    )';

    execute 'create policy imc_users_update on public.users for update using (
      public.imc_is_admin()
      or id::text = public.imc_current_app_user_id()::text
      or auth_user_id::text = auth.uid()::text
    ) with check (
      public.imc_is_admin()
      or id::text = public.imc_current_app_user_id()::text
      or auth_user_id::text = auth.uid()::text
    )';

    execute 'create policy imc_users_insert on public.users for insert with check (
      public.imc_is_admin()
      or auth_user_id::text = auth.uid()::text
      or lower(coalesce(email, )) = lower(coalesce(auth.jwt() ->> email, ))
    )';
  else
    execute 'create policy imc_users_select on public.users for select using (
      public.imc_is_admin()
      or id::text = public.imc_current_app_user_id()::text
      or lower(coalesce(email, )) = lower(coalesce(auth.jwt() ->> email, ))
    )';

    execute 'create policy imc_users_update on public.users for update using (
      public.imc_is_admin()
      or id::text = public.imc_current_app_user_id()::text
    ) with check (
      public.imc_is_admin()
      or id::text = public.imc_current_app_user_id()::text
    )';

    execute 'create policy imc_users_insert on public.users for insert with check (
      public.imc_is_admin()
      or lower(coalesce(email, )) = lower(coalesce(auth.jwt() ->> email, ))
    )';
  end if;

  execute 'create policy imc_users_delete on public.users for delete using (public.imc_is_admin())';

  execute 'alter table public.invites enable row level security';
  execute 'drop policy if exists "Anyone can read invites" on public.invites';
  execute 'drop policy if exists imc_invites_public_read on public.invites';
  execute 'drop policy if exists imc_invites_admin_write on public.invites';
  execute 'create policy imc_invites_public_read on public.invites for select using (true)';
  execute 'create policy imc_invites_admin_write on public.invites for all using (public.imc_is_admin()) with check (public.imc_is_admin())';

  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('users', 'invites')
  loop
    execute format('alter table public.%I enable row level security', t.tablename);

    for p in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = t.tablename
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t.tablename);
    end loop;

    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='user_id') into has_user_id;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='event_id') into has_event_id;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='booking_id') into has_booking_id;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='venue_id') into has_venue_id;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='org_id') into has_org_id;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='assigned_to_user_id') into has_assigned_to_user_id;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='created_by_user_id') into has_created_by_user_id;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.tablename and column_name='is_system') into has_is_system;

    using_expr := '(public.imc_is_admin())';
    check_expr := '(public.imc_is_admin())';

    if t.tablename = 'completion_tasks' and has_assigned_to_user_id and has_created_by_user_id then
      using_expr := '(public.imc_is_admin() or assigned_to_user_id::text = public.imc_current_app_user_id()::text or created_by_user_id::text = public.imc_current_app_user_id()::text)';
      check_expr := using_expr;
    elsif has_booking_id then
      using_expr := '(public.imc_is_admin() or exists (select 1 from public.events e where e.id::text = booking_id::text and e.user_id::text = public.imc_current_app_user_id()::text))';
      check_expr := using_expr;
    elsif has_event_id then
      using_expr := '(public.imc_is_admin() or exists (select 1 from public.events e where e.id::text = event_id::text and e.user_id::text = public.imc_current_app_user_id()::text))';
      check_expr := using_expr;
    elsif has_user_id then
      using_expr := '(public.imc_is_admin() or user_id::text = public.imc_current_app_user_id()::text)';
      if has_is_system then
        using_expr := '(public.imc_is_admin() or user_id::text = public.imc_current_app_user_id()::text or (user_id is null and coalesce(is_system, false) = true))';
      end if;
      check_expr := '(public.imc_is_admin() or user_id::text = public.imc_current_app_user_id()::text)';
    elsif has_venue_id and has_venue_profiles_table then
      using_expr := '(public.imc_is_admin() or exists (select 1 from public.venue_profiles v where v.id::text = venue_id::text and v.user_id::text = public.imc_current_app_user_id()::text))';
      check_expr := using_expr;
    elsif has_org_id and has_organizations_table then
      using_expr := '(public.imc_is_admin() or exists (select 1 from public.organizations o where o.id::text = org_id::text and o.user_id::text = public.imc_current_app_user_id()::text))';
      check_expr := using_expr;
    end if;

    execute format('create policy imc_scope_all on public.%I for all using %s with check %s', t.tablename, using_expr, check_expr);
  end loop;
end;
$$;

