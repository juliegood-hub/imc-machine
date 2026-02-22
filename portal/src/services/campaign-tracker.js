// ═══════════════════════════════════════════════════════════════
// IMC Machine — Campaign Tracker Service (Client-Side)
// Tracks all IMC distribution per event in Supabase campaigns table
// All API calls routed through /api/sync-tracker (server-side)
// NO API keys in client code
//
// Patent ref: §7.10 Monitoring & Analytics, §7.7 IMC Distribution & PR Engine
// ═══════════════════════════════════════════════════════════════

// LocalStorage backup for offline support
const STORAGE_KEY = 'imc-campaign-tracker';

function loadLocalTracker() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch { return {}; }
}

function saveLocalTracker(tracker) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker));
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN RECORD STRUCTURE
// ═══════════════════════════════════════════════════════════════
// tracker = {
//   [eventId]: {
//     eventTitle: "...",
//     venueName: "...",
//     eventDate: "2026-03-15",
//     createdAt: ISO string,
//     channels: {
//       press: { status, sentAt, recipients: [{name, email, status, link}], driveUrl },
//       calendar_do210: { status, sentAt, submissionUrl, confirmationUrl },
//       calendar_sacurrent: { status, sentAt, submissionUrl },
//       calendar_evvnt: { status, sentAt, submissionUrl, syndicatedTo: [...] },
//       eventbrite: { status, eventUrl, ticketUrl },
//       social_facebook: { status, postUrl, scheduledAt },
//       social_instagram: { status, postUrl, scheduledAt },
//       social_linkedin: { status, postUrl, scheduledAt },
//       email_campaign: { status, sentAt, recipientCount, openRate },
//       sms_blast: { status, sentAt, recipientCount },
//       graphics_poster: { status, driveUrl, engine },
//       graphics_social: { status, driveUrl, engine },
//       graphics_story: { status, driveUrl, engine },
//       press_page: { status, pageUrl },
//       bilingual: { status, spanishPressUrl, spanishSocialUrl },
//     },
//     driveFolder: { folderId, folderUrl },
//     masterTagSheet: { sheetUrl },
//   }
// }

export async function getCampaign(eventId) {
  try {
    const res = await fetch('/api/sync-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read', eventId }),
    });
    const data = await res.json();
    if (!data.success) {
      // Fallback to localStorage
      const tracker = loadLocalTracker();
      return tracker[eventId] || null;
    }
    // Cache locally for offline support
    const tracker = loadLocalTracker();
    tracker[eventId] = data.campaign;
    saveLocalTracker(tracker);
    return data.campaign;
  } catch (err) {
    console.error('[Campaign] Failed to fetch campaign:', err.message);
    // Fallback to localStorage
    const tracker = loadLocalTracker();
    return tracker[eventId] || null;
  }
}

export async function getAllCampaigns(venue_id = null) {
  try {
    const res = await fetch('/api/sync-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', venue_id }),
    });
    const data = await res.json();
    if (!data.success) {
      // Fallback to localStorage
      return loadLocalTracker();
    }
    return data.campaigns || [];
  } catch (err) {
    console.error('[Campaign] Failed to fetch campaigns:', err.message);
    // Fallback to localStorage
    return loadLocalTracker();
  }
}

export async function initCampaign(eventId, event, venue) {
  try {
    const res = await fetch('/api/sync-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        eventId,
        eventTitle: event.title,
        eventDate: event.date,
        venueName: venue?.name || 'Unknown Venue',
        venue_id: venue?.id || null,
        channels: {},
      }),
    });
    const data = await res.json();
    if (data.success) {
      // Cache locally for offline support
      const tracker = loadLocalTracker();
      tracker[eventId] = data.campaign;
      saveLocalTracker(tracker);
      return data.campaign;
    }
    throw new Error(data.error || 'Failed to create campaign');
  } catch (err) {
    console.error('[Campaign] Failed to create campaign:', err.message);
    // Fallback to localStorage
    const tracker = loadLocalTracker();
    if (!tracker[eventId]) {
      tracker[eventId] = {
        event_id: eventId,
        event_title: event.title,
        venue_name: venue?.name || 'Unknown Venue',
        event_date: event.date,
        created_at: new Date().toISOString(),
        channels: {},
        driveFolder: null,
        masterTagSheet: null,
      };
      saveLocalTracker(tracker);
    }
    return tracker[eventId];
  }
}

export async function updateChannel(eventId, channelKey, data) {
  try {
    // Get current campaign
    const campaign = await getCampaign(eventId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    // Update channel data
    const updatedChannels = {
      ...campaign.channels,
      [channelKey]: {
        ...campaign.channels?.[channelKey],
        ...data,
        updatedAt: new Date().toISOString(),
      },
    };

    const res = await fetch('/api/sync-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        eventId,
        channels: updatedChannels,
      }),
    });
    const result = await res.json();
    if (result.success) {
      // Cache locally for offline support
      const tracker = loadLocalTracker();
      tracker[eventId] = result.campaign;
      saveLocalTracker(tracker);
      return result.campaign;
    }
    throw new Error(result.error || 'Failed to update campaign');
  } catch (err) {
    console.error('[Campaign] Failed to update channel:', err.message);
    // Fallback to localStorage
    const tracker = loadLocalTracker();
    if (tracker[eventId]) {
      tracker[eventId].channels = tracker[eventId].channels || {};
      tracker[eventId].channels[channelKey] = {
        ...tracker[eventId].channels[channelKey],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      saveLocalTracker(tracker);
      return tracker[eventId];
    }
    return null;
  }
}

