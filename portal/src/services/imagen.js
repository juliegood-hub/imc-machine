// ═══════════════════════════════════════════════════════════════
// IMC Machine — Image Generation Service
// Nano Banana (Gemini) primary, DALL-E fallback
// Generates platform-specific dimensions for ALL digital channels
//
// Models (in priority order):
// 1. nano-banana-pro-preview (Google's best)
// 2. gemini-3-pro-image-preview
// 3. gemini-2.5-flash-image (fast, good quality)
// 4. DALL-E 3 (OpenAI fallback)
// ═══════════════════════════════════════════════════════════════

// API keys are server-side only — all generation goes through /api/generate

// ═══════════════════════════════════════════════════════════════
// PLATFORM-SPECIFIC IMAGE DIMENSIONS
// Every size Julie would create for a campaign
// ═══════════════════════════════════════════════════════════════

export const PLATFORM_FORMATS = {
  // ── PRINT ──
  poster_11x17:         { w: 1100, h: 1700, dalleSize: '1024x1792', label: 'Event Poster (11×17)', category: 'print', desc: 'a vertical event poster at 11×17 proportions, dramatic full-bleed imagery' },
  poster_8x10:          { w: 1000, h: 1250, dalleSize: '1024x1792', label: 'Poster (8×10)', category: 'print', desc: 'a vertical 8×10 promotional poster' },

  // ── EVENTBRITE ──
  eventbrite_banner:    { w: 2160, h: 1080, dalleSize: '1792x1024', label: 'Eventbrite Event Banner (2160×1080)', category: 'eventbrite', desc: 'a wide landscape event banner, 2:1 aspect ratio, hero imagery for the event header' },
  eventbrite_profile:   { w: 500,  h: 500,  dalleSize: '1024x1024', label: 'Eventbrite Organizer Profile (500×500)', category: 'eventbrite', desc: 'a square organizer profile image, clean, brand-forward' },
  eventbrite_thumbnail: { w: 800,  h: 450,  dalleSize: '1792x1024', label: 'Eventbrite Thumbnail (800×450)', category: 'eventbrite', desc: 'a landscape thumbnail preview card, eye-catching at small size' },

  // ── FACEBOOK ──
  fb_event_banner:      { w: 1920, h: 1005, dalleSize: '1792x1024', label: 'Facebook Event Cover (1920×1005)', category: 'facebook', desc: 'a Facebook event cover photo, 1.91:1 ratio, text-safe zone in center-bottom' },
  fb_post_landscape:    { w: 1200, h: 630,  dalleSize: '1792x1024', label: 'Facebook Post (1200×630)', category: 'facebook', desc: 'a landscape Facebook link share / feed post image' },
  fb_story:             { w: 1080, h: 1920, dalleSize: '1024x1792', label: 'Facebook Story (1080×1920)', category: 'facebook', desc: 'a full-screen vertical Facebook/IG Story image' },

  // ── INSTAGRAM ──
  ig_post_square:       { w: 1080, h: 1080, dalleSize: '1024x1024', label: 'Instagram Post Square (1080×1080)', category: 'instagram', desc: 'a square Instagram feed post, clean composition with generous negative space' },
  ig_post_portrait:     { w: 1080, h: 1350, dalleSize: '1024x1792', label: 'Instagram Post Portrait (1080×1350)', category: 'instagram', desc: 'a 4:5 portrait Instagram feed post, optimized for maximum feed real estate' },
  ig_story:             { w: 1080, h: 1920, dalleSize: '1024x1792', label: 'Instagram Story (1080×1920)', category: 'instagram', desc: 'a full-screen vertical Instagram Story, interactive-zone-safe (bottom 20% clear)' },
  ig_reel_cover:        { w: 1080, h: 1920, dalleSize: '1024x1792', label: 'Instagram Reel Cover (1080×1920)', category: 'instagram', desc: 'a vertical Reel cover image, bold and visually striking' },

  // ── LINKEDIN ──
  linkedin_post:        { w: 1200, h: 627,  dalleSize: '1792x1024', label: 'LinkedIn Post (1200×627)', category: 'linkedin', desc: 'a professional landscape LinkedIn feed image, clean and polished' },
  linkedin_event:       { w: 1584, h: 396,  dalleSize: '1792x1024', label: 'LinkedIn Event Banner (1584×396)', category: 'linkedin', desc: 'a very wide LinkedIn event banner, panoramic composition' },

  // ── YOUTUBE ──
  youtube_thumbnail:    { w: 1280, h: 720,  dalleSize: '1792x1024', label: 'YouTube Thumbnail (1280×720)', category: 'youtube', desc: 'a YouTube video thumbnail, high contrast, attention-grabbing at small size' },
  youtube_banner:       { w: 2560, h: 1440, dalleSize: '1792x1024', label: 'YouTube Channel Banner (2560×1440)', category: 'youtube', desc: 'a YouTube channel art banner, safe area centered' },

  // ── EMAIL ──
  email_header:         { w: 600,  h: 200,  dalleSize: '1792x1024', label: 'Email Header (600×200)', category: 'email', desc: 'a compact landscape email header banner, clean and fast-loading' },

  // ── DO210 / SA CURRENT ──
  do210_hero:           { w: 1200, h: 628,  dalleSize: '1792x1024', label: 'Do210 Hero Image (1200×628)', category: 'calendar', desc: 'a landscape hero image for calendar listing, vibrant and inviting' },
  do210_poster:         { w: 800,  h: 1200, dalleSize: '1024x1792', label: 'Do210 Poster Upload (800×1200)', category: 'calendar', desc: 'a vertical poster image for calendar listing detail page' },

  // ── GENERAL ──
  og_image:             { w: 1200, h: 630,  dalleSize: '1792x1024', label: 'Open Graph / Twitter Card (1200×630)', category: 'web', desc: 'an Open Graph social share preview image, clear subject at center' },
  press_page_hero:      { w: 1600, h: 900,  dalleSize: '1792x1024', label: 'Press Page Hero (1600×900)', category: 'web', desc: 'a cinematic wide-angle hero image for the event press page' },
};

