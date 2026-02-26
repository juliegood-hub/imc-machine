// ═══════════════════════════════════════════════════════════════
// IMC Machine: Media Library API
// POST /api/media  { action: 'upload' | 'list' | 'delete', ... }
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'media';

async function supabaseRest(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : undefined,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  return r.json();
}

async function ensureBucket() {
  // Try to get bucket info; create if missing
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  if (r.status === 404) {
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Send this endpoint a POST request and I can run it.' });

  const { action } = req.body;

  try {
    switch (action) {
      case 'upload': {
        const { base64, category, label, eventId, userId, fileName, mimeType } = req.body;
        if (!base64 || !userId) return res.status(400).json({ error: 'I need the file payload and user ID before I can upload this.' });

        await ensureBucket();

        // Decode base64
        const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const ext = (mimeType || 'image/jpeg').split('/')[1] || 'jpg';
        const storagePath = `${userId}/${Date.now()}-${fileName || `upload.${ext}`}`;

        // Upload to storage
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': mimeType || 'image/jpeg',
          },
          body: buffer,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.text();
          throw new Error(`I could not upload that file to storage yet: ${err}`);
        }

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

        // Insert record
        const record = await supabaseRest('media', 'POST', {
          user_id: userId,
          event_id: eventId || null,
          category: category || 'general',
          label: label || '',
          original_url: publicUrl,
          mime_type: mimeType || 'image/jpeg',
          metadata: {},
        });

        return res.status(200).json({ success: true, url: publicUrl, record: Array.isArray(record) ? record[0] : record });
      }

      case 'list': {
        const { userId, category, eventId } = req.body;
        let query = `media?user_id=eq.${userId}&order=created_at.desc`;
        if (category) query += `&category=eq.${category}`;
        if (eventId) query += `&event_id=eq.${eventId}`;
        const data = await supabaseRest(query);
        return res.status(200).json({ success: true, media: data });
      }

      case 'delete': {
        const { id, userId } = req.body;
        if (!id) return res.status(400).json({ error: 'I need the media ID so I can delete the right file.' });

        // Get record to find storage path
        const records = await supabaseRest(`media?id=eq.${id}&user_id=eq.${userId}`);
        if (!records?.length) return res.status(404).json({ error: 'I could not find that media record.' });

        const record = records[0];
        // Extract storage path from URL
        const storagePath = record.original_url.split(`/object/public/${BUCKET}/`)[1];
        if (storagePath) {
          await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
            method: 'DELETE',
            headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
          });
        }

        // Delete record
        await supabaseRest(`media?id=eq.${id}`, 'DELETE');
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `I do not recognize "${action}" yet. Choose upload, list, or delete.` });
    }
  } catch (err) {
    console.error('[media]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
