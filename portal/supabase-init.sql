-- IMC Machine: Database Setup
-- Paste this entire block into Supabase SQL Editor and click Run

create extension if not exists "uuid-ossp";

-- Users
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  client_type text default 'venue',
  venue_name text,
  is_admin boolean default false,
  disabled boolean default false,
  created_at timestamptz default now(),
  last_login timestamptz,
  metadata jsonb default '{}'::jsonb
);

-- Invites
create table if not exists invites (
  id uuid primary key default uuid_generate_v4(),
  email text,
  venue_name text,
  client_type text default 'venue',
  code text unique not null,
  used boolean default false,
  used_by uuid references users(id),
  created_at timestamptz default now()
);

-- Profiles (venues + artists)
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  profile_type text default 'venue',
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
  facebook_url text,
  facebook_page_id text,
  instagram_url text,
  linkedin_url text,
  spotify_url text,
  youtube_url text,
  brand_colors jsonb default '[]'::jsonb,
  brand_voice text,
  logo_url text,
  headshot_url text,
  hometown text,
  band_members jsonb default '[]'::jsonb,
  streaming_links jsonb default '{}'::jsonb,
  booking_contact text,
  manager_contact text,
  drive_folder_id text,
  drive_folder_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Events
create table if not exists events (
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
  venue_name text,
  venue_address text,
  venue_city text default 'San Antonio',
  venue_state text default 'TX',
  is_free boolean default true,
  ticket_price decimal(10,2),
  ticket_link text,
  ticket_provider text,
  cast_crew jsonb default '[]'::jsonb,
  brand_voice text,
  brand_colors jsonb default '[]'::jsonb,
  hero_image_url text,
  poster_url text,
  media_urls jsonb default '[]'::jsonb,
  channels jsonb default '[]'::jsonb,
  status text default 'draft',
  drive_folder_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaigns (distribution tracking)
create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id),
  channel text not null,
  status text default 'not_started',
  external_id text,
  external_url text,
  recipients integer,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(event_id, channel)
);

-- Activity Log
create table if not exists activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Generated Content
create table if not exists generated_content (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id),
  content_type text not null,
  content text,
  language text default 'en',
  model_used text,
  tokens_used integer,
  drive_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Generated Images
create table if not exists generated_images (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id),
  format_key text,
  image_url text,
  drive_url text,
  model_used text,
  prompt text,
  width integer,
  height integer,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_profiles_user on profiles(user_id);
create index if not exists idx_events_user on events(user_id);
create index if not exists idx_events_date on events(date);
create index if not exists idx_campaigns_event on campaigns(event_id);
create index if not exists idx_campaigns_user on campaigns(user_id);
create index if not exists idx_activity_user on activity_log(user_id);
create index if not exists idx_activity_action on activity_log(action);
create index if not exists idx_activity_created on activity_log(created_at desc);

-- Disable RLS for now (development mode, lock down before production)
alter table users disable row level security;
alter table invites disable row level security;
alter table profiles disable row level security;
alter table events disable row level security;
alter table campaigns disable row level security;
alter table activity_log disable row level security;
alter table generated_content disable row level security;
alter table generated_images disable row level security;

-- Seed admin
insert into users (email, name, is_admin, client_type)
values ('juliegood@goodcreativemedia.com', 'Julie Good', true, 'venue')
on conflict (email) do update set is_admin = true, name = 'Julie Good';
