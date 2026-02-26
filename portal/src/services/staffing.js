const HOURS_MS = 60 * 60 * 1000;

export const STAFF_PAY_TYPES = ['hourly', 'flat', 'salary', 'volunteer'];
export const STAFF_ASSIGNMENT_STATUSES = ['scheduled', 'confirmed', 'declined', 'no_show'];

export const DEFAULT_JOB_TITLES = [
  { name: 'Technical Director', department: 'production', sortOrder: 1 },
  { name: 'Stage Manager', department: 'production', sortOrder: 2 },
  { name: 'Assistant Stage Manager', department: 'production', sortOrder: 3 },
  { name: 'Lighting Designer', department: 'production', sortOrder: 4 },
  { name: 'Lighting Board Operator', department: 'production', sortOrder: 5 },
  { name: 'Audio Engineer (FOH)', department: 'production', sortOrder: 6 },
  { name: 'Monitor Engineer', department: 'production', sortOrder: 7 },
  { name: 'A2 (Audio Assistant)', department: 'production', sortOrder: 8 },
  { name: 'Projection Designer', department: 'production', sortOrder: 9 },
  { name: 'Video Operator', department: 'production', sortOrder: 10 },
  { name: 'Scenic Designer', department: 'production', sortOrder: 11 },
  { name: 'Props Master', department: 'production', sortOrder: 12 },
  { name: 'Wardrobe Supervisor', department: 'production', sortOrder: 13 },
  { name: 'Hair/Makeup Lead', department: 'production', sortOrder: 14 },
  { name: 'Costumer', department: 'production', sortOrder: 15 },
  { name: 'Backline Tech', department: 'production', sortOrder: 16 },
  { name: 'Rigger', department: 'production', sortOrder: 17 },
  { name: 'Production Manager', department: 'production', sortOrder: 18 },
  { name: 'Tour Manager', department: 'production', sortOrder: 19 },
  { name: 'MC / Emcee', department: 'production', sortOrder: 20 },
  { name: 'DJ', department: 'production', sortOrder: 21 },
  { name: 'Band Leader', department: 'production', sortOrder: 22 },
  { name: 'Conductor', department: 'production', sortOrder: 23 },
  { name: 'House Manager', department: 'foh', sortOrder: 24 },
  { name: 'Box Office Manager', department: 'foh', sortOrder: 25 },
  { name: 'Ticket Scanner', department: 'foh', sortOrder: 26 },
  { name: 'Usher', department: 'foh', sortOrder: 27 },
  { name: 'Door ID Checker', department: 'foh', sortOrder: 28 },
  { name: 'VIP Host', department: 'foh', sortOrder: 29 },
  { name: 'Merch Manager', department: 'foh', sortOrder: 30 },
  { name: 'Bartender', department: 'foh', sortOrder: 31 },
  { name: 'Barback', department: 'foh', sortOrder: 32 },
  { name: 'Server', department: 'foh', sortOrder: 33 },
  { name: 'Busser', department: 'foh', sortOrder: 34 },
  { name: 'Security Lead', department: 'foh', sortOrder: 35 },
  { name: 'Security Staff', department: 'foh', sortOrder: 36 },
  { name: 'Facilities Manager', department: 'operations', sortOrder: 37 },
  { name: 'Electrician', department: 'operations', sortOrder: 38 },
  { name: 'Maintenance Tech', department: 'operations', sortOrder: 39 },
  { name: 'Janitorial Staff', department: 'operations', sortOrder: 40 },
  { name: 'Parking Coordinator', department: 'operations', sortOrder: 41 },
  { name: 'Runner', department: 'operations', sortOrder: 42 },
  { name: 'Load-In Crew', department: 'operations', sortOrder: 43 },
  { name: 'Load-Out Crew', department: 'operations', sortOrder: 44 },
  { name: 'Marketing Manager', department: 'admin_marketing', sortOrder: 45 },
  { name: 'Social Media Manager', department: 'admin_marketing', sortOrder: 46 },
  { name: 'Photographer', department: 'admin_marketing', sortOrder: 47 },
  { name: 'Videographer', department: 'admin_marketing', sortOrder: 48 },
  { name: 'Board Liaison', department: 'admin_marketing', sortOrder: 49 },
  { name: 'Executive Director', department: 'admin_marketing', sortOrder: 50 },
  { name: 'Chef', department: 'culinary_specialty', sortOrder: 51 },
  { name: 'Sous Chef', department: 'culinary_specialty', sortOrder: 52 },
  { name: 'Line Cook', department: 'culinary_specialty', sortOrder: 53 },
  { name: 'Food Vendor', department: 'culinary_specialty', sortOrder: 54 },
  { name: 'Beverage Manager', department: 'culinary_specialty', sortOrder: 55 },
];

function asDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function normalizePhoneDigits(value = '') {
  return String(value || '').replace(/\D+/g, '');
}

export function normalizeStaffingInboundAction(message = '') {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return 'unknown';
  if (/(^|\b)(confirm|yes|y|accepted|accept)($|\b)/.test(text)) return 'confirm';
  if (/(^|\b)(decline|no|n|cannot|cant|can\'t)($|\b)/.test(text)) return 'decline';
  return 'unknown';
}

export function rangesOverlap(startA, endA, startB, endB) {
  const aStart = asDate(startA);
  const aEnd = asDate(endA);
  const bStart = asDate(startB);
  const bEnd = asDate(endB);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  if (aEnd <= aStart || bEnd <= bStart) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function findStaffAssignmentConflicts(assignments = [], candidate = {}) {
  const candidateStaffId = candidate.staffProfileId || candidate.staff_profile_id;
  if (!candidateStaffId) return [];
  return (assignments || []).filter((row) => {
    if (!row) return false;
    if ((row.staff_profile_id || row.staffProfileId) !== candidateStaffId) return false;
    if ((candidate.id || candidate.assignmentId) && row.id === (candidate.id || candidate.assignmentId)) return false;
    return rangesOverlap(
      row.start_time || row.startTime,
      row.end_time || row.endTime,
      candidate.startTime || candidate.start_time,
      candidate.endTime || candidate.end_time,
    );
  });
}

export function calculateAssignmentCompensation(assignment = {}, profile = {}) {
  const payType = String(
    assignment.pay_type || assignment.payType || profile.pay_type || profile.payType || 'hourly'
  ).toLowerCase();
  const rate = money(assignment.pay_override ?? assignment.payOverride ?? profile.default_rate ?? profile.defaultRate);

  if (payType === 'volunteer') {
    return { payType, rate: 0, hours: 0, estimatedPay: 0 };
  }

  if (payType === 'flat' || payType === 'salary') {
    return {
      payType,
      rate,
      hours: 0,
      estimatedPay: rate || 0,
    };
  }

  const start = asDate(assignment.start_time || assignment.startTime);
  const end = asDate(assignment.end_time || assignment.endTime);
  const hours = start && end && end > start ? Number(((end - start) / HOURS_MS).toFixed(2)) : 0;

  return {
    payType: 'hourly',
    rate,
    hours,
    estimatedPay: rate ? Number((rate * hours).toFixed(2)) : 0,
  };
}

export function buildStaffingCoverage(assignments = [], roleRequirements = []) {
  const list = Array.isArray(assignments) ? assignments : [];
  const requiredRoles = Array.isArray(roleRequirements) ? roleRequirements : [];

  const filled = list.filter((row) => row.status !== 'declined' && row.status !== 'no_show').length;
  const confirmed = list.filter((row) => row.status === 'confirmed').length;
  const declined = list.filter((row) => row.status === 'declined').length;

  const assignmentByRole = new Map();
  list.forEach((row) => {
    const role = String(row.job_title || row.jobTitle || '').trim().toLowerCase();
    if (!role) return;
    assignmentByRole.set(role, (assignmentByRole.get(role) || 0) + 1);
  });

  const roleCoverage = requiredRoles.map((requirement) => {
    const roleName = String(requirement.role || requirement.jobTitle || '').trim();
    const key = roleName.toLowerCase();
    const requiredCount = Math.max(0, Number(requirement.requiredCount || requirement.required || 1) || 1);
    const assignedCount = assignmentByRole.get(key) || 0;
    return {
      role: roleName,
      requiredCount,
      assignedCount,
      missing: Math.max(0, requiredCount - assignedCount),
    };
  });

  const rolesRequired = roleCoverage.reduce((sum, row) => sum + row.requiredCount, 0);
  const rolesFilled = roleCoverage.reduce((sum, row) => sum + Math.min(row.requiredCount, row.assignedCount), 0);

  const confirmationRate = filled > 0 ? Number(((confirmed / filled) * 100).toFixed(1)) : 0;
  return {
    totalAssignments: list.length,
    rolesRequired,
    rolesFilled,
    rolesUnfilled: Math.max(0, rolesRequired - rolesFilled),
    confirmationRate,
    confirmed,
    declined,
    roleCoverage,
  };
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match?.[1]?.trim() || '';
}

export function parseVoiceStaffInput(transcript = '', knownTitles = []) {
  const text = String(transcript || '').trim();
  if (!text) return {};

  const normalizedText = text.replace(/\s+/g, ' ');
  const email = firstMatch(normalizedText, /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  const phoneRaw = firstMatch(normalizedText, /(\+?\d[\d\s().-]{7,}\d)/);
  const phoneDigits = normalizePhoneDigits(phoneRaw);
  const phone = phoneDigits.length >= 10 ? phoneRaw : '';

  const rateMatch = normalizedText.match(/\$\s*(\d+(?:\.\d{1,2})?)\s*(?:\/\s*hr|per\s*hour|hourly)/i)
    || normalizedText.match(/(\d+(?:\.\d{1,2})?)\s*(?:usd\s*)?(?:\/\s*hr|per\s*hour|hourly)/i);
  const flatMatch = normalizedText.match(/\$\s*(\d+(?:\.\d{1,2})?)\s*(?:flat|per\s*show|show\s*rate)/i);

  let payType = '';
  let defaultRate = null;
  if (rateMatch) {
    payType = 'hourly';
    defaultRate = Number(rateMatch[1]);
  } else if (flatMatch) {
    payType = 'flat';
    defaultRate = Number(flatMatch[1]);
  } else if (/\bvolunteer\b/i.test(normalizedText)) {
    payType = 'volunteer';
    defaultRate = 0;
  } else if (/\bsalary\b/i.test(normalizedText)) {
    payType = 'salary';
  }

  const titleByLength = [...knownTitles]
    .map((title) => String(title || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const role = titleByLength.find((title) => new RegExp(`\\b${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(normalizedText)) || '';

  const leading = normalizedText.split(',')[0] || '';
  const nameBits = leading
    .replace(/\b(phone|email|rate|hourly|flat|salary|volunteer)\b.*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const firstName = nameBits[0] || '';
  const lastName = nameBits.length > 1 ? nameBits.slice(1).join(' ') : '';

  return {
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(' '),
    phoneNumber: phone,
    email,
    primaryRole: role,
    payType,
    defaultRate,
    notes: normalizedText,
  };
}

function formatDisplayDate(value, formatOptions) {
  if (!value) return '';
  const date = asDate(value);
  if (!date) return '';
  return date.toLocaleString('en-US', formatOptions);
}

export function buildStaffingScheduleMessage({
  staffName = '',
  role = '',
  event = {},
  venueName = '',
  startTime = '',
  endTime = '',
  policy = {},
} = {}) {
  const eventDate = event?.date
    ? formatDisplayDate(`${event.date}T00:00:00`, { month: 'short', day: 'numeric', year: 'numeric' })
    : formatDisplayDate(startTime, { month: 'short', day: 'numeric', year: 'numeric' }) || 'TBD';

  const shift = startTime && endTime
    ? `${formatDisplayDate(startTime, { hour: 'numeric', minute: '2-digit' })}-${formatDisplayDate(endTime, { hour: 'numeric', minute: '2-digit' })}`
    : 'TBD';

  const venue = venueName || event?.venue_name || event?.venue || 'the venue';
  const supervisor = policy?.supervisorName || policy?.supervisor_name || '';
  const supervisorPhone = policy?.supervisorPhone || policy?.supervisor_phone || '';
  const noticeHours = Number(policy?.noticeHours || policy?.notice_hours || 0) || 0;

  const policyLine = supervisor || supervisorPhone || noticeHours
    ? ` If unable to attend, notify ${[supervisor, supervisorPhone].filter(Boolean).join(' ')}${noticeHours ? ` at least ${noticeHours}h prior.` : '.'}`
    : '';

  return `Hi ${staffName || 'there'}, you are scheduled as ${role || 'Crew'} for ${event?.title || 'the event'} on ${eventDate} at ${venue}. Shift: ${shift}. Reply CONFIRM or DECLINE.${policyLine}`.trim();
}

export function buildStaffTimeBlocks(assignments = []) {
  const blocks = new Map();
  (assignments || []).forEach((row) => {
    const start = row.start_time || row.startTime || '';
    const end = row.end_time || row.endTime || '';
    const key = `${start}|${end}`;
    if (!blocks.has(key)) {
      blocks.set(key, { start, end, rows: [] });
    }
    blocks.get(key).rows.push(row);
  });

  return [...blocks.values()].sort((a, b) => {
    const aStart = asDate(a.start)?.getTime() || 0;
    const bStart = asDate(b.start)?.getTime() || 0;
    return aStart - bStart;
  });
}
