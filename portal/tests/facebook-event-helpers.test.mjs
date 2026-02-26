import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const { __test__ } = await import('../api/distribute.js');

test('resolveFacebookGraphVersion returns env-compatible version strings', () => {
  assert.equal(__test__.resolveFacebookGraphVersion({ graphVersion: 'v25.0' }), 'v25.0');
  assert.equal(__test__.resolveFacebookGraphVersion({ graphVersion: '25.0' }), 'v25.0');
  assert.equal(__test__.resolveFacebookGraphVersion({ graphVersion: 'v1' }), 'v25.0');
});

test('buildFacebookEventFingerprint is deterministic and sensitive to core fields', () => {
  const event = {
    title: 'Jazz Jam Thursdays',
    date: '2026-03-05',
    time: '8:00 PM',
    venue: 'The Dakota East Side Ice House',
    venueAddress: '433 S. Hackberry St',
    venueCity: 'San Antonio',
    venueState: 'TX',
  };
  const venue = { name: event.venue, address: event.venueAddress, city: event.venueCity, state: event.venueState };
  const a = __test__.buildFacebookEventFingerprint(event, venue, '123');
  const b = __test__.buildFacebookEventFingerprint(event, venue, '123');
  const c = __test__.buildFacebookEventFingerprint({ ...event, time: '9:00 PM' }, venue, '123');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('shouldFallbackFromFacebookEventError detects capability-style failures', () => {
  assert.equal(__test__.shouldFallbackFromFacebookEventError({ code: 3, message: 'Capability not available' }), true);
  assert.equal(__test__.shouldFallbackFromFacebookEventError({ code: 200, message: 'Permissions error' }), true);
  assert.equal(__test__.shouldFallbackFromFacebookEventError({ code: 190, message: 'Invalid OAuth 2.0 Access Token' }), false);
});

test('buildFacebookEventSchedule normalizes time into local datetime strings', () => {
  const schedule = __test__.buildFacebookEventSchedule({
    date: '2026-03-12',
    time: '8 PM',
    endTime: '11:00 PM',
  });
  assert.equal(schedule.startLocal, '2026-03-12T20:00:00');
  assert.equal(schedule.endLocal, '2026-03-12T23:00:00');
  assert.equal(schedule.timezone, 'America/Chicago');
});

test('extractFacebookEventId pulls numeric event id from common URL forms', () => {
  assert.equal(__test__.extractFacebookEventId('https://www.facebook.com/events/904680625885045/'), '904680625885045');
  assert.equal(__test__.extractFacebookEventId('https://facebook.com/events/1177269011279455?ref=notif'), '1177269011279455');
  assert.equal(__test__.extractFacebookEventId('https://www.facebook.com/events/s/satx-arts-night/1177269011279455/'), '1177269011279455');
  assert.equal(__test__.extractFacebookEventId('https://www.facebook.com/events/?event_id=1177269011279455'), '1177269011279455');
  assert.equal(__test__.extractFacebookEventId('https://example.com/nope'), null);
});
