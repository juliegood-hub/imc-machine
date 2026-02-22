import { useState, useMemo } from 'react';
import { parseLocalDate } from '../lib/dateUtils';

/**
 * Facebook Event Wizard
 * Generates a ready-to-paste ChatGPT Agent prompt that creates a Facebook Event
 * with all event details pre-filled from the selected event.
 */
export default function FacebookEventWizard({ event, venue, generatedContent, images }) {
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const prompt = useMemo(() => {
    if (!event) return '';

    const evtDate = parseLocalDate(event.date);
    const dayOfWeek = evtDate.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = evtDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const venueName = venue?.name || event.venue_name || event.venue || 'TBD';
    const venueAddr = venue?.address || event.venue_address || '';
    const fullLocation = venueAddr ? `${venueName}, ${venueAddr}` : venueName;

    const description = generatedContent?.press
      || generatedContent?.social
      || event.description
      || '[Event description]';

    // Category mapping
    const genre = (event.genre || '').toLowerCase();
    let fbCategory = 'Community Event';
    if (genre.includes('music') || genre.includes('jazz') || genre.includes('indie')) fbCategory = 'Live Music';
    else if (genre.includes('comedy') || genre.includes('speaking')) fbCategory = 'Comedy';
    else if (genre.includes('theater') || genre.includes('musical')) fbCategory = 'Theater';
    else if (genre.includes('dance') || genre.includes('performance')) fbCategory = 'Performance Art / Dance';

    const admission = event.isFree || event.is_free ? 'Free' : (event.ticketPrice || event.ticket_price || 'See event details');

    // Find best image URL
    const imageUrl = images?.[0]?.url
      || images?.[0]?.publicUrl
      || event.posterUrl
      || event.poster_url
      || event.banner_url
      || null;

    // Performers / hosts
    const performers = event.performers || event.cast_crew?.map(c => c.name).join(', ') || '';

    return `CHATGPT AGENT PROMPT — FACEBOOK EVENT CREATION

You are operating as an execution agent inside a live browser session.
Goal: Create a Facebook Event on the Good Creative Media Page (not a personal profile).

CRITICAL RULES:
- Do not guess names, dates, times, or venue details
- Use ONLY the information provided below
- If any login gate appears, pause and ask the user to log in, then continue
- Create the event as the Good Creative Media PAGE, not a personal profile

STEP 1 — Navigate to Facebook Events
Open: https://www.facebook.com/goodcreativemedia/events
Click "+ Create New Event" or "Create Event"
Choose: In-Person Event

STEP 2 — Fill in Event Details (EXACTLY as written)

Event Name: ${event.title}
Start Date: ${formattedDate}
Start Time: ${event.time || event.start_time || '7:00 PM'}${event.endTime || event.end_time ? `\nEnd Time: ${event.endTime || event.end_time}` : ''}
Location: ${fullLocation}
Category: ${fbCategory}
Admission: ${admission}
${performers ? `Performers/Hosts: ${performers}` : ''}

STEP 3 — Set Recurring (if applicable)
If Facebook offers "Recurring Event" or "Schedule Multiple Events":
- Set to: Weekly on ${dayOfWeek}s
- No end date (or 6 months out if required)
If recurring is not available, create the next upcoming instance only.

STEP 4 — Description (copy/paste exactly)

${description}

STEP 5 — Cover Photo${imageUrl ? `
Download this image and upload it as the Event Cover Photo:
${imageUrl}
Recommended size: 1920×1005px. Center the main content if cropping is needed.` : `
No banner image is available yet. Either:
- Ask the user to generate one via the IMC Machine Image Formatter
- Or skip the cover photo for now (can be added later)`}

STEP 6 — Co-hosts
Tag these Facebook Pages as co-hosts (if they exist):
- ${venueName}
${performers ? performers.split(',').map(p => `- ${p.trim()}`).join('\n') : ''}

STEP 7 — Publish
- Set Visibility: Public
- Publish the event immediately

STEP 8 — Report Back
Provide:
- Event Name: ${event.title}
- Created: Yes/No
- Published: Yes/No
- Facebook Event URL: [paste the URL]
- Any issues encountered`;
  }, [event, venue, generatedContent, images]);

  function handleCopy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  if (!event) return null;

  return (
    <div className="card mt-4" style={{ borderLeft: '4px solid #1877F2' }}>
      <div className="flex items-center justify-between mb-2">
        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          📘 Facebook Event Wizard
        </h3>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="btn-secondary"
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          {showPrompt ? 'Hide Prompt' : 'Generate Prompt'}
        </button>
      </div>
      
      <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px 0' }}>
        Generates a ChatGPT Agent prompt to create this Facebook Event with all details pre-filled. Copy → paste into ChatGPT with browser control.
      </p>

      {showPrompt && (
        <>
          <div
            style={{
              background: '#f8f9fa',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '12px',
              lineHeight: '1.6',
              maxHeight: '400px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, monospace',
              border: '1px solid #e0e0e0'
            }}
          >
            {prompt}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={handleCopy}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {copied ? '✅ Copied!' : '📋 Copy Prompt'}
            </button>
            <a
              href="https://chatgpt.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              🤖 Open ChatGPT →
            </a>
          </div>

          {images && images.length > 0 && images[0]?.url && (
            <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '8px', margin: '8px 0 0 0' }}>
              ✅ Banner image ready — URL included in prompt for ChatGPT Agent to download and upload.
            </p>
          )}
          {(!images || images.length === 0) && (
            <p style={{ fontSize: '12px', color: '#ca8a04', marginTop: '8px', margin: '8px 0 0 0' }}>
              ⚠️ No banner image generated yet. Use "Generate Graphics" first for best results.
            </p>
          )}
        </>
      )}
    </div>
  );
}
