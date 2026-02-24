// ═══════════════════════════════════════════════════════════════
// IMC Machine: Server-Side Content Generation API
// Vercel Serverless Function
//
// POST /api/generate
// Body: { action, event, venue, channels, researchContext, ... }
//
// Actions:
//   generate-content  → OpenAI GPT-4o content generation
//   generate-image    → Gemini Nano Banana / DALL-E image generation
//   translate         → Gemini/OpenAI Spanish translation
//   podcast-script    → Gemini podcast script generation
//   extract-photo     → Gemini Vision photo-to-form extraction
//   research          → Gemini research (venue, artist, context)
//   form-assist       → AI-assisted structured form filling
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action, driveEventFolderId } = req.body;
  if (!action) return res.status(400).json({ error: 'Missing action' });

  try {
    let result;
    switch (action) {
      case 'generate-content':
        result = await generateContent(req.body);
        // Fire-and-forget: save generated content to Google Drive
        if (driveEventFolderId && result.content) {
          saveContentToGDrive(driveEventFolderId, result.content).catch(err =>
            console.warn('[generate] Drive save failed:', err.message)
          );
        }
        break;
      case 'generate-image':
        result = await generateImage(req.body);
        // Fire-and-forget: save generated image to Google Drive
        if (driveEventFolderId && result.url) {
          saveImageToGDrive(driveEventFolderId, result.url, req.body.prompt).catch(err =>
            console.warn('[generate] Drive image save failed:', err.message)
          );
        }
        break;
      case 'translate':
        result = await translateContent(req.body);
        break;
      case 'podcast-script':
        result = await generatePodcastScript(req.body);
        break;
      case 'extract-photo':
        result = await extractFromPhoto(req.body);
        break;
      case 'research':
        result = await conductResearch(req.body);
        break;
      case 'research-venue':
        result = await researchVenue(req.body);
        break;
      case 'research-artist':
        result = await researchArtist(req.body);
        break;
      case 'research-context':
        result = await researchContext(req.body);
        break;
      case 'podcast-source':
        result = await generatePodcastSource(req.body);
        break;
      case 'form-assist':
        result = await formAssist(req.body);
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error(`[generate] ${action} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// OPENAI CONTENT GENERATION
// ═══════════════════════════════════════════════════════════════

async function openaiChat(systemPrompt, userPrompt, model = 'gpt-4o', temperature = 0.8) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

async function generateContent({ event, channels, venue, researchContext, houseStyle, genreStyle, venueBrand, contentType }) {
  // Support both new channel-based approach and legacy contentType approach
  const results = {};

  // Handle legacy contentType approach for backwards compatibility
  if (contentType && !channels) {
    const systemPrompt = buildSystemPrompt(contentType, venue);
    const userPrompt = buildUserPrompt(contentType, event, venue, researchContext);
    try {
      results[contentType] = await openaiChat(systemPrompt, userPrompt);
    } catch (err) {
      results[contentType] = `[Error generating ${contentType} content: ${err.message}]`;
    }
    return { content: results };
  }

  // Handle new channel-based approach
  if (channels && Array.isArray(channels)) {
    for (const channel of channels) {
      const { systemPrompt, userPrompt } = channel;
      try {
        results[channel.key] = await openaiChat(systemPrompt, userPrompt);
      } catch (err) {
        results[channel.key] = `[Error generating ${channel.key} content: ${err.message}]`;
      }
    }
  }

  return { content: results };
}

// Build system prompts for different content types
function buildSystemPrompt(contentType, venue) {
  const houseStyle = `You are the creative director at Good Creative Media, a San Antonio-based integrated marketing communications agency representing arts venues, live music, theater, and cultural events.

VOICE & TONE:
- Confident but never arrogant. Authoritative but warm.
- Write like The New Yorker meets Austin City Limits: culturally literate, sharp, inviting.
- Every word earns its place. No filler. No clichés. No "Don't miss out!" or "You won't want to miss this!"
- Speak TO the audience, not AT them. They're intelligent adults who love art.
- San Antonio pride without being corny about it. This city has culture: let it speak.

LANGUAGE RULES:
- NEVER use em dashes (—) or en dashes (–). Use colons, semicolons, commas, periods instead.
- Never use: "epic," "unmissable," "game-changing," "synergy," "leverage," "elevate" (as marketing buzzword)
- Prefer: precise verbs, sensory language, specific details over vague hype
- Names and titles are sacred: triple-check spelling, never abbreviate without permission.
- Reference neighborhood when relevant (Southtown, Downtown, Pearl, St. Mary's Strip)

COMMERCE & LINKS:
- If a menu URL, shop URL, or merch link is provided, weave it in naturally where it adds value.
- Press releases: include in the event details block. Social posts: include as a call to action when relevant.
- Never force a shop link where it doesn't belong. If someone's doing a jazz night, the menu link matters more than a merch store.
- One relevant link per piece is plenty. Pick the most useful one for the context.

YOUTH/MINORS CONTENT RULES (when YOUTH_EVENT flag is present):
- NEVER name individual minors unless explicitly provided and pre-approved. Use ensemble/group names only.
- NEVER reference alcohol, bar service, drink specials, or anything age-restricted.
- Language must be family-friendly and parent-audience appropriate.
- Photo/media references should note that performances feature youth performers (no individual child photos described).
- Include parent/guardian or program director as the contact, not the performers.
- Emphasize the program, the school, the ensemble, the community. Not individual kids.
- Ticket language: "family-friendly," "all ages welcome," "open to the community."
- This is non-negotiable. When minors perform, we protect them first.`;

  // Build commerce links string
  const commerceLinks = venue ? [
    venue.onlineMenu && `Menu: ${venue.onlineMenu}`,
    venue.squareStore && `Square: ${venue.squareStore}`,
    venue.shopifyStore && `Shopify: ${venue.shopifyStore}`,
    venue.amazonStore && `Amazon: ${venue.amazonStore}`,
    venue.etsyStore && `Etsy: ${venue.etsyStore}`,
    venue.merchStore && `Merch: ${venue.merchStore}`,
    venue.otherStore && `Shop: ${venue.otherStore}`,
    venue.website && `Website: ${venue.website}`,
  ].filter(Boolean).join(' | ') : '';

  const venueBrand = venue ? `\nVENUE: ${venue.name || 'San Antonio venue'}
Location: ${venue.address || ''}, ${venue.city || 'San Antonio'}, ${venue.state || 'TX'}
Brand Colors: ${venue.brandPrimaryColor || '#0d1b2a'}, ${venue.brandSecondaryColor || '#c8a45e'}${commerceLinks ? `\nOnline: ${commerceLinks}` : ''}` : '';

  switch (contentType) {
    case 'press_release':
      return `${houseStyle}${venueBrand}\n\nYou write press releases in strict AP style. Tight paragraphs, real journalism standards. Lead with the most compelling detail, not the date.`;
    
    case 'social_post':
      return `${houseStyle}${venueBrand}\n\nYou create platform-native social posts. Never copy-paste across platforms. Include Instagram caption with hashtags, Facebook post, LinkedIn post.`;
    
    case 'email_blast':
      return `${houseStyle}${venueBrand}\n\nYou write event announcement emails that drive ticket sales without being spammy.`;
    
    case 'sms_blast':
      return `${houseStyle}${venueBrand}\n\nYou write ultra-short SMS event announcements. STRICT LIMIT: 160 characters max (one SMS segment). Every character counts. No hashtags, no links longer than necessary. Punchy, clear, one sentence.`;

    case 'event_listing':
      return `${houseStyle}${venueBrand}\n\nYou write concise, vivid event calendar listings for Do210, SA Current, and Evvnt.`;
    
    case 'bilingual_press':
      return `You are a professional Spanish-language arts and entertainment writer for La Prensa Texas. Cultural translation, not word-for-word. Use Texas Spanish / Mexican-American cultural context. Maintain journalistic quality.`;
    
    default:
      return `${houseStyle}${venueBrand}`;
  }
}

// Build user prompts for different content types
function formatEventDate(dateStr) {
  if (!dateStr) return 'TBD';
  try {
    // Parse as local date (avoid timezone shift)
    const parts = dateStr.split(/[-/T]/);
    const d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function buildUserPrompt(contentType, event, venue, researchContext) {
  const formattedDate = formatEventDate(event.date);
  const eventInfo = `EVENT: ${event.title}
DATE: ${formattedDate} at ${event.time || '7:00 PM'}
VENUE: ${venue?.name || '[Venue TBD]'}${venue?.address ? ', ' + venue.address + ', ' + (venue.city || 'San Antonio') + ', ' + (venue.state || 'TX') : ''}
GENRE: ${event.genre || 'Live Entertainment'}
DESCRIPTION: ${event.description || '[No description provided]'}
TICKET LINK: ${event.ticketLink || '[Ticket link TBD]'}
${venue?.onlineMenu ? `MENU: ${venue.onlineMenu}` : ''}
${venue?.shopifyStore || venue?.squareStore || venue?.amazonStore || venue?.etsyStore || venue?.merchStore || venue?.otherStore ? `SHOP: ${venue.shopifyStore || venue.squareStore || venue.amazonStore || venue.etsyStore || venue.merchStore || venue.otherStore}` : ''}
${['k12_school', 'conservatory', 'childrens_theater', 'youth_program'].includes(venue?.clientType) ? '\n⚠️ YOUTH_EVENT: This event features minor performers. Follow all Youth/Minors Content Rules strictly.' : ''}
${event.sponsors?.length ? `\nSPONSORS:\n${event.sponsors.map(s => `- ${s.name}${s.tier ? ` (${s.tier})` : ''}${s.tagline ? `: ${s.tagline}` : ''}${s.website ? ` | ${s.website}` : ''}`).join('\n')}\nInclude sponsor acknowledgment in press releases (event details block) and social posts (tag/mention where appropriate). Presenting and title sponsors should be named prominently.` : ''}
${researchContext || ''}`.replace(/\n{3,}/g, '\n\n');

  switch (contentType) {
    case 'press_release':
      return `Write a press release for this event:\n\n${eventInfo}\n\nFORMAT:\n- Headline: Active voice, present tense, compelling (not clickbait)\n- Dateline: SAN ANTONIO, TX, ${formattedDate}\n- IMPORTANT: The event date is ${formattedDate}. Use this EXACT date everywhere.\n- Lead paragraph: Who, what, when, where, why\n- Body: 2-3 paragraphs of context, artist bios, venue significance\n- Quote: "[Placeholder for venue manager quote about what makes this event special]"\n- Event details block: Date | Time | Location | Tickets | Age restriction | Accessibility\n- Boilerplate: About ${venue?.name || 'the venue'} | About Good Creative Media\n- Contact info\n- Word count: 350-500 words`;
    
    case 'social_post':
      return `Create social media posts for:\n\n${eventInfo}\n\nCreate FOUR platform-specific posts:\n\n1. **Facebook**: Community-oriented, conversational, 2-3 paragraphs. Include venue details and ticket link.\n2. **Instagram Caption**: Visual-first language, include 8-12 relevant hashtags (#SanAntonio #SATX #LiveMusic #SAarts #SanAntonioEvents). End with "Link in bio" if ticket link exists.\n3. **LinkedIn**: Professional angle, cultural/industry significance, 1-2 paragraphs. Include event link.\n4. **Twitter/X**: MAXIMUM 280 characters. Punchy, conversational. One hashtag max. Include ticket link if space allows.\n\nLabel each section clearly with the platform name as a bold header.`;
    
    case 'email_blast':
      return `Write an event announcement email for:\n\n${eventInfo}\n\nInclude:\n- Subject Line (<50 chars)\n- Preview Text (<90 chars)\n- Email Body (3-4 paragraphs)\n- Clear call-to-action\n- Footer with venue/promoter info`;
    
    case 'sms_blast':
      return `Write a single SMS text message for:\n\n${eventInfo}\n\nRULES:\n- MAXIMUM 160 characters total (this is a hard limit for one SMS segment)\n- Include: event name, date, time, venue name\n- One clear sentence. No hashtags. No emojis.\n- If there's a ticket link, use it. Otherwise skip.\n- Return ONLY the SMS text, nothing else.`;

    case 'event_listing':
      return `Write event calendar listings for:\n\n${eventInfo}\n\nCreate THREE versions:\n1. **Do210**: Fun, casual, SA-native (2-3 sentences)\n2. **SA Current**: Arts/culture angle (2-3 sentences)\n3. **Evvnt/Express-News**: Straightforward, news-style (2 sentences)\n\nLabel each clearly.`;
    
    case 'bilingual_press':
      return `Translate this event information into Spanish for La Prensa Texas:\n\n${eventInfo}\n\nWrite a brief Spanish-language press release (200-300 words) that feels natural for Texas Spanish speakers.`;
    
    default:
      return `Write marketing content for:\n\n${eventInfo}`;
  }
}

const FORM_ASSIST_SCHEMAS = {
  signup: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    email: { type: 'string' },
    cellPhone: { type: 'string' },
    clientType: { type: 'string', enum: ['venue_owner', 'venue_manager', 'venue_marketing', 'venue_staff', 'restaurant', 'festival_organizer', 'artist', 'promoter', 'manager', 'booking_agent', 'producer', 'dj', 'vendor', 'artisan', 'attorney', 'educator', 'professor', 'doctor', 'speaker', 'author', 'writer', 'journalist', 'editor', 'poet', 'playwright', 'podcaster', 'moderator', 'coach', 'consultant', 'comedian', 'activist', 'politician', 'chef', 'k12_school', 'conservatory', 'childrens_theater', 'youth_program', 'media', 'sponsor', 'admin'] },
    clientName: { type: 'string' },
    inviteCode: { type: 'string' },
  },
  venue: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    title: { type: 'string' },
    workPhone: { type: 'string' },
    cellPhone: { type: 'string' },
    email: { type: 'string' },
    preferredContact: { type: 'string', enum: ['email', 'phone', 'text'] },
    businessName: { type: 'string' },
    dbaName: { type: 'string' },
    businessType: { type: 'string', enum: ['venue', 'bar_restaurant', 'theater', 'gallery', 'church', 'outdoor', 'other'] },
    taxId: { type: 'string' },
    yearEstablished: { type: 'number' },
    streetNumber: { type: 'string' },
    streetName: { type: 'string' },
    suiteNumber: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zipCode: { type: 'string' },
    country: { type: 'string', enum: ['US', 'CA', 'MX'] },
    website: { type: 'string' },
    facebook: { type: 'string' },
    facebookPageId: { type: 'string' },
    instagram: { type: 'string' },
    linkedin: { type: 'string' },
    twitter: { type: 'string' },
    tiktok: { type: 'string' },
    spotify: { type: 'string' },
    youtube: { type: 'string' },
    yelp: { type: 'string' },
    googleBusiness: { type: 'string' },
    onlineMenu: { type: 'string' },
    squareStore: { type: 'string' },
    shopifyStore: { type: 'string' },
    amazonStore: { type: 'string' },
    etsyStore: { type: 'string' },
    merchStore: { type: 'string' },
    otherStore: { type: 'string' },
    capacity: { type: 'number' },
    hasStage: { type: 'boolean' },
    hasSound: { type: 'boolean' },
    hasLighting: { type: 'boolean' },
    parkingType: { type: 'string', enum: ['street', 'lot', 'valet', 'none'] },
    adaAccessible: { type: 'boolean' },
    ageRestriction: { type: 'string', enum: ['all_ages', '18_plus', '21_plus'] },
    liquorLicense: { type: 'boolean' },
    brandPrimary: { type: 'string' },
    brandSecondary: { type: 'string' },
  },
  artist: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    stageName: { type: 'string' },
    managerName: { type: 'string' },
    managerEmail: { type: 'string' },
    managerPhone: { type: 'string' },
    bookingName: { type: 'string' },
    bookingEmail: { type: 'string' },
    bookingPhone: { type: 'string' },
    cellPhone: { type: 'string' },
    preferredContact: { type: 'string', enum: ['email', 'phone', 'text'] },
    streetNumber: { type: 'string' },
    streetName: { type: 'string' },
    suiteNumber: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zipCode: { type: 'string' },
    country: { type: 'string', enum: ['US', 'CA', 'MX'] },
    hometown: { type: 'string' },
    genre: { type: 'string' },
    subgenres: { type: 'array' },
    yearsActive: { type: 'number' },
    recordLabel: { type: 'string' },
    performingRightsOrg: { type: 'string' },
    unionMember: { type: 'string' },
    bio: { type: 'string' },
    website: { type: 'string' },
    facebook: { type: 'string' },
    instagram: { type: 'string' },
    tiktok: { type: 'string' },
    youtube: { type: 'string' },
    spotify: { type: 'string' },
    appleMusic: { type: 'string' },
    soundcloud: { type: 'string' },
    bandcamp: { type: 'string' },
    linkedin: { type: 'string' },
    onlineMenu: { type: 'string' },
    squareStore: { type: 'string' },
    shopifyStore: { type: 'string' },
    amazonStore: { type: 'string' },
    etsyStore: { type: 'string' },
    merchStore: { type: 'string' },
    otherStore: { type: 'string' },
    hasOwnSound: { type: 'boolean' },
    hasOwnLighting: { type: 'boolean' },
    typicalSetLength: { type: 'string', enum: ['30min', '45min', '1hr', '1_5hr', '2hr', '2_5hr', '3hr'] },
    riderRequirements: { type: 'string' },
    techRiderUrl: { type: 'string' },
    brandPrimary: { type: 'string' },
    brandSecondary: { type: 'string' },
  },
  event: {
    title: { type: 'string' },
    description: { type: 'string' },
    genre: { type: 'string' },
    date: { type: 'date' },
    time: { type: 'time' },
    ticketLink: { type: 'string' },
    ticketPrice: { type: 'string' },
    venue: { type: 'string' },
    venueStreetNumber: { type: 'string' },
    venueStreetName: { type: 'string' },
    venueSuite: { type: 'string' },
    venueCity: { type: 'string' },
    venueState: { type: 'string' },
    venueZip: { type: 'string' },
    venuePhone: { type: 'string' },
    venueWebsite: { type: 'string' },
    brandColors: { type: 'string' },
    writingTone: { type: 'string', enum: ['Professional yet approachable', 'Casual and fun', 'Formal and elegant', 'Edgy and bold', 'Warm and community-focused'] },
    specialInstructions: { type: 'string' },
    detectedFonts: { type: 'string' },
  },
};

