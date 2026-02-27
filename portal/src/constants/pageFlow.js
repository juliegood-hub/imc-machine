export const WORKFLOW_VARIANT_META = {
  default: { key: 'default', label: 'General Workflow Lens' },
  theater: { key: 'theater', label: 'Theater Workflow Lens' },
  music: { key: 'music', label: 'Music Workflow Lens' },
  legal: { key: 'legal', label: 'Legal Workflow Lens' },
};

const DEFAULT_ACTION_LABELS = {
  complete: 'Mark Complete',
  save: 'Save for Later',
  skip: 'Skip This Step',
  next: 'Next Step →',
};

const DEFAULT_ACTION_MESSAGES = {
  complete: 'Beautiful. This page is marked complete.',
  save: 'Saved for later. You can pick this back up anytime.',
  skip: 'Skipped for now. You can return here anytime.',
};

const DEFAULT_ACTION_INTRO = 'Choose what you want to do with this section before moving on.';

const ACTION_COPY_BY_PAGE = {
  dashboard: {
    actionLabels: {
      complete: 'Mark Dashboard Reviewed',
      save: 'Save My Queue',
      skip: 'Skip Dashboard Sweep',
      next: 'Start Building Event →',
    },
    actionIntro: 'Review the pulse first, then move into the next action.',
  },
  venue_setup: {
    actionLabels: {
      complete: 'Lock Venue Profile',
      save: 'Save Venue Draft',
      skip: 'Skip Venue Setup',
      next: 'Go to Event Builder →',
    },
    actionIntro: 'Once this profile is clean, every booking gets faster.',
  },
  artist_setup: {
    actionLabels: {
      complete: 'Lock Artist Profile',
      save: 'Save Artist Draft',
      skip: 'Skip Artist Setup',
      next: 'Go to Event Builder →',
    },
    actionIntro: 'Keep this profile reusable so you never retype bios and links.',
  },
  event_create: {
    actionLabels: {
      complete: 'Lock Event Draft',
      save: 'Save Event Draft',
      skip: 'Skip Event Builder',
      next: 'Open IMC Composer →',
    },
    actionIntro: 'Finish core booking details now so production and distribution stay aligned.',
  },
  event_detail: {
    actionLabels: {
      complete: 'Lock Event Ops',
      save: 'Save Ops Progress',
      skip: 'Skip Ops Review',
      next: 'Open IMC Composer →',
    },
    actionIntro: 'This is your operational source of truth for this event.',
  },
  composer: {
    actionLabels: {
      complete: 'Approve Campaign Draft',
      save: 'Save Drafts for Review',
      skip: 'Skip Distribution Step',
      next: 'Open Campaign Tracker →',
    },
    actionIntro: 'Approve copy and channels intentionally before you push anything live.',
  },
  campaigns: {
    actionLabels: {
      complete: 'Mark Campaign Reviewed',
      save: 'Save Follow-Up Queue',
      skip: 'Skip Campaign Audit',
      next: 'Start Next Event →',
    },
    actionIntro: 'Confirm what landed and capture follow-up while it is fresh.',
  },
  production_ops: {
    actionLabels: {
      complete: 'Mark Production Hub Ready',
      save: 'Save Production Notes',
      skip: 'Skip Hub Review',
      next: 'Open Production Calendar →',
    },
    actionIntro: 'Use this hub to move between execution teams without losing context.',
  },
  production_ops_event: {
    actionLabels: {
      complete: 'Lock Event Ops Modules',
      save: 'Save Department Drafts',
      skip: 'Skip Event Ops Modules',
      next: 'Go to Staff Scheduling →',
    },
    actionIntro: 'Confirm costumes, set, dressing rooms, and parking before staffing dispatch.',
  },
  production_ops_staffing: {
    actionLabels: {
      complete: 'Lock Staff Schedule',
      save: 'Save Shift Plan',
      skip: 'Skip Scheduling Pass',
      next: 'Open Training + Certs →',
    },
    actionIntro: 'Schedule people with time, role, and confirmation status in one pass.',
  },
  production_ops_inventory: {
    actionLabels: {
      complete: 'Lock Inventory Plan',
      save: 'Save Inventory Draft',
      skip: 'Skip Inventory Pass',
      next: 'Go to Event Ops Modules →',
    },
    actionIntro: 'Make sure inventory, procurement, and maintenance are ready before show day.',
  },
  production_ops_training: {
    actionLabels: {
      complete: 'Mark Training Planned',
      save: 'Save Training Draft',
      skip: 'Skip Training Pass',
      next: 'Open Certifications →',
    },
    actionIntro: 'Use this section to prevent staffing surprises on event week.',
  },
  production_ops_certifications: {
    actionLabels: {
      complete: 'Mark Certifications Reviewed',
      save: 'Save Compliance Queue',
      skip: 'Skip Compliance Review',
      next: 'Return to Staff Scheduling →',
    },
    actionIntro: 'Check expirations now so nobody gets blocked at call time.',
  },
  production_calendar: {
    actionLabels: {
      complete: 'Mark Calendar Reviewed',
      save: 'Save Calendar Plan',
      skip: 'Skip Calendar Check',
      next: 'Open Run of Show →',
    },
    actionIntro: 'Resolve conflicts here before they become day-of-show problems.',
  },
  run_of_show: {
    actionLabels: {
      complete: 'Lock Run of Show',
      save: 'Save Cue Draft',
      skip: 'Skip Cue Review',
      next: 'Start Next Event Setup →',
    },
    actionIntro: 'Keep cues, departments, and owners synced before doors open.',
  },
  crew: {
    actionLabels: {
      complete: 'Mark Crew Roster Ready',
      save: 'Save Crew Draft',
      skip: 'Skip Crew Pass',
      next: 'Open Staff Scheduling →',
    },
    actionIntro: 'Roster quality here determines how smooth staffing assignment becomes later.',
  },
  media: {
    actionLabels: {
      complete: 'Mark Media Set Ready',
      save: 'Save Asset Set',
      skip: 'Skip Asset Review',
      next: 'Open IMC Composer →',
    },
    actionIntro: 'Keep your clean media library ready for quick distribution.',
  },
  image_formatter: {
    actionLabels: {
      complete: 'Mark Formats Ready',
      save: 'Save Format Batch',
      skip: 'Skip Formatting Pass',
      next: 'Open Media Gallery →',
    },
    actionIntro: 'Format once correctly and reuse across channels.',
  },
  press_page: {
    actionLabels: {
      complete: 'Approve Press Page',
      save: 'Save Press Draft',
      skip: 'Skip Press Review',
      next: 'Open IMC Composer →',
    },
    actionIntro: 'Treat this as your source page for media and partner sharing.',
  },
  chat: {
    actionLabels: {
      complete: 'Mark Chat Follow-Ups Done',
      save: 'Save Chat Follow-Ups',
      skip: 'Skip Chat Review',
      next: 'Start Event →',
    },
    actionIntro: 'Use chat for speed, then convert key details into tracked actions.',
  },
  workflow: {
    actionLabels: {
      complete: 'Mark Workflow Reviewed',
      save: 'Save My Workflow Lens',
      skip: 'Skip Workflow Review',
      next: 'Start Building Event →',
    },
    actionIntro: 'Pick the right lens, then jump directly into that section.',
  },
  podcast: {
    actionLabels: {
      complete: 'Lock Capture Plan',
      save: 'Save Capture Draft',
      skip: 'Skip Capture Pass',
      next: 'Open IMC Composer →',
    },
    actionIntro: 'Capture inputs and outputs should be locked before show day.',
  },
  settings: {
    actionLabels: {
      complete: 'Mark Settings Reviewed',
      save: 'Save Settings Draft',
      skip: 'Skip Settings Pass',
      next: 'Open Setup Wizard →',
    },
    actionIntro: 'Keep integrations healthy so your workflows run without manual patches.',
  },
  setup: {
    actionLabels: {
      complete: 'Mark Setup Complete',
      save: 'Save Setup Progress',
      skip: 'Skip Setup Step',
      next: 'Open Settings →',
    },
    actionIntro: 'Finish connection checks now so distribution is stable later.',
  },
  pricing: {
    actionLabels: {
      complete: 'Mark Plan Selected',
      save: 'Save Plan Choice',
      skip: 'Skip Plan Review',
      next: 'Start First Event →',
    },
    actionIntro: 'Lock plan and agreement decisions before campaign execution.',
  },
  admin: {
    actionLabels: {
      complete: 'Mark Admin Review Complete',
      save: 'Save Admin Updates',
      skip: 'Skip Admin Pass',
      next: 'Return to Dashboard →',
    },
    actionIntro: 'Treat admin updates as controlled operations, then return to execution.',
  },
};

