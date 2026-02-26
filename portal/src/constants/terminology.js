export const deprecatedRoleAliasMap = {
  booking_operations: 'staff_scheduler',
  booking_staff: 'staff_scheduler',
  booking_scheduler: 'staff_scheduler',
  staffing_scheduler: 'staff_scheduler',
  booking_manager: 'booking_agent',
};

export const roleDisplayNameMap = {
  booking_agent: 'Booking Agent',
  booking_manager: 'Booking Agent',
  staff_scheduler: 'Staff Scheduler',
  booking_operations: 'Staff Scheduler',
  booking_staff: 'Staff Scheduler',
  booking_scheduler: 'Staff Scheduler',
};

export const permissionDisplayNameMap = {
  manage_bookings: 'Booking Agent Access',
  manage_booking_calendar: 'Booking Agent Access',
  manage_event_booking: 'Booking Agent Access',
  manage_staffing: 'Staff Scheduler Access',
  manage_staff_assignments: 'Staff Scheduler Access',
  publish_staffing_schedule: 'Staff Scheduler Access',
  view_staffing_dashboard: 'Staff Scheduler Access',
};

export function normalizeRoleAlias(roleKey = '') {
  const normalized = String(roleKey || '').trim().toLowerCase();
  if (!normalized) return '';
  return deprecatedRoleAliasMap[normalized] || normalized;
}

export function getRoleDisplayName(roleKeyOrLabel = '') {
  const normalized = String(roleKeyOrLabel || '').trim();
  if (!normalized) return '';
  const key = normalizeRoleAlias(normalized);
  return roleDisplayNameMap[key] || roleDisplayNameMap[normalized.toLowerCase()] || normalized;
}

export function getPermissionDisplayName(permissionKeyOrLabel = '') {
  const normalized = String(permissionKeyOrLabel || '').trim();
  if (!normalized) return '';
  const key = normalized.toLowerCase();
  return permissionDisplayNameMap[key] || normalized;
}

export function isStaffSchedulingRole(roleKey = '') {
  const normalized = normalizeRoleAlias(roleKey);
  return normalized === 'staff_scheduler';
}

export function isBookingAgentRole(roleKey = '') {
  const normalized = normalizeRoleAlias(roleKey);
  return normalized === 'booking_agent';
}