async function formAssist({ formType, inputText, currentForm = {} }) {
  if (!formType) throw new Error('formType is required');
  if (!inputText || !inputText.trim()) throw new Error('inputText is required');

  const schema = FORM_ASSIST_SCHEMAS[formType];
  if (!schema) throw new Error(`Unsupported formType: ${formType}`);

  const schemaSummary = Object.entries(schema).map(([key, meta]) => {
    const base = `${key}: ${meta.type}`;
    if (meta.enum) return `${base} (${meta.enum.join(', ')})`;
    return base;
  }).join('\n');

  const model = process.env.OPENAI_FORM_ASSIST_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const systemPrompt = `You extract form fields from user notes/transcripts. Return ONLY valid JSON.
Output shape:
{
  "fields": { "<fieldKey>": <value> },
  "missing": ["<requiredOrusefulFieldKey>"],
  "notes": "short clarification note"
}
Rules:
- Only include keys from allowed schema.
- Only include fields you are confident about.
- Use ISO date: YYYY-MM-DD.
- Use 24-hour time: HH:MM.
- For arrays, return an array of strings.
- If useful facts appear that are not schema fields (for example ISBN, extra contacts, sponsor names), include them briefly in "notes".
- Do not include markdown, comments, or extra keys.`;

  const userPrompt = `FORM TYPE: ${formType}

ALLOWED FIELDS:
${schemaSummary}

CURRENT FORM (context only):
${JSON.stringify(currentForm, null, 2)}

USER INPUT TO PARSE:
${inputText}`;

  const raw = await openaiChat(systemPrompt, userPrompt, model, 0.2);
  let parsed;
  try {
    parsed = parseJSON(raw);
  } catch {
    throw new Error('AI form parsing returned invalid JSON');
  }

  const fields = sanitizeFormPatch(formType, parsed?.fields || {});
  const missing = Array.isArray(parsed?.missing)
    ? parsed.missing.filter(k => schema[k])
    : [];
  const notes = typeof parsed?.notes === 'string' ? parsed.notes.trim() : '';

  return { fields, missing, notes, modelUsed: model };
}

