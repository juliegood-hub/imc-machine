import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useVenue } from '../context/VenueContext';
import { getEventCampaigns, deleteEvent } from '../lib/supabase';
import { parseLocalDate } from '../lib/dateUtils';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { events, updateEvent } = useVenue();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const event = events.find(e => e.id === id);

  useEffect(() => {
    if (event) {
      loadCampaigns();
    }
  }, [event?.id]);

  const loadCampaigns = async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const campaignData = await getEventCampaigns(event.id);
      setCampaigns(campaignData);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    setDeleting(true);
    try {
      await deleteEvent(event.id);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete event:', err);
      alert('Failed to delete event: ' + err.message);
      setDeleting(false);
    }
  };

  if (!event) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl mb-4">Event Not Found</h2>
        <Link to="/" className="text-[#c8a45e] hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const date = parseLocalDate(event.date);
  const hasCampaigns = campaigns.length > 0;
  const activeCampaigns = campaigns.filter(c => c.status === 'sent' || c.status === 'published' || c.status === 'created');
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending' || c.status === 'queued');
  const failedCampaigns = campaigns.filter(c => c.status === 'failed' || c.status === 'error');

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Link to="/" className="text-sm text-gray-500 hover:text-[#c8a45e] no-underline mb-4 block">
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <h1 className="text-3xl mb-2">{event.title}</h1>
            <div className="flex flex-wrap gap-2 mb-3">
              {event.genre && (
                <span className="inline-block text-xs font-semibold text-[#c8a45e] bg-[#c8a45e1a] px-3 py-1 rounded-full">
                  {event.genre}
                </span>
              )}
              {event.campaign && (
                <span className="inline-block text-xs font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                  Campaign Active
                </span>
              )}
              {event.driveEventFolderId && (
                <a
                  href={`https://drive.google.com/drive/folders/${event.driveEventFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full hover:bg-blue-200 no-underline"
                >
                  📁 Open in Google Drive
                </a>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-[#c8a45e]">
              {date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </div>
            {event.time && (
              <div className="text-sm text-gray-600">
                {new Date(`1970-01-01T${event.time}`).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit' 
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="card mb-6">
          <h3 className="text-lg mb-3">Description</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
        </div>
      )}

      {/* Event Details */}
      <div className="card mb-6">
        <h3 className="text-lg mb-4">Event Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div>
              <span className="text-gray-500 block mb-1">Venue</span>
              <span className="font-medium">{event.venue || '—'}</span>
            </div>
            {event.venueAddress && (
              <div>
                <span className="text-gray-500 block mb-1">Address</span>
                <span className="font-medium">{event.venueAddress}</span>
              </div>
            )}
            {event.performers && (
              <div>
                <span className="text-gray-500 block mb-1">Performers</span>
                <span className="font-medium">{event.performers}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {event.ticketLink && (
              <div>
                <span className="text-gray-500 block mb-1">Tickets</span>
                <a href={event.ticketLink} target="_blank" rel="noopener noreferrer" 
                   className="text-[#c8a45e] hover:underline">
                  View Tickets →
                </a>
                {event.ticketPrice && (
                  <span className="block text-gray-600">{event.ticketPrice}</span>
                )}
              </div>
            )}
            {event.venueWebsite && (
              <div>
                <span className="text-gray-500 block mb-1">Venue Website</span>
                <a href={event.venueWebsite} target="_blank" rel="noopener noreferrer"
                   className="text-[#c8a45e] hover:underline">
                  Visit Website →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Status */}
      {hasCampaigns && (
        <div className="card mb-6">
          <h3 className="text-lg mb-4">Campaign Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{activeCampaigns.length}</div>
              <div className="text-sm text-green-700">Active</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{pendingCampaigns.length}</div>
              <div className="text-sm text-yellow-700">Pending</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{failedCampaigns.length}</div>
              <div className="text-sm text-red-700">Failed</div>
            </div>
          </div>
          
          {campaigns.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 mb-2">Campaign Details</h4>
              {campaigns.map(campaign => (
                <div key={campaign.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded text-sm">
                  <div className="flex items-center gap-3">
                    <span className="capitalize font-medium">{campaign.channel.replace(/_/g, ' ')}</span>
                    {campaign.external_url && (
                      <a href={campaign.external_url} target="_blank" rel="noopener noreferrer"
                         className="text-[#c8a45e] hover:underline">
                        View →
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${{
                      'sent': 'bg-green-100 text-green-700',
                      'published': 'bg-green-100 text-green-700',
                      'created': 'bg-green-100 text-green-700',
                      'pending': 'bg-yellow-100 text-yellow-700',
                      'queued': 'bg-yellow-100 text-yellow-700',
                      'failed': 'bg-red-100 text-red-700',
                      'error': 'bg-red-100 text-red-700',
                    }[campaign.status] || 'bg-gray-100 text-gray-700'}`}>
                      {campaign.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Crew & Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Crew */}
        {event.crew && event.crew.length > 0 && (
          <div className="card">
            <h3 className="text-lg mb-3">Crew</h3>
            <div className="space-y-2">
              {event.crew.map((member, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-[#c8a45e] text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {member.name?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div>
                    <div className="font-medium">{member.name || 'Crew Member'}</div>
                    {member.role && (
                      <div className="text-gray-500">{member.role}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channels */}
        {event.channels && Object.keys(event.channels).length > 0 && (
          <div className="card">
            <h3 className="text-lg mb-3">Distribution Channels</h3>
            <div className="space-y-2">
              {Object.entries(event.channels).filter(([key, enabled]) => enabled).map(([channel]) => (
                <div key={channel} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="capitalize">{channel.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link 
          to={`/events/create?edit=${event.id}`}
          className="btn-secondary no-underline"
        >
          ✏️ Edit Event
        </Link>
        <Link 
          to={`/imc-composer?eventId=${event.id}`}
          className="btn-primary no-underline"
        >
          ✨ Generate Content
        </Link>
        <Link 
          to={`/run-of-show?eventId=${event.id}`}
          className="btn-secondary no-underline"
        >
          📋 Run of Show
        </Link>
        <Link 
          to={`/media?eventId=${event.id}`}
          className="btn-secondary no-underline"
        >
          🖼️ Media Gallery
        </Link>
        <Link 
          to={`/press-page/${event.id}`}
          className="btn-secondary no-underline"
        >
          📰 Press Page
        </Link>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200 bg-red-50">
        <h3 className="text-lg mb-3 text-red-700">Danger Zone</h3>
        <p className="text-sm text-red-600 mb-4">
          This action cannot be undone. This will permanently delete the event and all associated campaigns.
        </p>
        <button 
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete Event'}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-3">Delete Event</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{event.title}"? This action cannot be undone and will also delete:
            </p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1">
              <li>• All generated content</li>
              <li>• All generated images</li>
              <li>• All campaign data</li>
              <li>• Run of show data</li>
            </ul>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}