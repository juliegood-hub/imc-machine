import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVenue } from '../context/VenueContext';
import { parseLocalDate } from '../lib/dateUtils';

const FAVORITES_KEY = 'imc-chat-dashboard-favorites';

const SORT_OPTIONS = [
  { key: 'recent', label: 'Most Recent' },
  { key: 'az', label: 'A–Z' },
  { key: 'za', label: 'Z–A' },
];

const FILTER_OPTIONS = [
  { key: 'all', label: 'All Chats' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'groups', label: 'Group Chats' },
];

function getEventStart(event = {}) {
  const withTime = event?.bookingStartAt || (event?.date ? `${event.date}T${event.time || '19:00'}` : '');
  const parsed = withTime ? new Date(withTime) : parseLocalDate(event?.date);
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toTimestamp(value) {
  const parsed = new Date(value || '').getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDisplayTime(value) {
  const parsed = new Date(value || '');
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function compactText(value = '', max = 180) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function normalizePartnerKey(message = {}) {
  if (message.author_user_id) return `user:${String(message.author_user_id)}`;
  const name = String(message.author_name || '').trim().toLowerCase();
  if (name) return `name:${name}`;
  return '';
}

function normalizePartnerName(message = {}) {
  const named = String(message.author_name || '').trim();
  if (named) return named;
  if (message.author_user_id) return `User ${String(message.author_user_id).slice(0, 8)}`;
  return 'Unknown teammate';
}

export default function ChatDashboard() {
  const { events, listEventMessages, currentUserId } = useVenue();
  const [sortMode, setSortMode] = useState('recent');
  const [filterMode, setFilterMode] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
      setFavorites(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
    } catch {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const sortedEvents = useMemo(() => {
    return [...(events || [])]
      .sort((a, b) => (getEventStart(b)?.getTime() || 0) - (getEventStart(a)?.getTime() || 0))
      .slice(0, 50);
  }, [events]);

  const loadDashboard = useCallback(async () => {
    if (!sortedEvents.length) {
      setRows([]);
      setStatus('');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const messageBatches = await Promise.all(
        sortedEvents.map(async (event) => {
          try {
            const response = await listEventMessages(event.id, { limit: 120 });
            return { event, messages: response?.messages || [] };
          } catch (err) {
            return { event, messages: [], error: err?.message || 'load failed' };
          }
        })
      );

      const partnerMap = new Map();

      messageBatches.forEach(({ event, messages }) => {
        const participantSet = new Set();
        (messages || []).forEach((message) => {
          const pid = String(message?.author_user_id || '').trim();
          const pname = String(message?.author_name || '').trim().toLowerCase();
          if (pid) participantSet.add(`user:${pid}`);
          else if (pname) participantSet.add(`name:${pname}`);
        });
        const isGroupChat = participantSet.size >= 3;

        (messages || []).forEach((message) => {
          if (!message) return;
          if (currentUserId && message.author_user_id === currentUserId) return;
          if (String(message.author_name || '').trim().toLowerCase() === 'you') return;
          const key = normalizePartnerKey(message);
          if (!key) return;

          const existing = partnerMap.get(key) || {
            key,
            partnerId: message.author_user_id || null,
            partnerName: normalizePartnerName(message),
            lastMessageAt: '',
            lastMessageTs: 0,
            lastMessageText: '',
            lastEventId: '',
            lastEventTitle: '',
            eventMap: new Map(),
            messageCount: 0,
            groupThreadCount: 0,
          };

          existing.partnerName = normalizePartnerName(message) || existing.partnerName;
          existing.messageCount += 1;
          if (isGroupChat) existing.groupThreadCount += 1;
          if (event?.id) existing.eventMap.set(event.id, event.title || 'Untitled event');

          const ts = toTimestamp(message.created_at);
          if (ts >= existing.lastMessageTs) {
            existing.lastMessageTs = ts;
            existing.lastMessageAt = message.created_at || '';
            existing.lastMessageText = compactText(message.body_text || '(Attachment only)', 180);
            existing.lastEventId = event?.id || '';
            existing.lastEventTitle = event?.title || 'Untitled event';
          }

          partnerMap.set(key, existing);
        });
      });

      const nextRows = Array.from(partnerMap.values()).map((entry) => ({
        key: entry.key,
        partnerId: entry.partnerId,
        partnerName: entry.partnerName,
        lastMessageAt: entry.lastMessageAt,
        lastMessageTs: entry.lastMessageTs,
        lastMessageText: entry.lastMessageText,
        lastEventId: entry.lastEventId,
        lastEventTitle: entry.lastEventTitle,
        eventCount: entry.eventMap.size,
        messageCount: entry.messageCount,
        groupThreadCount: entry.groupThreadCount,
        hasGroupChats: entry.groupThreadCount > 0,
      }));

      setRows(nextRows);
      if (!nextRows.length) {
        setStatus('No user-to-user messages yet. Start inside Event Detail → Messaging and this dashboard will populate automatically.');
      }
    } catch (err) {
      setStatus(`Chat dashboard load failed: ${err.message}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, listEventMessages, sortedEvents]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const filteredRows = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    let next = [...rows];

    if (query) {
      next = next.filter((row) => {
        return row.partnerName.toLowerCase().includes(query)
          || row.lastMessageText.toLowerCase().includes(query)
          || row.lastEventTitle.toLowerCase().includes(query);
      });
    }

    if (filterMode === 'favorites') {
      next = next.filter((row) => favoriteSet.has(row.key));
    }

    if (filterMode === 'groups') {
      next = next.filter((row) => row.hasGroupChats);
    }

    if (sortMode === 'az') {
      next.sort((a, b) => a.partnerName.localeCompare(b.partnerName));
      return next;
    }

    if (sortMode === 'za') {
      next.sort((a, b) => b.partnerName.localeCompare(a.partnerName));
      return next;
    }

    next.sort((a, b) => b.lastMessageTs - a.lastMessageTs);
    return next;
  }, [favoriteSet, filterMode, rows, search, sortMode]);

  const toggleFavorite = (key) => {
    setFavorites((prev) => {
      if (prev.includes(key)) return prev.filter((value) => value !== key);
      return [...prev, key];
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <h1 className="text-3xl mb-2">💬 Chat Dashboard</h1>
      <p className="text-gray-500 mb-4">
        This is user-to-user messaging. Sort and filter like modern chat apps, then jump straight into the right thread.
      </p>

      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600">Sort:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
            <span className="text-xs text-gray-600">Filter:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full sm:w-auto min-w-0 sm:min-w-[180px]"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn-secondary text-xs" onClick={loadDashboard} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link to="/buddy" className="btn-secondary text-xs no-underline">🐈‍⬛ Open Buddy the CatBot</Link>
          </div>
        </div>
      </div>

      {status && <p className="text-xs text-gray-500 mt-0 mb-3">{status}</p>}

      {!filteredRows.length ? (
        <div className="card">
          <p className="m-0 text-sm text-gray-600">
            {loading
              ? 'Loading chat threads...'
              : filterMode === 'favorites'
                ? 'No favorite chats yet. Star a teammate to pin them here.'
              : 'No user-to-user chat threads found yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRows.map((row) => {
            const isFavorite = favoriteSet.has(row.key);
            return (
              <div key={row.key} className="card flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(row.key)}
                      className={`text-xs border rounded px-2 py-1 ${isFavorite ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-300 bg-white text-gray-500'}`}
                      aria-label={isFavorite ? `Unpin ${row.partnerName} from favorites` : `Pin ${row.partnerName} to favorites`}
                    >
                      {isFavorite ? '★ Pinned' : '☆ Pin to Favorites'}
                    </button>
                    <p className="font-semibold text-sm m-0">{row.partnerName}</p>
                  </div>
                  <p className="text-xs text-gray-500 m-0 mt-1">
                    Last message: {toDisplayTime(row.lastMessageAt)} · {row.messageCount} message{row.messageCount === 1 ? '' : 's'} · {row.eventCount} event{row.eventCount === 1 ? '' : 's'}
                  </p>
                  {row.hasGroupChats && (
                    <p className="text-xs text-indigo-600 m-0 mt-1">
                      Group chats: {row.groupThreadCount}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 m-0 mt-2">{row.lastMessageText || '(No preview)'}</p>
                  <p className="text-xs text-gray-500 m-0 mt-2">
                    Latest thread: {row.lastEventTitle || 'Unknown event'}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap text-xs">
                  {row.lastEventId ? (
                    <>
                      <Link
                        to={`/events/${row.lastEventId}?opsTab=messaging`}
                        className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 no-underline bg-white"
                      >
                        Open Thread
                      </Link>
                      <Link
                        to={`/events/${row.lastEventId}`}
                        className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 no-underline bg-white"
                      >
                        Event Detail
                      </Link>
                    </>
                  ) : (
                    <span className="text-gray-500">No linked event found</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
