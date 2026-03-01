import { createClient } from '@supabase/supabase-js';
import { ApiAuthError, requireApiAuth } from './_auth.js';
import { FEATURE_SEARCH_REGISTRY } from '../src/constants/globalSearchFeatures.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeText(value = '', max = 240) {
  return String(value || '').trim().slice(0, max);
}

function toLower(value = '') {
  return normalizeText(value, 4000).toLowerCase();
}

function toTokens(query = '') {
  return toLower(query)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeLikePattern(input = '') {
  return `%${String(input || '').replace(/[%_]/g, '').trim()}%`;
}

function isMissingRelationError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist') || message.includes('relation');
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatTimestamp(value) {
  const text = normalizeText(value, 80);
  return text || null;
}

function computeTokenScore(haystack = '', tokens = []) {
  if (!tokens.length) return 0;
  const normalized = toLower(haystack);
  if (!normalized) return 0;
  let score = 0;
  for (const token of tokens) {
    if (!normalized.includes(token)) return 0;
    score += 10;
    if (normalized.startsWith(token)) score += 4;
    if (normalized.includes(` ${token}`)) score += 2;
  }
  return score;
}

function canAccessFeature(feature, authContext = null) {
  const access = normalizeText(feature?.access || 'authenticated', 40).toLowerCase();
  if (access === 'admin') return Boolean(authContext?.isAdmin);
  return true;
}

function buildFeatureResults(query = '', limit = 8, authContext = null) {
  const tokens = toTokens(query);
  const rows = FEATURE_SEARCH_REGISTRY
    .filter((feature) => canAccessFeature(feature, authContext))
    .map((feature) => {
      const haystack = [
        feature.title,
        feature.description,
        ensureArray(feature.keywords).join(' '),
      ].join(' ');
      const score = computeTokenScore(haystack, tokens);
      if (!score) return null;
      return {
        id: feature.id,
        tier: 'features',
        category: 'features',
        resultType: 'feature',
        title: feature.title,
        description: feature.description,
        path: feature.path,
        quickAction: feature.quickAction || null,
        updatedAt: null,
        score: score + Number(feature.priority || 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return rows.slice(0, limit);
}

function buildEmptySearchPayload(params = {}) {
  return {
    success: true,
    query: params.query || '',
    scope: params.scope || 'all',
    category: params.category || 'all',
    sort: params.sort || 'relevance',
    filters: {
      orgId: params.orgId || null,
      eventId: params.eventId || null,
      withinCurrentEvent: Boolean(params.withinCurrentEvent),
    },
    tiers: { features: [], content: [], people: [] },
    grouped: {},
    totals: { features: 0, content: 0, people: 0, all: 0 },
    message: params.message || '',
  };
}

async function resolveScopedEventIds({ userId, scope, orgId, eventId }) {
  if (scope === 'event' && eventId) return [eventId];
  if ((scope === 'org' || scope === 'venue') && orgId) {
    const rows = await runSafeQuery(
      supabase
        .from('events')
        .select('id')
        .eq('user_id', userId)
        .eq('venue_profile_id', orgId)
        .limit(1000)
    );
    return rows.map((row) => row.id).filter(Boolean);
  }
  return null;
}

function applyEventScope(queryBuilder, scope, eventId, scopedEventIds, column = 'event_id') {
  if (!queryBuilder) return null;
  if (scope === 'event' && eventId) return queryBuilder.eq(column, eventId);
  if (scope === 'org' || scope === 'venue') {
    const ids = Array.isArray(scopedEventIds) ? scopedEventIds.filter(Boolean) : [];
    if (!ids.length) return null;
    return queryBuilder.in(column, ids);
  }
  return queryBuilder;
}

async function runSafeQuery(queryBuilder) {
  if (!queryBuilder) return [];
  const { data, error } = await queryBuilder;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return data || [];
}

function mapContentResult({
  id,
  title,
  description = '',
  category,
  badge,
  path,
  context = '',
  updatedAt = null,
  score = 0,
}) {
  return {
    id,
    tier: 'content',
    category,
    resultType: 'content',
    title: normalizeText(title, 220) || 'Untitled',
    description: normalizeText(description, 400),
    badge: normalizeText(badge || category, 80),
    context: normalizeText(context, 220),
    path: normalizeText(path, 500) || '/',
    updatedAt: formatTimestamp(updatedAt),
    score,
  };
}

function mapPeopleResult({
  id,
  title,
  subtitle = '',
  context = '',
  path = '/crew',
  score = 0,
  updatedAt = null,
}) {
  return {
    id,
    tier: 'people',
    category: 'people',
    resultType: 'person',
    title: normalizeText(title, 220) || 'Unnamed',
    description: normalizeText(subtitle, 320),
    context: normalizeText(context, 220),
    path: normalizeText(path, 500),
    updatedAt: formatTimestamp(updatedAt),
    score,
    quickActions: [
      { label: 'Message', path: '/chat' },
      { label: 'Assign', path: '/production-ops/staffing?focus=staffing' },
      { label: 'View Profile', path },
    ],
  };
}

function bySort(sort = 'relevance') {
  if (sort === 'alphabetical') {
    return (a, b) => a.title.localeCompare(b.title);
  }
  if (sort === 'recent') {
    return (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  }
  return (a, b) => b.score - a.score || a.title.localeCompare(b.title);
}

async function searchContent({
  userId,
  query,
  scope,
  orgId,
  eventId,
  scopedEventIds,
  limitPerTier,
  category,
  sort,
}) {
  const pattern = sanitizeLikePattern(query);
  const tokens = toTokens(query);
  const include = (key) => category === 'all' || category === key || (category === 'permits_insurance' && (key === 'permits' || key === 'insurance'));
  const content = [];
  const grouped = {
    events: [],
    venues: [],
    plots: [],
    cues: [],
    calendar: [],
    documents: [],
    permits_insurance: [],
    checklists: [],
  };

  if (include('events')) {
    let eventsQuery = supabase
      .from('events')
      .select('id,title,description,date,time,venue_name,venue_city,venue_state,updated_at,venue_profile_id')
      .eq('user_id', userId)
      .or(`title.ilike.${pattern},description.ilike.${pattern},venue_name.ilike.${pattern}`)
      .limit(limitPerTier * 4);
    if ((scope === 'org' || scope === 'venue') && orgId) eventsQuery = eventsQuery.eq('venue_profile_id', orgId);
    if (scope === 'event' && eventId) eventsQuery = eventsQuery.eq('id', eventId);
    const rows = await runSafeQuery(eventsQuery);
    rows.forEach((row) => {
      const context = [row.venue_name, row.date].filter(Boolean).join(' · ');
      const score = computeTokenScore([row.title, row.description, row.venue_name].join(' '), tokens);
      const result = mapContentResult({
        id: `event:${row.id}`,
        title: row.title || 'Untitled Event',
        description: row.description || '',
        category: 'events',
        badge: 'Event',
        path: `/events/${row.id}`,
        context,
        updatedAt: row.updated_at,
        score,
      });
      content.push(result);
      grouped.events.push(result);
    });
  }

  if (include('venues')) {
    let venuesQuery = supabase
      .from('venue_profiles')
      .select('id,name,city,state,website,updated_at')
      .eq('user_id', userId)
      .or(`name.ilike.${pattern},city.ilike.${pattern},state.ilike.${pattern},website.ilike.${pattern}`)
      .limit(limitPerTier * 3);
    if ((scope === 'org' || scope === 'venue') && orgId) venuesQuery = venuesQuery.eq('id', orgId);
    const rows = await runSafeQuery(venuesQuery);
    rows.forEach((row) => {
      const context = [row.city, row.state].filter(Boolean).join(', ');
      const score = computeTokenScore([row.name, row.city, row.state, row.website].join(' '), tokens);
      const result = mapContentResult({
        id: `venue:${row.id}`,
        title: row.name || 'Unnamed Venue',
        description: row.website || '',
        category: 'venues',
        badge: 'Venue',
        path: '/venue-setup',
        context,
        updatedAt: row.updated_at,
        score,
      });
      content.push(result);
      grouped.venues.push(result);
    });
  }

  if (include('plots')) {
    let plotQuery = applyEventScope(
      supabase
      .from('stage_plot_documents')
      .select('id,title,event_id,updated_at')
      .eq('user_id', userId)
      .ilike('title', pattern)
      .limit(limitPerTier * 3),
      scope,
      eventId,
      scopedEventIds,
      'event_id'
    );
    const rows = await runSafeQuery(plotQuery);
    rows.forEach((row) => {
      const score = computeTokenScore(row.title, tokens);
      const path = row.event_id ? `/events/${row.event_id}?opsTab=production` : '/production-ops/event-ops?focus=event_ops';
      const result = mapContentResult({
        id: `plot:${row.id}`,
        title: row.title || 'Stage Plot',
        description: 'Stage plot document',
        category: 'plots',
        badge: 'Plot',
        path,
        context: row.event_id ? 'Linked Event Plot' : 'Library Plot',
        updatedAt: row.updated_at,
        score,
      });
      content.push(result);
      grouped.plots.push(result);
    });
  }

  if (include('calendar')) {
    let calendarQuery = supabase
      .from('rehearsal_calendar_entries')
      .select('id,title,type_name,location,event_id,start_datetime,updated_at,org_id')
      .eq('user_id', userId)
      .or(`title.ilike.${pattern},type_name.ilike.${pattern},location.ilike.${pattern},description.ilike.${pattern}`)
      .limit(limitPerTier * 4);
    if (scope === 'event' && eventId) calendarQuery = calendarQuery.eq('event_id', eventId);
    if ((scope === 'org' || scope === 'venue') && orgId) {
      if (Array.isArray(scopedEventIds) && scopedEventIds.length) {
        calendarQuery = calendarQuery.in('event_id', scopedEventIds);
      } else {
        calendarQuery = null;
      }
    }
    const rows = await runSafeQuery(calendarQuery);
    rows.forEach((row) => {
      const context = [row.type_name, row.location, row.start_datetime].filter(Boolean).join(' · ');
      const score = computeTokenScore([row.title, row.type_name, row.location].join(' '), tokens);
      const path = `/production-calendar${row.event_id ? `?eventId=${row.event_id}` : ''}`;
      const result = mapContentResult({
        id: `calendar:${row.id}`,
        title: row.title || row.type_name || 'Calendar Entry',
        description: row.type_name || 'Production Calendar',
        category: 'calendar',
        badge: 'Calendar',
        path,
        context,
        updatedAt: row.updated_at,
        score,
      });
      content.push(result);
      grouped.calendar.push(result);
    });
  }

  if (include('checklists')) {
    let checklistQuery = applyEventScope(
      supabase
      .from('production_checklists')
      .select('id,title,phase,status,event_id,updated_at')
      .eq('user_id', userId)
      .or(`title.ilike.${pattern},phase.ilike.${pattern},status.ilike.${pattern}`)
      .limit(limitPerTier * 3),
      scope,
      eventId,
      scopedEventIds,
      'event_id'
    );
    const rows = await runSafeQuery(checklistQuery);
    rows.forEach((row) => {
      const score = computeTokenScore([row.title, row.phase, row.status].join(' '), tokens);
      const path = row.event_id ? `/events/${row.event_id}?opsTab=production` : '/production-ops';
      const result = mapContentResult({
        id: `checklist:${row.id}`,
        title: row.title || 'Production Checklist',
        description: `${row.phase || 'phase'} · ${row.status || 'status'}`,
        category: 'checklists',
        badge: 'Checklist',
        path,
        context: row.event_id ? 'Event Checklist' : 'Checklist',
        updatedAt: row.updated_at,
        score,
      });
      content.push(result);
      grouped.checklists.push(result);
    });
  }

  if (include('documents')) {
    let documentQuery = applyEventScope(
      supabase
      .from('booking_documents')
      .select('id,title,doc_type,status,event_id,updated_at')
      .eq('user_id', userId)
      .or(`title.ilike.${pattern},doc_type.ilike.${pattern},status.ilike.${pattern}`)
      .limit(limitPerTier * 3),
      scope,
      eventId,
      scopedEventIds,
      'event_id'
    );
    const rows = await runSafeQuery(documentQuery);
    rows.forEach((row) => {
      const score = computeTokenScore([row.title, row.doc_type, row.status].join(' '), tokens);
      const path = row.event_id ? `/events/${row.event_id}?opsTab=documents` : '/production-ops/event-ops?focus=event_ops';
      const result = mapContentResult({
        id: `document:${row.id}`,
        title: row.title || 'Booking Document',
        description: `${row.doc_type || 'document'} · ${row.status || 'draft'}`,
        category: 'documents',
        badge: 'Document',
        path,
        context: row.event_id ? 'Event Document' : 'Document',
        updatedAt: row.updated_at,
        score,
      });
      content.push(result);
      grouped.documents.push(result);
    });
  }

  if (include('permits') || include('insurance')) {
    let permitsQuery = applyEventScope(
      supabase
      .from('event_permits')
      .select('id,event_id,permit_type,status,issuing_authority,updated_at')
      .eq('user_id', userId)
      .or(`permit_type.ilike.${pattern},status.ilike.${pattern},issuing_authority.ilike.${pattern}`)
      .limit(limitPerTier * 2),
      scope,
      eventId,
      scopedEventIds,
      'event_id'
    );
    const permitRows = await runSafeQuery(permitsQuery);
    permitRows.forEach((row) => {
      const score = computeTokenScore([row.permit_type, row.status, row.issuing_authority].join(' '), tokens);
      const result = mapContentResult({
        id: `permit:${row.id}`,
        title: row.permit_type || 'Permit',
        description: `${row.status || 'pending'}${row.issuing_authority ? ` · ${row.issuing_authority}` : ''}`,
        category: 'permits_insurance',
        badge: 'Permit',
        path: row.event_id ? `/events/${row.event_id}?opsTab=safety` : '/safety-risk',
        context: 'Safety & Compliance',
        updatedAt: row.updated_at,
        score,
      });
      content.push(result);
      grouped.permits_insurance.push(result);
    });

    let insuranceQuery = applyEventScope(
      supabase
      .from('event_insurance_policies')
      .select('id,event_id,policy_type,status,carrier,updated_at')
      .eq('user_id', userId)
      .or(`policy_type.ilike.${pattern},status.ilike.${pattern},carrier.ilike.${pattern}`)
      .limit(limitPerTier * 2),
      scope,
      eventId,
      scopedEventIds,
      'event_id'
    );
    const insuranceRows = await runSafeQuery(insuranceQuery);
    insuranceRows.forEach((row) => {
      const score = computeTokenScore([row.policy_type, row.status, row.carrier].join(' '), tokens);
      const result = mapContentResult({
        id: `insurance:${row.id}`,
        title: row.policy_type || 'Insurance Policy',
        description: `${row.status || 'active'}${row.carrier ? ` · ${row.carrier}` : ''}`,
        category: 'permits_insurance',
        badge: 'Insurance',
        path: row.event_id ? `/events/${row.event_id}?opsTab=safety` : '/safety-risk',
        context: 'Safety & Compliance',
        updatedAt: row.updated_at,
        score,
      });
      content.push(result);
      grouped.permits_insurance.push(result);
    });
  }

  if (include('cues')) {
    // Cues currently live inside run_of_show JSON on events; surface event-level cue access.
    let cuesQuery = supabase
      .from('events')
      .select('id,title,run_of_show,updated_at')
      .eq('user_id', userId)
      .ilike('title', pattern)
      .limit(limitPerTier * 2);
    if (scope === 'event' && eventId) {
      cuesQuery = cuesQuery.eq('id', eventId);
    } else if (scope === 'org' || scope === 'venue') {
      if (Array.isArray(scopedEventIds) && scopedEventIds.length) {
        cuesQuery = cuesQuery.in('id', scopedEventIds);
      } else {
        cuesQuery = null;
      }
    }
    const rows = await runSafeQuery(cuesQuery);
    rows.forEach((row) => {
      const hasCues = row.run_of_show && typeof row.run_of_show === 'object';
      const score = computeTokenScore([row.title, 'run of show cues timeline'].join(' '), tokens) + (hasCues ? 2 : 0);
      const result = mapContentResult({
        id: `cue:${row.id}`,
        title: `${row.title || 'Event'} Cues`,
        description: hasCues ? 'Run of show and cue tracking' : 'Cue sheet area',
        category: 'cues',
        badge: 'Cues',
        path: `/events/${row.id}?opsTab=production`,
        context: 'Run of Show',
        updatedAt: row.updated_at,
        score,
      });
      content.push(result);
      grouped.cues.push(result);
    });
  }

  const sorter = bySort(sort);
  content.sort(sorter);
  Object.keys(grouped).forEach((key) => grouped[key].sort(sorter));

  return {
    content: content.slice(0, limitPerTier * 8),
    grouped,
  };
}

async function searchPeople({
  userId,
  query,
  scope,
  eventId,
  scopedEventIds,
  category,
  sort,
  limitPerTier,
}) {
  if (!(category === 'all' || category === 'people')) {
    return [];
  }
  const pattern = sanitizeLikePattern(query);
  const tokens = toTokens(query);
  const people = [];

  const staffByEventRole = new Map();
  const participantByEventRole = new Map();
  const scopedIds = Array.isArray(scopedEventIds) ? scopedEventIds.filter(Boolean) : [];
  const hasEventScope = scope === 'event' && eventId;
  const hasOrgScope = (scope === 'org' || scope === 'venue');
  const assignmentScopeIds = hasEventScope
    ? [eventId]
    : (hasOrgScope ? scopedIds : []);

  if (assignmentScopeIds.length) {
    const assignmentRows = await runSafeQuery(
      supabase
        .from('staff_assignments')
        .select('staff_profile_id,job_title,booking_id')
        .eq('user_id', userId)
        .in('booking_id', assignmentScopeIds)
    );
    assignmentRows.forEach((row) => {
      if (row.staff_profile_id) staffByEventRole.set(row.staff_profile_id, normalizeText(row.job_title, 180));
    });

    const participantRows = await runSafeQuery(
      supabase
        .from('event_participants')
        .select('participant_id,role,event_id,event:events!inner(id,user_id)')
        .in('event_id', assignmentScopeIds)
        .eq('event.user_id', userId)
    );
    participantRows.forEach((row) => {
      if (row.participant_id) participantByEventRole.set(row.participant_id, normalizeText(row.role, 180));
    });
  }

  let staffQuery = supabase
    .from('staff_profiles')
    .select('id,display_name,first_name,last_name,email,primary_role,job_titles,updated_at')
    .eq('user_id', userId)
    .limit(limitPerTier * 5);
  if (assignmentScopeIds.length) {
    const ids = Array.from(staffByEventRole.keys());
    if (ids.length) {
      staffQuery = staffQuery.in('id', ids);
    } else {
      staffQuery = null;
    }
  } else {
    staffQuery = staffQuery.or(`display_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},primary_role.ilike.${pattern}`);
  }
  const staffRows = staffQuery ? await runSafeQuery(staffQuery) : [];
  staffRows.forEach((row) => {
    const displayName = row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed Staff';
    const jobTitleText = ensureArray(row.job_titles).join(', ');
    const eventRole = staffByEventRole.get(row.id);
    const subtitle = [row.primary_role, eventRole, jobTitleText].filter(Boolean).join(' · ');
    const score = computeTokenScore([displayName, row.email, row.primary_role, jobTitleText, eventRole].join(' '), tokens);
    people.push(
      mapPeopleResult({
        id: `staff:${row.id}`,
        title: displayName,
        subtitle: subtitle || 'Staff Profile',
        context: row.email || '',
        path: '/production-ops/staffing?focus=staffing',
        score,
        updatedAt: row.updated_at,
      })
    );
  });

  let participantQuery = supabase
    .from('participant_profiles')
    .select('id,name,role,genre,contact_email,updated_at')
    .eq('user_id', userId)
    .limit(limitPerTier * 4);
  if (assignmentScopeIds.length) {
    const ids = Array.from(participantByEventRole.keys());
    if (ids.length) {
      participantQuery = participantQuery.in('id', ids);
    } else {
      participantQuery = null;
    }
  } else {
    participantQuery = participantQuery.or(`name.ilike.${pattern},role.ilike.${pattern},genre.ilike.${pattern},contact_email.ilike.${pattern}`);
  }
  const participantRows = participantQuery ? await runSafeQuery(participantQuery) : [];
  participantRows.forEach((row) => {
    const eventRole = participantByEventRole.get(row.id);
    const subtitle = [eventRole, row.role, row.genre].filter(Boolean).join(' · ');
    const score = computeTokenScore([row.name, eventRole, row.role, row.genre, row.contact_email].join(' '), tokens);
    people.push(
      mapPeopleResult({
        id: `participant:${row.id}`,
        title: row.name || 'Unnamed Participant',
        subtitle: subtitle || 'Participant',
        context: row.contact_email || '',
        path: '/artist-setup',
        score,
        updatedAt: row.updated_at,
      })
    );
  });

  people.sort(bySort(sort));
  return people.slice(0, limitPerTier * 4);
}

function parseParams(req) {
  const source = req.method === 'GET' ? (req.query || {}) : (req.body || {});
  const query = normalizeText(source.q || source.query || '', 200);
  const scope = normalizeText(source.scope || 'all', 40).toLowerCase() || 'all';
  const category = normalizeText(source.category || 'all', 80).toLowerCase() || 'all';
  const orgId = normalizeText(source.orgId || source.venueId || source.org_id || source.venue_id || '', 80);
  const eventId = normalizeText(source.eventId || source.event_id || '', 80);
  const sort = normalizeText(source.sort || 'relevance', 40).toLowerCase() || 'relevance';
  const limitPerTier = clamp(Number(source.limit || source.limitPerTier || 8) || 8, 3, 20);
  const withinCurrentEvent = String(source.withinCurrentEvent || source.within_current_event || '').toLowerCase() === 'true';

  return {
    query,
    scope: ['all', 'org', 'venue', 'event'].includes(scope) ? scope : 'all',
    category,
    orgId,
    eventId,
    sort: ['relevance', 'recent', 'alphabetical'].includes(sort) ? sort : 'relevance',
    limitPerTier,
    withinCurrentEvent,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const params = parseParams(req);

  try {
    let authContext = null;
    try {
      authContext = await requireApiAuth(req, { supabase });
    } catch (authError) {
      if (authError instanceof ApiAuthError && [401, 403].includes(Number(authError.status || 0))) {
        return res.status(200).json(buildEmptySearchPayload({
          ...params,
          message: 'We couldn’t load those results. Please try again.',
        }));
      }
      throw authError;
    }

    const userId = authContext?.userId;
    if (!userId) {
      return res.status(200).json(buildEmptySearchPayload({
        ...params,
        message: 'We couldn’t load those results. Please try again.',
      }));
    }

    if (!params.query) {
      return res.status(200).json(buildEmptySearchPayload(params));
    }

    const effectiveScope = params.withinCurrentEvent && params.eventId ? 'event' : params.scope;
    const scopedEventIds = await resolveScopedEventIds({
      userId,
      scope: effectiveScope,
      orgId: params.orgId,
      eventId: params.eventId,
    });

    const features = (params.category === 'all' || params.category === 'features')
      ? buildFeatureResults(params.query, params.limitPerTier, authContext)
      : [];

    const contentSearch = await searchContent({
      userId,
      query: params.query,
      scope: effectiveScope,
      orgId: params.orgId,
      eventId: params.eventId,
      scopedEventIds,
      limitPerTier: params.limitPerTier,
      category: params.category,
      sort: params.sort,
    });

    const people = await searchPeople({
      userId,
      query: params.query,
      scope: effectiveScope,
      eventId: params.eventId,
      scopedEventIds,
      category: params.category,
      sort: params.sort,
      limitPerTier: params.limitPerTier,
    });

    const tiers = {
      features: features.slice(0, params.limitPerTier),
      content: contentSearch.content.slice(0, params.limitPerTier * 6),
      people: people.slice(0, params.limitPerTier * 2),
    };

    const totals = {
      features: features.length,
      content: contentSearch.content.length,
      people: people.length,
      all: features.length + contentSearch.content.length + people.length,
    };

    return res.status(200).json({
      success: true,
      query: params.query,
      scope: params.scope,
      category: params.category,
      sort: params.sort,
      filters: {
        orgId: params.orgId || null,
        eventId: params.eventId || null,
        withinCurrentEvent: params.withinCurrentEvent,
      },
      tiers,
      grouped: contentSearch.grouped,
      totals,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      error: 'We couldn’t load those results. Please try again.',
    });
  }
}
