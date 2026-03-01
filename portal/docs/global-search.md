# Global Search: Architecture Notes

## Summary
Global Search is implemented as a tiered, permission-safe search service:

1. Tier 1: Feature/page registry (navigation-first)
2. Tier 2: User content (events, venues, plots, calendar, docs, permits/insurance, checklists, cues)
3. Tier 3: People directory (staff + participant profiles)

## Frontend surfaces

- Desktop top nav: inline search bar with typeahead
- Mobile header: compact search trigger + dropdown with explicit `Search` button
- Keyboard shortcut: `Cmd/Ctrl + K` focuses/open search
- Full results page: `/search`
- Submit UX:
  - Enter key submits search to `/search`
  - Inline spyglass button (`🔍`) submits search
  - Empty-state message appears when no matches are found

Core files:

- `portal/src/components/GlobalSearchBar.jsx`
- `portal/src/pages/SearchResults.jsx`
- `portal/src/services/globalSearch.js`
- `portal/src/constants/globalSearchFeatures.js`

## Backend endpoint

- `portal/api/search.js`

Auth:

- Uses `requireApiAuth` and user scoping from authenticated user row.
- All data queries are filtered by `user_id`.
- `401/403` auth failures return a neutral empty payload (no raw Unauthorized text surfaced to UI).
- Missing-table scenarios are tolerated per table and skipped (no hard fail for absent optional modules).

## Searchable entities

Tier 1 (registry):

- `FEATURE_SEARCH_REGISTRY` static feature map with paths, keywords, descriptions, and quick actions.

Tier 2 (content):

- `events`
- `venue_profiles`
- `stage_plot_documents`
- `rehearsal_calendar_entries`
- `production_checklists`
- `booking_documents`
- `event_permits`
- `event_insurance_policies`
- Event cue access via `events.run_of_show` entry-point links

Tier 3 (people):

- `staff_profiles`
- `participant_profiles`
- Event-scoped boosts from:
  - `staff_assignments`
  - `event_participants`

## Ranking logic

- Query tokenization (space-delimited, normalized lower-case).
- Per-result score based on token presence + position boosts.
- Feature tier receives additional static priority weights from registry.
- Sort modes:
  - `relevance` (default score)
  - `recent` (`updatedAt` descending)
  - `alphabetical` (`title` ascending)

## Scope and filters

Supported scopes:

- `all`
- `org`
- `venue`
- `event`

Supported categories:

- `features`
- `events`
- `venues`
- `plots`
- `cues`
- `calendar`
- `documents`
- `permits_insurance`
- `checklists`
- `people`

Extra toggle:

- `withinCurrentEvent` narrows search to event context when event id is available.
- Org/venue scoped searches first resolve accessible event IDs for the authenticated user, then apply those IDs to event-linked entities (plots, checklists, documents, permits, insurance, cues, calendar rows).

## Indexing strategy

Current:

- Live query-time indexing using key text fields (`ilike`) with per-entity limits.
- Feature registry is static and in-memory.

Planned scale-up path:

1. Add denormalized `search_documents` table with triggers per entity.
2. Add weighted TSVECTOR columns for full-text ranking.
3. Use incremental upserts from mutation endpoints.
4. Cache feature tier and frequent query+scope tuples.

## Permission enforcement

- Endpoint requires authenticated API access token.
- All content and people queries include `user_id = authenticated_user_id`.
- Event-scoped people lookup only includes linked assignments/participants owned by that user.
- No cross-tenant leakage in result IDs, titles, or context strings.
- Feature-tier rows are filtered by feature access metadata (`access: authenticated | admin`) before returning results.

## Error handling

- Client-side search service normalizes API failures to:
  - `We couldn’t load those results. Please try again.`
- UI never renders raw `Unauthorized`/`Forbidden` text in red result areas.

## Index refresh process

Global search is query-time (no persistent index build job). To reflect new records immediately:

1. Save or update entity data in its source table.
2. Re-run a search query (typeahead or `/search` page).
3. If schema changed, deploy updated API + frontend together so query mappings match new columns.
