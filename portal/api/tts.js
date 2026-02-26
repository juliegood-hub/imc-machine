// Vercel serverless function: Google Cloud TTS via service account
// POST /api/tts { text, speaker }

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createSign } from 'crypto';

async function getAccessToken() {
  const sa = JSON.parse(readFileSync(resolve(process.cwd(), 'service-account.json'), 'utf8'));
  
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${claim}`);
  const signature = sign.sign(sa.private_key, 'base64url');

  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

const VOICES = {
  ALEX: { name: 'en-US-Journey-F', pitch: 0, speakingRate: 1.0 },
  SAM: { name: 'en-US-Journey-D', pitch: -1, speakingRate: 0.95 },
};

const FALLBACK_VOICES = {
  ALEX: { name: 'en-US-Neural2-F', pitch: 0, speakingRate: 1.0 },
  SAM: { name: 'en-US-Neural2-D', pitch: -1, speakingRate: 0.95 },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Send this endpoint a POST request and I can generate audio.' });
  }

  const { text, speaker = 'ALEX' } = req.body;
  if (!text) return res.status(400).json({ error: 'Give me text to speak and I will handle the audio.' });

  try {
    const token = await getAccessToken();
    const voice = VOICES[speaker] || VOICES.ALEX;

    let ttsRes = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'en-US', name: voice.name },
        audioConfig: {
          audioEncoding: 'MP3',
          pitch: voice.pitch,
          speakingRate: voice.speakingRate,
          effectsProfileId: ['headphone-class-device'],
        },
      }),
    });

    let data = await ttsRes.json();

    // Try fallback voice if primary fails
    if (data.error) {
      const fallback = FALLBACK_VOICES[speaker] || FALLBACK_VOICES.ALEX;
      ttsRes = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'en-US', name: fallback.name },
          audioConfig: { audioEncoding: 'MP3', pitch: fallback.pitch, speakingRate: fallback.speakingRate },
        }),
      });
      data = await ttsRes.json();
      if (data.error) throw new Error(data.error.message);
    }

    return res.status(200).json({ audioContent: data.audioContent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
