// ═══════════════════════════════════════════════════════════════
// IMC Machine: OAuth Connection Flows
// Vercel Serverless Function
//
// Handles OAuth flows for Facebook/Instagram, YouTube, and LinkedIn
// GET /api/oauth?action=fb-auth-url (etc)
// GET /api/oauth?action=fb-callback&code=... (etc)
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET/POST only' });
  }

  const { action } = req.query;
  if (!action) return res.status(400).json({ error: 'Missing action parameter' });

  try {
    let result;
    
    switch (action) {
      // Facebook/Instagram OAuth
      case 'fb-auth-url':
        result = await getFacebookAuthUrl();
        break;
      case 'fb-callback':
        result = await handleFacebookCallback(req.query);
        break;
        
      // YouTube OAuth  
      case 'yt-auth-url':
        result = await getYouTubeAuthUrl();
        break;
      case 'yt-callback':
        result = await handleYouTubeCallback(req.query);
        break;
        
      // LinkedIn OAuth
      case 'li-auth-url':
        result = await getLinkedInAuthUrl();
        break;
      case 'li-callback':
        result = await handleLinkedInCallback(req.query);
        break;
        
      // Connection status check
      case 'check-connections':
        result = await checkAllConnections();
        break;
        
      // Disconnect a service
      case 'disconnect':
        result = await disconnectService(req.query.platform);
        break;
        
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
    
    // Handle redirects for callback actions
    if (action.includes('-callback') && result.redirect) {
      return res.redirect(302, result.redirect);
    }
    
    return res.status(200).json({ success: true, ...result });
    
  } catch (err) {
    console.error(`[oauth] ${action} error:`, err);
    
    // Handle callback errors with redirect
    if (action.includes('-callback')) {
      const platform = action.replace('-callback', '').replace('fb', 'facebook').replace('yt', 'youtube').replace('li', 'linkedin');
      return res.redirect(302, `https://imc.goodcreativemedia.com/settings?connected=${platform}&status=error&message=${encodeURIComponent(err.message)}`);
    }
    
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// FACEBOOK/INSTAGRAM OAUTH FLOW
// ═══════════════════════════════════════════════════════════════

async function getFacebookAuthUrl() {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error('META_APP_ID not configured');
  
  const redirectUri = 'https://imc.goodcreativemedia.com/api/oauth?action=fb-callback';
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish'
  ].join(',');
  
  // Generate CSRF state parameter
  const state = crypto.randomBytes(32).toString('hex');
  await storeOAuthState('facebook', state);
  
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
    `client_id=${appId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${state}&` +
    `response_type=code`;
    
  return { authUrl };
}

async function handleFacebookCallback({ code, state, error, error_description }) {
  if (error) {
    throw new Error(`Facebook OAuth error: ${error_description || error}`);
  }
  
  if (!code) throw new Error('No authorization code received from Facebook');
  
  // Verify state parameter
  await verifyOAuthState('facebook', state);
  
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Meta app credentials not configured');
  
  const redirectUri = 'https://imc.goodcreativemedia.com/api/oauth?action=fb-callback';
  
  try {
    // Step 1: Exchange code for short-lived user access token
    const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${appId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `client_secret=${appSecret}&` +
      `code=${code}`
    );
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(`Token exchange failed: ${tokenData.error.message}`);
    }
    
    const shortLivedToken = tokenData.access_token;
    
    // Step 2: Exchange short-lived token for long-lived user token (60 days)
    const longLivedResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${appId}&` +
      `client_secret=${appSecret}&` +
      `fb_exchange_token=${shortLivedToken}`
    );
    const longLivedData = await longLivedResponse.json();
    
    if (longLivedData.error) {
      throw new Error(`Long-lived token exchange failed: ${longLivedData.error.message}`);
    }
    
    const longLivedUserToken = longLivedData.access_token;
    
    // Step 3: Get user's pages to find the page and get never-expiring page access token
    const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?` +
      `access_token=${longLivedUserToken}&` +
      `fields=name,access_token,instagram_business_account`
    );
    const pagesData = await pagesResponse.json();
    
    if (pagesData.error) {
      throw new Error(`Failed to get pages: ${pagesData.error.message}`);
    }
    
    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook pages found. You need to be an admin of a Facebook page to connect.');
    }
    
    // Use the first page (in a real app, you might let user choose)
    const page = pagesData.data[0];
    const pageAccessToken = page.access_token; // This is the never-expiring page token!
    
    // Get Instagram account details if connected
    let instagramAccount = null;
    if (page.instagram_business_account) {
      const igResponse = await fetch(`https://graph.facebook.com/v19.0/${page.instagram_business_account.id}?` +
        `fields=id,username&access_token=${pageAccessToken}`
      );
      const igData = await igResponse.json();
      if (!igData.error) {
        instagramAccount = {
          id: igData.id,
          username: igData.username
        };
      }
    }
    
    // Store tokens in Supabase
    const connectionData = {
      platform: 'facebook',
      access_token: pageAccessToken,
      expires_at: null, // Page tokens don't expire
      page_id: page.id,
      page_name: page.name,
      instagram_account: instagramAccount,
      connected_at: new Date().toISOString(),
      token_type: 'facebook_page'
    };
    
    await storeConnection(connectionData);
    
    // Also store as instagram connection so getToken('instagram') works
    if (instagramAccount) {
      await storeConnection({
        ...connectionData,
        platform: 'instagram',
        token_type: 'instagram_via_facebook'
      });
    }
    
    return {
      redirect: `https://imc.goodcreativemedia.com/settings?connected=facebook&status=success`
    };
    
  } catch (err) {
    console.error('Facebook OAuth callback error:', err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════  
// YOUTUBE OAUTH FLOW
// ═══════════════════════════════════════════════════════════════

async function getYouTubeAuthUrl() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) throw new Error('YOUTUBE_CLIENT_ID not configured');
  
  const redirectUri = 'https://imc.goodcreativemedia.com/api/oauth?action=yt-callback';
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
  ].join(' ');
  
  // Generate CSRF state parameter
  const state = crypto.randomBytes(32).toString('hex');
  await storeOAuthState('youtube', state);
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `access_type=offline&` +
    `prompt=consent&` +
    `state=${state}&` +
    `response_type=code`;
    
  return { authUrl };
}