const VARIANT_PAGE_COPY = {
  theater: {
    event_create: {
      nextDescription: 'Move into IMC Composer to draft play copy, ticket CTA, and show messaging for your production run.',
      actionLabels: { next: 'Next: Build Play Campaign →' },
    },
    production_ops_event: {
      subtitle: 'Coordinate costumes, set, dressing rooms, and parking for theatrical execution.',
      nextDescription: 'Hand department plans to staffing so each call is covered before rehearsal week.',
      actionLabels: { complete: 'Lock Theater Department Plan' },
    },
    production_ops_staffing: {
      nextDescription: 'Verify crew calls for stage management, lights, audio, and front-of-house support.',
      actionLabels: { next: 'Next: Confirm Crew Training →' },
    },
    run_of_show: {
      subtitle: 'Coordinate cues, call script timing, and backstage handoffs from preshow to strike.',
      nextDescription: 'Use this locked run as the baseline for the next performance date.',
      actionLabels: { complete: 'Lock Cue Script and Calls' },
    },
    composer: {
      nextDescription: 'Track what was posted and sent so cast, patrons, and partners see consistent show messaging.',
      actionLabels: { complete: 'Approve Theater Campaign' },
    },
    podcast: {
      subtitle: 'Capture rehearsals, interviews, and show documentation with a production-safe media workflow.',
    },
  },
  music: {
    event_create: {
      nextDescription: 'Move into IMC Composer to build set-driven campaign copy, fan messaging, and platform outputs.',
      actionLabels: { next: 'Next: Build Music Campaign →' },
    },
    production_ops_event: {
      subtitle: 'Coordinate backline, hospitality, dressing rooms, and parking for music events.',
      nextDescription: 'Hand artist and venue requirements to staffing so doors, stage, and merch are covered.',
    },
    run_of_show: {
      subtitle: 'Coordinate load-in, soundcheck, set times, changeovers, and strike handoffs.',
      actionLabels: { complete: 'Lock Set Timeline and Calls' },
    },
    composer: {
      nextDescription: 'Verify every social post, calendar push, and press hit before show day.',
      actionLabels: { complete: 'Approve Music Campaign' },
    },
    campaigns: {
      actionLabels: { next: 'Next: Launch Next Show →' },
    },
  },
  legal: {
    event_create: {
      subtitle: 'Create a complete CLE or legal event record with venue, panel, and registration details.',
      nextDescription: 'Move into IMC Composer for legal event messaging, speaker highlights, and registration copy.',
      actionLabels: { next: 'Next: Build Legal Campaign →' },
    },
    event_detail: {
      subtitle: 'Run legal event operations, speaker staffing, compliance notes, and execution status in one place.',
    },
    composer: {
      subtitle: 'Generate legal event messaging and distribute across social, email, SMS, and calendars.',
      actionLabels: { complete: 'Approve Legal Campaign' },
      nextDescription: 'Audit channel delivery so attorney outreach and attendee registration stay on track.',
    },
    campaigns: {
      nextDescription: 'Use this result set to plan the next CLE, panel, or legal speaking event.',
      actionLabels: { next: 'Next: Plan Next Legal Event →' },
    },
    production_ops_staffing: {
      subtitle: 'Assign moderators, check-in staff, A/V support, and compliance coverage for legal programs.',
    },
  },
};

