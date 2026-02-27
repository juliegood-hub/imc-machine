// ═══════════════════════════════════════════════════════════════
// IMC Machine: YouTube Upload API (Server-Side)
// POST /api/youtube
// ═══════════════════════════════════════════════════════════════

import { ApiAuthError, requireApiAuth } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Send this endpoint a POST request and I can run it.' });

  const { action } = req.body || {};

  try {
    await requireApiAuth(req);
    if (action === 'get-access-token') {
      return res.status(200).json(await refreshAccessToken());
    }
    if (action === 'upload') {
      return res.status(200).json(await uploadVideo(req.body));
    }
    return res.status(400).json({ error: `I do not recognize "${action}" yet. Use get-access-token or upload.` });
  } catch (err) {
    console.error('[youtube]', err);
    if (err instanceof ApiAuthError) {
      return res.status(err.status || 401).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function refreshAccessToken() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('I need YouTube OAuth credentials before I can upload.');
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return { success: true, accessToken: data.access_token, expiresIn: data.expires_in };
}

async function uploadVideo({ title, description, tags, categoryId, audioBase64 }) {
  const { accessToken } = await refreshAccessToken();

  // Step 1: Create video metadata
  const metadata = {
    snippet: {
      title: title || 'GCM Presents',
      description: description || '',
      tags: tags || ['San Antonio', 'Live Music', 'Good Creative Media'],
      categoryId: categoryId || '10', // Music
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
    },
  };

  // Convert base64 audio to buffer
  const audioBuffer = Buffer.from(audioBase64, 'base64');

  // Resumable upload
  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Length': audioBuffer.length,
      'X-Upload-Content-Type': 'audio/mpeg',
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(`YouTube upload setup failed: ${err.error?.message || initRes.statusText}`);
  }

  const uploadUrl = initRes.headers.get('location');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': audioBuffer.length },
    body: audioBuffer,
  });

  const video = await uploadRes.json();
  if (video.error) throw new Error(video.error.message);

  return {
    success: true,
    videoId: video.id,
    videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
  };
}
