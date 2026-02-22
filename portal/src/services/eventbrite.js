// ═══════════════════════════════════════════════════════════════
// IMC Machine — Eventbrite Service (Client-Side)
// All API calls routed through /api/distribute (server-side)
// NO API keys in client code
// ═══════════════════════════════════════════════════════════════

export async function createEventbriteEvent(event, venue, options = {}) {
  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-eventbrite',
        event,
        venue,
        options,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Eventbrite creation failed');
    return {
      success: true,
      eventbriteId: data.eventId,
      eventUrl: data.eventUrl,
      ticketUrl: data.eventUrl,
      published: data.published,
      message: `Event created on Eventbrite: ${data.eventUrl}`,
    };
  } catch (err) {
    console.error('[Eventbrite] Create event error:', err.message);
    return { 
      success: false, 
      error: err.message,
      message: `Failed to create Eventbrite event: ${err.message}`,
    };
  }
}

export async function getEventbriteStatus() {
  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-status' }),
    });
    const data = await res.json();
    return data.success ? data.eventbrite : { ready: false, provider: 'Eventbrite' };
  } catch (err) {
    console.error('[Eventbrite] Status check error:', err.message);
    return { ready: false, provider: 'Eventbrite', error: err.message };
  }
}

// Legacy support - keep the object structure for backwards compatibility
export const eventbriteService = {
  async createEvent(eventData, venue = null, options = {}) {
    return await createEventbriteEvent(eventData, venue, options);
  },

  async getEventSales(eventbriteId) {
    // TODO: GET ticket sales data via API
    console.log(`[Eventbrite] Would get sales data for ${eventbriteId}`);
    return { sold: 0, total: 0, revenue: 0, note: 'Sales data API not yet implemented' };
  },

  async syncEvent(eventbriteId) {
    // TODO: Sync event data from Eventbrite via API
    console.log(`[Eventbrite] Would sync event data for ${eventbriteId}`);
    return { synced: false, note: 'Event sync API not yet implemented' };
  },

  async getStatus() {
    return await getEventbriteStatus();
  },
};
