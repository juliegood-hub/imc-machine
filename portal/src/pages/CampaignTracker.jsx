import { parseLocalDate } from '../lib/dateUtils';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVenue } from '../context/VenueContext';
import { getAllCampaigns, getEventCampaigns, upsertCampaign } from '../lib/supabase';

const CHANNEL_META = {
  press:              { icon: '📰', label: 'Press Release' },
  calendar_do210:     { icon: '📅', label: 'Do210' },
  calendar_sacurrent: { icon: '📅', label: 'SA Current' },
  calendar_evvnt:     { icon: '📅', label: 'Evvnt' },
  eventbrite:         { icon: '🎟️', label: 'Eventbrite' },
  social_facebook:    { icon: '📱', label: 'Facebook' },
  social_instagram:   { icon: '📸', label: 'Instagram' },
  social_linkedin:    { icon: '💼', label: 'LinkedIn' },
  email_campaign:     { icon: '📧', label: 'Email' },
  sms_blast:          { icon: '💬', label: 'SMS' },
  graphics_poster:    { icon: '🎨', label: 'Poster' },
  graphics_social:    { icon: '🎨', label: 'Social Banner' },
  graphics_story:     { icon: '🎨', label: 'IG Story' },
  press_page:         { icon: '🌐', label: 'Press Page' },
  bilingual:          { icon: '🇲🇽', label: 'Spanish' },
};

function StatusBadge({ status }) {
  const styles = {
    sent: 'bg-green-100 text-green-700',
    published: 'bg-green-100 text-green-700',
    created: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    queued: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    error: 'bg-red-100 text-red-700',
  };
  const emojis = { sent: '✅', published: '✅', created: '✅', pending: '⏳', queued: '📤', failed: '❌', error: '❌' };

  if (!status) return <span className="text-xs text-gray-400">⬜ Not started</span>;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {emojis[status] || '⬜'} {status}
    </span>
  );
}

function ChannelRow({ channelKey, data }) {
  const meta = CHANNEL_META[channelKey] || { icon: '📦', label: channelKey };
  const url = data?.external_url;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 px-3 text-sm">{meta.icon} {meta.label}</td>
      <td className="py-2 px-3"><StatusBadge status={data?.status} /></td>
      <td className="py-2 px-3 text-xs text-gray-500">
        {data?.sent_at ? new Date(data.sent_at).toLocaleString() : 
         data?.created_at ? new Date(data.created_at).toLocaleString() : '—'}
      </td>
      <td className="py-2 px-3 text-xs">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#c8a45e] hover:underline">
            🔗 View →
          </a>
        ) : '—'}
      </td>
      <td className="py-2 px-3 text-xs text-gray-400">
        {data?.recipients ? `${data.recipients} recipients` : ''}
        {data?.error_message ? `⚠️ ${data.error_message}` : ''}
      </td>
    </tr>
  );
}

// Helper functions for Supabase data
function calculateCompletionPercentage(campaigns) {
  if (campaigns.length === 0) return 0;
  const completed = campaigns.filter(c => ['sent', 'published', 'created'].includes(c.status)).length;
  return Math.round((completed / campaigns.length) * 100);
}

function getStatusCount(campaigns, statuses) {
  return campaigns.filter(c => statuses.includes(c.status || 'not_started')).length;
}

function getUniqueCampaigns(campaigns) {
  const seen = new Set();
  return campaigns.filter(c => {
    if (seen.has(c.event_id)) return false;
    seen.add(c.event_id);
    return true;
  });
}

function getEventCampaignCount(eventId, campaigns) {
  return campaigns.filter(c => c.event_id === eventId).length;
}

function ProgressRing({ pct }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444';

  return (
    <svg width="90" height="90" className="transform -rotate-90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x="45" y="50" textAnchor="middle" className="transform rotate-90 origin-center"
        style={{ fontSize: '1.1rem', fontWeight: 700, fill: '#1a1a1a' }}>{pct}%</text>
    </svg>
  );
}

