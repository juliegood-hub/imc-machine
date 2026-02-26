export const MERCH_PARTY_TYPE_OPTIONS = [
  'venue',
  'band',
  'artist',
  'producer',
  'theater_company',
  'nonprofit',
  'for_profit',
  'booking_agent',
  'management',
  'promoter',
  'vendor',
  'other',
];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value, max = 120) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > max ? text.slice(0, max) : text;
}

export function normalizeMerchAllocations(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const partyTypeRaw = cleanText(row?.partyType || row?.party_type || 'other', 80).toLowerCase();
      const partyType = MERCH_PARTY_TYPE_OPTIONS.includes(partyTypeRaw) ? partyTypeRaw : 'other';
      return {
        partyType,
        percentage: Number(toNumber(row?.percentage, 0).toFixed(2)),
        partyReferenceId: cleanText(row?.partyReferenceId || row?.party_reference_id || '', 120),
        label: cleanText(row?.label || '', 180),
      };
    })
    .filter((row) => row.percentage >= 0);
}

export function calculateMerchAllocationTotal(rows = []) {
  const normalized = normalizeMerchAllocations(rows);
  return Number(normalized.reduce((sum, row) => sum + row.percentage, 0).toFixed(2));
}

export function allocationsTotalIsValid(rows = [], target = 100, tolerance = 0.01) {
  const total = calculateMerchAllocationTotal(rows);
  return Math.abs(total - target) <= tolerance;
}
