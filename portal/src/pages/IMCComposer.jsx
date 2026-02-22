import { parseLocalDate } from '../lib/dateUtils';
import { useState } from 'react';
import { useVenue } from '../context/VenueContext';
import ChannelToggle from '../components/ChannelToggle';
import GeneratedContent from '../components/GeneratedContent';

const CHANNELS = [
  { key: 'press', label: 'Press Release', icon: '📰' },
  { key: 'calendar', label: 'Calendar (Do210 / Current / Evvnt)', icon: '📅' },
  { key: 'email', label: 'Email', icon: '📧' },
  { key: 'sms', label: 'SMS', icon: '💬' },
  { key: 'social', label: 'Social (FB / IG / X / LinkedIn)', icon: '📱' },
];

export default function IMCComposer() {
  const { events, venue, updateEvent } = useVenue();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [channels, setChannels] = useState({ press: true, calendar: true, email: true, sms: true, social: true });
  const [generated, setGenerated] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generatingChannel, setGeneratingChannel] = useState('');
  const [images, setImages] = useState([]);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [distributed, setDistributed] = useState({});
  const [research, setResearch] = useState(null);
  const [researching, setResearching] = useState(false);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const activeChannels = CHANNELS.filter(c => channels[c.key]);

  // Build venue object from the event's own venue fields (not the logged-in user's profile)
  function getEventVenue(event) {
    if (!event) return venue; // fallback to profile venue
    const evtVenue = event.venue || venue?.name || '';
    const street = [event.venueStreetNumber, event.venueStreetName, event.venueSuite].filter(Boolean).join(' ');
    const addr = street || event.venueAddress || venue?.address || '';
    return {
      ...venue,
      name: evtVenue || venue?.name || '',
      address: addr,
      city: event.venueCity || venue?.city || 'San Antonio',
      state: event.venueState || venue?.state || 'TX',
      zip: event.venueZip || venue?.zip || '',
      phone: event.venuePhone || venue?.phone || '',
      website: event.venueWebsite || venue?.website || '',
    };
  }

  const handleGenerate = async () => {
    if (!selectedEvent) return;
    setGenerating(true);
    setGenerated({});
    setResearch(null);

    const activeKeys = CHANNELS.filter(c => channels[c.key]).map(c => c.key);
    const eventVenue = getEventVenue(selectedEvent);

    try {
      // Step 1: Research (optional, with timeout)
      setResearching(true);
      setGeneratingChannel('Researching context...');
      
      let researchBrief = null;
      try {
        const artists = selectedEvent.performers 
          ? selectedEvent.performers.split(',').map(a => a.trim())
          : [];
        
        const researchRes = await Promise.race([
          fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'research-context',
              event: selectedEvent,
              venue: getEventVenue(selectedEvent),
              artists: artists
            }),
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Research timeout')), 12000)),
        ]);
        
        if (researchRes.ok) {
          const researchData = await researchRes.json();
          if (researchData.success) {
            researchBrief = researchData.context;
            setResearch(researchBrief);
          }
        }
      } catch (resErr) {
        console.log('Research skipped:', resErr.message);
      }
      setResearching(false);

      // Step 2: Generate all content types
      const results = {};
      for (const channelKey of activeKeys) {
        setGeneratingChannel(`Generating ${channelKey}...`);
        
        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'generate-content',
              contentType: getContentType(channelKey),
              event: selectedEvent,
              venue: getEventVenue(selectedEvent),
              researchContext: formatResearchContext(researchBrief)
            }),
          });

          const data = await res.json();
          if (data.success && data.content) {
            results[channelKey] = data.content[getContentType(channelKey)] || data.content;
          } else {
            results[channelKey] = `[Error: ${data.error || 'Generation failed'}]`;
          }
        } catch (err) {
          results[channelKey] = `[Error generating ${channelKey}: ${err.message}]`;
        }
      }

      setGenerated(results);
      updateEvent(selectedEventId, { campaign: true });
    } catch (err) {
      console.error('Generation error:', err);
      alert('Error generating content: ' + err.message);
    } finally {
      setGenerating(false);
      setResearching(false);
      setGeneratingChannel('');
    }
  };

  // Map channel keys to content types
  function getContentType(channelKey) {
    const mapping = {
      'press': 'press_release',
      'calendar': 'event_listing',
      'email': 'email_blast',
      'sms': 'sms_blast',
      'social': 'social_post'
    };
    return mapping[channelKey] || channelKey;
  }

  // Format research context for prompt injection
  function formatResearchContext(research) {
    if (!research) return '';
    
    let context = '';
    if (research.culturalContext) context += `CULTURAL CONTEXT: ${research.culturalContext}\n`;
    if (research.mediaAngle) context += `MEDIA ANGLE: ${research.mediaAngle}\n`;
    if (research.pullQuote) context += `PULL QUOTE: "${research.pullQuote}"\n`;
    if (research.sanAntonioArtsScene) context += `SA ARTS SCENE: ${research.sanAntonioArtsScene}\n`;
    
    return context;
  }

  const [imagePreset, setImagePreset] = useState('essential');
  const [imageProgress, setImageProgress] = useState(null);

  const handleGenerateGraphics = async () => {
    if (!selectedEvent) return;
    setGeneratingImages(true);
    setImageProgress(null);

    try {
      // Generate event poster using the imagen service (proper GCM visual style + no-people rules)
      const { generateImage: genImg } = await import('../services/imagen.js');
      const imgResult = await genImg(selectedEvent, venue, 'poster_11x17');
      const data = imgResult.error
        ? { success: false, error: imgResult.error }
        : { success: true, ...imgResult };
      
      if (data.success && data.url) {
        setImages([{
          id: 1,
          url: data.url,
          label: `Event Poster · ${data.engine || 'AI'}`,
          engine: data.engine,
          formatKey: 'poster'
        }]);
      } else {
        throw new Error(data.error || 'Image generation failed');
      }
    } catch (err) {
      console.error('Image generation error:', err);
      alert('Error generating graphics: ' + err.message);
    } finally {
      setGeneratingImages(false);
      setImageProgress(null);
    }
  };

  const [podcast, setPodcast] = useState(null);
  const [generatingPodcast, setGeneratingPodcast] = useState(false);
  const [podcastProgress, setPodcastProgress] = useState(null);
  const [distributing, setDistributing] = useState(false);
  const [distributionResults, setDistributionResults] = useState(null);

  const handleDistribute = async (channelKey, text) => {
    setDistributed(prev => ({ ...prev, [channelKey]: 'sending' }));
    
    try {
      if (channelKey === 'press') {
        // Send press release via API
        const res = await fetch('/api/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-press-release',
            event: selectedEvent,
            venue: getEventVenue(selectedEvent),
            content: text || generated.press
          }),
        });

        const data = await res.json();
        if (data.success) {
          setDistributed(prev => ({ ...prev, [channelKey]: true }));
          setDistributionResults(prev => ({ ...prev, press: data.results }));
          alert(`📰 Press release SENT to ${data.sent} media contacts!\n\nSent from: events@goodcreativemedia.com\nRecipients: KSAT 12, KENS 5, TPR, Express-News, SA Current...`);
        } else {
          throw new Error(data.error);
        }
      } else if (channelKey === 'calendar') {
        // Submit to calendar platforms via API
        const res = await fetch('/api/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create-eventbrite',
            event: selectedEvent,
            venue: getEventVenue(selectedEvent)
          }),
        });

        const data = await res.json();
        if (data.success) {
          setDistributed(prev => ({ ...prev, [channelKey]: true }));
          setDistributionResults(prev => ({ ...prev, calendar: data }));
          alert(`📅 Calendar listing created!\n\n• Eventbrite: ${data.eventUrl || 'CREATED'}\n• Do210 & SA Current: Submit manually for now`);
        } else {
          throw new Error(data.error);
        }
      } else if (channelKey === 'social') {
        // Post to Facebook via API
        const res = await fetch('/api/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'post-facebook',
            event: selectedEvent,
            venue: getEventVenue(selectedEvent),
            content: { socialFacebook: text || generated.social }
          }),
        });

        const data = await res.json();
        setDistributed(prev => ({ ...prev, [channelKey]: true }));
        setDistributionResults(prev => ({ ...prev, social: data }));
        
        if (data.success) {
          const fbResult = data.event?.success ? 'Event created' : 'Post only';
          alert(`📱 Facebook: ${fbResult}\n\n• Instagram: Copy/paste (manual for now)\n• LinkedIn: Copy/paste (manual for now)`);
        } else {
          alert(`📱 Social ready for manual posting:\n\nContent: ${text || generated.social}`);
        }
      } else if (channelKey === 'email') {
        setDistributed(prev => ({ ...prev, [channelKey]: 'ready' }));
        alert('📧 Email copy is ready.\n\nTo send: Connect email service in Settings or copy/paste into your email tool.');
      } else if (channelKey === 'sms') {
        setDistributed(prev => ({ ...prev, [channelKey]: 'ready' }));
        alert('💬 SMS text is ready.\n\nTo send: Connect Twilio in Settings or send manually.');
      } else {
        setDistributed(prev => ({ ...prev, [channelKey]: true }));
      }
    } catch (err) {
      console.error('Distribution error:', err);
      alert(`Distribution error: ${err.message}`);
      setDistributed(prev => ({ ...prev, [channelKey]: false }));
    }
  };

  const handleDistributeAll = async () => {
    if (!selectedEvent) return;
    setDistributing(true);
    
    try {
      const results = {};
      const activeKeys = CHANNELS.filter(c => channels[c.key] && generated[c.key]).map(c => c.key);
      
      for (const channelKey of activeKeys) {
        try {
          await handleDistribute(channelKey, generated[channelKey]);
        } catch (err) {
          console.error(`Distribution failed for ${channelKey}:`, err);
        }
      }
      
      alert(`🚀 Distribution initiated for ${activeKeys.length} channels!\n\nCheck individual channel status above.`);
    } catch (err) {
      console.error('Distribution error:', err);
      alert('Distribution error: ' + err.message);
    } finally {
      setDistributing(false);
    }
  };
