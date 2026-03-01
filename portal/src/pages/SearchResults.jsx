import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import {
  FEATURE_SEARCH_CATEGORY_OPTIONS,
  FEATURE_SEARCH_SCOPE_OPTIONS,
} from '../constants/globalSearchFeatures';
import { searchGlobal } from '../services/globalSearch';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'recent', label: 'Recently updated' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

function ResultCard({ row }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="m-0 text-sm font-semibold text-[#0d1b2a]">{row.title || 'Untitled'}</p>
          {row.description && <p className="m-0 text-xs text-gray-600 mt-1">{row.description}</p>}
          {row.context && <p className="m-0 text-[11px] text-gray-500 mt-1">{row.context}</p>}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-gray-500 rounded bg-gray-100 px-2 py-1">
          {row.badge || row.category || row.resultType || 'Result'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Link to={row.path || '/'} className="text-xs no-underline px-2 py-1 rounded border border-gray-300 text-[#0d1b2a]">
          Open
        </Link>
        {Array.isArray(row.quickActions) && row.quickActions.slice(0, 3).map((action) => (
          <Link key={`${row.id}-${action.label}`} to={action.path} className="text-xs no-underline px-2 py-1 rounded border border-gray-200 text-gray-700">
            {action.label}
          </Link>
        ))}
        {row.quickAction?.path && (
          <Link to={row.quickAction.path} className="text-xs no-underline px-2 py-1 rounded border border-gray-200 text-gray-700">
            {row.quickAction.label || 'Quick action'}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function SearchResults() {
  const { events, venueProfiles } = useVenue();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [scope, setScope] = useState(searchParams.get('scope') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [sort, setSort] = useState(searchParams.get('sort') || 'relevance');
  const [eventId, setEventId] = useState(searchParams.get('eventId') || '');
  const [orgId, setOrgId] = useState(searchParams.get('orgId') || '');
  const [withinCurrentEvent, setWithinCurrentEvent] = useState(searchParams.get('withinCurrentEvent') === 'true');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState({
    tiers: { features: [], content: [], people: [] },
    grouped: {},
    totals: { all: 0, features: 0, content: 0, people: 0 },
  });

  const sortedEvents = useMemo(() => {
    const rows = [...(events || [])];
    rows.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    return rows;
  }, [events]);

  const sortedOrgs = useMemo(() => {
    const rows = [...(venueProfiles || [])];
    rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return rows;
  }, [venueProfiles]);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setScope(searchParams.get('scope') || 'all');
    setCategory(searchParams.get('category') || 'all');
    setSort(searchParams.get('sort') || 'relevance');
    setEventId(searchParams.get('eventId') || '');
    setOrgId(searchParams.get('orgId') || '');
    setWithinCurrentEvent(searchParams.get('withinCurrentEvent') === 'true');
  }, [searchParams]);

  useEffect(() => {
    const activeQuery = String(searchParams.get('q') || '').trim();
    if (!activeQuery) {
      setResults({
        tiers: { features: [], content: [], people: [] },
        grouped: {},
        totals: { all: 0, features: 0, content: 0, people: 0 },
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await searchGlobal({
          query: activeQuery,
          scope: searchParams.get('scope') || 'all',
          category: searchParams.get('category') || 'all',
          sort: searchParams.get('sort') || 'relevance',
          eventId: searchParams.get('eventId') || '',
          orgId: searchParams.get('orgId') || '',
          withinCurrentEvent: searchParams.get('withinCurrentEvent') === 'true',
          limitPerTier: 12,
        });
        if (!cancelled) setResults(data || results);
      } catch (err) {
        if (!cancelled) setError('We couldn’t load those results. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (scope && scope !== 'all') params.set('scope', scope);
    if (category && category !== 'all') params.set('category', category);
    if (sort && sort !== 'relevance') params.set('sort', sort);
    if (eventId && (scope === 'event' || withinCurrentEvent)) params.set('eventId', eventId);
    if (orgId && (scope === 'org' || scope === 'venue')) params.set('orgId', orgId);
    if (withinCurrentEvent) params.set('withinCurrentEvent', 'true');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setScope('all');
    setCategory('all');
    setSort('relevance');
    setEventId('');
    setOrgId('');
    setWithinCurrentEvent(false);
    setSearchParams(query.trim() ? new URLSearchParams({ q: query.trim() }) : new URLSearchParams());
  };

  const groupedKeys = Object.keys(results.grouped || {}).filter((key) => (results.grouped?.[key] || []).length > 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <h1 className="text-3xl font-semibold mb-2">Global Search</h1>
      <p className="text-sm text-gray-600 mb-4">
        Features first, then content, then people. Use scope filters to stay in the right context.
      </p>

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-medium text-gray-700 md:col-span-3">
            Search Query
            <div className="mt-1 relative" role="search" aria-label="Search IMC records">
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 pr-12 text-sm focus:border-[#c8a45e] focus:outline-none"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyFilters();
                  }
                }}
                placeholder="Search pages, events, venues, plots, docs, people…"
                aria-label="Search query"
              />
              <button
                type="button"
                onClick={applyFilters}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-[#0d1b2a]"
                aria-label="Submit search"
              >
                🔍
              </button>
            </div>
            <p className="m-0 mt-1 text-[11px] text-gray-500">Press Enter or click 🔍 to run search.</p>
          </label>

          <label className="text-xs font-medium text-gray-700">
            Scope
            <select className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white" value={scope} onChange={(event) => setScope(event.target.value)}>
              {FEATURE_SEARCH_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-gray-700">
            Category
            <select className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white" value={category} onChange={(event) => setCategory(event.target.value)}>
              {FEATURE_SEARCH_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-gray-700">
            Sort
            <select className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white" value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          {(scope === 'event' || withinCurrentEvent) && (
            <label className="text-xs font-medium text-gray-700">
              Event
              <select className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white" value={eventId} onChange={(event) => setEventId(event.target.value)}>
                <option value="">Select event</option>
                {sortedEvents.map((eventRow) => (
                  <option key={eventRow.id} value={eventRow.id}>{eventRow.title || 'Untitled Event'}</option>
                ))}
              </select>
            </label>
          )}

          {(scope === 'org' || scope === 'venue') && (
            <label className="text-xs font-medium text-gray-700">
              Organization / Venue
              <select className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white" value={orgId} onChange={(event) => setOrgId(event.target.value)}>
                <option value="">Select organization</option>
                {sortedOrgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.name || 'Untitled Venue'}</option>
                ))}
              </select>
            </label>
          )}

          <label className="text-xs font-medium text-gray-700 flex items-center gap-2 md:col-span-3 mt-1">
            <input type="checkbox" checked={withinCurrentEvent} onChange={(event) => setWithinCurrentEvent(event.target.checked)} />
            Search within current event (if event context is selected)
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className="btn-primary text-xs" onClick={applyFilters}>Run Search</button>
          <button type="button" className="btn-secondary text-xs" onClick={clearFilters}>Reset Filters</button>
        </div>
      </div>

      <div className="mb-4 text-xs text-gray-600">
        Total results: <strong>{results.totals?.all || 0}</strong>
        {' '}· Features: {results.totals?.features || 0}
        {' '}· Content: {results.totals?.content || 0}
        {' '}· People: {results.totals?.people || 0}
      </div>

      {loading && <div className="card text-sm text-gray-600">Searching…</div>}
      {error && <div className="card text-sm text-gray-600">{error}</div>}
      {!loading && !error && (results.totals?.all || 0) === 0 && (
        <div className="card text-sm text-gray-600">
          <p className="m-0">No direct matches yet.</p>
          <p className="m-0 mt-2">Try feature-first terms like “production calendar”, “plots”, “safety”, or “IMC composer”.</p>
        </div>
      )}

      {!loading && !error && (results.totals?.all || 0) > 0 && (
        <div className="space-y-5">
          {results.tiers?.features?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Tier 1 · Features & Pages</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.tiers.features.map((row) => <ResultCard key={row.id} row={row} />)}
              </div>
            </section>
          )}

          {results.tiers?.content?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Tier 2 · User/Venue/Event Content</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.tiers.content.map((row) => <ResultCard key={row.id} row={row} />)}
              </div>
            </section>
          )}

          {results.tiers?.people?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Tier 3 · People Directory</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.tiers.people.map((row) => <ResultCard key={row.id} row={row} />)}
              </div>
            </section>
          )}

          {groupedKeys.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Grouped Content</h2>
              <div className="space-y-4">
                {groupedKeys.map((groupKey) => (
                  <div key={groupKey} className="card">
                    <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-2">{groupKey.replace(/_/g, ' ')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(results.grouped[groupKey] || []).map((row) => <ResultCard key={row.id} row={row} />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
