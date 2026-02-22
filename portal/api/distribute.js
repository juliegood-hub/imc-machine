// ═══════════════════════════════════════════════════════════════
// IMC Machine: Server-Side Distribution API
// Vercel Serverless Function
//
// All external API calls happen HERE, not in the browser.
// POST /api/distribute
// Body: { action, event, venue, content, images, channels }
//
// Actions:
//   send-email       → Resend API
//   create-eventbrite → Eventbrite API
//   post-facebook    → Facebook Graph API
//   post-instagram   → Instagram Graph API (via FB)
//   post-linkedin    → LinkedIn API
//   submit-do210     → Do210 (returns form data, manual or Puppeteer)
//   distribute-all   → Run all selected channels
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ═══════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT - Reads from env vars first, then Supabase
// ═══════════════════════════════════════════════════════════════

async function getToken(platform) {
  // 1. Check env var first
  const envMap = { 
    facebook: 'FB_PAGE_ACCESS_TOKEN', 
    youtube: 'YOUTUBE_ACCESS_TOKEN',
    linkedin: 'LINKEDIN_ACCESS_TOKEN'
  };
  if (envMap[platform] && process.env[envMap[platform]]) {
    return { token: process.env[envMap[platform]], source: 'env', metadata: {} };
  }
  
  // 2. Fall back to Supabase app_settings (oauth_{platform})
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', `oauth_${platform}`)
    .single();
  
  if (!data?.value) return null;
  
  const conn = data.value;
  
  // 3. For YouTube: auto-refresh if expired
  if (platform === 'youtube') {
    const isExpired = conn.expires_at && new Date() > new Date(conn.expires_at);
    if (isExpired && conn.refresh_token) {
      const refreshed = await refreshYouTubeToken(conn);
      return refreshed; // already returns { token, source, metadata }
    }
  }
  
  return {
    token: conn.access_token,
    source: 'supabase',
    metadata: conn
  };
}

