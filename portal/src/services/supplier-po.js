export const SUPPLIER_TYPE_OPTIONS = [
  { value: 'local_store', label: 'Local Store' },
  { value: 'online_store', label: 'Online Store' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'rental_house', label: 'Rental House' },
  { value: 'service_vendor', label: 'Service Vendor' },
];

export const DEFAULT_SUPPLIER_SUGGESTIONS = [
  { name: 'Amazon', supplierType: 'online_store', websiteUrl: 'https://www.amazon.com', orderingUrl: 'https://www.amazon.com', notes: 'General online purchasing.' },
  { name: 'Costco', supplierType: 'local_store', websiteUrl: 'https://www.costco.com', orderingUrl: 'https://www.costco.com' },
  { name: 'Best Buy', supplierType: 'local_store', websiteUrl: 'https://www.bestbuy.com', orderingUrl: 'https://www.bestbuy.com' },
  { name: 'Office Depot', supplierType: 'local_store', websiteUrl: 'https://www.officedepot.com', orderingUrl: 'https://www.officedepot.com' },
  { name: 'B&H Photo Video', supplierType: 'distributor', websiteUrl: 'https://www.bhphotovideo.com', orderingUrl: 'https://www.bhphotovideo.com' },
  { name: 'Sweetwater', supplierType: 'online_store', websiteUrl: 'https://www.sweetwater.com', orderingUrl: 'https://www.sweetwater.com' },
  { name: 'Home Depot', supplierType: 'local_store', websiteUrl: 'https://www.homedepot.com', orderingUrl: 'https://www.homedepot.com' },
  { name: "Lowe's", supplierType: 'local_store', websiteUrl: 'https://www.lowes.com', orderingUrl: 'https://www.lowes.com' },
];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toMoney(value) {
  const parsed = toNumber(value, 0);
  return Math.round(parsed * 100) / 100;
}

function cleanText(value, max = 500) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > max ? text.slice(0, max) : text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizePoItem(raw = {}, defaults = {}) {
  const quantity = Math.max(0, toNumber(raw.quantity, 1));
  const unitCost = Math.max(0, toNumber(raw.unitCost ?? raw.unit_cost, 0));
  const lineTotal = toMoney(quantity * unitCost);
  return {
    inventoryItemId: cleanText(raw.inventoryItemId ?? raw.inventory_item_id, 120),
    label: cleanText(raw.label || raw.name || raw.item_name || '', 220),
    quantity,
    unit: cleanText(raw.unit || 'ea', 20) || 'ea',
    unitCost: toMoney(unitCost),
    lineTotal,
    supplierId: cleanText(raw.supplierId ?? raw.supplier_id ?? defaults.supplierId ?? '', 120),
    supplierSku: cleanText(raw.supplierSku ?? raw.supplier_sku ?? '', 180),
    supplierItemUrl: cleanText(raw.supplierItemUrl ?? raw.supplier_item_url ?? '', 1000),
    notes: cleanText(raw.notes || '', 2000),
  };
}

export function normalizePoItems(items = [], defaults = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizePoItem(item, defaults))
    .filter((item) => item.label);
}

export function formatSupplierAddress(supplier = {}) {
  const line1 = cleanText(supplier.address_line1 ?? supplier.addressLine1, 220);
  const line2 = cleanText(supplier.address_line2 ?? supplier.addressLine2, 220);
  const city = cleanText(supplier.city, 120);
  const state = cleanText(supplier.state, 60);
  const postalCode = cleanText(supplier.postal_code ?? supplier.postalCode, 40);
  const country = cleanText(supplier.country, 60);
  const cityLine = [city, state, postalCode].filter(Boolean).join(', ');
  return [line1, line2, cityLine, country].filter(Boolean).join('\n');
}

