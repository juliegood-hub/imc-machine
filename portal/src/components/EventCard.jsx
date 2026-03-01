import { parseLocalDate } from '../lib/dateUtils';
import { Link } from 'react-router-dom';
import CircleAvatar from './CircleAvatar';

export default function EventCard({ event }) {
  const date = parseLocalDate(event.date);
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Link to={`/events/${event.id}`} className="card block no-underline text-[#0d1b2a] hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <CircleAvatar
            entity={event}
            type="event"
            name={event.title}
            size="w-10 h-10"
            textSize="text-xs"
            className="shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <h3 className="text-lg m-0 truncate">{event.title}</h3>
            <p className="text-sm text-gray-500 mt-1 mb-0">{event.genre}</p>
            {event.performanceZoneName && (
              <p className="text-xs text-gray-500 mt-1 mb-0">Zone: {event.performanceZoneName}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-[#c8a45e] bg-[#c8a45e1a] px-2 py-1 rounded">{formatted}</div>
        </div>
      </div>
      {event.description && <p className="text-sm text-gray-600 mt-2 mb-0 line-clamp-2">{event.description}</p>}
    </Link>
  );
}
