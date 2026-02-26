import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStaffingCoverage,
  calculateAssignmentCompensation,
  findStaffAssignmentConflicts,
  normalizeStaffingInboundAction,
  parseVoiceStaffInput,
} from '../src/services/staffing.js';

test('findStaffAssignmentConflicts detects overlaps for same staff profile', () => {
  const existing = [
    {
      id: 'a1',
      staff_profile_id: 'staff-1',
      start_time: '2026-03-10T18:00:00Z',
      end_time: '2026-03-10T22:00:00Z',
    },
    {
      id: 'a2',
      staff_profile_id: 'staff-2',
      start_time: '2026-03-10T18:00:00Z',
      end_time: '2026-03-10T22:00:00Z',
    },
  ];

  const conflicts = findStaffAssignmentConflicts(existing, {
    staffProfileId: 'staff-1',
    startTime: '2026-03-10T21:00:00Z',
    endTime: '2026-03-10T23:00:00Z',
  });

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].id, 'a1');
});

test('calculateAssignmentCompensation computes hourly and flat values', () => {
  const hourly = calculateAssignmentCompensation({
    pay_type: 'hourly',
    pay_override: 20,
    start_time: '2026-03-10T18:00:00Z',
    end_time: '2026-03-10T22:30:00Z',
  });
  assert.equal(hourly.hours, 4.5);
  assert.equal(hourly.estimatedPay, 90);

  const flat = calculateAssignmentCompensation({
    pay_type: 'flat',
    pay_override: 250,
  });
  assert.equal(flat.estimatedPay, 250);
});

test('buildStaffingCoverage returns fill and confirmation stats', () => {
  const coverage = buildStaffingCoverage(
    [
      { job_title: 'Stage Manager', status: 'confirmed' },
      { job_title: 'Audio Engineer (FOH)', status: 'scheduled' },
      { job_title: 'Audio Engineer (FOH)', status: 'declined' },
    ],
    [
      { role: 'Stage Manager', requiredCount: 1 },
      { role: 'Audio Engineer (FOH)', requiredCount: 2 },
    ]
  );

  assert.equal(coverage.rolesRequired, 3);
  assert.equal(coverage.rolesFilled, 3);
  assert.equal(coverage.rolesUnfilled, 0);
  assert.equal(coverage.confirmationRate, 50);
});

test('normalizeStaffingInboundAction parses confirm/decline', () => {
  assert.equal(normalizeStaffingInboundAction('CONFIRM'), 'confirm');
  assert.equal(normalizeStaffingInboundAction('I have to DECLINE this shift'), 'decline');
  assert.equal(normalizeStaffingInboundAction('maybe'), 'unknown');
});

test('parseVoiceStaffInput extracts core profile fields', () => {
  const parsed = parseVoiceStaffInput(
    'John Smith, bartender, $18 per hour, 210-555-1122, john@bar.com',
    ['Bartender', 'Stage Manager']
  );

  assert.equal(parsed.firstName, 'John');
  assert.equal(parsed.lastName, 'Smith');
  assert.equal(parsed.primaryRole, 'Bartender');
  assert.equal(parsed.payType, 'hourly');
  assert.equal(parsed.defaultRate, 18);
  assert.match(parsed.phoneNumber, /210-555-1122/);
  assert.equal(parsed.email, 'john@bar.com');
});
