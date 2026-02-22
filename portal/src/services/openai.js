// ═══════════════════════════════════════════════════════════════
// IMC Machine — Content Generation Service (Client-Side)
// All API calls routed through /api/generate (server-side)
// NO API keys in client code
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// LAYER 1: GCM HOUSE STYLE — The Agency DNA (never changes)
// ═══════════════════════════════════════════════════════════════

const GCM_HOUSE_STYLE_COPY = `You are the creative director at Good Creative Media, a San Antonio-based integrated marketing communications agency representing arts venues, live music, theater, and cultural events.

VOICE & TONE:
- You are a seasoned NYT entertainment journalist who genuinely loves the type of event you are writing about. You are a fan first, a professional second. Your enthusiasm is real, not performed.
- Confident but never arrogant. Authoritative but warm. Human, not robotic.
- Write like The New Yorker meets Austin City Limits: culturally literate, sharp, inviting.
- Every word earns its place. No filler. No clichés. No "Don't miss out!" or "You won't want to miss this!"
- Speak TO the audience, not AT them. They're intelligent adults who love art.
- San Antonio pride without being corny about it. This city has culture: let it speak.

LANGUAGE RULES:
- NEVER use em dashes (—) or en dashes (–). Use a colon, semicolon, comma, period, or rewrite the sentence instead. Hyphens (-) are ONLY acceptable in hyphenated words (e.g. "well-known," "sold-out," "singer-songwriter"). This is a strict rule.
- Never use: "epic," "unmissable," "game-changing," "synergy," "leverage," "elevate" (as marketing buzzword), "iconic" (unless literally true), "curated"
- Prefer: precise verbs, sensory language, specific details over vague hype
- Write like a human who was there, not a press release template. Let your genuine knowledge of the genre show.
- Bilingual when appropriate: San Antonio is 64% Hispanic. Offer Spanish versions naturally.
- Names and titles are sacred: never abbreviate without permission.

BRAND HIERARCHY:
1. The Venue (client's name is primary: this is their show)
2. The Event/Show (what people are coming for)
3. Good Creative Media (produced by / powered by. Subtle, professional)`;

// ═══════════════════════════════════════════════════════════════
// GENRE → STYLE MAPPING
// ═══════════════════════════════════════════════════════════════

const GENRE_STYLES = {
  'Theater|Plays|Musicals': {
    tone: 'Literary, evocative, dramatic without melodrama.',
    mood: 'The anticipation before curtain rise. Warmth of a packed house.'
  },
  'Live Music|Contemporary|Jazz|Electronic|Indie': {
    tone: 'Energetic, insider-cool, specific music references.',
    mood: 'The electricity of a live room. Sound you can feel.'
  },
  'Orchestral|Classical|Choral': {
    tone: 'Contemplative, precise, respectful of tradition.',
    mood: 'The silence before the downbeat. Sacred attention.'
  },
  'Comedy|Speaking|Lectures|Workshops': {
    tone: 'Sharp, witty, conversational.',
    mood: 'The lean-in moment. Anticipation of the punchline or insight.'
  },
  'Dance|Performance Art|Experimental': {
    tone: 'Provocative, sensory-rich, boundary-pushing.',
    mood: 'Bodies in space. The unfamiliar made magnetic.'
  }
};

function getGenreStyle(genre) {
  if (!genre) return GENRE_STYLES['Live Music|Contemporary|Jazz|Electronic|Indie'];
  for (const [key, style] of Object.entries(GENRE_STYLES)) {
    if (key.toLowerCase().includes(genre.toLowerCase()) || genre.toLowerCase().includes(key.split('|')[0].toLowerCase())) {
      return style;
    }
  }
  return GENRE_STYLES['Live Music|Contemporary|Jazz|Electronic|Indie'];
}

function buildVenueBrandPrompt(venue) {
  if (!venue || !venue.name) return '';
  return `
VENUE PROFILE:
- Name: ${venue.name}
- Location: ${venue.address || ''}, ${venue.city || 'San Antonio'}, ${venue.state || 'TX'}
- Brand Colors: Primary ${venue.brandPrimaryColor || '#0d1b2a (Navy)'}, Secondary ${venue.brandSecondaryColor || '#c8a45e (Gold)'}
- Social: ${venue.website || ''} ${venue.instagram ? '| IG @' + venue.instagram : ''} ${venue.facebook ? '| FB ' + venue.facebook : ''}

Always use the venue's exact name as written. Reference the San Antonio neighborhood when relevant.`;
}

