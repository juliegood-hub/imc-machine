import { createHmac, timingSafeEqual } from 'node:crypto';

const HOUR_MS = 60 * 60 * 1000;

export function normalizeCertificationStatus(expiresAt, options = {}) {
  if (!expiresAt) return 'unknown';
  const now = options.now ? new Date(options.now) : new Date();
  const thresholdDays = Number(options.thresholdDays ?? 30) || 30;
  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime()) || !Number.isFinite(now.getTime())) return 'unknown';
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs < 0) return 'expired';
  const days = diffMs / (24 * HOUR_MS);
  if (days <= thresholdDays) return 'expiring_soon';
  return 'valid';
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

export function signTimeClockToken(payload = {}, secret = '') {
  if (!secret) throw new Error('Secret is required to sign time clock token.');
  const body = {
    bookingId: payload.bookingId || payload.booking_id || '',
    zoneId: payload.zoneId || payload.zone_id || '',
    exp: Number(payload.exp || payload.expiresAt || 0) || 0,
    nonce: payload.nonce || '',
  };
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signature = createHmac('sha256', secret).update(encodedBody).digest('base64url');
  return `${encodedBody}.${signature}`;
}

export function verifyTimeClockToken(token = '', secret = '', options = {}) {
  if (!token || !secret) return { valid: false, reason: 'missing_token_or_secret' };
  const [encodedBody, signature] = String(token).split('.');
  if (!encodedBody || !signature) return { valid: false, reason: 'malformed_token' };
  const expectedSig = createHmac('sha256', secret).update(encodedBody).digest('base64url');
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { valid: false, reason: 'invalid_signature' };
  }
  let payload = null;
  try {
    payload = JSON.parse(base64UrlDecode(encodedBody));
  } catch {
    return { valid: false, reason: 'invalid_payload' };
  }
  const nowEpoch = Number(options.nowEpoch || Math.floor(Date.now() / 1000));
  if (payload.exp && Number(payload.exp) < nowEpoch) {
    return { valid: false, reason: 'expired', payload };
  }
  return { valid: true, payload };
}

function hoursFromRange(start, end, breakMinutes = 0) {
  const s = new Date(start);
  const e = new Date(end);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || e <= s) return 0;
  const diffHours = (e.getTime() - s.getTime()) / HOUR_MS;
  const breakHours = Math.max(0, Number(breakMinutes || 0) / 60);
  return Math.max(0, Number((diffHours - breakHours).toFixed(2)));
}

