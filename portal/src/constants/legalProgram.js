export const LEGAL_WORKFLOW_MODES = [
  {
    value: 'cle_full',
    label: 'CLE Compliance + Promotion',
    description: 'Track MCLE/compliance details, enforce distribution approval, and keep legal disclaimers on outbound content.',
  },
  {
    value: 'branding_only',
    label: 'Branding Promotion Only',
    description: 'Use IMC Machine for visibility campaigns only. Compliance capture stays optional.',
  },
];

export const LEGAL_RECONCILIATION_STATUSES = [
  'draft',
  'in_review',
  'ready_to_close',
  'closed',
];

export const LEGAL_DISCLAIMER_TEMPLATES = [
  {
    value: 'none',
    label: 'No disclaimer',
    longText: '',
    shortText: '',
  },
  {
    value: 'cle_education',
    label: 'CLE educational notice',
    longText: 'This program is for general educational information only and does not create an attorney-client relationship. It is not legal advice.',
    shortText: 'Educational only. Not legal advice.',
  },
  {
    value: 'attorney_advertising',
    label: 'Attorney advertising notice',
    longText: 'This communication may be considered attorney advertising in some jurisdictions. No attorney-client relationship is formed by this event notice.',
    shortText: 'May be attorney advertising.',
  },
  {
    value: 'campaign_public',
    label: 'Public legal event notice',
    longText: 'Informational event notice only. Content is not legal advice and does not form an attorney-client relationship.',
    shortText: 'Info only. Not legal advice.',
  },
];

export function normalizeLegalWorkflowMode(value = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized === 'branding_only') return 'branding_only';
  return 'cle_full';
}

export function normalizeLegalDisclaimerTemplate(value = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const allowed = new Set(LEGAL_DISCLAIMER_TEMPLATES.map((item) => item.value));
  if (!allowed.has(normalized)) return 'cle_education';
  return normalized;
}

export function getLegalDisclaimerTemplate(templateValue = '') {
  const normalized = normalizeLegalDisclaimerTemplate(templateValue || 'cle_education');
  return LEGAL_DISCLAIMER_TEMPLATES.find((item) => item.value === normalized) || LEGAL_DISCLAIMER_TEMPLATES[1];
}

export function isLegalProgramGenre(genre = '') {
  return /legal|cle|bar association|law panel/i.test(String(genre || ''));
}

export function getLegalWorkflowDefaults(mode = 'cle_full') {
  const normalizedMode = normalizeLegalWorkflowMode(mode);
  if (normalizedMode === 'branding_only') {
    return {
      legalWorkflowMode: 'branding_only',
      distributionApprovalRequired: false,
      distributionApproved: false,
      includeLegalDisclaimer: true,
      legalDisclaimerTemplate: 'campaign_public',
      mcleStatus: 'Exempt / Informational',
    };
  }
  return {
    legalWorkflowMode: 'cle_full',
    distributionApprovalRequired: true,
    distributionApproved: false,
    includeLegalDisclaimer: true,
    legalDisclaimerTemplate: 'cle_education',
    mcleStatus: '',
  };
}

export function buildLegalDisclaimerText({
  productionDetails = {},
  channelKey = '',
} = {}) {
  const include = productionDetails?.includeLegalDisclaimer === true
    || (productionDetails?.includeLegalDisclaimer !== false
      && (productionDetails?.legalDisclaimerTemplate || productionDetails?.legalDisclaimerCustom));
  if (!include) return '';

  const template = getLegalDisclaimerTemplate(productionDetails?.legalDisclaimerTemplate || 'cle_education');
  const shortChannels = new Set(['sms', 'twitter', 'social_twitter', 'instagram']);
  const prefersShort = shortChannels.has(String(channelKey || '').trim().toLowerCase());
  const templateText = prefersShort ? template.shortText : template.longText;
  const custom = String(productionDetails?.legalDisclaimerCustom || '').trim();
  if (template.value === 'none') return custom;
  return [templateText, custom].filter(Boolean).join(' ').trim();
}

