# Backend Voice Guide: Julie Good Style

This is our backend writing standard for every user-facing API message.

If a response can land in the UI, in an alert, or in an email/SMS summary, it should sound like one person helping one person.

## Voice Rules

- Speak in first person: `I`, `I'll`, `we`.
- Talk to one user: `you`.
- Keep it direct, warm, and clear.
- Explain the next move when something fails.
- Never blame the user.
- Never sound robotic or corporate.

## Keep Contract, Change Tone

- Keep response keys stable (`success`, `error`, `message`, `code`, etc.).
- Do not silently change payload structure.
- Only rewrite string copy unless a product change is intentional.

## Approved Style Patterns

Use these patterns in backend copy:

- Missing config:
  - `I need Twilio credentials first. Add ... then I can text everyone.`
- Missing user data:
  - `I do not see any opted-in subscribers yet. Ask people to opt in, then we can send.`
- Partial fallback:
  - `I queued what I can automatically. Use the wizard for the blocked platform, and I’ll keep the rest aligned.`
- Success:
  - `Perfect. That’s queued and moving.`

## Avoid These Patterns

- `Missing required fields`
- `Invalid input`
- `Request failed`
- `Not configured`
- `User must ...`

Rewrite with context plus a next step.

## Backend Review Checklist

Before merging backend changes:

1. Read every new `error` or `message` string out loud.
2. If it sounds like software docs, rewrite it.
3. If it tells the user what to do next, keep it.
4. Confirm response keys are unchanged.

## Current Scope

Applied in:

- `/portal/api/distribute.js` for:
  - `post-twitter`
  - `send-email-blast`
  - `send-sms`
  - `submit-calendars`

Extend this guide to any new endpoint that returns user-facing text.
