# Production Ops Data Model (Broadway-Grade MVP)

## Scope
The Production Ops module now combines:
- `events.production_details.productionOps` (structured production planning payload per event)
- `production_checklists` and `production_checklist_items` (department execution tracking)
- existing Run of Show records (`/run-of-show`) for cue timeline execution

## Event-Level Structured Payload
Stored at:
- `events.production_details.productionOps`

Shape:

```json
{
  "primarySubsection": "overview|stage_plot|lighting_lx|audio_sound|comms|run_of_show|department_checklists|technical_riders",
  "stagePlot": {
    "layout": { "width": 24, "depth": 16, "items": [] },
    "prosceniumWidthFeet": "",
    "playingSpaceWidthFeet": "",
    "playingSpaceDepthFeet": "",
    "trimHeightFeet": "",
    "gridHeightFeet": "",
    "deckSurfaceType": "",
    "wingSpaceDepthFeet": "",
    "houseCapacity": "",
    "stagePlotUrl": "",
    "stageNotes": ""
  },
  "lighting": {
    "lightingPlotUrl": "",
    "instrumentSchedule": "",
    "channelHookup": "",
    "dimmerSchedule": "",
    "patchSheet": "",
    "dmxUniverseMap": "",
    "cueListReference": "",
    "notes": ""
  },
  "audio": {
    "audioPlotUrl": "",
    "inputList": "",
    "channelList": "",
    "monitorMixes": "",
    "fohConsole": "",
    "wirelessAssignments": "",
    "rfNotes": "",
    "notes": ""
  },
  "comms": {
    "clearComChannels": "",
    "headsetAssignments": "",
    "walkieChannels": "",
    "callboardChannel": "",
    "smDeskChannel": "",
    "fohChannel": "",
    "emergencyChannel": "",
    "notes": ""
  },
  "runOfShow": {
    "cuePrefixHint": "",
    "goCallFormat": "",
    "triggerNotes": "",
    "standbyNotes": "",
    "notes": ""
  },
  "technicalRiders": {
    "riderUrl": "",
    "attachmentsNotes": "",
    "loadInNotes": "",
    "strikeNotes": ""
  }
}
```

## Checklist Tables
Checklist headers:
- `production_checklists`
  - `id`
  - `event_id`
  - `title`
  - `phase`
  - `status`
  - `metadata`

Checklist items:
- `production_checklist_items`
  - `id`
  - `checklist_id`
  - `sort_order`
  - `category`
  - `label`
  - `required`
  - `status` (`todo|in_progress|done|blocked`)
  - `provider_scope` (`house|tour|promoter|other`)
  - `assignee_name`
  - `assignee_role`
  - `due_at`
  - `checked_at`
  - `notes`
  - `metadata`

## AI Autofill Integration
- The Production Ops section maps to AI extraction schemas in `api/generate.js`:
  - `stage_plot`
  - `lighting_plot`
  - `audio_plot`
  - `comms_chart`
  - `cue_sheet`
  - `department_checklist`
  - `technical_rider`
- Intake answers and pasted docs are parsed through `action: "form-assist"` and applied to form state only (no silent DB write).

## Notes
- Stage plot visual layout is maintained in `stagePlot.layout` and rendered by `StagePlotEditor`.
- Run-of-show cue execution remains in `/run-of-show`; Production Ops stores planning hints and cue call conventions.
