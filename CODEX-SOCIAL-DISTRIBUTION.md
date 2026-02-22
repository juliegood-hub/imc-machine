# Codex Task: Make ALL Distribution Channels Live and Working

## Goal
When a user clicks "Distribute All" in the IMC Composer, EVERY channel should actually fire: press releases to media, Eventbrite listing, Facebook event + post, Instagram post, LinkedIn post, email blast to subscribers, SMS to opt-in users, AND automated form submissions to Do210, SA Current, and Evvnt. One click, full distribution. No more "ready" alerts or "manual" fallbacks.

## Current Architecture

### Files
- **Frontend**: `src/pages/IMCComposer.jsx` — React component, generate + distribute UI
- **Backend API**: `api/distribute.js` — Vercel serverless, all external API calls
- **Content Gen**: `api/generate.js` — GPT-4o content, Gemini research/images
- **OAuth**: `api/oauth.js` — Facebook, YouTube, LinkedIn OAuth flows
- **Puppeteer**: `submit-events.js` (root) — Local Puppeteer scripts for Do210, SA Current, Evvnt (NOT connected to web app)
- **Context**: `src/context/VenueContext.jsx` — Venue/event state management
- **Settings**: `src/pages/Settings.jsx` — OAuth connect/disconnect UI

### What's Working
| Channel | Backend API | Called from Composer | Status |
|---------|------------|---------------------|--------|
| Press Release (email) | ✅ `send-press-release` | ✅ | LIVE — sends to 14 SA media contacts via Resend |
| Eventbrite | ✅ `create-eventbrite` | ✅ | LIVE — creates + publishes event |
| Facebook | ✅ `post-facebook` | ✅ | LIVE — creates FB event + feed post |
| Instagram | ✅ `post-instagram` | ❌ NOT CALLED | Backend ready, frontend only calls Facebook |
| LinkedIn | ✅ `post-linkedin` | ❌ NOT CALLED | Backend ready, frontend only calls Facebook |
| Twitter/X | ❌ No endpoint | ❌ | Not built |
| Email Blast | ✅ `send-email` exists | ❌ Shows "ready" alert | Resend works, just not wired |
| SMS | ❌ No endpoint | ❌ Shows "ready" alert | Need Twilio |
| Do210 | ❌ Local Puppeteer only | ❌ | `submit-events.js` exists but not callable from web |
| SA Current | ❌ Local Puppeteer only | ❌ | Same |
| Evvnt | ❌ Local Puppeteer only | ❌ | Same |

---

## TASK 1: Fix Social Distribution to Hit ALL Platforms

**File**: `src/pages/IMCComposer.jsx`

### Problem
The `handleDistribute` function's `channelKey === 'social'` block ONLY calls `post-facebook`. Instagram and LinkedIn endpoints exist in `api/distribute.js` and are fully functional but never get called.

### Step 1A: Add a social content parser

The AI generates one text block with labeled sections. Add this function near the top of the component (inside the function body, before handleGenerate):

```javascript
// Parse AI-generated social content into per-platform posts
function parseSocialContent(socialText) {
  if (!socialText) return {};
  const sections = {};
  // Match headers like **Facebook**, ## Instagram Caption, LINKEDIN:, Twitter/X:, etc.
  const regex = /(?:^|\n)\s*(?:\*{1,2}|#{1,3}\s*)?(?:(\d+)\.\s*)?(?:\*{0,2})(Facebook|Instagram(?:\s+Caption)?|LinkedIn|Twitter(?:\/X)?)\s*(?:\*{0,2})\s*:?\s*\n/gi;
  let lastPlatform = null;
  let lastIndex = 0;
  const matches = [...socialText.matchAll(regex)];
  
  matches.forEach((match, i) => {
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
  // Capture last section
  if (lastPlatform) {
    sections[lastPlatform] = socialText.substring(lastIndex).trim();
  }
  
  return sections;
}
```

### Step 1B: Replace the social distribution block

In `handleDistribute`, replace the entire `} else if (channelKey === 'social') {` block with:

```javascript
} else if (channelKey === 'social') {
  const parsed = parseSocialContent(text || generated.social);
  const results = {};
  const errors = [];
  const eventVenue = getEventVenue(selectedEvent);

  // Facebook (event + feed post)
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

  // Small delay between API calls
  await new Promise(r => setTimeout(r, 500));

  // Instagram (requires image — skip if none)
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
    results.instagram = { success: false, error: 'No public image URL. Instagram requires a publicly accessible HTTPS image. Generate graphics first, then upload to media library.' };
  }

  await new Promise(r => setTimeout(r, 500));

  // LinkedIn
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

  // Twitter/X
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

  // Do210 + SA Current + Evvnt (Puppeteer via API)
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
    results.facebook?.success ? '✅ Facebook: Event + post created' : `⚠️ Facebook: ${results.facebook?.error || 'Not connected'}`,
    results.instagram?.success ? '✅ Instagram: Posted' : `⚠️ Instagram: ${results.instagram?.error || 'Not connected'}`,
    results.linkedin?.success ? '✅ LinkedIn: Posted' : `⚠️ LinkedIn: ${results.linkedin?.error || 'Not connected'}`,
    results.twitter?.success ? '✅ Twitter/X: Tweeted' : `⚠️ Twitter/X: ${results.twitter?.error || 'Not connected'}`,
    results.calendars?.success ? '✅ Do210/SA Current/Evvnt: Submitted' : `⚠️ Calendars: ${results.calendars?.error || 'Not connected'}`,
  ].join('\n');

  alert(`📱 Social Distribution Results:\n\n${summary}`);
}
```

---

## TASK 2: Wire Up Email Blast Sending

**File**: `src/pages/IMCComposer.jsx`

Replace the `channelKey === 'email'` block:

```javascript
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
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    alert(`📧 Email error: ${err.message}`);
    setDistributed(prev => ({ ...prev, [channelKey]: false }));
  }
}
```

**File**: `api/distribute.js`

Add to the switch statement:
```javascript
case 'send-email-blast':
  result = await sendEmailBlast(req.body);
  break;
```

Add this function:
```javascript
async function sendEmailBlast({ event, venue, content }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');

  // Parse the AI-generated email content into subject + body
  const emailText = typeof content === 'string' ? content : (content.emailBlast || content.email || '');
  
  // Extract subject line (first line after "Subject Line:" or "Subject:")
  const subjectMatch = emailText.match(/subject\s*(?:line)?[:\s]*(.+)/i);
  const subject = subjectMatch ? subjectMatch[1].trim().replace(/^["']|["']$/g, '') : `${event.title} — Event Announcement`;
  
  // Extract preview text
  const previewMatch = emailText.match(/preview\s*(?:text)?[:\s]*(.+)/i);
  const preview = previewMatch ? previewMatch[1].trim().replace(/^["']|["']$/g, '') : '';
  
  // Body is everything after the headers
  let body = emailText
    .replace(/subject\s*(?:line)?[:\s]*.+/i, '')
    .replace(/preview\s*(?:text)?[:\s]*.+/i, '')
    .trim();

  // Get subscribers from Supabase (users with email who opted in)
  const { data: subscribers } = await supabase
    .from('profiles')
    .select('email, name, venue_name')
    .not('email', 'is', null)
    .eq('email_opt_in', true);

  const recipients = subscribers?.map(s => s.email).filter(Boolean) || [];
  
  if (recipients.length === 0) {
    return { success: false, error: 'No email subscribers found. Users need to opt in via their profile settings.' };
  }

  // Build HTML email
  const html = buildEmailBlastHTML(event, venue, subject, preview, body);

  let sent = 0;
  const errors = [];
  
  // Send in batches (Resend allows batch sending)
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    try {
      const fromAddr = process.env.RESEND_FROM_EMAIL || 'Good Creative Media <events@goodcreativemedia.com>';
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromAddr,
          to: batch,
          subject,
          html,
          reply_to: 'thisisthegoodlife@juliegood.com',
        }),
      });
      const data = await response.json();
      if (data.id) { sent += batch.length; }
      else if (data.error?.message?.includes('not verified')) {
        // Retry with Resend test domain
        const retryRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Good Creative Media <onboarding@resend.dev>',
            to: batch,
            subject,
            html,
            reply_to: 'thisisthegoodlife@juliegood.com',
          }),
        });
        const retryData = await retryRes.json();
        if (retryData.id) sent += batch.length;
        else errors.push(retryData.error?.message || 'Unknown error');
      } else {
        errors.push(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      errors.push(err.message);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return { success: sent > 0, sent, total: recipients.length, errors };
}

function buildEmailBlastHTML(event, venue, subject, preview, body) {
  const venueName = venue?.name || 'San Antonio Venue';
  const eventDate = event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${preview ? `<meta name="description" content="${preview}">` : ''}
  <title>${subject}</title>
  <style>
    body { font-family: 'Inter', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #0d1b2a; color: #c8a45e; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; color: #c8a45e; }
    .body { padding: 30px; white-space: pre-line; }
    .event-card { background: #faf8f3; border-left: 4px solid #c8a45e; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .cta { display: inline-block; background: #c8a45e; color: #0d1b2a; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; margin: 20px 0; }
    .footer { background: #0d1b2a; color: #888; padding: 20px; text-align: center; font-size: 12px; }
    .footer a { color: #c8a45e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${event.title}</h1>
      <p style="color:#aaa; margin:5px 0 0;">Presented by Good Creative Media</p>
    </div>
    <div class="body">
      <div class="event-card">
        <strong>📅 ${eventDate}${event.time ? ' · ' + event.time : ''}</strong><br>
        <strong>📍 ${venueName}</strong>${venue?.address ? '<br>' + venue.address + ', ' + (venue.city || 'San Antonio') + ', ' + (venue.state || 'TX') : ''}
      </div>
      ${body}
      ${event.ticketLink ? `<p style="text-align:center"><a href="${event.ticketLink}" class="cta">Get Tickets</a></p>` : ''}
    </div>
    <div class="footer">
      <p>Good Creative Media · San Antonio, TX<br>
      <a href="https://goodcreativemedia.com">goodcreativemedia.com</a></p>
      <p style="font-size:10px">You're receiving this because you opted in to event announcements.</p>
    </div>
  </div>
</body>
</html>`;
}
```

**SQL** (run in Supabase SQL Editor to add email opt-in field):
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT false;
NOTIFY pgrst, 'reload schema';
```