async function handleYouTubeCallback({ code, state, error }) {
  if (error) {
    throw new Error(`YouTube OAuth error: ${error}`);
  }
  
  if (!code) throw new Error('No authorization code received from YouTube');
  
  // Verify state parameter
  await verifyOAuthState('youtube', state);
  
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('YouTube credentials not configured');
  
  const redirectUri = 'https://imc.goodcreativemedia.com/api/oauth?action=yt-callback';
  
  try {
    // Exchange code for access token + refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }
    
    const { access_token, refresh_token, expires_in } = tokenData;
    
    if (!refresh_token) {
      throw new Error('No refresh token received. User may have already granted access. Try revoking access first.');
    }
    
    // Get channel information
    const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const channelData = await channelResponse.json();
    
    if (channelData.error) {
      throw new Error(`Failed to get channel info: ${channelData.error.message}`);
    }
    
    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('No YouTube channel found for this account');
    }
    
    const channel = channelData.items[0];
    
    // Store tokens in Supabase
    const connectionData = {
      platform: 'youtube',
      access_token: access_token,
      refresh_token: refresh_token,
      expires_at: new Date(Date.now() + (expires_in * 1000)).toISOString(),
      channel_id: channel.id,
      channel_name: channel.snippet.title,
      connected_at: new Date().toISOString(),
      token_type: 'youtube_refresh'
    };
    
    await storeConnection(connectionData);
    
    return {
      redirect: `https://imc.goodcreativemedia.com/settings?connected=youtube&status=success`
    };
    
  } catch (err) {
    console.error('YouTube OAuth callback error:', err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// LINKEDIN OAUTH FLOW  
// ═══════════════════════════════════════════════════════════════

async function getLinkedInAuthUrl() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID not configured');
  
  const redirectUri = 'https://imc.goodcreativemedia.com/api/oauth?action=li-callback';
  const scopes = [
    'openid',
    'profile', 
    'email',
    'w_member_social',
    'w_organization_social',
    'r_organization_social',
    'rw_organization_admin'
  ].join(' ');
  
  // Generate CSRF state parameter
  const state = crypto.randomBytes(32).toString('hex');
  await storeOAuthState('linkedin', state);
  
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${state}&` +
    `response_type=code`;
    
  return { authUrl };
}

async function handleLinkedInCallback({ code, state, error, error_description }) {
  if (error) {
    throw new Error(`LinkedIn OAuth error: ${error_description || error}`);
  }
  
  if (!code) throw new Error('No authorization code received from LinkedIn');
  
  // Verify state parameter
  await verifyOAuthState('linkedin', state);
  
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('LinkedIn credentials not configured');
  
  const redirectUri = 'https://imc.goodcreativemedia.com/api/oauth?action=li-callback';
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    });
    
    const tokenText = await tokenResponse.text();
    console.log('LinkedIn token response:', tokenResponse.status, tokenText.slice(0, 500));
    
    let tokenData;
    try { tokenData = JSON.parse(tokenText); } catch { throw new Error(`LinkedIn non-JSON response: ${tokenText.slice(0, 200)}`); }
    
    if (tokenData.error) {
      throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error} (HTTP ${tokenResponse.status})`);
    }
    
    const { access_token, expires_in } = tokenData;
    
    // Get user profile info
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 
        'Authorization': `Bearer ${access_token}`,
        'LinkedIn-Version': '202401'
      }
    });
    const profileData = await profileResponse.json();
    
    if (profileData.error) {
      throw new Error(`Failed to get profile: ${profileData.error.message}`);
    }
    
    // Get organizations user can post to (may fail without rw_organization_admin scope)
    let organizations = [];
    try {
      const orgsResponse = await fetch('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName)))', {
        headers: { 
          'Authorization': `Bearer ${access_token}`,
          'LinkedIn-Version': '202401'
        }
      });
      const orgsData = await orgsResponse.json();
      if (orgsData.elements && orgsData.elements.length > 0) {
        organizations = orgsData.elements.map(elem => ({
          id: elem.organizationalTarget?.id,
          name: elem.organizationalTarget?.localizedName
        })).filter(org => org.id && org.name);
      }
    } catch (orgErr) {
      console.log('Could not fetch LinkedIn orgs (scope may not be granted):', orgErr.message);
    }
    
    // Store tokens in Supabase 
    const connectionData = {
      platform: 'linkedin',
      access_token: access_token,
      expires_at: new Date(Date.now() + (expires_in * 1000)).toISOString(), // LinkedIn tokens expire in 365 days
      user_id: profileData.sub,
      user_name: profileData.name,
      user_email: profileData.email,
      organizations: organizations,
      connected_at: new Date().toISOString(),
      token_type: 'linkedin'
    };
    
    await storeConnection(connectionData);
    
    return {
      redirect: `https://imc.goodcreativemedia.com/settings?connected=linkedin&status=success`
    };
    
  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// CONNECTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════

