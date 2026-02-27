// ═══════════════════════════════════════════════════════════════
// IMC Machine: Setup Wizard API
// Vercel Serverless Function
//
// Handles setup wizard operations:
// - save-secret: Store platform secrets in Supabase + Vercel
// - check-connections: Check which platforms have stored tokens
// - test-connections: Test API connectivity
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { ApiAuthError, requireApiAuth } from './_auth.js';

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Use GET or POST here and I will take it from there.' });
  }

  const { action } = req.method === 'GET' ? req.query : req.body;
  if (!action) return res.status(400).json({ error: 'Tell me what action to run and I will take it from there.' });

  try {
    const adminOnly = action === 'save-secret' || action === 'test-connections';
    await requireApiAuth(req, { supabase, admin: adminOnly });

    let result;
    
    switch (action) {
      case 'save-secret':
        result = await saveSecret(req.body);
        break;
      case 'check-connections':
        result = await checkConnections();
        break;
      case 'test-connections':
        result = await testConnections();
        break;
      default:
        return res.status(400).json({ error: `I do not recognize "${action}" yet. Pick one of the setup actions and I will run it.` });
    }
    
    return res.status(200).json({ success: true, ...result });
    
  } catch (err) {
    console.error(`[setup] ${action} error:`, err);
    if (err instanceof ApiAuthError) {
      return res.status(err.status || 401).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// SAVE SECRET - Store platform secrets in Supabase (and optionally Vercel)
// ═══════════════════════════════════════════════════════════════

async function saveSecret({ platform, key, value }) {
  if (!platform || !key || !value) {
    throw new Error('I need three things here: platform, key, and value.');
  }

  // Store in Supabase app_settings table (value must be jsonb)
  const { data, error } = await supabase
    .from('app_settings')
    .upsert({
      key: key,
      value: { secret: value, platform: platform, stored_at: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(`I could not save ${key} in Supabase yet: ${error.message}`);
  }

  // Try to update Vercel env var if VERCEL_TOKEN is available
  let vercelResult = null;
  if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID) {
    try {
      vercelResult = await updateVercelEnvVar(key, value);
    } catch (vercelErr) {
      console.warn('Could not update Vercel env var:', vercelErr.message);
      // Don't fail the whole operation if Vercel update fails
    }
  }

  return {
    message: `${key} is saved. Nice and clean.`,
    stored_in_supabase: true,
    stored_in_vercel: !!vercelResult
  };
}

async function updateVercelEnvVar(key, value) {
  const vercelToken = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!vercelToken || !projectId) {
    throw new Error('I need VERCEL_TOKEN and VERCEL_PROJECT_ID before I can update Vercel env vars.');
  }

  // Check if env var already exists
  const existingResponse = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env/${key}`,
    {
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (existingResponse.ok) {
    // Update existing env var
    const updateResponse = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/env/${key}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value })
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`I could not update that Vercel env var yet: ${error}`);
    }

    return await updateResponse.json();
  } else {
    // Create new env var
    const createResponse = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/env`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key,
          value,
          type: 'encrypted',
          target: ['production', 'preview', 'development']
        })
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`I could not create that Vercel env var yet: ${error}`);
    }

    return await createResponse.json();
  }
}

// ═══════════════════════════════════════════════════════════════
// CHECK CONNECTIONS - Check which platforms have stored tokens
// ═══════════════════════════════════════════════════════════════