---

## TASK 3: Wire Up SMS via Twilio

**File**: `src/pages/IMCComposer.jsx`

Replace the `channelKey === 'sms'` block:

```javascript
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
    } else {
      alert(`💬 SMS: ${data.error}`);
      setDistributed(prev => ({ ...prev, [channelKey]: 'ready' }));
    }
  } catch (err) {
    alert(`💬 SMS error: ${err.message}`);
    setDistributed(prev => ({ ...prev, [channelKey]: false }));
  }
}
```

**File**: `api/distribute.js`

Add to switch statement:
```javascript
case 'send-sms':
  result = await sendSMS(req.body);
  break;
```

Add function:
```javascript
async function sendSMS({ event, content, recipients }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  
  if (!sid || !token || !from) {
    return { success: false, error: 'Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to Vercel environment variables.' };
  }

  const message = content?.smsText || (typeof content === 'string' ? content : event.title);
  
  // Get opted-in recipients from Supabase
  const { data: smsUsers } = await supabase
    .from('profiles')
    .select('phone, name')
    .not('phone', 'is', null)
    .eq('sms_opt_in', true);
  
  const phones = recipients || smsUsers?.map(u => u.phone).filter(Boolean) || [];
  if (phones.length === 0) {
    return { success: false, error: 'No SMS recipients found. Users need to add a phone number and opt in via their profile.' };
  }

  let sent = 0;
  const errors = [];
  for (const phone of phones) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
        },
        body: new URLSearchParams({ To: phone, From: from, Body: message })
      });
      const data = await res.json();
      if (data.sid) sent++;
      else errors.push(`${phone}: ${data.message || 'Failed'}`);
    } catch (err) {
      errors.push(`${phone}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 100)); // Rate limit
  }

  return { success: sent > 0, sent, total: phones.length, errors };
}
```

**SQL** (run in Supabase SQL Editor):
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;
NOTIFY pgrst, 'reload schema';
```

---

## TASK 4: Add Twitter/X API

**File**: `api/distribute.js`

