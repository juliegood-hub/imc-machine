// ═══════════════════════════════════════════════════════════════
// Vercel Serverless Function — Campaign Tracker CRUD to Supabase
// POST /api/sync-tracker
// Body: { eventId, eventTitle, eventDate, venueName, channels, action }
//
// Actions:
//   create  → Create new campaign record
//   update  → Update campaign status/channels
//   read    → Get campaign by eventId
//   list    → List all campaigns for venue/all
//   delete  → Delete campaign record
//
// Uses Supabase campaigns table
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import {
  ApiAuthError,
  assertEventOwnership,
  requireApiAuth,
  resolvePayloadEventId,
  scopePayloadToUser,
} from './_auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qavrufepvcihklypxbvm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
}

const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (!supabase) {
    return res.status(500).json({ error: 'I need Supabase credentials before I can track campaigns.' });
  }

  try {
    const authContext = await requireApiAuth(req, { supabase });
    const payload = scopePayloadToUser(req.body || {}, authContext);
    const action = payload.action || 'update';
    const eventId = resolvePayloadEventId(payload) || payload.eventId;
    if (eventId) {
      await assertEventOwnership(supabase, authContext, eventId);
    }
    req.body = payload;

    switch (action) {
      case 'create':
        return await createCampaign(req, res);
      case 'update':
        return await updateCampaign(req, res);
      case 'read':
        return await readCampaign(req, res);
      case 'list':
        return await listCampaigns(req, res);
      case 'delete':
        return await deleteCampaign(req, res);
      default:
        return res.status(400).json({ error: `I do not recognize "${action}" yet. Use create, update, read, list, or delete.` });
    }
  } catch (err) {
    console.error('[sync-tracker] Error:', err);
    if (err instanceof ApiAuthError) {
      return res.status(err.status || 401).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// CREATE CAMPAIGN
// ═══════════════════════════════════════════════════════════════

async function createCampaign(req, res) {
  const { eventId, eventTitle, eventDate, venueName, venue_id, channels = {} } = req.body;
  
  if (!eventId || !eventTitle) {
    return res.status(400).json({ error: 'I need both eventId and eventTitle to create a campaign.' });
  }

  const campaignData = {
    event_id: eventId,
    event_title: eventTitle,
    event_date: eventDate,
    venue_name: venueName || 'Unknown Venue',
    venue_id: venue_id || null,
    channels: channels,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('campaigns')
    .insert([campaignData])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ 
    success: true, 
    campaign: data,
    message: `Perfect. I created the campaign for ${eventTitle}.` 
  });
}

// ═══════════════════════════════════════════════════════════════
// UPDATE CAMPAIGN
// ═══════════════════════════════════════════════════════════════

async function updateCampaign(req, res) {
  const { eventId, channels, eventTitle, eventDate, venueName } = req.body;
  
  if (!eventId) {
    return res.status(400).json({ error: 'I need eventId before I can update this campaign.' });
  }

  // Calculate completion percentage
  const channelKeys = ['press', 'calendar_do210', 'calendar_sacurrent', 'calendar_evvnt', 
                      'eventbrite', 'social_facebook', 'social_instagram', 'social_linkedin',
                      'email_campaign', 'sms_blast', 'graphics_poster', 'graphics_social', 
                      'graphics_story', 'press_page', 'bilingual'];
  
  const completedCount = channelKeys.filter(key => {
    const status = channels?.[key]?.status;
    return status === 'sent' || status === 'published' || status === 'created';
  }).length;
  
  const completionPct = Math.round((completedCount / channelKeys.length) * 100);

  const updateData = {
    channels: channels || {},
    completion_pct: completionPct,
    completed_channels: completedCount,
    total_channels: channelKeys.length,
    updated_at: new Date().toISOString(),
  };

  // Include optional fields if provided
  if (eventTitle) updateData.event_title = eventTitle;
  if (eventDate) updateData.event_date = eventDate;
  if (venueName) updateData.venue_name = venueName;

  const { data, error } = await supabase
    .from('campaigns')
    .update(updateData)
    .eq('event_id', eventId)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    // Campaign doesn't exist, create it
    return createCampaign(req, res);
  }

  return res.status(200).json({ 
    success: true, 
    campaign: data,
    completion: `${completionPct}%`,
    message: `I updated the campaign: ${completedCount}/${channelKeys.length} channels complete.`
  });
}

// ═══════════════════════════════════════════════════════════════
// READ CAMPAIGN
// ═══════════════════════════════════════════════════════════════

async function readCampaign(req, res) {
  const { eventId } = req.body;
  
  if (!eventId) {
    return res.status(400).json({ error: 'I need eventId before I can look up this campaign.' });
  }

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'I could not find that campaign yet.' });
  }

  return res.status(200).json({ 
    success: true, 
    campaign: data 
  });
}

// ═══════════════════════════════════════════════════════════════
// LIST CAMPAIGNS
// ═══════════════════════════════════════════════════════════════

async function listCampaigns(req, res) {
  const { venue_id, limit = 50 } = req.body;
  
  let query = supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (venue_id) {
    query = query.eq('venue_id', venue_id);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ 
    success: true, 
    campaigns: data || [],
    count: data?.length || 0
  });
}

// ═══════════════════════════════════════════════════════════════
// DELETE CAMPAIGN
// ═══════════════════════════════════════════════════════════════

async function deleteCampaign(req, res) {
  const { eventId } = req.body;
  
  if (!eventId) {
    return res.status(400).json({ error: 'I need eventId before I can delete this campaign.' });
  }

  const { data, error } = await supabase
    .from('campaigns')
    .delete()
    .eq('event_id', eventId)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ 
    success: true, 
    message: `Done. Campaign ${eventId} is deleted.`,
    deleted: data
  });
}
