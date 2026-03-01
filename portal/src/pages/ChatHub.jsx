import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useVenue } from '../context/VenueContext';
import { BUDDY_HELP_TOPICS } from '../constants/helpCenterContent';

function getEventStart(event = {}) {
  const withTime = event?.bookingStartAt || (event?.date ? `${event.date}T${event.time || '19:00'}` : '');
  const parsed = withTime ? new Date(withTime) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return parsed;
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

export default function ChatHub() {
  const navigate = useNavigate();
  const { events } = useVenue();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [conversation, setConversation] = useState([
    {
      role: 'assistant',
      content: 'I am Buddy the CatBot. Tell me what you are trying to get done, and I will give you direct next steps with one-click links.',
      actions: [
        { label: 'Start New Event', path: '/events/create', note: 'Create the event first, then I can guide every step.' },
        { label: 'Open How It Works', path: '/workflow', note: 'Use the color-coded workflow map and section links.' },
        { label: 'Open User Guide', path: '/user-guide', note: 'Step-by-step operating instructions by module.' },
        { label: 'Open White Papers', path: '/white-papers', note: 'Architecture and strategy papers for stakeholders.' },
      ],
    },
  ]);

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
      .slice(0, 40);
  }, [events]);
  const selectedEvent = useMemo(
    () => upcomingEvents.find((event) => event.id === selectedEventId) || upcomingEvents[0] || null,
    [selectedEventId, upcomingEvents]
  );

  useEffect(() => {
    if (!selectedEventId && upcomingEvents.length > 0) {
      setSelectedEventId(upcomingEvents[0].id);
    }
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
            currentPage: '/buddy',
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
      const assistantMessage = {
        role: 'assistant',
        content: String(data.reply || 'I could not draft that response yet. Try again and I will tighten it.'),
        actions: Array.isArray(data.actions) ? data.actions : [],
        followUpQuestion: String(data.followUpQuestion || ''),
      };
      setConversation((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setChatError(err.message);
    } finally {
      setSending(false);
    }
  };

  const QUICK_PROMPTS = [
    'What should I do next for this event?',
    'Give me a pre-production checklist I can do in 20 minutes.',
    'What is missing before I distribute marketing?',
    'Help me prep staffing and production ops for this week.',
    ...BUDDY_HELP_TOPICS.map((topic) => topic.prompt),
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-3xl mb-2">🐈‍⬛ Buddy the CatBot</h1>
      <p className="text-gray-500 mb-3">
        Ask Buddy for practical next steps, then open the exact page with one click.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/chat" className="btn-secondary text-xs no-underline">💬 Open Chat Dashboard</Link>
        <Link to="/user-guide" className="btn-secondary text-xs no-underline">🧭 Open User Guide</Link>
        <Link to="/white-papers" className="btn-secondary text-xs no-underline">📄 Open White Papers</Link>
      </div>

      <div className="card mb-4 border border-[#0d1b2a1a] bg-[#f7f9ff]">
        <h2 className="text-lg m-0 mb-2">Learn with Buddy</h2>
        <p className="text-sm text-gray-600 mt-0 mb-3">
          Pick a topic and I will route you straight to the right help section.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {BUDDY_HELP_TOPICS.map((topic) => (
            <div key={topic.key} className="rounded border border-white bg-white p-3">
              <p className="text-sm font-semibold m-0">{topic.label}</p>
              <p className="text-xs text-gray-500 mt-1 mb-2">{topic.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Link to={topic.path} className="text-xs px-2 py-1 rounded border border-[#0d1b2a] text-[#0d1b2a] no-underline">Open Topic</Link>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700"
                  onClick={() => sendMessage(topic.prompt)}
                  disabled={sending}
                >
                  Ask This
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-gray-600">Context event:</span>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-xs bg-white"
          >
            {upcomingEvents.length === 0 && <option value="">No event selected</option>}
            {upcomingEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title || 'Untitled event'} · {event.date || 'TBD'}
              </option>
            ))}
          </select>
          {selectedEvent && (
            <span className="text-[11px] text-gray-500">
              {selectedEvent.venue || 'Venue TBD'}{selectedEvent.performanceZoneName ? ` · ${selectedEvent.performanceZoneName}` : ''}
            </span>
          )}
        </div>

        <div className="max-h-[380px] overflow-auto border border-gray-200 rounded-lg p-3 space-y-2 bg-[#fafafa]">
          {conversation.map((message, index) => (
            <div key={`buddy-msg-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[92%] rounded-lg px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-[#0d1b2a] text-white'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}>
                <p className="m-0 whitespace-pre-wrap">
                  {renderLinkedMessage(message.content, (path) => navigate(resolveActionPath(path)), `chat-${index}`)}
                </p>
                {message.role === 'assistant' && Array.isArray(message.actions) && message.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.actions.map((action, actionIndex) => (
                      <button
                        key={`buddy-action-${index}-${actionIndex}`}
                        type="button"
                        onClick={() => navigate(resolveActionPath(action.path))}
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

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700"
              disabled={sending}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
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
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
            placeholder="Ask Buddy: what should I do next?"
          />
          <button type="button" onClick={() => sendMessage(draft)} className="btn-primary text-sm" disabled={sending || !draft.trim()}>
            {sending ? 'Thinking...' : 'Ask Buddy'}
          </button>
        </div>
        {chatError && <p className="text-xs text-red-600 m-0 mt-2">{chatError}</p>}
      </div>
    </div>
  );
}
