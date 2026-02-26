import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMerchAllocations,
  calculateMerchAllocationTotal,
  allocationsTotalIsValid,
} from '../src/services/merch-revenue.js';

test('normalizeMerchAllocations keeps valid party types and normalizes percentages', () => {
  const rows = normalizeMerchAllocations([
    { partyType: 'venue', percentage: '55.555' },
    { partyType: 'artist', percentage: 44.444 },
    { partyType: 'unknown_value', percentage: 0.001 },
  ]);

  assert.equal(rows.length, 3);
  assert.equal(rows[0].partyType, 'venue');
  assert.equal(rows[0].percentage, 55.55);
  assert.equal(rows[1].percentage, 44.44);
  assert.equal(rows[2].partyType, 'other');
});

test('calculateMerchAllocationTotal computes rounded totals', () => {
  const total = calculateMerchAllocationTotal([
    { partyType: 'venue', percentage: 60 },
    { partyType: 'artist', percentage: 40 },
  ]);
  assert.equal(total, 100);
});

test('allocationsTotalIsValid enforces 100% split', () => {
  assert.equal(allocationsTotalIsValid([
    { partyType: 'venue', percentage: 50 },
    { partyType: 'artist', percentage: 50 },
  ]), true);

  assert.equal(allocationsTotalIsValid([
    { partyType: 'venue', percentage: 70 },
    { partyType: 'artist', percentage: 20 },
  ]), false);
});
