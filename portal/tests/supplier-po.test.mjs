import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPurchaseOrderEmailBody,
  buildPurchaseOrderEmailSubject,
  groupPoItemsBySupplier,
} from '../src/services/supplier-po.js';

test('groupPoItemsBySupplier groups items by supplier and leaves unassigned rows', () => {
  const suppliersById = new Map([
    ['sup-a', { id: 'sup-a', supplier_name: 'Alpha Supply', email: 'orders@alpha.com' }],
    ['sup-b', { id: 'sup-b', supplier_name: 'Bravo Supply', email: 'orders@bravo.com' }],
  ]);
  const input = [
    { label: 'Gaffer Tape', quantity: 2, unitCost: 12.5, supplierId: 'sup-a' },
    { label: 'XLR Cable', quantity: 4, unitCost: 20, supplierId: 'sup-b' },
    { label: 'Sharpies', quantity: 1, unitCost: 8.99 },
  ];

  const grouped = groupPoItemsBySupplier(input, suppliersById);
  assert.equal(grouped.groups.length, 2);
  assert.equal(grouped.unassigned.length, 1);
  assert.equal(grouped.groups.find((group) => group.supplierId === 'sup-a').items.length, 1);
  assert.equal(grouped.groups.find((group) => group.supplierId === 'sup-b').items[0].lineTotal, 80);
});

test('buildPurchaseOrderEmailSubject uses venue and supplier names', () => {
  const subject = buildPurchaseOrderEmailSubject({
    venueName: 'The Carver',
    supplierName: 'Alpha Supply',
    date: '2026-03-02T12:00:00Z',
  });
  assert.match(subject, /Purchase Order - The Carver - Alpha Supply - 2026-03-02/);
});

test('buildPurchaseOrderEmailBody includes supplier, itemized lines, and delivery details', () => {
  const body = buildPurchaseOrderEmailBody({
    venue: { name: 'Carver Theater', address: '226 N Hackberry, San Antonio, TX' },
    supplier: { supplier_name: 'Stage Depot', website_url: 'https://example.com' },
    items: [
      { label: 'Lighting Gel', quantity: 3, unit: 'pack', unitCost: 15, supplierSku: 'GEL-15', supplierItemUrl: 'https://example.com/gel' },
    ],
    deliveryInstructions: 'Deliver to stage door',
    receivingHours: '10am-4pm',
    dockNotes: 'Use loading dock B',
    purchaserName: 'Ops Manager',
    purchaserEmail: 'ops@example.com',
  });

  assert.match(body, /Supplier: Stage Depot/);
  assert.match(body, /Lighting Gel/);
  assert.match(body, /SKU: GEL-15/);
  assert.match(body, /https:\/\/example.com\/gel/);
  assert.match(body, /Deliver to stage door/);
  assert.match(body, /Use loading dock B/);
  assert.match(body, /Ops Manager/);
});
