const DEFAULT_TIMEZONE = 'America/Chicago';

export const CALENDAR_VIEW_MODES = ['month', 'week', 'day', 'agenda'];

export const DEFAULT_CALENDAR_EVENT_TYPES = [
  { key: 'first_rehearsal', name: 'First Rehearsal', category: 'theatre', durationMinutes: 180, departmentTags: ['SM', 'Cast'], typicalRoles: ['Stage Manager', 'Director', 'Cast'] },
  { key: 'table_read', name: 'Table Work / Table Read', category: 'theatre', durationMinutes: 120, departmentTags: ['SM', 'Cast'], typicalRoles: ['Stage Manager', 'Director', 'Cast'] },
  { key: 'blocking_rehearsal', name: 'Staging / Blocking Rehearsal', category: 'theatre', durationMinutes: 180, departmentTags: ['SM', 'Cast'], typicalRoles: ['Director', 'Stage Manager', 'Cast'] },
  { key: 'paper_tech', name: 'Paper Tech', category: 'theatre', durationMinutes: 120, departmentTags: ['SM', 'LX', 'SND', 'PROJ'], typicalRoles: ['Stage Manager', 'Lighting', 'Sound', 'Projection'] },
  { key: 'dry_tech', name: 'Dry Tech', category: 'theatre', durationMinutes: 180, departmentTags: ['SM', 'LX', 'SND', 'PROJ', 'DECK'], typicalRoles: ['Stage Manager', 'Lighting', 'Sound', 'Projection', 'Deck'] },
  { key: 'cue_to_cue', name: 'Cue-to-Cue', category: 'theatre', durationMinutes: 240, departmentTags: ['SM', 'LX', 'SND', 'DECK', 'PROJ'], typicalRoles: ['Stage Manager', 'Lighting', 'Sound', 'Deck', 'Projection'] },
  { key: 'tech_rehearsal', name: 'Tech Rehearsal', category: 'theatre', durationMinutes: 240, departmentTags: ['SM', 'LX', 'SND', 'DECK', 'PROJ', 'OPS'], typicalRoles: ['Stage Manager', 'All Departments'] },
  { key: 'dress_rehearsal', name: 'Dress Rehearsal', category: 'theatre', durationMinutes: 240, departmentTags: ['SM', 'Cast', 'Wardrobe'], typicalRoles: ['Stage Manager', 'Cast', 'Wardrobe', 'Hair/Makeup'] },
  { key: 'preview', name: 'Preview', category: 'theatre', durationMinutes: 210, departmentTags: ['SM', 'FOH', 'Cast', 'Crew'], typicalRoles: ['Stage Manager', 'FOH', 'Cast', 'Crew'] },
  { key: 'performance', name: 'Performance', category: 'production', durationMinutes: 210, departmentTags: ['SM', 'FOH', 'Cast', 'Crew'], typicalRoles: ['Stage Manager', 'FOH', 'Cast', 'Crew'] },
  { key: 'notes_session', name: 'Notes Session', category: 'theatre', durationMinutes: 60, departmentTags: ['SM'], typicalRoles: ['Director', 'Stage Manager', 'Department Heads'] },
  { key: 'brush_up', name: 'Brush-Up / Put-In', category: 'theatre', durationMinutes: 150, departmentTags: ['SM', 'Cast'], typicalRoles: ['Stage Manager', 'Director', 'Understudy'] },
  { key: 'fight_call', name: 'Fight Call', category: 'theatre', durationMinutes: 45, departmentTags: ['SM', 'Cast'], typicalRoles: ['Fight Captain', 'Cast', 'Stage Manager'] },
  { key: 'half_hour_call', name: 'Half-Hour Call', category: 'theatre', durationMinutes: 30, departmentTags: ['SM', 'Cast', 'Crew', 'FOH'], typicalRoles: ['Cast', 'Crew', 'FOH'] },
  { key: 'places_call', name: 'Places Call', category: 'theatre', durationMinutes: 15, departmentTags: ['SM', 'Cast', 'Crew'], typicalRoles: ['Cast', 'Crew', 'SM'] },
  { key: 'strike', name: 'Strike', category: 'production', durationMinutes: 180, departmentTags: ['DECK', 'LX', 'SND'], typicalRoles: ['Deck', 'Lighting', 'Sound', 'Wardrobe', 'Props'] },
  { key: 'band_rehearsal', name: 'Band Rehearsal', category: 'music', durationMinutes: 180, departmentTags: ['Band'], typicalRoles: ['Band Leader', 'Band'] },
  { key: 'sectional_rehearsal', name: 'Sectional Rehearsal', category: 'music', durationMinutes: 120, departmentTags: ['Band'], typicalRoles: ['Section Leader', 'Band'] },
  { key: 'soundcheck', name: 'Soundcheck', category: 'music', durationMinutes: 90, departmentTags: ['SND', 'Band', 'SM'], typicalRoles: ['A1', 'A2', 'Band', 'Stage Manager'] },
  { key: 'line_check', name: 'Line Check', category: 'music', durationMinutes: 45, departmentTags: ['SND'], typicalRoles: ['A1', 'A2'] },
  { key: 'load_in', name: 'Load-In', category: 'ops', durationMinutes: 120, departmentTags: ['OPS', 'DECK'], typicalRoles: ['Production Manager', 'Deck', 'Stagehands'] },
  { key: 'load_out', name: 'Load-Out', category: 'ops', durationMinutes: 120, departmentTags: ['OPS', 'DECK'], typicalRoles: ['Production Manager', 'Deck', 'Stagehands'] },
  { key: 'gear_prep', name: 'Gear Pack / Prep', category: 'ops', durationMinutes: 90, departmentTags: ['OPS', 'SND', 'LX'], typicalRoles: ['Backline Tech', 'Audio', 'Lighting'] },
  { key: 'truck_call', name: 'Van/Truck Call', category: 'ops', durationMinutes: 45, departmentTags: ['OPS'], typicalRoles: ['Tour Manager', 'Driver', 'Crew'] },
  { key: 'backline_pickup', name: 'Backline Pickup/Return', category: 'ops', durationMinutes: 60, departmentTags: ['OPS', 'SND'], typicalRoles: ['Backline Tech', 'Runner'] },
  { key: 'staffing_call', name: 'Staffing Call', category: 'ops', durationMinutes: 30, departmentTags: ['OPS', 'FOH', 'BOH'], typicalRoles: ['Staff Scheduler', 'Department Heads'] },
  { key: 'doors', name: 'Doors', category: 'ops', durationMinutes: 240, departmentTags: ['FOH', 'Security'], typicalRoles: ['FOH Manager', 'Security', 'Ticketing'] },
  { key: 'security_briefing', name: 'Security Briefing', category: 'ops', durationMinutes: 30, departmentTags: ['Security', 'OPS'], typicalRoles: ['Security Lead', 'Venue Manager'] },
  { key: 'settlement', name: 'Settlement', category: 'ops', durationMinutes: 45, departmentTags: ['OPS'], typicalRoles: ['Promoter', 'Venue Rep', 'Production Manager'] },
  { key: 'vendor_load', name: 'Vendor Load-In/Load-Out', category: 'ops', durationMinutes: 120, departmentTags: ['OPS', 'Vendors'], typicalRoles: ['Vendor Coordinator', 'Ops Lead'] },
  { key: 'inventory_pull', name: 'Inventory Pull / Pack', category: 'ops', durationMinutes: 90, departmentTags: ['OPS'], typicalRoles: ['Inventory Manager', 'Ops Lead'] },
  { key: 'shop_build', name: 'Shop Build / Prop Build', category: 'ops', durationMinutes: 180, departmentTags: ['DECK', 'Props'], typicalRoles: ['Technical Director', 'Deck', 'Props'] },
  { key: 'costume_fittings', name: 'Costume Fittings', category: 'ops', durationMinutes: 120, departmentTags: ['Wardrobe', 'Cast'], typicalRoles: ['Wardrobe Supervisor', 'Cast'] },
  { key: 'rental_pickup', name: 'Tech Pickup / Rental Return', category: 'ops', durationMinutes: 60, departmentTags: ['OPS'], typicalRoles: ['Production Manager', 'Runner'] },
  { key: 'delivery_install', name: 'Deliveries / Install / Turnover', category: 'ops', durationMinutes: 120, departmentTags: ['OPS', 'DECK'], typicalRoles: ['Ops Lead', 'Deck'] },
];

