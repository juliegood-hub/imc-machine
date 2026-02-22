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
  for select using (true);

create policy "Users can update own record" on users
  for update using (auth.uid()::text = id::text);

-- Profiles: own data
create policy "Users see own profiles" on profiles
  for all using (user_id::text = auth.uid()::text);

-- Events: own data
create policy "Users see own events" on events
  for all using (user_id::text = auth.uid()::text);

-- Campaigns: own data
create policy "Users see own campaigns" on campaigns
  for all using (user_id::text = auth.uid()::text);

-- Activity: own data
create policy "Users see own activity" on activity_log
  for select using (user_id::text = auth.uid()::text);

-- Content: own data
create policy "Users see own content" on generated_content
  for all using (user_id::text = auth.uid()::text);

-- Images: own data
create policy "Users see own images" on generated_images
  for all using (user_id::text = auth.uid()::text);

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