async function refreshYouTubeToken(connection) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('YouTube client credentials not configured');
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    }

    // Update stored token
    const updatedConnection = {
      ...connection,
      access_token: data.access_token,
      expires_at: new Date(Date.now() + (data.expires_in * 1000)).toISOString()
    };

    await supabase
      .from('app_settings')
      .upsert({
        key: 'oauth_youtube',
        value: updatedConnection
      }, { onConflict: 'key' });

    return {
      token: data.access_token,
      source: 'refreshed',
      metadata: updatedConnection
    };

  } catch (err) {
    throw new Error(`Failed to refresh YouTube token: ${err.message}`);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action, event, venue, content, images, channels, options } = req.body;

  if (!action) return res.status(400).json({ error: 'Missing action' });

  try {
    let result;
    switch (action) {
      case 'send-email':
        result = await sendEmail(req.body);
        break;
      case 'send-press-release':
        result = await sendPressRelease(event, venue, content, options);
        break;
      case 'create-eventbrite':
        result = await createEventbrite(event, venue, options);
        break;
      case 'post-facebook':
        result = await postFacebook(event, venue, content, images);
        break;
      case 'post-instagram':
        result = await postInstagram(event, venue, content, images);
        break;
      case 'post-linkedin':
        result = await postLinkedIn(event, venue, content, images);
        break;
      case 'post-twitter':
        result = await postTwitter(req.body);
        break;
      case 'send-email-blast':
        result = await sendEmailBlast(req.body);
        break;
      case 'send-sms':
        result = await sendSMS(req.body);
        break;
      case 'submit-calendars':
        result = await submitCalendars(req.body);
        break;
      case 'distribute-all':
        result = await distributeAll(event, venue, content, images, channels);
        break;
      case 'check-status':
        result = await checkAllStatus();
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error(`[distribute] ${action} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// EMAIL via Resend
// ═══════════════════════════════════════════════════════════════

async function sendEmail({ to, subject, html, from, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');

  // Use verified domain if available, otherwise fall back to Resend's test domain
  const defaultFrom = process.env.RESEND_FROM_EMAIL 
    || 'Good Creative Media <events@goodcreativemedia.com>';
  const fallbackFrom = 'Good Creative Media <onboarding@resend.dev>';

  let lastError = null;
  for (const sender of [from || defaultFrom, fallbackFrom]) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        reply_to: replyTo || 'thisisthegoodlife@juliegood.com',
      }),
    });
    const data = await response.json();
    if (data.id) return { emailId: data.id, message: `Email sent to ${Array.isArray(to) ? to.length + ' recipients' : to}`, from: sender };
    lastError = data.error?.message || 'Resend error';
    // If domain validation error, try fallback
    if (data.error?.message?.includes('not verified') || data.error?.message?.includes('not authorized')) continue;
    throw new Error(lastError);
  }
  throw new Error(lastError || 'Resend error');
}

// SA Media Contacts - Embedded from distribution list
const SA_MEDIA_CONTACTS = {
  tv: [
    { name: 'KSAT 12 Community Calendar', email: 'community@ksat.com', outlet: 'KSAT 12 (ABC)' },
    { name: 'Great Day SA', email: 'greatdaysa@kens5.com', outlet: 'KENS 5 (CBS)' },
    { name: 'News 4 SA Entertainment', email: 'news@news4sanantonio.com', outlet: 'WOAI/News 4 SA (NBC)' },
    { name: 'Daytime SA', email: 'daytime@kabb.com', outlet: 'KABB Fox 29' },
    { name: 'KLRN Arts & Culture', email: 'info@klrn.org', outlet: 'KLRN (PBS)' }
  ],
  radio: [
    { name: 'Texas Public Radio Arts', email: 'arts@tpr.org', outlet: 'TPR/KSTX 89.1' },
    { name: 'KRTU Music', email: 'music@krtu.org', outlet: 'KRTU 91.7' }
  ],
  print: [
    { name: 'S.A. Life', email: 'salife@express-news.net', outlet: 'San Antonio Express-News' },
    { name: 'SA Current Calendar', email: 'calendar@sacurrent.com', outlet: 'San Antonio Current' },
    { name: 'SA Report Tips', email: 'tips@sanantonioreport.org', outlet: 'San Antonio Report' },
    { name: 'SA Magazine Editorial', email: 'editorial@sanantoniomag.com', outlet: 'San Antonio Magazine' },
    { name: 'La Prensa Editor', email: 'editor@laprensatexas.com', outlet: 'La Prensa Texas' },
    { name: 'Out In SA', email: 'info@outinsa.com', outlet: 'Out In SA' }
  ],
  orgs: [
    { name: 'Visit San Antonio PR', email: 'pr@visitsanantonio.com', outlet: 'Visit San Antonio' }
  ]
};

function getAllPressContacts() {
  return [
    ...SA_MEDIA_CONTACTS.tv,
    ...SA_MEDIA_CONTACTS.radio,
    ...SA_MEDIA_CONTACTS.print,
    ...SA_MEDIA_CONTACTS.orgs
  ];
}

async function sendPressRelease(event, venue, content, options = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');

  // Use provided recipients or default to all SA media contacts
  const recipients = options.recipients && options.recipients.length > 0 
    ? options.recipients 
    : getAllPressContacts();

  if (!recipients.length) throw new Error('No recipients available');

  // Build proper HTML email content
  const pressReleaseHtml = buildPressReleaseHTML(event, venue, content);

  const results = [];
  for (const r of recipients) {
    try {
      const fromAddr = process.env.RESEND_FROM_EMAIL || 'Good Creative Media <events@goodcreativemedia.com>';
      let data;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromAddr,
          to: [r.email],
          subject: `Press Release: ${event.title}`,
          html: pressReleaseHtml,
          reply_to: 'thisisthegoodlife@juliegood.com',
        }),
      });
      data = await response.json();
      // If domain not verified, retry with Resend test domain
      if (data.error && (data.error.message?.includes('not verified') || data.error.message?.includes('not authorized'))) {
        const retryRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Good Creative Media <onboarding@resend.dev>',
            to: [r.email],
            subject: `Press Release: ${event.title}`,
            html: pressReleaseHtml,
            reply_to: 'thisisthegoodlife@juliegood.com',
          }),
        });
        data = await retryRes.json();
      }
      results.push({ 
        email: r.email, 
        name: r.name, 
        outlet: r.outlet,
        success: !!data.id, 
        id: data.id, 
        error: data.error?.message 
      });
    } catch (err) {
      results.push({ 
        email: r.email, 
        name: r.name, 
        outlet: r.outlet,
        success: false, 
        error: err.message 
      });
    }
    // Rate limit: 100ms between sends
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const sent = results.filter(r => r.success).length;
  return { sent, total: recipients.length, results };
}

function buildPressReleaseHTML(event, venue, content) {
  const pressText = typeof content === 'string' ? content : (content.pressRelease || content.press || content.html || '');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Press Release: ${event.title}</title>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #c8a45e; padding-bottom: 10px; margin-bottom: 20px; }
    .company { color: #0d1b2a; font-weight: bold; }
    .dateline { font-weight: bold; margin-bottom: 10px; }
    .content { white-space: pre-line; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">Good Creative Media</div>
    <div style="font-size: 12px; color: #666;">Integrated Marketing Communications | San Antonio, TX</div>
  </div>
  
  <div class="dateline">SAN ANTONIO, TX — ${new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} —</div>
  
  <div class="content">${pressText}</div>
  
  <div class="footer">
    <p><strong>Contact:</strong><br>
    Good Creative Media<br>
    Phone: (210) 555-0199<br>
    Email: events@goodcreativemedia.com<br>
    Web: goodcreativemedia.com</p>
    
    <p><strong>About Good Creative Media:</strong> San Antonio-based integrated marketing communications agency specializing in arts venues, live music, theater, and cultural events.</p>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// EVENTBRITE
// ═══════════════════════════════════════════════════════════════

async function createEventbrite(event, venue, options = {}) {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) throw new Error('EVENTBRITE_TOKEN not configured');

  const orgId = process.env.EVENTBRITE_ORG_ID || '276674179461';
  const venueId = process.env.EVENTBRITE_VENUE_ID || '296501198';

  const startLocal = `${event.date}T${convertTo24h(event.time || '19:00')}:00`;
  const endLocal = event.endTime
    ? `${event.endDate || event.date}T${convertTo24h(event.endTime)}:00`
    : `${event.date}T${convertTo24h(event.time || '19:00', 3)}:00`;

  // Create event
  const createRes = await fetch(`https://www.eventbriteapi.com/v3/organizations/${orgId}/events/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: {
        name: { html: event.title },
        description: { html: event.description || event.title },
        start: { timezone: 'America/Chicago', utc: localToUTC(startLocal) },
        end: { timezone: 'America/Chicago', utc: localToUTC(endLocal) },
        currency: 'USD',
        venue_id: options.venueId || venueId,
        listed: true,
        shareable: true,
        online_event: false,
      },
    }),
  });
  const created = await createRes.json();
  if (created.error) throw new Error(created.error_description || created.error);

  const eventId = created.id;

  // Add ticket class
  const ticketRes = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticket_class: {
        name: event.isFree || !event.ticketPrice ? 'General Admission (Free)' : 'General Admission',
        free: event.isFree || !event.ticketPrice,
        ...(event.ticketPrice ? { cost: `USD,${Math.round(event.ticketPrice * 100)}` } : {}),
        quantity_total: options.capacity || 100,
      },
    }),
  });
  const ticket = await ticketRes.json();

  // Publish
  const pubRes = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/publish/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const pub = await pubRes.json();

  return {
    eventId,
    eventUrl: `https://www.eventbrite.com/e/${eventId}`,
    ticketClassId: ticket.id,
    published: pub.published || false,
  };
}