export function groupPoItemsBySupplier(items = [], suppliersById = new Map()) {
  const normalized = normalizePoItems(items);
  const groupsMap = new Map();
  const unassigned = [];

  normalized.forEach((item) => {
    if (!item.supplierId) {
      unassigned.push(item);
      return;
    }
    const supplier = suppliersById.get(item.supplierId) || {};
    const existing = groupsMap.get(item.supplierId) || {
      supplierId: item.supplierId,
      supplierName: cleanText(supplier.supplier_name ?? supplier.supplierName ?? supplier.name, 220) || 'Supplier',
      supplierEmail: cleanText(supplier.email, 240),
      orderingUrl: cleanText(supplier.ordering_url ?? supplier.orderingUrl ?? supplier.website_url ?? supplier.websiteUrl, 1000),
      supplierAddress: formatSupplierAddress(supplier),
      items: [],
      totalAmount: 0,
    };
    existing.items.push(item);
    existing.totalAmount = toMoney(existing.totalAmount + item.lineTotal);
    groupsMap.set(item.supplierId, existing);
  });

  const groups = Array.from(groupsMap.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  return { groups, unassigned };
}

function formatDateForSubject(inputDate) {
  const date = inputDate ? new Date(inputDate) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function buildPurchaseOrderEmailSubject({ venueName = '', supplierName = '', date } = {}) {
  const safeVenue = cleanText(venueName, 180) || 'Venue';
  const safeSupplier = cleanText(supplierName, 180) || 'Supplier';
  return `Purchase Order - ${safeVenue} - ${safeSupplier} - ${formatDateForSubject(date)}`;
}

export function buildPurchaseOrderEmailBody({
  venue = {},
  supplier = {},
  items = [],
  deliveryInstructions = '',
  receivingHours = '',
  dockNotes = '',
  purchaserName = '',
  purchaserEmail = '',
} = {}) {
  const safeItems = normalizePoItems(items);
  const supplierName = cleanText(supplier.supplier_name ?? supplier.supplierName ?? supplier.name, 220) || 'Supplier';
  const supplierAddress = formatSupplierAddress(supplier);
  const website = cleanText(supplier.website_url ?? supplier.websiteUrl, 1000);
  const orderingUrl = cleanText(supplier.ordering_url ?? supplier.orderingUrl, 1000);
  const venueName = cleanText(venue.name ?? venue.venue_name, 220) || 'Venue';
  const venueAddress = cleanText(venue.address ?? venue.venue_address, 320);
  const lines = [];
  lines.push(`Supplier: ${supplierName}`);
  if (supplierAddress) lines.push(`Address:\n${supplierAddress}`);
  if (website) lines.push(`Website: ${website}`);
  if (orderingUrl) lines.push(`Ordering URL: ${orderingUrl}`);
  lines.push('');
  lines.push('Items:');
  safeItems.forEach((item, index) => {
    const sku = item.supplierSku ? ` | SKU: ${item.supplierSku}` : '';
    const url = item.supplierItemUrl ? ` | URL: ${item.supplierItemUrl}` : '';
    const unitCost = item.unitCost ? ` | Unit: $${item.unitCost.toFixed(2)}` : '';
    lines.push(`${index + 1}. ${item.label} | Qty: ${item.quantity} ${item.unit}${unitCost}${sku}${url}`);
  });
  lines.push('');
  lines.push(`Deliver To: ${venueName}${venueAddress ? `, ${venueAddress}` : ''}`);
  if (deliveryInstructions) lines.push(`Delivery Instructions: ${cleanText(deliveryInstructions, 2000)}`);
  if (receivingHours) lines.push(`Receiving Hours: ${cleanText(receivingHours, 400)}`);
  if (dockNotes) lines.push(`Dock Notes: ${cleanText(dockNotes, 1000)}`);
  lines.push('');
  lines.push(`Questions: ${cleanText(purchaserName, 180) || 'Purchasing Contact'}${purchaserEmail ? ` (${cleanText(purchaserEmail, 240)})` : ''}`);
  return lines.join('\n');
}

export function buildPurchaseOrderEmailHtml(options = {}) {
  const body = buildPurchaseOrderEmailBody(options);
  return `<pre style="font-family: Inter, Helvetica, Arial, sans-serif; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(body)}</pre>`;
}
