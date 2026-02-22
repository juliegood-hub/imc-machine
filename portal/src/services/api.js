// ═══════════════════════════════════════════════════════════════
// IMC Machine: Server-Side API Client
//
// All distribution calls go through /api/distribute
// which runs on Vercel's server (not in the browser).
// API keys live server-side only. No CORS issues.
// ═══════════════════════════════════════════════════════════════

const API_BASE = '/api';

async function callApi(endpoint, body) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok && !data.success) {
    throw new Error(data.error || `API error: ${res.status}`);
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════
// DISTRIBUTION
// ═══════════════════════════════════════════════════════════════

export async function distribute(action, payload) {
  return callApi('distribute', { action, ...payload });
}

export async function sendEmail({ to, subject, html, from, replyTo }) {
  return callApi('distribute', { action: 'send-email', to, subject, html, from, replyTo });
}

export async function sendPressRelease(event, venue, content, recipients) {
  return callApi('distribute', {
    action: 'send-press-release',
    event, venue, content,
    options: { recipients },
  });
}

export async function createEventbriteEvent(event, venue, options = {}) {
  return callApi('distribute', { action: 'create-eventbrite', event, venue, options });
}

export async function postToFacebook(event, venue, content, images) {
  return callApi('distribute', { action: 'post-facebook', event, venue, content, images });
}

export async function postToInstagram(event, venue, content, images) {
  return callApi('distribute', { action: 'post-instagram', event, venue, content, images });
}

export async function postToLinkedIn(event, venue, content, images) {
  return callApi('distribute', { action: 'post-linkedin', event, venue, content, images });
}

export async function distributeAll(event, venue, content, images, channels) {
  return callApi('distribute', { action: 'distribute-all', event, venue, content, images, channels });
}

export async function checkDistributionStatus() {
  return callApi('distribute', { action: 'check-status' });
}

// ═══════════════════════════════════════════════════════════════
// CONTENT GENERATION (still client-side for now, uses VITE_ keys)
// TODO: Move to /api/generate when ready
// ═══════════════════════════════════════════════════════════════

export async function generateContent(type, prompt) {
  // This stays client-side for now (OpenAI + Gemini)
  // Will move to serverless function next
  throw new Error('Use openai.js or research.js directly for now');
}