// Removed complex tracking for now - focus on core functionality

  const handleContentEdit = (channelKey, newContent) => {
    setGenerated(prev => ({ ...prev, [channelKey]: newContent }));
  };

  // Generate all at once
  const handleGenerateAll = async () => {
    const activeKeys = CHANNELS.filter(c => channels[c.key]).map(c => c.key);
    if (activeKeys.length === 0) return;

    setGenerating(true);
    setGenerated({});
    
    try {
      setGeneratingChannel('Generating all content...');
      
      const results = {};
      for (const channelKey of activeKeys) {
        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'generate-content',
              contentType: getContentType(channelKey),
              event: selectedEvent,
              venue: getEventVenue(selectedEvent)
            }),
          });

          const data = await res.json();
          if (data.success && data.content) {
            results[channelKey] = data.content[getContentType(channelKey)] || Object.values(data.content)[0] || data.content;
          } else {
            results[channelKey] = `[Error: ${data.error || 'Generation failed'}]`;
          }
        } catch (err) {
          results[channelKey] = `[Error: ${err.message}]`;
        }
      }

      setGenerated(results);
    } catch (err) {
      console.error('Generation error:', err);
      alert('Error generating content: ' + err.message);
    } finally {
      setGenerating(false);
      setGeneratingChannel('');
    }
  };

  // Regenerate individual content type
  const handleRegenerate = async (channelKey) => {
    setGeneratingChannel(`Regenerating ${channelKey}...`);
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-content',
          contentType: getContentType(channelKey),
          event: selectedEvent,
          venue: getEventVenue(selectedEvent)
        }),
      });

      const data = await res.json();
      if (data.success && data.content) {
        const newContent = data.content[getContentType(channelKey)] || Object.values(data.content)[0] || data.content;
        setGenerated(prev => ({ ...prev, [channelKey]: newContent }));
      } else {
        alert(`Error regenerating ${channelKey}: ${data.error || 'Generation failed'}`);
      }
    } catch (err) {
      console.error('Regeneration error:', err);
      alert(`Error regenerating ${channelKey}: ${err.message}`);
    } finally {
      setGeneratingChannel('');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl mb-1">🎯 IMC Composer</h1>
          <p className="text-gray-500 m-0">AI-powered press releases, social posts, calendar listings & graphics</p>
        </div>
        <a href="#" onClick={e => { e.preventDefault(); alert('Google Drive integration coming soon!'); }}
          className="text-sm text-[#c8a45e] font-semibold no-underline hover:underline">
          📁 View assets in Drive →
        </a>
      </div>

      {/* Event Selector */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
        <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); setGenerated({}); setImages([]); setDistributed({}); }}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
          <option value="">Choose an event...</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.title} · {parseLocalDate(e.date).toLocaleDateString()}</option>)}
        </select>
        {events.length === 0 && <p className="text-xs text-gray-400 mt-2">No events yet. <a href="/events/create" className="text-[#c8a45e]">Create one first →</a></p>}
      </div>

      {selectedEvent && (
        <>
          {/* Event Summary Card */}
          <div className="card mb-6 bg-gradient-to-r from-[#0d1b2a] to-[#1b3a5c] text-white">
            <h3 className="text-lg mb-1">{selectedEvent.title}</h3>
            <p className="text-sm opacity-80 m-0">
              {selectedEvent.genre} • {parseLocalDate(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {selectedEvent.time}
            </p>
            {selectedEvent.description && <p className="text-sm opacity-70 mt-2 m-0">{selectedEvent.description}</p>}
          </div>

          {/* Channel Toggles */}
          <div className="card mb-6">
            <h3 className="text-lg mb-3">Distribution Channels</h3>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(c => (
                <ChannelToggle key={c.key} label={c.label} icon={c.icon} enabled={channels[c.key]}
                  onToggle={() => setChannels({ ...channels, [c.key]: !channels[c.key] })} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              📰 Press → KSAT, KENS5, TPR, Express-News, SA Current, SA Report &nbsp;|&nbsp;
              📅 Calendar → Do210, SA Current, Evvnt (→ Express-News/MySA) &nbsp;|&nbsp;
              📱 Social → FB, IG, X, LinkedIn
            </p>
          </div>

          {/* Generate Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button onClick={handleGenerateAll} disabled={generating || activeChannels.length === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {generating ? (
                <><span className="animate-spin inline-block">⟳</span> {generatingChannel || 'Generating...'}</>
              ) : (
                '✨ Generate All Content'
              )}
            </button>
            <div className="flex items-center gap-2">
              <select value={imagePreset} onChange={e => setImagePreset(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="essential">Essential (7 formats)</option>
                <option value="social_only">Social Only (7)</option>
                <option value="eventbrite_only">Eventbrite (3)</option>
                <option value="full">All Platforms</option>
              </select>
              <button onClick={handleGenerateGraphics} disabled={generatingImages || !selectedEvent}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50">
                {generatingImages ? (
                  <><span className="animate-spin inline-block">⟳</span> {imageProgress ? `${imageProgress.current}/${imageProgress.total}: ${imageProgress.label}` : 'Creating graphics...'}</>
                ) : (
                  '🎨 Generate Graphics'
                )}
              </button>
            </div>
          </div>

          {/* Generated Content */}
          {Object.keys(generated).length > 0 && (
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg">✅ Generated Content</h3>
                <button onClick={handleDistributeAll} disabled={distributing} className="btn-primary text-sm disabled:opacity-50">
                  {distributing ? '⏳ Distributing...' : '🚀 Distribute All'}
                </button>
              </div>
              {activeChannels.map(c => (
                generated[c.key] && (
                  <GeneratedContent
                    key={c.key}
                    channel={c.label}
                    channelKey={c.key}
                    icon={c.icon}
                    content={generated[c.key]}
                    onDistribute={handleDistribute}
                    onEdit={handleContentEdit}
                    onRegenerate={handleRegenerate}
                    distributed={distributed[c.key]}
                    generating={generatingChannel === `Regenerating ${c.key}...`}
                  />
                )
              ))}
            </div>
          )}

          {/* Generated Images */}
          {images.length > 0 && (
            <div className="card">
              <h3 className="text-lg mb-4">🎨 Generated Graphics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {images.map(img => (
                  <div key={img.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {img.url ? (
                      <a href={img.url} target="_blank" rel="noopener noreferrer">
                        <img src={img.url} alt={img.label} className="w-full h-48 object-cover" />
                      </a>
                    ) : (
                      <div className="bg-gradient-to-br from-[#0d1b2a] to-[#1b3a5c] h-48 flex items-center justify-center text-white text-sm p-4 text-center">
                        {img.error || '🖼️ Generating...'}
                      </div>
                    )}
                    <div className="p-3 text-xs text-gray-500 flex items-center justify-between">
                      <span>{img.label}</span>
                      {img.url && (
                        <a href={img.url} download className="text-[#c8a45e] font-semibold no-underline hover:underline">
                          ⬇ Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
{/* Podcast generation temporarily disabled - coming soon */}

{/* Research brief temporarily disabled - focus on core generation */}

          {/* Distribution Results */}
          {distributionResults && (
            <div className="card mt-6 border-l-4 border-green-500">
              <h3 className="text-lg mb-3">📊 Distribution Results</h3>
              {distributionResults.press && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-700">📰 Press Release : {distributionResults.press.count || distributionResults.press.length} contacts</p>
                  <div className="text-xs text-gray-500 ml-4 mt-1">
                    {(distributionResults.press.contacts || distributionResults.press).slice(0, 8).map((r, i) => (
                      <p key={i} className="m-0">{r.status === 'sent' ? '✅' : r.status === 'queued' ? '📤' : '❌'} {r.contact} ({r.email})</p>
                    ))}
                    {(distributionResults.press.contacts || distributionResults.press).length > 8 && (
                      <p className="m-0 text-gray-400">...and {(distributionResults.press.contacts || distributionResults.press).length - 8} more</p>
                    )}
                  </div>
                </div>
              )}
              {distributionResults.calendar && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-700">📅 Calendar Submissions</p>
                  <div className="text-xs text-gray-500 ml-4 mt-1">
                    <p className="m-0">📤 Do210 → {distributionResults.calendar.do210?.to || 'events@do210.com'}</p>
                    <p className="m-0">📤 SA Current → {distributionResults.calendar.current?.to || 'calendar@sacurrent.com'}</p>
                    <p className="m-0">⏳ Evvnt → {distributionResults.calendar.evvnt?.notes || 'Pending API setup'}</p>
                  </div>
                </div>
              )}
              {distributionResults.eventbrite && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-700">🎟️ Eventbrite</p>
                  <div className="text-xs text-gray-500 ml-4 mt-1">
                    {distributionResults.eventbrite.success ? (
                      <p className="m-0">✅ <a href={distributionResults.eventbrite.url} target="_blank" className="text-[#c8a45e]">{distributionResults.eventbrite.url}</a></p>
                    ) : (
                      <p className="m-0">⚠️ {distributionResults.eventbrite.error}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Media Distribution Info */}
          <div className="card mt-6 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">📋 Media Distribution</h4>
            <p className="text-xs text-gray-600">
              Press releases are automatically sent to 17 SA media contacts including KSAT 12, KENS 5, TPR, 
              Express-News, SA Current, SA Report, and more. Calendar listings go to Do210, SA Current, and Eventbrite.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
