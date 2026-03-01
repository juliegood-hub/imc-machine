import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import {
  PRODUCTION_PHASE_META,
  TAYLOR_FOUR_ZONE_META,
  TAYLOR_FRAMEWORK_ATTRIBUTION,
  WORKFLOW_ACTOR_META,
  WORKFLOW_SECTIONS,
  WORKFLOW_TRACKS,
  getWorkflowTrackMeta,
} from '../constants/workflowSections';
import {
  normalizeWorkflowVariant,
  resolveWorkflowVariantFromSearch,
  WORKFLOW_VARIANT_META,
} from '../constants/pageFlow';
import { HELP_MENU_LINKS } from '../constants/helpCenterContent';

const FOCUS_OPTIONS = [
  { key: 'all', label: 'All Sections', icon: '🧭', desc: 'Full end-to-end flow.' },
  { key: 'ai_intake', label: 'AI Intake', icon: '📥', desc: 'Voice, email, and upload intake to auto-build form drafts.' },
  { key: 'chat_assistant', label: 'Buddy the CatBot', icon: '🐈‍⬛', desc: 'Get guided next steps with one-click links.' },
  { key: 'marketing_distribution', label: 'Marketing + Distribution', icon: '🚀', desc: 'Only campaign creation and channel delivery.' },
  { key: 'production_ops', label: 'Production Ops', icon: '🎬', desc: 'Only production, run-of-show, and staffing readiness.' },
  { key: 'booking_setup', label: 'Booking + Setup', icon: '🏗️', desc: 'Only setup, reusable libraries, and booking basics.' },
  { key: 'revenue_reporting', label: 'Ticketing + Revenue', icon: '💳', desc: 'Only ticketing, settlement, and reporting.' },
];

const WORKFLOW_VARIANT_OPTIONS = [
  { key: 'default', label: WORKFLOW_VARIANT_META.default.label, desc: 'Balanced wording for all event workflows.' },
  { key: 'theater', label: WORKFLOW_VARIANT_META.theater.label, desc: 'Playhouse-friendly language for cast, cues, and departments.' },
  { key: 'music', label: WORKFLOW_VARIANT_META.music.label, desc: 'Band-first language for load-in, set times, and fan campaigns.' },
  { key: 'legal', label: WORKFLOW_VARIANT_META.legal.label, desc: 'CLE and legal event language for panels and registrations.' },
];

const CORE_MODULE_OVERVIEW = [
  { label: 'Events', desc: 'Build the event record once and use it everywhere else.' },
  { label: 'Plots & Layouts', desc: 'Map stage, room, infrastructure, and safety layers with publish controls.' },
  { label: 'Lighting + Sound + Projection', desc: 'Track technical metadata and generate department-ready paperwork.' },
  { label: 'Timeline Editor', desc: 'Coordinate multi-department cues and timing from one synchronized timeline.' },
  { label: 'Production Ops', desc: 'Run staffing, inventory, logistics, contracts, and day-of-show execution.' },
  { label: 'Safety + Risk', desc: 'Track permits, insurance, incidents, and emergency action plans with visibility.' },
  { label: 'Rehearsal Calendar + Google Sync', desc: 'Keep every dated item synchronized to calendar operations.' },
  { label: 'AI Equipment Recognition', desc: 'Convert equipment photos into structured, reusable inventory records.' },
];

const SECTION_ROUTE_MAP = {
  account_profile: {
    path: '/settings',
    requiresEvent: false,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open settings, profile details, and floating button preferences.',
      theater: 'Stage Manager prep: confirm profile, contacts, crew communication defaults, and floating button style.',
      music: 'Promoter prep: confirm profile, contacts, campaign communication defaults, and floating button style.',
      legal: 'Legal Coordinator prep: confirm profile, contacts, compliance communication defaults, and floating button style.',
    },
  },
  reusable_libraries: {
    path: '/venue-setup',
    requiresEvent: false,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open venue and reusable library setup.',
      theater: 'Stage Manager setup: lock theater, room, and reusable production libraries.',
      music: 'Promoter setup: lock frequent venues and recurring act libraries.',
      legal: 'Legal Coordinator setup: lock recurring venues, speaker groups, and panel libraries.',
    },
  },
  chat_assistant: {
    path: '/buddy',
    requiresEvent: false,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open Buddy the CatBot for guided next steps.',
      theater: 'Open Buddy the CatBot for stage-management-focused guidance.',
      music: 'Open Buddy the CatBot for promoter-focused guidance.',
      legal: 'Open Buddy the CatBot for legal-coordinator-focused guidance.',
    },
  },
  ai_intake: {
    path: '/events/create?ai=intake&input=email',
    requiresEvent: false,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open AI Intake to paste email threads, speak details, or upload source files.',
      theater: 'Stage Manager intake: pull rehearsal emails and show docs into structured event fields.',
      music: 'Promoter intake: pull booking emails and artist notes into one clean event draft.',
      legal: 'Legal Coordinator intake: pull panel emails and venue details into a ready legal event draft.',
    },
  },
  production_ops: {
    path: '/production-ops/event-ops?focus=event_ops',
    requiresEvent: true,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open event operations modules.',
      theater: 'Stage Manager workspace: costumes, set, dressing rooms, and parking plans.',
      music: 'Promoter workspace: hospitality, dressing, parking, and day-of-show logistics.',
      legal: 'Legal Coordinator workspace: room logistics, credentialing, and event operations details.',
    },
  },
  safety_risk: {
    path: '/safety-risk',
    requiresEvent: true,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open Safety + Risk Management for compliance and emergency readiness.',
      theater: 'Stage Manager safety lane: exits, compliance, incidents, and emergency action plans.',
      music: 'Promoter safety lane: security, permits, weather contingencies, and incident reporting.',
      legal: 'Legal Coordinator safety lane: compliance-ready risk, permits, and emergency planning.',
    },
  },
  staffing_workforce: {
    path: '/production-ops/staffing?focus=staffing',
    requiresEvent: true,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open staffing and workforce scheduling.',
      theater: 'Stage Manager staffing: assign calls for tech, deck, FOH, and backstage teams.',
      music: 'Promoter staffing: assign doors, security, bar, merch, and stage coverage.',
      legal: 'Legal Coordinator staffing: assign check-in, AV support, and moderator coverage.',
    },
  },
  capture_pipeline: {
    path: '/podcast',
    requiresEvent: true,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open capture and podcast controls.',
      theater: 'Stage Manager capture: track rehearsal/video capture inputs and publishing outputs.',
      music: 'Promoter capture: route live content capture for social and YouTube distribution.',
      legal: 'Legal Coordinator capture: route panel capture, transcript, and post-event publishing.',
    },
  },
  marketing_distribution: {
    path: '/imc-composer',
    requiresEvent: true,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open IMC Composer and distribution controls.',
      theater: 'Stage Manager support: prep opening-night copy and channel distribution with one command.',
      music: 'Promoter command center: launch multi-channel promotion for the show.',
      legal: 'Legal Coordinator command center: launch attendee-facing updates and legal event announcements.',
    },
  },
  ticketing_revenue: {
    path: '/events/:eventId',
    requiresEvent: true,
    requiresVenue: false,
    hintByVariant: {
      default: 'Open event ticketing and revenue details.',
      theater: 'Stage Manager visibility: monitor seats sold and readiness signals tied to performance dates.',
      music: 'Promoter visibility: monitor sales pace, settlement signals, and event health.',
      legal: 'Legal Coordinator visibility: monitor registrations, attendance, and reporting metrics.',
    },
  },
};

