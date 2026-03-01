# Help Center Content Maintenance

Last updated: March 1, 2026

## Where Content Lives
- User guide and white paper source content: `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/constants/helpCenterContent.js`
- User Guide page renderer: `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/pages/UserGuide.jsx`
- White Papers page renderer: `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/pages/WhitePapers.jsx`
- How It Works integration: `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/pages/WorkflowGuide.jsx`
- Nav and help link surfaces:
  - `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/components/Navbar.jsx`
  - `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/components/Sidebar.jsx`
  - `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/App.jsx`
- Buddy integration:
  - `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/components/BuddyDrawer.jsx`
  - `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/pages/ChatHub.jsx`
  - `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/api/generate.js`

## Version Tracking Standard
- User Guide: update `USER_GUIDE.version` and `USER_GUIDE.updatedAt` in `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/src/constants/helpCenterContent.js`.
- White Papers: update each `paper.version`, `paper.updatedAt`, and append a `versionHistory` entry.
- Release notes convention:
  - `v1.0` = initial publication
  - `v1.1` = copy-level edits, no section restructure
  - `v2.0` = major structure or architecture update

## Anchor and TOC Rules
- Every section must have a stable `id`.
- If an anchor changes, update:
  - Buddy quick-topic links (`BUDDY_HELP_TOPICS`)
  - Chat API allowed link references in `/Users/littlemacbook/.openclaw/workspace/imc-machine/portal/api/generate.js`
  - Any cross-links in `WorkflowGuide.jsx`

## Export Behavior
- Both `/user-guide` and `/white-papers` support:
  - `Print / PDF` via `window.print()`
  - Markdown download for versioned archival

## QA Checklist (content changes)
1. Open `/workflow`, `/user-guide`, `/white-papers`, `/buddy`.
2. Confirm TOC links scroll to correct anchors.
3. Confirm cross-links open expected sections.
4. Confirm Buddy responses can include and open inline markdown links.
5. Run `npm run build` and `npm test`.
