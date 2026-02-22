import { parseLocalDate } from '../lib/dateUtils';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVenue } from '../context/VenueContext';
import EventCard from '../components/EventCard';
import CompletionBar from '../components/CompletionBar';

const VENUE_FIELDS = ['name', 'logo', 'address', 'city', 'state', 'zip', 'brandPrimary', 'brandSecondary', 'website'];
const SOCIAL_FIELDS = ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'spotify', 'linkedin'];
const EVENT_FIELDS = ['title', 'date', 'time', 'genre', 'description', 'venue', 'ticketLink'];

function countVenueCompletion(venue) {
  let c = VENUE_FIELDS.filter(f => (venue[f] || '').toString().trim()).length;
  if (SOCIAL_FIELDS.some(f => (venue[f] || '').toString().trim())) c++;
  return { completed: c, total: VENUE_FIELDS.length + 1 };
}

function countEventCompletion(event) {
  const c = EVENT_FIELDS.filter(f => (event[f] || '').toString().trim()).length;
  return { completed: c, total: EVENT_FIELDS.length };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { venue, events, loading } = useVenue();

  if (loading) return (
    <div className="p-4 md:p-8 max-w-5xl flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="text-4xl animate-spin mb-4">⟳</div>
        <p className="text-gray-500">Getting everything ready for you...</p>
      </div>
    </div>
  );

  const sortedEvents = [...events].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
  const upcoming = sortedEvents.filter(e => parseLocalDate(e.date) >= new Date());
  const nextShow = upcoming[0];
  const recentEvents = [...events].sort((a, b) => parseLocalDate(b.created_at || b.date) - parseLocalDate(a.created_at || a.date)).slice(0, 6);

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      {/* Welcome */}
      <div className="card mb-6 bg-gradient-to-r from-[#0d1b2a] to-[#1b3a5c] text-white">
        <h1 className="text-2xl md:text-3xl mb-1">
          {venue.name ? `Hey, ${venue.name}. Let's make some noise.` : `Hey, ${user?.name || 'friend'}! Welcome in.`}
        </h1>
        <p className="text-gray-300 text-sm m-0">
          {venue.name ? 'Your marketing command center is right here. What are we working on today?' : 'First things first: let\'s set up your profile so we can start getting the word out.'}
        </p>
        {!venue.name && (
          <Link to={user?.clientType && ['artist','dj','vendor','promoter','manager','booking_agent','producer'].includes(user.clientType) ? '/artist-setup' : '/venue-setup'} 
            className="btn-primary inline-block mt-4 no-underline">Set Up Profile →</Link>
        )}
      </div>

      {/* Venue Completion */}
      {venue.name && (
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-600 mb-1">Profile</div>
          <CompletionBar {...countVenueCompletion(venue)} mini />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-3xl font-bold text-[#c8a45e]">{events.length}</div>
          <div className="text-sm text-gray-500 mt-1">Total Events</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[#c8a45e]">{upcoming.length}</div>
          <div className="text-sm text-gray-500 mt-1">Upcoming Shows</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[#c8a45e]">
            {nextShow ? new Date(nextShow.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </div>
          <div className="text-sm text-gray-500 mt-1">Next Show</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Link to="/events/create" className="card no-underline text-[#0d1b2a] hover:shadow-md transition-shadow text-center">
          <div className="text-2xl mb-2">🎪</div>
          <div className="font-semibold">Create Event</div>
        </Link>
        <Link to="/imc-composer" className="card no-underline text-[#0d1b2a] hover:shadow-md transition-shadow text-center">
          <div className="text-2xl mb-2">✨</div>
          <div className="font-semibold">IMC Composer</div>
        </Link>
        <a href="#" className="card no-underline text-[#0d1b2a] hover:shadow-md transition-shadow text-center"
          onClick={e => { e.preventDefault(); alert('Google Drive integration coming soon!'); }}>
          <div className="text-2xl mb-2">📁</div>
          <div className="font-semibold">View Drive Folder</div>
        </a>
      </div>

      {/* Recent Events */}
      <h2 className="text-xl mb-4">Recent Events</h2>
      {events.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          <p className="text-lg mb-2">No events yet, but that's about to change.</p>
          <Link to="/events/create" className="text-[#c8a45e] font-semibold no-underline">Create your first event →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentEvents.map(event => (
            <div key={event.id}>
              <EventCard event={event} />
              <div className="px-4 pb-3 -mt-2">
                <CompletionBar {...countEventCompletion(event)} mini />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
