# PLOTS & LAYOUTS Electrical Calculation Logic

This module models power in three layers:

1. Electrical source objects
- Examples: `20A Outlet`, `Power Distro Box`, `Company Switch`, `Generator`.
- Stored with `isElectricalSource: true`.
- Capacity is read from `sourceAmperage` (amps).

2. Powered load objects
- Any object with `powerRequired: true` and `isElectricalSource: false`.
- Examples: amps, wedges, moving lights, projector, POS station.
- Optional input fields:
  - `wattage`
  - `voltage` (`120V`, `208V`, `240V`, `3-Phase`)
  - `amperage` (manual override)
  - `assignedCircuitId` (links load to source object id)

3. Circuit summary rows
- Built by grouping powered loads by `assignedCircuitId`.
- For each source:
  - `capacity = sourceAmperage`
  - `assignedLoad = sum(loadAmps)`
  - `remaining = capacity - assignedLoad`
  - `overloaded = assignedLoad > capacity` (only when capacity > 0)

## Load Amp Calculation

For each powered load object:

1. If `amperage` is present and > 0, use it.
2. Else if `wattage` is present and voltage can be parsed, use:

`amps = watts / volts`

3. Else default to `0`.

Voltage parsing extracts numeric value from strings such as:
- `120V` -> `120`
- `208V` -> `208`
- `240V` -> `240`
- `3-Phase` -> falls back to `120` unless user provides `amperage`.

## Safety / Egress Metadata

Door objects store:
- `doorWidthFeet`
- `swingDirection`
- `isDoubleDoor`
- `isRollUpDoor`
- `isEmergencyExit`
- `isADA`
- `entryType` (`public`, `crew`, `boh`, `emergency`)

Layout-level egress toggles:
- `egress.showPaths`
- `egress.showFireLanes`
- `egress.highlightEmergencyExits`
- `egress.showCrowdFlowArrows`
- `egress.notes`

## Export Behavior

Stage plot exports include:
- Structural layout metadata (grid, heights, occupancy, fixed features)
- Label output according to `layout.exportOptions`
- Power section:
  - total capacity
  - assigned load
  - remaining headroom
  - unassigned powered loads
  - overloaded circuit count
  - per-circuit load rows
- Safety/Egress section:
  - door count
  - emergency exit count
  - ADA door count
  - egress overlay toggle states
  - egress notes