// Grouped by platform for the UI
export const PLATFORM_GROUPS = {
  'Print': ['poster_11x17', 'poster_8x10'],
  'Eventbrite': ['eventbrite_banner', 'eventbrite_thumbnail', 'eventbrite_profile'],
  'Facebook': ['fb_event_banner', 'fb_post_landscape', 'fb_story'],
  'Instagram': ['ig_post_square', 'ig_post_portrait', 'ig_story', 'ig_reel_cover'],
  'LinkedIn': ['linkedin_post', 'linkedin_event'],
  'YouTube': ['youtube_thumbnail', 'youtube_banner'],
  'Calendar (Do210/Current)': ['do210_hero', 'do210_poster'],
  'Email': ['email_header'],
  'Web / SEO': ['og_image', 'press_page_hero'],
};

// Quick presets — what to generate in one click
export const PRESETS = {
  essential: ['poster_11x17', 'fb_event_banner', 'ig_post_square', 'ig_story', 'eventbrite_banner', 'do210_hero', 'og_image'],
  full: Object.keys(PLATFORM_FORMATS),
  social_only: ['fb_event_banner', 'fb_post_landscape', 'fb_story', 'ig_post_square', 'ig_post_portrait', 'ig_story', 'linkedin_post'],
  eventbrite_only: ['eventbrite_banner', 'eventbrite_thumbnail', 'eventbrite_profile'],
};

// ═══════════════════════════════════════════════════════════════
// GCM HOUSE VISUAL STYLE
// ═══════════════════════════════════════════════════════════════

const GCM_VISUAL_STYLE = `Editorial photography for honest event marketing. San Antonio arts and entertainment.

STYLE MANDATE:
- Artsy photo angles: closeups of REAL OBJECTS that promote the event
- Instruments leaning against walls, stage equipment, drinks on a bar, vintage decor, event posters
- Real venue artifacts: marquee signs, architectural details, neon signs, brick textures, weathered doors
- Shallow depth of field, interesting angles, real-world textures
- Think: a photographer's closeup of a guitar leaning against a brick wall, a hand-lettered event poster on a venue door, a neon sign reflected in a rain puddle, mic stands on an empty stage, a cocktail glass with stage lights bokeh behind it

ABSOLUTE RULES:
- NO AI-generated fake environments pretending to be the real venue
- NO AI-generated people performing on stage — NEVER show performers/musicians/actors
- NO crowd shots, no audience, no fake concert scenes
- NO text, letters, words, or numbers in the image
- Style: editorial photography, interesting angles, shallow depth of field
- This is honest marketing — promote the REAL venue atmosphere, not a fantasy version

Color philosophy: Rich, saturated, intentional. Every color choice is deliberate.
Composition: Rule of thirds. Generous negative space. Let the image breathe.
Lighting: Dramatic but natural. Warm tones for indoor venues. Cool blues for night events.`;

