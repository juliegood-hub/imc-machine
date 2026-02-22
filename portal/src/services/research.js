// ═══════════════════════════════════════════════════════════════
// IMC Machine — Research Engine (Client-Side)
// All API calls routed through /api/generate (server-side)
// NO API keys in client code
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// GOOGLE PLACES — Venue Research
// ═══════════════════════════════════════════════════════════════

export async function researchVenue(venueName, city = 'San Antonio, TX') {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'research-venue', venueName, city }),
    });
    const data = await res.json();
    if (!data.success) return null;
    return data.venue;
  } catch (err) {
    console.error('[Research] Venue research error:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// ARTIST / PERFORMER RESEARCH
// ═══════════════════════════════════════════════════════════════

export async function researchArtist(artistName, genre = '') {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'research-artist', artistName, genre }),
    });
    const data = await res.json();
    if (!data.success) return null;
    return data.artist;
  } catch (err) {
    console.error('[Research] Artist research error:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// EVENT CONTEXT RESEARCH
// ═══════════════════════════════════════════════════════════════

export async function researchEventContext(event, venue) {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'research-context', event, venue }),
    });
    const data = await res.json();
    if (!data.success) return null;
    return data.context;
  } catch (err) {
    console.error('[Research] Event context error:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// MASTER RESEARCH FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function conductResearch(event, venue, artists = []) {
  console.log('[Research] Starting research for:', event.title);
  
  const [venueData, contextData, ...artistData] = await Promise.all([
    venue?.name ? researchVenue(venue.name, `${venue.city || 'San Antonio'}, ${venue.state || 'TX'}`) : null,
    researchEventContext(event, venue),
    ...artists.map(a => researchArtist(a, event.genre)),
  ]);

  const brief = {
    venue: venueData,
    context: contextData,
    artists: artistData.filter(Boolean),
    researchedAt: new Date().toISOString(),
    googleMapsUrl: contextData?.googleMapsUrl || venueData?.googleMapsUrl || null,
  };

  console.log('[Research] Complete:', {
    venueFound: !!venueData,
    contextFound: !!contextData,
    artistsFound: artistData.filter(Boolean).length,
  });

  return brief;
}

// ═══════════════════════════════════════════════════════════════
// FORMAT RESEARCH INTO PROMPT CONTEXT
// ═══════════════════════════════════════════════════════════════

export function formatResearchForPrompt(research) {
  if (!research) return '';

  let context = '\n\n=== RESEARCH BRIEF (use these facts in your writing) ===\n';

  if (research.venue) {
    const v = research.venue;
    context += `\nVENUE RESEARCH:\n`;
    context += `- Official name: ${v.name || 'N/A'}\n`;
    context += `- Address: ${v.address || 'N/A'}\n`;
    context += `- Neighborhood: ${v.neighborhood || 'N/A'}\n`;
    context += `- Description: ${v.description || 'N/A'}\n`;
    context += `- Known for: ${v.knownFor?.join(', ') || 'N/A'}\n`;
    context += `- Type: ${v.type || 'N/A'}\n`;
    context += `- Website: ${v.website || 'N/A'}\n`;
    context += `- Google Maps: ${v.googleMapsUrl || research.googleMapsUrl || 'N/A'}\n`;
    if (v.capacity) context += `- Capacity: ${v.capacity}\n`;
    if (v.parkingInfo) context += `- Parking: ${v.parkingInfo}\n`;
    if (v.socialMedia?.instagram) context += `- Instagram: ${v.socialMedia.instagram}\n`;
  }

  if (research.artists?.length > 0) {
    context += `\nARTIST RESEARCH:\n`;
    for (const a of research.artists) {
      context += `\n- ${a.name}:\n`;
      context += `  Bio: ${a.bio || 'N/A'}\n`;
      context += `  Genre: ${a.genre || 'N/A'}\n`;
      context += `  Origin: ${a.origin || 'N/A'}\n`;
      if (a.notableWorks?.length) context += `  Notable works: ${a.notableWorks.join(', ')}\n`;
      if (a.spotifyUrl) context += `  Spotify: ${a.spotifyUrl}\n`;
      if (a.comparisons) context += `  For fans of: ${a.comparisons}\n`;
      if (a.localConnection) context += `  SA connection: ${a.localConnection}\n`;
    }
  }

  if (research.context) {
    const c = research.context;
    context += `\nEVENT CONTEXT:\n`;
    context += `- Cultural context: ${c.culturalContext || 'N/A'}\n`;
    context += `- SA arts scene: ${c.sanAntonioArtsScene || 'N/A'}\n`;
    context += `- Audience: ${c.audienceInsight || 'N/A'}\n`;
    context += `- Media angle: ${c.mediaAngle || 'N/A'}\n`;
    if (c.pullQuote) context += `- Suggested quote: "${c.pullQuote}"\n`;
    if (c.seasonalRelevance) context += `- Seasonal relevance: ${c.seasonalRelevance}\n`;
    if (c.hashtagSuggestions?.length) context += `- Hashtags: ${c.hashtagSuggestions.join(' ')}\n`;
  }

  context += `\nGoogle Maps link: ${research.googleMapsUrl || 'N/A'}\n`;
  context += `\n=== END RESEARCH BRIEF ===\n`;
  context += `\nIMPORTANT: Use the research facts above in your writing. Include the Google Maps link in press releases and social posts.\n`;

  return context;
}
