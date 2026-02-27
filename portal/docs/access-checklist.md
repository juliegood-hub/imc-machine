# Access Checklist (Fastest Path)

This is the one-page setup list for external platform access and keys.

Set server-side env vars in Vercel:

- [Vercel Environment Variables (portal project)](https://vercel.com/julie-goods-projects/portal/settings/environment-variables)

Do not put secrets in client-side `VITE_` variables.

---

## 1) Google Cloud (do this first)

### Access links

- [Google Cloud Console](https://console.cloud.google.com/)
- [Maps/Places setup](https://developers.google.com/maps/documentation/javascript/get-api-key)
- [YouTube API credentials setup](https://developers.google.com/youtube/registering_an_application)
- [Google API keys management](https://docs.cloud.google.com/docs/authentication/api-keys)

### Env vars (wired now)

- `GOOGLE_MAPS_API_KEY`
- `GOOGLE_PLACES_API_KEY` (preferred if you split keys by service)
- `GOOGLE_SERVICE_ACCOUNT_KEY` (for Drive automation)
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

### Where used

- Places/venue autocomplete + supplier lookup: `api/distribute.js`
- Drive integration: `api/drive.js`
- YouTube publish + OAuth: `api/youtube.js`, `api/oauth.js`, `api/distribute.js`

---

## 2) Zoom

### Access links

- [Zoom App Marketplace](https://marketplace.zoom.us/)
- [How admins/users add marketplace apps](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0062865)

### Env vars (wired now)

- `ZOOM_WEBHOOK_SECRET`

### Notes

- Current app flow supports create/link meeting + asset ingestion.
- OAuth app credentials are not required by the current code path yet.

---

## 3) Ticketmaster

### Access links

- [Ticketmaster Developer Getting Started](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/)
- [Ticketmaster Partner API](https://developer.ticketmaster.com/products-and-docs/apis/partner/)

### Env vars (wired now)

- None currently required for Ticketmaster.

### Notes

- Current IMC implementation supports manual linking/stubbed provider mode for Ticketmaster.
- Connection/account data is stored per venue/provider in DB (`venue_ticketing_connections`) instead of env vars.

---

## 4) Stripe

### Access links

- [Stripe Dashboard](https://dashboard.stripe.com/)
- [Stripe API keys](https://docs.stripe.com/keys)
- [Stripe Connect onboarding](https://docs.stripe.com/connect/onboarding)

### Env vars (wired now)

- None currently required (Stripe connector not wired in backend yet).

### Recommended reserve env vars (future wiring)

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_CONNECT_CLIENT_ID`

---

## 5) CRM (HubSpot/Salesforce)

### Access links

- [HubSpot private apps](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/build-with-projects/create-private-apps-with-projects)
- [HubSpot OAuth](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/working-with-oauth)
- [Salesforce Connected App](https://developer.salesforce.com/docs/service/messaging-api/guide/create-connected-app.html)

### Env vars (wired now)

- None currently required (CRM connector not wired in backend yet).

### Recommended reserve env vars (future wiring)

- `HUBSPOT_PRIVATE_APP_TOKEN`
- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`
- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`
- `SALESFORCE_LOGIN_URL`

---

## Core IMC distribution vars (already in active use)

If not already configured, these are critical for current live distribution:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `FB_PAGE_ID`
- `EVENTBRITE_TOKEN`
- `EVENTBRITE_ORG_ID`
- `EVENTBRITE_VENUE_ID`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_ORG_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`
- `IMC_WEBHOOK_SECRET`
- `STAFFING_WEBHOOK_SECRET`
- `TIME_CLOCK_QR_SECRET`

---

## 15-minute setup order

1. Set Google vars (`GOOGLE_MAPS_API_KEY` or `GOOGLE_PLACES_API_KEY`, YouTube vars, Drive key).
2. Set `ZOOM_WEBHOOK_SECRET`.
3. Confirm Ticketmaster venue connection records in app (no env var required yet).
4. Reserve Stripe env vars now (no runtime dependency yet).
5. Reserve CRM env vars now (no runtime dependency yet).

Quick validation command:

```bash
cd portal
npm run env:audit
```

If you want report-only mode (no nonzero exit code):

```bash
cd portal
node scripts/env-audit.mjs --file .env.production.local --soft
```

When this list is complete, run a quick health check in app:

1. Open `Settings` and verify connected status.
2. Open `Production Ops` -> `Ticketing` and validate provider options load.
3. Open an event -> `IMC Composer` and run a dry distribution.
