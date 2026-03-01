import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import { getFloatingButtonsMode, USER_PREFS_UPDATED_EVENT } from '../lib/userPrefs';
import { BUDDY_HELP_TOPICS } from '../constants/helpCenterContent';

const BUDDY_OPEN_KEY = 'imc-buddy-drawer-open';
const BUDDY_EVENT_KEY = 'imc-buddy-drawer-event-id';
const BUDDY_HISTORY_KEY = 'imc-buddy-drawer-history';
const MAX_HISTORY = 18;

function getEventStart(event) {
  const date = event?.date;
  if (!date) return null;
  const rawTime = String(event?.time || '19:00').trim();
  const time24 = /am|pm/i.test(rawTime)
    ? (() => {
      const m = rawTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
      if (!m) return '19:00';
      let hour = Number(m[1] || 0);
      const min = Number(m[2] || 0);
      const mer = String(m[3] || '').toLowerCase();
      if (mer === 'pm' && hour < 12) hour += 12;
      if (mer === 'am' && hour === 12) hour = 0;
      return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    })()
    : rawTime;
  const start = new Date(`${date}T${time24}`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function restoreConversation() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BUDDY_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function renderLinkedMessage(content, onNavigate, keyBase = 'buddy-inline') {
  const text = String(content || '');
  const regex = /\[([^[\]]+)\]\((\/[^)\s]+)\)/g;
  const output = [];
  let lastIndex = 0;
  let match;
  let counter = 0;
  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, label, path] = match;
    const start = match.index;
    if (start > lastIndex) output.push(text.slice(lastIndex, start));
    output.push(
      <button
        key={`${keyBase}-${counter}`}
        type="button"
        className="p-0 m-0 bg-transparent border-none text-[#0d1b2a] underline cursor-pointer text-left"
        onClick={() => onNavigate(path)}
      >
        {label}
      </button>
    );
    lastIndex = start + fullMatch.length;
    counter += 1;
  }
  if (lastIndex < text.length) output.push(text.slice(lastIndex));
  return output.length ? output : [text];
}