const ROLE_STEP_OVERRIDES = {
  theater: {
    account_profile: [
      {
        title: 'Set Stage Management Identity',
        desc: 'Set your production identity so call sheets, messaging, and operational ownership stay clear.',
      },
      {
        title: 'Lock House Communication Defaults',
        desc: 'Save the house communication baseline so cast, crew, and FOH all receive consistent direction.',
      },
      {
        title: 'Use AI Intake for Production Forms',
        desc: 'Use AI Assist to intake rehearsal emails, documents, and notes, then review before saving.',
      },
      {
        title: 'Confirm Emergency Coverage for Crew',
        desc: 'Verify emergency contacts so your day-of-show staffing coverage stays compliant and safe.',
      },
    ],
    reusable_libraries: [
      {
        title: 'Build Cast and Crew Libraries',
        desc: 'Store recurring actors, crew, and collaborators so production setup is reusable show to show.',
      },
      {
        title: 'Build Theater and Venue Library',
        desc: 'Save recurring theater profiles and contact trees for faster production startup.',
      },
      {
        title: 'Define Stages, Rooms, and Wings',
        desc: 'Define zones, stage geometry, and backstage spaces so assignments and logistics stay accurate.',
      },
      {
        title: 'Create Zone-Aware Performance Bookings',
        desc: 'Book performances by zone and time so rehearsal and performance conflicts are prevented.',
      },
    ],
    ai_intake: [
      {
        title: 'Drop in rehearsal comms',
        desc: 'Paste production emails or notes and I will draft your people, place, and timing fields.',
      },
      {
        title: 'Use voice for fast intake',
        desc: 'Speak naturally, and I will map details into structured fields you can approve.',
      },
      {
        title: 'Upload source docs',
        desc: 'Drop in photos, scans, PDFs, or Word docs and I will extract schedule-ready details.',
      },
      {
        title: 'Create linked records',
        desc: 'Create contacts, venues, and event drafts from one intake pass when details are complete.',
      },
    ],
    production_ops: [
      {
        title: 'Build Stage, Power, and Safety Plots',
        desc: 'Build plot layers for stage, audio, LX, power, and egress so departments share one clear map.',
      },
      {
        title: 'Share and Publish Plot Versions',
        desc: 'Share plots to event/org/venue collaborators, publish a version, then return to draft and republish anytime.',
      },
      {
        title: 'Load Department Modules',
        desc: 'Track costumes, set, dressing rooms, and parking with department-level accountability.',
      },
      {
        title: 'Run Readiness Checklists',
        desc: 'Use checklists to verify load-in, before-doors, show call, strike, and closeout readiness.',
      },
    ],
    safety_risk: [
      {
        title: 'Score theater event risk',
        desc: 'Set attendance, weather, staffing, and fire factors so risk scoring reflects live production conditions.',
      },
      {
        title: 'Lock permits and policy coverage',
        desc: 'Confirm permits, insurance, and COI status before performance day.',
      },
      {
        title: 'Coordinate security and medical readiness',
        desc: 'Track screening, surveillance, crowd control, and first-aid readiness with assigned owners.',
      },
      {
        title: 'Generate the EAP packet',
        desc: 'Publish the Emergency Action Plan with command chain, egress routes, and escalation protocol.',
      },
    ],
    staffing_workforce: [
      {
        title: 'Onboard Production Personnel',
        desc: 'Maintain reusable crew, contractor, and volunteer profiles for theater operations.',
      },
      {
        title: 'Assign Calls by Department',
        desc: 'Assign time blocks for stage, deck, lighting, audio, wardrobe, and FOH teams.',
      },
      {
        title: 'Publish Calls and Confirm Attendance',
        desc: 'Publish staffing calls and track confirm or decline responses before call time.',
      },
      {
        title: 'Track Training, Certs, and Time Clock',
        desc: 'Keep training, certifications, and attendance in sync with staffing coverage.',
      },
    ],
    capture_pipeline: [
      {
        title: 'Set Capture Plan for Performance',
        desc: 'Define what to capture for rehearsal, performance documentation, and post-show content.',
      },
      {
        title: 'Register Camera and Audio Positions',
        desc: 'Register every source position so operators and routes are clear before house opens.',
      },
      {
        title: 'Configure Zoom Session for Program Capture',
        desc: 'Configure Zoom capture settings for interviews, panels, or supplemental content.',
      },
      {
        title: 'Route YouTube and Podcast Outputs',
        desc: 'Set destination outputs so approved capture assets publish cleanly after the show.',
      },
    ],
    marketing_distribution: [
      {
        title: 'Generate Opening Night Campaign Copy',
        desc: 'Generate show-ready campaign copy with edits for theater audience tone and ticket CTA.',
      },
      {
        title: 'Distribute Across Priority Channels',
        desc: 'Push social, email, SMS, and listings from one command point with review control.',
      },
      {
        title: 'Queue Calendar Submissions',
        desc: 'Queue calendar placements so theater dates are visible in partner event channels.',
      },
      {
        title: 'Verify Delivery and URL Tracking',
        desc: 'Confirm what posted, what failed, and which links are live for audience discovery.',
      },
    ],
    ticketing_revenue: [
      {
        title: 'Connect Ticketing Route',
        desc: 'Connect provider links so audience purchase paths stay consistent across campaigns.',
      },
      {
        title: 'Review Sales Snapshot',
        desc: 'Review seats sold and pace signals to support front-of-house and staffing planning.',
      },
      {
        title: 'Track Settlement Notes',
        desc: 'Track gross/net reconciliation details for production closeout visibility.',
      },
      {
        title: 'Publish Stakeholder Packet',
        desc: 'Deliver board and stakeholder reporting with ticketing and ops outcomes in one packet.',
      },
    ],
    chat_assistant: [
      {
        title: 'Ask Buddy the CatBot in plain language',
        desc: 'Describe what is stuck, and Buddy returns stage-management-friendly next steps.',
      },
      {
        title: 'Get role-specific links',
        desc: 'Buddy gives direct links to the exact production section you need right now.',
      },
      {
        title: 'Turn notes into a checklist',
        desc: 'Paste rehearsal or ops notes and Buddy returns an actionable checklist.',
      },
      {
        title: 'Keep the team aligned',
        desc: 'Use Buddy responses as quick call-sheet guidance for your next move.',
      },
    ],
  },
  music: {
    account_profile: [
      {
        title: 'Set Promoter Identity',
        desc: 'Set your promoter identity so brand voice and booking communications stay consistent.',
      },
      {
        title: 'Lock Audience Communication Defaults',
        desc: 'Save communication defaults for venues, artists, fans, and sponsor contacts.',
      },
      {
        title: 'Use AI Intake for Show Details',
        desc: 'Use AI Assist to intake rider notes, one-sheets, and messages before final review.',
      },
      {
        title: 'Confirm Emergency Coverage',
        desc: 'Verify emergency contacts for staff and contractors before event-week deployment.',
      },
    ],
    reusable_libraries: [
      {
        title: 'Build Act and Collaborator Libraries',
        desc: 'Store recurring acts, hosts, and vendors so repeated show setup is fast.',
      },
      {
        title: 'Build Frequent Venue Library',
        desc: 'Save recurring venue records and contacts used across your event calendar.',
      },
      {
        title: 'Define Stage and Room Zones',
        desc: 'Define stage zones so scheduling, logistics, and staffing align to real layouts.',
      },
      {
        title: 'Create Conflict-Safe Show Bookings',
        desc: 'Assign show times by zone so overlapping bookings are flagged before launch.',
      },
    ],
    ai_intake: [
      {
        title: 'Paste booking emails',
        desc: 'Drop in promoter and venue email threads so I can pull show facts fast.',
      },
      {
        title: 'Use voice for show intake',
        desc: 'Speak lineup, venue, and date details and I will map them into your event draft.',
      },
      {
        title: 'Upload source files',
        desc: 'Upload posters, scans, PDFs, or Word docs and I will extract the usable details.',
      },
      {
        title: 'Create linked records',
        desc: 'Create contact, venue, and event records from selected AI suggestions in one step.',
      },
    ],
    production_ops: [
      {
        title: 'Build Stage, Power, and Safety Plots',
        desc: 'Build plot layers for stage, audio, LX, power, and egress so crew and venue teams align fast.',
      },
      {
        title: 'Share and Publish Plot Versions',
        desc: 'Share plots to event/org/venue stakeholders, publish current version, then move back to draft for revisions.',
      },
      {
        title: 'Load Event Operations Modules',
        desc: 'Track dressing rooms, parking, hospitality, and day-of-show operations details.',
      },
      {
        title: 'Run Day-of-Show Checklists',
        desc: 'Use readiness checklists to keep operations tight from load-in through before-doors and closeout.',
      },
    ],
    safety_risk: [
      {
        title: 'Score show risk by venue conditions',
        desc: 'Set risk inputs for attendance, alcohol, weather, and staffing to get an accurate show-day risk level.',
      },
      {
        title: 'Track permits, insurance, and contracts',
        desc: 'Confirm permit and coverage status for venue, city, and partner requirements.',
      },
      {
        title: 'Map security and incident readiness',
        desc: 'Set screening points, surveillance assignments, crowd controls, and medical support.',
      },
      {
        title: 'Generate emergency action plan',
        desc: 'Publish an EAP that teams can execute from before-doors through closeout.',
      },
    ],
    staffing_workforce: [
      {
        title: 'Onboard Show Staff and Crew',
        desc: 'Maintain reusable profiles for venue staff, contractors, and production crew.',
      },
      {
        title: 'Assign Shifts by Role',
        desc: 'Assign doors, bar, security, merch, and stage support with precise shift windows.',
      },
      {
        title: 'Publish Schedule and Confirm Coverage',
        desc: 'Send schedule notifications and confirm acceptance before event day.',
      },
      {
        title: 'Track Training and Attendance',
        desc: 'Track required training, certifications, and attendance for operational coverage.',
      },
    ],
    capture_pipeline: [
      {
        title: 'Set Live Capture Plan',
        desc: 'Define capture goals for promos, recap clips, and long-form content distribution.',
      },
      {
        title: 'Register Camera and Audio Inputs',
        desc: 'Register source inputs and operators so capture routing is clear before doors.',
      },
      {
        title: 'Configure Zoom Capture Session',
        desc: 'Configure Zoom if the event includes live interview or panel capture components.',
      },
      {
        title: 'Route YouTube and Podcast Distribution',
        desc: 'Set outputs for post-show publishing to YouTube and podcast channels.',
      },
    ],
    marketing_distribution: [
      {
        title: 'Generate Show Campaign Copy',
        desc: 'Generate show-specific copy across press, social, email, and SMS with promoter edits.',
      },
      {
        title: 'Launch Distribution Channels',
        desc: 'Distribute to all selected channels with one workflow and per-channel result tracking.',
      },
      {
        title: 'Queue Calendar Placements',
        desc: 'Queue local listing platforms so fans find the show in trusted discovery feeds.',
      },
      {
        title: 'Verify Campaign Delivery',
        desc: 'Audit what published and capture follow-ups for channels that need a second pass.',
      },
    ],
    ticketing_revenue: [
      {
        title: 'Connect Ticketing Provider',
        desc: 'Connect or link ticketing so all campaigns send fans to the right purchase URL.',
      },
      {
        title: 'Review Sales and Pace',
        desc: 'Review ticket sales pace to adjust promo timing and event-week decisions.',
      },
      {
        title: 'Track Settlement and Splits',
        desc: 'Track gross/net outcomes, payout notes, and reconciliation items.',
      },
      {
        title: 'Publish Partner Reporting',
        desc: 'Deliver promoter, venue, and stakeholder reporting in one clean summary packet.',
      },
    ],
    chat_assistant: [
      {
        title: 'Ask Buddy the CatBot what to do next',
        desc: 'Describe your situation, and Buddy returns promoter-specific actions.',
      },
      {
        title: 'Jump via one-click links',
        desc: 'Buddy links directly to events, IMC composer, staffing, and ops tabs.',
      },
      {
        title: 'Convert loose ideas into plan',
        desc: 'Paste notes and Buddy returns a practical rollout checklist.',
      },
      {
        title: 'Use Buddy for fast decisions',
        desc: 'Use quick answers to keep campaign and show execution moving.',
      },
    ],
  },
  legal: {
    account_profile: [
      {
        title: 'Set Legal Program Coordinator Identity',
        desc: 'Set coordinator identity so legal program communications stay accurate and professional.',
      },
      {
        title: 'Lock Compliance Communication Defaults',
        desc: 'Save communication defaults for attorneys, speakers, registrants, and partners.',
      },
      {
        title: 'Use AI Intake for Program Materials',
        desc: 'Use AI Assist to intake panel docs, speaker bios, and program text before approval.',
      },
      {
        title: 'Confirm Emergency Coverage',
        desc: 'Verify emergency contacts for staffing and operations readiness.',
      },
    ],
    reusable_libraries: [
      {
        title: 'Build Speaker and Panel Libraries',
        desc: 'Store recurring speakers, moderators, and partners for reusable program setup.',
      },
      {
        title: 'Build Venue and Program Library',
        desc: 'Save recurring venue profiles and legal program templates to reduce setup time.',
      },
      {
        title: 'Define Room and Zone Layouts',
        desc: 'Define room zones and capacities so registration and staffing stay aligned.',
      },
      {
        title: 'Create Conflict-Safe Program Bookings',
        desc: 'Assign session windows by room/zone so overlap and staffing conflicts are flagged.',
      },
    ],
    ai_intake: [
      {
        title: 'Paste legal program emails',
        desc: 'Drop panel and logistics emails so I can pull names, venue details, and scheduling facts.',
      },
      {
        title: 'Use voice for intake',
        desc: 'Speak session details and I will map them into structured legal event fields.',
      },
      {
        title: 'Upload source docs',
        desc: 'Use photos, scans, PDFs, or Word docs to extract program data for review.',
      },
      {
        title: 'Create linked records',
        desc: 'Create contacts, venues, and event drafts from approved AI findings.',
      },
    ],
    production_ops: [
      {
        title: 'Build Room, AV, and Safety Plots',
        desc: 'Build room, AV, power, and egress plot layers so legal sessions run with clean technical coverage.',
      },
      {
        title: 'Share and Publish Plot Versions',
        desc: 'Share plots with event/org/venue teams, publish approved versions, then switch to draft for updates and republish.',
      },
      {
        title: 'Load Event Operations Modules',
        desc: 'Track room logistics, parking, credentialing, and support operations.',
      },
      {
        title: 'Run Readiness and Compliance Checklists',
        desc: 'Use checklists to verify operational and compliance readiness before go-live.',
      },
    ],
    safety_risk: [
      {
        title: 'Score legal event risk and exposure',
        desc: 'Set capacity, weather, and staffing factors so risk classification stays current.',
      },
      {
        title: 'Track permit and policy compliance',
        desc: 'Track permit status, insurance validity, and supporting file links for compliance visibility.',
      },
      {
        title: 'Confirm screening and medical coverage',
        desc: 'Set access points, incident response coverage, and medical readiness notes.',
      },
      {
        title: 'Generate emergency action plan',
        desc: 'Create the legal-event EAP with response chain, routes, and escalation protocol.',
      },
    ],
    staffing_workforce: [
      {
        title: 'Onboard Program Staff',
        desc: 'Maintain reusable profiles for moderators, support staff, and event operators.',
      },
      {
        title: 'Assign Session and Support Shifts',
        desc: 'Assign check-in, AV, moderation, and room support coverage by time window.',
      },
      {
        title: 'Publish Schedule and Confirm Assignments',
        desc: 'Publish staffing schedule and confirm attendance before program day.',
      },
      {
        title: 'Track Training, Certs, and Attendance',
        desc: 'Track training and compliance records alongside attendance signals.',
      },
    ],
    capture_pipeline: [
      {
        title: 'Set Program Capture Plan',
        desc: 'Define whether sessions are captured for recap, archive, or post-event publication.',
      },
      {
        title: 'Register AV Input Sources',
        desc: 'Register room AV and capture sources so recording logistics stay controlled.',
      },
      {
        title: 'Configure Zoom Program Session',
        desc: 'Configure Zoom settings when sessions require webinar or remote participation capture.',
      },
      {
        title: 'Route YouTube and Podcast Output',
        desc: 'Route approved recording outputs to final publishing channels.',
      },
    ],
    marketing_distribution: [
      {
        title: 'Generate Program Campaign Copy',
        desc: 'Generate legal-event messaging for announcements, reminders, and attendee updates.',
      },
      {
        title: 'Distribute Across Channels',
        desc: 'Distribute approved copy to social, email, SMS, and calendar channels.',
      },
      {
        title: 'Queue Legal Event Listings',
        desc: 'Queue listing channels so legal audiences can find and register for the event.',
      },
      {
        title: 'Verify Delivery and Follow-Ups',
        desc: 'Verify delivery outcomes and close any pending channels before event date.',
      },
    ],
    ticketing_revenue: [
      {
        title: 'Connect Registration and Ticketing',
        desc: 'Connect provider links so attendee registration flows correctly across channels.',
      },
      {
        title: 'Review Registration Snapshot',
        desc: 'Review registration volume and pacing to support staffing and operations planning.',
      },
      {
        title: 'Track Settlement and Reporting Notes',
        desc: 'Track revenue and reconciliation notes needed for post-program reporting.',
      },
      {
        title: 'Publish Stakeholder Summary',
        desc: 'Deliver legal program performance reporting to partners and stakeholders.',
      },
    ],
    chat_assistant: [
      {
        title: 'Ask Buddy the CatBot for legal-event guidance',
        desc: 'Describe the blocker, and Buddy returns coordinator-focused steps.',
      },
      {
        title: 'Follow one-click navigation',
        desc: 'Buddy provides direct links to the right event, ops, and communication pages.',
      },
      {
        title: 'Convert email notes into task list',
        desc: 'Paste panel or logistics notes and Buddy returns a clean execution checklist.',
      },
      {
        title: 'Stay compliant and on schedule',
        desc: 'Use Buddy to keep scheduling, messaging, and reporting aligned.',
      },
    ],
  },
};

