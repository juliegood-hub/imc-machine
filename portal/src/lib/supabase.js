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

function isMissingRelation(error) {
  return error?.code === '42P01' || /relation .+ does not exist/i.test(error?.message || '');
}

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
    auth_user_id: userData.authUserId || null,
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

// ─── Participant Profiles (acts, speakers, artists, etc.) ───
export async function getParticipantProfiles(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('participant_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data || [];
}

export async function createParticipantProfile(profileData) {
  try {
    return await resilientInsert('participant_profiles', {
      user_id: profileData.user_id,
      profile_type: profileData.profile_type || 'participant',
      name: profileData.name || '',
      role: profileData.role || '',
      genre: profileData.genre || '',
      bio: profileData.bio || '',
      contact_email: profileData.contact_email || '',
      contact_phone: profileData.contact_phone || '',
      website: profileData.website || '',
      metadata: profileData.metadata || {},
    });
  } catch (error) {
    if (isMissingRelation(error)) {
      return {
        id: `local-${Date.now()}`,
        ...profileData,
        created_at: new Date().toISOString(),
      };
    }
    throw error;
  }
}

export async function updateParticipantProfile(profileId, updates) {
  try {
    return await resilientUpdate('participant_profiles', updates, 'id', profileId);
  } catch (error) {
    if (isMissingRelation(error)) return { id: profileId, ...updates };
    throw error;
  }
}

export async function deleteParticipantProfile(profileId) {
  const { error } = await supabase
    .from('participant_profiles')
    .delete()
    .eq('id', profileId);
  if (error && !isMissingRelation(error)) throw error;
}

// ─── Venue Profiles (reusable venue presets) ───
export async function getVenueProfiles(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('venue_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data || [];
}

export async function createVenueProfile(profileData) {
  try {
    return await resilientInsert('venue_profiles', {
      user_id: profileData.user_id,
      name: profileData.name || '',
      street_number: profileData.street_number || '',
      street_name: profileData.street_name || '',
      suite: profileData.suite || '',
      city: profileData.city || 'San Antonio',
      state: profileData.state || 'TX',
      postal_code: profileData.postal_code || '',
      phone: profileData.phone || '',
      website: profileData.website || '',
      metadata: profileData.metadata || {},
    });
  } catch (error) {
    if (isMissingRelation(error)) {
      return {
        id: `local-${Date.now()}`,
        ...profileData,
        created_at: new Date().toISOString(),
      };
    }
    throw error;
  }
}

export async function updateVenueProfile(profileId, updates) {
  try {
    return await resilientUpdate('venue_profiles', updates, 'id', profileId);
  } catch (error) {
    if (isMissingRelation(error)) return { id: profileId, ...updates };
    throw error;
  }
}

export async function deleteVenueProfile(profileId) {
  const { error } = await supabase
    .from('venue_profiles')
    .delete()
    .eq('id', profileId);
  if (error && !isMissingRelation(error)) throw error;
}

// ─── Event Series + Event Participants ───
export async function getEventSeries(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('event_series')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data || [];
}

export async function createEventSeries(seriesData) {
  try {
    return await resilientInsert('event_series', {
      user_id: seriesData.user_id,
      name: seriesData.name || 'Untitled Series',
      recurrence: seriesData.recurrence || {},
      notes: seriesData.notes || '',
      metadata: seriesData.metadata || {},
    });
  } catch (error) {
    if (isMissingRelation(error)) {
      return {
        id: `local-${Date.now()}`,
        ...seriesData,
        created_at: new Date().toISOString(),
      };
    }
    throw error;
  }
}

export async function replaceEventParticipants(eventId, participants = []) {
  if (!eventId) return [];

  const { error: deleteError } = await supabase
    .from('event_participants')
    .delete()
    .eq('event_id', eventId);
  if (deleteError && !isMissingRelation(deleteError)) throw deleteError;

  if (!participants.length) return [];

  const payload = participants.map((entry, index) => ({
    event_id: eventId,
    participant_id: entry.participant_id || entry.id,
    role: entry.role || '',
    sort_order: Number.isInteger(entry.sort_order) ? entry.sort_order : index + 1,
  })).filter(entry => !!entry.participant_id);

  if (!payload.length) return [];

  const { data, error } = await supabase
    .from('event_participants')
    .insert(payload)
    .select('*');
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data || [];
}

// ─── Performance Zones ───
export async function getPerformanceZones(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('performance_zones')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data || [];
}

export async function createPerformanceZone(zoneData) {
  try {
    return await resilientInsert('performance_zones', zoneData);
  } catch (error) {
    if (isMissingRelation(error)) {
      return { id: `local-${Date.now()}`, ...zoneData, created_at: new Date().toISOString() };
    }
    throw error;
  }
}

export async function updatePerformanceZone(zoneId, updates) {
  try {
    return await resilientUpdate('performance_zones', updates, 'id', zoneId);
  } catch (error) {
    if (isMissingRelation(error)) return { id: zoneId, ...updates };
    throw error;
  }
}

export async function deletePerformanceZone(zoneId) {
  const { error } = await supabase
    .from('performance_zones')
    .update({ is_active: false })
    .eq('id', zoneId);
  if (error && !isMissingRelation(error)) throw error;
}

// ─── Show Configurations ───
export async function getShowConfigurations(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('show_configurations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data || [];
}

export async function createShowConfiguration(configData) {
  try {
    return await resilientInsert('show_configurations', configData);
  } catch (error) {
    if (isMissingRelation(error)) {
      return { id: `local-${Date.now()}`, ...configData, created_at: new Date().toISOString() };
    }
    throw error;
  }
}

export async function updateShowConfiguration(configId, updates) {
  try {
    return await resilientUpdate('show_configurations', updates, 'id', configId);
  } catch (error) {
    if (isMissingRelation(error)) return { id: configId, ...updates };
    throw error;
  }
}

export async function deleteShowConfiguration(configId) {
  const { error } = await supabase
    .from('show_configurations')
    .delete()
    .eq('id', configId);
  if (error && !isMissingRelation(error)) throw error;
}

// ─── Stage Plot Documents ───
export async function createStagePlotDocument(docData) {
  try {
    return await resilientInsert('stage_plot_documents', docData);
  } catch (error) {
    if (isMissingRelation(error)) {
      return { id: `local-${Date.now()}`, ...docData, created_at: new Date().toISOString() };
    }
    throw error;
  }
}

export async function updateStagePlotDocument(docId, updates) {
  try {
    return await resilientUpdate('stage_plot_documents', updates, 'id', docId);
  } catch (error) {
    if (isMissingRelation(error)) return { id: docId, ...updates };
    throw error;
  }
}

export async function getStagePlotDocuments(userId, filters = {}) {
  if (!userId) return [];
  let query = supabase
    .from('stage_plot_documents')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (filters.eventId) query = query.eq('event_id', filters.eventId);
  if (filters.showConfigurationId) query = query.eq('show_configuration_id', filters.showConfigurationId);

  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data || [];
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
