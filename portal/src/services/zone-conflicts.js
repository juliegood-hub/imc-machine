function toDate(value) {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const aS = toDate(aStart);
  const aE = toDate(aEnd);
  const bS = toDate(bStart);
  const bE = toDate(bEnd);
  if (!aS || !aE || !bS || !bE) return false;
  return aS < bE && bS < aE;
}

export function findZoneBookingConflicts(events = [], candidate = {}) {
  const zoneId = candidate.zoneId || candidate.performance_zone_id || candidate.performanceZoneId;
  const startAt = candidate.startAt || candidate.booking_start_at || candidate.bookingStartAt;
  const endAt = candidate.endAt || candidate.booking_end_at || candidate.bookingEndAt;
  const excludeEventId = candidate.excludeEventId || candidate.eventId;

  if (!zoneId || !startAt || !endAt) return [];

  return (events || []).filter((event) => {
    const eventZoneId = event.performance_zone_id || event.performanceZoneId;
    const bookingStart = event.booking_start_at || event.bookingStartAt;
    const bookingEnd = event.booking_end_at || event.bookingEndAt;
    const eventId = event.id;
    if (!eventZoneId || eventZoneId !== zoneId) return false;
    if (!bookingStart || !bookingEnd) return false;
    if (excludeEventId && eventId === excludeEventId) return false;
    return rangesOverlap(startAt, endAt, bookingStart, bookingEnd);
  });
}

export function hasZoneConflict(events = [], candidate = {}) {
  return findZoneBookingConflicts(events, candidate).length > 0;
}

export function formatZoneConflictSummary(conflicts = []) {
  if (!conflicts.length) return '';
  return conflicts.slice(0, 3).map((event) => {
    const start = event.booking_start_at || event.bookingStartAt || '';
    const end = event.booking_end_at || event.bookingEndAt || '';
    return `${event.title || 'Untitled Event'} (${start} - ${end})`;
  }).join('; ');
}
