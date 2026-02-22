import { parseLocalDate } from '../lib/dateUtils.js';
// ═══════════════════════════════════════════════════════════════
// IMC Machine — AI Podcast Generator
// 
// NotebookLM-style 2-voice podcast from press release content
// "Good Creative Media Presents" — event preview podcast
//
// Flow:
// 1. Gemini writes conversational 2-host script from press release + research
// 2. Google Cloud TTS generates audio for each host (2 distinct voices)
// 3. Audio segments are combined into a single MP3
// 4. Upload to YouTube as podcast episode on GCM channel
//
// Patent ref: §5 Podcast Recording, §7.8 Podcast Intelligence Engine
// ═══════════════════════════════════════════════════════════════

// API keys are server-side only — all generation goes through /api/generate and /api/youtube

// ═══════════════════════════════════════════════════════════════
// STEP 1: GENERATE PODCAST SCRIPT
// Two hosts: "Alex" and "Sam" — warm, knowledgeable, conversational
// ═══════════════════════════════════════════════════════════════

const PODCAST_SCRIPT_PROMPT = `You are a podcast script writer for "Good Creative Media Presents," a short-form event preview podcast for San Antonio's arts and entertainment scene.

FORMAT:
- Two hosts: ALEX (warm, enthusiastic, asks good questions) and SAM (knowledgeable, insightful, provides context)
- Length: 2-5 minutes when read aloud (roughly 400-800 words total)
- Conversational, not scripted-sounding. Think NPR's Pop Culture Happy Hour meets local arts radio.
- Include natural transitions, reactions ("Oh, that's interesting"), and conversational fillers
- Open with a brief intro: "Welcome to Good Creative Media Presents..."
- Close with event details (date, venue, tickets) and sign-off

TONE:
- Genuinely excited but not hype-y
- Culturally literate — reference relevant context
- San Antonio pride without being corny
- Like two friends who know a lot about the local arts scene

OUTPUT FORMAT:
Return ONLY a JSON array of dialogue turns. Each turn:
{"speaker": "ALEX" or "SAM", "text": "what they say"}

Example:
[
  {"speaker": "ALEX", "text": "Welcome to Good Creative Media Presents. I'm Alex, and today we're previewing something really special..."},
  {"speaker": "SAM", "text": "Yeah, this one caught my attention right away..."},
  ...
]

RULES:
- No em dashes. Use commas, periods, or ellipses instead.
- No "epic," "unmissable," "game-changing," or any hype words.
- Include specific facts from the research brief — don't be vague.
- End with clear event details: date, time, venue, ticket info.
- Keep it tight. 15-25 dialogue turns total.`;

export async function generatePodcastScript(pressRelease, research, event, venue) {
  const researchContext = research ? `
RESEARCH BRIEF:
${research.venue ? `Venue: ${research.venue.name} — ${research.venue.description}` : ''}
${research.artists?.map(a => `Artist: ${a.name} — ${a.bio}`).join('\n') || ''}
${research.context ? `Cultural context: ${research.context.culturalContext}\nMedia angle: ${research.context.mediaAngle}` : ''}
` : '';

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'podcast-script',
      pressRelease,
      research: researchContext,
      event,
      venue,
      scriptPrompt: PODCAST_SCRIPT_PROMPT,
    }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to generate podcast script');
  return data.script;
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: TEXT-TO-SPEECH — Generate audio for each line
// Uses Google Cloud TTS with two distinct voices
// ═══════════════════════════════════════════════════════════════

// Voice assignments — warm, natural-sounding US English voices
const VOICES = {
  ALEX: {
    name: 'en-US-Journey-F',  // Female, warm, conversational
    pitch: 0,
    speakingRate: 1.0,
  },
  SAM: {
    name: 'en-US-Journey-D',  // Male, knowledgeable, grounded
    pitch: -1,
    speakingRate: 0.95,
  },
};

// Alternative voices if Journey isn't available
const FALLBACK_VOICES = {
  ALEX: { name: 'en-US-Neural2-F', pitch: 0, speakingRate: 1.0 },
  SAM: { name: 'en-US-Neural2-D', pitch: -1, speakingRate: 0.95 },
};

