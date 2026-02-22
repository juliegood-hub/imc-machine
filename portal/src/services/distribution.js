import { parseLocalDate } from '../lib/dateUtils.js';
// ═══════════════════════════════════════════════════════════════
// IMC Machine — Distribution Service
// Handles press release emails, calendar submissions, social posting
// ═══════════════════════════════════════════════════════════════

// API keys are server-side only — all external calls go through /api/distribute

// ═══════════════════════════════════════════════════════════════
// SA MEDIA CONTACT LIST (Tier 1 & 2 — auto-distribute)
// ═══════════════════════════════════════════════════════════════

export const MEDIA_CONTACTS = {
  // Tier 1: Calendar platforms (auto-submit)
  calendar: [
    { name: 'Do210', email: 'events@do210.com', type: 'calendar', submitUrl: 'https://do210.com/events/new', notes: 'SA #1 event discovery' },
    { name: 'San Antonio Current', email: 'calendar@sacurrent.com', type: 'calendar', notes: 'Alt-weekly arts/music' },
    { name: 'Evvnt', type: 'api', notes: 'Syndicates to Express-News, MySA, 100+ sites' },
  ],
  
  // Tier 2: Press release recipients
  tv: [
    { name: 'KSAT 12 (ABC)', email: 'community@ksat.com', desk: 'Community Calendar' },
    { name: 'KENS 5 (CBS)', email: 'greatdaysa@kens5.com', desk: 'Great Day SA' },
    { name: 'KABB Fox 29', email: 'daytime@kabb.com', desk: 'Daytime SA' },
    { name: 'WOAI / News 4 SA', email: 'news@news4sanantonio.com', desk: 'News Desk' },
    { name: 'KLRN (PBS)', email: 'info@klrn.org', desk: 'Arts & Culture' },
  ],
  radio: [
    { name: 'Texas Public Radio', email: 'arts@tpr.org', desk: 'Arts Desk' },
    { name: 'KRTU 91.7', email: 'music@krtu.org', desk: 'Music Director' },
  ],
  print: [
    { name: 'SA Express-News', email: 'salife@express-news.net', desk: 'Entertainment / S.A. Life' },
    { name: 'San Antonio Current', email: 'calendar@sacurrent.com', desk: 'Music/Arts Editor' },
    { name: 'San Antonio Report', email: 'tips@sanantonioreport.org', desk: 'Arts & Culture' },
    { name: 'San Antonio Magazine', email: 'editorial@sanantoniomag.com', desk: 'Lifestyle Editor' },
    { name: 'La Prensa Texas', email: 'editor@laprensatexas.com', desk: 'Editor (bilingual)' },
    { name: 'Out In SA', email: 'info@outinsa.com', desk: 'Events' },
  ],
  orgs: [
    { name: 'Visit San Antonio', email: 'pr@visitsanantonio.com', desk: 'PR' },
    { name: 'Artpace', email: 'press@artpace.org', desk: 'Press' },
    { name: 'SA Flavor', email: 'info@saflavor.com', desk: 'Editorial' },
  ],
};

// Get all press release recipients (Tier 2)
export function getAllPressContacts() {
  return [
    ...MEDIA_CONTACTS.tv,
    ...MEDIA_CONTACTS.radio,
    ...MEDIA_CONTACTS.print,
    ...MEDIA_CONTACTS.orgs,
  ];
}

// Get all calendar contacts (Tier 1)
export function getCalendarContacts() {
  return MEDIA_CONTACTS.calendar;
}

// ═══════════════════════════════════════════════════════════════
// EMAIL DISTRIBUTION (Press Releases)
// Uses the backend API endpoint to send via Gmail
// ═══════════════════════════════════════════════════════════════

