import { parseLocalDate } from '../lib/dateUtils';
import { useEffect, useState } from 'react';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import { upsertCampaign } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import ChannelToggle from '../components/ChannelToggle';
import GeneratedContent from '../components/GeneratedContent';
import FacebookEventWizard from '../components/FacebookEventWizard';
import SACurrentWizard from '../components/SACurrentWizard';

const CHANNELS = [
  { key: 'press', label: 'Press Release', icon: '📰' },
  { key: 'calendar', label: 'Calendar (Do210 / TPR / Evvnt / SA Current)', icon: '📅' },
  { key: 'email', label: 'Email', icon: '📧' },
  { key: 'sms', label: 'SMS', icon: '💬' },
  { key: 'social', label: 'Social (FB / IG / X / LinkedIn)', icon: '📱' },
  { key: 'video', label: 'Video (FB Reels / IG Reel+Story / YouTube / LinkedIn)', icon: '🎬' },
];

export default function IMCComposer() {
  const { events, venue, updateEvent } = useVenue();
  const { user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [channels, setChannels] = useState({ press: true, calendar: true, email: true, sms: true, social: true, video: true });
  const [generated, setGenerated] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generatingChannel, setGeneratingChannel] = useState('');
  const [images, setImages] = useState([]);
  const [videoAsset, setVideoAsset] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoVariantJobId, setVideoVariantJobId] = useState('');
  const [videoVariantJob, setVideoVariantJob] = useState(null);
  const [videoVariants, setVideoVariants] = useState(null);
  const [queuingVariants, setQueuingVariants] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [distributed, setDistributed] = useState({});
  const [research, setResearch] = useState(null);
  const [researching, setResearching] = useState(false);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const activeChannels = CHANNELS.filter(c => channels[c.key]);

  // Load previously generated content when event changes
  useEffect(() => {
    if (!selectedEventId) return;
    (async () => {
      try {
        const { data } = await supabase.from('generated_content')
          .select('content_type, content')
          .eq('event_id', selectedEventId);
        if (data?.length) {
          const saved = {};
          data.forEach(row => { saved[row.content_type] = row.content; });
          setGenerated(saved);
        } else {
          setGenerated({});
        }
      } catch (e) { console.warn('Could not load saved content:', e); }
    })();
  }, [selectedEventId]);

  useEffect(() => {
    if (!videoVariantJobId) return;
    let stopped = false;
    let timer = null;

    const poll = async () => {
      try {
        const res = await fetch('/api/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-video-variant-job', jobId: videoVariantJobId }),
        });
        const data = await res.json();
        if (!stopped && data.success && data.job) {
          setVideoVariantJob(data.job);
          setVideoVariants(data.job.outputs || null);
          if (['pending', 'processing'].includes(data.job.status)) {
            timer = setTimeout(poll, 5000);
            return;
          }
        }
      } catch (err) {
        if (!stopped) {
          timer = setTimeout(poll, 7000);
          return;
        }
      }
      timer = null;
    };

    poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [videoVariantJobId]);

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

  function cleanText(value) {
    return String(value || '').trim();
  }

  function normalizeEventDate(value) {
    const raw = cleanText(value);
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : raw;
  }

  function buildQrCodeImageUrl(value, size = 320) {
    const url = cleanText(value);
    if (!/^https?:\/\//i.test(url)) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(url)}`;
  }

  function pickFirstValidUrl(...values) {
    for (const value of values.flat()) {
      const candidate = cleanText(value);
      if (!candidate) continue;
      if (/^https?:\/\//i.test(candidate)) return candidate;
    }
    return '';
  }

  function buildDistributionPayload(event) {
    const eventVenue = getEventVenue(event);
    const ticketLink = pickFirstValidUrl(
      event?.ticketLink,
      event?.ticket_link,
      event?.registrationLink,
      event?.rsvpLink,
      event?.signupLink,
      event?.eventUrl,
      event?.url,
      eventVenue?.website,
      event?.venueWebsite
    );

    const normalizedEvent = {
      ...event,
      title: cleanText(event?.title),
      description: cleanText(event?.description),
      date: normalizeEventDate(event?.date),
      time: cleanText(event?.time),
      endTime: cleanText(event?.endTime),
      venue: cleanText(eventVenue?.name || event?.venue),
      venueAddress: cleanText(eventVenue?.address || event?.venueAddress),
      venueCity: cleanText(eventVenue?.city || event?.venueCity),
      venueState: cleanText(eventVenue?.state || event?.venueState),
      venueZip: cleanText(eventVenue?.zip || event?.venueZip),
      venueWebsite: cleanText(eventVenue?.website || event?.venueWebsite),
      ticketLink,
    };

    const normalizedVenue = {
      ...eventVenue,
      name: normalizedEvent.venue,
      address: normalizedEvent.venueAddress,
      city: normalizedEvent.venueCity,
      state: normalizedEvent.venueState,
      zip: normalizedEvent.venueZip,
      website: normalizedEvent.venueWebsite,
    };

    return { event: normalizedEvent, venue: normalizedVenue, ctaLink: ticketLink };
  }

  function getEventCompleteness(payload) {
    const event = payload?.event || {};
    const venueData = payload?.venue || {};
    const missing = [];

    if (!cleanText(event.title)) missing.push('title');
    if (!cleanText(event.date)) missing.push('date');
    if (!cleanText(event.time)) missing.push('start time');
    if (!cleanText(event.venue || venueData.name)) missing.push('venue name');
    if (!cleanText(event.venueCity || venueData.city)) missing.push('venue city');
    if (!cleanText(event.venueState || venueData.state)) missing.push('venue state');
    if (!cleanText(payload?.ctaLink)) missing.push('CTA link (ticket/RSVP/registration URL)');

    return {
      ready: missing.length === 0,
      missing,
    };
  }

  // Track distribution results in campaigns table
  async function trackCampaign(channel, status, externalUrl, extra = {}) {
    if (!selectedEventId) return false;
    try {
      await upsertCampaign({
        event_id: selectedEventId,
        channel,
        status,
        external_url: externalUrl || null,
        external_id: extra.externalId || null,
        sent_at: status === 'sent' || status === 'published' || status === 'created' ? new Date().toISOString() : null,
        recipients: extra.recipients || null,
        error_message: extra.error || null,
        metadata: extra.metadata || {},
      });
      return true;
    } catch (err) {
      console.warn(`[Campaign Track] ${channel}:`, err.message);
      return false;
    }
  }

  function extractFacebookEventId(url) {
    const candidate = cleanText(url);
    if (!candidate) return null;
    const match = candidate.match(/facebook\.com\/events\/(?:[^/?#]+\/)*(\d+)/i);
    if (match) return match[1];
    const queryMatch = candidate.match(/[?&](?:event_id|eid)=(\d+)/i);
    if (queryMatch) return queryMatch[1];
    const pathTailMatch = candidate.match(/\/(\d{8,})(?:[/?#]|$)/);
    if (pathTailMatch) return pathTailMatch[1];
    return null;
  }

  function isFacebookEventUrl(url) {
    const candidate = cleanText(url);
    if (!/^https?:\/\/(?:www\.)?facebook\.com\/events\//i.test(candidate)) return false;
    return !!extractFacebookEventId(candidate);
  }

  async function handleSaveFacebookEventUrl(rawUrl) {
    const url = cleanText(rawUrl);
    if (!isFacebookEventUrl(url)) {
      return { success: false, error: 'Drop in the full Facebook Event URL, like https://www.facebook.com/events/123456789' };
    }

    const eventId = extractFacebookEventId(url);
    const saved = await trackCampaign('facebook_event', 'created', url, {
      externalId: eventId,
      metadata: {
        source: 'manual',
        saved_at: new Date().toISOString(),
      },
    });
    if (!saved) return { success: false, error: 'I could not save that Facebook Event URL yet. Try once more.' };

    setDistributionResults((prev) => ({
      ...prev,
      social: {
        ...(prev?.social || {}),
        facebook: {
          ...(prev?.social?.facebook || {}),
          event: {
            success: true,
            source: 'manual',
            manual: true,
            eventId,
            eventUrl: url,
          },
        },
      },
    }));
    return { success: true, eventId, eventUrl: url };
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

  function parseVideoContent(videoText) {
    if (!videoText) return {};
    const sections = {};
    const regex = /(?:^|\n)\s*(?:\*{1,2}|#{1,3}\s*)?(?:\d+\.\s*)?(?:\*{0,2})(Facebook Reel Caption|Instagram Reel Caption|Instagram Story Overlay Text|LinkedIn Video Post|YouTube Title|YouTube Description|YouTube Tags)(?:\*{0,2})\s*:?\s*\n/gi;
    let lastKey = null;
    let lastIndex = 0;
    const matches = [...videoText.matchAll(regex)];
    const mapKey = (name) => {
      const n = name.toLowerCase();
      if (n.includes('facebook')) return 'facebookReelCaption';
      if (n.includes('instagram reel')) return 'instagramReelCaption';
      if (n.includes('instagram story')) return 'instagramStoryOverlayText';
      if (n.includes('linkedin')) return 'linkedinVideoPost';
      if (n.includes('youtube title')) return 'youtubeTitle';
      if (n.includes('youtube description')) return 'youtubeDescription';
      if (n.includes('youtube tags')) return 'youtubeTags';
      return null;
    };
    matches.forEach((match) => {
      if (lastKey) {
        sections[lastKey] = videoText.substring(lastIndex, match.index).trim();
      }
      lastKey = mapKey(match[1] || '');
      lastIndex = match.index + match[0].length;
    });
    if (lastKey) {
      sections[lastKey] = videoText.substring(lastIndex).trim();
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
      setGeneratingChannel('Researching the context...');
      
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
          new Promise((_, reject) => setTimeout(() => reject(new Error('Research timed out')), 12000)),
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
        setGeneratingChannel(`Writing ${channelKey}...`);
        
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
            results[channelKey] = `[I hit a snag: ${data.error || 'Generation did not finish this round.'}]`;
          }
        } catch (err) {
          results[channelKey] = `[I hit a snag writing ${channelKey}: ${err.message}]`;
        }
      }

      setGenerated(results);
      updateEvent(selectedEventId, { campaign: true });

      // Persist generated content to Supabase (delete old, insert new)
      for (const [key, content] of Object.entries(results)) {
        try {
          await supabase.from('generated_content')
            .delete()
            .eq('event_id', selectedEventId)
            .eq('content_type', key);
          await supabase.from('generated_content').insert({
            event_id: selectedEventId,
            content_type: key,
            content: content,
          });
        } catch (e) { console.warn('Could not save generated content:', e); }
      }
    } catch (err) {
      console.error('Generation error:', err);
      alert('Hmm. I hit a snag generating that content: ' + err.message);
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
      'social': 'social_post',
      'video': 'video_social_post',
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
        throw new Error(data.error || 'Image generation did not finish this round.');
      }
    } catch (err) {
      console.error('Image generation error:', err);
      alert('Hmm. I hit a snag generating graphics: ' + err.message);
    } finally {
      setGeneratingImages(false);
      setImageProgress(null);
    }
  };

  const queueVideoVariants = async (asset, silent = false) => {
    if (!selectedEvent || !asset?.url) return;
    setQueuingVariants(true);
    try {
      const res = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'queue-video-variants',
          event: selectedEvent,
          video: {
            url: asset.url,
            path: asset.path,
            duration: asset.duration,
            width: asset.width,
            height: asset.height,
            size: asset.size,
            mimeType: asset.type,
            name: asset.name,
          },
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Variant queue did not complete.');
      setVideoVariantJobId(data.job.id);
      setVideoVariantJob(data.job);
      setVideoVariants(data.job.outputs || null);
      if (!silent) alert('🎬 Perfect. I queued the video variants: 9:16, 1:1, and 16:9.');
    } catch (err) {
      if (!silent) alert(`⚠️ I could not queue video variants yet: ${err.message}`);
    } finally {
      setQueuingVariants(false);
    }
  };

  const readVideoMetadata = (file) => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const meta = {
        duration: Number(el.duration || 0),
        width: Number(el.videoWidth || 0),
        height: Number(el.videoHeight || 0),
      };
      URL.revokeObjectURL(objectUrl);
      resolve(meta);
    };
    el.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('I could not read that video metadata.'));
    };
    el.src = objectUrl;
  });

  const handleVideoUpload = async (file) => {
    if (!file) return;
    setUploadingVideo(true);
    setVideoVariantJobId('');
    setVideoVariantJob(null);
    setVideoVariants(null);
    try {
      const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
      if (!allowed.includes(file.type)) {
        throw new Error('That format is not supported yet. Upload MP4, MOV, M4V, or WEBM.');
      }

      const meta = await readVideoMetadata(file);
      const roundedDuration = Math.round(meta.duration);
      if (roundedDuration > 65) {
        throw new Error('That video is too long. Keep uploads at 15s, 30s, or 60s.');
      }
      if (![15, 30, 60].includes(roundedDuration)) {
        alert(`⚠️ Your video is ${roundedDuration}s. Best results are 15s, 30s, or 60s.`);
      }

      const prepRes = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-upload-url',
          filename: file.name,
          contentType: file.type,
          folder: 'videos',
        }),
      });
      const prepData = await prepRes.json();
      if (!prepData.success) throw new Error(prepData.error || 'I could not prepare the upload yet.');

      const { error: uploadErr } = await supabase.storage
        .from(prepData.bucket || 'media')
        .uploadToSignedUrl(prepData.path, prepData.token, file);
      if (uploadErr) throw new Error(uploadErr.message);

      const uploadedAsset = {
        name: file.name,
        size: file.size,
        type: file.type,
        url: prepData.publicUrl,
        path: prepData.path,
        duration: roundedDuration,
        width: meta.width,
        height: meta.height,
      };
      setVideoAsset(uploadedAsset);

      // Auto-queue transcode variants in background (9:16, 1:1, 16:9).
      await queueVideoVariants(uploadedAsset, true);
    } catch (err) {
      alert(`🎬 I hit a snag uploading that video: ${err.message}`);
    } finally {
      setUploadingVideo(false);
    }
  };

  const [podcast, setPodcast] = useState(null);
  const [generatingPodcast, setGeneratingPodcast] = useState(false);
  const [podcastProgress, setPodcastProgress] = useState(null);
  const [distributing, setDistributing] = useState(false);
  const [distributionResults, setDistributionResults] = useState(null);
  const [updatingImages, setUpdatingImages] = useState(false);

  const handleDistribute = async (channelKey, text, preparedPayload = null) => {
    if (!selectedEvent) return;
    setDistributed(prev => ({ ...prev, [channelKey]: 'sending' }));

    const payload = preparedPayload || buildDistributionPayload(selectedEvent);
    const readiness = getEventCompleteness(payload);
    if (!readiness.ready) {
      const list = readiness.missing.map((item) => `• ${item}`).join('\n');
      alert(`Before I distribute, I need a few details:\n\n${list}`);
      setDistributed(prev => ({ ...prev, [channelKey]: false }));
      return;
    }

    const distributionEvent = payload.event;
    const distributionVenue = payload.venue;
    
    try {
      if (channelKey === 'press') {
        // Send press release via API
        const res = await fetch('/api/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-press-release',
            event: distributionEvent,
            venue: distributionVenue,
            content: text || generated.press
          }),
        });

        const data = await res.json();
        if (data.success) {
          setDistributed(prev => ({ ...prev, [channelKey]: true }));
          setDistributionResults(prev => ({ ...prev, press: data.results }));
          alert(`📰 Beautiful. I sent the press release to ${data.sent} media contacts.\n\nFrom: events@goodcreativemedia.com\nIncludes: KSAT 12, KENS 5, TPR, Express-News, SA Current, and more.`);
          trackCampaign('press', 'sent', null, { recipients: data.sent });
        } else {
          throw new Error(data.error);
        }
      } else if (channelKey === 'calendar') {
        // Submit to Eventbrite with full description + banner image
        const bannerImage = images?.length ? images[0]?.url : null;
        const res = await fetch('/api/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create-eventbrite',
            event: distributionEvent,
            venue: distributionVenue,
            options: {
              description: generated.press || null,
              bannerImage,
            }
          }),
        });

        const data = await res.json();
        if (data.success) {
          setDistributed(prev => ({ ...prev, [channelKey]: true }));
          setDistributionResults(prev => ({ ...prev, calendar: data }));
          alert(`📅 Nice. Your calendar distribution is moving.\n\n• Eventbrite: ${data.eventUrl || 'Created'}${data.logoUrl ? ' (banner included)' : ''}\n• Do210 + TPR: queued automatically\n• SA Current + Evvnt: use the wizards below`);
          trackCampaign('eventbrite', 'created', data.eventUrl);
        } else {
          throw new Error(data.error);
        }
      } else if (channelKey === 'social') {
        const parsed = parseSocialContent(text || generated.social);
        const results = {};
        const errors = [];

        try {
          const fbRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post-facebook',
              event: distributionEvent,
              venue: distributionVenue,
              content: { socialFacebook: parsed.facebook || text || generated.social },
              images: images?.length ? { fb_post_landscape: images[0]?.url, fb_event_banner: images[0]?.url } : undefined
            }),
          });
          results.facebook = await fbRes.json();
        } catch (err) { errors.push(`Facebook: ${err.message}`); results.facebook = { success: false, error: err.message }; }

        await new Promise(r => setTimeout(r, 500));

        if (images?.length && images[0]?.url) {
          try {
            // Server-side auto-uploads base64/data URLs to Supabase Storage for Instagram
            const igRes = await fetch('/api/distribute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'post-instagram',
                event: distributionEvent,
                venue: distributionVenue,
                content: { instagramCaption: parsed.instagram || '' },
                images: { ig_post_square: images[0]?.url, ig_post_portrait: images[0]?.url }
              }),
            });
            results.instagram = await igRes.json();
          } catch (err) { errors.push(`Instagram: ${err.message}`); results.instagram = { success: false, error: err.message }; }
        } else {
          results.instagram = { success: false, error: 'I need an image first. Generate graphics, then I can post to Instagram.' };
        }

        await new Promise(r => setTimeout(r, 500));

        try {
          const liRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post-linkedin',
              event: distributionEvent,
              venue: distributionVenue,
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
              event: distributionEvent,
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
              event: distributionEvent,
              venue: distributionVenue,
              content: { calendarListing: generated.calendar || '' }
            }),
          });
          results.calendars = await calRes.json();
        } catch (err) { results.calendars = { success: false, error: err.message }; }

        setDistributed(prev => ({ ...prev, [channelKey]: true }));
        setDistributionResults(prev => ({ ...prev, social: results }));

        const fbEvent = results.facebook?.event || null;
        const fbFeed = results.facebook?.feedPost || null;
        const fbEventCreated = !!fbEvent?.success;
        const fbEventId = fbEvent?.eventId || results.facebook?.event_id || null;
        const fbEventUrl = fbEvent?.eventUrl || results.facebook?.event_url || null;
        const fbFeedUrl = fbFeed?.postUrl || (fbFeed?.postId ? `https://facebook.com/${fbFeed.postId}` : null);
        const fbEventFailure = fbEvent?.error || results.facebook?.fallback?.reason || results.facebook?.error || 'Not created';

        const summary = [
          fbEventCreated ? `✅ Facebook Event: Created${fbEventUrl ? ` · ${fbEventUrl}` : ''}` : `⚠️ Facebook Event: ${fbEventFailure}`,
          fbFeed?.success ? `✅ Facebook Feed: Posted${fbFeedUrl ? ` · ${fbFeedUrl}` : ''}` : `⚠️ Facebook Feed: ${fbFeed?.error || 'Not posted'}`,
          results.instagram?.success ? '✅ Instagram: Posted' : `⚠️ Instagram: ${results.instagram?.error || 'Not connected'}`,
          results.linkedin?.success ? '✅ LinkedIn: Posted' : `⚠️ LinkedIn: ${results.linkedin?.error || 'Not connected'}`,
          results.twitter?.success ? '✅ Twitter/X: Tweeted' : `⚠️ Twitter/X: ${results.twitter?.error || 'Not connected'}`,
          results.calendars?.success ? '✅ Calendars: Queued' : `⚠️ Calendars: ${results.calendars?.error || 'Not connected'}`,
        ].join('\n');
        alert(`📱 Social Distribution:\n\n${summary}`);

        // Track each social platform
        if (fbEventCreated) {
          trackCampaign('facebook_event', 'created', fbEventUrl, {
            externalId: fbEventId,
            metadata: {
              source: fbEvent?.source || 'graph_api',
              reused: !!fbEvent?.reused,
              mode: results.facebook?.mode || null,
            },
          });
        } else {
          trackCampaign('facebook_event', 'failed', null, {
            error: fbEventFailure,
            metadata: {
              mode: results.facebook?.mode || null,
              fallback: results.facebook?.fallback || null,
            },
          });
        }
        if (fbFeed?.success) {
          trackCampaign('social_facebook', 'published', fbFeedUrl, {
            externalId: fbFeed?.postId || results.facebook?.post_id || null,
            metadata: {
              mode: results.facebook?.mode || null,
              fallbackTriggered: !!results.facebook?.fallback?.triggered,
            },
          });
        } else {
          trackCampaign('social_facebook', 'failed', null, {
            error: fbFeed?.error || results.facebook?.error,
            metadata: { mode: results.facebook?.mode || null },
          });
        }
        if (results.instagram?.success) trackCampaign('social_instagram', 'published', null);
        else trackCampaign('social_instagram', 'failed', null, { error: results.instagram?.error });
        if (results.linkedin?.success) trackCampaign('social_linkedin', 'published', results.linkedin.postUrl);
        else trackCampaign('social_linkedin', 'failed', null, { error: results.linkedin?.error });
        if (results.twitter?.success) trackCampaign('social_twitter', 'published', results.twitter.tweetUrl);
        if (results.calendars?.success) trackCampaign('calendar_do210', 'queued', null);
      } else if (channelKey === 'video') {
        if (!videoAsset?.url || !videoAsset.url.startsWith('https://')) {
          throw new Error('Upload a public HTTPS video first (15s, 30s, or 60s).');
        }
        const parsed = parseVideoContent(text || generated.video || '');
        const results = {};
        const verticalVariantUrl = videoVariants?.vertical_9_16?.url || videoAsset.url;
        const squareVariantUrl = videoVariants?.square_1_1?.url || videoAsset.url;
        const landscapeVariantUrl = videoVariants?.landscape_16_9?.url || videoAsset.url;
        const hasVerticalSource = !!(videoVariants?.vertical_9_16?.url || Number(videoAsset.height || 0) > Number(videoAsset.width || 0));
        const shouldYouTubeShort = Number(videoAsset.duration || 0) <= 60 && hasVerticalSource;

        const baseVideoPayload = {
          duration: videoAsset.duration,
          size: videoAsset.size,
          mimeType: videoAsset.type,
          name: videoAsset.name,
          path: videoAsset.path,
        };
        const buildVideoPayload = (url, width, height) => ({
          ...baseVideoPayload,
          url,
          width,
          height,
        });

        const fbVideoPayload = buildVideoPayload(
          verticalVariantUrl,
          verticalVariantUrl === videoAsset.url ? videoAsset.width : 1080,
          verticalVariantUrl === videoAsset.url ? videoAsset.height : 1920
        );
        const igVideoPayload = buildVideoPayload(
          verticalVariantUrl,
          verticalVariantUrl === videoAsset.url ? videoAsset.width : 1080,
          verticalVariantUrl === videoAsset.url ? videoAsset.height : 1920
        );
        const linkedinVideoPayload = buildVideoPayload(
          squareVariantUrl,
          squareVariantUrl === videoAsset.url ? videoAsset.width : 1080,
          squareVariantUrl === videoAsset.url ? videoAsset.height : 1080
        );
        const youtubeSourceUrl = shouldYouTubeShort ? verticalVariantUrl : landscapeVariantUrl;
        const youtubeVideoPayload = buildVideoPayload(
          youtubeSourceUrl,
          youtubeSourceUrl === videoAsset.url ? videoAsset.width : (shouldYouTubeShort ? 1080 : 1920),
          youtubeSourceUrl === videoAsset.url ? videoAsset.height : (shouldYouTubeShort ? 1920 : 1080)
        );

        try {
          const fbRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post-facebook-video',
              event: distributionEvent,
              venue: distributionVenue,
              video: fbVideoPayload,
              content: {
                facebookReelCaption: parsed.facebookReelCaption || parsed.instagramReelCaption || distributionEvent.title,
              },
            }),
          });
          results.facebook = await fbRes.json();
        } catch (err) { results.facebook = { success: false, error: err.message }; }

        await new Promise((r) => setTimeout(r, 500));

        try {
          const igRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post-instagram-video',
              event: distributionEvent,
              venue: distributionVenue,
              video: igVideoPayload,
              modes: ['reel', 'story'],
              content: {
                instagramReelCaption: parsed.instagramReelCaption || parsed.facebookReelCaption || '',
                instagramStoryOverlayText: parsed.instagramStoryOverlayText || '',
              },
            }),
          });
          results.instagram = await igRes.json();
        } catch (err) { results.instagram = { success: false, error: err.message }; }

        await new Promise((r) => setTimeout(r, 500));

        try {
          const liRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post-linkedin-video',
              event: distributionEvent,
              venue: distributionVenue,
              video: linkedinVideoPayload,
              content: {
                linkedinVideoPost: parsed.linkedinVideoPost || parsed.facebookReelCaption || distributionEvent.title,
              },
            }),
          });
          results.linkedin = await liRes.json();
        } catch (err) { results.linkedin = { success: false, error: err.message }; }

        await new Promise((r) => setTimeout(r, 500));

        try {
          const ytRes = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post-youtube-video',
              event: distributionEvent,
              venue: distributionVenue,
              video: youtubeVideoPayload,
              content: {
                youtubeTitle: parsed.youtubeTitle || distributionEvent.title,
                youtubeDescription: parsed.youtubeDescription || distributionEvent.description || '',
                youtubeTags: parsed.youtubeTags || '',
              },
            }),
          });
          results.youtube = await ytRes.json();
        } catch (err) { results.youtube = { success: false, error: err.message }; }

        setDistributed(prev => ({ ...prev, [channelKey]: true }));
        setDistributionResults(prev => ({ ...prev, video: results }));

        const summary = [
          results.facebook?.success ? `✅ Facebook: ${results.facebook.mode === 'reel' ? 'Reel posted' : 'Video posted'}` : `⚠️ Facebook: ${results.facebook?.error || 'Not connected'}`,
          results.instagram?.reel?.success || results.instagram?.story?.success ? `✅ Instagram: ${results.instagram?.reel?.success ? 'Reel' : ''}${results.instagram?.reel?.success && results.instagram?.story?.success ? ' + ' : ''}${results.instagram?.story?.success ? 'Story' : ''} posted` : `⚠️ Instagram: ${results.instagram?.error || results.instagram?.reel?.error || results.instagram?.story?.error || 'Not connected'}`,
          results.linkedin?.success ? '✅ LinkedIn: Video posted' : `⚠️ LinkedIn: ${results.linkedin?.error || 'Not connected'}`,
          results.youtube?.success ? `✅ YouTube: ${results.youtube?.isShort ? 'Short uploaded' : 'Video uploaded'}` : `⚠️ YouTube: ${results.youtube?.error || 'Not connected'}`,
        ].join('\n');
        alert(`🎬 Video Distribution:\n\n${summary}`);

        if (results.facebook?.success) trackCampaign('video_facebook_reels', 'published', results.facebook.reelUrl || results.facebook.videoUrl || null, { warning: results.facebook.warning });
        else trackCampaign('video_facebook_reels', 'failed', null, { error: results.facebook?.error });

        if (results.instagram?.reel?.success || results.instagram?.story?.success) trackCampaign('video_instagram', 'published', null);
        else trackCampaign('video_instagram', 'failed', null, { error: results.instagram?.error || results.instagram?.reel?.error || results.instagram?.story?.error });

        if (results.linkedin?.success) trackCampaign('video_linkedin', 'published', results.linkedin.postUrl || null);
        else trackCampaign('video_linkedin', 'failed', null, { error: results.linkedin?.error });

        if (results.youtube?.success) trackCampaign('video_youtube', 'published', results.youtube.videoUrl || null);
        else trackCampaign('video_youtube', 'failed', null, { error: results.youtube?.error });
      } else if (channelKey === 'email') {
        try {
          const res = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send-email-blast',
              event: distributionEvent,
              venue: distributionVenue,
              content: text || generated.email
            }),
          });
          const data = await res.json();
          if (data.success) {
            setDistributed(prev => ({ ...prev, [channelKey]: true }));
            alert(`📧 Perfect. I sent the email blast to ${data.sent} subscribers.`);
          trackCampaign('email_campaign', 'sent', null, { recipients: data.sent });
          } else {
            throw new Error(data.error);
          }
        } catch (err) {
          alert(`📧 I hit a snag with email: ${err.message}`);
          setDistributed(prev => ({ ...prev, [channelKey]: false }));
        }
      } else if (channelKey === 'sms') {
        try {
          const res = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send-sms',
              event: distributionEvent,
              content: { smsText: text || generated.sms }
            }),
          });
          const data = await res.json();
          if (data.success) {
            setDistributed(prev => ({ ...prev, [channelKey]: true }));
            alert(`💬 Done. I sent SMS to ${data.sent} recipients.`);
          trackCampaign('sms_blast', 'sent', null, { recipients: data.sent });
          } else {
            alert(`💬 SMS update: ${data.error}`);
            setDistributed(prev => ({ ...prev, [channelKey]: 'ready' }));
          }
        } catch (err) {
          alert(`💬 I hit a snag with SMS: ${err.message}`);
          setDistributed(prev => ({ ...prev, [channelKey]: false }));
        }
      } else {
        setDistributed(prev => ({ ...prev, [channelKey]: true }));
      }
    } catch (err) {
      console.error('Distribution error:', err);
      alert(`Hmm. Distribution hit a snag: ${err.message}`);
      setDistributed(prev => ({ ...prev, [channelKey]: false }));
    }
  };

  const handleDistributeAll = async () => {
    if (!selectedEvent) return;
    const payload = buildDistributionPayload(selectedEvent);
    const readiness = getEventCompleteness(payload);
    if (!readiness.ready) {
      const list = readiness.missing.map((item) => `• ${item}`).join('\n');
      alert(`Before I distribute everything, I need these details:\n\n${list}`);
      return;
    }

    setDistributing(true);
    
    try {
      const activeKeys = CHANNELS.filter(c => channels[c.key] && generated[c.key]).map(c => c.key);
      
      for (const channelKey of activeKeys) {
        try {
          await handleDistribute(channelKey, generated[channelKey], payload);
        } catch (err) {
          console.error(`Distribution failed for ${channelKey}:`, err);
        }
      }
      
      alert(`🚀 Perfect. I started distribution on ${activeKeys.length} channels.\n\nYou can review each channel status right above.`);

      // Send admin notification email with all distribution URLs
      try {
        await fetch('/api/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'notify-admin-distribution',
            event: payload.event,
            venue: payload.venue,
            distributionResults: distributionResults,
            channels: activeKeys,
            distributedBy: user?.email || user?.name || 'Unknown user',
          }),
        });
      } catch (notifyErr) {
        console.warn('Admin notification failed:', notifyErr.message);
      }
    } catch (err) {
      console.error('Distribution error:', err);
      alert('Hmm. I hit a snag distributing: ' + err.message);
    } finally {
      setDistributing(false);
    }
  };

  // Push generated graphics to already-distributed platforms
  const handleUpdatePlatformImages = async () => {
    if (!selectedEvent || images.length === 0) return;
    setUpdatingImages(true);
    const eventVenue = getEventVenue(selectedEvent);
    const publicImage = images.find(img => img.url && !img.url.startsWith('data:'));
    if (!publicImage) {
      alert('⚠️ I do not see a public image URL yet. Upload the image first, then I can push it to platforms.');
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
        alert(`🎨 Great. I pushed image updates.\n\n${updated.length ? '✅ ' + updated.join(', ') : ''}${failed.length ? '\n⚠️ ' + failed.join('\n⚠️ ') : ''}`);
      } else {
        alert(`⚠️ I hit a snag updating images: ${data.error}`);
      }
    } catch (err) {
      alert(`⚠️ I hit a snag updating images: ${err.message}`);
    }
    setUpdatingImages(false);
  };

  const handleContentEdit = (channelKey, newContent) => {
    setGenerated(prev => ({ ...prev, [channelKey]: newContent }));
    // Auto-save edit to Supabase
    if (selectedEventId) {
      supabase.from('generated_content').delete().eq('event_id', selectedEventId).eq('content_type', channelKey)
        .then(() => supabase.from('generated_content').insert({ event_id: selectedEventId, content_type: channelKey, content: newContent }))
        .catch(e => console.warn('Could not save edit:', e));
    }
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
            results[channelKey] = `[I hit a snag: ${data.error || 'Generation did not finish this round.'}]`;
          }
        } catch (err) {
          results[channelKey] = `[I hit a snag: ${err.message}]`;
        }
      }

      setGenerated(results);
    } catch (err) {
      console.error('Generation error:', err);
      alert('Hmm. I hit a snag generating content: ' + err.message);
    } finally {
      setGenerating(false);
      setGeneratingChannel('');
    }
  };

  // Regenerate individual content type
  const handleRegenerate = async (channelKey) => {
    setGeneratingChannel(`Rewriting ${channelKey}...`);
    
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
        alert(`I hit a snag rewriting ${channelKey}: ${data.error || 'Generation did not finish this round.'}`);
      }
    } catch (err) {
      console.error('Regeneration error:', err);
      alert(`I hit a snag rewriting ${channelKey}: ${err.message}`);
    } finally {
      setGeneratingChannel('');
    }
  };

  const videoDuration = Number(videoAsset?.duration || 0);
  const roundedVideoDuration = Math.round(videoDuration);
  const videoIsPublicHttps = !!(videoAsset?.url && videoAsset.url.startsWith('https://'));
  const videoIsDurationBucket = [15, 30, 60].includes(roundedVideoDuration);
  const videoIsShortDuration = videoDuration > 0 && videoDuration <= 60;
  const videoAspect = !videoAsset ? 'unknown' : (videoAsset.height > videoAsset.width ? 'vertical' : videoAsset.width > videoAsset.height ? 'landscape' : 'square');

  const hasVerticalVariant = !!videoVariants?.vertical_9_16?.url;
  const hasSquareVariant = !!videoVariants?.square_1_1?.url;
  const hasLandscapeVariant = !!videoVariants?.landscape_16_9?.url;
  const variantJobStatus = videoVariantJob?.status || (queuingVariants ? 'pending' : '');

  const fbReelReady = !!videoAsset && videoIsPublicHttps && videoIsShortDuration && (videoAspect === 'vertical' || hasVerticalVariant);
  const igReelReady = fbReelReady;
  const igStoryReady = fbReelReady;
  const linkedinVideoReady = !!videoAsset && videoIsPublicHttps && (hasSquareVariant || hasLandscapeVariant || videoAspect !== 'unknown');
  const youtubeShortReady = !!videoAsset && videoIsPublicHttps && videoIsShortDuration && (videoAspect === 'vertical' || hasVerticalVariant);
  const youtubeVideoReady = !!videoAsset && videoIsPublicHttps && (hasLandscapeVariant || videoAspect !== 'unknown');
  const youtubeTargetMode = youtubeShortReady ? 'Short' : 'Standard Video';

  const eventDistributionPayload = selectedEvent ? buildDistributionPayload(selectedEvent) : null;
  const eventCompleteness = eventDistributionPayload ? getEventCompleteness(eventDistributionPayload) : { ready: false, missing: [] };
  const missingEventFields = eventCompleteness?.missing || [];
  const eventReadyForDistribution = !!selectedEvent && eventCompleteness.ready;
  const facebookEventUrlForQr = cleanText(
    distributionResults?.social?.facebook?.event?.eventUrl
    || distributionResults?.social?.facebook?.event_url
    || ''
  );
  const facebookEventIdForQr = cleanText(
    distributionResults?.social?.facebook?.event?.eventId
    || distributionResults?.social?.facebook?.event_id
    || extractFacebookEventId(facebookEventUrlForQr)
    || ''
  );
  const facebookEventQrImageUrl = buildQrCodeImageUrl(facebookEventUrlForQr, 320);

  const requiresVideoUpload = !!(channels.video && generated.video && !videoAsset);
  const distributeAllDisabled = distributing || requiresVideoUpload || !eventReadyForDistribution;
  const distributeAllTitle = requiresVideoUpload
    ? 'Upload a short video first so I can distribute video posts'
    : !eventReadyForDistribution
      ? `I still need event details first: ${missingEventFields.join(', ')}`
      : '';

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl mb-1">🎯 IMC Composer</h1>
          <p className="text-gray-500 m-0">Tell me what you are promoting, and I will write, format, and distribute the campaign with you.</p>
        </div>
        <a href="#" onClick={e => { e.preventDefault(); alert('Google Drive is next up. I will wire it in here soon.'); }}
          className="text-sm text-[#c8a45e] font-semibold no-underline hover:underline">
          📁 View assets in Drive →
        </a>
      </div>

      {/* Event Selector */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pick Your Event</label>
        <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); setGenerated({}); setImages([]); setVideoAsset(null); setVideoVariants(null); setVideoVariantJob(null); setVideoVariantJobId(''); setDistributed({}); }}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
          <option value="">Choose an event...</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.title} · {parseLocalDate(e.date).toLocaleDateString()}</option>)}
        </select>
        {events.length === 0 && <p className="text-xs text-gray-400 mt-2">No events yet. <a href="/events/create" className="text-[#c8a45e]">Start your first one →</a></p>}
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

          {!eventReadyForDistribution && (
            <div className="card mb-6 border-l-4 border-amber-500 bg-amber-50">
              <p className="text-sm font-semibold text-amber-800 m-0">I am pausing distribution because a few event details are missing.</p>
              <p className="text-xs text-amber-700 mt-2 mb-1">Add these first, then I can publish everywhere:</p>
              <ul className="text-xs text-amber-700 m-0 ml-5">
                {missingEventFields.map((field) => <li key={field}>{field}</li>)}
              </ul>
            </div>
          )}

          {/* Channel Toggles */}
          <div className="card mb-6">
            <h3 className="text-lg mb-3">Where We Are Sending It</h3>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(c => (
                <ChannelToggle key={c.key} label={c.label} icon={c.icon} enabled={channels[c.key]}
                  onToggle={() => setChannels({ ...channels, [c.key]: !channels[c.key] })} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              📰 Press → KSAT, KENS5, TPR, Express-News, SA Current, SA Report &nbsp;|&nbsp;
              📅 Calendar → Do210, SA Current, Evvnt (→ Express-News/MySA) &nbsp;|&nbsp;
              📱 Social → FB, IG, X, LinkedIn &nbsp;|&nbsp; 🎬 Video → FB Reels, IG Reels/Stories, YouTube, LinkedIn
            </p>
          </div>

          {/* Generate Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button onClick={handleGenerateAll} disabled={generating || activeChannels.length === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {generating ? (
                <><span className="animate-spin inline-block">⟳</span> {generatingChannel || 'Writing...'}</>
              ) : (
                '✨ Write Everything'
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
                  <><span className="animate-spin inline-block">⟳</span> {imageProgress ? `${imageProgress.current}/${imageProgress.total}: ${imageProgress.label}` : 'Designing graphics...'}</>
                ) : (
                  '🎨 Create Graphics'
                )}
              </button>
            </div>
          </div>

          {/* Video Upload */}
          <div className="card mb-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg m-0">🎬 Video Upload (15s / 30s / 60s)</h3>
                <p className="text-xs text-gray-500 m-0">Upload once, and I will prep it for Facebook Reels, Instagram Reels/Stories, YouTube, and LinkedIn.</p>
              </div>
              <label className={`btn-secondary text-sm ${uploadingVideo ? 'opacity-50 pointer-events-none' : ''}`} style={{ cursor: uploadingVideo ? 'not-allowed' : 'pointer' }}>
                {uploadingVideo ? '⏳ Uploading...' : 'Upload Video'}
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {videoAsset ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-[220px,1fr] gap-4 items-start">
                <video src={videoAsset.url} controls className="w-full rounded-lg border border-gray-200 bg-black" />
                <div className="text-sm text-gray-700 space-y-1">
                  <p className="m-0"><strong>File:</strong> {videoAsset.name}</p>
                  <p className="m-0"><strong>Length:</strong> {videoAsset.duration}s</p>
                  <p className="m-0"><strong>Dimensions:</strong> {videoAsset.width}x{videoAsset.height}</p>
                  <p className="m-0"><strong>Type:</strong> {videoAsset.type}</p>
                  <p className="m-0 break-all"><strong>Public URL:</strong> <a href={videoAsset.url} target="_blank" rel="noreferrer" className="text-[#c8a45e]">{videoAsset.url}</a></p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-3 m-0">No video yet. Upload one when you are ready.</p>
            )}

            {videoAsset && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold text-gray-700 m-0">✅ Video Readiness</p>
                  <button
                    type="button"
                    onClick={() => queueVideoVariants(videoAsset, false)}
                    disabled={queuingVariants || (videoVariantJob?.status === 'pending' || videoVariantJob?.status === 'processing')}
                    className="btn-secondary text-xs disabled:opacity-50"
                  >
                    {queuingVariants ? '⏳ Queueing...' : (videoVariantJob?.status === 'pending' || videoVariantJob?.status === 'processing') ? `⏳ Variants: ${videoVariantJob.status}` : '🎛 Build/Refresh Variants'}
                  </button>
                </div>
                <p className="m-0 ml-2">{videoIsPublicHttps ? '✅' : '⚠️'} Public URL: {videoIsPublicHttps ? 'OK' : 'Needs HTTPS public URL'}</p>
                <p className="m-0 ml-2">{videoIsShortDuration ? '✅' : '⚠️'} Duration: {roundedVideoDuration || 0}s {videoIsShortDuration ? '(Reels/Stories/Shorts compatible)' : '(too long for short-form targets)'}</p>
                <p className="m-0 ml-2">{videoIsDurationBucket ? '✅' : '⚠️'} Preferred length: {videoIsDurationBucket ? '15/30/60s bucket matched' : 'recommended 15s, 30s, or 60s'}</p>
                <p className="m-0 ml-2">{(videoAspect === 'vertical' || hasVerticalVariant) ? '✅' : '⚠️'} Vertical readiness: {videoAspect === 'vertical' ? 'Source is vertical' : hasVerticalVariant ? '9:16 variant ready' : 'Need 9:16 source/variant'}</p>
                <p className="m-0 ml-2">{(hasSquareVariant && hasLandscapeVariant) ? '✅' : '⚠️'} Variants: 9:16 ({hasVerticalVariant ? 'ready' : 'pending'}) · 1:1 ({hasSquareVariant ? 'ready' : 'pending'}) · 16:9 ({hasLandscapeVariant ? 'ready' : 'pending'}){variantJobStatus ? ` · job: ${variantJobStatus}` : ''}</p>
                <p className="m-0 ml-2">{fbReelReady ? '✅' : '⚠️'} Facebook Reels</p>
                <p className="m-0 ml-2">{igReelReady ? '✅' : '⚠️'} Instagram Reels</p>
                <p className="m-0 ml-2">{igStoryReady ? '✅' : '⚠️'} Instagram Stories</p>
                <p className="m-0 ml-2">{linkedinVideoReady ? '✅' : '⚠️'} LinkedIn Video Posts</p>
                <p className="m-0 ml-2">{youtubeVideoReady ? '✅' : '⚠️'} YouTube: {youtubeTargetMode}</p>
              </div>
            )}
          </div>

          {/* Generated Content */}
          {Object.keys(generated).length > 0 && (
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg">✅ Generated Content</h3>
                <button onClick={handleDistributeAll} disabled={distributeAllDisabled} className="btn-primary text-sm disabled:opacity-50" title={distributeAllTitle}>
                  {distributing ? '⏳ Distributing...' : requiresVideoUpload ? '🚀 Distribute Everything (upload video first)' : !eventReadyForDistribution ? '🚀 Distribute Everything (finish event details first)' : '🚀 Distribute Everything'}
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
                  {distributionResults.social.facebook && (<>
                    <p className="m-0 ml-2">
                      {distributionResults.social.facebook.event?.success ? '✅' : '⚠️'} Facebook Event: {
                        distributionResults.social.facebook.event?.success
                          ? `Created${distributionResults.social.facebook.event?.eventUrl ? ` · ${distributionResults.social.facebook.event.eventUrl}` : distributionResults.social.facebook.event?.eventId ? ` · ${distributionResults.social.facebook.event.eventId}` : ''}`
                          : distributionResults.social.facebook.event?.error
                            || distributionResults.social.facebook.fallback?.reason
                            || distributionResults.social.facebook.error
                            || 'Not created'
                      }
                    </p>
                    <p className="m-0 ml-2">
                      {distributionResults.social.facebook.feedPost?.success ? '✅' : '⚠️'} Facebook Feed: {
                        distributionResults.social.facebook.feedPost?.success
                          ? `Posted${distributionResults.social.facebook.feedPost.postUrl ? ` · ${distributionResults.social.facebook.feedPost.postUrl}` : distributionResults.social.facebook.feedPost.postId ? ` · ${distributionResults.social.facebook.feedPost.postId}` : ''}`
                          : distributionResults.social.facebook.feedPost?.error || 'Not posted'
                      }
                    </p>
                    {facebookEventQrImageUrl && (
                      <div className="ml-2 mt-2 p-2 border border-gray-200 bg-white rounded-lg">
                        <p className="m-0 text-xs font-semibold text-gray-700">🔳 Facebook Event QR Code</p>
                        <div className="mt-2 flex items-start gap-3 flex-wrap">
                          <img src={facebookEventQrImageUrl} alt="Facebook Event QR" className="w-28 h-28 rounded border border-gray-200 bg-white" />
                          <div className="text-xs text-gray-600 space-y-1">
                            {facebookEventIdForQr && <p className="m-0">Event ID: {facebookEventIdForQr}</p>}
                            <p className="m-0 break-all">{facebookEventUrlForQr}</p>
                            <div className="flex gap-2 flex-wrap pt-1">
                              <a href={facebookEventQrImageUrl} target="_blank" rel="noreferrer" className="text-[#c8a45e] font-semibold no-underline hover:underline">Open QR</a>
                              <a href={facebookEventQrImageUrl} download={`facebook-event-${facebookEventIdForQr || selectedEventId || 'qr'}.png`} className="text-[#c8a45e] font-semibold no-underline hover:underline">Download PNG</a>
                              <button
                                type="button"
                                className="text-[#c8a45e] font-semibold underline-offset-2 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(facebookEventUrlForQr);
                                  alert('Facebook Event URL copied.');
                                } catch (err) {
                                    alert('I could not copy automatically this time. Copy the URL manually and you are set.');
                                }
                              }}
                              >
                                Copy Event URL
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>)}
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
              {distributionResults.video && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <p className="font-semibold text-gray-700 m-0">🎬 Video Distribution</p>
                  {distributionResults.video.facebook && (
                    <p className="m-0 ml-2">
                      {distributionResults.video.facebook.success ? '✅' : '⚠️'} Facebook: {
                        distributionResults.video.facebook.success
                          ? `${distributionResults.video.facebook.mode === 'reel' ? 'Reel posted' : 'Video posted'}${distributionResults.video.facebook.reelUrl ? ` · ${distributionResults.video.facebook.reelUrl}` : distributionResults.video.facebook.videoUrl ? ` · ${distributionResults.video.facebook.videoUrl}` : ''}`
                          : distributionResults.video.facebook.error || 'Not connected'
                      }
                    </p>
                  )}
                  {distributionResults.video.instagram && (
                    <p className="m-0 ml-2">
                      {(distributionResults.video.instagram.reel?.success || distributionResults.video.instagram.story?.success) ? '✅' : '⚠️'} Instagram: {
                        distributionResults.video.instagram.reel?.success || distributionResults.video.instagram.story?.success
                          ? `${distributionResults.video.instagram.reel?.success ? 'Reel' : ''}${distributionResults.video.instagram.reel?.success && distributionResults.video.instagram.story?.success ? ' + ' : ''}${distributionResults.video.instagram.story?.success ? 'Story' : ''} posted`
                          : distributionResults.video.instagram.error || distributionResults.video.instagram.reel?.error || distributionResults.video.instagram.story?.error || 'Not connected'
                      }
                    </p>
                  )}
                  {distributionResults.video.linkedin && (
                    <p className="m-0 ml-2">
                      {distributionResults.video.linkedin.success ? '✅' : '⚠️'} LinkedIn: {
                        distributionResults.video.linkedin.success
                          ? `Video posted${distributionResults.video.linkedin.postUrl ? ` · ${distributionResults.video.linkedin.postUrl}` : ''}`
                          : distributionResults.video.linkedin.error || 'Not connected'
                      }
                    </p>
                  )}
                  {distributionResults.video.youtube && (
                    <p className="m-0 ml-2">
                      {distributionResults.video.youtube.success ? '✅' : '⚠️'} YouTube: {
                        distributionResults.video.youtube.success
                          ? `${distributionResults.video.youtube.isShort ? 'Short uploaded' : 'Video uploaded'}${distributionResults.video.youtube.videoUrl ? ` · ${distributionResults.video.youtube.videoUrl}` : ''}`
                          : distributionResults.video.youtube.error || 'Not connected'
                      }
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Platform Wizards — ChatGPT Agent prompts for manual submission */}
          {selectedEvent && Object.keys(generated).length > 0 && (
            <>
              <FacebookEventWizard
                event={selectedEvent}
                venue={getEventVenue(selectedEvent)}
                generatedContent={generated}
                images={images}
                onSaveEventUrl={handleSaveFacebookEventUrl}
              />
              <SACurrentWizard
                event={selectedEvent}
                venue={getEventVenue(selectedEvent)}
                generatedContent={generated}
              />
            </>
          )}

          {/* Media Distribution Info */}
          <div className="card mt-6 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">📋 Media Distribution</h4>
            <p className="text-xs text-gray-600">
              I send press releases to 17 San Antonio media contacts, including KSAT 12, KENS 5, TPR, Express-News, SA Current, and SA Report. I also route calendars to Do210, TPR Community Calendar, Evvnt, SA Current (wizard), and Eventbrite. Video distribution covers Facebook Reels, Instagram Reels/Stories, YouTube, and LinkedIn.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