function sanitizeFormPatch(formType, patch) {
  const schema = FORM_ASSIST_SCHEMAS[formType];
  const out = {};
  if (!schema || !patch || typeof patch !== 'object') return out;

  for (const [key, rawValue] of Object.entries(patch)) {
    const meta = schema[key];
    if (!meta) continue;

    let value = null;
    switch (meta.type) {
      case 'boolean':
        value = normalizeBoolean(rawValue);
        break;
      case 'number':
        value = normalizeNumber(rawValue);
        break;
      case 'array':
        value = normalizeStringArray(rawValue);
        break;
      case 'date':
        value = normalizeDate(rawValue);
        break;
      case 'time':
        value = normalizeTime(rawValue);
        break;
      default:
        value = normalizeString(rawValue);
    }

    if (meta.enum && value && !meta.enum.includes(value)) continue;
    if (value === null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }

  return out;
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(v => normalizeString(v)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,;|]+/)
      .map(v => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['yes', 'true', 'y', '1'].includes(v)) return true;
    if (['no', 'false', 'n', '0'].includes(v)) return false;
  }
  return null;
}

function normalizeDate(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeTime(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const match = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] || '00';
  const ampm = match[3].toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

// ═══════════════════════════════════════════════════════════════
// IMAGE GENERATION (Gemini Nano Banana + DALL-E fallback)
// ═══════════════════════════════════════════════════════════════

const GEMINI_MODELS = [
  'nano-banana-pro-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
];

async function generateImage({ prompt, dalleSize }) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Try Gemini models first
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Generate an image: ' + prompt }] }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
          }),
        });
        const data = await r.json();
        if (data.error) { console.log(`[Imagen] ${model} error:`, data.error.message?.substring(0, 100)); continue; }
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find(p => p.inlineData);
        if (imgPart) {
          return {
            url: `data:${imgPart.inlineData.mimeType || 'image/png'};base64,${imgPart.inlineData.data}`,
            model, engine: 'google',
          };
        }
      } catch (err) { console.log(`[Imagen] ${model} failed:`, err.message); }
    }
  }

  // DALL-E fallback
  if (openaiKey) {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: dalleSize || '1024x1792', quality: 'hd', style: 'natural' }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    return { url: data.data[0].url, model: 'dall-e-3', engine: 'openai', revisedPrompt: data.data[0].revised_prompt };
  }

  throw new Error('No image generation API keys configured');
}