// ═══════════════════════════════════════════════════════════════
// FACEBOOK (Events + Feed Posts)
// ═══════════════════════════════════════════════════════════════

async function postFacebook(event, venue, content, images) {
  const tokenData = await getToken('facebook');
  const token = tokenData.token;
  
  // Get page ID from stored connection or fallback to env var
  let pageId = process.env.FB_PAGE_ID || '522058047815423';
  if (tokenData.source === 'supabase' && tokenData.metadata?.page_id) {
    pageId = tokenData.metadata.page_id;
  }

  const results = { event: null, feedPost: null };

  // Create Facebook Event
  try {
    const startDatetime = new Date(`${event.date}T${convertTo24h(event.time || '19:00')}:00-06:00`);
    const endDatetime = event.endTime
      ? new Date(`${event.endDate || event.date}T${convertTo24h(event.endTime)}:00-06:00`)
      : new Date(startDatetime.getTime() + 3 * 3600000);

    const evtRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token,
        name: event.title,
        description: buildFBDescription(event, venue),
        start_time: startDatetime.toISOString(),
        end_time: endDatetime.toISOString(),
        place: {
          name: venue?.name || 'Venue TBD',
          location: {
            street: venue?.address || '',
            city: venue?.city || 'San Antonio',
            state: venue?.state || 'TX',
            country: 'US',
          },
        },
        ticket_uri: event.ticketLink || '',
      }),
    });
    const evtData = await evtRes.json();
    if (evtData.error) throw new Error(evtData.error.message);
    results.event = {
      success: true,
      eventId: evtData.id,
      eventUrl: `https://www.facebook.com/events/${evtData.id}`,
    };
  } catch (err) {
    results.event = { success: false, error: err.message };
  }

  // Feed post with image
  try {
    const imageUrl = images?.fb_post_landscape || images?.fb_event_banner;
    const message = content?.socialFacebook || content?.pressRelease?.substring(0, 500) || event.title;

    if (imageUrl) {
      const postRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token, url: imageUrl, message }),
      });
      const postData = await postRes.json();
      if (postData.error) throw new Error(postData.error.message);
      results.feedPost = { success: true, postId: postData.id };
    } else {
      const postRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token, message }),
      });
      const postData = await postRes.json();
      if (postData.error) throw new Error(postData.error.message);
      results.feedPost = { success: true, postId: postData.id };
    }
  } catch (err) {
    results.feedPost = { success: false, error: err.message };
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// INSTAGRAM
// ═══════════════════════════════════════════════════════════════

async function postInstagram(event, venue, content, images) {
  const tokenData = await getToken('instagram'); // Same as Facebook token
  const token = tokenData.token;
  
  // Get page and Instagram IDs from stored connection or env vars
  let pageId = process.env.FB_PAGE_ID || '522058047815423';
  let igId = null;
  
  if (tokenData.source === 'supabase' && tokenData.metadata?.page_id) {
    pageId = tokenData.metadata.page_id;
    if (tokenData.metadata.instagram_account?.id) {
      igId = tokenData.metadata.instagram_account.id;
    }
  }
  
  // If we don't have IG ID from stored data, fetch it
  if (!igId) {
    const igRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${token}`);
    const igData = await igRes.json();
    if (igData.error) throw new Error(igData.error.message);
    if (!igData.instagram_business_account?.id) {
      throw new Error('No Instagram Business account linked. Connect one in Meta Business Suite.');
    }
    igId = igData.instagram_business_account.id;
  }

  const imageUrl = images?.ig_post_square || images?.ig_post_portrait;
  if (!imageUrl) throw new Error('No Instagram image URL provided. Images must be publicly accessible HTTPS URLs.');

  const caption = buildIGCaption(event, venue);

  // Create container
  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, image_url: imageUrl, caption }),
  });
  const container = await containerRes.json();
  if (container.error) throw new Error(`IG container: ${container.error.message}`);

  // Publish
  const pubRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, creation_id: container.id }),
  });
  const pub = await pubRes.json();
  if (pub.error) throw new Error(`IG publish: ${pub.error.message}`);

  return { success: true, mediaId: pub.id, igAccountId: igId };
}

// ═══════════════════════════════════════════════════════════════
// LINKEDIN
// ═══════════════════════════════════════════════════════════════

async function postLinkedIn(event, venue, content, images) {
  const tokenData = await getToken('linkedin');
  const token = tokenData.token;
  
  // Get organization ID from stored connection or env var
  let orgId = process.env.LINKEDIN_ORG_ID || '2944916';
  if (tokenData.source === 'supabase' && tokenData.metadata?.organizations?.length > 0) {
    orgId = tokenData.metadata.organizations[0].id; // Use first organization
  }

  const author = `urn:li:organization:${orgId}`;
  const text = buildLinkedInText(event, venue, content);

  const imageUrl = images?.linkedin_post || images?.fb_post_landscape;

  let imageUrn = null;
  if (imageUrl) {
    // Register upload
    const regRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401',
      },
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    });
    const regData = await regRes.json();
    if (regData.value) {
      // Upload image
      const imgRes = await fetch(imageUrl);
      const imgBuffer = await imgRes.arrayBuffer();
      await fetch(regData.value.uploadUrl, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: imgBuffer,
      });
      imageUrn = regData.value.image;
    }
  }

  const postBody = {
    author,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
  };
  if (imageUrn) {
    postBody.content = { media: { title: event.title, id: imageUrn } };
  }

  const postRes = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    },
    body: JSON.stringify(postBody),
  });

  if (postRes.status === 201) {
    const postId = postRes.headers.get('x-restli-id');
    return { success: true, postId, postUrl: postId ? `https://www.linkedin.com/feed/update/${postId}` : null };
  }
  const err = await postRes.json().catch(() => ({}));
  throw new Error(`LinkedIn post failed (${postRes.status}): ${err.message || JSON.stringify(err)}`);
}

async function postTwitter({ event, content }) {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  if (!apiKey || !accessToken) {
    return { success: false, error: 'Twitter API not configured. Add TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET to Vercel env vars.' };
  }
  const text = (content?.twitterPost || content?.socialFacebook || event.title).substring(0, 280);
  try {
    const { TwitterApi } = await import('twitter-api-v2');
    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });
    const { data } = await client.v2.tweet(text);
    return { success: true, tweetId: data.id, tweetUrl: `https://twitter.com/i/status/${data.id}` };
  } catch (err) {
    return { success: false, error: `Twitter: ${err.message}` };
  }
}