const ROLE_SECTION_SUMMARY_OVERRIDES = {
  theater: {
    account_profile: 'Set a production-ready profile so cast, crew, and house communication stay clean.',
    ai_intake: 'Ingest rehearsal emails and source docs fast, then approve clean structured drafts for production planning.',
    reusable_libraries: 'Store reusable theaters, teams, and stage-zone setups to avoid rework every show.',
    production_ops: 'Coordinate cue-critical departments so stage, deck, and FOH stay synchronized.',
    safety_risk: 'Run theater safety command for screening, egress, incidents, and EAP before every performance.',
    staffing_workforce: 'Assign and confirm theater crew calls so every role is covered at call time.',
    capture_pipeline: 'Plan rehearsal/performance capture inputs and publishing outputs from one production lane.',
    marketing_distribution: 'Launch opening-night messaging and distribution while preserving show voice and timing.',
    ticketing_revenue: 'Track seats, settlement signals, and stakeholder reporting for each performance run.',
    chat_assistant: 'Use Buddy the CatBot for stage-manager guidance, quick routing, and practical next-action checklists.',
  },
  music: {
    account_profile: 'Set a promoter-ready profile so booking, marketing, and audience comms stay consistent.',
    ai_intake: 'Ingest booking emails, artist notes, and source files, then convert them into ready event records.',
    reusable_libraries: 'Store reusable acts and venues so recurring shows can be launched quickly.',
    production_ops: 'Coordinate day-of-show operations from stage needs through hospitality and logistics.',
    safety_risk: 'Run show-level safety for security staffing, weather plans, permits, and emergency response.',
    staffing_workforce: 'Assign and confirm venue/stage teams so doors, bar, security, and merch are covered.',
    capture_pipeline: 'Manage live capture inputs and distribution outputs for social, YouTube, and podcast reuse.',
    marketing_distribution: 'Launch show campaigns across channels with one workflow and clear delivery visibility.',
    ticketing_revenue: 'Track sales pace, settlement outcomes, and partner-ready reporting from one event record.',
    chat_assistant: 'Use Buddy the CatBot for promoter guidance, campaign troubleshooting, and one-click execution links.',
  },
  legal: {
    account_profile: 'Set a legal-program profile so speaker, attendee, and compliance communication stays precise.',
    ai_intake: 'Ingest legal event emails and source docs, then approve structured records for accurate program setup.',
    reusable_libraries: 'Store reusable panel, speaker, and venue records for faster legal event setup.',
    production_ops: 'Coordinate room logistics, AV, and support workflows for dependable legal program execution.',
    safety_risk: 'Run compliance-safe risk and emergency planning for legal events and stakeholder confidence.',
    staffing_workforce: 'Assign and confirm moderator, AV, and check-in coverage for each legal event window.',
    capture_pipeline: 'Manage panel/session capture inputs and publishing outputs with controlled workflows.',
    marketing_distribution: 'Launch legal-event announcements and reminders with channel-level review and tracking.',
    ticketing_revenue: 'Track registration signals, reconciliation notes, and stakeholder reporting in one place.',
    chat_assistant: 'Use Buddy the CatBot for legal coordinator guidance, routing, and compliance-aware next steps.',
  },
};