const GENRE_VISUALS = {
  'Theater|Plays|Musicals': 'Closeup of velvet curtain texture, spotlight beam cutting through dark air, ornate theater seat details, playbill on a vintage table, stage door with hand-painted sign. NO people on stage.',
  'Live Music|Contemporary|Jazz|Electronic|Indie': 'Closeup of guitar neck against brick wall, drum kit in empty spotlight, vintage amp knobs, mic stand silhouette, vinyl records on a bar top, neon bar sign reflected in a glass. NO people performing.',
  'Orchestral|Classical|Choral': 'Closeup of violin scroll, sheet music on a stand with warm light, concert hall architectural ceiling details, polished wood stage floor, brass instrument bell reflection. NO musicians.',
  'Comedy|Speaking|Lectures|Workshops': 'Empty mic on a stool under spotlight, brick wall comedy club backdrop, notebook and coffee on a podium, marquee letterboard with event details blurred. NO performers.',
  'Dance|Performance Art|Experimental': 'Dance shoes on a wooden floor, rehearsal barre closeup, fabric in motion blur (no body visible), chalk dust in spotlight, abstract shadows on a studio wall. NO dancers.',
};

function getGenreVisual(genre) {
  if (!genre) return GENRE_VISUALS['Live Music|Contemporary|Jazz|Electronic|Indie'];
  for (const [key, style] of Object.entries(GENRE_VISUALS)) {
    if (key.toLowerCase().includes(genre.toLowerCase()) || genre.toLowerCase().includes(key.split('|')[0].toLowerCase())) {
      return style;
    }
  }
  return GENRE_VISUALS['Live Music|Contemporary|Jazz|Electronic|Indie'];
}

function buildImagePrompt(event, venue, formatDesc) {
  const genreVisual = getGenreVisual(event?.genre);
  const venueColors = venue?.brandPrimaryColor && venue?.brandSecondaryColor
    ? `Color palette: ${venue.brandPrimaryColor} and ${venue.brandSecondaryColor}`
    : 'Color palette: Deep navy (#0d1b2a), warm gold (#c8a45e), and ivory (#faf8f3)';

  return `${GCM_VISUAL_STYLE}

Create ${formatDesc} for a ${event?.genre || 'live entertainment'} event at ${venue?.name || 'a San Antonio venue'}.

${genreVisual}
${venueColors}
${event?.description ? 'Event vibe: ' + event.description : ''}

Focus on OBJECTS and ATMOSPHERE, not people. Show the venue's real character through closeup details.
Think like a photographer arriving early — capturing the setup, the space, the anticipation.
NO TEXT, NO PEOPLE, NO FAKE SCENES. Just real objects, real textures, real light.`;
}

// ═══════════════════════════════════════════════════════════════
// IMAGE GENERATION — Routed through /api/generate (server-side)
// ═══════════════════════════════════════════════════════════════

async function generateViaAPI(prompt, dalleSize = '1024x1792') {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate-image',
      prompt,
      dalleSize,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Image generation failed');
  return data;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — Generate a single image for a specific platform format
// ═══════════════════════════════════════════════════════════════

export async function generateImage(event, venue, formatKey = 'poster_11x17') {
  // Support legacy format names
  const legacyMap = { poster: 'poster_11x17', social: 'fb_post_landscape', story: 'ig_story', square: 'ig_post_square' };
  const key = legacyMap[formatKey] || formatKey;
  const spec = PLATFORM_FORMATS[key];
  
  if (!spec) {
    return { url: '', error: `Unknown format: ${formatKey}`, formatKey: key };
  }

  const prompt = buildImagePrompt(event, venue, spec.desc);

  try {
    const result = await generateViaAPI(prompt, spec.dalleSize);
    return { ...result, formatKey: key, label: spec.label, dimensions: `${spec.w}×${spec.h}` };
  } catch (err) {
    return { url: '', error: err.message, formatKey: key, label: spec.label };
  }
}

// ═══════════════════════════════════════════════════════════════
// BATCH GENERATE — Generate multiple platform formats at once
// ═══════════════════════════════════════════════════════════════

export async function generateBatch(event, venue, formatKeys = PRESETS.essential, onProgress = null) {
  const results = [];
  
  for (let i = 0; i < formatKeys.length; i++) {
    const key = formatKeys[i];
    const spec = PLATFORM_FORMATS[key];
    if (onProgress) onProgress({ current: i + 1, total: formatKeys.length, label: spec?.label || key });
    
    try {
      const result = await generateImage(event, venue, key);
      results.push(result);
    } catch (err) {
      results.push({ url: '', error: err.message, formatKey: key, label: spec?.label || key });
    }
  }
  
  return results;
}