async function sendEmailBlast({ event, venue, content }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  const emailText = typeof content === 'string' ? content : (content.emailBlast || content.email || '');
  const subjectMatch = emailText.match(/subject\s*(?:line)?[:\s]*(.+)/i);
  const subject = subjectMatch ? subjectMatch[1].trim().replace(/^["']|["']$/g, '') : `${event.title} — Event Announcement`;
  const previewMatch = emailText.match(/preview\s*(?:text)?[:\s]*(.+)/i);
  const preview = previewMatch ? previewMatch[1].trim().replace(/^["']|["']$/g, '') : '';
  let body = emailText.replace(/subject\s*(?:line)?[:\s]*.+/i, '').replace(/preview\s*(?:text)?[:\s]*.+/i, '').trim();

  const { data: subscribers } = await supabase.from('profiles').select('email').not('email', 'is', null).eq('email_opt_in', true);
  const recipients = subscribers?.map(s => s.email).filter(Boolean) || [];
  if (recipients.length === 0) return { success: false, error: 'No email subscribers. Users must opt in via profile settings.' };

  const venueName = venue?.name || 'San Antonio Venue';
  const eventDate = event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Inter,Helvetica,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5}.container{max-width:600px;margin:0 auto;background:#fff}.header{background:#0d1b2a;color:#c8a45e;padding:30px;text-align:center}.header h1{margin:0;font-size:24px;color:#c8a45e}.body{padding:30px;white-space:pre-line}.event-card{background:#faf8f3;border-left:4px solid #c8a45e;padding:20px;margin:20px 0;border-radius:4px}.cta{display:inline-block;background:#c8a45e;color:#0d1b2a;padding:14px 28px;text-decoration:none;font-weight:bold;border-radius:6px;margin:20px 0}.footer{background:#0d1b2a;color:#888;padding:20px;text-align:center;font-size:12px}.footer a{color:#c8a45e}</style></head><body><div class="container"><div class="header"><h1>${event.title}</h1><p style="color:#aaa;margin:5px 0 0">Presented by Good Creative Media</p></div><div class="body"><div class="event-card"><strong>📅 ${eventDate}${event.time ? ' · ' + event.time : ''}</strong><br><strong>📍 ${venueName}</strong>${venue?.address ? '<br>' + venue.address + ', ' + (venue.city || 'San Antonio') + ', ' + (venue.state || 'TX') : ''}</div>${body}${event.ticketLink ? `<p style="text-align:center"><a href="${event.ticketLink}" class="cta">Get Tickets</a></p>` : ''}</div><div class="footer"><p>Good Creative Media · San Antonio, TX<br><a href="https://goodcreativemedia.com">goodcreativemedia.com</a></p><p style="font-size:10px">You opted in to event announcements.</p></div></div></body></html>`;

  let sent = 0;
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    try {
      const fromAddr = process.env.RESEND_FROM_EMAIL || 'Good Creative Media <events@goodcreativemedia.com>';
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromAddr, to: batch, subject, html, reply_to: 'thisisthegoodlife@juliegood.com' }),
      });
      const data = await response.json();
      if (data.id) { sent += batch.length; }
      else if (data.error?.message?.includes('not verified')) {
        const retryRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Good Creative Media <onboarding@resend.dev>', to: batch, subject, html, reply_to: 'thisisthegoodlife@juliegood.com' }),
        });
        const retryData = await retryRes.json();
        if (retryData.id) sent += batch.length;
      }
    } catch (err) { /* continue */ }
    await new Promise(r => setTimeout(r, 200));
  }
  return { success: sent > 0, sent, total: recipients.length };
}

