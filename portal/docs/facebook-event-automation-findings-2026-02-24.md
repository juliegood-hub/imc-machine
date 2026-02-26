# Facebook Event Automation Findings (2026-02-24)

## Findings (highest risk first)
1. **Direct Graph event creation on the connected Page is currently blocked in practice.**
   - Live probe (`v25.0`, 5/5 attempts) returned `GraphMethodException` code `100`, subcode `33`, unsupported post request on `/{page-id}/events`.
   - Evidence: `/portal/docs/facebook-event-experiment-results-2026-02-24T23-42-45-331Z.json`
2. **Fallback Page feed posting is reliable on the same credentials.**
   - Live probe (`v25.0`, 5/5 attempts) succeeded on `/{page-id}/feed`.
   - Probe posts were created unpublished and cleaned up (`posts_deleted: 5`).
3. **Meta documentation confirms limited events API access.**
   - Meta Pages API docs state the Events API can no longer be accessed via API for public apps.
   - Source: [Meta Pages API](https://developers.facebook.com/docs/pages-api/)
4. **Operator workflow still needs a canonical FB Event URL even when API creation is blocked.**
   - Manual/agent event creation is still needed in some cases, but URL/ID must be persisted in IMC campaigns to avoid downstream degradation.
5. **Automation via third-party no-code tools is post-centric, not event-create-centric.**
   - Zapier Facebook Pages integration focuses on feed actions; no first-class “create Facebook Event” action in the listed triggers/actions.
   - Make Facebook Pages modules similarly center on Page posts/media flows.
   - Sources:
     - [Zapier Facebook Pages integrations](https://zapier.com/apps/facebook-pages/integrations)
     - [Make Facebook Pages integrations](https://www.make.com/en/integrations/facebook-pages)

## Options Matrix
Scoring: 1 (worst) to 5 (best)

| Option | Reliability | Speed (p95) | Eng. complexity | Maintenance | ToS/Compliance risk | Cost | Scalability | Canonical Event URL/ID |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Graph API Page Event create (`/{page-id}/events`) | 1 | 5 | 3 | 4 | 5 | 5 | 5 | 5 |
| Graph API fallback Page feed post (`/{page-id}/feed`) | 5 | 3 | 2 | 4 | 5 | 5 | 5 | 1 |
| Browser automation (agent/puppeteer) | 2 | 1 | 4 | 1 | 2 | 3 | 2 | 5 |
| Hybrid (API event attempt + API feed fallback + manual URL capture) | 4 | 3 | 3 | 3 | 4 | 5 | 4 | 5 |
| Partner tools only (Zapier/Make) | 3 | 4 | 2 | 4 | 4 | 2 | 4 | 1 |

## Experiment Results (Top 2 Approaches)

| Approach | Attempts | Success | Success Rate | Median | p95 | Dominant failure mode |
|---|---:|---:|---:|---:|---:|---|
| Graph API `/{page-id}/events` | 5 | 0 | 0% | 184 ms | 454 ms | `code=100`, `subcode=33`, unsupported post request |
| Graph API `/{page-id}/feed` (fallback post) | 5 | 5 | 100% | 3432 ms | 5589 ms | none observed |

Raw output:
- `/portal/docs/facebook-event-experiment-results-2026-02-24T23-42-45-331Z.json`

## Final Recommendation
Use a **hybrid architecture**:
1. Primary: attempt event creation via Graph API.
2. Fallback: if blocked/unsupported/permissions failure, publish a Page feed post.
3. Manual bridge: if event must be created manually, operator pastes FB Event URL in IMC wizard and IMC persists it.

This gives a production-safe path with graceful degradation while preserving event-first downstream quality.

## Implemented Architecture (MVP)
- Primary path:
  - `post-facebook` now attempts `/{page-id}/events` first.
- Fallback path:
  - Automatic fallback to `/{page-id}/feed` with structured failure reasons.
- Idempotency:
  - Fingerprint over title/date/time/venue/page.
  - Reuses existing `campaigns(channel='facebook_event')` URL/ID when found.
- Retry/backoff:
  - Graph retries for transient failures (429/5xx and key transient codes).
- Observability:
  - Structured result payload with:
    - `event_create_attempted`, `event_created`, `event_id`, `event_url`
    - `fallback_post_created`, `post_id`
    - `errors[]`, `fallback.reason`, diagnostics/timings
- Persistence:
  - Backend upserts `campaigns(channel='facebook_event')`.
  - Frontend also tracks `facebook_event` + `social_facebook`.
  - Manual URL save path added in Facebook wizard.

## Compliance/Policy Notes
- Meta Terms restrict abusive/unauthorized automation patterns; browser automation has materially higher policy and maintenance risk than official API use.
  - Source: [Meta Terms](https://www.facebook.com/legal/terms)
- Manual Page event creation guidance remains part of Facebook help center flows.
  - Source: [Facebook Business Help: Create an event for your Page](https://www.facebook.com/business/help/1684546228460454)
