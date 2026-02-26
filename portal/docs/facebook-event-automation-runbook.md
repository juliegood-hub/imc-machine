# Facebook Event Automation Runbook (IMC)

## Scope
- Primary channel action: `post-facebook` in `/portal/api/distribute.js`
- Goal: create a Facebook Page Event first, then gracefully fall back to a Page feed post when Meta blocks event creation.
- Canonical tracking target: `campaigns` row with `channel='facebook_event'`, `external_id` (event id), and `external_url` (event URL).

## Preconditions
- `oauth_facebook` exists in `app_settings` with:
  - `access_token`
  - `page_id`
- Required env vars for API runtime:
  - `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - Optional: `FB_GRAPH_VERSION` (default: `v25.0`)

## Runtime Behavior
1. Build an idempotency fingerprint from title/date/time/venue/page id.
2. Check existing `campaigns` record (`channel='facebook_event'`) for this event id.
  - If present with URL/ID, reuse it (prevents duplicate FB events).
3. Attempt `POST /{page-id}/events`.
4. If event creation fails, execute fallback `POST /{page-id}/feed`.
5. Persist result metadata in `campaigns` (`facebook_event`) with mode/fallback/error details.
6. Frontend tracks:
  - `facebook_event` campaign (event URL/ID)
  - `social_facebook` campaign (feed post URL/ID)

## Retry/Backoff
- Graph calls use retry for transient failures:
  - HTTP: `429`, `5xx`
  - Graph error codes: `1`, `2`, `4`, `17`, `341`
- Backoff: exponential, base 700ms, max 2 retries.

## Manual Recovery Path
- If event creation is blocked, use `FacebookEventWizard` in IMC Composer.
- After manual publish, paste the Facebook Event URL into the wizard’s **Save URL** field.
- This writes `facebook_event` campaign data so downstream distribution has a canonical URL.

## Operator Checks
1. In IMC Composer social results:
  - Confirm **Facebook Event: Created** with URL, or fallback reason if blocked.
  - Confirm **Facebook Feed: Posted**.
2. In Campaign Tracker:
  - `facebook_event` row should contain `external_url`.
3. If missing:
  - Re-run social distribution, or manually paste and save URL in wizard.

## Experiment Harness
- Script: `/portal/scripts/facebook-event-experiments.mjs`
- Runs two measured approaches:
  - `/{page-id}/events` (event create)
  - `/{page-id}/feed` (fallback post, unpublished probe)
- Saves JSON report in `/portal/docs/facebook-event-experiment-results-*.json`

### Commands
```bash
cd /Users/littlemacbook/.openclaw/workspace/imc-machine/portal
npm run experiment:facebook -- --runs 5 --graph-version v25.0
```

## Known Limits
- Meta capabilities for Page event creation can be account/app gated; fallback feed posting remains the safety path.
- Full repo lint currently fails on unrelated pre-existing issues; verify changed flow with `npm run build` and targeted tests.