async function sendSMS({ event, content, recipients }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return { success: false, error: 'Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to Vercel env vars.' };

  const message = content?.smsText || (typeof content === 'string' ? content : event.title);
  const { data: smsUsers } = await supabase.from('profiles').select('phone').not('phone', 'is', null).eq('sms_opt_in', true);
  const phones = recipients || smsUsers?.map(u => u.phone).filter(Boolean) || [];
  if (phones.length === 0) return { success: false, error: 'No SMS recipients. Users must add phone and opt in.' };

  let sent = 0;
  for (const phone of phones) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
        body: new URLSearchParams({ To: phone, From: from, Body: message })
      });
      const data = await res.json();
      if (data.sid) sent++;
    } catch (err) { /* continue */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return { success: sent > 0, sent, total: phones.length };
}

async function submitCalendars({ event, venue }) {
  const { data, error } = await supabase.from('calendar_submissions').insert({
    event_id: event.id,
    event_data: { ...event, venue: venue?.name, address: venue?.address, city: venue?.city, state: venue?.state },
    platforms: ['do210', 'sacurrent', 'evvnt'],
    status: 'pending',
    created_at: new Date().toISOString()
  }).select().single();
  if (error) throw new Error(`Queue failed: ${error.message}`);
  return { success: true, message: 'Calendar submissions queued for Do210, SA Current, Evvnt.', submissionId: data.id };
}