async function storeConnection(connectionData) {
  // Store in app_settings table (create if doesn't exist)
  const { data, error } = await supabase
    .from('app_settings')
    .upsert({
      key: `oauth_${connectionData.platform}`,
      value: connectionData
    }, { onConflict: 'key' });
    
  if (error) {
    console.error('Error storing connection:', error);
    throw new Error(`Failed to store ${connectionData.platform} connection`);
  }
  
  return data;
}

async function checkAllConnections() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .like('key', 'oauth_%');
      
    if (error) throw error;
    
    const connections = {};
    
    // Initialize all platforms as disconnected
    ['facebook', 'instagram', 'youtube', 'linkedin'].forEach(platform => {
      connections[platform] = {
        connected: false,
        status: 'Not connected'
      };
    });
    
    // Update with actual connection data
    (data || []).forEach(row => {
      const platform = row.key.replace('oauth_', '');
      const conn = row.value;
      
      if (platform === 'facebook') {
        connections.facebook = {
          connected: true,
          status: 'Connected',
          page_name: conn.page_name,
          connected_at: conn.connected_at
        };
        
        if (conn.instagram_account) {
          connections.instagram = {
            connected: true,
            status: 'Connected',
            username: conn.instagram_account.username,
            connected_at: conn.connected_at
          };
        }
      } else if (platform === 'youtube') {
        // YouTube uses refresh tokens that are permanent — show Connected if refresh_token exists
        const hasRefresh = !!conn.refresh_token;
        connections.youtube = {
          connected: hasRefresh,
          status: hasRefresh ? 'Connected' : 'Token expired',
          channel_name: conn.channel_name,
          expires_at: conn.expires_at,
          connected_at: conn.connected_at
        };
      } else if (platform === 'linkedin') {
        const isExpired = conn.expires_at && new Date() > new Date(conn.expires_at);
        const daysLeft = conn.expires_at ? Math.ceil((new Date(conn.expires_at) - new Date()) / (1000 * 60 * 60 * 24)) : null;
        
        connections.linkedin = {
          connected: !isExpired,
          status: isExpired ? 'Token expired' : daysLeft > 30 ? 'Connected' : `Expires in ${daysLeft} days`,
          user_name: conn.user_name,
          organizations: conn.organizations,
          expires_at: conn.expires_at,
          connected_at: conn.connected_at
        };
      }
    });
    
    return { connections };
    
  } catch (err) {
    console.error('Error checking connections:', err);
    throw err;
  }
}

async function disconnectService(platform) {
  if (!platform) throw new Error('Platform parameter required');
  
  const { error } = await supabase
    .from('app_settings')
    .delete()
    .eq('key', `oauth_${platform}`);
    
  if (error) throw error;
  
  // If disconnecting Facebook, also disconnect Instagram
  if (platform === 'facebook') {
    await supabase
      .from('app_settings')
      .delete()
      .eq('key', 'oauth_instagram');
  }
  
  return { message: `${platform} disconnected successfully` };
}

// ═══════════════════════════════════════════════════════════════
// OAUTH STATE MANAGEMENT (CSRF Protection)
// ═══════════════════════════════════════════════════════════════

async function storeOAuthState(platform, state) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key: `oauth_state_${platform}`,
      value: { state, created_at: new Date().toISOString() }
    }, { onConflict: 'key' });
    
  if (error) throw error;
}

async function verifyOAuthState(platform, state) {
  if (!state) throw new Error('Missing state parameter');
  
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', `oauth_state_${platform}`)
    .single();
    
  if (error || !data) {
    throw new Error('Invalid OAuth state');
  }
  
  const storedState = data.value.state;
  const createdAt = new Date(data.value.created_at);
  const now = new Date();
  
  // State should match and be less than 10 minutes old
  if (storedState !== state || (now - createdAt) > 10 * 60 * 1000) {
    throw new Error('Invalid or expired OAuth state');
  }
  
  // Clean up used state
  await supabase
    .from('app_settings')
    .delete()
    .eq('key', `oauth_state_${platform}`);
}