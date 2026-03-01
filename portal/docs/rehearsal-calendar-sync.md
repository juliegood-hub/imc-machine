# Rehearsal & Production Calendar: Developer Notes

## Scope
This module adds an org-aware production calendar that stores rehearsals, production calls, and dated operations records, then syncs them to Google Calendar.

## Data model
The feature uses these tables:

- `calendar_event_types`
  - Industry templates and custom type definitions.
  - Stores defaults like duration, typical roles, and department tags.
- `rehearsal_calendar_entries`
  - Main calendar records (title, type, start/end, timezone, status, attendance mode).
  - Links to `event_id` and `org_id`.
  - Stores source metadata (`source_kind`, `source_ref_id`) for auto-synced records.
- `calendar_entry_assignments`
  - Assignment rows for entry-level call invites.
  - Stores assignee identity, role/type, attendance required, RSVP state.
- `calendar_entry_notifications`
  - Notification log rows for assignment reminders/invites.
- `google_calendar_connections`
  - OAuth connection and sync settings per user/org.
  - Stores token metadata, default calendar, and auto-sync type list.
- `google_calendar_event_mappings`
  - Mapping table between IMC entry IDs and Google event IDs.
  - Includes sync hash and last sync metadata.

## API actions
All actions are handled in `portal/api/distribute.js`:

- Type CRUD
  - `get-calendar-event-types`
  - `upsert-calendar-event-type`
  - `delete-calendar-event-type`
- Entry CRUD
  - `get-rehearsal-calendar-entries`
  - `upsert-rehearsal-calendar-entry`
  - `delete-rehearsal-calendar-entry`
- Assignment CRUD
  - `upsert-calendar-entry-assignment`
  - `delete-calendar-entry-assignment`
- Google integration
  - `get-google-calendar-connection`
  - `get-google-calendar-auth-url`
  - `connect-google-calendar`
  - `list-google-calendars`
  - `create-google-calendar`
  - `sync-calendar-entry`
  - `sync-all-dated-items`

## Sync mapping
Each synced entry creates/updates a row in `google_calendar_event_mappings`:

- `calendar_entry_id` -> IMC source record
- `google_calendar_id` -> destination calendar
- `google_event_id` -> Google event ID
- `sync_hash` -> hash of sync-relevant IMC fields
- `last_synced_at`, `last_sync_direction`

## Source-of-truth and conflict handling
Current behavior is IMC-first:

- Create/update/cancel in IMC propagates to Google.
- Mapping row captures the latest IMC->Google sync state.
- Two-way merge UI is not enabled yet.
- If Google calls fail, IMC save still succeeds and warning is returned.

## OAuth/token storage
Google token handling:

- OAuth state is stored in `app_settings` (`oauth_google_calendar_state_<userId>`).
- Tokens/settings are stored in `google_calendar_connections`.
- Access token refresh is done server-side when near expiry.
- A connection can now be updated for settings-only changes (default calendar, sync enabled, auto-sync types) without requiring a new OAuth code, as long as a stored token exists.

## “Anything with a date must sync” flow
`sync-all-dated-items` currently upserts calendar entries for:

- `events` (performances)
- `training_sessions`
- `staff_assignments`

Then it optionally syncs these entries to Google with per-entry warning capture.

## Frontend module
`portal/src/pages/ProductionCalendar.jsx` includes:

- month/week/day/agenda filtering
- type/status/event/org/department filters
- entry editor (industry types, role tags, reminders)
- assignment panel and notification trigger
- Google OAuth connect flow and org calendar controls
- manual entry sync + global sync-all action

## Runtime requirements
Environment variables expected for Google OAuth:

- `GOOGLE_CALENDAR_CLIENT_ID` (or `GOOGLE_CLIENT_ID`)
- `GOOGLE_CALENDAR_CLIENT_SECRET` (or `GOOGLE_CLIENT_SECRET`)
- Optional redirect override:
  - `GOOGLE_CALENDAR_REDIRECT_URI` or `OAUTH_GOOGLE_REDIRECT_URI`

Supabase SQL migrations from `portal/supabase-schema.sql` (or `portal/schema-full-audit.sql`) must be applied before enabling production sync.