function sectionMatchesFocus(section, focus) {
  if (focus === 'all') return true;
  if (focus === 'ai_intake') return section.id === 'ai_intake';
  if (focus === 'chat_assistant') return section.id === 'chat_assistant';
  return section.track === focus;
}

function actorMeta(actor) {
  return WORKFLOW_ACTOR_META[actor] || WORKFLOW_ACTOR_META.review;
}

function addWorkflowVariantToPath(path, workflowVariant) {
  if (!path) return '/';
  if (workflowVariant === 'default') return path;
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('wf', workflowVariant);
  return `${pathname}?${params.toString()}`;
}

function roleLabelForVariant(workflowVariant) {
  if (workflowVariant === 'theater') return 'Stage Manager';
  if (workflowVariant === 'music') return 'Promoter';
  if (workflowVariant === 'legal') return 'Legal Coordinator';
  return 'Event Lead';
}

function getTaylorZoneMeta(zoneKey) {
  return TAYLOR_FOUR_ZONE_META.find(zone => zone.key === zoneKey) || null;
}

function getProductionPhaseMeta(phaseKey) {
  return PRODUCTION_PHASE_META.find(phase => phase.key === phaseKey) || PRODUCTION_PHASE_META[0];
}

function resolveSectionTarget(sectionId, firstEventId, workflowVariant = 'default') {
  const route = SECTION_ROUTE_MAP[sectionId] || {
    path: '/workflow',
    requiresEvent: false,
    requiresVenue: false,
    hintByVariant: { default: 'Open workflow guide.' },
  };

  let resolvedPath = route.path;
  if (resolvedPath.includes(':eventId')) {
    resolvedPath = firstEventId ? resolvedPath.replace(':eventId', firstEventId) : '/events/create';
  }

  const hint = route.hintByVariant?.[workflowVariant]
    || route.hintByVariant?.default
    || 'Open workflow guide.';

  return { ...route, path: resolvedPath, hint };
}