// ═══════════════════════════════════════════════════════════════
// GEMINI HELPER
// ═══════════════════════════════════════════════════════════════

async function geminiGenerate(prompt, temperature = 0.1) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature },
    }),
  });
  const data = await r.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini');
  return text;
}

function parseJSON(text) {
  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

// ═══════════════════════════════════════════════════════════════
// TRANSLATION (Spanish)
// ═══════════════════════════════════════════════════════════════

async function translateContent({ text, contentType }) {
  const systemPrompt = `You are a professional Spanish-language arts and entertainment writer for La Prensa Texas, San Antonio's leading bilingual newspaper since 1913.
TRANSLATION APPROACH: Cultural translation, not word-for-word. Use Texas Spanish / Mexican-American cultural context. Maintain journalistic quality. Keep proper nouns in original form.
CONTENT TYPE: ${contentType || 'press'}
OUTPUT: Return ONLY the Spanish translation.`;

  // Try Gemini first
  try {
    const text_out = await geminiGenerate(`${systemPrompt}\n\nENGLISH CONTENT TO TRANSLATE:\n\n${text}`, 0.3);
    return { translation: text_out, engine: 'gemini' };
  } catch (e) {
    console.log('[Translate] Gemini failed, trying GPT-4o');
  }

  // Fallback to OpenAI
  const result = await openaiChat(systemPrompt, text);
  return { translation: result, engine: 'gpt-4o' };
}

// ═══════════════════════════════════════════════════════════════
// PODCAST SCRIPT
// ═══════════════════════════════════════════════════════════════

async function generatePodcastScript({ pressRelease, research, event, venue, scriptPrompt }) {
  const prompt = `${scriptPrompt}\n\nPRESS RELEASE TO DISCUSS:\n${pressRelease}\n\n${research || ''}\n\nEVENT DETAILS:\nTitle: ${event?.title}\nDate: ${event?.date}\nTime: ${event?.time || '7:00 PM'}\nVenue: ${venue?.name || 'San Antonio venue'}\nGenre: ${event?.genre || 'Live Entertainment'}\nTickets: ${event?.ticketLink || 'Available at the door'}\n\nGenerate the podcast script as a JSON array of dialogue turns.`;

  const text = await geminiGenerate(prompt, 0.7);
  const script = parseJSON(text);
  return { script };
}

// ═══════════════════════════════════════════════════════════════
// PHOTO EXTRACTION (Gemini Vision)
// ═══════════════════════════════════════════════════════════════

async function extractFromPhoto({ imageData, mimeType, extractionPrompt }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: extractionPrompt },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageData } },
        ],
      }],
      generationConfig: { temperature: 0.1 },
    }),
  });
  const data = await r.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No extraction result from Gemini');
  return { extracted: parseJSON(text) };
}

