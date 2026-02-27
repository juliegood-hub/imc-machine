import { DEFAULT_JOB_TITLES } from '../services/staffing.js';
import { PRODUCTION_ROLE_DIRECTORY as CORE_ROLE_DIRECTORY } from './productionRoles.js';

const OPS_LINKS = {
  staffing: { label: 'Staffing Tab', opsTab: 'staffing', fallback: '/production-ops/staffing' },
  production: { label: 'Production Tab', opsTab: 'production', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=production' },
  purchasing: { label: 'Purchasing Tab', opsTab: 'purchasing', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=purchasing' },
  concessions: { label: 'Concessions Tab', opsTab: 'concessions', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=concessions' },
  merch: { label: 'Merch Tab', opsTab: 'merch', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=merch' },
  documents: { label: 'Documents Tab', opsTab: 'documents', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=documents' },
  ticketing: { label: 'Ticketing Tab', opsTab: 'ticketing', fallback: '/production-ops/event-ops?focus=event_ops&opsTab=ticketing' },
};

const STATIC_LINKS = {
  runOfShow: { label: 'Run of Show', path: '/run-of-show' },
  inventory: { label: 'Inventory + Suppliers', path: '/venue-setup?tab=operations' },
  composer: { label: 'IMC Composer', path: '/imc-composer' },
  campaigns: { label: 'Campaign Tracker', path: '/campaigns' },
  capture: { label: 'Capture + Podcast', path: '/podcast' },
  board: { label: 'Board Dashboard', path: '/admin' },
  workflow: { label: 'How It Works', path: '/workflow' },
};

const ROLE_DEPARTMENT_OVERRIDES = {
  'Assistant Stage Manager': 'Stage Ops',
  'A2 (Audio Assistant)': 'Audio',
  'Projection Designer': 'Video/Projection',
  'Video Operator': 'Video/Projection',
  'Scenic Designer': 'Scenic/Props',
  'Props Master': 'Scenic/Props',
  'Hair/Makeup Lead': 'Wardrobe',
  Costumer: 'Wardrobe',
  'Backline Tech': 'Technical',
  Rigger: 'Technical',
  'Tour Manager': 'Leadership',
  'MC / Emcee': 'Performance',
  DJ: 'Performance',
  'Band Leader': 'Performance',
  Conductor: 'Performance',
  'Ticket Scanner': 'Front of House',
  Usher: 'Front of House',
  'Door ID Checker': 'Front of House',
  'VIP Host': 'Front of House',
  Bartender: 'Concessions',
  Barback: 'Concessions',
  Server: 'Concessions',
  Busser: 'Concessions',
  'Security Staff': 'Safety',
  Electrician: 'Facilities',
  'Maintenance Tech': 'Facilities',
  'Janitorial Staff': 'Facilities',
  Runner: 'Logistics',
  'Load-In Crew': 'Logistics',
  'Load-Out Crew': 'Logistics',
  'Marketing Manager': 'Marketing',
  'Social Media Manager': 'Marketing',
  Photographer: 'Media',
  Videographer: 'Media',
  'Board Liaison': 'Governance',
  'Executive Director': 'Leadership',
  Chef: 'Culinary',
  'Sous Chef': 'Culinary',
  'Line Cook': 'Culinary',
  'Food Vendor': 'Culinary',
};

const DEFAULT_REPORTS_TO = {
  Leadership: ['Executive Director'],
  Technical: ['Technical Director'],
  'Stage Ops': ['Stage Manager'],
  Lighting: ['Lighting Designer'],
  Audio: ['Audio Engineer (FOH)'],
  'Video/Projection': ['Technical Director'],
  'Scenic/Props': ['Stage Manager'],
  Wardrobe: ['Wardrobe Supervisor'],
  Performance: ['Stage Manager'],
  'Front of House': ['House Manager'],
  Safety: ['Security Lead'],
  Concessions: ['Beverage Manager'],
  'Merch/Vendors': ['Merch Manager'],
  Facilities: ['Facilities Manager'],
  Logistics: ['Facilities Manager'],
  Marketing: ['Marketing Manager'],
  Media: ['Marketing Manager'],
  Governance: ['Executive Director'],
  Culinary: ['Chef'],
};

const DEFAULT_INTERACTS_WITH = {
  Leadership: ['Production Manager', 'House Manager', 'Technical Director'],
  Technical: ['Stage Manager', 'Facilities Manager', 'House Manager'],
  'Stage Ops': ['Technical Director', 'House Manager', 'Wardrobe Supervisor'],
  Lighting: ['Stage Manager', 'Projection Designer', 'Technical Director'],
  Audio: ['Stage Manager', 'Backline Tech', 'Monitor Engineer'],
  'Video/Projection': ['Lighting Designer', 'Stage Manager', 'Videographer'],
  'Scenic/Props': ['Stage Manager', 'Assistant Stage Manager', 'Wardrobe Supervisor'],
  Wardrobe: ['Stage Manager', 'Assistant Stage Manager', 'Props Master'],
  Performance: ['Stage Manager', 'Audio Engineer (FOH)', 'House Manager'],
  'Front of House': ['House Manager', 'Security Lead', 'Box Office Manager'],
  Safety: ['House Manager', 'Stage Manager', 'Facilities Manager'],
  Concessions: ['House Manager', 'Facilities Manager', 'Security Lead'],
  'Merch/Vendors': ['House Manager', 'Security Lead', 'Board Liaison'],
  Facilities: ['Technical Director', 'Security Lead', 'Parking Coordinator'],
  Logistics: ['Stage Manager', 'Facilities Manager', 'Security Lead'],
  Marketing: ['Production Manager', 'Campaign Tracker', 'Board Liaison'],
  Media: ['Marketing Manager', 'Stage Manager', 'Video Operator'],
  Governance: ['Executive Director', 'Production Manager', 'Marketing Manager'],
  Culinary: ['Beverage Manager', 'Server', 'Food Vendor'],
};

const DEFAULT_SECTION_LINKS = {
  Leadership: [OPS_LINKS.staffing, OPS_LINKS.documents, STATIC_LINKS.board],
  Technical: [OPS_LINKS.production, OPS_LINKS.staffing, STATIC_LINKS.runOfShow],
  'Stage Ops': [STATIC_LINKS.runOfShow, OPS_LINKS.production, OPS_LINKS.staffing],
  Lighting: [OPS_LINKS.production, STATIC_LINKS.runOfShow, OPS_LINKS.staffing],
  Audio: [OPS_LINKS.production, STATIC_LINKS.runOfShow, OPS_LINKS.staffing],
  'Video/Projection': [OPS_LINKS.production, STATIC_LINKS.capture, STATIC_LINKS.runOfShow],
  'Scenic/Props': [OPS_LINKS.production, STATIC_LINKS.runOfShow, STATIC_LINKS.inventory],
  Wardrobe: [OPS_LINKS.production, STATIC_LINKS.runOfShow, OPS_LINKS.staffing],
  Performance: [STATIC_LINKS.runOfShow, OPS_LINKS.production, OPS_LINKS.staffing],
  'Front of House': [OPS_LINKS.staffing, OPS_LINKS.ticketing, OPS_LINKS.concessions],
  Safety: [OPS_LINKS.staffing, OPS_LINKS.production, OPS_LINKS.documents],
  Concessions: [OPS_LINKS.concessions, OPS_LINKS.staffing, STATIC_LINKS.inventory],
  'Merch/Vendors': [OPS_LINKS.merch, OPS_LINKS.documents, OPS_LINKS.staffing],
  Facilities: [STATIC_LINKS.inventory, OPS_LINKS.production, OPS_LINKS.staffing],
  Logistics: [OPS_LINKS.production, OPS_LINKS.staffing, OPS_LINKS.documents],
  Marketing: [STATIC_LINKS.composer, STATIC_LINKS.campaigns, OPS_LINKS.documents],
  Media: [STATIC_LINKS.capture, STATIC_LINKS.composer, STATIC_LINKS.campaigns],
  Governance: [STATIC_LINKS.board, OPS_LINKS.documents, STATIC_LINKS.campaigns],
  Culinary: [OPS_LINKS.concessions, OPS_LINKS.purchasing, STATIC_LINKS.inventory],
};

const ROLE_RELATION_OVERRIDES = {
  'Assistant Stage Manager': {
    supervises: ['Runner'],
    interactsWith: ['Props Master', 'Wardrobe Supervisor', 'Security Staff'],
  },
  'A2 (Audio Assistant)': {
    reportsTo: ['Audio Engineer (FOH)'],
    interactsWith: ['Monitor Engineer', 'Backline Tech', 'Stage Manager'],
  },
  'Projection Designer': {
    reportsTo: ['Technical Director'],
    supervises: ['Video Operator'],
  },
  'Video Operator': {
    reportsTo: ['Projection Designer'],
  },
  'Scenic Designer': {
    reportsTo: ['Technical Director'],
    interactsWith: ['Stage Manager', 'Props Master', 'Lighting Designer'],
  },
  'Props Master': {
    reportsTo: ['Stage Manager'],
    interactsWith: ['Assistant Stage Manager', 'Scenic Designer', 'Wardrobe Supervisor'],
  },
  'Hair/Makeup Lead': {
    reportsTo: ['Wardrobe Supervisor'],
  },
  Costumer: {
    reportsTo: ['Wardrobe Supervisor'],
  },
  'Backline Tech': {
    reportsTo: ['Technical Director'],
  },
  Rigger: {
    reportsTo: ['Technical Director'],
  },
  'Tour Manager': {
    reportsTo: ['Production Manager'],
    supervises: ['Band Leader', 'DJ'],
  },
  'MC / Emcee': {
    reportsTo: ['Stage Manager'],
  },
  DJ: {
    reportsTo: ['Stage Manager'],
  },
  'Band Leader': {
    reportsTo: ['Stage Manager'],
  },
  Conductor: {
    reportsTo: ['Stage Manager'],
  },
  'Ticket Scanner': {
    reportsTo: ['Box Office Manager'],
  },
  Usher: {
    reportsTo: ['House Manager'],
  },
  'Door ID Checker': {
    reportsTo: ['House Manager'],
  },
  'VIP Host': {
    reportsTo: ['House Manager'],
  },
  Bartender: {
    reportsTo: ['Beverage Manager'],
  },
  Barback: {
    reportsTo: ['Beverage Manager'],
  },
  Server: {
    reportsTo: ['Beverage Manager'],
  },
  Busser: {
    reportsTo: ['Beverage Manager'],
  },
  'Security Staff': {
    reportsTo: ['Security Lead'],
  },
  Electrician: {
    reportsTo: ['Facilities Manager'],
  },
  'Maintenance Tech': {
    reportsTo: ['Facilities Manager'],
  },
  'Janitorial Staff': {
    reportsTo: ['Facilities Manager'],
  },
  Runner: {
    reportsTo: ['Facilities Manager'],
  },
  'Load-In Crew': {
    reportsTo: ['Stage Manager'],
  },
  'Load-Out Crew': {
    reportsTo: ['Stage Manager'],
  },
  'Marketing Manager': {
    reportsTo: ['Executive Director'],
    supervises: ['Social Media Manager', 'Photographer', 'Videographer'],
    interactsWith: ['Production Manager', 'Board Liaison', 'Box Office Manager'],
  },
  'Social Media Manager': {
    reportsTo: ['Marketing Manager'],
  },
  Photographer: {
    reportsTo: ['Marketing Manager'],
  },
  Videographer: {
    reportsTo: ['Marketing Manager'],
  },
  'Board Liaison': {
    reportsTo: ['Executive Director'],
  },
  'Executive Director': {
    reportsTo: [],
    supervises: ['Production Manager', 'Marketing Manager', 'Board Liaison'],
    interactsWith: ['House Manager', 'Technical Director', 'Facilities Manager'],
  },
  Chef: {
    reportsTo: ['Beverage Manager'],
    supervises: ['Sous Chef'],
  },
  'Sous Chef': {
    reportsTo: ['Chef'],
    supervises: ['Line Cook'],
  },
  'Line Cook': {
    reportsTo: ['Sous Chef'],
  },
  'Food Vendor': {
    reportsTo: ['Beverage Manager'],
  },
};

function uniqueBy(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function cloneLinks(links = []) {
  return links.map((link) => ({ ...link }));
}

function humanDepartmentFromSeed(seedDepartment, roleTitle) {
  if (ROLE_DEPARTMENT_OVERRIDES[roleTitle]) return ROLE_DEPARTMENT_OVERRIDES[roleTitle];
  if (seedDepartment === 'foh') return 'Front of House';
  if (seedDepartment === 'operations') return 'Facilities';
  if (seedDepartment === 'admin_marketing') return 'Marketing';
  if (seedDepartment === 'culinary_specialty') return 'Culinary';
  if (seedDepartment === 'production') return 'Technical';
  return 'Leadership';
}

function buildGeneratedSummary(roleTitle, department) {
  return `${roleTitle} keeps ${department.toLowerCase()} execution on time, documented, and aligned with the live event plan.`;
}

function buildGeneratedDuties(roleTitle, department) {
  const role = roleTitle.toLowerCase();
  return [
    `Preps ${role} workflows before doors so dependencies are clear.`,
    `Executes ${role} duties during live operations with timing discipline.`,
    `Closes handoffs, updates notes, and confirms completion with ${department.toLowerCase()} leads.`,
  ];
}

function normalizeRoleTitle(value = '') {
  return String(value || '').trim().toLowerCase();
}

const coreRolesByTitle = new Map(CORE_ROLE_DIRECTORY.map((role) => [normalizeRoleTitle(role.title), role]));
const seedOrderByTitle = new Map(DEFAULT_JOB_TITLES.map((row, index) => [normalizeRoleTitle(row.name), index]));

const generatedRoles = DEFAULT_JOB_TITLES
  .filter((row) => !coreRolesByTitle.has(normalizeRoleTitle(row.name)))
  .map((row) => {
    const department = humanDepartmentFromSeed(row.department, row.name);
    const relation = ROLE_RELATION_OVERRIDES[row.name] || {};
    return {
      key: normalizeRoleKey(row.name),
      title: row.name,
      department,
      summary: relation.summary || buildGeneratedSummary(row.name, department),
      duties: relation.duties || buildGeneratedDuties(row.name, department),
      reportsTo: uniqueBy(relation.reportsTo || DEFAULT_REPORTS_TO[department] || ['Production Manager']),
      supervises: uniqueBy(relation.supervises || []),
      interactsWith: uniqueBy(relation.interactsWith || DEFAULT_INTERACTS_WITH[department] || ['Stage Manager', 'House Manager']),
      sectionLinks: cloneLinks(relation.sectionLinks || DEFAULT_SECTION_LINKS[department] || [OPS_LINKS.staffing, OPS_LINKS.production]),
    };
  });

export const PRODUCTION_ROLE_DIRECTORY = [...CORE_ROLE_DIRECTORY, ...generatedRoles].sort((a, b) => {
  const orderA = seedOrderByTitle.get(normalizeRoleTitle(a.title));
  const orderB = seedOrderByTitle.get(normalizeRoleTitle(b.title));
  const safeA = Number.isFinite(orderA) ? orderA : 999;
  const safeB = Number.isFinite(orderB) ? orderB : 999;
  if (safeA !== safeB) return safeA - safeB;
  return a.title.localeCompare(b.title);
});

export const PRODUCTION_ROLE_DEPARTMENTS = [...new Set(PRODUCTION_ROLE_DIRECTORY.map((role) => role.department))];

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
