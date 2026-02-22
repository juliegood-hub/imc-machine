import { parseLocalDate } from '../lib/dateUtils';
import { useState } from 'react';
import { useVenue } from '../context/VenueContext';
import { upsertCampaign } from '../lib/supabase';
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

  // Track distribution results in campaigns table
  async function trackCampaign(channel, status, externalUrl, extra = {}) {
    if (!selectedEventId) return;
    try {
      await upsertCampaign({
        event_id: selectedEventId,
        channel,
        status,
        external_url: externalUrl || null,
        sent_at: status === 'sent' || status === 'published' || status === 'created' ? new Date().toISOString() : null,
        recipients: extra.recipients || null,
        error_message: extra.error || null,
      });
    } catch (err) {
      console.warn(`[Campaign Track] ${channel}:`, err.message);
    }
  }

  function parseSocialContent(socialText) {
    if (!socialText) return {};
    const sections = {};
    const regex = /(?:^|\n)\s*(?:\*{1,2}|#{1,3}\s*)?(?:(\d+)\.\s*)?(?:\*{0,2})(Facebook|Instagram(?:\s+Caption)?|LinkedIn|Twitter(?:\/X)?)\s*(?:\*{0,2})\s*:?\s*\n/gi;
    let lastPlatform = null;
    let lastIndex = 0;
    const matches = [...socialText.matchAll(regex)];
    matches.forEach((match) => {
      if (lastPlatform) {
        sections[lastPlatform] = socialText.substring(lastIndex, match.index).trim();
      }
      const name = match[2].toLowerCase();
      lastPlatform = name.includes('facebook') ? 'facebook'
        : name.includes('instagram') ? 'instagram'
        : name.includes('linkedin') ? 'linkedin'
        : name.includes('twitter') ? 'twitter' : null;
      lastIndex = match.index + match[0].length;
    });
    if (lastPlatform) {
      sections[lastPlatform] = socialText.substring(lastIndex).trim();
    }
    return sections;
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
  const [updatingImages, setUpdatingImages] = useState(false);

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
          trackCampaign('press', 'sent', null, { recipients: data.sent });
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
          trackCampaign('eventbrite', 'created', data.eventUrl);
        } else {
          throw new Error(data.error);
        }
      } else if (channelKey === 'social') {
        const parsed = parseSocialContent(text || generated.social);
        const results = {};
        const errors = [];
        const eventVenue = getEventVenue(selectedEvent);

        try {
          const fbRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post-facebook',
              event: selectedEvent,
              venue: eventVenue,
              content: { socialFacebook: parsed.facebook || text || generated.social },
              images: images?.length ? { fb_post_landscape: images[0]?.url, fb_event_banner: images[0]?.url } : undefined
            }),
          });
          results.facebook = await fbRes.json();
        } catch (err) { errors.push(`Facebook: ${err.message}`); results.facebook = { success: false, error: err.message }; }

        await new Promise(r => setTimeout(r, 500));

        if (images?.length && images[0]?.url && !images[0]?.url.startsWith('data:')) {
          try {
            const igRes = await fetch('/api/distribute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'post-instagram',
                event: selectedEvent,
                venue: eventVenue,
                content: { instagramCaption: parsed.instagram || '' },
                images: { ig_post_square: images[0]?.url, ig_post_portrait: images[0]?.url }
              }),
            });
            results.instagram = await igRes.json();
          } catch (err) { errors.push(`Instagram: ${err.message}`); results.instagram = { success: false, error: err.message }; }
        } else {
          results.instagram = { success: false, error: 'No public image URL. Generate graphics first.' };
        }

        await new Promise(r => setTimeout(r, 500));

        try {
          const liRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post-linkedin',
              event: selectedEvent,
              venue: eventVenue,
              content: { linkedinPost: parsed.linkedin || parsed.facebook || text || generated.social },
              images: images?.length ? { linkedin_post: images[0]?.url } : undefined
            }),
          });
          results.linkedin = await liRes.json();
        } catch (err) { errors.push(`LinkedIn: ${err.message}`); results.linkedin = { success: false, error: err.message }; }

        await new Promise(r => setTimeout(r, 500));

        try {
          const twRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post-twitter',
              event: selectedEvent,
              content: { twitterPost: parsed.twitter || '' }
            }),
          });
          results.twitter = await twRes.json();
        } catch (err) { errors.push(`Twitter: ${err.message}`); results.twitter = { success: false, error: err.message }; }

        try {
          const calRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'submit-calendars',
              event: selectedEvent,
              venue: eventVenue,
              content: { calendarListing: generated.calendar || '' }
            }),
          });
          results.calendars = await calRes.json();
        } catch (err) { results.calendars = { success: false, error: err.message }; }

        setDistributed(prev => ({ ...prev, [channelKey]: true }));
        setDistributionResults(prev => ({ ...prev, social: results }));

        const summary = [
          results.facebook?.success ? '✅ Facebook: Posted' : `⚠️ Facebook: ${results.facebook?.error || 'Not connected'}`,
          results.instagram?.success ? '✅ Instagram: Posted' : `⚠️ Instagram: ${results.instagram?.error || 'Not connected'}`,
          results.linkedin?.success ? '✅ LinkedIn: Posted' : `⚠️ LinkedIn: ${results.linkedin?.error || 'Not connected'}`,
          results.twitter?.success ? '✅ Twitter/X: Tweeted' : `⚠️ Twitter/X: ${results.twitter?.error || 'Not connected'}`,
          results.calendars?.success ? '✅ Calendars: Queued' : `⚠️ Calendars: ${results.calendars?.error || 'Not connected'}`,
        ].join('\n');
        alert(`📱 Social Distribution:\n\n${summary}`);

        // Track each social platform
        if (results.facebook?.success) trackCampaign('social_facebook', 'published', results.facebook.event?.eventUrl || results.facebook.feedPost?.postId ? `https://facebook.com/${results.facebook.feedPost.postId}` : null);
        else trackCampaign('social_facebook', 'failed', null, { error: results.facebook?.error });
        if (results.instagram?.success) trackCampaign('social_instagram', 'published', null);
        else trackCampaign('social_instagram', 'failed', null, { error: results.instagram?.error });
        if (results.linkedin?.success) trackCampaign('social_linkedin', 'published', results.linkedin.postUrl);
        else trackCampaign('social_linkedin', 'failed', null, { error: results.linkedin?.error });
        if (results.twitter?.success) trackCampaign('social_twitter', 'published', results.twitter.tweetUrl);
        if (results.calendars?.success) trackCampaign('calendar_do210', 'queued', null);
      } else if (channelKey === 'email') {
        const eventVenue = getEventVenue(selectedEvent);
        try {
          const res = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send-email-blast',
              event: selectedEvent,
              venue: eventVenue,
              content: text || generated.email
            }),
          });
          const data = await res.json();
          if (data.success) {
            setDistributed(prev => ({ ...prev, [channelKey]: true }));
            alert(`📧 Email blast sent to ${data.sent} subscribers!`);
          trackCampaign('email_campaign', 'sent', null, { recipients: data.sent });
          } else {
            throw new Error(data.error);
          }
        } catch (err) {
          alert(`📧 Email error: ${err.message}`);
          setDistributed(prev => ({ ...prev, [channelKey]: false }));
        }
      } else if (channelKey === 'sms') {
        try {
          const res = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send-sms',
              event: selectedEvent,
              content: { smsText: text || generated.sms }
            }),
          });
          const data = await res.json();
          if (data.success) {
            setDistributed(prev => ({ ...prev, [channelKey]: true }));
            alert(`💬 SMS sent to ${data.sent} recipients!`);
          trackCampaign('sms_blast', 'sent', null, { recipients: data.sent });
          } else {
            alert(`💬 SMS: ${data.error}`);
            setDistributed(prev => ({ ...prev, [channelKey]: 'ready' }));
          }
        } catch (err) {
          alert(`💬 SMS error: ${err.message}`);
          setDistributed(prev => ({ ...prev, [channelKey]: false }));
        }
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

  // Push generated graphics to already-distributed platforms
  const handleUpdatePlatformImages = async () => {
    if (!selectedEvent || images.length === 0) return;
    setUpdatingImages(true);
    const eventVenue = getEventVenue(selectedEvent);
    const publicImage = images.find(img => img.url && !img.url.startsWith('data:'));
    if (!publicImage) {
      alert('⚠️ No publicly accessible image found. Images must be uploaded to get a public URL first.');
      setUpdatingImages(false);
      return;
    }

    const results = [];
    try {
      // Update Facebook event cover
      const fbRes = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-platform-images',
          event: selectedEvent,
          venue: eventVenue,
          images: {
            fb_event_banner: publicImage.url,
            fb_post_landscape: publicImage.url,
            ig_post_square: publicImage.url,
            linkedin_post: publicImage.url,
            eventbrite_banner: publicImage.url,
          },
          distributionResults: distributionResults
        }),
      });
      const data = await fbRes.json();
      if (data.success) {
        const updated = data.results.filter(r => r.success).map(r => r.platform);
        const failed = data.results.filter(r => !r.success).map(r => `${r.platform}: ${r.error}`);
        alert(`🎨 Platform Images Updated!\n\n${updated.length ? '✅ ' + updated.join(', ') : ''}${failed.length ? '\n⚠️ ' + failed.join('\n⚠️ ') : ''}`);
      } else {
        alert(`⚠️ Image update error: ${data.error}`);
      }
    } catch (err) {
      alert(`⚠️ Image update error: ${err.message}`);
    }
    setUpdatingImages(false);
  };

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
                <button onClick={handleDistributeAll} disabled={distributing || images.length === 0} className="btn-primary text-sm disabled:opacity-50" title={images.length === 0 ? 'Generate graphics first so images are included in posts' : ''}>
                  {distributing ? '⏳ Distributing...' : images.length === 0 ? '🚀 Distribute All (generate graphics first)' : '🚀 Distribute All'}
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg m-0">🎨 Generated Graphics</h3>
                {Object.keys(distributed).length > 0 && images.some(img => img.url && !img.url.startsWith('data:')) && (
                  <button onClick={handleUpdatePlatformImages} disabled={updatingImages}
                    className="btn-secondary text-xs disabled:opacity-50">
                    {updatingImages ? '⏳ Updating...' : '🔄 Push Images to Platforms'}
                  </button>
                )}
              </div>
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
              {distributionResults.social && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <p className="font-semibold text-gray-700 m-0">📱 Social Distribution</p>
                  {distributionResults.social.facebook && (
                    <p className="m-0 ml-2">{distributionResults.social.facebook.success ? '✅' : '⚠️'} Facebook: {distributionResults.social.facebook.success ? `Posted${distributionResults.social.facebook.event?.eventUrl ? ` · ${distributionResults.social.facebook.event.eventUrl}` : ''}` : distributionResults.social.facebook.error || 'Not connected'}</p>
                  )}
                  {distributionResults.social.instagram && (
                    <p className="m-0 ml-2">{distributionResults.social.instagram.success ? '✅' : '⚠️'} Instagram: {distributionResults.social.instagram.success ? 'Posted' : distributionResults.social.instagram.error || 'Not connected'}</p>
                  )}
                  {distributionResults.social.linkedin && (
                    <p className="m-0 ml-2">{distributionResults.social.linkedin.success ? '✅' : '⚠️'} LinkedIn: {distributionResults.social.linkedin.success ? `Posted${distributionResults.social.linkedin.postUrl ? ` · ${distributionResults.social.linkedin.postUrl}` : ''}` : distributionResults.social.linkedin.error || 'Not connected'}</p>
                  )}
                  {distributionResults.social.twitter && (
                    <p className="m-0 ml-2">{distributionResults.social.twitter.success ? '✅' : '⚠️'} Twitter/X: {distributionResults.social.twitter.success ? `Tweeted${distributionResults.social.twitter.tweetUrl ? ` · ${distributionResults.social.twitter.tweetUrl}` : ''}` : distributionResults.social.twitter.error || 'Not connected'}</p>
                  )}
                  {distributionResults.social.calendars && (
                    <p className="m-0 ml-2">{distributionResults.social.calendars.success ? '✅' : '⚠️'} Do210/SA Current/Evvnt: {distributionResults.social.calendars.success ? distributionResults.social.calendars.message : distributionResults.social.calendars.error || 'Not connected'}</p>
                  )}
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
