// ═══════════════════════════════════════════════════════════════
// IMC Machine: LinkedIn Publishing Service
// All API calls routed through /api/distribute (server-side)
// NO API keys in client code
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// OAUTH FLOW — Redirect user to LinkedIn auth page
// Client ID is needed client-side for the redirect URL only
// ═══════════════════════════════════════════════════════════════

export function getAuthUrl(redirectUri = 'https://imc.goodcreativemedia.com/auth/linkedin/callback') {
  // OAuth initiation goes through server to keep client_id server-side
  return `/api/distribute?action=linkedin-auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function exchangeCodeForToken(code, redirectUri = 'https://imc.goodcreativemedia.com/auth/linkedin/callback') {
  const res = await fetch('/api/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'linkedin-exchange-token',
      code,
      redirectUri,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'LinkedIn OAuth exchange failed');
  return data;
}

// ═══════════════════════════════════════════════════════════════
// POST TEXT to Company Page
// ═══════════════════════════════════════════════════════════════

export async function postText(text) {
  const res = await fetch('/api/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'post-linkedin',
      event: { title: text, description: text },
      venue: {},
      content: {},
      images: {},
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'LinkedIn post failed');
  return data;
}

// ═══════════════════════════════════════════════════════════════
// POST WITH IMAGE
// ═══════════════════════════════════════════════════════════════

export async function postWithImage(text, imageUrl) {
  const res = await fetch('/api/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'post-linkedin',
      event: { title: text, description: text },
      venue: {},
      content: {},
      images: { linkedin_post: imageUrl },
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'LinkedIn image post failed');
  return data;
}

// ═══════════════════════════════════════════════════════════════
// POST ARTICLE LINK
// ═══════════════════════════════════════════════════════════════

export async function postArticle(text, articleUrl, articleTitle = '') {
  const res = await fetch('/api/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'linkedin-article',
      text,
      articleUrl,
      articleTitle,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'LinkedIn article post failed');
  return data;
}

// ═══════════════════════════════════════════════════════════════
// BUILD LINKEDIN POST TEXT (client-side, no keys needed)
// ═══════════════════════════════════════════════════════════════

export function buildPostText(event, venue, research) {
  const lines = [];
  lines.push(event.title);
  lines.push('');

  if (event.date) {
    const d = new Date(event.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    lines.push(`📅 ${dateStr}${event.time ? ` · ${event.time}` : ''}`);
  }
  if (venue?.name) lines.push(`📍 ${venue.name}${venue.city ? `, ${venue.city}` : ''}`);
  lines.push('');

  if (event.description) {
    lines.push(event.description.substring(0, 1000));
    lines.push('');
  }
  if (event.ticketLink) {
    lines.push(`🎟️ ${event.ticketLink}`);
    lines.push('');
  }

  const tags = ['#SanAntonio', '#LiveEvents'];
  if (event.genre?.toLowerCase().includes('music')) tags.push('#LiveMusic');
  if (event.genre?.toLowerCase().includes('theater') || event.genre?.toLowerCase().includes('theatre')) tags.push('#Theater');
  if (event.genre?.toLowerCase().includes('comedy')) tags.push('#Comedy');
  tags.push('#SATX');
  lines.push(tags.slice(0, 5).join(' '));

  return lines.join('\n').substring(0, 3000);
}

// ═══════════════════════════════════════════════════════════════
// FULL FLOW: Build text + post with image to LinkedIn
// ═══════════════════════════════════════════════════════════════

export async function publishEventToLinkedIn(event, venue, research, images) {
  const text = buildPostText(event, venue, research);
  const imageUrl = images?.linkedin_post || images?.fb_post_landscape;

  if (imageUrl) {
    return await postWithImage(text, imageUrl);
  } else {
    return await postText(text);
  }
}

// ═══════════════════════════════════════════════════════════════
// CHECK STATUS
// ═══════════════════════════════════════════════════════════════

export async function checkStatus() {
  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'linkedin-status' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return { connected: true, ...data };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      setup: getSetupInstructions(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// SETUP INSTRUCTIONS
// ═══════════════════════════════════════════════════════════════

function getSetupInstructions() {
  return [
    '1. Go to linkedin.com/developers → Create App',
    '2. App name: "IMC Machine" · Company page: Good Creative Media',
    '3. Products tab → Request "Share on LinkedIn"',
    '4. Auth tab → Add redirect URL: https://imc.goodcreativemedia.com/auth/linkedin/callback',
    '5. Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORG_ID in Vercel env vars',
    '6. Run OAuth flow to get access token',
  ];
}
