// ═══════════════════════════════════════════════════════════════
// IMC Machine — Facebook Event Creation + Co-Hosting
// All API calls routed through /api/distribute (server-side)
// NO API keys in client code
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// CREATE FACEBOOK EVENT on GCM's Page
// ═══════════════════════════════════════════════════════════════

export async function createFacebookEvent(event, venue) {
  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-facebook-event',
        event,
        venue,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Facebook event creation failed',
        setup: data.setup,
      };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// ADD CO-HOSTS (Venue Page + Artist Pages)
// ═══════════════════════════════════════════════════════════════

export async function addCohosts(fbEventId, cohostPageIds) {
  if (!fbEventId || !cohostPageIds?.length) {
    return { success: false, error: 'Event ID and cohost page IDs required' };
  }
  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'facebook-add-cohosts',
        fbEventId,
        cohostPageIds,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD EVENT COVER PHOTO
// ═══════════════════════════════════════════════════════════════

export async function uploadEventCover(fbEventId, imageUrl) {
  if (!fbEventId || !imageUrl) return { success: false };
  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'facebook-upload-cover',
        fbEventId,
        imageUrl,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// FULL FLOW — Create event + upload cover + add co-hosts
// ═══════════════════════════════════════════════════════════════

export async function createFullFacebookEvent(event, venue, research, coverImageUrl) {
  // Step 1: Create the event
  const createResult = await createFacebookEvent(event, venue);
  if (!createResult.success) return createResult;

  const fbEventId = createResult.eventId;

  // Step 2: Upload cover photo
  if (coverImageUrl) {
    const coverResult = await uploadEventCover(fbEventId, coverImageUrl);
    createResult.coverUploaded = coverResult.success;
  }

  // Step 3: Add co-hosts from research
  const cohostIds = [];
  if (venue?.facebookPageId) {
    cohostIds.push(venue.facebookPageId);
  }
  if (research?.artists) {
    for (const artist of research.artists) {
      if (artist.facebookPageId) {
        cohostIds.push(artist.facebookPageId);
      }
    }
  }

  if (cohostIds.length > 0) {
    createResult.cohostResults = await addCohosts(fbEventId, cohostIds);
  } else {
    createResult.cohostResults = {
      success: false,
      note: 'No co-host Page IDs found. Add venue and artist Facebook Page IDs in venue setup or research.',
    };
  }

  return createResult;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS (client-side only, no keys needed)
// ═══════════════════════════════════════════════════════════════

function convertTo24h(timeStr) {
  if (!timeStr) return '19:00';
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return '19:00';
  let h = parseInt(match[1]);
  const m = match[2];
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}
