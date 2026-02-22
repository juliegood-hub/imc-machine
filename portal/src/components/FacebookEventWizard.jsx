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
    const formattedDate = evtDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const venueName = venue?.name || event.venue || 'TBD';
    const venueAddr = [
      venue?.address,
      venue?.city || 'San Antonio',
      venue?.state || 'TX',
      venue?.zip,
    ].filter(Boolean).join(', ');

    // Build description from generated press release or event description
    const description = generatedContent?.press
      || generatedContent?.social
      || event.description
      || '[Paste event description here]';

    // Determine category from genre
    const genre = (event.genre || '').toLowerCase();
    let fbCategory = 'COMMUNITY_EVENT';
    if (genre.includes('music') || genre.includes('jazz') || genre.includes('indie')) fbCategory = 'MUSIC_EVENT';
    else if (genre.includes('comedy') || genre.includes('speaking')) fbCategory = 'COMEDY_EVENT';
    else if (genre.includes('theater') || genre.includes('musical') || genre.includes('play')) fbCategory = 'THEATER_EVENT';
    else if (genre.includes('dance') || genre.includes('performance')) fbCategory = 'DANCE_EVENT';

    const ticketLine = event.eventbriteUrl || event.ticketUrl
      ? `- **Ticket Link:** ${event.eventbriteUrl || event.ticketUrl}`
      : '- **Tickets:** Free / At the door (no ticket link)';

    const performerLine = event.performers
      ? `- **Performers/Hosts:** ${event.performers}`
      : '';

    const imageNote = images && images.length > 0
      ? `I have a banner image ready to upload as the Event Cover Photo. I'll attach it after you start creating the event.`
      : `I need you to help me find or create a banner image (1920x1005px recommended) for the Event Cover Photo.`;

    return `Create a Facebook Event on my business page. Here are the exact steps:

1. Go to https://www.facebook.com/goodcreativemedia/events
2. Click "+ Create New Event" (or "Create Event")
3. Fill in these details EXACTLY as written:

- **Event Name:** ${event.title}
- **Start Date:** ${formattedDate}
- **Start Time:** ${event.time || '7:00 PM'}${event.endTime ? `\n- **End Time:** ${event.endTime}` : ''}
- **Location:** ${venueName}, ${venueAddr}
- **Category:** ${fbCategory.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
${performerLine}
${ticketLine}

4. **Description** (copy exactly):

${description}

5. **Cover Photo:** ${imageNote}
   - Recommended size: 1920x1005px
   - Upload the attached banner/poster image as the Event Cover Photo
   - If it needs cropping, center the main content

6. **Co-hosts:** Tag these pages if they exist on Facebook:
   - ${venueName} (venue page)
${event.performers ? event.performers.split(',').map(p => `   - ${p.trim()} (performer page)`).join('\n') : '   - (no additional performers to tag)'}

7. **Visibility:** Set to Public
8. **Publish** the event immediately

After creating, give me the direct URL to the published Facebook Event.`;
  }, [event, venue, generatedContent, images]);

  function handleCopy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  if (!event) return null;

  return (
    <div className="card mt-4 border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold m-0">
          📘 Facebook Event Wizard
        </h3>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="btn-secondary text-xs"
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          {showPrompt ? 'Hide Prompt' : 'Generate Prompt'}
        </button>
      </div>
      
      <p className="text-xs text-gray-500 m-0 mb-3">
        Auto-generates a ready-to-paste prompt for ChatGPT Agent to create your Facebook Event with all details pre-filled.
      </p>

      {showPrompt && (
        <>
          <div
            className="bg-gray-50 rounded-lg p-4 text-xs leading-relaxed overflow-auto"
            style={{ maxHeight: '400px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
          >
            {prompt}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCopy}
              className="btn-primary text-sm flex items-center gap-1"
              style={{ padding: '8px 16px' }}
            >
              {copied ? '✅ Copied!' : '📋 Copy Prompt'}
            </button>
            <a
              href="https://chatgpt.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm flex items-center gap-1"
              style={{ padding: '8px 16px', textDecoration: 'none' }}
            >
              🤖 Open ChatGPT →
            </a>
          </div>

          {images && images.length > 0 && (
            <p className="text-xs text-green-600 mt-2 m-0">
              ✅ {images.length} image(s) generated — download from Image Formatter and attach to ChatGPT after pasting the prompt.
            </p>
          )}
        </>
      )}
    </div>
  );
}