export async function synthesizeSpeech(text, speaker = 'ALEX') {
  try {
    // Use our serverless API endpoint which authenticates via service account
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.audioContent) throw new Error('No audio returned');

    return data.audioContent; // base64 MP3
  } catch (err) {
    throw new Error(`TTS failed for ${speaker}: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 3: COMBINE AUDIO — Concatenate all segments into one MP3
// Done client-side using Web Audio API
// ═══════════════════════════════════════════════════════════════

export async function combineAudioSegments(base64Segments) {
  // Each segment is a base64-encoded MP3
  // We'll concatenate the raw MP3 bytes (MP3 is frame-based, so concatenation works)
  const binaryParts = base64Segments.map(b64 => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  });

  // Add a small silence gap between segments (200ms of MP3 silence)
  // This is a minimal valid MP3 frame of silence
  const silenceB64 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYE2JNGAAAAAAAAAAAAAAAAAAAAAP/7UAAAAAAAAAAAAAAAAAAAWW5nAAAADwAAAAIAAAGGALu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/////////////////////////////////////////////////////////////////';
  const silenceBytes = Uint8Array.from(atob(silenceB64), c => c.charCodeAt(0));

  // Calculate total length
  let totalLength = 0;
  for (const part of binaryParts) {
    totalLength += part.length + silenceBytes.length;
  }

  // Combine
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of binaryParts) {
    combined.set(part, offset);
    offset += part.length;
    combined.set(silenceBytes, offset);
    offset += silenceBytes.length;
  }

  return combined;
}

// ═══════════════════════════════════════════════════════════════
// STEP 4: FULL PIPELINE — Script → TTS → Combined MP3
// ═══════════════════════════════════════════════════════════════

export async function generatePodcastAudio(pressRelease, research, event, venue, onProgress = null) {
  // Step 1: Generate script
  if (onProgress) onProgress({ step: 'script', message: 'Writing podcast script...' });
  const script = await generatePodcastScript(pressRelease, research, event, venue);

  // Step 2: Generate audio for each line
  const audioSegments = [];
  for (let i = 0; i < script.length; i++) {
    const line = script[i];
    if (onProgress) onProgress({ 
      step: 'tts', 
      message: `Recording ${line.speaker} (${i + 1}/${script.length})...`,
      current: i + 1,
      total: script.length,
    });
    
    const audioB64 = await synthesizeSpeech(line.text, line.speaker);
    audioSegments.push(audioB64);
  }

  // Step 3: Combine into single MP3
  if (onProgress) onProgress({ step: 'combine', message: 'Mixing audio...' });
  const combinedAudio = await combineAudioSegments(audioSegments);

  // Create downloadable blob
  const blob = new Blob([combinedAudio], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);

  // Estimate duration (rough: ~150 words/min, each segment ~5-15 words)
  const totalWords = script.reduce((sum, line) => sum + line.text.split(' ').length, 0);
  const estimatedMinutes = Math.round(totalWords / 150);

  return {
    script,
    audioUrl: url,
    audioBlob: blob,
    totalLines: script.length,
    totalWords,
    estimatedDuration: `~${estimatedMinutes} min`,
    format: 'mp3',
  };
}

// ═══════════════════════════════════════════════════════════════
// STEP 5: UPLOAD TO YOUTUBE — YouTube Data API v3
// Uploads MP3 as a podcast episode to GCM's YouTube channel
//
// Requirements:
// - YouTube Data API enabled (already done in GCP project techarts-theater)
// - OAuth2 token with youtube.upload scope
// - GCM YouTube channel
// ═══════════════════════════════════════════════════════════════

export async function uploadToYouTube(audioBlob, event, venue, script, _unused) {
  // Build metadata
  const title = `${event.title} — Event Preview | Good Creative Media Presents`;
  const description = buildYouTubeDescription(event, venue, script);
  const tags = buildYouTubeTags(event, venue);

  try {
    // Convert blob to base64 for server-side upload
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const res = await fetch('/api/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload',
        title,
        description,
        tags,
        categoryId: '22',
        audioBase64: base64,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'YouTube upload failed',
        setup: data.error?.includes('not configured') ? {
          steps: [
            '1. Enable YouTube Data API v3 in GCP project',
            '2. Create OAuth credentials',
            '3. Authorize via OAuth Playground',
            '4. Save YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN in Vercel env vars',
          ],
        } : undefined,
      };
    }

    return {
      success: true,
      videoId: data.videoId,
      videoUrl: data.videoUrl,
      title,
      message: `Podcast uploaded to YouTube: ${data.videoUrl}`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function buildYouTubeDescription(event, venue, script) {
  const eventDate = parseLocalDate(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  
  let desc = `🎙️ Good Creative Media Presents: ${event.title}\n\n`;
  desc += `An AI-generated event preview podcast for ${event.title} at ${venue?.name || 'venue'} in San Antonio, TX.\n\n`;
  desc += `📅 ${eventDate} at ${event.time || '7:00 PM'}\n`;
  desc += `📍 ${venue?.name || 'Venue'} — ${venue?.address || 'San Antonio, TX'}\n`;
  desc += `🎵 ${event.genre || 'Live Entertainment'}\n`;
  if (event.ticketLink) desc += `🎟️ Tickets: ${event.ticketLink}\n`;
  desc += `\n---\n\n`;
  desc += `Produced by Good Creative Media\n`;
  desc += `goodcreativemedia.com\n`;
  desc += `thisisthegoodlife@juliegood.com\n\n`;
  desc += `#SanAntonio #SATX #LiveMusic #${(event.genre || 'Entertainment').replace(/[^a-zA-Z0-9]/g, '')} #GoodCreativeMedia`;
  
  // Add transcript
  if (script?.length > 0) {
    desc += `\n\n---\nTRANSCRIPT:\n\n`;
    for (const line of script) {
      desc += `${line.speaker}: ${line.text}\n\n`;
    }
  }
  
  return desc;
}

function buildYouTubeTags(event, venue) {
  const tags = [
    'San Antonio',
    'SATX',
    'Good Creative Media',
    'live music',
    'event preview',
    'podcast',
    event.genre || 'entertainment',
    venue?.name || '',
    event.title,
    'San Antonio events',
    'Texas music',
    'arts and culture',
  ].filter(Boolean);
  
  return tags.slice(0, 15); // YouTube max 500 chars total
}

// ═══════════════════════════════════════════════════════════════
// SCRIPT DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════

export function formatScriptForDisplay(script) {
  return script.map(line => `**${line.speaker}:** ${line.text}`).join('\n\n');
}

export function getScriptStats(script) {
  const totalWords = script.reduce((sum, line) => sum + line.text.split(' ').length, 0);
  const alexLines = script.filter(l => l.speaker === 'ALEX').length;
  const samLines = script.filter(l => l.speaker === 'SAM').length;
  return {
    totalLines: script.length,
    totalWords,
    estimatedMinutes: Math.ceil(totalWords / 150),
    alexLines,
    samLines,
  };
}