// ═══════════════════════════════════════════════════════════════
// DISTRIBUTE ALL — Fire all selected channels
// ═══════════════════════════════════════════════════════════════

async function distributeAll(event, venue, content, images, channels = []) {
  const results = {};
  const allChannels = channels.length ? channels : ['email', 'eventbrite', 'facebook', 'instagram', 'linkedin'];

  const tasks = allChannels.map(async (ch) => {
    try {
      switch (ch) {
        case 'email':
        case 'press':
          results.email = await sendPressRelease(event, venue, content, { recipients: content.recipients || [] });
          break;
        case 'eventbrite':
          results.eventbrite = await createEventbrite(event, venue, {});
          break;
        case 'facebook':
          results.facebook = await postFacebook(event, venue, content, images);
          break;
        case 'instagram':
          results.instagram = await postInstagram(event, venue, content, images);
          break;
        case 'linkedin':
          results.linkedin = await postLinkedIn(event, venue, content, images);
          break;
        default:
          results[ch] = { success: false, error: `Unknown channel: ${ch}` };
      }
    } catch (err) {
      results[ch] = { success: false, error: err.message };
    }
  });

  await Promise.all(tasks);

  const succeeded = Object.entries(results).filter(([, r]) => r.success || r.sent > 0).map(([k]) => k);
  const failed = Object.entries(results).filter(([, r]) => !r.success && !(r.sent > 0)).map(([k]) => k);

  return { results, summary: { succeeded, failed, total: allChannels.length } };
}

