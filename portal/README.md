# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Stage Plot + Multi-Zone Production Planning

The app now supports production-grade planning for bands, theater, speakers, orchestra/choir, DJs, and hybrid shows.

## Backend Voice Standard

Backend response copy now follows the Julie Good conversational style for user-visible messages.

- Guide: `portal/docs/backend-julie-good-voice.md`
- Rule: keep API payload shape stable and rewrite only message tone unless behavior changes are intentional.

## Strict Release Workflow

Staging + production release controls are documented in:

- `portal/docs/release-workflow.md`
- `portal/docs/access-checklist.md` (external platform access + env key checklist)

Environment validation:

- `npm run env:audit` (checks required production keys against env and `.env.production.local`)

This includes required checks, branch protection settings, Vercel secrets, and production tagging rules.

### New data model

Run migrations from:

- `portal/supabase-schema.sql`
- `portal/schema-full-audit.sql`

New/updated objects:

- `performance_zones` (venue sub-stages / rooms)
- `show_configurations` (reusable tech rider + stage plot templates)
- `stage_plot_documents` (PDF packets + share tokens)
- `events` extended with zone-aware booking fields and show contacts

### New UI routes and tabs

- `Venue Setup` now includes `Performance Zones` tab
- `Artist Setup` now includes `Stage Plot & Tech` tab
- `Create Event` now includes:
  - zone-aware booking fields
  - show configuration attach/create
  - show contacts
  - zone conflict warnings
- `Production Calendar` route: `/production-calendar`

### PDF export (server-side)

`POST /api/distribute` with action `export-stage-plot-pdf` exports a production packet PDF containing:

- stage plot summary
- input list / patch list
- monitor plan
- backline / power / lighting notes
- show contacts

The API can persist PDF packets to `stage_plot_documents` and attach them to events.

### Manual QA checklist

1. Open `Venue Setup` → `Performance Zones`, create at least 2 zones.
2. Open `Artist Setup` → `Stage Plot & Tech`, create a show config from template, edit layout, export PDF.
3. Open `Create Event`, choose venue + zone + booking times + show config + contacts.
4. Create a second event in the same zone/time and verify conflict warning blocks submit.
5. Create a second event in a different zone at the same time and verify submit succeeds.
6. Open `/production-calendar`, verify venue/zone filters and zone labels on bookings.