export default function BuddyDrawer() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { events } = useVenue();
  const [floatingButtonsMode, setFloatingButtonsMode] = useState(() => getFloatingButtonsMode(user?.id));
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(BUDDY_OPEN_KEY) === '1';
  });
  const [selectedEventId, setSelectedEventId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(BUDDY_EVENT_KEY) || '';
  });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [conversation, setConversation] = useState(() => {
    const restored = restoreConversation();
    if (restored.length > 0) return restored;
    return [{
      role: 'assistant',
      content: 'I am Buddy the CatBot. Tell me what you are trying to get done, and I will give you direct next steps with one-click links.',
      actions: [
        { label: 'Start New Event', path: '/events/create', note: 'Create the event first, then I can guide every step.' },
        { label: 'Open How It Works', path: '/workflow', note: 'Use the color-coded workflow map and section links.' },
        { label: 'Open User Guide', path: '/user-guide', note: 'Step-by-step operating instructions by module.' },
        { label: 'Open White Papers', path: '/white-papers', note: 'Architecture and strategy papers for stakeholders.' },
      ],
    }];
  });

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...(events || [])]
      .filter((event) => {
        const start = getEventStart(event);
        return start && start >= now;
      })
      .sort((a, b) => {
        const aStart = getEventStart(a)?.getTime() || 0;
        const bStart = getEventStart(b)?.getTime() || 0;
        return aStart - bStart;
      })
      .slice(0, 30);
  }, [events]);

  const selectedEvent = useMemo(() => {
    return upcomingEvents.find((event) => event.id === selectedEventId) || upcomingEvents[0] || null;
  }, [selectedEventId, upcomingEvents]);

  const workflowVariant = useMemo(() => {
    if (typeof window === 'undefined') return 'default';
    return window.localStorage.getItem('imc-workflow-variant') || 'default';
  }, []);

  const appendWorkflowVariant = (path = '') => {
    if (!path) return '/';
    if (workflowVariant === 'default') return path;
    const [pathname, query = ''] = path.split('?');
    const params = new URLSearchParams(query);
    if (!params.has('wf')) params.set('wf', workflowVariant);
    return `${pathname}?${params.toString()}`;
  };

  const resolveActionPath = (path = '') => {
    const eventPath = selectedEvent?.id ? path.replace(':eventId', selectedEvent.id) : path;
    return appendWorkflowVariant(eventPath);
  };

  useEffect(() => {
    if (!selectedEventId && upcomingEvents.length > 0) {
      setSelectedEventId(upcomingEvents[0].id);
    }
  }, [selectedEventId, upcomingEvents]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BUDDY_OPEN_KEY, isOpen ? '1' : '0');
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedEventId) window.localStorage.setItem(BUDDY_EVENT_KEY, selectedEventId);
  }, [selectedEventId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const serializable = conversation
      .slice(-MAX_HISTORY)
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: String(message.content || ''),
        actions: Array.isArray(message.actions) ? message.actions.slice(0, 6) : [],
        followUpQuestion: message.followUpQuestion ? String(message.followUpQuestion) : '',
      }));
    window.localStorage.setItem(BUDDY_HISTORY_KEY, JSON.stringify(serializable));
  }, [conversation]);

  useEffect(() => {
    const onEsc = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  useEffect(() => {
    setFloatingButtonsMode(getFloatingButtonsMode(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncMode = () => setFloatingButtonsMode(getFloatingButtonsMode(user?.id));
    window.addEventListener('storage', syncMode);
    window.addEventListener(USER_PREFS_UPDATED_EVENT, syncMode);
    return () => {
      window.removeEventListener('storage', syncMode);
      window.removeEventListener(USER_PREFS_UPDATED_EVENT, syncMode);
    };
  }, [user?.id]);

  const sendMessage = async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || sending) return;

    const userMessage = { role: 'user', content: trimmed };
    const nextConversation = [...conversation, userMessage];
    setConversation(nextConversation);
    setDraft('');
    setChatError('');
    setSending(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'helpful-chat',
          workflowVariant,
          messages: nextConversation.map((msg) => ({ role: msg.role, content: msg.content })),
          context: {
            currentPage: typeof window !== 'undefined' ? window.location.pathname : '',
            selectedEvent: selectedEvent ? {
              id: selectedEvent.id,
              title: selectedEvent.title,
              date: selectedEvent.date,
              time: selectedEvent.time,
              venue: selectedEvent.venue,
              performanceZoneName: selectedEvent.performanceZoneName,
            } : null,
            upcomingCount: upcomingEvents.length,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Buddy hit a snag responding.');
      }
      setConversation((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: String(data.reply || 'I could not draft that response yet. Try again and I will tighten it.'),
          actions: Array.isArray(data.actions) ? data.actions : [],
          followUpQuestion: String(data.followUpQuestion || ''),
        },
      ]);
    } catch (err) {
      setChatError(err.message);
    } finally {
      setSending(false);
    }
  };

  const QUICK_PROMPTS = [
    'What should I do next?',
    'Give me a quick production checklist.',
    'What is missing before distribution?',
    ...BUDDY_HELP_TOPICS.map((topic) => topic.prompt),
  ];

  const path = String(location?.pathname || '');
  const hideLauncherOnRoute = path.startsWith('/buddy') || path.startsWith('/chat');
  const buddyCompact = floatingButtonsMode !== 'standard';
  const buddyVisibility = floatingButtonsMode === 'hidden_mobile' ? 'hidden sm:inline-flex' : 'inline-flex';
  const buddyLauncherLabel = buddyCompact ? '🐈‍⬛ Buddy' : '🐈‍⬛ Open Buddy';

  return (
    <>
      {!isOpen && !hideLauncherOnRoute && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`fixed right-4 z-[65] rounded-full bg-[#0d1b2a] text-white border border-[#c8a45e] shadow-md ${buddyVisibility} ${buddyCompact ? 'bottom-4 sm:bottom-4 px-2.5 py-1.5 text-[11px] leading-none' : 'bottom-5 sm:bottom-5 px-3 py-2 text-xs'}`}
          aria-label="Open Buddy the CatBot"
        >
          {buddyLauncherLabel}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[64] pointer-events-none">
          <button
            type="button"
            className="absolute inset-0 bg-black/25 border-none p-0 m-0 pointer-events-auto md:hidden"
            aria-label="Close Buddy panel"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute top-[52px] right-0 bottom-0 w-full sm:w-[380px] bg-white border-l border-gray-200 shadow-2xl pointer-events-auto flex flex-col">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500 m-0">Live Assistant</p>
                <p className="text-sm font-semibold m-0">🐈‍⬛ Buddy the CatBot</p>
              </div>
              <div className="flex items-center gap-1">
                <Link to="/buddy" className="text-[11px] text-[#0d1b2a] no-underline px-2 py-1 border border-gray-200 rounded">
                  Full Buddy
                </Link>
                <Link to="/chat" className="text-[11px] text-[#0d1b2a] no-underline px-2 py-1 border border-gray-200 rounded">
                  Chat Dashboard
                </Link>
                <button
                  type="button"
                  className="text-xs px-2 py-1 border border-gray-200 rounded bg-white"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Buddy drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-3 py-2 border-b border-gray-100">
              <label className="text-[11px] text-gray-600 block mb-1">Event context</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
              >
                {upcomingEvents.length === 0 && <option value="">No event selected</option>}
                {upcomingEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title || 'Untitled event'} · {event.date || 'TBD'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2 bg-[#fafafa]">
              {conversation.map((message, index) => (
                <div key={`buddy-drawer-msg-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[95%] rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-[#0d1b2a] text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    <p className="m-0 whitespace-pre-wrap">
                      {renderLinkedMessage(message.content, (path) => {
                        setIsOpen(false);
                        navigate(resolveActionPath(path));
                      }, `drawer-${index}`)}
                    </p>
                    {message.role === 'assistant' && Array.isArray(message.actions) && message.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.actions.map((action, actionIndex) => (
                          <button
                            key={`buddy-drawer-action-${index}-${actionIndex}`}
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              navigate(resolveActionPath(action.path));
                            }}
                            className="text-[11px] px-2 py-1 rounded border border-[#0d1b2a] text-[#0d1b2a] bg-white"
                            title={action.note || ''}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {message.role === 'assistant' && message.followUpQuestion && (
                      <p className="m-0 mt-2 text-[11px] text-gray-500">{message.followUpQuestion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-gray-100">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="text-[11px] px-2 py-1 rounded border border-gray-300 bg-white text-gray-700"
                    disabled={sending}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(draft);
                    }
                  }}
                  className="flex-1 px-2 py-2 border border-gray-300 rounded text-sm"
                  placeholder="Ask Buddy..."
                />
                <button
                  type="button"
                  onClick={() => sendMessage(draft)}
                  className="btn-primary text-xs px-3"
                  disabled={sending || !draft.trim()}
                >
                  {sending ? 'Thinking...' : 'Send'}
                </button>
              </div>
              {chatError && <p className="text-xs text-red-600 m-0 mt-2">{chatError}</p>}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
