# Art Show / Gallery Plot Coverage Audit

This audit verifies gallery and art-market objects in the shared PLOTS & LAYOUTS library.

## Artifact Types
- `painting_framed` ✅
- `painting_unframed` ✅
- `photograph_framed` ✅
- `prints_wall` ✅
- `prints_bin` ✅
- `ceramics_small` ✅
- `ceramics_medium` ✅
- `ceramics_large` ✅
- `sculpture_floor` ✅
- `mixed_media_piece` ✅
- `textile_fiber_piece` ✅
- `jewelry_display_case` ✅
- `zines_books_table` ✅
- `digital_video_piece` ✅

## Display Methods
- `wall_hung_display` ✅
- `easel_display` ✅
- `table_display` ✅
- `shelf_display` ✅
- `pedestal` / `plinth_display` ✅
- `display_case` ✅
- `gridwall_panel` ✅
- `hanging_rail` ✅

## Installation + Ops Objects
- `price_sign_stand` ✅
- `qr_code_sign` ✅
- `checkout_station` / `pos_station` ✅
- `packaging_station` ✅
- `storage_bins_under_table` ✅
- `lighting_clip_spots` ✅
- `display_lighting_power_drop` ✅
- `queue_stanchions` ✅

## Labeling + Ownership + Export
- All plot objects support:
  - system type
  - default label
  - custom label
  - visibility mode (system/custom/both)
- Ownership assignment fields:
  - `assignedPerson`
  - `role`
  - `department`
- PDF export now includes per-item owner/role when provided.

## Collaboration + Sharing
- Plot sharing model supports:
  - Event members
  - Organization members
  - Venue members
  - Individuals
  - Department/role groups
- Permission levels:
  - Owner, Editor, Commenter, Viewer
- Plot state:
  - Draft / Published
- Audit stamps:
  - Updated by + time
  - Published by + time