// ═══════════════════════════════════════════════════════════════
// BUILD CHANNEL PROMPTS (client-side) then send to server
// ═══════════════════════════════════════════════════════════════

function buildChannelPrompts(event, channelKeys, venue, researchContext) {
  const venueBrand = buildVenueBrandPrompt(venue);
  const genreStyle = getGenreStyle(event.genre);

  const eventInfo = `
EVENT: ${event.title}
DATE: ${event.date} at ${event.time}
GENRE: ${event.genre}
DESCRIPTION: ${event.description || '[No description provided]'}
VENUE: ${venue?.name || '[Venue TBD]'}${venue?.address ? ', ' + venue.address + ', ' + (venue.city || 'San Antonio') + ', ' + (venue.state || 'TX') : ''}
TICKET LINK: ${event.ticketLink || '[Ticket link TBD]'}
GENRE TONE: ${genreStyle.tone}
${researchContext}
  `.trim();

  return channelKeys.map(channel => {
    let systemPrompt = '';
    let userPrompt = '';

    switch (channel) {
      case 'press':
        systemPrompt = `${GCM_HOUSE_STYLE_COPY}\n\n${venueBrand}\n\nYou write press releases in strict AP style. Tight paragraphs, real journalism standards. Lead with the most compelling detail, not the date.`;
        userPrompt = `Write a press release for this event:\n\n${eventInfo}\n\nFORMAT:\n- Headline: Active voice, present tense, compelling\n- Dateline: SAN ANTONIO, TX: (date)\n- Lead paragraph: Who, what, when, where, why\n- Body: 2-3 paragraphs\n- Quote placeholder\n- Event details block\n- Boilerplate\n- Contact line\n- Word count: 350-500 words\n\nDistributed to SA Express-News, SA Current, KSAT 12, KENS 5, TPR, SA Report.`;
        break;
      case 'calendar':
        systemPrompt = `${GCM_HOUSE_STYLE_COPY}\n\n${venueBrand}\n\nYou write concise, vivid event calendar listings.`;
        userPrompt = `Write event calendar listings for:\n\n${eventInfo}\n\nCreate THREE versions:\n1. **Do210**: Fun, casual, SA-native. 2-3 sentences.\n2. **San Antonio Current**: Arts/culture angle. 2-3 sentences.\n3. **Evvnt / Express-News**: Straightforward, news-style. 2 sentences.\n4. **Spanish Version** for La Prensa Texas.\n\nLabel each clearly.`;
        break;
      case 'email':
        systemPrompt = `${GCM_HOUSE_STYLE_COPY}\n\n${venueBrand}\n\nYou write event announcement emails that drive ticket sales without being spammy.`;
        userPrompt = `Write an event announcement email for:\n\n${eventInfo}\n\nInclude: Subject Line (<50 chars), Preview Text (<90 chars), Email Body (3-4 paragraphs), CTA Button Text (4 words max), P.S. line.`;
        break;
      case 'sms':
        systemPrompt = `${GCM_HOUSE_STYLE_COPY}\n\n${venueBrand}\n\nYou write SMS text blasts. Under 160 characters. Direct, exciting, human.`;
        userPrompt = `Write SMS messages for:\n\n${eventInfo}\n\n1. Announcement: under 160 chars\n2. Reminder (day before): under 160 chars\n3. Day-of: under 160 chars`;
        break;
      case 'social':
        systemPrompt = `${GCM_HOUSE_STYLE_COPY}\n\n${venueBrand}\n\nYou create platform-native social posts. Never copy-paste across platforms.`;
        userPrompt = `Create social media posts for:\n\n${eventInfo}\n\nGenre mood: ${genreStyle.mood}\n\nCreate FOUR posts:\n1. **Facebook**: Community-oriented, longer form.\n2. **Instagram Caption**: Visual-first, 15-20 hashtags.\n3. **Instagram Story Text**: 2-3 lines max.\n4. **LinkedIn**: Professional angle, 3-5 hashtags.\n\nLabel each clearly.`;
        break;
      default:
        systemPrompt = GCM_HOUSE_STYLE_COPY;
        userPrompt = `Write marketing content for: ${eventInfo}`;
    }

    return { key: channel, systemPrompt, userPrompt };
  });
}

export const openaiService = {
  async generateContent(event, channels, venue, researchContext = '') {
    const channelPrompts = buildChannelPrompts(event, channels, venue, researchContext);

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate-content',
        channels: channelPrompts,
      }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Content generation failed');
    return data.content;
  },
};