Add to switch:
```javascript
case 'post-twitter':
  result = await postTwitter(req.body);
  break;
```

Add function (install `twitter-api-v2` first: `npm install twitter-api-v2`):

```javascript
async function postTwitter({ event, content }) {
  // Check for API keys
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  
  if (!apiKey || !accessToken) {
    return { success: false, error: 'Twitter API not configured. Add TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET to Vercel env vars.' };
  }

  const text = (content?.twitterPost || content?.socialFacebook || event.title).substring(0, 280);
  
  try {
    // Use twitter-api-v2 package
    const { TwitterApi } = await import('twitter-api-v2');
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessSecret,
    });
    
    const { data } = await client.v2.tweet(text);
    return { 
      success: true, 
      tweetId: data.id, 
      tweetUrl: `https://twitter.com/i/status/${data.id}` 
    };
  } catch (err) {
    return { success: false, error: `Twitter: ${err.message}` };
  }
}
```

**File**: `api/generate.js` — Update the `social_post` user prompt to generate FOUR posts:

Find the `case 'social_post':` in `buildUserPrompt` and replace:
```javascript
case 'social_post':
  return `Create social media posts for:\n\n${eventInfo}\n\nCreate FOUR posts:\n1. **Facebook**: Community-oriented, longer form (2-3 paragraphs)\n2. **Instagram Caption**: Visual-first, include hashtags (#SanAntonio #SATX #LiveMusic #SAarts)\n3. **LinkedIn**: Professional angle, industry credible, cultural significance\n4. **Twitter/X**: Under 280 characters. Punchy, conversational. One hashtag max. Include ticket link if available.\n\nLabel each clearly with the platform name as a header.`;
```

---

## TASK 5: Calendar Submission API (Do210, SA Current, Evvnt)

Puppeteer can't run on Vercel serverless (no browser binary). Two options:

### Option A: Proxy through local machine (recommended for now)
Create an API endpoint that queues the submission and a local worker that processes it.

**File**: `api/distribute.js` — Add to switch:
```javascript
case 'submit-calendars':
  result = await submitCalendars(req.body);
  break;