export function normalizeWorkflowVariant(raw = 'default') {
  const key = String(raw || 'default').trim().toLowerCase();
  if (!key || key === 'default') return 'default';
  if (key === 'general') return 'default';
  return Object.prototype.hasOwnProperty.call(WORKFLOW_VARIANT_META, key) ? key : 'default';
}

export function resolveWorkflowVariantFromSearch(search = '') {
  if (!search) return 'default';
  try {
    const params = new URLSearchParams(String(search).startsWith('?') ? String(search) : `?${search}`);
    return normalizeWorkflowVariant(params.get('wf') || params.get('workflow') || params.get('lens') || 'default');
  } catch {
    return 'default';
  }
}

const PAGE_FLOW = [
  {
    key: 'dashboard',
    match: (pathname) => pathname === '/',
    title: 'Dashboard Features',
    subtitle: 'Track momentum, monitor open tasks, and launch the next move.',
    features: 'Includes recent events, completion tasks, and quick actions into setup, events, and IMC Composer.',
    nextPath: '/events/create',
    nextTitle: 'Start Event',
    nextDescription: 'Create your event record so distribution, staffing, and production tools can activate.',
  },
  {
    key: 'venue_setup',
    match: (pathname) => pathname.startsWith('/venue-setup'),
    title: 'Venue Setup Features',
    subtitle: 'Build your venue profile once, then reuse it across every booking.',
    features: 'Includes contact data, branding, operations defaults, ticketing connections, and AI-assisted autofill.',
    nextPath: '/events/create',
    nextTitle: 'Start Event',
    nextDescription: 'Use your saved venue profile to launch a new event with fewer manual fields.',
  },
  {
    key: 'artist_setup',
    match: (pathname) => pathname.startsWith('/artist-setup'),
    title: 'Artist Profile Features',
    subtitle: 'Capture your artist, act, or artisan profile with reusable details.',
    features: 'Includes identity, socials, team contacts, genres/mediums, and AI-assisted extraction from uploads.',
    nextPath: '/events/create',
    nextTitle: 'Start Event',
    nextDescription: 'Select saved profiles and build event campaigns without retyping core details.',
  },
  {
    key: 'event_create',
    match: (pathname) => pathname === '/events/create',
    title: 'Event Builder Features',
    subtitle: 'Create a complete event record with booking, production, and marketing inputs.',
    features: 'Includes AI intake (voice, paste email, upload photo/scan/PDF/Word), event basics, venue/ticketing, crew, production details, and reusable templates.',
    nextPath: '/imc-composer',
    nextTitle: 'IMC Composer',
    nextDescription: 'Generate copy, graphics, and distribution assets from this event record.',
  },
  {
    key: 'event_detail',
    match: (pathname) => /^\/events\/[^/]+$/.test(pathname),
    title: 'Event Operations Features',
    subtitle: 'Run event-level operations, staffing, ticketing, docs, and execution status in one place.',
    features: 'Includes booking operations tabs, check-ins, deal memos, settlements, staffing dispatch, and packet workflows.',
    nextPath: '/imc-composer',
    nextTitle: 'IMC Composer',
    nextDescription: 'Push this event through marketing generation and channel distribution.',
  },
  {
    key: 'composer',
    match: (pathname) => pathname.startsWith('/imc-composer'),
    title: 'IMC Composer Features',
    subtitle: 'Generate content and distribute across channels from one command center.',
    features: 'Includes press, social, email, SMS, calendar submissions, media variants, and channel status tracking.',
    nextPath: '/campaigns',
    nextTitle: 'Campaign Tracker',
    nextDescription: 'Verify what was sent, published, queued, or blocked and follow up from one view.',
  },
  {
    key: 'campaigns',
    match: (pathname) => pathname.startsWith('/campaigns'),
    title: 'Campaign Tracking Features',
    subtitle: 'Monitor each distribution channel and confirm campaign completion.',
    features: 'Includes channel-by-channel statuses, links, timestamps, and export-ready campaign snapshots.',
    nextPath: '/events/create',
    nextTitle: 'Start Next Event',
    nextDescription: 'Launch your next event campaign once this one is complete.',
  },
  {
    key: 'production_ops_staffing',
    match: (pathname) => pathname.startsWith('/production-ops/staffing'),
    title: 'Production Ops: Staff Scheduling Features',
    subtitle: 'Assign crew, shifts, policies, and staffing coverage for upcoming shows.',
    features: 'Includes staffing requirements, bulk assignments, confirmations, and export-ready staff sheets.',
    nextPath: '/production-ops/training?focus=training',
    nextTitle: 'Training and Certifications',
    nextDescription: 'Confirm the assigned team is trained and compliant before show day.',
  },
  {
    key: 'production_ops_event',
    match: (pathname) => pathname.startsWith('/production-ops/event-ops'),
    title: 'Production Ops: Event Modules',
    subtitle: 'Manage event-level production modules including costumes, set, parking, and dressing rooms.',
    features: 'Includes repeatable operational blocks for theater and live event execution workflows.',
    nextPath: '/production-ops/staffing?focus=staffing',
    nextTitle: 'Staff Scheduling',
    nextDescription: 'Assign staff to those event modules and lock day-of-show responsibilities.',
  },
  {
    key: 'production_ops_inventory',
    match: (pathname) => pathname.startsWith('/production-ops/inventory'),
    title: 'Production Ops: Inventory and Ordering Features',
    subtitle: 'Track inventory, suppliers, and purchasing execution.',
    features: 'Includes supplier routing, PO workflows, maintenance tracking, and procurement follow-through.',
    nextPath: '/production-ops/event-ops?focus=event_ops',
    nextTitle: 'Event Ops Modules',
    nextDescription: 'Apply inventory and purchasing decisions to active event operations.',
  },
  {
    key: 'production_ops_training',
    match: (pathname) => pathname.startsWith('/production-ops/training'),
    title: 'Production Ops: Training Features',
    subtitle: 'Organize training courses and sessions for production and operations teams.',
    features: 'Includes course planning, sessions, reminders, and readiness tracking for assigned staff.',
    nextPath: '/production-ops/certifications?focus=certifications',
    nextTitle: 'Certifications',
    nextDescription: 'Confirm required certifications and expiration timelines are covered.',
  },
  {
    key: 'production_ops_certifications',
    match: (pathname) => pathname.startsWith('/production-ops/certifications'),
    title: 'Production Ops: Certification Features',
    subtitle: 'Track certification validity and compliance deadlines.',
    features: 'Includes certification records, expiry monitoring, and reminder dispatch controls.',
    nextPath: '/production-ops/staffing?focus=staffing',
    nextTitle: 'Staff Scheduling',
    nextDescription: 'Apply compliance-ready staff to event shifts and finalize staffing coverage.',
  },
  {
    key: 'production_ops',
    match: (pathname) => pathname === '/production-ops',
    title: 'Production Ops Hub Features',
    subtitle: 'Coordinate staffing, event ops modules, training, certifications, and inventory workflows.',
    features: 'Includes quick links into each production section so teams can move fast under pressure.',
    nextPath: '/production-calendar',
    nextTitle: 'Production Calendar',
    nextDescription: 'Review all dates, conflicts, and readiness across the production timeline.',
  },
  {
    key: 'production_calendar',
    match: (pathname) => pathname.startsWith('/production-calendar'),
    title: 'Production Calendar Features',
    subtitle: 'Review production dates, conflicts, and workload across shows.',
    features: 'Includes timeline visibility for event, staffing, and operational planning decisions.',
    nextPath: '/run-of-show',
    nextTitle: 'Run of Show',
    nextDescription: 'Translate calendar planning into cue-by-cue execution.',
  },
  {
    key: 'run_of_show',
    match: (pathname) => pathname.startsWith('/run-of-show'),
    title: 'Run of Show Features',
    subtitle: 'Coordinate cues, technical readiness, and execution handoffs.',
    features: 'Includes workflow lock states, staff assignments, cue sheets, and press handoff packet support.',
    nextPath: '/events/create',
    nextTitle: 'Next Event Setup',
    nextDescription: 'Use what you learned from this run to prep the next event record faster.',
  },
  {
    key: 'crew',
    match: (pathname) => pathname.startsWith('/crew'),
    title: 'Crew Portal Features',
    subtitle: 'Invite, organize, and manage crew roles for event execution.',
    features: 'Includes role assignment, contact visibility, and staffing readiness inputs.',
    nextPath: '/production-ops/staffing?focus=staffing',
    nextTitle: 'Staff Scheduling',
    nextDescription: 'Place crew into actual shifts and day-of-show assignments.',
  },
  {
    key: 'media',
    match: (pathname) => pathname.startsWith('/media'),
    title: 'Media Gallery Features',
    subtitle: 'Organize formatted assets by event and platform.',
    features: 'Includes downloadable image sets, filtering by format, and campaign-ready file access.',
    nextPath: '/imc-composer',
    nextTitle: 'IMC Composer',
    nextDescription: 'Use the saved assets in distribution-ready copy and channel publishing.',
  },
  {
    key: 'image_formatter',
    match: (pathname) => pathname.startsWith('/format-images'),
    title: 'Image Formatter Features',
    subtitle: 'Convert one image into platform-specific dimensions with clean padding.',
    features: 'Includes multi-format generation, bulk output, and event-ready file exports.',
    nextPath: '/media',
    nextTitle: 'Media Gallery',
    nextDescription: 'Review and manage your generated assets before distribution.',
  },
  {
    key: 'press_page',
    match: (pathname) => pathname.startsWith('/press-page'),
    title: 'Press Page Features',
    subtitle: 'Generate shareable event press pages with bilingual-ready content.',
    features: 'Includes event metadata, press copy, image placement, and share/download actions.',
    nextPath: '/imc-composer',
    nextTitle: 'IMC Composer',
    nextDescription: 'Pair your press page with social/email/calendar distribution.',
  },
  {
    key: 'chat',
    match: (pathname) => pathname.startsWith('/chat'),
    title: 'Event Chat Features',
    subtitle: 'Open event conversations fast for production and operations coordination.',
    features: 'Includes event-thread access for real-time team updates and role-specific collaboration.',
    nextPath: '/events/create',
    nextTitle: 'Start Event',
    nextDescription: 'Create or select the next event to open a new operations thread.',
  },
  {
    key: 'workflow',
    match: (pathname) => pathname.startsWith('/workflow'),
    title: 'Workflow Guide Features',
    subtitle: 'See the full color-coded process from intake to distribution and reporting.',
    features: 'Includes guided mode, AI Intake section, section focus filters, role ownership, four-zone alignment, and ordered execution steps.',
    nextPath: '/events/create',
    nextTitle: 'Start Event',
    nextDescription: 'Begin the workflow in live data by creating your next event.',
  },
  {
    key: 'podcast',
    match: (pathname) => pathname.startsWith('/podcast'),
    title: 'Podcast and Media Capture Features',
    subtitle: 'Build podcast-ready assets and publish event audio/video outputs.',
    features: 'Includes source document generation, upload flow, and YouTube publishing controls.',
    nextPath: '/imc-composer',
    nextTitle: 'IMC Composer',
    nextDescription: 'Distribute published media with platform-specific copy and assets.',
  },
  {
    key: 'settings',
    match: (pathname) => pathname.startsWith('/settings'),
    title: 'Settings Features',
    subtitle: 'Control integrations, defaults, notifications, and account-level behavior.',
    features: 'Includes OAuth connection management and operational preferences used across workflows.',
    nextPath: '/setup',
    nextTitle: 'Setup Wizard',
    nextDescription: 'If needed, complete any remaining integration setup steps.',
  },
  {
    key: 'setup',
    match: (pathname) => pathname.startsWith('/setup'),
    title: 'Setup Wizard Features',
    subtitle: 'Connect platform credentials and verify external integrations.',
    features: 'Includes guided OAuth setup, credential storage, and connection testing checkpoints.',
    nextPath: '/settings',
    nextTitle: 'Settings',
    nextDescription: 'Confirm connections and finalize your environment preferences.',
  },
  {
    key: 'pricing',
    match: (pathname) => pathname.startsWith('/pricing'),
    title: 'Pricing and Agreement Features',
    subtitle: 'Review plan pricing and confirm agreement terms before activation.',
    features: 'Includes promo handling, agreement acceptance, and onboarding readiness.',
    nextPath: '/events/create',
    nextTitle: 'Start Event',
    nextDescription: 'Move straight into creating your first campaign-ready event.',
  },
  {
    key: 'admin',
    match: (pathname) => pathname.startsWith('/admin'),
    title: 'Admin Features',
    subtitle: 'Manage users, invites, broadcasts, and platform-wide operations health.',
    features: 'Includes account controls, campaign visibility, invites, and operational oversight tools.',
    nextPath: '/dashboard',
    nextTitle: 'Dashboard',
    nextDescription: 'Return to the main workspace after admin updates are complete.',
  },
];

