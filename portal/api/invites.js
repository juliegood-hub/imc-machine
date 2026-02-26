import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.method === 'GET' ? req.query : req.body;
  if (!action) return res.status(400).json({ error: 'Tell me which invite action you want and I will run it.' });

  try {
    switch (action) {
      case 'generate-invite': {
        const { name, email, role } = req.body;
        if (!name) return res.status(400).json({ error: 'I need the name before I can generate the invite code.' });
        
        const now = new Date();
        const mmdd = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 10);
        const code = `IMC-${cleanName}-${mmdd}`;
        
        // Check for duplicate, add random suffix if needed
        const { data: existing } = await supabase.from('invites').select('code').eq('code', code);
        const finalCode = existing && existing.length > 0 
          ? `${code}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
          : code;

        const { data, error } = await supabase
          .from('invites')
          .insert({
            code: finalCode,
            email: email || null,
            venue_name: name,
            client_type: role || 'venue_owner',
            used: false,
          })
          .select()
          .single();
        
        if (error) throw error;
        return res.status(200).json({ success: true, invite: data });
      }

      case 'list-invites': {
        const { data, error } = await supabase
          .from('invites')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ success: true, invites: data || [] });
      }

      case 'revoke-invite': {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'I need the invite ID so I can revoke the right one.' });
        const { error } = await supabase.from('invites').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `I do not recognize "${action}" yet. Choose generate-invite, list-invites, or revoke-invite.` });
    }
  } catch (err) {
    console.error(`[invites] ${action} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