function resolveSectionSteps(section, workflowVariant = 'default') {
  if (!section || !Array.isArray(section.steps)) return [];
  const overrides = ROLE_STEP_OVERRIDES?.[workflowVariant]?.[section.id];
  if (!Array.isArray(overrides) || !overrides.length) return section.steps;
  return section.steps.map((step, index) => {
    const override = overrides[index];
    if (!override) return step;
    return {
      ...step,
      title: override.title || step.title,
      desc: override.desc || step.desc,
    };
  });
}

function resolveSectionSummary(section, workflowVariant = 'default') {
  if (!section) return '';
  return ROLE_SECTION_SUMMARY_OVERRIDES?.[workflowVariant]?.[section.id] || section.summary || '';
}

export default function WorkflowGuide() {
  const navigate = useNavigate();
  const { events, venueProfiles } = useVenue();

  const [focus, setFocus] = useState('all');
  const [guidedMode, setGuidedMode] = useState(false);
  const [guidedIndex, setGuidedIndex] = useState(0);
  const [blockedNavigation, setBlockedNavigation] = useState(null);
  const [workflowVariant, setWorkflowVariant] = useState(() => {
    if (typeof window === 'undefined') return 'default';
    const queryVariant = resolveWorkflowVariantFromSearch(window.location.search);
    if (queryVariant !== 'default') {
      window.localStorage.setItem('imc-workflow-variant', queryVariant);
      return queryVariant;
    }
    return normalizeWorkflowVariant(window.localStorage.getItem('imc-workflow-variant') || 'default');
  });

  const visibleSections = useMemo(
    () => WORKFLOW_SECTIONS.filter((section) => sectionMatchesFocus(section, focus)),
    [focus]
  );

  const currentSection = visibleSections[guidedIndex] || null;
  const currentSectionSummary = useMemo(
    () => resolveSectionSummary(currentSection, workflowVariant),
    [currentSection, workflowVariant]
  );
  const currentSectionSteps = useMemo(
    () => resolveSectionSteps(currentSection, workflowVariant),
    [currentSection, workflowVariant]
  );
  const firstEventId = events?.[0]?.id || '';
  const hasEvent = (events || []).length > 0;
  const hasVenueProfile = (venueProfiles || []).length > 0;
  const sectionZoneReferenceRows = useMemo(
    () => visibleSections.map((section) => ({
      section,
      trackMeta: getWorkflowTrackMeta(section.track),
      phaseMeta: getProductionPhaseMeta(section.productionPhase),
      zones: (section.taylorZones || [])
        .map((zoneKey) => getTaylorZoneMeta(zoneKey))
        .filter(Boolean),
    })),
    [visibleSections]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const queryVariant = resolveWorkflowVariantFromSearch(window.location.search);
    if (queryVariant !== 'default') {
      window.localStorage.setItem('imc-workflow-variant', queryVariant);
      setWorkflowVariant(queryVariant);
    }
  }, []);

  useEffect(() => {
    setGuidedIndex(0);
  }, [focus, guidedMode]);

  useEffect(() => {
    if (guidedIndex >= visibleSections.length) {
      setGuidedIndex(0);
    }
  }, [guidedIndex, visibleSections.length]);

  const applyWorkflowVariant = (nextVariant) => {
    const normalized = normalizeWorkflowVariant(nextVariant);
    setWorkflowVariant(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('imc-workflow-variant', normalized);
    }
  };

  const openSection = (section) => {
    const target = resolveSectionTarget(section.id, firstEventId, workflowVariant);

    if (target.requiresEvent && !hasEvent) {
      setBlockedNavigation({ requirement: 'event', target, sectionTitle: section.title });
      return;
    }

    if (target.requiresVenue && !hasVenueProfile) {
      setBlockedNavigation({ requirement: 'venue', target, sectionTitle: section.title });
      return;
    }

    navigate(addWorkflowVariantToPath(target.path, workflowVariant));
  };

  const openBlockedRequirement = () => {
    if (!blockedNavigation) return;
    if (blockedNavigation.requirement === 'event') {
      navigate(addWorkflowVariantToPath('/events/create', workflowVariant));
      setBlockedNavigation(null);
      return;
    }
    if (blockedNavigation.requirement === 'venue') {
      navigate(addWorkflowVariantToPath('/venue-setup', workflowVariant));
      setBlockedNavigation(null);
    }
  };

  const roleLabel = roleLabelForVariant(workflowVariant);
  const blockedCopy = blockedNavigation?.requirement === 'event'
    ? {
      title: `${roleLabel} checkpoint`,
      body: workflowVariant === 'theater'
        ? 'Create the performance event first, then I can open this section for your stage management workflow.'
        : workflowVariant === 'music'
          ? 'Create the show first, then I can open this section for your promoter workflow.'
          : workflowVariant === 'legal'
            ? 'Create the legal event first, then I can open this section for your coordinator workflow.'
            : 'Create the event first, then I can open this section for the next workflow step.',
      actionLabel: workflowVariant === 'theater'
        ? 'Create Performance Event'
        : workflowVariant === 'music'
          ? 'Create Show Event'
          : workflowVariant === 'legal'
            ? 'Create Legal Event'
            : 'Start Creating Event',
    }
    : {
      title: `${roleLabel} checkpoint`,
      body: workflowVariant === 'theater'
        ? 'Set up the venue and rooms first, then I can open this section for your production team.'
        : workflowVariant === 'music'
          ? 'Set up the venue profile first, then I can open this section for promoter execution.'
          : workflowVariant === 'legal'
            ? 'Set up the venue profile first, then I can open this section for legal program logistics.'
            : 'Set up the venue profile first, then I can open this section for the next workflow step.',
      actionLabel: 'Start Venue Setup',
    };

  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-4">
      <div>
        <h1 className="text-3xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>📖 How It Works</h1>
        <p className="text-gray-500 mb-3">
          IMC Machine is your connected operating system for live events. I keep events, production, safety, staffing, and distribution in one place so your team can move without chaos.
          Use Guided Mode for a step-by-step walk, jump straight into the section you need, or ask Buddy the CatBot for fast routing.
        </p>
        <p className="text-xs text-gray-500 mb-2">
          Mobile tip: floating controls (Back to Top and Buddy) are adjustable in <Link to="/settings" className="text-[#0d1b2a] font-semibold">Settings</Link>.
        </p>
        <p className="text-xs text-[#0d1b2a] m-0">
          Active role context: <span className="font-semibold">{roleLabel}</span>
        </p>
      </div>

      <div className="card border border-[#0d1b2a1a] bg-[#f7f9ff]">
        <h2 className="text-lg m-0 mb-2">What IMC Machine Covers</h2>
        <p className="text-sm text-gray-600 mt-0 mb-3">
          This workspace is built for artists, venues, production managers, touring teams, galleries, festivals, and program leads.
          I connect creative planning with operational execution, then protect that work with versioning and collaboration controls.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          {CORE_MODULE_OVERVIEW.map((module) => (
            <div key={module.label} className="rounded border border-white bg-white px-3 py-2">
              <p className="m-0 text-sm font-semibold">{module.label}</p>
              <p className="m-0 text-xs text-gray-500">{module.desc}</p>
            </div>
          ))}
        </div>
        <div className="rounded border border-[#0d1b2a1a] bg-white px-3 py-2">
          <p className="m-0 text-xs font-semibold text-[#0d1b2a]">Documentation Center</p>
          <p className="m-0 text-xs text-gray-500">Use these pages for deep guidance, architecture context, and fast Buddy routing.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {HELP_MENU_LINKS.map((link) => (
              <Link key={`workflow-doc-${link.key}`} to={link.path} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">
                {link.icon} {link.label}
              </Link>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 mb-0">
          Why this is industry-grade: module data is connected, documentation is versioned, and collaboration permissions are explicit by event, org, and venue scope.
        </p>
      </div>

      <div className="card border border-[#0d1b2a1a] bg-[#faf8f3]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-lg m-0">🧠 Taylor 4-Zone Alignment</h2>
          <span className="text-xs px-2 py-1 rounded bg-[#0d1b2a] text-white">People · Money · Place/Stuff · Purpose/Program</span>
        </div>
        <p className="text-xs text-gray-600 mb-3">{TAYLOR_FRAMEWORK_ATTRIBUTION}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {TAYLOR_FOUR_ZONE_META.map((zone) => (
            <div key={zone.key} className="rounded border border-white/70 bg-white px-3 py-2">
              <p className="m-0 text-sm font-semibold">{zone.icon} {zone.label}</p>
              <p className="m-0 text-xs text-gray-500">{zone.description}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRODUCTION_PHASE_META.map((phase) => (
            <span key={phase.key} className={`text-xs px-2 py-1 rounded ${phase.badgeClass}`}>
              {phase.icon} {phase.label}
            </span>
          ))}
        </div>
        <div className="mt-3 rounded border border-[#0d1b2a1a] bg-white">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="m-0 text-xs font-semibold text-[#0d1b2a]">🗺️ Section-to-Zone Reference</p>
            <p className="m-0 text-[11px] text-gray-500">Every section below is color-mapped to Andrew Taylor&apos;s four-zone framework so people, money, place/stuff, and purpose stay in view.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {sectionZoneReferenceRows.map(({ section, trackMeta, phaseMeta, zones }) => (
              <div key={`zone-ref-${section.id}`} className="px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="m-0 text-sm font-semibold truncate">Section {section.number}: {section.title}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className={`text-[11px] px-2 py-0.5 rounded ${trackMeta.badgeClass}`}>
                      {trackMeta.icon} {trackMeta.label}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded ${phaseMeta.badgeClass}`}>
                      {phaseMeta.icon} {phaseMeta.label}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {zones.map((zone) => (
                    <span key={`zone-ref-${section.id}-${zone.key}`} className={`text-[11px] px-2 py-0.5 rounded ${zone.badgeClass}`}>
                      {zone.icon} {zone.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.values(WORKFLOW_ACTOR_META).map((meta) => (
          <span key={meta.label} className={`text-xs px-2 py-1 rounded ${meta.className}`}>
            {meta.icon} {meta.label}
          </span>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm font-semibold m-0">Choose your focus</p>
          <button
            type="button"
            onClick={() => setGuidedMode(prev => !prev)}
            className={`px-3 py-1.5 rounded border text-xs ${guidedMode ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]' : 'bg-white border-gray-300 text-gray-700'}`}
          >
            {guidedMode ? 'Guided Mode: ON' : 'Guided Mode: OFF'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
          {FOCUS_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFocus(option.key)}
              className={`text-left border rounded px-3 py-2 transition-colors ${focus === option.key ? 'border-[#c8a45e] bg-[#faf8f3]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <p className="m-0 text-sm font-semibold">{option.icon} {option.label}</p>
              <p className="m-0 text-xs text-gray-500">{option.desc}</p>
            </button>
          ))}
        </div>

        <p className="text-sm font-semibold m-0 mb-2">Pick your workflow lens</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WORKFLOW_VARIANT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => applyWorkflowVariant(option.key)}
              className={`text-left border rounded px-3 py-2 transition-colors ${workflowVariant === option.key ? 'border-[#0d1b2a] bg-[#f5f5f5]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <p className="m-0 text-sm font-semibold">{option.label}</p>
              <p className="m-0 text-xs text-gray-500">{option.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {WORKFLOW_TRACKS.map((track) => (
          <span key={track.key} className={`text-xs px-2 py-1 rounded ${track.badgeClass}`}>
            {track.icon} {track.label}
          </span>
        ))}
      </div>

      {guidedMode && currentSection && (
        <div className={`card border ${getWorkflowTrackMeta(currentSection.track).borderClass} ${getWorkflowTrackMeta(currentSection.track).cardClass}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className={`text-xs font-semibold m-0 ${getWorkflowTrackMeta(currentSection.track).accentClass}`}>
                Section {currentSection.number}
              </p>
              <h2 className="text-xl m-0" style={{ fontFamily: "'Playfair Display', serif" }}>
                {currentSection.icon} {currentSection.title}
              </h2>
              <p className="text-sm text-gray-600 mt-1 mb-0">{currentSectionSummary}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className={`text-[11px] px-2 py-0.5 rounded ${getProductionPhaseMeta(currentSection.productionPhase).badgeClass}`}>
                  {getProductionPhaseMeta(currentSection.productionPhase).icon} {getProductionPhaseMeta(currentSection.productionPhase).label}
                </span>
                {(currentSection.taylorZones || []).map((zoneKey) => {
                  const zone = getTaylorZoneMeta(zoneKey);
                  if (!zone) return null;
                  return (
                    <span key={`${currentSection.id}-${zone.key}`} className={`text-[11px] px-2 py-0.5 rounded ${zone.badgeClass}`}>
                      {zone.icon} {zone.label}
                    </span>
                  );
                })}
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${getWorkflowTrackMeta(currentSection.track).badgeClass}`}>
              {getWorkflowTrackMeta(currentSection.track).icon} {getWorkflowTrackMeta(currentSection.track).label}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {currentSectionSteps.map((step, index) => {
              const meta = actorMeta(step.actor);
              return (
                <div key={`${currentSection.id}-${step.title}`} className="rounded border border-white/60 bg-white px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="m-0 text-sm font-semibold">{index + 1}. {step.title}</p>
                      <p className="m-0 text-xs text-gray-500">{step.desc}</p>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded whitespace-nowrap ${meta.className}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <a
              href={addWorkflowVariantToPath(resolveSectionTarget(currentSection.id, firstEventId, workflowVariant).path, workflowVariant)}
              onClick={(e) => {
                e.preventDefault();
                openSection(currentSection);
              }}
              className="text-xs px-3 py-1.5 rounded border border-[#0d1b2a] text-[#0d1b2a] bg-white no-underline hover:bg-[#0d1b2a] hover:text-white"
            >
              Open as {roleLabel} ↗
            </a>
            <p className="m-0 text-xs text-gray-500">{resolveSectionTarget(currentSection.id, firstEventId, workflowVariant).hint}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setGuidedIndex(prev => Math.max(prev - 1, 0))}
              disabled={guidedIndex <= 0}
              className={`px-3 py-1.5 rounded border text-xs ${guidedIndex <= 0 ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400' : 'bg-white border-gray-300 text-gray-700 hover:border-[#c8a45e]'}`}
            >
              ← Previous
            </button>
            <p className="m-0 text-xs text-gray-500">
              {guidedIndex + 1} of {visibleSections.length}
            </p>
            <button
              type="button"
              onClick={() => setGuidedIndex(prev => Math.min(prev + 1, visibleSections.length - 1))}
              disabled={guidedIndex >= visibleSections.length - 1}
              className={`px-3 py-1.5 rounded border text-xs ${guidedIndex >= visibleSections.length - 1 ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400' : 'bg-white border-gray-300 text-gray-700 hover:border-[#c8a45e]'}`}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {!guidedMode && (
        <div className="space-y-3">
          {visibleSections.map((section) => {
            const trackMeta = getWorkflowTrackMeta(section.track);
            const target = resolveSectionTarget(section.id, firstEventId, workflowVariant);
            const sectionSummary = resolveSectionSummary(section, workflowVariant);
            const sectionSteps = resolveSectionSteps(section, workflowVariant);
            return (
              <div key={section.id} className={`card border ${trackMeta.borderClass} ${trackMeta.cardClass}`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className={`text-xs font-semibold m-0 ${trackMeta.accentClass}`}>
                      Section {section.number}
                    </p>
                    <h2 className="text-xl m-0" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {section.icon} {section.title}
                    </h2>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded ${getProductionPhaseMeta(section.productionPhase).badgeClass}`}>
                        {getProductionPhaseMeta(section.productionPhase).icon} {getProductionPhaseMeta(section.productionPhase).label}
                      </span>
                      {(section.taylorZones || []).map((zoneKey) => {
                        const zone = getTaylorZoneMeta(zoneKey);
                        if (!zone) return null;
                        return (
                          <span key={`${section.id}-${zone.key}`} className={`text-[11px] px-2 py-0.5 rounded ${zone.badgeClass}`}>
                            {zone.icon} {zone.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${trackMeta.badgeClass}`}>
                    {trackMeta.icon} {trackMeta.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-0 mb-3">{sectionSummary}</p>

                <div className="grid grid-cols-1 gap-2">
                  {sectionSteps.map((step, index) => {
                    const meta = actorMeta(step.actor);
                    return (
                      <div key={`${section.id}-${step.title}`} className="rounded border border-white/60 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="m-0 text-sm font-semibold">{index + 1}. {step.title}</p>
                            <p className="m-0 text-xs text-gray-500">{step.desc}</p>
                          </div>
                          <span className={`text-[11px] px-2 py-1 rounded whitespace-nowrap ${meta.className}`}>
                            {meta.icon} {meta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={addWorkflowVariantToPath(target.path, workflowVariant)}
                    onClick={(e) => {
                      e.preventDefault();
                      openSection(section);
                    }}
                    className="text-xs px-3 py-1.5 rounded border border-[#0d1b2a] text-[#0d1b2a] bg-white no-underline hover:bg-[#0d1b2a] hover:text-white"
                  >
                    Open as {roleLabel} ↗
                  </a>
                  <p className="m-0 text-xs text-gray-500">{target.hint}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {blockedNavigation && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg border border-gray-200 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 m-0 mb-1">Workflow Gate</p>
            <h3 className="text-lg m-0 mb-2">{blockedCopy.title}</h3>
            <p className="text-sm text-gray-600 m-0 mb-3">
              {blockedCopy.body}
            </p>
            <p className="text-xs text-gray-500 m-0 mb-4">
              Requested section: <span className="font-semibold text-gray-700">{blockedNavigation.sectionTitle}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-xs" onClick={openBlockedRequirement}>{blockedCopy.actionLabel}</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => setBlockedNavigation(null)}>Go Back to How It Works</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => setBlockedNavigation(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