export async function sendPressRelease(event, venue, pressReleaseText, recipients = null) {
  const contacts = recipients || getAllPressContacts();
  const fromName = venue?.name || 'Good Creative Media';
  
  const subject = `Press Release: ${event.title} at ${venue?.name || 'San Antonio Venue'} · ${parseLocalDate(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  
  const htmlBody = formatPressReleaseEmail(event, venue, pressReleaseText);
  
  const results = [];
  
  for (const contact of contacts) {
    if (!contact.email) continue;
    
    try {
      // Route through server-side API (no CORS, keys stay secret)
      const res = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-email',
          to: contact.email,
          subject,
          html: htmlBody,
          from: `${fromName} <events@goodcreativemedia.com>`,
          replyTo: 'thisisthegoodlife@juliegood.com',
        }),
      });
      
      const data = await res.json();
      results.push({ 
        contact: contact.name, 
        email: contact.email, 
        status: data.success ? 'sent' : 'failed',
        error: data.error,
        id: data.emailId,
      });
    } catch (err) {
      results.push({ 
        contact: contact.name, 
        email: contact.email, 
        status: 'failed', 
        error: err.message 
      });
    }
  }
  
  return results;
}

function formatPressReleaseEmail(event, venue, pressReleaseText) {
  const venueName = venue?.name || 'Venue';
  const venueAddress = venue?.address ? `${venue.address}, ${venue.city || 'San Antonio'}, ${venue.state || 'TX'}` : 'San Antonio, TX';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.7; max-width: 680px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #c8a45e; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-family: 'Playfair Display', Georgia, serif; color: #0d1b2a; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin: 0; }
    .header p { color: #666; font-size: 12px; margin: 4px 0 0; }
    .press-release { white-space: pre-wrap; font-size: 15px; }
    .event-box { background: #f8f7f4; border-left: 4px solid #c8a45e; padding: 16px 20px; margin: 24px 0; }
    .event-box h3 { font-family: 'Playfair Display', Georgia, serif; color: #0d1b2a; margin: 0 0 8px; }
    .event-box p { margin: 4px 0; font-size: 14px; color: #333; }
    .footer { border-top: 1px solid #ddd; padding-top: 16px; margin-top: 32px; font-size: 12px; color: #888; }
    .footer a { color: #c8a45e; }
    .gcm-badge { font-size: 11px; color: #999; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${venueName}</h1>
    <p>Press Release: For Immediate Distribution</p>
  </div>
  
  <div class="press-release">${pressReleaseText.replace(/\n/g, '<br>')}</div>
  
  <div class="event-box">
    <h3>Event Details</h3>
    <p><strong>Event:</strong> ${event.title}</p>
    <p><strong>Date:</strong> ${parseLocalDate(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${event.time}</p>
    <p><strong>Venue:</strong> ${venueName}</p>
    <p><strong>Location:</strong> ${venueAddress}</p>
    <p><strong>Genre:</strong> ${event.genre || 'Live Entertainment'}</p>
    ${event.ticketLink ? `<p><strong>Tickets:</strong> <a href="${event.ticketLink}" style="color:#c8a45e">${event.ticketLink}</a></p>` : ''}
  </div>
  
  <div class="footer">
    <p><strong>Media Contact:</strong> Good Creative Media<br>
    Email: thisisthegoodlife@juliegood.com<br>
    Web: <a href="https://goodcreativemedia.com">goodcreativemedia.com</a></p>
    
    <p class="gcm-badge">Distribution powered by The IMC Machine · Good Creative Media, San Antonio TX</p>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// EVENTBRITE — Create Event + Generate Ticket Link
// ═══════════════════════════════════════════════════════════════

export async function createEventbriteEvent(event, venue) {
  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-eventbrite',
        event,
        venue,
        options: {},
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Eventbrite creation failed');
    return {
      success: true,
      eventId: data.eventId,
      url: data.eventUrl,
      message: `Event created on Eventbrite: ${data.eventUrl}`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// DO210 — Calendar Submission (email-based until API partnership)
// ═══════════════════════════════════════════════════════════════

export async function submitToDo210(event, venue, calendarCopy) {
  const subject = `Event Submission: ${event.title} at ${venue?.name || 'Venue'} · ${parseLocalDate(event.date).toLocaleDateString()}`;
  
  const htmlBody = `
<div style="font-family:Georgia,serif;line-height:1.7;color:#1a1a1a">
<p>Hi Do210 Team,</p>
<p>We'd love to list the following event on Do210:</p>
<div style="background:#f8f7f4;border-left:4px solid #c8a45e;padding:16px 20px;margin:16px 0">
${calendarCopy ? calendarCopy.replace(/\n/g, '<br>') : `
<strong>EVENT:</strong> ${event.title}<br>
<strong>DATE:</strong> ${parseLocalDate(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${event.time}<br>
<strong>VENUE:</strong> ${venue?.name || 'TBD'}<br>
<strong>ADDRESS:</strong> ${venue?.address ? `${venue.address}, ${venue.city || 'San Antonio'}, ${venue.state || 'TX'}` : 'San Antonio, TX'}<br>
<strong>GENRE:</strong> ${event.genre || 'Live Entertainment'}<br>
<strong>DESCRIPTION:</strong> ${event.description || ''}<br>
<strong>TICKETS:</strong> ${event.ticketLink || 'At the door'}
`}
</div>
<p>Thank you!<br>Good Creative Media<br>thisisthegoodlife@juliegood.com<br>goodcreativemedia.com</p>
</div>`;

  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-email',
        to: 'events@do210.com',
        subject,
        html: htmlBody,
        from: 'Good Creative Media <events@goodcreativemedia.com>',
        replyTo: 'thisisthegoodlife@juliegood.com',
      }),
    });
    const data = await res.json();
    return { to: 'events@do210.com', status: data.success ? 'sent' : 'failed', id: data.emailId, error: data.error };
  } catch (err) {
    return { to: 'events@do210.com', status: 'failed', error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// SA CURRENT — Calendar Submission (email-based)
// ═══════════════════════════════════════════════════════════════

export async function submitToSACurrent(event, venue, calendarCopy) {
  const subject = `Event Listing: ${event.title} at ${venue?.name || 'Venue'} · ${parseLocalDate(event.date).toLocaleDateString()}`;
  
  const htmlBody = `
<div style="font-family:Georgia,serif;line-height:1.7;color:#1a1a1a">
<p>Hello SA Current Calendar Team,</p>
<p>Please consider listing the following event:</p>
<div style="background:#f8f7f4;border-left:4px solid #c8a45e;padding:16px 20px;margin:16px 0">
${calendarCopy ? calendarCopy.replace(/\n/g, '<br>') : `
<strong>EVENT:</strong> ${event.title}<br>
<strong>DATE:</strong> ${parseLocalDate(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${event.time}<br>
<strong>VENUE:</strong> ${venue?.name || 'TBD'}<br>
<strong>ADDRESS:</strong> ${venue?.address ? `${venue.address}, ${venue.city || 'San Antonio'}, ${venue.state || 'TX'}` : 'San Antonio, TX'}<br>
<strong>GENRE:</strong> ${event.genre || 'Live Entertainment'}<br>
<strong>DESCRIPTION:</strong> ${event.description || ''}<br>
<strong>TICKETS:</strong> ${event.ticketLink || 'At the door'}
`}
</div>
<p>Thank you,<br>Good Creative Media<br>thisisthegoodlife@juliegood.com<br>goodcreativemedia.com</p>
</div>`;

  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-email',
        to: 'calendar@sacurrent.com',
        subject,
        html: htmlBody,
        from: 'Good Creative Media <events@goodcreativemedia.com>',
        replyTo: 'thisisthegoodlife@juliegood.com',
      }),
    });
    const data = await res.json();
    return { to: 'calendar@sacurrent.com', status: data.success ? 'sent' : 'failed', id: data.emailId, error: data.error };
  } catch (err) {
    return { to: 'calendar@sacurrent.com', status: 'failed', error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// EVVNT — API Submission (syndicates to Express-News, MySA, 100+)
// ═══════════════════════════════════════════════════════════════

export async function submitToEvvnt(event, venue) {
  // Evvnt requires a publisher account — for now format for email submission
  // Once Julie has an Evvnt account, we'll use their REST API
  
  const subject = `Event Submission: ${event.title}`;
  const body = `
Event Title: ${event.title}
Date: ${parseLocalDate(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
Time: ${event.time || 'TBD'}
Venue: ${venue?.name || 'TBD'}
Address: ${venue?.address ? `${venue.address}, ${venue.city || 'San Antonio'}, ${venue.state || 'TX'} ${venue.postalCode || ''}` : 'San Antonio, TX'}
Category: ${event.genre || 'Entertainment'}
Description: ${event.description || ''}
Ticket URL: ${event.ticketLink || ''}
Contact: Good Creative Media · thisisthegoodlife@juliegood.com
Website: ${venue?.website || 'https://goodcreativemedia.com'}
`;

  return {
    method: 'pending_api',
    formatted: body,
    notes: 'Evvnt API integration pending. Need Evvnt publisher account. Once connected, this auto-syndicates to SA Express-News, MySA.com, and 100+ calendar sites.',
    signupUrl: 'https://www.evvnt.com/publishers',
  };
}

// ═══════════════════════════════════════════════════════════════
// FACEBOOK EVENT CREATION (via Meta Graph API)
// ═══════════════════════════════════════════════════════════════

export { createFullFacebookEvent as createFacebookEvent } from './facebook-events';
export { postToFacebookPage, postToInstagram } from './social-auto';

// ═══════════════════════════════════════════════════════════════
// MASTER DISTRIBUTE FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function distributeAll(event, venue, generatedContent) {
  const results = {
    press: null,
    calendar: null,
    eventbrite: null,
    social: null,
    timestamp: new Date().toISOString(),
  };

  // 1. Send press release emails to all media contacts
  if (generatedContent.press) {
    results.press = await sendPressRelease(event, venue, generatedContent.press);
  }

  // 2. Submit to calendar platforms
  if (generatedContent.calendar) {
    const do210 = await submitToDo210(event, venue, generatedContent.calendar);
    const current = await submitToSACurrent(event, venue, generatedContent.calendar);
    const evvnt = await submitToEvvnt(event, venue);
    results.calendar = { do210, current, evvnt };
  }

  // 3. Create Eventbrite event
  results.eventbrite = await createEventbriteEvent(event, venue);

  // 4. Social media — auto-post to Facebook + Instagram
  if (generatedContent.social) {
    const { distributeSocial } = await import('./social-auto');
    results.social = await distributeSocial(generatedContent.social, generatedContent.socialImageUrl, null);
  } else {
    results.social = {
      facebook: { status: 'skipped', message: 'No social content generated' },
      instagram: { status: 'skipped', message: 'No social content generated' },
    };
  }

  return results;
}
