import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { searchGlobal } from '../services/globalSearch';

function splitTerms(query = '') {
  return String(query || '')
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .slice(0, 8);
}

function HighlightText({ text = '', query = '' }) {
  const terms = splitTerms(query).map((term) => term.toLowerCase());
  if (!terms.length) return text;
  const source = String(text || '');
  let cursor = 0;
  const nodes = [];

  while (cursor < source.length) {
    let matchIndex = -1;
    let matchLength = 0;

    for (const term of terms) {
      const idx = source.toLowerCase().indexOf(term, cursor);
      if (idx === -1) continue;
      if (matchIndex === -1 || idx < matchIndex) {
        matchIndex = idx;
        matchLength = term.length;
      }
    }

    if (matchIndex === -1) {
      nodes.push(<span key={`tail-${cursor}`}>{source.slice(cursor)}</span>);
      break;
    }

    if (matchIndex > cursor) {
      nodes.push(<span key={`txt-${cursor}`}>{source.slice(cursor, matchIndex)}</span>);
    }
    nodes.push(
      <mark key={`mark-${matchIndex}`} className="bg-[#f5dca8] text-[#0d1b2a] rounded px-0.5">
        {source.slice(matchIndex, matchIndex + matchLength)}
      </mark>
    );
    cursor = matchIndex + matchLength;
  }

  return <>{nodes}</>;
}

