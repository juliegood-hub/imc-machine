// ═══════════════════════════════════════════════════════════════
// IMC Machine: Supabase Client
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ═══════════════════════════════════════════════════════════════
// RESILIENT DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════

// Resilient insert/update helper - strips unknown columns and retries
export async function resilientInsert(table, data) {
  const { data: result, error } = await supabase.from(table).insert(data).select().single();
  if (error && error.code === '42703') {
    // Column not found - extract column name from error and retry without it
    const match = error.message.match(/column (\w+)\.(\w+) does not exist/);
    if (match) {
      const badCol = match[2];
      console.warn(`[Supabase] Stripping unknown column '${badCol}' from ${table} insert`);
      const cleaned = { ...data };
      delete cleaned[badCol];
      return resilientInsert(table, cleaned);
    }
  }
  if (error) throw error;
  return result;
}

export async function resilientUpdate(table, data, eqCol, eqVal) {
  const { data: result, error } = await supabase.from(table).update(data).eq(eqCol, eqVal).select().single();
  if (error && error.code === '42703') {
    const match = error.message.match(/column (\w+)\.(\w+) does not exist/);
    if (match) {
      const badCol = match[2];
      console.warn(`[Supabase] Stripping unknown column '${badCol}' from ${table} update`);
      const cleaned = { ...data };
      delete cleaned[badCol];
      return resilientUpdate(table, cleaned, eqCol, eqVal);
    }
  }
  if (error) throw error;
  return result;
}

export async function resilientUpsert(table, data) {
  const { data: result, error } = await supabase.from(table).upsert(data).select().single();
  if (error && error.code === '42703') {
    const match = error.message.match(/column (\w+)\.(\w+) does not exist/);
    if (match) {
      const badCol = match[2];
      console.warn(`[Supabase] Stripping unknown column '${badCol}' from ${table} upsert`);
      const cleaned = { ...data };
      delete cleaned[badCol];
      return resilientUpsert(table, cleaned);
    }
  }
  if (error) throw error;
  return result;
}

// ═══════════════════════════════════════════════════════════════
// DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════

// ─── Users ───
export async function getUser(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function createUser(userData) {
  return resilientInsert('users', {
    email: userData.email.toLowerCase(),
    name: userData.name,
    client_type: userData.clientType || 'venue',
    venue_name: userData.venueName || '',
    is_admin: userData.email.toLowerCase() === 'juliegood@goodcreativemedia.com',
    last_login: new Date().toISOString(),
  });
}

export async function updateUserLogin(userId) {
  const { error } = await supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function toggleUserDisabled(userId, disabled) {
  const { error } = await supabase
    .from('users')
    .update({ disabled })
    .eq('id', userId);
  if (error) throw error;
}

export async function deleteUser(userId) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);
  if (error) throw error;
}

export async function updateUser(userId, userData) {
  return resilientUpdate('users', userData, 'id', userId);
}

// ─── Profiles ───
export async function getProfileByUserId(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function createProfile(profileData) {
  return resilientInsert('profiles', profileData);
}

export async function updateProfile(userId, profileData) {
  return resilientUpdate('profiles', profileData, 'user_id', userId);
}

// ─── Invites ───
export async function createInvite(invite) {
  const { data, error } = await supabase
    .from('invites')
    .insert({
      email: invite.email,
      venue_name: invite.venueName,
      client_type: invite.clientType || 'venue',
      code: invite.code,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getInviteByCode(code) {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('code', code)
    .eq('used', false)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function markInviteUsed(inviteId, userId) {
  const { error } = await supabase
    .from('invites')
    .update({ used: true, used_by: userId })
    .eq('id', inviteId);
  if (error) throw error;
}

export async function getAllInvites() {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteInvite(inviteId) {
  const { error } = await supabase
    .from('invites')
    .delete()
    .eq('id', inviteId);
  if (error) throw error;
}

// ─── Events ───
export async function createEvent(eventData) {
  return resilientInsert('events', eventData);
}

export async function getUserEvents(userId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*, users(name, email, client_type)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateEvent(eventId, updates) {
  return resilientUpdate('events', { ...updates, updated_at: new Date().toISOString() }, 'id', eventId);
}

// ─── Campaigns ───
export async function upsertCampaign(campaignData) {
  const { data: result, error } = await supabase
    .from('campaigns')
    .upsert(campaignData, { onConflict: 'event_id,channel' })
    .select()
    .single();
  
  if (error && error.code === '42703') {
    // Column not found - extract column name from error and retry without it
    const match = error.message.match(/column (\w+)\.(\w+) does not exist/);
    if (match) {
      const badCol = match[2];
      console.warn(`[Supabase] Stripping unknown column '${badCol}' from campaigns upsert`);
      const cleaned = { ...campaignData };
      delete cleaned[badCol];
      return upsertCampaign(cleaned);
    }
  }
  if (error) throw error;
  return result;
}

export async function getEventCampaigns(eventId) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('event_id', eventId);
  if (error) throw error;
  return data || [];
}

export async function getAllCampaigns() {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, events(title, date, venue_name), users(name, email)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Activity Log ───
export async function logActivity(userId, action, details = {}) {
  try {
    await resilientInsert('activity_log', {
      user_id: userId,
      action,
      details,
    });
  } catch (error) {
    console.error('[Activity] Log failed:', error);
  }
}

export async function getActivityLog(filters = {}) {
  let query = supabase
    .from('activity_log')
    .select('*, users(name, email)')
    .order('created_at', { ascending: false })
    .limit(filters.limit || 500);

  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.since) query = query.gte('created_at', filters.since);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─── Profiles ───
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertProfile(profileData) {
  return resilientUpsert('profiles', profileData);
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, users(name, email, client_type, is_admin)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Generated Content ───
export async function saveGeneratedContent(contentData) {
  const { data, error } = await supabase
    .from('generated_content')
    .insert(contentData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Generated Images ───
export async function saveGeneratedImage(imageData) {
  const { data, error } = await supabase
    .from('generated_images')
    .insert(imageData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Generated Images ───
export async function getEventImages(eventId) {
  const { data, error } = await supabase
    .from('generated_images')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteEvent(eventId) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
}