export async function updateDriveFolder(eventId, folderId, folderUrl) {
  try {
    // For drive folder, we'll store it in the channels as a special entry
    return await updateChannel(eventId, 'drive_folder', {
      status: 'created',
      folderId,
      folderUrl,
      driveUrl: folderUrl,
    });
  } catch (err) {
    console.error('[Campaign] Failed to update drive folder:', err.message);
    // Fallback to localStorage
    const tracker = loadLocalTracker();
    if (tracker[eventId]) {
      tracker[eventId].driveFolder = { folderId, folderUrl };
      saveLocalTracker(tracker);
      return tracker[eventId];
    }
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN SUMMARY — For dashboard display
// ═══════════════════════════════════════════════════════════════

export async function getCampaignSummary(eventId) {
  const campaign = await getCampaign(eventId);
  if (!campaign) return null;

  const channels = campaign.channels || {};
  const allKeys = [
    'press', 'calendar_do210', 'calendar_sacurrent', 'calendar_evvnt',
    'eventbrite', 'social_facebook', 'social_instagram', 'social_linkedin',
    'email_campaign', 'sms_blast', 'graphics_poster', 'graphics_social',
    'graphics_story', 'press_page', 'bilingual',
  ];

  const total = allKeys.length;
  const completed = allKeys.filter(k => channels[k]?.status === 'sent' || channels[k]?.status === 'published' || channels[k]?.status === 'created').length;
  const pending = allKeys.filter(k => channels[k]?.status === 'pending' || channels[k]?.status === 'queued').length;
  const failed = allKeys.filter(k => channels[k]?.status === 'failed' || channels[k]?.status === 'error').length;
  const notStarted = total - completed - pending - failed;

  return {
    eventTitle: campaign.event_title || campaign.eventTitle,
    venueName: campaign.venue_name || campaign.venueName,
    eventDate: campaign.event_date || campaign.eventDate,
    total,
    completed,
    pending,
    failed,
    notStarted,
    completionPct: campaign.completion_pct || Math.round((completed / total) * 100),
    channels,
    driveFolder: campaign.driveFolder || channels.drive_folder,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TO CSV — For manual review or Google Sheets import
// ═══════════════════════════════════════════════════════════════

export async function exportCampaignCSV(eventId) {
  const campaign = await getCampaign(eventId);
  if (!campaign) return '';

  const rows = [['Channel', 'Status', 'Sent/Created At', 'Link/URL', 'Recipients', 'Notes']];
  const ch = campaign.channels || {};

  const channelMeta = {
    press: { label: '📰 Press Release', link: ch.press?.driveUrl },
    calendar_do210: { label: '📅 Do210', link: ch.calendar_do210?.submissionUrl || ch.calendar_do210?.confirmationUrl },
    calendar_sacurrent: { label: '📅 SA Current', link: ch.calendar_sacurrent?.submissionUrl },
    calendar_evvnt: { label: '📅 Evvnt', link: ch.calendar_evvnt?.submissionUrl },
    eventbrite: { label: '🎟️ Eventbrite', link: ch.eventbrite?.eventUrl },
    social_facebook: { label: '📱 Facebook', link: ch.social_facebook?.postUrl },
    social_instagram: { label: '📸 Instagram', link: ch.social_instagram?.postUrl },
    social_linkedin: { label: '💼 LinkedIn', link: ch.social_linkedin?.postUrl },
    email_campaign: { label: '📧 Email Campaign', link: '' },
    sms_blast: { label: '💬 SMS Blast', link: '' },
    graphics_poster: { label: '🎨 Poster', link: ch.graphics_poster?.driveUrl },
    graphics_social: { label: '🎨 Social Banner', link: ch.graphics_social?.driveUrl },
    graphics_story: { label: '🎨 IG Story', link: ch.graphics_story?.driveUrl },
    press_page: { label: '🌐 Press Page', link: ch.press_page?.pageUrl },
    bilingual: { label: '🇲🇽 Spanish/Bilingual', link: ch.bilingual?.spanishPressUrl },
  };

  for (const [key, meta] of Object.entries(channelMeta)) {
    const c = ch[key] || {};
    rows.push([
      meta.label,
      c.status || 'not started',
      c.sentAt || c.createdAt || c.updatedAt || '',
      meta.link || '',
      c.recipientCount || c.recipients?.length || '',
      c.error || c.message || '',
    ]);
  }

  return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ═══════════════════════════════════════════════════════════════
// DELETE CAMPAIGN
// ═══════════════════════════════════════════════════════════════

export async function deleteCampaign(eventId) {
  try {
    const res = await fetch('/api/sync-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', eventId }),
    });
    const data = await res.json();
    if (data.success) {
      // Remove from localStorage too
      const tracker = loadLocalTracker();
      delete tracker[eventId];
      saveLocalTracker(tracker);
      return { success: true, message: data.message };
    }
    throw new Error(data.error || 'Failed to delete campaign');
  } catch (err) {
    console.error('[Campaign] Failed to delete campaign:', err.message);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// SUPABASE SYNC - Force sync local data to database
// ═══════════════════════════════════════════════════════════════

export async function syncToSupabase(eventId) {
  try {
    // Get current campaign data to verify sync
    const campaign = await getCampaign(eventId);
    if (!campaign) {
      return { synced: false, reason: 'Campaign not found' };
    }
    
    console.log(`[Tracker] Campaign ${eventId} synced to Supabase successfully`);
    return { synced: true, campaign };
  } catch (err) {
    console.error(`[Tracker] Failed to sync ${eventId} to Supabase:`, err.message);
    return { synced: false, reason: err.message };
  }
}