function TierBlock({ title, results = [], query = '', onSelect }) {
  if (!results.length) return null;
  return (
    <div className="border-t border-gray-100 first:border-t-0 py-2">
      <p className="m-0 px-2 text-[10px] uppercase tracking-wide text-gray-500">{title}</p>
      <div className="mt-1 space-y-1">
        {results.map((result) => (
          <button
            key={result.id}
            type="button"
            onClick={() => onSelect(result)}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 bg-transparent"
          >
            <p className="m-0 text-sm font-medium text-[#0d1b2a] leading-tight">
              <HighlightText text={result.title || ''} query={query} />
            </p>
            {result.description && (
              <p className="m-0 text-xs text-gray-500 leading-tight mt-0.5">
                <HighlightText text={result.description} query={query} />
              </p>
            )}
            {result.context && (
              <p className="m-0 text-[11px] text-gray-400 mt-0.5">{result.context}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GlobalSearchBar({
  mode = 'full',
  className = '',
  placeholder = 'Search features, events, venues, people…',
  enableShortcut = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [withinCurrentEvent, setWithinCurrentEvent] = useState(false);
  const [results, setResults] = useState({ tiers: { features: [], content: [], people: [] }, totals: { all: 0 } });

  const isCompact = mode === 'compact';
  const eventIdFromPath = useMemo(() => {
    const match = location.pathname.match(/^\/events\/([^/]+)/);
    return match?.[1] || '';
  }, [location.pathname]);

  useEffect(() => {
    if (!eventIdFromPath) {
      setWithinCurrentEvent(false);
    }
  }, [eventIdFromPath]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!enableShortcut) return undefined;
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setOpen(true);
      if (isCompact) {
        window.setTimeout(() => inputRef.current?.focus(), 10);
      } else {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableShortcut, isCompact]);

  useEffect(() => {
    if (!open && isCompact) return undefined;
    const normalized = query.trim();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (normalized.length < 2) {
      setResults({ tiers: { features: [], content: [], people: [] }, totals: { all: 0 } });
      setLoading(false);
      setError('');
      return undefined;
    }

    debounceRef.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError('');
        const data = await searchGlobal({
          query: normalized,
          scope: withinCurrentEvent && eventIdFromPath ? 'event' : 'all',
          eventId: withinCurrentEvent ? eventIdFromPath : '',
          limitPerTier: 5,
          withinCurrentEvent,
        });
        setResults(data || { tiers: { features: [], content: [], people: [] }, totals: { all: 0 } });
      } catch (_err) {
        setError('We couldn\'t load those results. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [eventIdFromPath, isCompact, open, query, withinCurrentEvent]);

  const submitSearch = () => {
    const normalized = query.trim();
    if (!normalized) return;
    const params = new URLSearchParams();
    params.set('q', normalized);
    if (withinCurrentEvent && eventIdFromPath) {
      params.set('scope', 'event');
      params.set('eventId', eventIdFromPath);
      params.set('withinCurrentEvent', 'true');
    }
    navigate(`/search?${params.toString()}`);
    setOpen(false);
  };

  const handleSelectResult = (result) => {
    if (!result?.path) return;
    navigate(result.path);
    setOpen(false);
  };

  const tiered = results?.tiers || { features: [], content: [], people: [] };
  const totalMatches = Number(results?.totals?.all || 0);
  const showDropdown = open && (query.trim().length >= 2 || loading || error);
  const isEmptySearch = !loading && !error && query.trim().length >= 2 && totalMatches === 0;

  return (
    <div ref={containerRef} className={`relative ${className}`} role="search" aria-label="Global site search">
      {isCompact ? (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen((prev) => !prev);
              if (!open) {
                window.setTimeout(() => inputRef.current?.focus(), 20);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded border border-gray-600 px-2.5 py-1.5 text-xs text-gray-100 bg-transparent"
            aria-label="Open global search"
          >
            🔍 Search
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-[min(92vw,26rem)] rounded-xl border border-gray-200 bg-white shadow-xl p-2 z-[80]">
              <div className="flex items-center gap-2 px-1">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitSearch();
                      }
                      if (event.key === 'Escape') {
                        setOpen(false);
                      }
                    }}
                    className="w-full rounded border border-gray-300 px-3 py-2 pr-9 text-sm focus:border-[#c8a45e] focus:outline-none"
                    placeholder={placeholder}
                    aria-label="Global search query"
                  />
                  <button
                    type="button"
                    onClick={submitSearch}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-[#0d1b2a]"
                    aria-label="Submit search"
                  >
                    🔍
                  </button>
                </div>
                <button
                  type="button"
                  onClick={submitSearch}
                  className="btn-primary text-xs px-3 py-2"
                  aria-label="Search"
                >
                  Search
                </button>
              </div>
              <p className="m-0 px-1 pt-1 text-[11px] text-gray-500">Press Enter or tap 🔍 to open full results.</p>
              {eventIdFromPath && (
                <label className="flex items-center gap-2 text-[11px] text-gray-600 px-1 pt-2">
                  <input
                    type="checkbox"
                    checked={withinCurrentEvent}
                    onChange={(event) => setWithinCurrentEvent(event.target.checked)}
                  />
                  Search within current event
                </label>
              )}
              {showDropdown && (
                <div className="mt-2 max-h-[24rem] overflow-auto rounded border border-gray-100">
                  {loading ? (
                    <p className="m-0 px-3 py-4 text-sm text-gray-500">Searching…</p>
                  ) : error ? (
                    <p className="m-0 px-3 py-4 text-sm text-gray-600">{error}</p>
                  ) : isEmptySearch ? (
                    <p className="m-0 px-3 py-4 text-sm text-gray-500">No matches yet. Try a feature name like “Timeline” or “Safety”.</p>
                  ) : (
                    <>
                      <TierBlock title="Features & Pages" results={tiered.features.slice(0, 5)} query={query} onSelect={handleSelectResult} />
                      <TierBlock title="Content" results={tiered.content.slice(0, 5)} query={query} onSelect={handleSelectResult} />
                      <TierBlock title="People" results={tiered.people.slice(0, 5)} query={query} onSelect={handleSelectResult} />
                      <button
                        type="button"
                        className="w-full text-left px-2 py-2 text-xs text-[#0d1b2a] font-semibold border-t border-gray-100 bg-[#faf8f3]"
                        onClick={submitSearch}
                      >
                        View all results ({totalMatches})
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitSearch();
                }
                if (event.key === 'Escape') {
                  setOpen(false);
                }
              }}
              className="w-full rounded-lg border border-gray-300 bg-white text-[#0d1b2a] px-3 py-2 pr-24 text-sm placeholder:text-gray-500 focus:border-[#c8a45e] focus:outline-none"
              placeholder={placeholder}
              aria-label="Global search"
            />
            <button
              type="button"
              onClick={submitSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-[#0d1b2a] hover:border-[#c8a45e]"
              aria-label="Submit search"
            >
              🔍
            </button>
            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 border border-gray-300 rounded px-1.5 py-0.5 bg-white">
              ⌘/Ctrl+K
            </span>
          </div>
          <p className="m-0 mt-1 text-[11px] text-gray-200">Press Enter or click 🔍 to open full results.</p>

          {eventIdFromPath && open && (
            <label className="flex items-center gap-2 text-[11px] text-gray-200 mt-1">
              <input
                type="checkbox"
                checked={withinCurrentEvent}
                onChange={(event) => setWithinCurrentEvent(event.target.checked)}
              />
              Search within current event
            </label>
          )}

          {showDropdown && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl border border-gray-200 bg-white shadow-xl max-h-[26rem] overflow-auto z-[80]" role="listbox" aria-label="Search suggestions">
              {loading ? (
                <p className="m-0 px-3 py-4 text-sm text-gray-500">Searching…</p>
              ) : error ? (
                <p className="m-0 px-3 py-4 text-sm text-gray-600">{error}</p>
              ) : isEmptySearch ? (
                <p className="m-0 px-3 py-4 text-sm text-gray-500">No matches yet. Try a feature name like “Timeline” or “Safety”.</p>
              ) : (
                <>
                  <TierBlock title="Features & Pages" results={tiered.features.slice(0, 5)} query={query} onSelect={handleSelectResult} />
                  <TierBlock title="Content" results={tiered.content.slice(0, 5)} query={query} onSelect={handleSelectResult} />
                  <TierBlock title="People" results={tiered.people.slice(0, 5)} query={query} onSelect={handleSelectResult} />
                  <button
                    type="button"
                    className="w-full text-left px-2 py-2 text-xs text-[#0d1b2a] font-semibold border-t border-gray-100 bg-[#faf8f3]"
                    onClick={submitSearch}
                  >
                    View all results ({totalMatches})
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
