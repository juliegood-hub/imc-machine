# OAuth Setup Guide

This guide explains how to configure OAuth applications for Facebook/Instagram, YouTube, and LinkedIn integration.

## Required Environment Variables

Add these to your Vercel environment variables:

```bash
# Supabase (required for storing OAuth tokens)
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Meta (Facebook/Instagram)
META_APP_ID=your_facebook_app_id
META_APP_SECRET=your_facebook_app_secret

# YouTube (Google)
YOUTUBE_CLIENT_ID=your_google_client_id
YOUTUBE_CLIENT_SECRET=your_google_client_secret

# LinkedIn
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

## 1. Facebook/Instagram Setup

### Create Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app → Business → App Name: "IMC Machine"
3. Add "Facebook Login" product
4. In Facebook Login settings:
   - **Valid OAuth Redirect URIs**: `https://portal-sigma-two.vercel.app/api/oauth?action=fb-callback`
5. Get your **App ID** and **App Secret** from App Settings → Basic

### Required Scopes
- `pages_show_list` - List user's pages
- `pages_read_engagement` - Read page engagement
- `pages_manage_posts` - Create posts on page
- `pages_manage_events` - Create events on page
- `instagram_basic` - Access Instagram account
- `instagram_content_publish` - Publish to Instagram
- `instagram_manage_comments` - Manage Instagram comments

### Notes
- The OAuth flow will exchange for a **never-expiring page access token**
- User must be admin of a Facebook page
- Instagram must be connected to the Facebook page as a Business account

## 2. YouTube Setup

### Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "IMC Machine"
3. Enable **YouTube Data API v3**
4. Go to APIs & Services → Credentials
5. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Authorized redirect URIs: `https://portal-sigma-two.vercel.app/api/oauth?action=yt-callback`

### Required Scopes
- `https://www.googleapis.com/auth/youtube.upload` - Upload videos
- `https://www.googleapis.com/auth/youtube` - Manage YouTube account

### Notes
- The flow includes `access_type=offline&prompt=consent` to force refresh token
- Refresh token allows permanent access (doesn't expire)
- User must have a YouTube channel

## 3. LinkedIn Setup

### Create LinkedIn App
1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Create app → Company: "Good Creative Media"
3. Products → Request **Marketing Developer Platform** access
4. In Auth settings:
   - **Authorized redirect URLs**: `https://portal-sigma-two.vercel.app/api/oauth?action=li-callback`

### Required Scopes
- `openid` - OpenID Connect
- `profile` - User profile info  
- `email` - User email
- `w_member_social` - Share on behalf of user
- `w_organization_social` - Share on behalf of organization
- `rw_organization_admin` - Manage organization

### Notes
- Tokens expire in 365 days
- User needs admin access to LinkedIn organization/company page for posting

## 4. Database Setup

Run the SQL in `database_setup.sql` in your Supabase SQL editor to create the `app_settings` table.

## 5. Testing the Integration

1. Deploy your changes to Vercel
2. Go to `/settings` in your app
3. Click "Connect" for each service
4. Complete the OAuth flow
5. Verify "Connected" status appears

## Security Notes

- All OAuth flows include CSRF state parameters for security
- Tokens are stored securely in Supabase with encryption at rest
- Never-expiring tokens are preferred where possible (Facebook page tokens)
- Refresh tokens are used for YouTube to maintain access
- LinkedIn tokens are refreshed manually (365-day expiry)

## Troubleshooting

### Facebook Issues
- **"Invalid OAuth redirect URI"**: Ensure redirect URI exactly matches in Facebook app settings
- **"No pages found"**: User must be admin of a Facebook page
- **"No Instagram account"**: Connect Instagram Business account to Facebook page first

### YouTube Issues  
- **"No refresh token"**: User may have already granted access. Revoke access at myaccount.google.com first
- **API quota exceeded**: YouTube has strict quota limits for uploads

### LinkedIn Issues
- **"Marketing Platform access required"**: Request access in LinkedIn app console
- **"No organizations"**: User needs admin access to company pages

### General Issues
- **Build fails**: Run `npm run build` to check for syntax errors
- **"Environment variable not found"**: Verify all required env vars are set in Vercel
- **Database errors**: Ensure `app_settings` table exists in Supabase