export function normalizeCalendarTypeKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function getCalendarTypeTemplate(typeKey = '') {
  const key = normalizeCalendarTypeKey(typeKey);
  return DEFAULT_CALENDAR_EVENT_TYPES.find((entry) => entry.key === key) || null;
}

export function ensureIsoDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

export function calculateEndIso(startIso, durationMinutes = 120) {
  const start = new Date(startIso || '');
  if (Number.isNaN(start.getTime())) return '';
  const safeDuration = Number.isFinite(Number(durationMinutes)) ? Math.max(1, Number(durationMinutes)) : 120;
  return new Date(start.getTime() + safeDuration * 60000).toISOString();
}

export function toDateKey(isoValue = '', timezone = DEFAULT_TIMEZONE) {
  const dt = new Date(isoValue || '');
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-CA', { timeZone: timezone });
}

export function filterEntriesByView(entries = [], { viewMode = 'agenda', anchorDate = '', timezone = DEFAULT_TIMEZONE } = {}) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (!safeEntries.length) return [];
  if (!CALENDAR_VIEW_MODES.includes(viewMode) || viewMode === 'agenda') return safeEntries;

  const anchor = anchorDate
    ? new Date(`${anchorDate}T12:00:00`)
    : new Date();
  if (Number.isNaN(anchor.getTime())) return safeEntries;

  const start = new Date(anchor);
  const end = new Date(anchor);

  if (viewMode === 'day') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (viewMode === 'week') {
    const day = anchor.getDay();
    start.setDate(anchor.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (viewMode === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(start.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return safeEntries.filter((entry) => {
    const iso = ensureIsoDateTime(entry?.start_datetime || entry?.startDatetime || entry?.start_time || '');
    if (!iso) return false;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return false;
    const localKey = toDateKey(dt.toISOString(), timezone);
    const localized = new Date(`${localKey}T12:00:00`);
    return localized >= start && localized <= end;
  });
}

export function buildCalendarEntryTitle({ typeName = '', eventTitle = '', fallback = 'Production Call' } = {}) {
  const safeType = String(typeName || '').trim();
  const safeEvent = String(eventTitle || '').trim();
  if (safeType && safeEvent) return `${safeType} · ${safeEvent}`;
  if (safeType) return safeType;
  if (safeEvent) return safeEvent;
  return fallback;
}

export function normalizeReminderSettings(value) {
  if (!Array.isArray(value)) return [1440, 120, 30];
  const minutes = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .map((entry) => Math.round(entry));
  return minutes.length ? Array.from(new Set(minutes)).slice(0, 8) : [1440, 120, 30];
}