async function checkConnections() {
  try {
    // Get OAuth connections from app_settings
    const { data: oauthData, error: oauthError } = await supabase
      .from('app_settings')
      .select('*')
      .like('key', 'oauth_%');

    if (oauthError) throw oauthError;

    // Get platform secrets
    const { data: secretsData, error: secretsError } = await supabase
      .from('app_settings')
      .select('*')
      .in('key', ['META_APP_SECRET', 'YOUTUBE_CLIENT_SECRET', 'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']);

    if (secretsError) throw secretsError;

    // Initialize connections
    const connections = {
      meta: { 
        connected: false, 
        status: 'Ready to connect',
        page_name: null,
        instagram_username: null
      },
      youtube: { 
        connected: false, 
        status: 'Ready to connect',
        channel_name: null
      },
      linkedin: { 
        connected: false, 
        status: 'Ready to connect',
        user_name: null
      }
    };

    // Check if secrets are configured
    const hasMetaSecret = secretsData?.some(s => s.key === 'META_APP_SECRET') || !!process.env.META_APP_SECRET;
    const hasYoutubeSecret = secretsData?.some(s => s.key === 'YOUTUBE_CLIENT_SECRET') || !!process.env.YOUTUBE_CLIENT_SECRET;
    const hasLinkedinCredentials = (
      secretsData?.some(s => s.key === 'LINKEDIN_CLIENT_ID') || !!process.env.LINKEDIN_CLIENT_ID
    ) && (
      secretsData?.some(s => s.key === 'LINKEDIN_CLIENT_SECRET') || !!process.env.LINKEDIN_CLIENT_SECRET
    );

    // Update status based on OAuth connections
    (oauthData || []).forEach(row => {
      const platform = row.key.replace('oauth_', '');
      const conn = row.value;

      if (platform === 'facebook' && hasMetaSecret) {
        connections.meta = {
          connected: true,
          status: 'Connected and ready',
          page_name: conn.page_name,
          instagram_username: conn.instagram_account?.username,
          connected_at: conn.connected_at
        };
      } else if (platform === 'youtube' && hasYoutubeSecret) {
        // YouTube uses refresh tokens that are permanent — show Connected if refresh_token exists
        const hasRefresh = !!conn.refresh_token;
        connections.youtube = {
          connected: hasRefresh,
          status: hasRefresh ? 'Connected and ready' : 'Reconnect needed',
          channel_name: conn.channel_name,
          expires_at: conn.expires_at,
          connected_at: conn.connected_at
        };
      } else if (platform === 'linkedin' && hasLinkedinCredentials) {
        const isExpired = conn.expires_at && new Date() > new Date(conn.expires_at);
        connections.linkedin = {
          connected: !isExpired,
          status: isExpired ? 'Reconnect needed' : 'Connected and ready',
          user_name: conn.user_name,
          expires_at: conn.expires_at,
          connected_at: conn.connected_at
        };
      }
    });

    // Update status for platforms with missing secrets
    if (!hasMetaSecret && !connections.meta.connected) {
      connections.meta.status = 'Needs app secret';
    }
    if (!hasYoutubeSecret && !connections.youtube.connected) {
      connections.youtube.status = 'Needs client secret';
    }
    if (!hasLinkedinCredentials && !connections.linkedin.connected) {
      connections.linkedin.status = 'Needs client ID + secret';
    }

    return { connections };

  } catch (err) {
    console.error('Error checking connections:', err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST CONNECTIONS - Actually ping each API to verify tokens work
// ═══════════════════════════════════════════════════════════════

async function testConnections() {
  const results = {
    meta: { success: false, message: 'I have not run this test yet, but I can as soon as you are ready.' },
    youtube: { success: false, message: 'I have not run this test yet, but I can as soon as you are ready.' },
    linkedin: { success: false, message: 'I have not run this test yet, but I can as soon as you are ready.' }
  };

  // Get stored tokens
  const { data: oauthData } = await supabase
    .from('app_settings')
    .select('*')
    .like('key', 'oauth_%');

  if (!oauthData) {
    throw new Error('I do not see any OAuth connections yet. Connect a platform first, then I can test it.');
  }

  // Test each platform
  for (const row of oauthData) {
    const platform = row.key.replace('oauth_', '');
    const conn = row.value;

    try {
      if (platform === 'facebook') {
        // Test Facebook API
        const response = await fetch(
          `https://graph.facebook.com/v19.0/me?access_token=${conn.access_token}`
        );
        const data = await response.json();

        if (data.error) {
          results.meta = { success: false, message: data.error.message };
        } else {
          results.meta = { success: true, message: `Connected as ${data.name}. Looks good.` };
        }

      } else if (platform === 'youtube') {
        // Test YouTube API
        const response = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
          {
            headers: { 'Authorization': `Bearer ${conn.access_token}` }
          }
        );
        const data = await response.json();

        if (data.error) {
          results.youtube = { success: false, message: data.error.message };
        } else if (data.items && data.items.length > 0) {
          results.youtube = { 
            success: true, 
            message: `Connected to ${data.items[0].snippet.title}. Ready to publish.` 
          };
        } else {
          results.youtube = { success: false, message: 'I could not find a YouTube channel on this account yet.' };
        }

      } else if (platform === 'linkedin') {
        // Test LinkedIn API
        const response = await fetch(
          'https://api.linkedin.com/v2/userinfo',
          {
            headers: { 
              'Authorization': `Bearer ${conn.access_token}`,
              'LinkedIn-Version': '202401'
            }
          }
        );
        const data = await response.json();

        if (data.error) {
          results.linkedin = { success: false, message: data.error.message };
        } else {
          results.linkedin = { 
            success: true, 
            message: `Connected as ${data.name}. Ready to post.` 
          };
        }
      }
    } catch (err) {
      results[platform === 'facebook' ? 'meta' : platform] = { 
        success: false, 
        message: err.message 
      };
    }
  }

  // Check if all tests passed
  const allPassed = Object.values(results).every(r => r.success);
  if (!allPassed) {
    const failedPlatforms = Object.entries(results)
      .filter(([, result]) => !result.success)
      .map(([platform]) => platform);
    
    throw new Error(`I tested everything. These still need attention: ${failedPlatforms.join(', ')}.`);
  }

  return { 
    message: 'Everything tested clean. You are ready to go.',
    results 
  };
}