```

```javascript
async function submitCalendars({ event, venue, content }) {
  // Store submission request in Supabase for the local Puppeteer worker to pick up
  const { data, error } = await supabase
    .from('calendar_submissions')
    .insert({
      event_id: event.id,
      event_data: { ...event, venue: venue?.name, address: venue?.address, city: venue?.city, state: venue?.state },
      platforms: ['do210', 'sacurrent', 'evvnt'],
      status: 'pending',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to queue submission: ${error.message}`);

  return { 
    success: true, 
    message: 'Calendar submissions queued. Do210, SA Current, and Evvnt will be submitted within 5 minutes.',
    submissionId: data.id,
    platforms: ['Do210', 'SA Current', 'Evvnt (→ Express-News, MySA, 100+ sites)']
  };
}
```

**SQL** (run in Supabase SQL Editor):
```sql
CREATE TABLE IF NOT EXISTS calendar_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  event_data JSONB NOT NULL,
  platforms TEXT[] DEFAULT '{"do210","sacurrent","evvnt"}',
  status TEXT DEFAULT 'pending',
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- No RLS (matches existing pattern)
ALTER TABLE calendar_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE calendar_submissions NO FORCE ROW LEVEL SECURITY;
GRANT ALL ON calendar_submissions TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
```

### Option B (future): Move Puppeteer to a dedicated worker

For production, deploy the Puppeteer scripts to:
- A Render/Railway background worker
- An AWS Lambda with chrome-aws-lambda
- A fly.io machine

The worker polls `calendar_submissions` where `status = 'pending'`, runs the Puppeteer scripts from `submit-events.js`, and updates the row with results.

### Local Worker Script

**New file**: `worker/calendar-worker.js`

```javascript
#!/usr/bin/env node
// Polls Supabase for pending calendar submissions and runs Puppeteer
// Run locally: node worker/calendar-worker.js

const { createClient } = require('@supabase/supabase-js');
const { submitDo210, submitSACurrent, submitEvvnt } = require('../submit-events.js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const POLL_INTERVAL = 30000; // 30 seconds

async function processPending() {
  const { data: pending } = await supabase
    .from('calendar_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);

  if (!pending?.length) return;

  for (const submission of pending) {
    console.log(`\n🔄 Processing submission ${submission.id}...`);
    const event = submission.event_data;
    const results = {};

    // Mark as processing
    await supabase.from('calendar_submissions').update({ status: 'processing' }).eq('id', submission.id);

    for (const platform of submission.platforms) {
      try {
        if (platform === 'do210') results.do210 = await submitDo210(event);
        else if (platform === 'sacurrent') results.sacurrent = await submitSACurrent(event);
        else if (platform === 'evvnt') results.evvnt = await submitEvvnt(event);
      } catch (err) {
        results[platform] = { success: false, error: err.message };
      }
    }

    // Update with results
    await supabase.from('calendar_submissions').update({
      status: 'completed',
      results,
      processed_at: new Date().toISOString()
    }).eq('id', submission.id);

    console.log(`✅ Submission ${submission.id} completed`);
  }
}

async function main() {
  console.log('📅 Calendar submission worker started');
  console.log(`   Polling every ${POLL_INTERVAL / 1000}s...`);
  
  while (true) {
    try {
      await processPending();
    } catch (err) {
      console.error('Worker error:', err.message);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

main();
```

**IMPORTANT**: The existing `submit-events.js` has hardcoded venue defaults ("The Dakota East Side Ice House"). Update ALL default venue references to use the event data passed in:
- In `submitDo210`: Change `event.venue || 'The Dakota East Side Ice House'` to `event.venue || 'Venue TBD'`
- In `submitSACurrent`: Same change for venue and address defaults
- In `submitEvvnt`: Same change
- Remove ALL hardcoded "433 S. Hackberry St" addresses — use `event.address || ''`

---

## TASK 6: Update Distribution Results UI

**File**: `src/pages/IMCComposer.jsx`

Find the existing distribution results display section (look for `distributionResults.press` or `distributionResults.social`). Replace/update the social results section to show per-platform status:

```jsx
{distributionResults.social && (
  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
    <p className="font-semibold text-gray-700 m-0">📱 Social Distribution</p>
    {distributionResults.social.facebook && (
      <p className="m-0 ml-2">
        {distributionResults.social.facebook.success ? '✅' : '⚠️'} Facebook: {
          distributionResults.social.facebook.success 
            ? `Posted${distributionResults.social.facebook.event?.eventUrl ? ` · Event: ${distributionResults.social.facebook.event.eventUrl}` : ''}`
            : distributionResults.social.facebook.error || 'Not connected'
        }
      </p>
    )}
    {distributionResults.social.instagram && (
      <p className="m-0 ml-2">
        {distributionResults.social.instagram.success ? '✅' : '⚠️'} Instagram: {
          distributionResults.social.instagram.success ? 'Posted' : distributionResults.social.instagram.error || 'Not connected'
        }
      </p>
    )}
    {distributionResults.social.linkedin && (
      <p className="m-0 ml-2">
        {distributionResults.social.linkedin.success ? '✅' : '⚠️'} LinkedIn: {
          distributionResults.social.linkedin.success 
            ? `Posted${distributionResults.social.linkedin.postUrl ? ` · ${distributionResults.social.linkedin.postUrl}` : ''}`
            : distributionResults.social.linkedin.error || 'Not connected'
        }
      </p>
    )}
    {distributionResults.social.twitter && (
      <p className="m-0 ml-2">
        {distributionResults.social.twitter.success ? '✅' : '⚠️'} Twitter/X: {
          distributionResults.social.twitter.success 
            ? `Tweeted${distributionResults.social.twitter.tweetUrl ? ` · ${distributionResults.social.twitter.tweetUrl}` : ''}`
            : distributionResults.social.twitter.error || 'Not connected'
        }
      </p>
    )}
    {distributionResults.social.calendars && (
      <p className="m-0 ml-2">
        {distributionResults.social.calendars.success ? '✅' : '⚠️'} Do210/SA Current/Evvnt: {
          distributionResults.social.calendars.success ? distributionResults.social.calendars.message : distributionResults.social.calendars.error || 'Not connected'
        }
      </p>
    )}
  </div>
)}
```

---

## TASK 7: Update Content Generation for Twitter

**File**: `api/generate.js`

In the `buildUserPrompt` function, find `case 'social_post':` and replace its return statement with:

```javascript
case 'social_post':
  return `Create social media posts for:\n\n${eventInfo}\n\nCreate FOUR platform-specific posts:\n\n1. **Facebook**: Community-oriented, conversational, 2-3 paragraphs. Include venue details and ticket link.\n2. **Instagram Caption**: Visual-first language, include 8-12 relevant hashtags (#SanAntonio #SATX #LiveMusic #SAarts #SanAntonioEvents). End with "Link in bio" if ticket link exists.\n3. **LinkedIn**: Professional angle, cultural/industry significance, 1-2 paragraphs. Include event link.\n4. **Twitter/X**: MAXIMUM 280 characters. Punchy, conversational. One hashtag max. Include shortened ticket link if space allows.\n\nLabel each section clearly with the platform name as a bold header.`;
```

---

## Summary of ALL Changes

| File | What to Do |
|------|-----------|
| `src/pages/IMCComposer.jsx` | Add `parseSocialContent()`, rewrite social/email/sms distribute blocks, update results UI |
| `api/distribute.js` | Add `post-twitter`, `send-email-blast`, `send-sms`, `submit-calendars` actions + functions |
| `api/generate.js` | Update `social_post` prompt to generate 4 posts (add Twitter/X) |
| `submit-events.js` | Remove hardcoded Dakota/Hackberry defaults, use event data |
| `worker/calendar-worker.js` | NEW — local Puppeteer worker that polls Supabase |
| `package.json` | Add `twitter-api-v2` dependency |

## Environment Variables to Add (Vercel Dashboard)

```
TWITTER_API_KEY=           # Twitter Developer Portal → Keys and Tokens
TWITTER_API_SECRET=        # Twitter Developer Portal → Keys and Tokens  
TWITTER_ACCESS_TOKEN=      # Twitter Developer Portal → Authentication Tokens
TWITTER_ACCESS_TOKEN_SECRET= # Twitter Developer Portal → Authentication Tokens
TWILIO_ACCOUNT_SID=        # Twilio Console → Account Info
TWILIO_AUTH_TOKEN=         # Twilio Console → Account Info
TWILIO_PHONE_NUMBER=       # Twilio Console → Phone Numbers (format: +12105551234)
```

## Supabase SQL to Run

```sql
-- Email opt-in
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT false;

-- SMS fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;

-- Calendar submissions queue
CREATE TABLE IF NOT EXISTS calendar_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  event_data JSONB NOT NULL,
  platforms TEXT[] DEFAULT '{"do210","sacurrent","evvnt"}',
  status TEXT DEFAULT 'pending',
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE calendar_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_submissions NO FORCE ROW LEVEL SECURITY;
GRANT ALL ON calendar_submissions TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
```

## Critical Notes

1. **Graceful degradation**: Every platform call is wrapped in try/catch. If Facebook works but LinkedIn doesn't, the user sees per-platform results. NEVER fail the entire distribution because one platform is down.
2. **Instagram REQUIRES a publicly accessible HTTPS image URL**. Base64 data URLs won't work. Images must be uploaded to Supabase Storage or another CDN first, then the public URL passed to the IG API.
3. **No duplicate posts**: Before posting, check `campaign_tracker` for existing posts to this event on this platform. If found, warn the user and require confirmation.
4. **The `getEventVenue(selectedEvent)` function** (already in IMCComposer.jsx) builds venue data from the EVENT's fields, not the logged-in user's profile. Use it for ALL distribute calls. This was a bug that caused wrong venue names.
5. **submit-events.js hardcoded defaults**: The Puppeteer scripts have "The Dakota East Side Ice House" and "433 S. Hackberry St" hardcoded as fallback values. Change ALL of these to use the event's own venue data or 'Venue TBD' / empty string.
6. **Vercel Hobby plan limit**: 12 serverless functions max. Current count is 11. The new `send-sms`, `send-email-blast`, `submit-calendars`, and `post-twitter` actions are all inside the existing `api/distribute.js` function, so NO new function files are needed. Do NOT create separate API files for these.
