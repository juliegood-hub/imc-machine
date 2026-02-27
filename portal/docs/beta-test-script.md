# IMC Machine Beta Test Script (5 Pilot Users)

Last updated: 2026-02-27
Production URL: https://imc.goodcreativemedia.com
Release baseline: v2026.02.27-beta.1

## Goal
Run one consistent, repeatable beta test with 5 real users and capture pass/fail outcomes by workflow.

## Pilot Order
1. Mia Cortez (Midtown MeetUp) - recurring venue events
2. Julian Gomez (Dakota Eastside Ice House) - venue + recurring gigs
3. Jana Laven (promoter + multiple acts) - multi-act booking flow
4. Rob (Overtime Theater) - theater production flow
5. Jerry (On and Off Fred Road) - large arts org event flow

## Pre-Session Checklist (2 minutes)
1. Open https://imc.goodcreativemedia.com on mobile and desktop.
2. Confirm user has invite code.
3. Confirm user can sign up and reach dashboard.
4. Confirm header appears exactly as:
   - IMC
   - GOOD CREATIVE MEDIA
   - THE IMC MACHINE
   - YOUR LIVE EVENT INTEGRATED MARKETING COMMUNICATIONS MEDIA MANAGEMENT MONSTER

## Core Script (Run for every pilot)
1. Sign up and select correct user type.
2. Complete profile setup (venue or artist/promoter path).
3. Go to Create Event.
4. Open AI Intake (`/events/create?ai=intake&input=email`).
5. Test all 3 intake actions:
   - Speak
   - Paste Email
   - Upload File (image/PDF/doc/txt)
6. Confirm extracted data fills form fields and can be edited.
7. Save event.
8. Open IMC Composer and generate content.
9. Run distribution for at least one channel and review results.
10. Open Production Ops and verify sections load (staffing, event ops, inventory, training).
11. Open Run of Show and verify source/clean view behavior.
12. Export one stakeholder-facing output (where available).

## Persona-Specific Checks
### Mia + Julian (venue-heavy)
1. Verify recurring event setup works (weekly/monthly options).
2. Verify venue reuse works without retyping venue profile data.
3. Verify menu/merch/event-level ops are visible from Production Ops.

### Jana (promoter + multi-act)
1. Add or select multiple acts under one promoter context.
2. Reuse same venue across multiple events.
3. Verify event-level copy can be regenerated with correction prompts.

### Rob (theater)
1. Verify theater roles and production scheduling views load.
2. Verify run-of-show edits and department cues can be adjusted.
3. Verify production modules are usable from one navigation path.

### Jerry (large arts org)
1. Verify official assets only flow (no AI replacement when locked).
2. Verify high-volume event data still saves and loads cleanly.
3. Verify distribution result summaries are readable for stakeholder handoff.

## Pass/Fail Criteria
Mark PASS only if all are true:
1. User can onboard without developer intervention.
2. User can create event with AI assist.
3. User can save and reopen event with data intact.
4. User can generate IMC copy.
5. At least one distribution action returns a clear result (success or graceful error).
6. Production Ops and Run of Show pages load without schema/cache errors.

## Bug Capture Template
For each issue, log:
1. User
2. Device/OS/Browser
3. Page URL
4. Action taken
5. Expected result
6. Actual result
7. Severity (P0/P1/P2/P3)
8. Screenshot/video

## Session Exit Questions (ask each pilot)
1. What was easiest?
2. What was confusing?
3. Where did you expect a button that was missing?
4. Would you trust this for your next real event?
5. What one change would make this indispensable?