// ═══════════════════════════════════════════════════════════════
// RESEARCH
// ═══════════════════════════════════════════════════════════════

async function researchVenue({ venueName, city }) {
  const prompt = `Research this venue and return structured JSON only (no markdown, no explanation):
Venue: "${venueName}" in ${city || 'San Antonio, TX'}
Return this exact JSON structure:
{"name":"official venue name","address":"full street address","neighborhood":"neighborhood name","googleMapsUrl":"url","phone":"phone","website":"url","description":"2-3 sentences","capacity":"approx","type":"bar/theater/etc","knownFor":["list"],"socialMedia":{"instagram":"@handle","facebook":"url"},"recentPress":"any","parkingInfo":"details","transitInfo":"details"}
If you don't know a field, use null. Be factual.`;
  const text = await geminiGenerate(prompt);
  return { venue: parseJSON(text) };
}

async function researchArtist({ artistName, genre }) {
  const prompt = `Research this artist/performer and return structured JSON only:
Artist: "${artistName}"
Genre context: ${genre || 'unknown'}
Location context: San Antonio, TX
Return JSON: {"name":"","bio":"3-4 sentences","genre":"","origin":"","activeYears":"","notableWorks":[],"spotifyUrl":"","instagramHandle":"","websiteUrl":"","pressQuotes":[],"awardsAchievements":[],"comparisons":"for fans of...","localConnection":"","photoDescription":""}
If unknown, use null. Be factual.`;
  const text = await geminiGenerate(prompt);
  return { artist: parseJSON(text) };
}

