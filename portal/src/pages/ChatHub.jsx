import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useVenue } from '../context/VenueContext';
import { parseLocalDate } from '../lib/dateUtils';

function getEventStart(event = {}) {
  const withTime = event?.bookingStartAt || (event?.date ? `${event.date}T${event.time || '19:00'}` : '');
  const parsed = withTime ? new Date(withTime) : parseLocalDate(event?.date);
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatEventStart(event = {}) {
  const start = getEventStart(event);
  if (!start) return 'Date TBD';
  return start.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ChatHub() {
  const { events } = useVenue();

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

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-3xl mb-2">💬 Chat</h1>
      <p className="text-gray-500 mb-6">
        Pick an event and jump straight into the conversation. Every event thread lives in Event Detail → Operations → Messaging.
      </p>

      {!upcomingEvents.length ? (
        <div className="card">
          <p className="m-0 text-sm text-gray-600">No upcoming events yet. Start one and I will open chat threads automatically.</p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Link to="/events/create" className="btn-primary no-underline">Start New Event</Link>
            <Link to="/imc-composer" className="btn-secondary no-underline">Open IMC Composer</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {upcomingEvents.map((event) => (
            <div key={event.id} className="card flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm m-0">{event.title || 'Untitled event'}</p>
                <p className="text-xs text-gray-500 m-0 mt-1">
                  {formatEventStart(event)} · {event.venue || 'Venue TBD'}
                  {event.performanceZoneName ? ` · ${event.performanceZoneName}` : ''}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap text-xs">
                <Link
                  to={`/events/${event.id}?opsTab=messaging`}
                  className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 no-underline bg-white"
                >
                  Open Chat
                </Link>
                <Link
                  to={`/events/${event.id}`}
                  className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 no-underline bg-white"
                >
                  Event Detail
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