export default function CampaignTracker() {
  const { user } = useAuth();
  const { events, venue } = useVenue();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadCampaigns();
    }
  }, [user?.id]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await getAllCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedCampaign = selectedEventId 
    ? campaigns.filter(c => c.event_id === selectedEventId) 
    : [];

  const handleExportCSV = () => {
    if (!selectedEventId) return;
    // Build CSV from selectedCampaign data
    const csv = buildCampaignCSV(selectedCampaign);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-${selectedEventId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildCampaignCSV = (campaigns) => {
    const headers = ['Channel', 'Status', 'Sent At', 'External URL', 'Recipients', 'Error'];
    const rows = campaigns.map(c => [
      CHANNEL_META[c.channel]?.label || c.channel,
      c.status,
      c.sent_at || '',
      c.external_url || '',
      c.recipients || '',
      c.error_message || ''
    ]);
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-4xl animate-spin mb-4">⟳</div>
          <p className="text-gray-500">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl mb-1">📊 Campaign Tracker</h1>
          <p className="text-gray-500 m-0">Track every IMC channel per event: status, links, completion</p>
        </div>
        {selectedEventId && (
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="btn-secondary text-sm">⬇ Export CSV</button>
            <button onClick={() => alert('Google Sheets sync coming soon!')} className="btn-secondary text-sm">📊 Sync to Sheets</button>
          </div>
        )}
      </div>

      {/* Event Selector */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Campaign</label>
        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
          <option value="">Choose an event campaign...</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>
              {event.title} · {parseLocalDate(event.date).toLocaleDateString()}
              {campaigns.some(c => c.event_id === event.id) ? ' ✅' : ' ⚪'}
            </option>
          ))}
        </select>
      </div>

      {selectedCampaign.length > 0 ? (
        <>
          {/* Summary Card */}
          <div className="card mb-6 flex flex-wrap items-center gap-6">
            <ProgressRing pct={calculateCompletionPercentage(selectedCampaign)} />
            <div className="flex-1">
              <h2 className="text-xl mb-1">{selectedEvent?.title}</h2>
              <p className="text-sm text-gray-500 m-0">
                {selectedEvent?.venue_name || venue?.name} · {parseLocalDate(selectedEvent?.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-green-600">✅ {getStatusCount(selectedCampaign, ['sent', 'published', 'created'])} done</span>
                <span className="text-yellow-600">⏳ {getStatusCount(selectedCampaign, ['pending', 'queued'])} pending</span>
                <span className="text-red-600">❌ {getStatusCount(selectedCampaign, ['failed', 'error'])} failed</span>
                <span className="text-gray-400">⬜ {getStatusCount(selectedCampaign, ['not_started'])} not started</span>
              </div>
            </div>
          </div>

          {/* Channel Table */}
          <div className="card">
            <h3 className="text-lg mb-4">Distribution Channels</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-xs text-gray-500 uppercase">
                    <th className="py-2 px-3">Channel</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">When</th>
                    <th className="py-2 px-3">Link</th>
                    <th className="py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCampaign.map(campaign => (
                    <ChannelRow key={campaign.id} channelKey={campaign.channel} data={campaign} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg">📊</p>
          <p className="text-gray-500 mt-2">
            {selectedEventId ? 'No campaigns found for this event' : 'Select a campaign to view distribution status'}
          </p>
          <p className="text-gray-400 text-sm mt-1">Campaigns are created when you generate and distribute content in the IMC Composer</p>
        </div>
      )}

      {/* All Campaigns Overview */}
      {campaigns.length > 0 && (
        <div className="card mt-6">
          <h3 className="text-lg mb-4">Recent Campaigns</h3>
          <div className="space-y-3">
            {getUniqueCampaigns(campaigns).slice(0, 10).map(campaign => (
              <div key={campaign.event_id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedEventId(campaign.event_id)}>
                <div>
                  <p className="text-sm font-semibold m-0">{campaign.events?.title || 'Unknown Event'}</p>
                  <p className="text-xs text-gray-500 m-0">
                    {campaign.events?.venue_name || venue?.name} · {campaign.events?.date ? parseLocalDate(campaign.events.date).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs">
                    <span className="text-gray-600">{getEventCampaignCount(campaign.event_id, campaigns)} channels</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(campaign.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