async function researchContext({ event, venue }) {
  const prompt = `You are a research assistant for an entertainment journalist. Research cultural context for this event and return structured JSON only:
Event: "${event?.title}"
Genre: ${event?.genre || 'Live Entertainment'}
Venue: ${venue?.name || 'San Antonio venue'}
Date: ${event?.date}
Description: ${event?.description || 'N/A'}
Return JSON: {"culturalContext":"2-3 sentences","sanAntonioArtsScene":"1-2 sentences","audienceInsight":"1 sentence","seasonalRelevance":"","relatedEvents":[],"mediaAngle":"","pullQuote":"","hashtagSuggestions":[],"googleMapsUrl":""}
Be factual.`;
  const text = await geminiGenerate(prompt, 0.3);
  return { context: parseJSON(text) };
}

// ═══════════════════════════════════════════════════════════════
// PODCAST SOURCE DOCUMENT GENERATION
// ═══════════════════════════════════════════════════════════════

async function generatePodcastSource({ event, venue }) {
  const prompt = `You are a content strategist for NotebookLM Audio Overview podcasts. Create a rich, engaging source document that will produce an excellent conversational podcast between two AI hosts.

EVENT DETAILS:
Title: ${event?.title || 'Event'}
Date: ${event?.date || 'TBD'} at ${event?.time || '7:00 PM'}
Venue: ${event?.venue || 'San Antonio Venue'}
Venue Address: ${event?.venueAddress || 'San Antonio, TX'}
Genre: ${event?.genre || 'Live Entertainment'}
Description: ${event?.description || 'No description provided'}
Ticket Link: ${event?.ticketLink || 'Tickets available'}
Ticket Price: ${event?.ticketPrice || 'Pricing varies'}
Performers: ${event?.performers || 'See event details'}

Create a comprehensive source document using this EXACT format:

# ${event?.title || 'Event Title'} — Podcast Source Document

## Event Overview
${event?.title || 'Event Title'} is a ${event?.genre || 'live entertainment'} event taking place on ${event?.date ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'} at ${event?.time || '7:00 PM'} at ${event?.venue || 'venue name'}. [Expand with compelling details about what makes this event special, why people should care, and what to expect]

## About the Venue
${event?.venue || 'Venue name'} is located at ${event?.venueAddress || 'San Antonio, TX'}. [Research and describe the venue's history, character, capacity, what makes it unique in the San Antonio arts scene, notable past events, architectural features, neighborhood context]

## About the Artist/Performer
[Detailed bio of the main artist/performer, including their background, musical style, notable works, career highlights, what makes them unique, their connection to San Antonio or Texas, social media presence, and interesting personal details that would make for good conversation]

## Event Details
- Date & Time: ${event?.date ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'} at ${event?.time || '7:00 PM'}
- Venue: ${event?.venue || 'Venue'} (${event?.venueAddress || 'San Antonio, TX'})
- Genre: ${event?.genre || 'Live Entertainment'}
- Tickets: ${event?.ticketPrice || 'Pricing varies'} - ${event?.ticketLink || 'Available at venue'}
- Special Guests: [List any opening acts, special features, or unique elements]
- What to Expect: [Detailed description of the experience - setlist expectations, atmosphere, duration, special moments]

## Local Context
San Antonio's ${event?.genre?.toLowerCase() || 'arts'} scene is [describe the local cultural context, how this event fits into SA's music/arts landscape, seasonal relevance, competing events, why this is happening now, connection to local cultural movements or trends]

## Talking Points & Hooks
- [Interesting angle #1: What's unusual or noteworthy about this artist/event]
- [Local connection: Why San Antonio audiences will connect with this]
- [Perfect timing: Why this is happening at the right moment]
- [Genre context: How this fits into broader musical/cultural trends]
- [Accessibility: Who this appeals to beyond the obvious demographic]
- [Economic angle: What this means for the local venue/arts economy]
- [Fun facts: Surprising or entertaining details that make good conversation]

## Press Release
[If any press materials exist, include key quotes and announcements. If not, note "No official press release available yet."]

## Additional Research
[Include any relevant cultural context, recent news about the artist, venue updates, local arts scene developments, or seasonal/cultural events that provide backdrop for this performance]

IMPORTANT: Make this document rich with specific, interesting details that will spark natural conversation between two knowledgeable hosts. Avoid generic language. Include facts, stories, and context that only someone who really researched this event would know.`;

  try {
    const sourceDocument = await geminiGenerate(prompt, 0.4);
    return { sourceDocument };
  } catch (err) {
    console.error('[Podcast Source] Generation failed:', err);
    // Fallback to a basic template
    const fallbackDoc = createBasicPodcastSource(event, venue);
    return { sourceDocument: fallbackDoc };
  }
}

