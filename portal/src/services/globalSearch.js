import { supabase } from '../lib/supabase';

function normalizeString(value = '', maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function buildEmptySearchResponse(query = '') {
  return {
    success: true,
    query: String(query || ''),
    tiers: { features: [], content: [], people: [] },
    grouped: {},
    totals: { features: 0, content: 0, people: 0, all: 0 },
  };
}

function normalizeSearchErrorMessage(message = '') {
  const raw = String(message || '').trim();
  if (!raw) return 'We couldn\'t load those results. Please try again.';
  if (/unauthorized|forbidden|access token|invalid session|not authenticated/i.test(raw)) {
    return 'We couldn\'t load those results. Please try again.';
  }
  return 'We couldn\'t load those results. Please try again.';
}

export async function searchGlobal({
  query = '',
  scope = 'all',
  category = 'all',
  orgId = '',
  venueId = '',
  eventId = '',
  sort = 'relevance',
  limitPerTier = 8,
  withinCurrentEvent = false,
} = {}) {
  const normalizedQuery = normalizeString(query, 200);
  if (!normalizedQuery) {
    return buildEmptySearchResponse('');
  }

  const params = new URLSearchParams();
  params.set('q', normalizedQuery);
  params.set('scope', normalizeString(scope, 40) || 'all');
  params.set('category', normalizeString(category, 80) || 'all');
  params.set('sort', normalizeString(sort, 40) || 'relevance');
  params.set('limit', String(Math.max(3, Math.min(20, Number(limitPerTier) || 8))));

  const scopedOrg = normalizeString(orgId || venueId, 80);
  const scopedEvent = normalizeString(eventId, 80);
  if (scopedOrg) params.set('orgId', scopedOrg);
  if (scopedEvent) params.set('eventId', scopedEvent);
  if (withinCurrentEvent) params.set('withinCurrentEvent', 'true');

  const headers = new Headers({ Accept: 'application/json' });
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  } catch {
    // If session lookup fails, let the request continue and rely on server fallback behavior.
  }

  const response = await fetch(`/api/search?${params.toString()}`, {
    method: 'GET',
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    const fallbackMessage = normalizeSearchErrorMessage(data?.error || response.statusText);

    if (response.status === 401 || response.status === 403 || /unauthorized|forbidden/i.test(String(data?.error || ''))) {
      return {
        ...buildEmptySearchResponse(normalizedQuery),
        message: fallbackMessage,
      };
    }

    throw new Error(fallbackMessage);
  }

  return {
    ...buildEmptySearchResponse(normalizedQuery),
    ...data,
  };
}