const DEFAULT_PAGE_META = {
  key: 'default',
  title: 'Workspace Features',
  subtitle: 'Use this page to continue your live event workflow.',
  features: 'This page is part of your connected IMC workflow and supports your next operational step.',
  nextPath: '/workflow',
  nextTitle: 'Workflow Guide',
  nextDescription: 'Open the guide to choose the next best section.',
};

export function resolvePageFlow(pathname = '/', options = {}) {
  const variant = normalizeWorkflowVariant(options.variant);
  const matched = PAGE_FLOW.find((entry) => entry.match(pathname));
  const base = matched ? { ...matched } : { ...DEFAULT_PAGE_META };
  if (base.nextPath === '/dashboard') {
    base.nextPath = '/';
  }

  const pageCopy = ACTION_COPY_BY_PAGE[base.key] || {};
  const variantCopy = VARIANT_PAGE_COPY[variant]?.[base.key] || {};

  const actionLabels = {
    ...DEFAULT_ACTION_LABELS,
    ...(pageCopy.actionLabels || {}),
    ...(variantCopy.actionLabels || {}),
  };

  const actionMessages = {
    ...DEFAULT_ACTION_MESSAGES,
    ...(pageCopy.actionMessages || {}),
    ...(variantCopy.actionMessages || {}),
  };

  const merged = {
    ...base,
    ...variantCopy,
    actionIntro: variantCopy.actionIntro || pageCopy.actionIntro || DEFAULT_ACTION_INTRO,
    actionLabels,
    actionMessages,
    workflowVariant: variant,
    workflowVariantLabel: WORKFLOW_VARIANT_META[variant]?.label || WORKFLOW_VARIANT_META.default.label,
  };

  if (merged.nextPath === '/dashboard') {
    merged.nextPath = '/';
  }

  return merged;
}