function createBasicPodcastSource(event, venue) {
  const eventDate = event?.date ? new Date(event.date).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
  }) : 'TBD';

  return `# ${event?.title || 'Event'} — Podcast Source Document

## Event Overview
${event?.title || 'Event'} is a ${event?.genre || 'live entertainment'} event taking place on ${eventDate} at ${event?.time || '7:00 PM'} at ${event?.venue || 'San Antonio venue'}. ${event?.description || 'Join us for an unforgettable evening of entertainment.'}

## About the Venue
${event?.venue || 'The venue'} is located at ${event?.venueAddress || 'San Antonio, TX'}. This venue has been a cornerstone of San Antonio's arts and entertainment scene, providing a intimate setting for performances across various genres.

## About the Artist/Performer
${event?.performers || 'The featured performers'} bring their unique artistry to San Antonio. With roots in ${event?.genre || 'live entertainment'}, they have built a dedicated following through their compelling performances and authentic sound.

## Event Details
- Date & Time: ${eventDate} at ${event?.time || '7:00 PM'}
- Venue: ${event?.venue || 'Venue'} (${event?.venueAddress || 'San Antonio, TX'})
- Genre: ${event?.genre || 'Live Entertainment'}
- Tickets: ${event?.ticketPrice || 'Available'} - ${event?.ticketLink || 'Contact venue for details'}

## Local Context
San Antonio's vibrant arts scene continues to thrive with events like this, bringing both local and touring artists to intimate venues throughout the city. This event represents the kind of cultural programming that makes our city a destination for arts and entertainment.

## Talking Points & Hooks
- Great opportunity to experience ${event?.genre || 'live entertainment'} in an intimate San Antonio setting
- Perfect for both longtime fans and newcomers to the genre
- Supports local venues and the San Antonio arts ecosystem
- Accessible location in ${event?.venueAddress?.includes(',') ? event.venueAddress.split(',')[1]?.trim() : 'San Antonio'}

## Press Release
No official press release available yet.

## Additional Research
This event is part of San Antonio's ongoing commitment to diverse arts programming, providing residents and visitors with access to quality entertainment in local venues.`;
}

