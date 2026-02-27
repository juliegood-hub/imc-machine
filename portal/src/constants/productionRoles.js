export const PRODUCTION_ROLE_DIRECTORY = [
  {
    key: 'production_manager',
    title: 'Production Manager',
    department: 'Leadership',
    summary: 'Owns full show execution across schedule, staffing, and budget.',
    duties: [
      'Approves production timeline, staffing plan, and department handoffs.',
      'Coordinates technical, front-of-house, vendor, and safety leads.',
      'Escalation owner for show-day execution conflicts.',
    ],
    reportsTo: ['Executive Director', 'Producer'],
    supervises: ['Technical Director', 'Stage Manager', 'House Manager', 'Facilities Manager'],
    interactsWith: ['Merch Manager', 'Beverage Manager', 'Security Lead', 'Box Office Manager'],
    sectionLinks: [
      { label: 'Staffing Assignments', opsTab: 'staffing', fallback: '/production-ops/staffing' },
      { label: 'Budget + Reconciliation', opsTab: 'budget', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=budget' },
      { label: 'Production Modules', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops' },
    ],
  },
  {
    key: 'technical_director',
    title: 'Technical Director',
    department: 'Technical',
    summary: 'Leads audio, lighting, video, rigging, and stage systems.',
    duties: [
      'Signs off on stage plot, patch, power, and console readiness.',
      'Assigns technical crew and verifies cue execution readiness.',
      'Coordinates load-in, changeovers, and strike with department leads.',
    ],
    reportsTo: ['Production Manager'],
    supervises: ['Audio Engineer (FOH)', 'Monitor Engineer', 'A2 (Audio Assistant)', 'Lighting Designer', 'Lighting Board Operator', 'Projection Designer', 'Video Operator', 'Backline Tech', 'Rigger', 'Electrician'],
    interactsWith: ['Stage Manager', 'Facilities Manager', 'House Manager'],
    sectionLinks: [
      { label: 'Production Tab', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=production' },
      { label: 'Run of Show', path: '/run-of-show' },
      { label: 'Inventory + Ordering', path: '/venue-setup?tab=operations' },
    ],
  },
  {
    key: 'stage_manager',
    title: 'Stage Manager',
    department: 'Stage Ops',
    summary: 'Calls cues and keeps departments synced to run-of-show timing.',
    duties: [
      'Maintains cue sequence, call times, and department readiness checks.',
      'Confirms cast/crew movement, backstage traffic, and show pace.',
      'Coordinates live adjustments with technical and FOH leads.',
    ],
    reportsTo: ['Production Manager'],
    supervises: ['Assistant Stage Manager', 'Run Crew', 'Load-In Crew', 'Load-Out Crew'],
    interactsWith: ['Technical Director', 'House Manager', 'Security Lead', 'Wardrobe Supervisor'],
    sectionLinks: [
      { label: 'Run of Show', path: '/run-of-show' },
      { label: 'Staffing Tab', opsTab: 'staffing', fallback: '/production-ops/staffing' },
      { label: 'Event Ops Modules', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops' },
    ],
  },
  {
    key: 'audio_engineer_foh',
    title: 'Audio Engineer (FOH)',
    department: 'Audio',
    summary: 'Owns front-of-house mix quality and audience audio experience.',
    duties: [
      'Builds show file, gain structure, and FOH scene flow.',
      'Runs line check, soundcheck, and performance mix.',
      'Coordinates monitor/IEM needs with monitor engineer.',
    ],
    reportsTo: ['Technical Director'],
    supervises: ['A2 (Audio Assistant)'],
    interactsWith: ['Monitor Engineer', 'Stage Manager', 'Backline Tech'],
    sectionLinks: [
      { label: 'Production Tab', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=production' },
      { label: 'Run of Show', path: '/run-of-show' },
    ],
  },
  {
    key: 'monitor_engineer',
    title: 'Monitor Engineer',
    department: 'Audio',
    summary: 'Delivers performer monitor and in-ear mixes on stage.',
    duties: [
      'Builds wedge/IEM mixes and manages stage monitor routing.',
      'Coordinates stage patch and RF/wireless workflow.',
      'Handles fast changes between acts with FOH and stage teams.',
    ],
    reportsTo: ['Technical Director'],
    supervises: ['A2 (Audio Assistant)'],
    interactsWith: ['Audio Engineer (FOH)', 'Stage Manager', 'Backline Tech'],
    sectionLinks: [
      { label: 'Production Tab', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=production' },
      { label: 'Staffing Tab', opsTab: 'staffing', fallback: '/production-ops/staffing' },
    ],
  },
  {
    key: 'lighting_designer',
    title: 'Lighting Designer',
    department: 'Lighting',
    summary: 'Defines lighting look and cue architecture for the show.',
    duties: [
      'Creates lighting plot, looks, and cue structure.',
      'Coordinates fixture focus, programming, and transitions.',
      'Hands off cue execution to board operator with stage manager.',
    ],
    reportsTo: ['Technical Director'],
    supervises: ['Lighting Board Operator'],
    interactsWith: ['Stage Manager', 'Projection Designer', 'Video Operator'],
    sectionLinks: [
      { label: 'Production Tab', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=production' },
      { label: 'Run of Show', path: '/run-of-show' },
    ],
  },
  {
    key: 'lighting_board_operator',
    title: 'Lighting Board Operator',
    department: 'Lighting',
    summary: 'Executes lighting cues accurately during performance.',
    duties: [
      'Runs programmed cue stack during rehearsal and show.',
      'Implements live cue changes from stage manager/LD.',
      'Tracks cue anomalies and updates logs post-show.',
    ],
    reportsTo: ['Lighting Designer'],
    supervises: [],
    interactsWith: ['Stage Manager', 'Technical Director'],
    sectionLinks: [
      { label: 'Run of Show', path: '/run-of-show' },
      { label: 'Production Tab', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=production' },
    ],
  },
  {
    key: 'house_manager',
    title: 'House Manager',
    department: 'Front of House',
    summary: 'Leads audience-facing operations from doors to close.',
    duties: [
      'Owns doors, seating flow, and patron experience.',
      'Coordinates ushers, scanners, VIP flow, and incident routing.',
      'Bridges FOH timing with stage manager and security lead.',
    ],
    reportsTo: ['Production Manager'],
    supervises: ['Usher', 'Ticket Scanner', 'Door ID Checker', 'VIP Host', 'Security Lead'],
    interactsWith: ['Box Office Manager', 'Stage Manager', 'Beverage Manager'],
    sectionLinks: [
      { label: 'Staffing Tab', opsTab: 'staffing', fallback: '/production-ops/staffing' },
      { label: 'Concessions Tab', opsTab: 'concessions', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=concessions' },
    ],
  },
  {
    key: 'box_office_manager',
    title: 'Box Office Manager',
    department: 'Front of House',
    summary: 'Owns ticketing reconciliation, scans, and entry exception handling.',
    duties: [
      'Manages admissions exceptions and live check-in queue.',
      'Coordinates scanner ops and comp/VIP lists.',
      'Delivers attendance/ticket snapshots to stakeholders.',
    ],
    reportsTo: ['House Manager'],
    supervises: ['Ticket Scanner'],
    interactsWith: ['Ticketing Manager', 'Security Lead', 'House Manager'],
    sectionLinks: [
      { label: 'Ticketing Tab', opsTab: 'ticketing', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=ticketing' },
      { label: 'Staffing Tab', opsTab: 'staffing', fallback: '/production-ops/staffing' },
    ],
  },
  {
    key: 'security_lead',
    title: 'Security Lead',
    department: 'Safety',
    summary: 'Owns venue safety posture, incident response, and crowd control.',
    duties: [
      'Deploys security posts and escalation protocols.',
      'Coordinates entry policy, restricted access, and incident logs.',
      'Aligns with FOH and stage manager on emergency responses.',
    ],
    reportsTo: ['House Manager'],
    supervises: ['Security Staff'],
    interactsWith: ['Stage Manager', 'House Manager', 'Facilities Manager'],
    sectionLinks: [
      { label: 'Staffing Tab', opsTab: 'staffing', fallback: '/production-ops/staffing' },
      { label: 'Production Modules', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops' },
    ],
  },
  {
    key: 'beverage_manager',
    title: 'Beverage Manager',
    department: 'Concessions',
    summary: 'Runs bar service, staffing, and specials execution.',
    duties: [
      'Owns bar open/close window and intermission service execution.',
      'Manages bartender/barback deployment and service flow.',
      'Maintains specials, pricing, and inventory replenishment requests.',
    ],
    reportsTo: ['Production Manager'],
    supervises: ['Bartender', 'Barback', 'Server', 'Busser'],
    interactsWith: ['House Manager', 'Facilities Manager', 'Purchasing Lead'],
    sectionLinks: [
      { label: 'Concessions Tab', opsTab: 'concessions', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=concessions' },
      { label: 'Inventory + Suppliers', path: '/venue-setup?tab=operations' },
    ],
  },
  {
    key: 'merch_manager',
    title: 'Merch Manager',
    department: 'Merch/Vendors',
    summary: 'Owns merch table operations and vendor split execution.',
    duties: [
      'Assigns table positions and participant coverage.',
      'Tracks settlement inputs and split model assumptions.',
      'Coordinates vendor check-in, emergency contacts, and load-out.',
    ],
    reportsTo: ['Production Manager'],
    supervises: ['Vendor Staff', 'Table Runners'],
    interactsWith: ['House Manager', 'Security Lead', 'Board Liaison'],
    sectionLinks: [
      { label: 'Merch Tab', opsTab: 'merch', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=merch' },
      { label: 'Documents Tab', opsTab: 'documents', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=documents' },
    ],
  },
  {
    key: 'facilities_manager',
    title: 'Facilities Manager',
    department: 'Facilities',
    summary: 'Owns building readiness, utilities, and maintenance support.',
    duties: [
      'Maintains show-day infrastructure, utilities, and access routes.',
      'Coordinates maintenance response and safety hazards.',
      'Supports load-in/out logistics with technical and stage teams.',
    ],
    reportsTo: ['Production Manager'],
    supervises: ['Maintenance Tech', 'Janitorial Staff', 'Electrician', 'Runner'],
    interactsWith: ['Technical Director', 'Security Lead', 'Parking Coordinator'],
    sectionLinks: [
      { label: 'Inventory + Maintenance', path: '/venue-setup?tab=operations' },
      { label: 'Production Tab', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=production' },
    ],
  },
  {
    key: 'parking_coordinator',
    title: 'Parking Coordinator',
    department: 'Logistics',
    summary: 'Runs parking, loading zones, and arrival sequencing.',
    duties: [
      'Maintains vehicle assignments and permit routing.',
      'Coordinates loading zone timing with stage/technical teams.',
      'Publishes arrival instructions for cast, crew, and vendors.',
    ],
    reportsTo: ['Facilities Manager'],
    supervises: ['Load-In Crew', 'Load-Out Crew'],
    interactsWith: ['Stage Manager', 'Security Lead', 'House Manager'],
    sectionLinks: [
      { label: 'Production Modules', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=production' },
      { label: 'Staffing Tab', opsTab: 'staffing', fallback: '/production-ops/staffing' },
    ],
  },
  {
    key: 'wardrobe_supervisor',
    title: 'Wardrobe Supervisor',
    department: 'Wardrobe',
    summary: 'Leads costumes, quick-change flow, and wardrobe handoffs.',
    duties: [
      'Maintains costume track, fittings, and change assignments.',
      'Coordinates quick-change timing with stage management.',
      'Ensures costume readiness and repair workflow.',
    ],
    reportsTo: ['Stage Manager'],
    supervises: ['Costumer', 'Hair/Makeup Lead'],
    interactsWith: ['Assistant Stage Manager', 'Props Master'],
    sectionLinks: [
      { label: 'Production Modules', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=production' },
      { label: 'Run of Show', path: '/run-of-show' },
    ],
  },
];

export const PRODUCTION_ROLE_DEPARTMENTS = [
  'Leadership',
  'Technical',
  'Audio',
  'Lighting',
  'Stage Ops',
  'Front of House',
  'Safety',
  'Concessions',
  'Merch/Vendors',
  'Facilities',
  'Logistics',
  'Wardrobe',
];

export function normalizeRoleKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function getRoleByName(roleName = '') {
  const key = normalizeRoleKey(roleName);
  if (!key) return null;
  return PRODUCTION_ROLE_DIRECTORY.find((role) => normalizeRoleKey(role.title) === key || role.key === key) || null;
}

export function resolveRoleSectionLink(link = {}, eventId = '') {
  if (link.path) return link.path;
  if (link.opsTab && eventId) return `/events/${eventId}?opsTab=${encodeURIComponent(link.opsTab)}`;
  if (link.fallback) return link.fallback;
  return '/production-ops';
}
