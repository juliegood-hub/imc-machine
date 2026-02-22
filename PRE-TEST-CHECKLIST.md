# IMC Machine — Pre-Test Run Checklist
**Goal:** Run a real live event through the full pipeline for Midtown Meetup and The Dakota

## 🔴 CRITICAL — Blocking Test Run

### 1. Fix `getToken()` in distribute.js
The token retrieval function is broken for all OAuth platforms:
- Looks for `facebook_token`, `linkedin_token` in Supabase but OAuth stores as `oauth_facebook`, `oauth_linkedin`, `oauth_youtube`
- Returns plain string but `postFacebook()`, `postLinkedIn()` expect `{ token, source, metadata }` object
- **Fix:** Rewrite `getToken()` to read from `oauth_*` keys and return structured object

### 2. Fix ArtistSetup.jsx build warning
- Line 495: stray `}` JSX syntax error (build warns every deploy, may cause runtime issues)
- Non-blocking for build but sloppy — fix it

### 3. YouTube token "expired" display
- Settings page shows "Token expired" but refresh token is permanent
- `refreshYouTubeToken()` exists but `getToken()` doesn't call it
- **Fix:** `getToken('youtube')` should check expiry → auto-refresh via refresh token

### 4. Facebook posting permissions
- App is in **Development mode** — only has `pages_show_list`, `pages_read_engagement`
- Posting requires `pages_manage_posts` (feed posts) and `pages_read_user_content`
- Facebook Events API: `pages_manage_events` is **deprecated** — events creation will fail
- **Fix:** Submit Meta App Review OR test posting with current token (dev mode allows posting by app admins)
- **Note:** In dev mode, posts by the app admin (Julie) ARE visible to the admin — good enough for testing

### 5. Instagram blocked
- Needs `instagram_content_publish` scope (requires Meta App Review)
- Needs IG Business account linked to GCM Facebook Page
- **Skip for test run** — add to post-launch list

## 🟡 IMPORTANT — Should Fix Before Test

### 6. IMC Composer → distribute.js wiring
- Verify IMCComposer actually calls `/api/distribute` with correct payload shape
- Check that `event`, `venue`, `content`, `images` objects match what distribute functions expect
- Field name mapping: composer may use camelCase, API may expect different keys

### 7. Event Create → Supabase save
- Verify events save to Supabase `events` table with all granular fields
- Verify event detail page loads saved event data
- Test: create event → see it on dashboard → open detail page

### 8. Image generation (DALL-E)
- Verify `/api/generate` image endpoint works with OpenAI key
- GCM visual style prompt (no AI people, real venue atmosphere)
- Test: generate one event image

### 9. Email distribution (Resend)
- Resend API key is set
- `from` address: `events@goodcreativemedia.com` — needs domain verified in Resend
- Test: send one email to Julie

### 10. Press release generation
- Verify `/api/generate` produces press release content
- Verify bilingual translation (Spanish) works via Gemini

### 11. Research engine
- Verify Gemini research (`conductResearch()`) returns venue/artist context
- This feeds into content generation quality

## 🟢 NICE TO HAVE — Can Wait

### 12. Eventbrite integration
- Token is set (`EVENTBRITE_TOKEN`)
- Verify event creation works
- Lower priority — can test after core flow works

### 13. Campaign Tracker → Supabase sync
- `sync-tracker.js` API exists
- Verify campaigns table populates after distribution

### 14. Media Gallery
- Verify generated images display and bulk download (JSZip) works

### 15. Run of Show page
- Verify timeline/scheduling works for a real event

### 16. Podcast Studio (NotebookLM workflow)
- Semi-manual flow — lower priority for test run

### 17. Press Page Preview
- Verify shareable HTML press kit generates

### 18. Connect Git → Vercel auto-deploy
- Currently manual `vercel --prod` each time
- Link GitHub repo for push-to-deploy

---

## 🎯 TEST RUN PLAN

### Test Event 1: Midtown Meetup
- Create event with real details (Mia's venue)
- Generate: press release, social posts (FB, LinkedIn), images
- Distribute: email to Julie, post to FB page, post to LinkedIn

### Test Event 2: The Dakota East Side Ice House
- Create event with real details (Kent & Julian's venue)
- Full pipeline: research → generate → review → distribute
- All channels that are connected

### Success Criteria
- [ ] Event created and saved in Supabase
- [ ] AI content generated (press release + social posts)
- [ ] Image generated with GCM style
- [ ] Email sent successfully
- [ ] Facebook post visible on Good Creative Media page
- [ ] LinkedIn post visible on Julie's profile
- [ ] Campaign tracked in tracker