// ═══════════════════════════════════════════════════════════════
// CHECK STATUS — Which channels are configured?
// ═══════════════════════════════════════════════════════════════

async function checkAllStatus() {
  const status = {
    email: { ready: !!process.env.RESEND_API_KEY, provider: 'Resend' },
    eventbrite: { ready: !!process.env.EVENTBRITE_TOKEN, provider: 'Eventbrite' },
    facebook: { ready: false, provider: 'Meta Graph API' },
    instagram: { ready: false, provider: 'Meta Graph API (needs IG link)' },
    linkedin: { ready: false, provider: 'LinkedIn Marketing API' },
    youtube: { ready: false, provider: 'YouTube Data API' },
  };

  // Check OAuth connections
  try {
    for (const platform of ['facebook', 'instagram', 'linkedin', 'youtube']) {
      try {
        await getToken(platform);
        status[platform].ready = true;
      } catch (err) {
        // Token not available or expired
        status[platform].ready = false;
        status[platform].error = err.message;
      }
    }
  } catch (err) {
    console.error('Error checking OAuth status:', err);
  }

  return status;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function convertTo24h(timeStr, addHours = 0) {
  if (!timeStr) return '19:00';
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return '19:00';
  let h = parseInt(match[1]);
  const m = match[2];
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  h += addHours;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function localToUTC(localDatetime) {
  // Assume CST (UTC-6)
  const d = new Date(localDatetime + '-06:00');
  return d.toISOString().replace('.000Z', 'Z');
}

function buildFBDescription(event, venue) {
  let desc = event.description || event.title;
  desc += '\n\n';
  if (venue?.name) desc += `📍 ${venue.name}\n`;
  if (venue?.address) desc += `${venue.address}, ${venue.city || 'San Antonio'}, ${venue.state || 'TX'}\n`;
  if (event.ticketLink) desc += `\n🎟️ Tickets: ${event.ticketLink}\n`;
  desc += '\nPresented by Good Creative Media\ngoodcreativemedia.com';
  return desc;
}

function buildIGCaption(event, venue) {
  const lines = [event.title, ''];
  if (event.date) {
    const d = new Date(event.date + 'T00:00:00');
    lines.push(`📅 ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${event.time ? ` · ${event.time}` : ''}`);
  }
  if (venue?.name) lines.push(`📍 ${venue.name}`);
  if (event.isFree) lines.push('🎟️ Free');
  else if (event.ticketLink) lines.push('🎟️ Link in bio');
  lines.push('', '#SanAntonio #SATX #LiveMusic #SanAntonioEvents');
  lines.push('', 'Presented by @goodcreativemedia');
  return lines.join('\n').substring(0, 2200);
}

function buildLinkedInText(event, venue, content) {
  const lines = [event.title, ''];
  if (event.date) {
    const d = new Date(event.date + 'T00:00:00');
    lines.push(`📅 ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${event.time ? ` · ${event.time}` : ''}`);
  }
  if (venue?.name) lines.push(`📍 ${venue.name}, San Antonio`);
  lines.push('');
  if (event.description) lines.push(event.description.substring(0, 800), '');
  if (event.ticketLink) lines.push(`🎟️ ${event.ticketLink}`, '');
  lines.push('#SanAntonio #LiveEvents #SATX');
  return lines.join('\n').substring(0, 3000);
}
