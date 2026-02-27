import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL
  || process.env.VITE_ADMIN_EMAIL
  || 'juliegood@goodcreativemedia.com'
).toLowerCase();

export class ApiAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiAuthError';
    this.status = status;
  }
}

export function isMissingColumnError(error) {
  return error?.code === '42703' || /column .+ does not exist/i.test(error?.message || '');
}

export function extractBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export function getServerSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function resolveAppUserRow(supabase, authUser) {
  const email = String(authUser?.email || '').toLowerCase();
  let supportsAuthUserId = true;
  let appUser = null;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    appUser = data || null;
  } catch (error) {
    if (isMissingColumnError(error)) supportsAuthUserId = false;
    else throw error;
  }

  if (!appUser) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    appUser = data || null;
  }

  if (!appUser) {
    const nextUser = {
      email,
      name: authUser?.user_metadata?.name || email.split('@')[0],
      client_type: authUser?.user_metadata?.client_type || 'venue',
      venue_name: authUser?.user_metadata?.venue_name || '',
      is_admin: email === ADMIN_EMAIL,
      last_login: new Date().toISOString(),
    };
    if (supportsAuthUserId) nextUser.auth_user_id = authUser.id;
    const { data, error } = await supabase
      .from('users')
      .upsert(nextUser, { onConflict: 'email' })
      .select('*')
      .single();
    if (error) throw error;
    appUser = data;
  } else {
    const updatePayload = { last_login: new Date().toISOString() };
    if (supportsAuthUserId && !appUser.auth_user_id) {
      updatePayload.auth_user_id = authUser.id;
    }
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', appUser.id)
      .select('*')
      .single();
    if (!updateError && updated) appUser = updated;
  }

  return appUser;
}

export async function requireApiAuth(req, { supabase, admin = false } = {}) {
  const serverSupabase = supabase || getServerSupabaseClient();
  const token = extractBearerToken(req);
  if (!token) throw new ApiAuthError(401, 'Unauthorized: missing access token.');

  const { data: authData, error: authError } = await serverSupabase.auth.getUser(token);
  if (authError || !authData?.user?.id || !authData?.user?.email) {
    throw new ApiAuthError(401, 'Unauthorized: invalid access token.');
  }

  const authUser = authData.user;
  const appUser = await resolveAppUserRow(serverSupabase, authUser);
  if (!appUser) throw new ApiAuthError(403, 'Forbidden: user record not found.');
  if (appUser.disabled) throw new ApiAuthError(403, 'Forbidden: account is disabled.');

  const email = String(authUser.email || '').toLowerCase();
  const isAdmin = Boolean(appUser.is_admin) || email === ADMIN_EMAIL;
  if (admin && !isAdmin) throw new ApiAuthError(403, 'Forbidden: admin access required.');

  return {
    token,
    authUser,
    appUser,
    isAdmin,
    email,
    userId: appUser.id,
    authUserId: authUser.id,
  };
}

export function scopePayloadToUser(payload = {}, authContext, { allowAdminImpersonation = true } = {}) {
  const rawRequestedUserId = payload.userId || payload.user_id || null;
  const scopedUserId = (allowAdminImpersonation && authContext?.isAdmin && rawRequestedUserId)
    ? rawRequestedUserId
    : authContext?.userId;

  const next = {
    ...payload,
    userId: scopedUserId,
    user_id: scopedUserId,
  };

  if (payload?.event && typeof payload.event === 'object') {
    next.event = {
      ...payload.event,
      user_id: scopedUserId,
      userId: scopedUserId,
    };
  }

  return next;
}

export function resolvePayloadEventId(payload = {}) {
  return (
    payload?.event?.id
    || payload?.eventId
    || payload?.event_id
    || payload?.bookingId
    || payload?.booking_id
    || ''
  );
}

export async function assertEventOwnership(supabase, authContext, eventId) {
  if (!eventId) return null;
  const { data: eventRow, error } = await supabase
    .from('events')
    .select('id,user_id')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!eventRow) throw new ApiAuthError(404, 'Event not found.');
  if (!authContext?.isAdmin && eventRow.user_id !== authContext?.userId) {
    throw new ApiAuthError(403, 'Forbidden: event ownership check failed.');
  }
  return eventRow;
}

export function assertWebhookSecret(req, payload = {}, envKeys = []) {
  const providedSecret = (
    req.headers?.['x-imc-webhook-secret']
    || req.headers?.['X-IMC-Webhook-Secret']
    || payload?.webhookSecret
    || ''
  );
  const expectedSecret = envKeys
    .map((key) => process.env[key])
    .find((value) => String(value || '').trim().length > 0) || '';

  if (expectedSecret && providedSecret !== expectedSecret) {
    throw new ApiAuthError(401, 'Unauthorized webhook secret.');
  }
}
