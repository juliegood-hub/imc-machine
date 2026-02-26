import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deprecatedRoleAliasMap,
  getPermissionDisplayName,
  getRoleDisplayName,
  isBookingAgentRole,
  isStaffSchedulingRole,
  normalizeRoleAlias,
} from '../src/constants/terminology.js';

test('normalizeRoleAlias maps legacy staffing terms to staff_scheduler', () => {
  assert.equal(normalizeRoleAlias('booking_operations'), 'staff_scheduler');
  assert.equal(normalizeRoleAlias('booking_staff'), 'staff_scheduler');
  assert.equal(normalizeRoleAlias('booking_scheduler'), 'staff_scheduler');
  assert.equal(deprecatedRoleAliasMap.booking_operations, 'staff_scheduler');
});

test('getRoleDisplayName returns Booking Agent and Staff Scheduler labels', () => {
  assert.equal(getRoleDisplayName('booking_manager'), 'Booking Agent');
  assert.equal(getRoleDisplayName('booking_agent'), 'Booking Agent');
  assert.equal(getRoleDisplayName('booking_operations'), 'Staff Scheduler');
  assert.equal(getRoleDisplayName('staff_scheduler'), 'Staff Scheduler');
});

test('role helpers detect booking agent and staff scheduler roles', () => {
  assert.equal(isBookingAgentRole('booking_manager'), true);
  assert.equal(isBookingAgentRole('booking_agent'), true);
  assert.equal(isStaffSchedulingRole('booking_operations'), true);
  assert.equal(isStaffSchedulingRole('staff_scheduler'), true);
});

test('getPermissionDisplayName maps known permission labels', () => {
  assert.equal(getPermissionDisplayName('manage_staff_assignments'), 'Staff Scheduler Access');
  assert.equal(getPermissionDisplayName('manage_event_booking'), 'Booking Agent Access');
  assert.equal(getPermissionDisplayName('custom_permission_key'), 'custom_permission_key');
});
