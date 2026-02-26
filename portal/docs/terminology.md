# IMC Terminology Map

## Role Definitions
- `Booking Agent`: The person responsible for event booking and talent booking. This includes booking calendar ownership, venue/talent alignment, and event planning handoff.
- `Staff Scheduler`: The person responsible for staffing/crew/workforce scheduling for events. This includes assigning shifts, confirming availability, and staffing coverage.

## Deprecated Terms
- `booking operations` (when used for staffing) -> `Staff Scheduling`
- `booking staff` -> `Schedule Staff` or `Staff Scheduler`
- `booking scheduler` -> `Staff Scheduler` (for workforce) or `Booking Agent` (for event booking)
- `booking manager` (legacy client type key) -> displayed as `Booking Agent`

## Compatibility Notes
- Existing stored client type keys are preserved (for example `booking_manager`).
- Legacy role aliases are mapped through `src/constants/terminology.js`.
- Display labels should always use `Booking Agent` and `Staff Scheduler` in user-facing contexts.
