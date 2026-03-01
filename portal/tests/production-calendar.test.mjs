import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CALENDAR_EVENT_TYPES,
  buildCalendarEntryTitle,
  calculateEndIso,
  filterEntriesByView,
  normalizeCalendarTypeKey,
  normalizeReminderSettings,
} from '../src/services/production-calendar.js';

test('normalizeCalendarTypeKey keeps predictable keys', () => {
  assert.equal(normalizeCalendarTypeKey('Cue-to-Cue'), 'cue_to_cue');
  assert.equal(normalizeCalendarTypeKey('  Load-In  '), 'load_in');
});

test('calculateEndIso offsets from start by duration minutes', () => {
  const end = calculateEndIso('2026-03-03T19:00:00.000Z', 90);
  assert.equal(end, '2026-03-03T20:30:00.000Z');
});

test('filterEntriesByView returns only same-day entries in day mode', () => {
  const entries = [
    { id: 'a', start_datetime: '2026-03-01T18:00:00.000Z' },
    { id: 'b', start_datetime: '2026-03-02T07:00:00.000Z' },
  ];
  const filtered = filterEntriesByView(entries, {
    viewMode: 'day',
    anchorDate: '2026-03-01',
    timezone: 'America/Chicago',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'a');
});

test('buildCalendarEntryTitle composes type and event names', () => {
  assert.equal(
    buildCalendarEntryTitle({ typeName: 'Soundcheck', eventTitle: 'Jazz Jam Thursdays' }),
    'Soundcheck · Jazz Jam Thursdays'
  );
  assert.equal(buildCalendarEntryTitle({ eventTitle: 'Jazz Jam Thursdays' }), 'Jazz Jam Thursdays');
});

test('normalizeReminderSettings keeps positive unique numbers', () => {
  assert.deepEqual(normalizeReminderSettings([1440, '120', 120, 0, -5, 30]), [1440, 120, 30]);
  assert.deepEqual(normalizeReminderSettings('bad'), [1440, 120, 30]);
});

test('default calendar templates include key production lingo', () => {
  const names = DEFAULT_CALENDAR_EVENT_TYPES.map((entry) => entry.name);
  assert.equal(names.includes('Cue-to-Cue'), true);
  assert.equal(names.includes('Dry Tech'), true);
  assert.equal(names.includes('Load-In'), true);
});
