import { parseLocalDate } from '../lib/dateUtils';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVenue } from '../context/VenueContext';
import EventCard from '../components/EventCard';
import CompletionBar from '../components/CompletionBar';
import { isVenueRole } from '../constants/clientTypes';

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
  const { venue, events, loading, listCompletionTasks, updateCompletionTask } = useVenue();
  const [completionTasks, setCompletionTasks] = useState([]);

  useEffect(() => {
    let mounted = true;
    const loadTasks = async () => {
      if (!user?.id || typeof listCompletionTasks !== 'function') return;
      try {
        const tasks = await listCompletionTasks({ includeCompleted: false });
        if (mounted) setCompletionTasks(tasks.slice(0, 5));
      } catch {
        if (mounted) setCompletionTasks([]);
      }
    };
    loadTasks();
    return () => {
      mounted = false;
    };
  }, [listCompletionTasks, user?.id]);

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
          <Link to={!isVenueRole(user?.clientType || '') ? '/artist-setup' : '/venue-setup'} 
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
          <div className="text-sm text-gray-500 mt-1">Events on your board</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[#c8a45e]">{upcoming.length}</div>
          <div className="text-sm text-gray-500 mt-1">Upcoming on the calendar</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-[#c8a45e]">
            {nextShow ? new Date(nextShow.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </div>
          <div className="text-sm text-gray-500 mt-1">Next live date</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Link to="/events/create" className="card no-underline text-[#0d1b2a] hover:shadow-md transition-shadow text-center">
          <div className="text-2xl mb-2">🎪</div>
          <div className="font-semibold">Start New Event</div>
        </Link>
        <Link to="/imc-composer" className="card no-underline text-[#0d1b2a] hover:shadow-md transition-shadow text-center">
          <div className="text-2xl mb-2">✨</div>
          <div className="font-semibold">IMC Composer</div>
        </Link>
        <a href="#" className="card no-underline text-[#0d1b2a] hover:shadow-md transition-shadow text-center"
          onClick={e => { e.preventDefault(); alert('Google Drive is almost ready here. I will bring it online next.'); }}>
          <div className="text-2xl mb-2">📁</div>
          <div className="font-semibold">Open Drive Folder</div>
        </a>
      </div>

      {completionTasks.length > 0 && (
        <div className="card mb-6 border border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-amber-900 m-0">Finish These Items</p>
            <span className="text-xs text-amber-800">{completionTasks.length} open</span>
          </div>
          <div className="space-y-2">
            {completionTasks.map((task) => (
              <div key={task.id} className="flex items-start justify-between gap-2 text-xs border border-amber-200 rounded bg-white p-2">
                <div>
                  <p className="m-0 font-semibold text-gray-800">{task.title || 'Completion task'}</p>
                  <p className="m-0 text-gray-500">
                    {task.entity_type || 'entity'}
                    {Array.isArray(task.missing_fields_json) && task.missing_fields_json.length
                      ? ` · Missing: ${task.missing_fields_json.join(', ')}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-[11px] px-2 py-1 border border-emerald-300 text-emerald-700 rounded bg-white"
                  onClick={async () => {
                    try {
                      if (typeof updateCompletionTask !== 'function') return;
                      await updateCompletionTask(task.id, { status: 'complete' });
                      setCompletionTasks(prev => prev.filter((row) => row.id !== task.id));
                    } catch {
                      // keep task visible on failure
                    }
                  }}
                >
                  Mark Done
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Events */}
      <h2 className="text-xl mb-4">Recent Activity</h2>
      {events.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          <p className="text-lg mb-2">No events yet, but that's about to change.</p>
          <Link to="/events/create" className="text-[#c8a45e] font-semibold no-underline">Start your first event →</Link>
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
