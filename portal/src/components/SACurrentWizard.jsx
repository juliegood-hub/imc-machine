import { useState, useMemo } from 'react';
import { parseLocalDate } from '../lib/dateUtils';

/**
 * SA Current Calendar Wizard
 * SA Current is protected by Cloudflare — automated submission is blocked.
 * Generates a ready-to-paste ChatGPT Agent prompt for manual submission.
 */
export default function SACurrentWizard({ event, venue, generatedContent }) {
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const prompt = useMemo(() => {
    if (!event) return '';

    const evtDate = parseLocalDate(event.date);
    const formattedDate = evtDate.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    const venueName = venue?.name || event.venue || 'TBD';
    const venueAddr = [venue?.address, venue?.city || 'San Antonio', venue?.state || 'TX', venue?.zip].filter(Boolean).join(', ');
    const description = generatedContent?.press || event.description || event.title;

    return `Submit an event to the SA Current Community Calendar. Here are the steps:

1. Go to https://community.sacurrent.com/sanantonio/Events/AddEvent
2. If asked to log in, use:
   - Email: juliegood@goodcreativemedia.com
   - Password: (I'll provide it when prompted)
3. Fill in the event form with these details EXACTLY:

- **Event Title:** ${event.title}
- **Start Date:** ${formattedDate}
- **Start Time:** ${event.time || '7:00 PM'}${event.endTime ? `\n- **End Time:** ${event.endTime}` : ''}
- **Venue Name:** ${venueName}
- **Venue Address:** ${venueAddr}
- **Description:** (paste below)

${description}

${event.eventbriteUrl || event.ticketUrl ? `- **Ticket URL:** ${event.eventbriteUrl || event.ticketUrl}` : '- **Tickets:** Free / At the door'}
${event.performers ? `- **Artist/Performer:** ${event.performers}` : ''}
- **Website:** https://goodcreativemedia.com
- **Category:** ${event.genre || 'Live Music'}

4. Upload the event image if an upload field is available.
5. Submit the form.
6. Give me the confirmation URL or screenshot when done.`;
  }, [event, venue, generatedContent]);

  function handleCopy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  if (!event) return null;

  return (
    <div className="card mt-4 border-l-4 border-orange-500">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold m-0">
          📰 SA Current Calendar Wizard
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
        SA Current is Cloudflare-protected — paste this prompt into ChatGPT Agent to submit manually.
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
            <button onClick={handleCopy} className="btn-primary text-sm" style={{ padding: '8px 16px' }}>
              {copied ? '✅ Copied!' : '📋 Copy Prompt'}
            </button>
            <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer"
              className="btn-secondary text-sm" style={{ padding: '8px 16px', textDecoration: 'none' }}>
              🤖 Open ChatGPT →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
