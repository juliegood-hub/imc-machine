-- ═══════════════════════════════════════════════════════════════
-- IMC Machine: Row Level Security (RLS) Policies
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Admin email: juliegood@goodcreativemedia.com
-- Admin detection: users.is_admin = true OR email matches admin
-- ═══════════════════════════════════════════════════════════════

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE email = auth.jwt() ->> 'email'
    AND (is_admin = true OR email = 'juliegood@goodcreativemedia.com')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's ID from users table
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid AS $$
  SELECT id FROM public.users
  WHERE email = auth.jwt() ->> 'email'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════════════════════
-- USERS TABLE
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own row" ON public.users
  FOR SELECT USING (email = auth.jwt() ->> 'email' OR public.is_admin());

CREATE POLICY "Users can update own row" ON public.users
  FOR UPDATE USING (email = auth.jwt() ->> 'email' OR public.is_admin());

CREATE POLICY "Admins can insert users" ON public.users
  FOR INSERT WITH CHECK (true);
  -- Allow inserts during signup (service role or anon with signup flow)

CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- EVENTS TABLE
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own events" ON public.events
  FOR SELECT USING (user_id = public.current_user_id() OR public.is_admin());

CREATE POLICY "Users create own events" ON public.events
  FOR INSERT WITH CHECK (user_id = public.current_user_id() OR public.is_admin());

CREATE POLICY "Users update own events" ON public.events
  FOR UPDATE USING (user_id = public.current_user_id() OR public.is_admin());

CREATE POLICY "Users delete own events" ON public.events
  FOR DELETE USING (user_id = public.current_user_id() OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- CAMPAIGNS TABLE
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own campaigns" ON public.campaigns
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events WHERE events.id = campaigns.event_id AND events.user_id = public.current_user_id())
    OR public.is_admin()
  );

CREATE POLICY "Users manage own campaigns" ON public.campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE events.id = campaigns.event_id AND events.user_id = public.current_user_id())
    OR public.is_admin()
  );

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT USING (user_id = public.current_user_id() OR public.is_admin());

CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (user_id = public.current_user_id() OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- GENERATED_CONTENT TABLE
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own generated content" ON public.generated_content
  FOR SELECT USING (user_id = public.current_user_id() OR public.is_admin());

CREATE POLICY "Users create generated content" ON public.generated_content
  FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- GENERATED_IMAGES TABLE
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own generated images" ON public.generated_images
  FOR SELECT USING (user_id = public.current_user_id() OR public.is_admin());

CREATE POLICY "Users create generated images" ON public.generated_images
  FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- ACTIVITY_LOG TABLE
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own activity" ON public.activity_log
  FOR SELECT USING (user_id = public.current_user_id() OR public.is_admin());

CREATE POLICY "Anyone can insert activity" ON public.activity_log
  FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- INVITES TABLE
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins see all invites" ON public.invites
  FOR SELECT USING (public.is_admin());

-- Allow reading unused invites by code (for signup validation)
CREATE POLICY "Anyone can validate invite codes" ON public.invites
  FOR SELECT USING (used = false);

CREATE POLICY "Admins manage invites" ON public.invites
  FOR ALL USING (public.is_admin());

-- Allow marking invite as used during signup
CREATE POLICY "Anyone can mark invite used" ON public.invites
  FOR UPDATE USING (used = false)
  WITH CHECK (used = true);
