# Safety + Risk Data Model

This module is event-scoped and connected to `Events`, `Production Ops`, and `Plots + Layouts`.

## Core Tables

- `event_safety_profiles`
  - One row per event.
  - Stores risk inputs (attendance, alcohol, ticketed, weather, generator, fire factors, staffing ratio inputs) and computed outputs (`risk_score`, `risk_level`, recommendations).

- `event_permits`
  - Many rows per event.
  - Tracks permit type, status, issuing authority, permit number, expiry, owner, and file URL.

- `event_insurance_policies`
  - Many rows per event.
  - Tracks policy type, carrier, limits, deductible, expiry, additional insured notes, and COI link.

- `event_surveillance_assets`
  - Many rows per event.
  - Tracks CCTV/surveillance placement and operations metadata (camera ID, zone, retention, monitoring assignment).

- `event_access_control_points`
  - Many rows per event.
  - Tracks checkpoints and screening points (type, location, clearance, assignment, hours).

- `event_crowd_plans`
  - One row per event.
  - Barricade, queue, ADA, assembly points, and staffing ratio notes.

- `event_medical_plans`
  - One row per event.
  - First aid, EMT, AED, hydration, cooling, Narcan, and ambulance planning notes.

- `event_sanitation_plans`
  - One row per event.
  - Restroom/sanitation/waste planning and food-permit verification flags.

- `event_weather_plans`
  - One row per event.
  - Heat/rain/wind/lightning thresholds and evacuation shelter details.

- `event_city_coordination`
  - One row per event.
  - Police, fire, EMS, city contacts, command center, and communication notes.

- `event_incidents`
  - Many rows per event.
  - Incident log with type, location, timestamp, status, follow-up, and attachment links.

- `event_emergency_action_plans`
  - Many rows per event.
  - Versioned generated EAP records with risk classification and generated document content.

- `event_safety_checklists`
  - Many rows per event.
  - Checklist headers (phase/title).

- `event_safety_checklist_items`
  - Many rows per checklist.
  - Checklist tasks with status, assignee, due-at, required flag, and notes.

## API Actions (via `portal/api/distribute.js`)

All Safety + Risk reads/writes are handled through existing `/api/distribute` actions, including:

- `get-event-safety-profile`, `upsert-event-safety-profile`
- `get-event-permits`, `upsert-event-permit`, `delete-event-permit`
- `get-event-insurance-policies`, `upsert-event-insurance-policy`, `delete-event-insurance-policy`
- `get-event-surveillance-assets`, `upsert-event-surveillance-asset`, `delete-event-surveillance-asset`
- `get-event-access-control-points`, `upsert-event-access-control-point`, `delete-event-access-control-point`
- `get-event-crowd-plan`, `upsert-event-crowd-plan`
- `get-event-medical-plan`, `upsert-event-medical-plan`
- `get-event-sanitation-plan`, `upsert-event-sanitation-plan`
- `get-event-weather-plan`, `upsert-event-weather-plan`
- `get-event-city-coordination`, `upsert-event-city-coordination`
- `get-event-incidents`, `upsert-event-incident`, `delete-event-incident`
- `get-event-safety-checklists`, `upsert-event-safety-checklist`, `upsert-event-safety-checklist-item`, `delete-event-safety-checklist-item`
- `generate-event-eap`, `get-event-eap-docs`
- `get-event-safety-dashboard`

## Risk Scoring Notes

Risk scoring runs in backend and mirrored frontend helpers:

- Backend: `portal/api/distribute.js` (`calculateEventRiskProfileScore`)
- Frontend helper: `portal/src/services/safetyRisk.js` (`calculateSafetyRiskProfile`)

Scoring currently factors:

- Indoor/outdoor context
- Attendance
- Alcohol
- Ticketed/free
- Security staffing ratio input
- Weather exposure
- Generator use
- Fire risk factors
- Local crime risk (optional)
- VIP attendance

Outputs:

- Numeric `risk_score`
- Label `risk_level` (`Low`, `Moderate`, `Elevated`, `High`)
- Recommendation list for staffing/compliance escalation
