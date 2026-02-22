/**
 * Parse a date string (YYYY-MM-DD) as local time, not UTC.
 * Prevents the off-by-one timezone bug where "2026-02-22" displays as Feb 21 in CST.
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  // If it's already a full ISO string with time, just parse it
  if (dateStr.includes('T')) return new Date(dateStr);
  // Date-only string: append T00:00:00 so JS treats it as local, not UTC
  return new Date(dateStr + 'T00:00:00');
}
