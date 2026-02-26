import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rangesOverlap,
  findZoneBookingConflicts,
  hasZoneConflict,
  formatZoneConflictSummary,
} from '../src/services/zone-conflicts.js';

const sampleEvents = [
  {
    id: 'evt-1',
    title: 'Soundcheck',
    performanceZoneId: 'zone-a',
    bookingStartAt: '2026-03-10T18:00:00Z',
    bookingEndAt: '2026-03-10T20:00:00Z',
  },
  {
    id: 'evt-2',
    title: 'Main Set',
    performanceZoneId: 'zone-b',
    bookingStartAt: '2026-03-10T19:00:00Z',
    bookingEndAt: '2026-03-10T22:00:00Z',
  },
];

test('rangesOverlap handles overlap and boundary conditions', () => {
  assert.equal(rangesOverlap('2026-03-10T18:00:00Z', '2026-03-10T19:00:00Z', '2026-03-10T18:30:00Z', '2026-03-10T19:30:00Z'), true);
  assert.equal(rangesOverlap('2026-03-10T18:00:00Z', '2026-03-10T19:00:00Z', '2026-03-10T19:00:00Z', '2026-03-10T20:00:00Z'), false);
});

test('findZoneBookingConflicts only flags overlaps in the same zone', () => {
  const conflicts = findZoneBookingConflicts(sampleEvents, {
    zoneId: 'zone-a',
    startAt: '2026-03-10T19:15:00Z',
    endAt: '2026-03-10T20:15:00Z',
  });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].id, 'evt-1');
});

test('different zones can run simultaneously', () => {
  const conflicts = findZoneBookingConflicts(sampleEvents, {
    zoneId: 'zone-c',
    startAt: '2026-03-10T19:15:00Z',
    endAt: '2026-03-10T20:15:00Z',
  });
  assert.equal(conflicts.length, 0);
});

test('excludeEventId skips self during update checks', () => {
  const conflicts = findZoneBookingConflicts(sampleEvents, {
    zoneId: 'zone-a',
    startAt: '2026-03-10T18:30:00Z',
    endAt: '2026-03-10T19:30:00Z',
    excludeEventId: 'evt-1',
  });
  assert.equal(conflicts.length, 0);
});

test('hasZoneConflict and formatZoneConflictSummary provide quick feedback', () => {
  const candidate = {
    zoneId: 'zone-a',
    startAt: '2026-03-10T18:15:00Z',
    endAt: '2026-03-10T19:15:00Z',
  };
  assert.equal(hasZoneConflict(sampleEvents, candidate), true);
  const summary = formatZoneConflictSummary(findZoneBookingConflicts(sampleEvents, candidate));
  assert.match(summary, /Soundcheck/);
});
