# What The IMC Machine Actually Needs to Be Real

Written: 2026-02-18 11:33 PM CST
Author: The Good Robot, after an honest assessment

Julie said: "you know what else this app is going to take and you need to figure that out."

She's right. Here's everything.

---

## 1. AUTH THAT ACTUALLY WORKS

**Current state:** Supabase tables exist, but auth is email-only with no password hashing. Anyone can type any email and log in.

**What it needs:**
- [ ] Supabase Auth (built-in, free) for real email+password signup/login
- [ ] Password reset flow (Supabase handles this)
- [ ] Session tokens (JWT, not localStorage JSON blobs)
- [ ] Invite-only gating that actually enforces (right now it's optional)
- [ ] Admin can impersonate a user to see their view (support/debugging)

**Effort:** 2-3 hours

---

## 2. DATA PERSISTENCE (Supabase Integration Throughout)

**Current state:** Supabase is connected for users only. Events, venues, campaigns, and activity still use localStorage in most pages.

**What it needs:**
- [ ] VenueContext.jsx → read/write profiles + events from Supabase, not localStorage
- [ ] EventCreate.jsx → save wizard data to Supabase events table
- [ ] VenueSetup.jsx → save to Supabase profiles table
- [ ] ArtistSetup.jsx → save to Supabase profiles table
- [ ] CampaignTracker.jsx → read from Supabase campaigns table
- [ ] IMCComposer.jsx → save generated content + track distribution in Supabase
- [ ] MediaGallery.jsx → save image records to Supabase generated_images table
- [ ] CrewPortal.jsx → save crew assignments to events table (cast_crew jsonb)
- [ ] RunOfShow.jsx → needs a run_of_show table or jsonb field on events
- [ ] Settings.jsx → save user preferences to Supabase users.metadata

**Effort:** 6-8 hours (biggest single piece)

---

## 3. FACEBOOK + INSTAGRAM TOKENS

**Current state:** Token expired after 2 hours. Need the 3-step exchange.

**What it needs:**
- [ ] Generate short-lived token with IG scopes (instagram_basic, instagram_content_publish)
- [ ] Exchange for long-lived user token (60 days)
- [ ] Exchange for never-expiring page token
- [ ] Add FB_PAGE_ACCESS_TOKEN as Vercel env var (server-side, not VITE_)
- [ ] Add token refresh reminder (cron job or admin alert when approaching expiry)

**Effort:** 15 minutes with Julie

---

## 4. LINKEDIN

**Current state:** Service built, no app created.

**What it needs:**
- [ ] Create LinkedIn app at linkedin.com/developers
- [ ] Request "Share on LinkedIn" product
- [ ] OAuth flow to get access token
- [ ] Add LINKEDIN_ACCESS_TOKEN + LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET as Vercel env vars
- [ ] Token refresh (LinkedIn tokens last 60 days, need refresh flow)

**Effort:** 30 minutes with Julie

---

## 5. IMAGE HOSTING

**Current state:** AI-generated images are base64 data URLs in browser memory. They vanish on refresh. Instagram requires publicly accessible HTTPS URLs.

**What it needs:**
- [ ] Supabase Storage bucket for generated images (free 1GB)
- [ ] Or: Google Drive upload + public sharing link
- [ ] Image upload flow: generate → upload to storage → get public URL → use for distribution
- [ ] Gallery page reads from storage, not localStorage

**Effort:** 2-3 hours

---

## 6. CONTENT GENERATION → SAVE → EDIT → DISTRIBUTE FLOW

**Current state:** Content generates in browser, shows in UI, but doesn't persist. If you refresh, it's gone. Distribution buttons sometimes work, sometimes don't.

**What it needs:**
- [ ] Generate → auto-save to Supabase generated_content table
- [ ] Edit inline → save edits
- [ ] Approve/reject per channel before distributing
- [ ] "Distribute" button calls /api/distribute with saved content
- [ ] Distribution results saved to campaigns table
- [ ] Status shown in real-time (sending... sent ✅ / failed ❌)
- [ ] Retry button for failed channels

**Effort:** 4-5 hours

---

## 7. DO210 DIRECT FORM SUBMISSION (not email)

**Current state:** Sends an email to events@do210.com. Julie specifically said she wants direct form submission.

**What it needs:**
- [ ] Puppeteer script (submit-events-v2.js) needs to run server-side
- [ ] Option A: Vercel doesn't support Puppeteer well → use a separate service (Railway, Render, or a simple Express server)
- [ ] Option B: Keep email submission as fallback, note it in UI honestly
- [ ] Do210 login credentials stored server-side

**Effort:** 3-4 hours for proper server setup

---

## 8. NOTIFICATIONS + FEEDBACK

**Current state:** Uses browser alert() for everything. No email confirmations, no in-app notification center.

**What it needs:**
- [ ] Toast notifications (react-hot-toast or similar) instead of alert()
- [ ] In-app notification center (bell icon → list of recent distribution results)
- [ ] Email confirmation to the user when distribution completes
- [ ] Admin gets email when a new user signs up or a distribution fails

**Effort:** 2-3 hours

---

## 9. MOBILE RESPONSIVENESS

**Current state:** Desktop-first. Sidebar doesn't show on mobile (hidden lg:flex). Top nav has limited mobile support.

**What it needs:**
- [ ] Hamburger menu for mobile sidebar
- [ ] All forms usable on phone
- [ ] Touch-friendly buttons
- [ ] Test on iPhone 16 Pro (Julie's device)

**Effort:** 2-3 hours

---

## 10. ONBOARDING EXPERIENCE

**Current state:** You sign up, land on dashboard, see "Welcome, juliegood!" and empty cards. No guidance.

**What it needs:**
- [ ] First-login onboarding wizard: "Set up your venue/artist profile" → "Create your first event" → "Run the IMC Composer"
- [ ] Progress indicator (Julie loves these)
- [ ] Empty states with helpful CTAs everywhere
- [ ] Sample/demo event that shows what a completed campaign looks like

**Effort:** 3-4 hours

---

## 11. SECURITY HARDENING (Before Real Clients)

**Current state:** API keys in VITE_ env vars (visible in browser source). No rate limiting. No CSRF. Supabase RLS disabled.

**What it needs:**
- [ ] Remove ALL remaining VITE_ API keys from client code (move to server-side)
- [ ] OpenAI + Gemini calls → server-side API routes
- [ ] Enable Supabase RLS policies (users see only their data)
- [ ] Rate limiting on /api/ endpoints
- [ ] CORS restricted to portal domain only
- [ ] Admin auth check on admin-only API calls

**Effort:** 3-4 hours

---

## 12. DOMAIN + BRANDING

**Current state:** Lives at portal-sigma-two.vercel.app. No custom domain.

**What it needs:**
- [ ] app.goodcreativemedia.com CNAME → Vercel
- [ ] Or: imc.goodcreativemedia.com
- [ ] SSL auto-handled by Vercel
- [ ] Open Graph meta tags (when someone shares a link)
- [ ] Favicon + app icon

**Effort:** 30 minutes

---

## 13. ERROR HANDLING + LOGGING

**Current state:** Errors go to console.log or browser alerts. No server-side logging. No way to debug what happened when a distribution fails.

**What it needs:**
- [ ] Server-side error logging (Vercel has built-in logs, but structured logging helps)
- [ ] Failed distributions logged with full error details in Supabase
- [ ] Admin can see error logs in dashboard
- [ ] Graceful error messages in UI (not raw API errors)

**Effort:** 2 hours

---

## 14. PODCAST PIPELINE

**Current state:** Service built (Gemini script + Google Cloud TTS + YouTube upload). Not wired into Composer flow.

**What it needs:**
- [ ] TTS API calls → server-side (Google Cloud TTS key needs to be server-side)
- [ ] Audio file storage (Supabase Storage or Google Drive)
- [ ] YouTube upload → server-side (OAuth refresh token handling)
- [ ] "Generate Podcast" button in Composer that actually produces audio
- [ ] Preview/play in browser before publishing

**Effort:** 3-4 hours

---

## PRIORITY ORDER

If I were building this for launch, I'd do it in this order:

1. **Data persistence** (#2) — nothing else matters if data disappears on refresh
2. **Content flow** (#6) — generate → save → edit → distribute must be seamless
3. **Image hosting** (#5) — images need to persist and have public URLs
4. **Facebook + Instagram tokens** (#3) — biggest distribution channels
5. **Auth hardening** (#1) — before real clients touch it
6. **Notifications** (#8) — replace alert() with real feedback
7. **Security** (#11) — before going public
8. **LinkedIn** (#4) — nice to have, not critical for SA music scene
9. **Onboarding** (#10) — polish for first clients
10. **Mobile** (#9) — clients will use this on phones
11. **Domain** (#12) — professional URL
12. **Error handling** (#13) — debugging
13. **Do210 direct** (#7) — email works, direct is better
14. **Podcast** (#14) — cool feature, not day-one critical

---

## TOTAL ESTIMATE

Roughly 35-45 hours of development to go from "demo" to "real product clients can use."

That's not counting:
- Ongoing maintenance
- Bug fixes from real user testing
- Feature requests from clients
- Patent filing coordination
- Marketing/sales for client acquisition

This is a real product. It works in pieces. The architecture is solid. But the gap between "the pieces exist" and "a client can log in, create an event, and have it show up on Eventbrite, Facebook, Instagram, Do210, and in 16 journalists' inboxes" still needs the wiring above.

---

*"The distance between a demo and a product is where most projects die. This one won't."*