// ═══════════════════════════════════════════════════════════════
// MASTER RESEARCH FUNCTION - Combines all research types
// ═══════════════════════════════════════════════════════════════

async function conductResearch({ event, venue, artists = [] }) {
  const results = {
    venue: null,
    context: null,
    artists: [],
    researchedAt: new Date().toISOString(),
    googleMapsUrl: null,
  };

  try {
    // Venue research
    if (venue?.name) {
      const venueResult = await researchVenue({ 
        venueName: venue.name, 
        city: `${venue.city || 'San Antonio'}, ${venue.state || 'TX'}` 
      });
      results.venue = venueResult.venue;
      results.googleMapsUrl = venueResult.venue?.googleMapsUrl;
    }

    // Event context research
    const contextResult = await researchContext({ event, venue });
    results.context = contextResult.context;
    if (!results.googleMapsUrl && contextResult.context?.googleMapsUrl) {
      results.googleMapsUrl = contextResult.context.googleMapsUrl;
    }

    // Artist research
    if (artists && artists.length > 0) {
      for (const artistName of artists) {
        try {
          const artistResult = await researchArtist({ 
            artistName, 
            genre: event?.genre || '' 
          });
          results.artists.push(artistResult.artist);
        } catch (err) {
          console.log(`[Research] Artist research failed for ${artistName}:`, err.message);
        }
      }
    }

    return results;
  } catch (err) {
    console.error('[Research] Master research error:', err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// GOOGLE DRIVE AUTO-SAVE (fire-and-forget)
// ═══════════════════════════════════════════════════════════════

const DRIVE_SUBFOLDER_MAP = {
  press: 'Press Releases',
  social: 'Social Posts',
  email: 'Email Campaigns',
  calendar: 'Calendar Listings',
};

async function saveToGDrive(folderId, fileName, content, mimeType) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'http://localhost:3000';

  await fetch(`${baseUrl}/api/drive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upload-file',
      folderId,
      fileName,
      content,
      mimeType: mimeType || 'text/plain',
    }),
  });
}

async function findSubfolder(parentId, subfolderName) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'http://localhost:3000';

  const resp = await fetch(`${baseUrl}/api/drive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list-files', folderId: parentId }),
  });
  const data = await resp.json();
  const folder = (data.files || []).find(
    f => f.name === subfolderName && f.mimeType === 'application/vnd.google-apps.folder'
  );
  return folder?.id || parentId;
}

async function saveContentToGDrive(eventFolderId, contentMap) {
  const timestamp = new Date().toISOString().split('T')[0];
  for (const [key, text] of Object.entries(contentMap)) {
    if (!text || typeof text !== 'string') continue;
    const subName = DRIVE_SUBFOLDER_MAP[key] || 'Social Posts';
    try {
      const subfolderId = await findSubfolder(eventFolderId, subName);
      await saveToGDrive(subfolderId, `${key}-${timestamp}.txt`, text, 'text/plain');
    } catch (err) {
      console.warn(`[generate] Drive save for ${key} failed:`, err.message);
    }
  }
}

async function saveImageToGDrive(eventFolderId, imageUrl, prompt) {
  try {
    const subfolderId = await findSubfolder(eventFolderId, 'Images');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `image-${timestamp}.png`;

    if (imageUrl.startsWith('data:')) {
      // Base64 data URL
      const base64 = imageUrl.split(',')[1];
      const mime = imageUrl.match(/data:([^;]+)/)?.[1] || 'image/png';
      await saveToGDrive(subfolderId, fileName, base64, mime);
    } else {
      // External URL — fetch and re-upload
      const resp = await fetch(imageUrl);
      const buffer = await resp.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      await saveToGDrive(subfolderId, fileName, base64, 'image/png');
    }
  } catch (err) {
    console.warn('[generate] Drive image save failed:', err.message);
  }
}
