# ChatGPT Agent Prompt: IMC Machine Platform Connections Setup

## Role
You are a setup agent for the IMC Machine web app. Your job is to configure three developer platform accounts (Meta/Facebook, Google/YouTube, LinkedIn) so the app can distribute content to those platforms automatically.

## Context
- **App URL**: https://portal-sigma-two.vercel.app
- **Vercel Project**: julie-goods-projects/portal
- **GCP Project**: imc-machine-portal (ID: techarts-theater, #407658919128)
- **GCP Org**: goodcreativemedia.com
- **Admin Email**: juliegood@goodcreativemedia.com
- **Facebook Page**: Good Creative Media (Page ID: 522058047815423)
- **Meta App ID**: (already set in Vercel as META_APP_ID)
- **YouTube Client ID**: (already set in Vercel as YOUTUBE_CLIENT_ID)
- **LinkedIn Org ID**: 2944916

## Task 1: Meta (Facebook + Instagram)

### 1A: Get App Secret
1. Go to https://developers.facebook.com/apps/
2. Click the IMC Machine app (or whichever app has the matching META_APP_ID)
3. Go to **Settings → Basic**
4. Copy the **App Secret**
5. Store it — we'll need it for Vercel env var `META_APP_SECRET`

### 1B: Configure Facebook Login
1. In the same Meta app, go to **Use Cases** or **Products → Facebook Login → Settings**
2. Add this **Valid OAuth Redirect URI**:
   ```
   https://portal-sigma-two.vercel.app/api/oauth?action=fb-callback
   ```
3. Save changes

### 1C: Configure Permissions
Make sure the app has these permissions (under App Review or Permissions):
- `pages_show_list`
- `pages_read_engagement`  
- `pages_manage_posts`
- `pages_manage_events`
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_comments`

Note: If the app is in Development mode, these work for app admins/testers without review. Add juliegood@goodcreativemedia.com as an admin/tester if not already.

### 1D: Link Instagram Business Account
1. Go to https://business.facebook.com/
2. Navigate to Settings → Accounts → Instagram Accounts
3. Ensure the Good Creative Media Instagram account is linked to the Facebook Page
4. The Instagram account must be a **Business** or **Creator** account (not Personal)

## Task 2: YouTube (Google Cloud)

### 2A: Get OAuth Client Secret
1. Go to https://console.cloud.google.com/apis/credentials?project=imc-machine-portal
2. Find the OAuth 2.0 Client ID for iOS (or create a Web Application type if only iOS exists)
3. If creating new: 
   - Type: **Web application**
   - Name: "IMC Machine Web"
   - Authorized redirect URIs: `https://portal-sigma-two.vercel.app/api/oauth?action=yt-callback`
4. Copy the **Client Secret**
5. Store it — we'll need it for Vercel env var `YOUTUBE_CLIENT_SECRET`

### 2B: Add Redirect URI
1. In the same OAuth client, under **Authorized redirect URIs**, add:
   ```
   https://portal-sigma-two.vercel.app/api/oauth?action=yt-callback
   ```
2. Save

### 2C: Verify YouTube Data API is Enabled
1. Go to https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=imc-machine-portal
2. Should say "Enabled" — if not, enable it

### 2D: OAuth Consent Screen
1. Go to https://console.cloud.google.com/apis/credentials/consent?project=imc-machine-portal
2. Make sure it's set to **External**
3. Add juliegood@goodcreativemedia.com as a **test user** if the app is in "Testing" mode
4. Scopes needed: `youtube.upload`, `youtube` (or full YouTube scope)

## Task 3: LinkedIn

### 3A: Create or Configure App
1. Go to https://www.linkedin.com/developers/apps/
2. Create a new app or use existing:
   - App name: "IMC Machine"
   - LinkedIn Page: Good Creative Media
   - App logo: any square image
3. On the **Auth** tab:
   - Copy **Client ID** → Vercel env var `LINKEDIN_CLIENT_ID`
   - Copy **Client Secret** → Vercel env var `LINKEDIN_CLIENT_SECRET`
4. Add **Authorized redirect URL**:
   ```
   https://portal-sigma-two.vercel.app/api/oauth?action=li-callback
   ```

### 3B: Request Products
On the **Products** tab, request access to:
- **Share on LinkedIn** (for posting)
- **Sign In with LinkedIn using OpenID Connect**
- **Community Management API** (for longer-lived tokens, 365 days)

### 3C: Verify Page Admin
The LinkedIn account used must be an admin of the Good Creative Media LinkedIn Company Page (org ID: 2944916).

## Task 4: Set Vercel Environment Variables

Using the Vercel CLI or dashboard, set these env vars for Production:

```bash
# Meta
vercel env add META_APP_SECRET production
# paste the value

# YouTube  
vercel env add YOUTUBE_CLIENT_SECRET production
# paste the value

# LinkedIn
vercel env add LINKEDIN_CLIENT_ID production
vercel env add LINKEDIN_CLIENT_SECRET production
# paste values
```

Or via Vercel Dashboard: https://vercel.com/julie-goods-projects/portal/settings/environment-variables

## Task 5: Test OAuth Flows

After all env vars are set and redirect URIs configured:

1. Go to https://portal-sigma-two.vercel.app/settings (log in as Julie)
2. Click **Connect Facebook** → authorize → should redirect back with success
3. Click **Connect YouTube** → authorize → should redirect back with success  
4. Click **Connect LinkedIn** → authorize → should redirect back with success

## Output

When complete, provide:
1. ✅/❌ status for each platform
2. Any permissions that need App Review (Facebook) 
3. The exact env var values that were set
4. Any issues encountered

## Important Notes
- Facebook tokens: We use the never-expiring page token flow (short → long-lived → page token)
- YouTube tokens: We get a refresh token (permanent) by using `access_type=offline&prompt=consent`
- LinkedIn tokens: 365-day lifespan with Community Management API, annual renewal needed
- NEVER put secrets in client-side code (no VITE_ prefix)
- The app stores tokens in Supabase `app_settings` table as fallback to env vars
