# ChatGPT Agent Prompt: IMC Machine — Production Deploy

Copy everything below the line into a ChatGPT (Code Interpreter / Codex) session.

---

You are deploying the IMC Machine web app to production. The code is ready — your job is to rotate compromised API keys, configure Vercel, set up Supabase security, and deploy.

## Background

The IMC Machine is a React + Vite app at https://portal-sigma-two.vercel.app (Vercel project: julie-goods-projects/portal). ALL API keys were leaked via a public GitHub repo and client-side VITE_ exposure. OpenAI already disabled our key. Every key must be rotated and set as SERVER-SIDE Vercel environment variables (not VITE_ prefixed).

The code has already been migrated — all API calls now go through /api/ serverless routes that read from process.env on the server. The client-side code has zero secret keys.

## TASK 1: Make GitHub Repo Private

- Repo: https://github.com/juliegood-hub/TechArts-Theater-and-Venue
- Go to Settings → Danger Zone → Change Visibility → Make Private
- (If this is the wrong repo for IMC Machine, ask me which repo)

## TASK 2: Rotate ALL Compromised Keys

Generate NEW keys/tokens for each of these. The old ones are all compromised.

### OpenAI
- Go to: https://platform.openai.com/api-keys
- Organization: good-creative-media
- Create new secret key named "IMC Machine Server"
- Save as: `OPENAI_API_KEY`

### Google Gemini
- Go to: https://aistudio.google.com/app/apikey
- Project: techarts-theater (ID: techarts-theater)
- Create new API key
- Save as: `GEMINI_API_KEY`

### Resend (Email)
- Go to: https://resend.com/api-keys
- Revoke old key, create new one named "IMC Machine Server"
- Save as: `RESEND_API_KEY`

### Eventbrite
- Go to: https://www.eventbrite.com/platform/api-keys
- Create new private token
- Save as: `EVENTBRITE_TOKEN`
- Also need: `EVENTBRITE_ORG_ID` and `EVENTBRITE_VENUE_ID` (check existing Eventbrite account)

### Meta (Facebook + Instagram)
- Go to: https://developers.facebook.com/apps/1636424580849393/settings/basic/
- Reset App Secret → save as `META_APP_SECRET`
- App ID stays the same: `META_APP_ID=1636424580849393`
- Page ID stays the same: `FB_PAGE_ID=522058047815423`
- For Page Access Token: Go to Graph API Explorer → select the GCM page → generate User Token with pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish → Exchange for long-lived token → Exchange for never-expiring Page Token
- Save as: `FB_PAGE_ACCESS_TOKEN`

### YouTube
- Go to: https://console.cloud.google.com/apis/credentials?project=imc-machine-portal
- Delete old OAuth client, create new one
- Save: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
- Re-authorize and get new refresh token: `YOUTUBE_REFRESH_TOKEN`

### LinkedIn
- Go to: https://www.linkedin.com/developers/apps
- Create app if not exists, or rotate credentials
- Save: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`
- Org ID stays: `LINKEDIN_ORG_ID=2944916`

### Supabase Service Role Key
- Go to: https://supabase.com/dashboard/project/qavrufepvcihklypxbvm/settings/api
- The service role key may need to be rotated (check if Supabase allows this — if not, note it)
- Save as: `SUPABASE_SERVICE_ROLE_KEY`

## TASK 3: Set All Keys in Vercel

- Go to: https://vercel.com → julie-goods-projects/portal → Settings → Environment Variables
- Add each key as a **Production** environment variable (NOT prefixed with VITE_)
- These are the server-side vars the /api/ routes read:

```
OPENAI_API_KEY=<new key>
GEMINI_API_KEY=<new key>
RESEND_API_KEY=<new key>
META_APP_ID=1636424580849393
META_APP_SECRET=<new secret>
FB_PAGE_ID=522058047815423
FB_PAGE_ACCESS_TOKEN=<new never-expiring token>
EVENTBRITE_TOKEN=<new token>
EVENTBRITE_ORG_ID=<from account>
EVENTBRITE_VENUE_ID=<from account>
YOUTUBE_CLIENT_ID=<new>
YOUTUBE_CLIENT_SECRET=<new>
YOUTUBE_REFRESH_TOKEN=<new>
LINKEDIN_CLIENT_ID=<new>
LINKEDIN_CLIENT_SECRET=<new>
LINKEDIN_ACCESS_TOKEN=<new>
LINKEDIN_ORG_ID=2944916
SUPABASE_SERVICE_ROLE_KEY=<rotated or existing>
```

Also confirm these client-side vars are set (these are public/safe):
```
VITE_SUPABASE_URL=https://qavrufepvcihklypxbvm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_a9bpuU5nmyjaP2d8s-Bojg_2eh_CelY
VITE_ADMIN_EMAIL=juliegood@goodcreativemedia.com
```

## TASK 4: Run RLS Policies in Supabase

- Go to: https://supabase.com/dashboard/project/qavrufepvcihklypxbvm/sql
- Open a new query
- Paste and run the contents of `rls-policies.sql` from the project root
- This enables Row Level Security on all tables so users only see their own data and admins see everything

The SQL file should be in the repo. If you can't find it, here's what it needs to do:
- Enable RLS on: users, events, campaigns, profiles, generated_content, generated_images, activity_log, invites
- Policy: users can SELECT/INSERT/UPDATE/DELETE their own rows (matched by user_id or id)
- Admin policy: users where is_admin=true can do everything
- The invites table: anyone can SELECT (to validate codes), only admins can INSERT/DELETE

## TASK 5: Deploy

- In Vercel dashboard, trigger a new deployment (or push any commit to trigger auto-deploy)
- Verify the build succeeds
- Test: visit the live URL, try logging in, try signing up (you'll need an invite code — generate one from the admin panel first)

## TASK 6: Create Julie's Admin Account

After deploy, Julie needs to register through the new Supabase Auth system since old accounts didn't store real passwords.

1. First, create an invite code in Supabase: go to the invites table, insert a row with code "IMC-JULIE-ADMIN" (or similar), used=false
2. Then sign up at the live URL with: juliegood@goodcreativemedia.com + a strong password + that invite code
3. Verify the user row has is_admin=true

## IMPORTANT NOTES

- Account email: juliegood@goodcreativemedia.com (this is the admin email for everything)
- GCP project for YouTube/Gemini: imc-machine-portal
- GCP org: goodcreativemedia.com
- Never put secret keys in client-side code (no VITE_ prefix for secrets)
- The .env file in the repo should only contain VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_ADMIN_EMAIL
- Everything else lives exclusively in Vercel environment variables

When done, confirm: repo is private, all keys rotated, Vercel env vars set, RLS enabled, deployed, admin account created.