export function calculatePayrollRows(assignments = [], timeClockShifts = [], options = {}) {
  const shiftByAssignment = new Map(
    (timeClockShifts || [])
      .filter((row) => row?.staff_assignment_id)
      .map((row) => [row.staff_assignment_id, row])
  );

  const rows = (assignments || []).map((assignment) => {
    const staff = assignment.staff_profile || {};
    const payType = String(assignment.pay_type || staff.pay_type || 'hourly').toLowerCase();
    const rate = Number(
      assignment.pay_override ?? assignment.payOverride ?? staff.default_rate ?? staff.defaultRate ?? 0
    ) || 0;
    const timeClock = shiftByAssignment.get(assignment.id) || null;
    const actualHours = timeClock
      ? hoursFromRange(timeClock.actual_check_in, timeClock.actual_check_out, timeClock.break_minutes)
      : 0;
    const scheduledHours = hoursFromRange(assignment.start_time, assignment.end_time, 0);
    const workedHours = actualHours || scheduledHours;

    let grossPay = 0;
    if (payType === 'hourly') grossPay = Number((workedHours * rate).toFixed(2));
    else if (payType === 'flat') grossPay = Number(rate.toFixed(2));
    else grossPay = 0;

    const engagementType = String(staff.engagement_type || '').toLowerCase();
    return {
      staffName: staff.display_name || [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Crew',
      staffProfileId: assignment.staff_profile_id || staff.id || '',
      role: assignment.job_title || staff.primary_role || 'Crew',
      bookingId: assignment.booking_id || '',
      date: assignment.start_time ? String(assignment.start_time).slice(0, 10) : '',
      hours: workedHours,
      rate,
      grossPay,
      payType,
      engagementType,
      status: assignment.status || '',
      notes: assignment.notes || '',
      quickbooksVendorId: staff.quickbooks_vendor_id || staff.quickbooks_ref || '',
      employeeId: staff.employee_external_id || '',
      externalTransactionId: options.externalTransactionId || '',
    };
  });

  const summary = rows.reduce((acc, row) => {
    acc.totalHours += Number(row.hours || 0);
    acc.totalGross += Number(row.grossPay || 0);
    if (row.payType === 'volunteer' || row.payType === 'intern' || ['volunteer', 'intern'].includes(row.engagementType)) {
      acc.volunteerHours += Number(row.hours || 0);
    }
    return acc;
  }, { totalHours: 0, totalGross: 0, volunteerHours: 0 });

  summary.totalHours = Number(summary.totalHours.toFixed(2));
  summary.totalGross = Number(summary.totalGross.toFixed(2));
  summary.volunteerHours = Number(summary.volunteerHours.toFixed(2));
  return { rows, summary };
}

export function buildPayrollCsv(rows = []) {
  const header = [
    'staff_name',
    'role',
    'booking_id',
    'date',
    'hours',
    'rate',
    'gross_pay',
    'pay_type',
    'engagement_type',
    'status',
    'notes',
    'quickbooks_vendor_id',
    'employee_id',
    'external_transaction_id',
  ];
  const escapeCell = (value) => {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [header.join(',')];
  (rows || []).forEach((row) => {
    lines.push([
      row.staffName,
      row.role,
      row.bookingId,
      row.date,
      row.hours,
      row.rate,
      row.grossPay,
      row.payType,
      row.engagementType,
      row.status,
      row.notes,
      row.quickbooksVendorId,
      row.employeeId,
      row.externalTransactionId,
    ].map(escapeCell).join(','));
  });
  return lines.join('\n');
}

export function validateEmergencyContacts(assignments = [], contacts = [], options = {}) {
  const allowOverride = options.allowOverride === true;
  const primaryByProfile = new Map();
  (contacts || []).forEach((contact) => {
    if (!contact?.staff_profile_id) return;
    if (contact.is_primary) {
      primaryByProfile.set(contact.staff_profile_id, contact);
    } else if (!primaryByProfile.has(contact.staff_profile_id)) {
      primaryByProfile.set(contact.staff_profile_id, contact);
    }
  });

  const missing = [];
  (assignments || []).forEach((assignment) => {
    const profileId = assignment.staff_profile_id;
    if (!profileId) return;
    if (!primaryByProfile.has(profileId)) {
      const staff = assignment.staff_profile || {};
      missing.push({
        staffProfileId: profileId,
        staffName: staff.display_name || [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Staff',
      });
    }
  });

  return {
    ok: missing.length === 0 || allowOverride,
    missing,
    warning: missing.length && allowOverride
      ? 'Emergency contact override enabled. Missing primary contacts for one or more assigned staff.'
      : '',
  };
}

export function summarizeVolunteerHours(rows = []) {
  const volunteerRows = (rows || []).filter((row) => (
    row.payType === 'volunteer'
    || row.payType === 'intern'
    || ['volunteer', 'intern'].includes(String(row.engagementType || '').toLowerCase())
  ));
  const byPerson = new Map();
  volunteerRows.forEach((row) => {
    const key = row.staffProfileId || row.staffName;
    const current = byPerson.get(key) || {
      staffProfileId: row.staffProfileId || '',
      staffName: row.staffName || 'Volunteer',
      hours: 0,
      events: new Set(),
    };
    current.hours += Number(row.hours || 0);
    if (row.bookingId) current.events.add(row.bookingId);
    byPerson.set(key, current);
  });
  const entries = [...byPerson.values()].map((entry) => ({
    staffProfileId: entry.staffProfileId,
    staffName: entry.staffName,
    hours: Number(entry.hours.toFixed(2)),
    eventCount: entry.events.size,
  })).sort((a, b) => b.hours - a.hours);
  return {
    entries,
    totalHours: Number(entries.reduce((sum, row) => sum + row.hours, 0).toFixed(2)),
  };
}
