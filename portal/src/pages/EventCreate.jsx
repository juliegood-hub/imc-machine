import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import CompletionBar from '../components/CompletionBar';
import SponsorEditor from '../components/SponsorEditor';
import FormAIAssist from '../components/FormAIAssist';
import DeepResearchPromptBox from '../components/DeepResearchPromptBox';
import { extractFromImages, extractionToEventForm, openCamera, openFileUpload } from '../services/photo-to-form';
import { deepResearchDraft } from '../services/research';
import {
  THEATER_GENRE_KEY,
  THEATER_DEPARTMENTS,
  THEATER_ROLES_BY_DEPARTMENT,
  THEATER_ROLE_OPTIONS,
  getTheaterDepartmentForRole,
  findNearestTheaterRole,
} from '../constants/theaterRoles';
import { SHOW_TYPE_OPTIONS, SHOW_TEMPLATE_OPTIONS, buildShowConfigurationDefaults } from '../constants/productionLibrary';
import { findZoneBookingConflicts, formatZoneConflictSummary } from '../services/zone-conflicts';
import { isArtistRole, isVenueRole } from '../constants/clientTypes';
import {
  LEGAL_WORKFLOW_MODES,
  LEGAL_RECONCILIATION_STATUSES,
  LEGAL_DISCLAIMER_TEMPLATES,
  normalizeLegalWorkflowMode,
  normalizeLegalDisclaimerTemplate,
  getLegalWorkflowDefaults,
  getLegalDisclaimerTemplate,
} from '../constants/legalProgram';

const LEGAL_CLE_GENRE_KEY = 'Legal CLE | Law Panels | Bar Association Events';
const ARTISAN_GENRE_KEY = 'Visual Art | Artisan | Gallery | Craft Shows';

const GENRES = [
  { key: THEATER_GENRE_KEY, icon: '🎭', color: '#8B5CF6', desc: 'Plays, musicals, theatrical performances' },
  { key: 'Acting Gigs | Character Performance | Seasonal', icon: '🏛️', color: '#DC2626', desc: 'Character actors, holiday Santa gigs, mascots, themed appearances' },
  { key: 'Live Music | Contemporary | Jazz | Electronic | Indie', icon: '🎵', color: '#EC4899', desc: 'Concerts, bands, DJs, live music' },
  { key: 'Orchestral | Classical | Choral', icon: '🎻', color: '#3B82F6', desc: 'Orchestra, symphony, choir' },
  { key: ARTISAN_GENRE_KEY, icon: '🖼️', color: '#D97706', desc: 'Painting, sculpture, ceramics, jewelry, woodworking, artisan showcases' },
  { key: 'Literary | Poetry | Book Signings', icon: '📚', color: '#7C3AED', desc: 'Book signings, poetry readings, author talks, literary events' },
  { key: LEGAL_CLE_GENRE_KEY, icon: '⚖️', color: '#1E40AF', desc: 'CLE seminars, legal panels, bar events, law-focused speaking events' },
  { key: 'Politics | Civic | Campaign Events', icon: '🗳️', color: '#2563EB', desc: 'Campaign launches, civic forums, policy events, candidate meet-and-greets' },
  { key: 'Comedy | Speaking | Lectures | Workshops', icon: '🎤', color: '#F59E0B', desc: 'Comedy, talks, workshops, panels' },
  { key: 'Dance | Performance Art | Experimental', icon: '💃', color: '#10B981', desc: 'Dance, movement theater, and live performance art' },
];

const GENRE_ROLES = {
  [THEATER_GENRE_KEY]: THEATER_ROLE_OPTIONS,
  'Acting Gigs | Character Performance | Seasonal': ['Actor', 'Character Performer', 'Santa Claus Performer', 'Mrs. Claus Performer', 'Holiday Elves', 'Host/Emcee', 'Stage Manager', 'Wardrobe', 'Photographer'],
  'Live Music | Contemporary | Jazz | Electronic | Indie': ['Lead Vocalist', 'Guitarist', 'Bassist', 'Drummer', 'Keyboardist', 'Saxophonist', 'DJ', 'Music Producer', 'Tour Manager', 'Backing Vocalist'],
  'Orchestral | Classical | Choral': ['Conductor', 'Concertmaster', 'Choir Director', 'Music Director', 'Guest Soloist', 'Soprano', 'Alto', 'Tenor', 'Baritone'],
  [ARTISAN_GENRE_KEY]: ['Painter', 'Sculptor', 'Ceramicist', 'Potter', 'Printmaker', 'Illustrator', 'Drawer / Draftsperson', 'Jewelry Artist', 'Woodworker', 'Metalworker', 'Mixed Media Artist', 'Installation Artist', 'Photographer', 'Gallery Curator', 'Art Handler', 'Exhibition Installer', 'Art Fair Coordinator', 'Studio Assistant', 'Fabricator', 'Mural Artist'],
  'Literary | Poetry | Book Signings': ['Author', 'Poet', 'Spoken Word Artist', 'Moderator', 'Interviewer', 'Editor', 'Publisher', 'Bookseller', 'Host/Emcee'],
  [LEGAL_CLE_GENRE_KEY]: ['Attorney', 'Trial Lawyer', 'General Counsel', 'District Attorney Candidate', 'Assistant District Attorney', 'Judge', 'Law Professor', 'CLE Presenter', 'CLE Moderator', 'Panelist', 'Bar Association Host', 'MCLE Coordinator', 'Legal Aid Director', 'Policy Counsel', 'Compliance Officer'],
  'Politics | Civic | Campaign Events': ['Candidate for Office', 'Incumbent Officeholder', 'Campaign Manager', 'Field Director', 'Policy Director', 'Press Secretary', 'Volunteer Coordinator', 'Fundraising Chair', 'District Attorney Candidate', 'Judge Candidate', 'County Clerk Candidate', 'City Council Candidate', 'County Commissioner Candidate', 'State House Candidate', 'State Senate Candidate', 'Congressional Candidate', 'Moderator', 'Host/Emcee'],
  'Comedy | Speaking | Lectures | Workshops': ['Comedian/Comic', 'Host/Emcee', 'Keynote Speaker', 'Panelist', 'Moderator', 'Workshop Facilitator', 'Opening Act', 'Headliner', 'Candidate for Office', 'Campaign Manager', 'District Attorney Candidate', 'Judge Candidate', 'County Clerk Candidate'],
  'Dance | Performance Art | Experimental': ['Choreographer', 'Lead Dancer', 'Performance Artist', 'Movement Director', 'Aerialist', 'Puppeteer'],
};

const UNIVERSAL_ROLES = [
  'Producer', 'Stage Manager', 'Technical Director', 'Sound Engineer', 'Lighting Designer', 'Photographer', 'Videographer',
  // Client type roles
  'Venue Owner', 'Venue Manager', 'Venue Marketing', 'Venue Staff',
  'Artist', 'Promoter', 'Artist Manager', 'Booking Agent', 'DJ',
  'Media/Press', 'Sponsor/Partner'
];

const CHANNELS = [
  { key: 'press', label: 'Press Releases', icon: '📰', desc: '16+ SA media contacts' },
  { key: 'social', label: 'Social Media', icon: '📱', desc: 'Facebook, Instagram, Twitter/X' },
  { key: 'calendar', label: 'Calendar Listings', icon: '📅', desc: 'Do210, SA Current, Evvnt' },
  { key: 'eventbrite', label: 'Eventbrite', icon: '🎟️', desc: 'Event page & ticketing' },
  { key: 'facebook', label: 'Facebook Events', icon: '👤', desc: 'Auto-create FB event' },
  { key: 'email', label: 'Email Newsletter', icon: '✉️', desc: 'Campaign email blast' },
  { key: 'sms', label: 'SMS Blast', icon: '💬', desc: 'Text message campaign' },
  { key: 'podcast', label: 'Podcast', icon: '🎙️', desc: 'AI-generated 2-voice show' },
  { key: 'bilingual', label: 'Bilingual (Spanish)', icon: '🌎', desc: 'Spanish translations' },
];

const STEP_LABELS = ['Genre', 'Basics', 'Cast & Crew', 'Venue & Tickets', 'Sponsors', 'Media', 'Brand & Voice', 'Channels', 'Review'];

const THEATER_PRODUCTION_TYPES = [
  'Play',
  'Musical',
  'Opera',
  'Dance Theater',
  'Cabaret / Revue',
  'Touring Production',
  'Workshop / Reading',
  'Festival Production',
  'Youth / School Production',
  'Site-Specific Production',
];

const THEATER_UNION_HOUSE_OPTIONS = [
  'Non-Union',
  'Equity / AGMA',
  'IATSE',
  'Mixed Union',
  'TBD',
];

const THEATER_STAGE_FORMATS = [
  'Proscenium',
  'Thrust',
  'Arena',
  'Black Box',
  'Outdoor',
  'Site-Specific',
  'Flexible / Immersive',
];

const LEGAL_JURISDICTIONS = [
  'Texas',
  'Federal (U.S.)',
  'Bexar County',
  'City of San Antonio',
  'Multi-State',
  'Other',
];

const MCLE_STATUSES = [
  'Pending Submission',
  'Submitted',
  'Approved',
  'Rejected',
  'Exempt / Informational',
];

const LEGAL_ANALYTICS_SOURCES = [
  'Eventbrite API',
  'Ticket Tailor API',
  'Universe API',
  'Manual Entry',
  'CSV Import',
  'Zapier Webhook',
  'Other',
];

const RECURRING_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'weekly', label: 'Weekly (same weekday)' },
  { value: 'biweekly', label: 'Every Other Week (same weekday)' },
  { value: 'weekly_selected_days', label: 'Weekly on selected days' },
  { value: 'monthly_day_of_month', label: 'Monthly on specific day of month' },
  { value: 'monthly_nth_weekday', label: 'Monthly on nth weekday (e.g. first Friday)' },
  { value: 'monthly_last_weekday', label: 'Monthly on last weekday (e.g. last Friday)' },
];

const RECURRING_WEEKDAY_OPTIONS = [
  { value: 'sun', label: 'Sun' },
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
];

const RECURRING_WEEK_OF_MONTH_OPTIONS = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third' },
  { value: 'fourth', label: 'Fourth' },
];

const BOOKING_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'hold', label: 'On Hold' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

const SHOW_CONTACT_ROLE_OPTIONS = [
  'Production Contact',
  'Tour Manager',
  'FOH Engineer',
  'Monitor Engineer',
  'Lighting Designer',
  'Stage Manager',
  'Promoter Rep',
  'House Manager',
  'Tech Director',
];

const DESCRIPTION_STYLE_OPTIONS = [
  { value: 'clean', label: 'Clean' },
  { value: 'feature', label: 'Feature' },
  { value: 'punchy', label: 'Punchy' },
];

const DESCRIPTION_STYLE_HELP = {
  clean: 'Clean keeps your researched facts direct and clear, with a tighter editorial tone.',
  feature: 'Feature adds atmosphere and scene-setting so the draft reads like an entertainment feature intro.',
  punchy: 'Punchy keeps the same facts but drives a sharper, faster, high-energy lead.',
};

const KNOWN_TICKETING_PROVIDERS = ['manual', 'eventbrite', 'ticketmaster', 'universe', 'square', 'etix', 'other'];

function normalizeTicketProviderValue(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function mapTicketProviderDraft(rawValue = '') {
  const normalized = normalizeTicketProviderValue(rawValue);
  if (!normalized || normalized === 'manual' || normalized === 'unknown') {
    return { ticketProvider: 'manual', ticketProviderOther: '' };
  }
  if (KNOWN_TICKETING_PROVIDERS.includes(normalized)) {
    return { ticketProvider: normalized, ticketProviderOther: '' };
  }
  return { ticketProvider: 'other', ticketProviderOther: String(rawValue || '').trim() };
}

function resolveTicketProviderForStorage(form = {}) {
  const selected = normalizeTicketProviderValue(form.ticketProvider);
  if (selected === 'other') {
    return normalizeTicketProviderValue(form.ticketProviderOther) || '';
  }
  return selected || 'manual';
}

function ticketProviderLabel(form = {}) {
  const selected = normalizeTicketProviderValue(form.ticketProvider);
  if (selected === 'other') {
    return String(form.ticketProviderOther || '').trim() || 'Other';
  }
  return selected || 'manual';
}

function parseRecipientEmails(input = '') {
  return String(input || '')
    .split(/[,\n;]/g)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value));
}

function triggerDataUrlDownload(url = '', fileName = 'report.pdf') {
  if (!url) return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function parseBooleanish(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (['yes', 'y', 'true', '1', 'on', 'approved', 'required', 'complete', 'completed'].includes(normalized)) return true;
  if (['no', 'n', 'false', '0', 'off', 'not approved', 'optional', 'pending'].includes(normalized)) return false;
  return null;
}

function addHoursToIso(iso, hours) {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setHours(dt.getHours() + hours);
  return dt.toISOString();
}

function buildBookingIso(date, time) {
  if (!date) return '';
  const safeTime = String(time || '19:00').slice(0, 5);
  return `${date}T${safeTime}:00`;
}

function weekdayFromDate(dateOnly = '') {
  const parsed = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'sun';
  return RECURRING_WEEKDAY_OPTIONS[parsed.getDay()]?.value || 'sun';
}

function dayOfMonthFromDate(dateOnly = '') {
  const parsed = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '1';
  return String(parsed.getDate());
}

function resolveAiIntakeTab(inputMode = '') {
  const mode = String(inputMode || '').trim().toLowerCase();
  if (mode === 'voice' || mode === 'speak') return 'speak';
  if (mode === 'upload' || mode === 'file') return 'upload';
  return 'paste';
}

function recurrenceSummaryText(form = {}) {
  const count = Number.parseInt(form.recurrenceCount, 10) || 1;
  const freq = String(form.recurrenceFrequency || 'weekly');
  const weekdayLabel = RECURRING_WEEKDAY_OPTIONS.find(opt => opt.value === form.recurrenceWeekday)?.label || '';
  const selectedDays = (form.recurrenceDaysOfWeek || [])
    .map(day => RECURRING_WEEKDAY_OPTIONS.find(opt => opt.value === day)?.label || '')
    .filter(Boolean)
    .join(', ');

  let detail = freq;
  if (freq === 'weekly_selected_days') {
    detail = selectedDays ? `weekly on ${selectedDays}` : 'weekly on selected days';
  } else if (freq === 'biweekly') {
    detail = weekdayLabel ? `every other week on ${weekdayLabel}` : 'every other week';
  } else if (freq === 'weekly') {
    detail = weekdayLabel ? `weekly on ${weekdayLabel}` : 'weekly';
  } else if (freq === 'weekdays') {
    detail = 'weekdays (Mon-Fri)';
  } else if (freq === 'monthly_day_of_month' || freq === 'monthly') {
    detail = `monthly on day ${form.recurrenceDayOfMonth || dayOfMonthFromDate(form.date)}`;
  } else if (freq === 'monthly_nth_weekday') {
    detail = `${form.recurrenceWeekOfMonth || 'first'} ${weekdayLabel || 'weekday'} of each month`;
  } else if (freq === 'monthly_last_weekday') {
    detail = `last ${weekdayLabel || 'weekday'} of each month`;
  }

  return `${detail} · ${count} occurrence${count === 1 ? '' : 's'}`;
}

function answersForShowType(showType, memberCount) {
  const count = Number(memberCount) || 0;
  if (showType === 'theater') return { castSize: count || 8, wirelessCount: 8 };
  if (showType === 'speakers') return { speakerCount: count || 2, panelCount: count || 2 };
  if (showType === 'orchestra_choir') return { choirSize: count || 24, memberCount: count || 24 };
  if (showType === 'dj_electronic') return { memberCount: count || 1 };
  if (showType === 'hybrid') return { memberCount: count || 6, hybridBase: 'band' };
  return { memberCount: count || 4 };
}

function normalizeTheaterCrewMember(member = {}) {
  const roleGuess = member.role || '';
  const nearestRole = findNearestTheaterRole(roleGuess);
  const role = nearestRole || roleGuess || 'Crew';
  const department = member.department || getTheaterDepartmentForRole(role) || '';
  return {
    id: member.id || Date.now() + Math.random(),
    name: String(member.name || '').trim(),
    role,
    department,
    email: String(member.email || '').trim(),
    phone: String(member.phone || '').trim(),
    callTime: String(member.callTime || '').trim(),
    notes: String(member.notes || '').trim(),
  };
}

function dedupeCrewList(existing = [], incoming = []) {
  const seen = new Set(existing.map(c => `${(c.name || '').trim().toLowerCase()}|${(c.role || '').trim().toLowerCase()}`));
  const out = [...existing];
  for (const item of incoming) {
    const key = `${(item.name || '').trim().toLowerCase()}|${(item.role || '').trim().toLowerCase()}`;
    if (!item.name || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function parseTheaterIntakeText(rawText = '') {
  const text = String(rawText || '').trim();
  if (!text) return { crew: [], patch: {}, unmatched: 0 };

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const patch = {};
  const crew = [];
  let unmatched = 0;

  const pickValue = (line) => line.split(':').slice(1).join(':').trim();
  const numericOnly = (value = '') => String(value).replace(/[^0-9.]/g, '');
  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const phoneRe = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}/g;
  const timeRe = /\b(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.startsWith('production type:') || lower.startsWith('show type:')) {
      patch.productionType = pickValue(line);
      continue;
    }
    if (lower.startsWith('union house:') || lower.startsWith('union:')) {
      patch.unionHouse = pickValue(line);
      continue;
    }
    if (lower.startsWith('stage format:') || lower.startsWith('stage type:')) {
      patch.stageFormat = pickValue(line);
      continue;
    }
    if (lower.startsWith('rehearsal start:')) {
      patch.rehearsalStart = pickValue(line);
      continue;
    }
    if (lower.startsWith('opening night:') || lower.startsWith('opening:')) {
      patch.openingNight = pickValue(line);
      continue;
    }
    if (lower.startsWith('closing night:') || lower.startsWith('closing:')) {
      patch.closingNight = pickValue(line);
      continue;
    }
    if (lower.startsWith('runtime:')) {
      const v = pickValue(line);
      patch.runtimeMinutes = v.replace(/[^\d]/g, '');
      continue;
    }
    if (lower.startsWith('intermission') || lower.startsWith('intermissions:')) {
      const v = pickValue(line) || line.replace(/[^\d]/g, '');
      patch.intermissions = String(v).replace(/[^\d]/g, '');
      continue;
    }
    if (lower.startsWith('cle credit hours:')) {
      patch.cleCreditHours = numericOnly(pickValue(line));
      continue;
    }
    if (lower.startsWith('mcle accreditation provider:') || lower.startsWith('mcle provider:')) {
      patch.mcleAccreditationProvider = pickValue(line);
      continue;
    }
    if (lower.startsWith('bar association sponsor:') || lower.startsWith('bar sponsor:')) {
      patch.barAssociationSponsor = pickValue(line);
      continue;
    }
    if (lower.startsWith('legal jurisdiction:')) {
      patch.legalJurisdiction = pickValue(line);
      continue;
    }
    if (lower.startsWith('mcle approval code:') || lower.startsWith('approval code:')) {
      patch.mcleApprovalCode = pickValue(line);
      continue;
    }
    if (lower.startsWith('mcle status:')) {
      patch.mcleStatus = pickValue(line);
      continue;
    }
    if (lower.startsWith('legal workflow mode:') || lower.startsWith('workflow mode:')) {
      const mode = normalizeLegalWorkflowMode(pickValue(line));
      patch.legalWorkflowMode = mode;
      patch.distributionApprovalRequired = mode === 'cle_full';
      continue;
    }
    if (lower.startsWith('distribution approval required:')) {
      const parsed = parseBooleanish(pickValue(line));
      if (parsed !== null) patch.distributionApprovalRequired = parsed;
      continue;
    }
    if (lower.startsWith('distribution approved:')) {
      const parsed = parseBooleanish(pickValue(line));
      if (parsed !== null) patch.distributionApproved = parsed;
      continue;
    }
    if (lower.startsWith('distribution approved by:') || lower.startsWith('approved by:')) {
      patch.distributionApprovedBy = pickValue(line);
      continue;
    }
    if (lower.startsWith('distribution approved at:') || lower.startsWith('approved at:')) {
      patch.distributionApprovedAt = pickValue(line);
      continue;
    }
    if (lower.startsWith('distribution approval notes:')) {
      patch.distributionApprovalNotes = pickValue(line);
      continue;
    }
    if (lower.startsWith('include legal disclaimer:')) {
      const parsed = parseBooleanish(pickValue(line));
      if (parsed !== null) patch.includeLegalDisclaimer = parsed;
      continue;
    }
    if (lower.startsWith('legal disclaimer template:') || lower.startsWith('disclaimer template:')) {
      patch.legalDisclaimerTemplate = normalizeLegalDisclaimerTemplate(pickValue(line));
      continue;
    }
    if (lower.startsWith('legal disclaimer custom:') || lower.startsWith('custom disclaimer:')) {
      patch.legalDisclaimerCustom = pickValue(line);
      continue;
    }
    if (lower.startsWith('cle program notes:')) {
      patch.cleProgramNotes = pickValue(line);
      continue;
    }
    if (lower.startsWith('bar numbers collected:')) {
      patch.cleBarNumbersCollected = String(pickValue(line) || '').replace(/[^\d]/g, '');
      continue;
    }
    if (lower.startsWith('registrants:') || lower.startsWith('registered attendees:')) {
      patch.cleRegistrants = String(pickValue(line) || '').replace(/[^\d]/g, '');
      continue;
    }
    if (lower.startsWith('check-ins:') || lower.startsWith('checked in:')) {
      patch.cleCheckIns = String(pickValue(line) || '').replace(/[^\d]/g, '');
      continue;
    }
    if (lower.startsWith('certificates issued:') || lower.startsWith('cle certificates:')) {
      patch.cleCertificatesIssued = String(pickValue(line) || '').replace(/[^\d]/g, '');
      continue;
    }
    if (lower.startsWith('tickets sold:') || lower.startsWith('ticket sales count:')) {
      patch.ticketSalesCount = String(pickValue(line) || '').replace(/[^\d]/g, '');
      continue;
    }
    if (lower.startsWith('ticket provider:') || lower.startsWith('ticket platform:')) {
      const parsedProvider = mapTicketProviderDraft(pickValue(line));
      patch.ticketProvider = parsedProvider.ticketProvider;
      patch.ticketProviderOther = parsedProvider.ticketProviderOther;
      continue;
    }
    if (lower.startsWith('ticket provider event id:') || lower.startsWith('provider event id:') || lower.startsWith('eventbrite id:')) {
      patch.ticketProviderEventId = String(pickValue(line) || '').trim();
      continue;
    }
    if (lower.startsWith('seats available:') || lower.startsWith('seating capacity:') || lower.startsWith('capacity:')) {
      patch.seatsAvailable = String(pickValue(line) || '').replace(/[^\d]/g, '');
      continue;
    }
    if (lower.startsWith('gross revenue:') || lower.startsWith('gross ticket revenue:')) {
      patch.grossTicketRevenue = numericOnly(pickValue(line));
      continue;
    }
    if (lower.startsWith('net payout:') || lower.startsWith('net revenue:')) {
      patch.netPayoutRevenue = numericOnly(pickValue(line));
      continue;
    }
    if (lower.startsWith('analytics source:')) {
      patch.analyticsSource = pickValue(line);
      continue;
    }
    if (lower.startsWith('analytics synced:') || lower.startsWith('analytics last synced:')) {
      patch.analyticsLastSyncedAt = pickValue(line);
      continue;
    }
    if (lower.startsWith('stakeholder report exported:') || lower.startsWith('report exported:')) {
      patch.stakeholderReportExportedAt = pickValue(line);
      continue;
    }
    if (lower.startsWith('cle certificates delivered:')) {
      patch.cleCertificatesDeliveredAt = pickValue(line);
      continue;
    }
    if (lower.startsWith('cle attendance exported:') || lower.startsWith('attendance exported:')) {
      patch.cleAttendanceExportedAt = pickValue(line);
      continue;
    }
    if (lower.startsWith('cle compliance owner:') || lower.startsWith('compliance owner:')) {
      patch.cleComplianceOwner = pickValue(line);
      continue;
    }
    if (lower.startsWith('cle compliance notes:') || lower.startsWith('compliance notes:')) {
      patch.cleComplianceNotes = pickValue(line);
      continue;
    }
    if (lower.startsWith('sponsorship revenue:')) {
      patch.sponsorshipRevenue = numericOnly(pickValue(line));
      continue;
    }
    if (lower.startsWith('speaker fees total:')) {
      patch.speakerFeesTotal = numericOnly(pickValue(line));
      continue;
    }
    if (lower.startsWith('venue costs total:')) {
      patch.venueCostsTotal = numericOnly(pickValue(line));
      continue;
    }
    if (lower.startsWith('compliance costs total:')) {
      patch.complianceCostsTotal = numericOnly(pickValue(line));
      continue;
    }
    if (lower.startsWith('reconciliation status:')) {
      patch.reconciliationStatus = pickValue(line).toLowerCase().replace(/\s+/g, '_');
      continue;
    }
    if (lower.startsWith('reconciliation owner:')) {
      patch.reconciliationOwner = pickValue(line);
      continue;
    }
    if (lower.startsWith('reconciliation closed at:')) {
      patch.reconciliationClosedAt = pickValue(line);
      continue;
    }
    if (lower.startsWith('reconciliation notes:')) {
      patch.reconciliationNotes = pickValue(line);
      continue;
    }
    if (lower.startsWith('attendee:')) {
      const detail = pickValue(line);
      patch.cleAttendanceRows = [String(patch.cleAttendanceRows || '').trim(), detail].filter(Boolean).join('\n');
      continue;
    }

    const roleFirst = line.match(/^([^:]{2,80})\s*:\s*(.+)$/);
    if (roleFirst) {
      const candidateRole = findNearestTheaterRole(roleFirst[1].trim());
      if (candidateRole) {
        const details = roleFirst[2].trim();
        const emails = details.match(emailRe) || [];
        const phones = details.match(phoneRe) || [];
        const callMatch = details.match(timeRe);
        const cleanedName = details
          .replace(emailRe, '')
          .replace(phoneRe, '')
          .replace(/\b(call|report)\s*time?\b[:\s-]*/i, '')
          .replace(timeRe, '')
          .replace(/[|,;]+$/g, '')
          .trim();
        crew.push(normalizeTheaterCrewMember({
          name: cleanedName || details,
          role: candidateRole,
          email: emails[0] || '',
          phone: phones[0] || '',
          callTime: callMatch?.[1] || '',
        }));
        continue;
      }
    }

    const nameFirst = line.match(/^(.+?)\s[-–—]\s(.+)$/);
    if (nameFirst) {
      const name = nameFirst[1].trim();
      const role = findNearestTheaterRole(nameFirst[2].trim()) || nameFirst[2].trim();
      if (name && role) {
        crew.push(normalizeTheaterCrewMember({ name, role }));
        continue;
      }
    }

    const parenthetical = line.match(/^(.+?)\s*\((.+)\)$/);
    if (parenthetical) {
      const name = parenthetical[1].trim();
      const role = findNearestTheaterRole(parenthetical[2].trim()) || parenthetical[2].trim();
      if (name && role) {
        crew.push(normalizeTheaterCrewMember({ name, role }));
        continue;
      }
    }

    unmatched += 1;
  }

  return { crew, patch, unmatched };
}

function mergeTheaterSpecialInstructions(form) {
  const base = String(form.specialInstructions || '')
    .replace(/\[THEATER_PRODUCTION][\s\S]*?\[\/THEATER_PRODUCTION]/gi, '')
    .replace(/\[LEGAL_CLE][\s\S]*?\[\/LEGAL_CLE]/gi, '')
    .trim();
  let tag = '';
  let lines = [];

  if (form.genre === THEATER_GENRE_KEY) {
    tag = 'THEATER_PRODUCTION';
    lines = [
      ['Production Type', form.productionType],
      ['Union House', form.unionHouse],
      ['Stage Format', form.stageFormat],
      ['Rehearsal Start', form.rehearsalStart],
      ['Opening Night', form.openingNight],
      ['Closing Night', form.closingNight],
      ['Runtime (minutes)', form.runtimeMinutes],
      ['Intermissions', form.intermissions],
      ['Production Notes', form.productionNotes],
    ];
  } else if (form.genre === LEGAL_CLE_GENRE_KEY) {
    tag = 'LEGAL_CLE';
    lines = [
      ['Legal Workflow Mode', form.legalWorkflowMode],
      ['CLE Credit Hours', form.cleCreditHours],
      ['MCLE Accreditation Provider', form.mcleAccreditationProvider],
      ['Bar Association Sponsor', form.barAssociationSponsor],
      ['Legal Jurisdiction', form.legalJurisdiction],
      ['MCLE Approval Code', form.mcleApprovalCode],
      ['MCLE Status', form.mcleStatus],
      ['Distribution Approval Required', form.distributionApprovalRequired ? 'yes' : 'no'],
      ['Distribution Approved', form.distributionApproved ? 'yes' : 'no'],
      ['Distribution Approved By', form.distributionApprovedBy],
      ['Distribution Approved At', form.distributionApprovedAt],
      ['Distribution Approval Notes', form.distributionApprovalNotes],
      ['Include Legal Disclaimer', form.includeLegalDisclaimer ? 'yes' : 'no'],
      ['Legal Disclaimer Template', getLegalDisclaimerTemplate(form.legalDisclaimerTemplate).label],
      ['Legal Disclaimer Custom', form.legalDisclaimerCustom],
      ['CLE Program Notes', form.cleProgramNotes],
      ['Bar Numbers Collected', form.cleBarNumbersCollected],
      ['Registrants', form.cleRegistrants],
      ['Check-Ins', form.cleCheckIns],
      ['Certificates Issued', form.cleCertificatesIssued],
      ['Certificates Delivered At', form.cleCertificatesDeliveredAt],
      ['Attendance Exported At', form.cleAttendanceExportedAt],
      ['Compliance Owner', form.cleComplianceOwner],
      ['Compliance Notes', form.cleComplianceNotes],
      ['Attendance Rows', form.cleAttendanceRows],
      ['Seats Available', form.seatsAvailable],
      ['Tickets Sold', form.ticketSalesCount],
      ['Ticket Provider', ticketProviderLabel(form)],
      ['Ticket Provider Event ID', form.ticketProviderEventId],
      ['Gross Ticket Revenue', form.grossTicketRevenue],
      ['Net Payout Revenue', form.netPayoutRevenue],
      ['Sponsorship Revenue', form.sponsorshipRevenue],
      ['Speaker Fees Total', form.speakerFeesTotal],
      ['Venue Costs Total', form.venueCostsTotal],
      ['Compliance Costs Total', form.complianceCostsTotal],
      ['Reconciliation Status', form.reconciliationStatus],
      ['Reconciliation Owner', form.reconciliationOwner],
      ['Reconciliation Closed At', form.reconciliationClosedAt],
      ['Reconciliation Notes', form.reconciliationNotes],
      ['Analytics Source', form.analyticsSource],
      ['Analytics Last Synced', form.analyticsLastSyncedAt],
      ['Stakeholder Report Exported', form.stakeholderReportExportedAt],
    ];
  } else {
    return base;
  }

  const normalizedLines = lines
    .filter(([, value]) => String(value || '').trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`);

  if (!normalizedLines.length) return base;
  const block = `[${tag}]
${normalizedLines.join('\n')}
[/${tag}]`;
  return [base, block].filter(Boolean).join('\n\n').trim();
}

function firstSentence(text = '') {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const match = clean.match(/[^.!?]+[.!?]?/);
  return (match?.[0] || clean).trim();
}

function formatReadableDate(date = '', time = '') {
  if (!date) return 'TBD';
  try {
    const raw = new Date(`${date}T12:00:00`);
    if (Number.isNaN(raw.getTime())) return date;
    const datePart = raw.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!time) return datePart;
    const [h, m] = String(time || '19:00').split(':');
    const parsedTime = new Date();
    parsedTime.setHours(Number(h) || 19, Number(m) || 0, 0, 0);
    const timePart = parsedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${datePart} at ${timePart}`;
  } catch {
    return `${date}${time ? ` at ${time}` : ''}`;
  }
}

function toOxfordList(items = []) {
  const normalized = items.map(item => String(item || '').trim()).filter(Boolean);
  if (!normalized.length) return '';
  if (normalized.length === 1) return normalized[0];
  if (normalized.length === 2) return `${normalized[0]} and ${normalized[1]}`;
  return `${normalized.slice(0, -1).join(', ')}, and ${normalized[normalized.length - 1]}`;
}

function detectGenreLens(genreLabel = '') {
  const g = String(genreLabel || '').toLowerCase();
  if (g.includes('theater') || g.includes('musical') || g.includes('opera')) return 'theater';
  if (g.includes('acting')) return 'acting';
  if (g.includes('music') || g.includes('jazz') || g.includes('dj') || g.includes('electronic')) return 'music';
  if (g.includes('orchestral') || g.includes('classical') || g.includes('choral')) return 'orchestral';
  if (g.includes('dance')) return 'dance';
  if (g.includes('visual art') || g.includes('artisan') || g.includes('gallery') || g.includes('craft')) return 'artisan';
  if (g.includes('literary') || g.includes('poetry') || g.includes('book')) return 'literary';
  if (g.includes('legal') || g.includes('cle')) return 'legal';
  if (g.includes('politic') || g.includes('civic') || g.includes('campaign')) return 'politics';
  if (g.includes('comedy') || g.includes('lecture') || g.includes('workshop') || g.includes('speaking')) return 'speaking';
  return 'default';
}

function getDefaultDescriptionStyleForGenre(genreLabel = '') {
  const lens = detectGenreLens(genreLabel);
  if (lens === 'legal' || lens === 'politics') return 'clean';
  return 'feature';
}

function getDescriptionStyleLabel(value = '') {
  return DESCRIPTION_STYLE_OPTIONS.find(opt => opt.value === value)?.label || 'Feature';
}

function pickIntensityVariant(style = 'feature', options = {}) {
  const normalized = String(style || 'feature').toLowerCase();
  if (normalized === 'clean') return options.clean || options.feature || options.punchy || '';
  if (normalized === 'punchy') return options.punchy || options.feature || options.clean || '';
  return options.feature || options.clean || options.punchy || '';
}

function buildGenreLead({
  lens = 'default',
  style = 'feature',
  title = '',
  venueName = 'the venue',
  whenLabel = 'TBD',
  mediaAngle = '',
}) {
  const angle = firstSentence(mediaAngle || '');
  const angleTail = angle ? ` ${angle}` : '';
  if (lens === 'music') {
    return `${pickIntensityVariant(style, {
      clean: `${title} is set for ${venueName} on ${whenLabel}, with a lineup built for a strong live room.`,
      feature: `${title} hits ${venueName} on ${whenLabel}, the kind of night built for first-note electricity and full-room momentum.`,
      punchy: `${title} storms ${venueName} on ${whenLabel}, loud in all the right ways and impossible to ignore.`,
    })}${angleTail}`;
  }
  if (lens === 'theater') {
    return `${pickIntensityVariant(style, {
      clean: `${title} opens at ${venueName} on ${whenLabel}, with clear focus on story, cast work, and staging.`,
      feature: `${title} arrives at ${venueName} on ${whenLabel}, where story, staging, and craft are set to carry the room from opening cue to final bow.`,
      punchy: `${title} takes the house at ${venueName} on ${whenLabel}, all cue lights, tension, and a finish built for applause.`,
    })}${angleTail}`;
  }
  if (lens === 'acting') {
    return `${pickIntensityVariant(style, {
      clean: `${title} runs at ${venueName} on ${whenLabel}, centered on character performance and audience connection.`,
      feature: `${title} takes over ${venueName} on ${whenLabel}, spotlighting character performance with theatrical timing and crowd-ready charisma.`,
      punchy: `${title} takes the spotlight at ${venueName} on ${whenLabel}, character-forward and ready to win the room.`,
    })}${angleTail}`;
  }
  if (lens === 'orchestral') {
    return `${pickIntensityVariant(style, {
      clean: `${title} is scheduled at ${venueName} on ${whenLabel}, with an ensemble program built around precision and range.`,
      feature: `${title} comes to ${venueName} on ${whenLabel}, leaning into precision, dynamics, and the sweep that only live ensemble performance can deliver.`,
      punchy: `${title} fills ${venueName} on ${whenLabel} with full-ensemble scale, sharp dynamics, and serious lift.`,
    })}${angleTail}`;
  }
  if (lens === 'dance') {
    return `${pickIntensityVariant(style, {
      clean: `${title} takes place at ${venueName} on ${whenLabel}, with choreography and visual storytelling at the center.`,
      feature: `${title} lands at ${venueName} on ${whenLabel}, with movement, rhythm, and visual storytelling at the center of the night.`,
      punchy: `${title} hits ${venueName} on ${whenLabel} with motion, rhythm, and a stage picture that moves fast.`,
    })}${angleTail}`;
  }
  if (lens === 'artisan') {
    return `${pickIntensityVariant(style, {
      clean: `${title} is on view at ${venueName} on ${whenLabel}, featuring studio-built work across multiple mediums.`,
      feature: `${title} opens at ${venueName} on ${whenLabel}, bringing hand-built work, studio discipline, and gallery-floor energy into one shared space.`,
      punchy: `${title} turns ${venueName} into a live gallery on ${whenLabel}, all texture, craft, and sharp visual voice.`,
    })}${angleTail}`;
  }
  if (lens === 'literary') {
    return `${pickIntensityVariant(style, {
      clean: `${title} convenes at ${venueName} on ${whenLabel}, focused on writing, conversation, and live reading.`,
      feature: `${title} gathers at ${venueName} on ${whenLabel}, where language, ideas, and live conversation drive the evening.`,
      punchy: `${title} takes over ${venueName} on ${whenLabel} with strong pages, live voices, and a room tuned to every line.`,
    })}${angleTail}`;
  }
  if (lens === 'legal') {
    return `${pickIntensityVariant(style, {
      clean: `${title} is scheduled for ${venueName} on ${whenLabel}, delivering legal insight with practical takeaways.`,
      feature: `${title} is set for ${venueName} on ${whenLabel}, pairing sharp legal insight with practical takeaways for the room.`,
      punchy: `${title} brings ${venueName} into full legal-focus mode on ${whenLabel}, clear-eyed, practical, and current.`,
    })}${angleTail}`;
  }
  if (lens === 'politics') {
    return `${pickIntensityVariant(style, {
      clean: `${title} is planned for ${venueName} on ${whenLabel}, with emphasis on policy, issues, and civic impact.`,
      feature: `${title} convenes at ${venueName} on ${whenLabel}, framing policy, personality, and local stakes in real time.`,
      punchy: `${title} lands at ${venueName} on ${whenLabel} where local stakes are high and every message matters.`,
    })}${angleTail}`;
  }
  if (lens === 'speaking') {
    return `${pickIntensityVariant(style, {
      clean: `${title} is scheduled at ${venueName} on ${whenLabel}, designed around clear ideas and practical value.`,
      feature: `${title} takes the stage at ${venueName} on ${whenLabel}, with a program designed to keep the room engaged from the first line to the final takeaway.`,
      punchy: `${title} takes ${venueName} on ${whenLabel} with high-impact talk, tight pacing, and real takeaways.`,
    })}${angleTail}`;
  }
  return `${pickIntensityVariant(style, {
    clean: `${title} is happening at ${venueName} on ${whenLabel}, with a clear local focus.`,
    feature: `${title} is happening at ${venueName} on ${whenLabel}, with a strong local pulse and a clear point of view.`,
    punchy: `${title} is live at ${venueName} on ${whenLabel}, built for energy and a room that wants to be there.`,
  })}${angleTail}`;
}

function buildGenreFallbackArtistLine({ lens = 'default', artistCandidates = [] }) {
  if (!artistCandidates.length) return '';
  const list = toOxfordList(artistCandidates.slice(0, 4));
  if (lens === 'music' || lens === 'orchestral') return `On the lineup: ${list}.`;
  if (lens === 'artisan') return `Featured artists include ${list}.`;
  if (lens === 'theater' || lens === 'acting' || lens === 'dance') return `Featured performers include ${list}.`;
  return `Featured guests include ${list}.`;
}

function buildArtistHighlight(artist = {}, lens = 'default', style = 'feature') {
  const name = String(artist?.name || '').trim();
  if (!name) return '';
  const bioLine = firstSentence(artist?.bio || '');
  const localLine = firstSentence(artist?.localConnection || '');
  const works = Array.isArray(artist?.notableWorks) ? artist.notableWorks.filter(Boolean).slice(0, 2) : [];
  const worksLine = works.length ? `Notable work includes ${toOxfordList(works)}.` : '';

  if (lens === 'artisan') {
    if (style === 'clean') return `${name}${bioLine ? `: ${bioLine}` : '.'}`;
    if (style === 'punchy') return `${name}${bioLine ? ` brings ${bioLine.toLowerCase()}` : ' brings a distinct visual point of view'}${worksLine ? ` ${worksLine}` : ''}`.trim();
    return `${name}${bioLine ? `: ${bioLine}` : ''}${worksLine ? ` ${worksLine}` : ''}${localLine ? ` ${localLine}` : ''}`.trim();
  }
  if (lens === 'theater' || lens === 'acting' || lens === 'dance') {
    if (style === 'clean') return `${name}${bioLine ? `: ${bioLine}` : ' joins the lineup.'}`;
    if (style === 'punchy') return `${name}${bioLine ? ` steps in with ${bioLine.toLowerCase()}` : ' steps in with live-stage presence'}${localLine ? `. ${localLine}` : '.'}`.trim();
    return `${name}${bioLine ? ` brings ${bioLine.replace(/^[a-z]/, c => c.toLowerCase())}` : ' joins the production'}${localLine ? `. ${localLine}` : '.'}`.trim();
  }
  if (style === 'clean') return `${name}${bioLine ? `: ${bioLine}` : '.'}`;
  if (style === 'punchy') return `${name}${bioLine ? ` comes in with ${bioLine.toLowerCase()}` : ' lands with serious stage energy'}${worksLine ? ` ${worksLine}` : ''}`.trim();
  return `${name}${bioLine ? `, ${bioLine}` : ''}${worksLine ? ` ${worksLine}` : ''}${localLine ? ` ${localLine}` : ''}`.trim();
}

function buildResearchDescriptionDraft({
  event = {},
  venue = {},
  research = null,
  artistCandidates = [],
  styleIntensity = 'feature',
}) {
  const title = String(event.title || '').trim();
  if (!title) return '';
  const genreLabel = String(event.genre || 'live event').split(' | ')[0] || 'live event';
  const lens = detectGenreLens(genreLabel);
  const venueName = String(venue.name || event.venue || '').trim() || 'the venue';
  const whenLabel = formatReadableDate(event.date, event.time);

  const intro = buildGenreLead({
    lens,
    style: styleIntensity,
    title,
    venueName,
    whenLabel,
    mediaAngle: research?.context?.mediaAngle || '',
  });

  const researchedArtists = Array.isArray(research?.artists) ? research.artists.filter(Boolean) : [];
  const artistParagraph = researchedArtists.length
    ? `Featured highlights: ${researchedArtists.slice(0, 3).map(artist => buildArtistHighlight(artist, lens, styleIntensity)).filter(Boolean).join(' ')}`.trim()
    : buildGenreFallbackArtistLine({ lens, artistCandidates });

  const venueLine = firstSentence(research?.venue?.description || '');
  const contextLine = firstSentence(research?.context?.culturalContext || '');
  const artsSceneLine = firstSentence(research?.context?.sanAntonioArtsScene || '');
  const audienceLine = firstSentence(research?.context?.audienceInsight || '');
  const contextParagraph = [
    venueLine ? `${venueName}: ${venueLine}` : '',
    contextLine,
    artsSceneLine,
    audienceLine ? `${styleIntensity === 'punchy' ? 'Who will show up:' : 'Audience note:'} ${audienceLine}` : '',
  ].filter(Boolean).join(' ');

  const ticketLine = event.ticketLink
    ? lens === 'artisan'
      ? `Exhibit details and attendance info: ${event.ticketLink}`
      : lens === 'theater' || lens === 'acting' || lens === 'dance'
        ? `Tickets and show details: ${event.ticketLink}`
        : `Tickets and event details: ${event.ticketLink}`
    : '';

  return [intro, artistParagraph, contextParagraph, ticketLine]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Reusable Snap & Auto-Fill component
function SnapAutoFill({ label, hint, extracting: ext, onExtract }) {
  return (
    <div className="mb-5 p-4 rounded-xl border-2 border-dashed border-[#c8a45e] bg-[#faf8f3]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold m-0">📸 Snap & Auto-Fill</h4>
          <p className="text-xs text-gray-500 m-0">{hint}</p>
        </div>
        {ext && <span className="text-xs text-[#c8a45e] animate-pulse">🔍 Extracting...</span>}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={async () => { try { const f = await openCamera(); onExtract([f]); } catch {} }}
          className="btn-primary text-xs py-1.5 px-3" disabled={ext}>📷 Photo</button>
        <button type="button" onClick={async () => { try { const files = await openFileUpload(true); onExtract(files); } catch {} }}
          className="btn-secondary text-xs py-1.5 px-3" disabled={ext}>📁 Upload</button>
      </div>
    </div>
  );
}

export default function EventCreate() {
  const {
    venue,
    addEvent,
    events,
    participantProfiles,
    saveParticipantProfile,
    venueProfiles,
    saveVenueProfile,
    performanceZones,
    showConfigurations,
    saveShowConfiguration,
    searchVenueSuggestions,
    getVenuePlaceDetails,
    exportSectionStakeholderReport,
  } = useVenue();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const aiIntakeMode = queryParams.get('ai') === 'intake';
  const aiIntakeInputMode = String(queryParams.get('input') || '').trim().toLowerCase();
  const [eventAssistDefaultTab, setEventAssistDefaultTab] = useState(() => resolveAiIntakeTab(aiIntakeInputMode));
  const [eventAssistOpenSignal, setEventAssistOpenSignal] = useState(0);
  const [showAiIntakeStarter, setShowAiIntakeStarter] = useState(() => {
    if (typeof window === 'undefined' || !aiIntakeMode) return false;
    return window.localStorage.getItem('imc-ai-intake-starter-seen-v1') !== '1';
  });
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const [stepExportStatus, setStepExportStatus] = useState('');
  const normalizedClientType = user?.clientType || '';
  const canAssignProduction = !!(
    user?.isAdmin
    || isVenueRole(normalizedClientType)
    || ['manager', 'booking_agent', 'producer'].includes(normalizedClientType)
    || isArtistRole(normalizedClientType)
  );

  const [form, setForm] = useState({
    title: '', description: '', genre: '',
    date: '', time: '19:00', ticketLink: '', ticketPrice: '', venue: venue?.name || '',
    ticketProvider: 'manual',
    ticketProviderOther: '',
    ticketProviderEventId: '',
    venueStreetNumber: '', venueStreetName: '', venueSuite: '',
    venueCity: 'San Antonio', venueState: 'TX', venueZip: '',
    venuePhone: '', venueWebsite: '',
    venueGooglePlaceId: '',
    venueGoogleMapsUrl: '',
    venueSocialLinks: {},
    officialAssetsOnly: !!venue?.defaultOfficialAssetsOnly,
    brandColors: venue?.brandColors || '#0d1b2a, #c8a45e',
    writingTone: venue?.writingTone || 'Professional yet approachable',
    specialInstructions: '',
    detectedFonts: '',
    productionType: '',
    unionHouse: '',
    stageFormat: '',
    rehearsalStart: '',
    openingNight: '',
    closingNight: '',
    runtimeMinutes: '',
    intermissions: '',
    productionNotes: '',
    legalWorkflowMode: 'cle_full',
    distributionApprovalRequired: true,
    distributionApproved: false,
    distributionApprovedBy: '',
    distributionApprovedAt: '',
    distributionApprovalNotes: '',
    includeLegalDisclaimer: true,
    legalDisclaimerTemplate: 'cle_education',
    legalDisclaimerCustom: '',
    cleCreditHours: '',
    mcleAccreditationProvider: '',
    barAssociationSponsor: '',
    legalJurisdiction: '',
    mcleApprovalCode: '',
    mcleStatus: '',
    cleProgramNotes: '',
    cleBarNumbersCollected: '',
    cleRegistrants: '',
    cleCheckIns: '',
    cleCertificatesIssued: '',
    cleCertificatesDeliveredAt: '',
    cleAttendanceExportedAt: '',
    cleComplianceOwner: '',
    cleComplianceNotes: '',
    cleAttendanceRows: '',
    ticketSalesCount: '',
    grossTicketRevenue: '',
    netPayoutRevenue: '',
    sponsorshipRevenue: '',
    speakerFeesTotal: '',
    venueCostsTotal: '',
    complianceCostsTotal: '',
    reconciliationStatus: 'draft',
    reconciliationOwner: '',
    reconciliationClosedAt: '',
    reconciliationNotes: '',
    analyticsSource: '',
    analyticsLastSyncedAt: '',
    stakeholderReportExportedAt: '',
    seatsAvailable: '',
    participantProfileIds: [],
    venueProfileId: '',
    recurrenceEnabled: false,
    recurrenceFrequency: 'weekly',
    recurrenceCount: '1',
    recurrenceDaysOfWeek: [],
    recurrenceDayOfMonth: '',
    recurrenceWeekOfMonth: 'first',
    recurrenceWeekday: '',
    seriesName: '',
    seriesNotes: '',
    performanceZoneId: '',
    performanceZoneName: '',
    bookingStartAt: '',
    bookingEndAt: '',
    showConfigurationId: '',
    bookingStatus: 'draft',
    showContacts: [],
    sponsors: [],
  });

  const [crew, setCrew] = useState([]);
  const [crewName, setCrewName] = useState('');
  const [crewRole, setCrewRole] = useState('');
  const [crewDepartment, setCrewDepartment] = useState('');
  const [crewEmail, setCrewEmail] = useState('');
  const [crewPhone, setCrewPhone] = useState('');
  const [crewCallTime, setCrewCallTime] = useState('');
  const [crewNotes, setCrewNotes] = useState('');
  const [crewIntakeText, setCrewIntakeText] = useState('');
  const [crewIntakeStatus, setCrewIntakeStatus] = useState('');
  const [channels, setChannels] = useState(CHANNELS.reduce((a, c) => ({ ...a, [c.key]: true }), {}));
  const [uploadedImages, setUploadedImages] = useState([]);
  const [extracting, setExtracting] = useState({});
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantStatus, setParticipantStatus] = useState('');
  const [venueLibraryStatus, setVenueLibraryStatus] = useState('');
  const [showTemplateType, setShowTemplateType] = useState('band');
  const [showTemplateKey, setShowTemplateKey] = useState('');
  const [showTemplateCount, setShowTemplateCount] = useState('4');
  const [showConfigStatus, setShowConfigStatus] = useState('');
  const [venueSuggestions, setVenueSuggestions] = useState([]);
  const [venueLookupLoading, setVenueLookupLoading] = useState(false);
  const [venueLookupStatus, setVenueLookupStatus] = useState('');
  const [venueLookupSessionToken] = useState(() => `imc-venue-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [descriptionResearchStatus, setDescriptionResearchStatus] = useState('');
  const [descriptionResearching, setDescriptionResearching] = useState(false);
  const [descriptionResearchMeta, setDescriptionResearchMeta] = useState(null);
  const [descriptionStyleIntensity, setDescriptionStyleIntensity] = useState('feature');
  const [descriptionStyleManual, setDescriptionStyleManual] = useState(false);
  const [descriptionResearchCorrections, setDescriptionResearchCorrections] = useState('');
  const [descriptionResearchIncludeTerms, setDescriptionResearchIncludeTerms] = useState('');
  const [descriptionResearchAvoidTerms, setDescriptionResearchAvoidTerms] = useState('');
  const [officialAssetsTouched, setOfficialAssetsTouched] = useState(false);
  const [stepExportForm, setStepExportForm] = useState({
    markComplete: false,
    completedBy: '',
    recipients: '',
    notes: '',
    nextStep: '',
  });
  const autoDescriptionTriggeredRef = useRef(false);

  useEffect(() => {
    setEventAssistDefaultTab(resolveAiIntakeTab(aiIntakeInputMode));
  }, [aiIntakeInputMode]);

  useEffect(() => {
    if (!aiIntakeMode || typeof window === 'undefined') {
      setShowAiIntakeStarter(false);
      return;
    }
    const seen = window.localStorage.getItem('imc-ai-intake-starter-seen-v1') === '1';
    setShowAiIntakeStarter(!seen);
  }, [aiIntakeMode]);

  const acknowledgeAiIntakeStarter = (tab = '') => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('imc-ai-intake-starter-seen-v1', '1');
    }
    if (tab) {
      setEventAssistDefaultTab(resolveAiIntakeTab(tab));
      setEventAssistOpenSignal(prev => prev + 1);
    }
    setShowAiIntakeStarter(false);
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const applyEventPatch = (fields) => {
    setForm(prev => ({ ...prev, ...fields }));
  };
  const toggleRecurrenceDay = (dayValue) => {
    setForm(prev => {
      const current = new Set(Array.isArray(prev.recurrenceDaysOfWeek) ? prev.recurrenceDaysOfWeek : []);
      if (current.has(dayValue)) current.delete(dayValue);
      else current.add(dayValue);
      return {
        ...prev,
        recurrenceDaysOfWeek: RECURRING_WEEKDAY_OPTIONS
          .map(opt => opt.value)
          .filter(value => current.has(value)),
      };
    });
  };

  const isTheaterGenre = form.genre === THEATER_GENRE_KEY;
  const isLegalCleGenre = form.genre === LEGAL_CLE_GENRE_KEY;
  const genreDefaultDescriptionStyle = useMemo(
    () => getDefaultDescriptionStyleForGenre(form.genre),
    [form.genre]
  );

  const availableRoles = useMemo(() => {
    if (!form.genre) return UNIVERSAL_ROLES;
    return [...UNIVERSAL_ROLES, ...(GENRE_ROLES[form.genre] || [])];
  }, [form.genre]);

  const roleGroups = useMemo(() => {
    if (!form.genre) {
      return [{ label: 'Universal', roles: UNIVERSAL_ROLES }];
    }
    if (!isTheaterGenre) {
      return [
        { label: 'Universal', roles: UNIVERSAL_ROLES },
        { label: form.genre.split(' | ')[0], roles: GENRE_ROLES[form.genre] || [] },
      ];
    }
    return [
      { label: 'Universal', roles: UNIVERSAL_ROLES },
      ...THEATER_DEPARTMENTS.map(dept => ({
        label: dept.label,
        roles: THEATER_ROLES_BY_DEPARTMENT[dept.key] || [],
      })),
    ];
  }, [form.genre, isTheaterGenre]);

  useEffect(() => {
    if (!crewRole && availableRoles.length) setCrewRole(availableRoles[0]);
  }, [availableRoles, crewRole]);

  useEffect(() => {
    if (!isTheaterGenre) {
      setCrewDepartment('');
      return;
    }
    if (crewRole) {
      setCrewDepartment(getTheaterDepartmentForRole(crewRole) || 'Production Leadership');
    }
  }, [isTheaterGenre, crewRole]);

  useEffect(() => {
    if (descriptionStyleManual) return;
    setDescriptionStyleIntensity(genreDefaultDescriptionStyle);
  }, [genreDefaultDescriptionStyle, descriptionStyleManual]);

  const applyLegalWorkflowPreset = (mode) => {
    const defaults = getLegalWorkflowDefaults(mode);
    setForm((prev) => ({
      ...prev,
      legalWorkflowMode: defaults.legalWorkflowMode,
      distributionApprovalRequired: defaults.distributionApprovalRequired,
      distributionApproved: defaults.distributionApproved,
      includeLegalDisclaimer: defaults.includeLegalDisclaimer,
      legalDisclaimerTemplate: defaults.legalDisclaimerTemplate,
      mcleStatus: defaults.legalWorkflowMode === 'branding_only'
        ? defaults.mcleStatus
        : (prev.mcleStatus === 'Exempt / Informational' ? '' : prev.mcleStatus),
    }));
    setCrewIntakeStatus(
      defaults.legalWorkflowMode === 'branding_only'
        ? 'Branding promotion mode selected. Compliance fields stay optional.'
        : 'CLE compliance mode selected. Distribution approval and legal disclaimer controls are now active.'
    );
  };

  const addCrewMembers = (members = []) => {
    if (!members.length) return;
    const normalized = members
      .map(member => normalizeTheaterCrewMember(member))
      .filter(member => member.name);
    if (!normalized.length) return;
    setCrew(prev => dedupeCrewList(prev, normalized));
  };

  const filteredParticipantProfiles = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    if (!q) return participantProfiles || [];
    return (participantProfiles || []).filter(profile => (
      `${profile.name || ''} ${profile.role || ''} ${profile.genre || ''}`.toLowerCase().includes(q)
    ));
  }, [participantProfiles, participantSearch]);

  const selectedParticipantProfiles = useMemo(() => {
    const selectedIds = new Set(form.participantProfileIds || []);
    return (participantProfiles || []).filter(profile => selectedIds.has(profile.id));
  }, [participantProfiles, form.participantProfileIds]);
  const selectedParticipantOfficialAssetsDefault = useMemo(() => (
    selectedParticipantProfiles.some(profile => !!profile?.metadata?.defaultOfficialAssetsOnly)
  ), [selectedParticipantProfiles]);

  const artistResearchCandidates = useMemo(() => {
    const fromProfiles = (selectedParticipantProfiles || [])
      .map(profile => String(profile?.name || '').trim())
      .filter(Boolean);
    const fromCrew = (crew || [])
      .filter(member => /artist|performer|band|dj|speaker|author|poet|comic|dancer|candidate|vocal|guitar|drummer|conductor/i.test(String(member?.role || '')))
      .map(member => String(member?.name || '').trim())
      .filter(Boolean);
    const fromTitle = (() => {
      const title = String(form.title || '').trim();
      if (!title) return [];
      const extracted = [];
      const withMatch = title.match(/\b(?:feat\.?|featuring|with)\s+(.+)$/i);
      if (withMatch?.[1]) {
        extracted.push(...withMatch[1].split(/,|&| and /i).map(s => s.trim()).filter(Boolean));
      }
      return extracted;
    })();

    const combined = [...fromProfiles, ...fromCrew, ...fromTitle];
    const seen = new Set();
    return combined.filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  }, [selectedParticipantProfiles, crew, form.title]);

  const zoneOptions = useMemo(() => (
    [...(performanceZones || [])]
      .filter(zone => {
        if (!form.venueProfileId) return true;
        return !zone.venue_profile_id || zone.venue_profile_id === form.venueProfileId;
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  ), [performanceZones, form.venueProfileId]);

  const selectedZone = useMemo(() => (
    zoneOptions.find(zone => zone.id === form.performanceZoneId) || null
  ), [zoneOptions, form.performanceZoneId]);

  const selectedShowConfiguration = useMemo(() => (
    (showConfigurations || []).find(cfg => cfg.id === form.showConfigurationId) || null
  ), [showConfigurations, form.showConfigurationId]);

  useEffect(() => {
    const query = String(form.venue || '').trim();
    if (query.length < 2) {
      setVenueSuggestions([]);
      setVenueLookupLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setVenueLookupLoading(true);
      try {
        const suggestions = await searchVenueSuggestions(query, {
          maxResults: 8,
          sessionToken: venueLookupSessionToken,
        });
        if (!cancelled) {
          setVenueSuggestions(Array.isArray(suggestions) ? suggestions : []);
        }
      } catch (err) {
        if (!cancelled) {
          setVenueLookupStatus(`Venue lookup failed: ${err.message}`);
        }
      } finally {
        if (!cancelled) setVenueLookupLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.venue, searchVenueSuggestions, venueLookupSessionToken]);

  const bookingConflicts = useMemo(() => (
    findZoneBookingConflicts(events || [], {
      zoneId: form.performanceZoneId,
      startAt: form.bookingStartAt,
      endAt: form.bookingEndAt,
    })
  ), [events, form.performanceZoneId, form.bookingStartAt, form.bookingEndAt]);

  const canCreateShowTemplate = useMemo(() => {
    return !!showTemplateType;
  }, [showTemplateType]);

  const upsertShowContact = (index, patch) => {
    setForm(prev => {
      const next = [...(prev.showContacts || [])];
      const current = next[index] || {};
      next[index] = { ...current, ...patch };
      return { ...prev, showContacts: next };
    });
  };

  const addShowContact = () => {
    setForm(prev => ({
      ...prev,
      showContacts: [
        ...(prev.showContacts || []),
        { role: SHOW_CONTACT_ROLE_OPTIONS[0], name: '', title: '', phone: '', email: '', isPrimary: false },
      ],
    }));
  };

  const removeShowContact = (index) => {
    setForm(prev => ({
      ...prev,
      showContacts: (prev.showContacts || []).filter((_, idx) => idx !== index),
    }));
  };

  useEffect(() => {
    setForm(prev => {
      const nextName = selectedZone?.name || '';
      if (prev.performanceZoneName === nextName) return prev;
      return { ...prev, performanceZoneName: nextName };
    });
  }, [selectedZone?.name]);

  useEffect(() => {
    if (!selectedZone?.default_contacts?.length) return;
    setForm(prev => {
      if ((prev.showContacts || []).length) return prev;
      return {
        ...prev,
        showContacts: selectedZone.default_contacts.map((contact, index) => ({
          role: contact.role || SHOW_CONTACT_ROLE_OPTIONS[0],
          name: contact.name || '',
          title: contact.title || '',
          phone: contact.phone || '',
          email: contact.email || '',
          isPrimary: index === 0,
        })),
      };
    });
  }, [selectedZone?.id, selectedZone?.default_contacts]);

  useEffect(() => {
    setForm(prev => {
      if (!prev.date) return prev;
      const defaultStart = buildBookingIso(prev.date, prev.time || '19:00');
      const startStale = !prev.bookingStartAt || !String(prev.bookingStartAt).startsWith(prev.date);
      const nextStart = startStale ? defaultStart : prev.bookingStartAt;
      const needsEnd = !prev.bookingEndAt || new Date(prev.bookingEndAt).getTime() <= new Date(nextStart).getTime();
      const nextEnd = needsEnd ? addHoursToIso(nextStart, 3) : prev.bookingEndAt;
      if (nextStart === prev.bookingStartAt && nextEnd === prev.bookingEndAt) return prev;
      return {
        ...prev,
        bookingStartAt: nextStart,
        bookingEndAt: nextEnd,
      };
    });
  }, [form.date, form.time]);

  useEffect(() => {
    if (!form.date) return;
    setForm(prev => {
      const fromDateWeekday = weekdayFromDate(prev.date);
      const fromDateDay = dayOfMonthFromDate(prev.date);
      const shouldSeedDays = !Array.isArray(prev.recurrenceDaysOfWeek) || prev.recurrenceDaysOfWeek.length === 0;
      return {
        ...prev,
        recurrenceDayOfMonth: prev.recurrenceDayOfMonth || fromDateDay,
        recurrenceWeekday: prev.recurrenceWeekday || fromDateWeekday,
        recurrenceDaysOfWeek: shouldSeedDays ? [fromDateWeekday] : prev.recurrenceDaysOfWeek,
      };
    });
  }, [form.date]);

  useEffect(() => {
    if (officialAssetsTouched) return;
    const shouldEnableByDefault = !!venue?.defaultOfficialAssetsOnly || selectedParticipantOfficialAssetsDefault;
    if (!shouldEnableByDefault) return;
    setForm(prev => {
      if (prev.officialAssetsOnly) return prev;
      return { ...prev, officialAssetsOnly: true };
    });
  }, [officialAssetsTouched, selectedParticipantOfficialAssetsDefault, venue?.defaultOfficialAssetsOnly]);

  const toggleParticipantSelection = (participantId) => {
    setForm(prev => {
      const selected = new Set(prev.participantProfileIds || []);
      if (selected.has(participantId)) selected.delete(participantId);
      else selected.add(participantId);
      return { ...prev, participantProfileIds: Array.from(selected) };
    });
  };

  const addSelectedParticipantsToCrew = () => {
    if (!selectedParticipantProfiles.length) {
      setParticipantStatus('Select at least one reusable act first.');
      return;
    }
    addCrewMembers(selectedParticipantProfiles.map(profile => ({
      id: `participant-${profile.id}`,
      name: profile.name || '',
      role: profile.role || 'Performer',
      department: isTheaterGenre ? getTheaterDepartmentForRole(profile.role || 'Performer') : '',
      email: profile.contact_email || '',
      phone: profile.contact_phone || '',
    })));
    setParticipantStatus(`Added ${selectedParticipantProfiles.length} reusable act${selectedParticipantProfiles.length === 1 ? '' : 's'} to cast/crew.`);
  };

  const generateResearchBackedDescription = useCallback(async ({
    allowOverwrite = true,
    source = 'manual',
    correctionPrompt = '',
    includeTerms = '',
    avoidTerms = '',
  } = {}) => {
    const title = String(form.title || '').trim();
    if (!title) {
      setDescriptionResearchStatus('Add a title first, then I can research and draft the description.');
      return;
    }
    if (!form.genre) {
      setDescriptionResearchStatus('Choose an event type first, then I can research and draft the description.');
      return;
    }

    setDescriptionResearching(true);
    setDescriptionResearchStatus('Running deep research for artist, venue, and local context...');
    try {
      const eventPayload = {
        title,
        genre: form.genre,
        date: form.date,
        time: form.time,
        description: form.description,
        ticketLink: form.ticketLink,
      };
      const venuePayload = {
        name: form.venue,
        city: form.venueCity || 'San Antonio',
        state: form.venueState || 'TX',
        address: [form.venueStreetNumber, form.venueStreetName, form.venueSuite, form.venueCity, form.venueState, form.venueZip]
          .filter(Boolean)
          .join(' '),
      };
      const corrections = String(correctionPrompt || descriptionResearchCorrections || '').trim();
      const includeWords = String(includeTerms || descriptionResearchIncludeTerms || '').trim();
      const avoidWords = String(avoidTerms || descriptionResearchAvoidTerms || '').trim();
      const result = await deepResearchDraft({
        target: 'event_description',
        event: eventPayload,
        venue: venuePayload,
        artistCandidates: artistResearchCandidates,
        styleIntensity: descriptionStyleIntensity,
        correctionPrompt: corrections,
        includeTerms: includeWords,
        avoidTerms: avoidWords,
      });
      const research = result?.research || null;
      const draftDescription = String(result?.draft || '').trim() || buildResearchDescriptionDraft({
        event: eventPayload,
        venue: venuePayload,
        research,
        artistCandidates: artistResearchCandidates,
        styleIntensity: descriptionStyleIntensity,
      });

      if (!draftDescription) {
        setDescriptionResearchStatus('I could not build a clean draft yet. Add one performer name or more event context and try again.');
        return;
      }

      const artistsResearched = Number.isFinite(result?.meta?.artistsResearched)
        ? result.meta.artistsResearched
        : (Array.isArray(research?.artists) ? research.artists.filter(Boolean).length : 0);
      const artistsRequested = Number.isFinite(result?.meta?.artistsRequested)
        ? result.meta.artistsRequested
        : artistResearchCandidates.length;
      const venueFound = typeof result?.meta?.venueFound === 'boolean'
        ? result.meta.venueFound
        : !!research?.venue;
      const contextFound = typeof result?.meta?.contextFound === 'boolean'
        ? result.meta.contextFound
        : !!research?.context;

      setDescriptionResearchMeta({
        artistsResearched,
        artistsRequested,
        venueFound,
        contextFound,
        styleIntensity: descriptionStyleIntensity,
        includeTermsCount: Number(result?.meta?.includeTermsCount || 0),
        avoidTermsCount: Number(result?.meta?.avoidTermsCount || 0),
      });

      const hadExistingDescription = !!String(form.description || '').trim();
      setForm(prev => {
        if (!allowOverwrite && String(prev.description || '').trim()) return prev;
        return { ...prev, description: draftDescription };
      });

      if (!allowOverwrite && hadExistingDescription) {
        setDescriptionResearchStatus('Research complete. Description already had text, so I left it untouched. Use refresh if you want to replace it.');
      } else {
        const styleLabel = getDescriptionStyleLabel(descriptionStyleIntensity);
        if (corrections || includeWords || avoidWords) {
          setDescriptionResearchStatus(`Research complete. Updated ${styleLabel} draft with your guidance terms.`);
        } else {
          setDescriptionResearchStatus(`Research complete. ${styleLabel} draft description is ready from ${source === 'auto' ? 'auto-research' : 'deep research'}.`);
        }
      }
    } catch (err) {
      setDescriptionResearchStatus(`I hit a snag researching this event: ${err.message}`);
    } finally {
      setDescriptionResearching(false);
    }
  }, [
    form.title,
    form.genre,
    form.date,
    form.time,
    form.description,
    form.ticketLink,
    form.venue,
    form.venueCity,
    form.venueState,
    form.venueStreetNumber,
    form.venueStreetName,
    form.venueSuite,
    form.venueZip,
    artistResearchCandidates,
    descriptionStyleIntensity,
    descriptionResearchCorrections,
    descriptionResearchIncludeTerms,
    descriptionResearchAvoidTerms,
  ]);

  useEffect(() => {
    if (step !== 1) {
      autoDescriptionTriggeredRef.current = false;
      return;
    }
    if (descriptionResearching) return;
    if (autoDescriptionTriggeredRef.current) return;
    if (String(form.description || '').trim()) return;
    if (!String(form.title || '').trim() || !form.genre || !form.date) return;

    autoDescriptionTriggeredRef.current = true;
    generateResearchBackedDescription({ allowOverwrite: false, source: 'auto' });
  }, [
    step,
    form.title,
    form.genre,
    form.date,
    form.description,
    descriptionResearching,
    generateResearchBackedDescription,
  ]);

  const saveCrewMemberToLibrary = async (member) => {
    const name = String(member?.name || '').trim();
    if (!name) {
      setParticipantStatus('Crew member name is required before saving to library.');
      return;
    }
    const duplicate = (participantProfiles || []).some(profile => (
      String(profile.name || '').trim().toLowerCase() === name.toLowerCase()
      && String(profile.role || '').trim().toLowerCase() === String(member.role || '').trim().toLowerCase()
    ));
    if (duplicate) {
      setParticipantStatus(`${name} is already in your reusable act library.`);
      return;
    }

    try {
      const saved = await saveParticipantProfile({
        name,
        role: member.role || '',
        genre: form.genre || '',
        bio: member.notes || '',
        contact_email: member.email || '',
        contact_phone: member.phone || '',
        metadata: {
          department: member.department || '',
          source: 'event_create',
          defaultOfficialAssetsOnly: !!form.officialAssetsOnly,
        },
      });
      setForm(prev => ({
        ...prev,
        participantProfileIds: Array.from(new Set([...(prev.participantProfileIds || []), saved.id])),
      }));
      setParticipantStatus(`Saved ${name} to reusable acts.`);
    } catch (err) {
      setParticipantStatus(`I hit a snag saving that reusable act: ${err.message}`);
    }
  };

  const applyVenueSuggestion = async (suggestion) => {
    if (!suggestion) return;
    setVenueLookupStatus('Fetching venue details...');
    try {
      const details = await getVenuePlaceDetails(suggestion.placeId, {
        localVenueProfileId: suggestion.localVenueProfileId,
        query: suggestion.mainText || suggestion.label || form.venue,
        sessionToken: venueLookupSessionToken,
        fetchSocials: true,
      });

      setForm(prev => ({
        ...prev,
        venue: details?.name || suggestion.mainText || suggestion.label || prev.venue,
        venueStreetNumber: details?.streetNumber || prev.venueStreetNumber,
        venueStreetName: details?.streetName || prev.venueStreetName,
        venueSuite: details?.suite || prev.venueSuite,
        venueCity: details?.city || prev.venueCity || 'San Antonio',
        venueState: details?.state || prev.venueState || 'TX',
        venueZip: details?.zip || prev.venueZip,
        venuePhone: details?.phone || prev.venuePhone,
        venueWebsite: details?.website || prev.venueWebsite,
        venueGooglePlaceId: details?.placeId || prev.venueGooglePlaceId || '',
        venueGoogleMapsUrl: details?.googleMapsUrl || prev.venueGoogleMapsUrl || '',
        venueSocialLinks: details?.socialLinks || prev.venueSocialLinks || {},
      }));
      setVenueSuggestions([]);
      setVenueLookupStatus('Venue details auto-filled.');
    } catch (err) {
      setVenueLookupStatus(`I hit a snag auto-filling venue details: ${err.message}`);
    }
  };

  const loadVenueProfileIntoForm = (profileId) => {
    const selected = (venueProfiles || []).find(profile => profile.id === profileId);
    if (!selected) {
      setForm(prev => ({ ...prev, venueProfileId: '' }));
      return;
    }
    setForm(prev => ({
      ...prev,
      venueProfileId: profileId,
      venue: selected.name || prev.venue,
      venueStreetNumber: selected.street_number || '',
      venueStreetName: selected.street_name || '',
      venueSuite: selected.suite || '',
      venueCity: selected.city || prev.venueCity || 'San Antonio',
      venueState: selected.state || prev.venueState || 'TX',
      venueZip: selected.postal_code || '',
      venuePhone: selected.phone || '',
      venueWebsite: selected.website || '',
      venueGooglePlaceId: selected.metadata?.googlePlaceId || prev.venueGooglePlaceId || '',
      venueGoogleMapsUrl: selected.metadata?.googleMapsUrl || prev.venueGoogleMapsUrl || '',
      venueSocialLinks: selected.metadata?.socialLinks || prev.venueSocialLinks || {},
    }));
    setVenueLibraryStatus(`Loaded ${selected.name || 'venue'} from your library.`);
    setVenueSuggestions([]);
  };

  const saveCurrentVenueToLibrary = async () => {
    const venueName = String(form.venue || '').trim();
    if (!venueName) {
      setVenueLibraryStatus('Add a venue name first, then save to library.');
      return;
    }
    const duplicate = (venueProfiles || []).find(profile => (
      String(profile.name || '').trim().toLowerCase() === venueName.toLowerCase()
      && String(profile.street_name || '').trim().toLowerCase() === String(form.venueStreetName || '').trim().toLowerCase()
    ));
    if (duplicate) {
      setForm(prev => ({ ...prev, venueProfileId: duplicate.id }));
      setVenueLibraryStatus(`${venueName} is already in your saved venues.`);
      return;
    }

    try {
      const saved = await saveVenueProfile({
        name: venueName,
        street_number: form.venueStreetNumber || '',
        street_name: form.venueStreetName || '',
        suite: form.venueSuite || '',
        city: form.venueCity || 'San Antonio',
        state: form.venueState || 'TX',
        postal_code: form.venueZip || '',
        phone: form.venuePhone || '',
        website: form.venueWebsite || '',
        metadata: {
          googlePlaceId: form.venueGooglePlaceId || '',
          googleMapsUrl: form.venueGoogleMapsUrl || '',
          socialLinks: form.venueSocialLinks || {},
        },
      });
      setForm(prev => ({ ...prev, venueProfileId: saved.id }));
      setVenueLibraryStatus(`Saved ${venueName} to your venue library.`);
    } catch (err) {
      setVenueLibraryStatus(`I hit a snag saving that venue: ${err.message}`);
    }
  };

  const createShowConfigFromTemplate = async () => {
    if (!canCreateShowTemplate) return;
    try {
      const defaults = buildShowConfigurationDefaults({
        showType: showTemplateType,
        templateKey: showTemplateKey || '',
        answers: answersForShowType(showTemplateType, showTemplateCount),
      });
      const configName = `${form.title || 'Event'} · ${showTemplateType.replace('_', ' ')} ${showTemplateKey || 'template'}`;
      const saved = await saveShowConfiguration({
        name: configName,
        show_type: showTemplateType,
        template_key: showTemplateKey || '',
        member_count: defaults.memberCount || Number(showTemplateCount) || null,
        summary: defaults.summary || '',
        equipment: defaults.equipment || [],
        input_list: defaults.inputList || [],
        patch_list: defaults.patchList || [],
        monitor_plan: defaults.monitorPlan || [],
        backline: defaults.backline || [],
        lighting_plan: defaults.lightingPlan || [],
        video_plan: defaults.videoPlan || [],
        power_plan: defaults.powerPlan || [],
        stage_management: defaults.stageManagement || [],
        stage_plot_layout: defaults.stagePlotLayout || { width: 24, depth: 16, items: [] },
        plot_summary: defaults.plotSummary || '',
      });
      setForm(prev => ({ ...prev, showConfigurationId: saved.id }));
      setShowConfigStatus(`Created and selected show config: ${saved.name || configName}.`);
    } catch (err) {
      setShowConfigStatus(`I hit a snag creating that show config: ${err.message}`);
    }
  };

  const addCrew = () => {
    if (!crewName || !crewRole) return;
    addCrewMembers([{
      id: Date.now(),
      name: crewName,
      role: crewRole,
      department: isTheaterGenre ? (crewDepartment || getTheaterDepartmentForRole(crewRole)) : '',
      email: crewEmail,
      phone: crewPhone,
      callTime: crewCallTime,
      notes: crewNotes,
    }]);
    setCrewName('');
    setCrewRole('');
    setCrewDepartment('');
    setCrewEmail('');
    setCrewPhone('');
    setCrewCallTime('');
    setCrewNotes('');
  };

  const removeCrew = (id) => setCrew(prev => prev.filter(c => c.id !== id));

  const handleParseCrewIntake = () => {
    if (!crewIntakeText.trim()) return;
    const parsed = parseTheaterIntakeText(crewIntakeText);
    if (Object.keys(parsed.patch).length) {
      setForm(prev => ({ ...prev, ...parsed.patch }));
    }
    if (parsed.crew.length) {
      addCrewMembers(parsed.crew);
    }
    setCrewIntakeStatus(
      `Parsed ${parsed.crew.length} crew entr${parsed.crew.length === 1 ? 'y' : 'ies'}${Object.keys(parsed.patch).length ? ` and ${Object.keys(parsed.patch).length} production field${Object.keys(parsed.patch).length === 1 ? '' : 's'}` : ''}.${parsed.unmatched ? ` ${parsed.unmatched} lines could not be mapped.` : ''}`
    );
  };

  // Generic extraction handler with context key
  const handleExtract = useCallback(async (files, context) => {
    if (!files?.length) return;
    setExtracting(prev => ({ ...prev, [context]: true }));
    setUploadedImages(prev => [...prev, ...files.map(f => ({ url: URL.createObjectURL(f), name: f.name, context }))]);
    try {
      const result = await extractFromImages(files);
      if (!result.success) return;
      const d = result.data || {};

      if (context === 'basics') {
        const formData = extractionToEventForm(result);
        setForm(prev => {
          const updated = { ...prev };
          for (const [key, val] of Object.entries(formData)) {
            if (val && !prev[key]) updated[key] = val;
          }
          return updated;
        });
      }

      if (context === 'crew') {
        // Extract performers/contacts as crew
        const performers = d.event?.performers || [];
        const contacts = d.contacts || [];
        const newCrew = [];
        performers.forEach(name => {
          if (typeof name === 'string' && name.trim()) {
            newCrew.push({
              id: Date.now() + Math.random(),
              name: name.trim(),
              role: isTheaterGenre ? 'Ensemble Performer' : 'Performer',
              department: isTheaterGenre ? 'Performance' : '',
            });
          }
        });
        contacts.forEach(c => {
          if (c.name) {
            const rawRole = c.role || c.title || (isTheaterGenre ? 'Crew' : 'Crew');
            const role = isTheaterGenre ? (findNearestTheaterRole(rawRole) || rawRole) : rawRole;
            newCrew.push({
              id: Date.now() + Math.random(),
              name: c.name,
              role,
              department: isTheaterGenre ? getTheaterDepartmentForRole(role) : '',
              email: c.email || '',
              phone: c.phone || '',
            });
          }
        });
        if (newCrew.length > 0) addCrewMembers(newCrew);
      }

      if (context === 'venue') {
        const v = d.venue || {};
        const contacts = d.contacts || [];
        const address = v.address || '';
        
        // Parse address into components
        let streetNumber = '', streetName = '';
        if (address) {
          const addressParts = address.split(' ');
          if (addressParts.length > 1 && /^\d+$/.test(addressParts[0])) {
            streetNumber = addressParts[0];
            streetName = addressParts.slice(1).join(' ');
          } else {
            streetName = address;
          }
        }
        
        setForm(prev => ({
          ...prev,
          venue: prev.venue || v.name || '',
          venueStreetNumber: prev.venueStreetNumber || streetNumber,
          venueStreetName: prev.venueStreetName || streetName,
          venueCity: prev.venueCity || v.city || 'San Antonio',
          venueState: prev.venueState || v.state || 'TX',
          venueZip: prev.venueZip || v.zip || v.postalCode || '',
          venuePhone: prev.venuePhone || v.phone || (contacts[0]?.phone || ''),
          venueWebsite: prev.venueWebsite || v.website || '',
          ticketPrice: prev.ticketPrice || d.event?.ticketPrice || '',
          ticketLink: prev.ticketLink || d.event?.ticketLink || '',
        }));
      }

      if (context === 'brand') {
        const v = d.venue || {};
        const colors = v.brandColors || [];
        const vibe = v.vibe || '';
        setForm(prev => ({
          ...prev,
          brandColors: colors.length > 0 ? colors.join(', ') : prev.brandColors,
          writingTone: vibe || prev.writingTone,
          detectedFonts: v.fonts || prev.detectedFonts || '',
          specialInstructions: prev.specialInstructions || (vibe ? `Detected vibe: ${vibe}` : ''),
        }));
      }

      if (context === 'media') {
        // Images already added to uploadedImages above
      }

    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setExtracting(prev => ({ ...prev, [context]: false }));
    }
  }, [addCrewMembers, isTheaterGenre]);

  const completedFields = useMemo(() => {
    let c = 0;
    if (form.genre) c++;
    if (form.title) c++;
    if (form.date) c++;
    if (form.description) c++;
    if (form.venue) c++;
    if (crew.length > 0) c++;
    if (uploadedImages.length > 0) c++;
    if (form.brandColors) c++;
    return c;
  }, [form, crew, uploadedImages]);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.title || !form.date || !form.genre) return;
    if (form.performanceZoneId && bookingConflicts.length > 0) {
      alert(`This zone is already booked for that time window.\n\n${formatZoneConflictSummary(bookingConflicts)}`);
      return;
    }
    setSubmitting(true);
    try {
      const normalizedTicketProvider = resolveTicketProviderForStorage(form) || 'manual';
      const specialInstructions = mergeTheaterSpecialInstructions(form);
      const baseProductionDetails = {
        seatsAvailable: form.seatsAvailable || '',
        ticketSalesCount: form.ticketSalesCount || '',
        ticketProvider: normalizedTicketProvider,
        ticketProviderEventId: form.ticketProviderEventId || '',
        venueGooglePlaceId: form.venueGooglePlaceId || '',
        venueGoogleMapsUrl: form.venueGoogleMapsUrl || '',
        venueSocialLinks: form.venueSocialLinks || {},
        officialAssetsOnly: !!form.officialAssetsOnly,
      };
      const event = await addEvent({
        ...form,
        specialInstructions,
        ticketProvider: normalizedTicketProvider,
        ticketProviderEventId: form.ticketProviderEventId || '',
        venueProfileId: form.venueProfileId || '',
        participantProfileIds: form.participantProfileIds || [],
        recurrence: {
          enabled: !!form.recurrenceEnabled,
          frequency: form.recurrenceFrequency || 'weekly',
          count: Number.parseInt(form.recurrenceCount, 10) || 1,
          seriesName: form.seriesName || '',
          notes: form.seriesNotes || '',
          daysOfWeek: Array.isArray(form.recurrenceDaysOfWeek) ? form.recurrenceDaysOfWeek : [],
          dayOfMonth: Number.parseInt(form.recurrenceDayOfMonth, 10) || null,
          weekOfMonth: form.recurrenceWeekOfMonth || '',
          weekday: form.recurrenceWeekday || '',
        },
        productionDetails: isTheaterGenre ? {
          ...baseProductionDetails,
          productionType: form.productionType || '',
          unionHouse: form.unionHouse || '',
          stageFormat: form.stageFormat || '',
          rehearsalStart: form.rehearsalStart || '',
          openingNight: form.openingNight || '',
          closingNight: form.closingNight || '',
          runtimeMinutes: form.runtimeMinutes || '',
          intermissions: form.intermissions || '',
          productionNotes: form.productionNotes || '',
        } : isLegalCleGenre ? {
          ...baseProductionDetails,
          legalWorkflowMode: normalizeLegalWorkflowMode(form.legalWorkflowMode || 'cle_full'),
          distributionApprovalRequired: !!form.distributionApprovalRequired,
          distributionApproved: !!form.distributionApproved,
          distributionApprovedBy: form.distributionApprovedBy || '',
          distributionApprovedAt: form.distributionApprovedAt || '',
          distributionApprovalNotes: form.distributionApprovalNotes || '',
          includeLegalDisclaimer: !!form.includeLegalDisclaimer,
          legalDisclaimerTemplate: normalizeLegalDisclaimerTemplate(form.legalDisclaimerTemplate || 'cle_education'),
          legalDisclaimerCustom: form.legalDisclaimerCustom || '',
          cleCreditHours: form.cleCreditHours || '',
          mcleAccreditationProvider: form.mcleAccreditationProvider || '',
          barAssociationSponsor: form.barAssociationSponsor || '',
          legalJurisdiction: form.legalJurisdiction || '',
          mcleApprovalCode: form.mcleApprovalCode || '',
          mcleStatus: form.mcleStatus || '',
          cleProgramNotes: form.cleProgramNotes || '',
          cleBarNumbersCollected: form.cleBarNumbersCollected || '',
          cleRegistrants: form.cleRegistrants || '',
          cleCheckIns: form.cleCheckIns || '',
          cleCertificatesIssued: form.cleCertificatesIssued || '',
          cleCertificatesDeliveredAt: form.cleCertificatesDeliveredAt || '',
          cleAttendanceExportedAt: form.cleAttendanceExportedAt || '',
          cleComplianceOwner: form.cleComplianceOwner || '',
          cleComplianceNotes: form.cleComplianceNotes || '',
          cleAttendanceRows: form.cleAttendanceRows || '',
          grossTicketRevenue: form.grossTicketRevenue || '',
          netPayoutRevenue: form.netPayoutRevenue || '',
          sponsorshipRevenue: form.sponsorshipRevenue || '',
          speakerFeesTotal: form.speakerFeesTotal || '',
          venueCostsTotal: form.venueCostsTotal || '',
          complianceCostsTotal: form.complianceCostsTotal || '',
          reconciliationStatus: form.reconciliationStatus || 'draft',
          reconciliationOwner: form.reconciliationOwner || '',
          reconciliationClosedAt: form.reconciliationClosedAt || '',
          reconciliationNotes: form.reconciliationNotes || '',
          analyticsSource: form.analyticsSource || '',
          analyticsLastSyncedAt: form.analyticsLastSyncedAt || '',
          stakeholderReportExportedAt: form.stakeholderReportExportedAt || '',
        } : baseProductionDetails,
        date: `${form.date}T${form.time}`,
        performanceZoneId: form.performanceZoneId || '',
        performanceZoneName: form.performanceZoneName || selectedZone?.name || '',
        bookingStartAt: form.bookingStartAt || '',
        bookingEndAt: form.bookingEndAt || '',
        showConfigurationId: form.showConfigurationId || '',
        showContacts: form.showContacts || [],
        bookingStatus: form.bookingStatus || 'draft',
        crew,
        channels,
      });
      // Only navigate if we got a real UUID back (not a temp ID)
      if (event?.id && event.id.includes('-')) {
        navigate(`/events/${event.id}`);
      } else {
        alert('I may not have saved that event cleanly. Check your dashboard and try once more if needed.');
      }
    } catch (err) {
      alert('I hit a snag creating that event: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!form.genre;
    if (step === 1) return !!form.title && !!form.date;
    return true;
  };

  const getStepValidationMessage = () => {
    if (step === 0 && !form.genre) return 'Choose your event type and I will tailor the rest of the flow.';
    if (step === 1 && (!form.title || !form.date)) {
      if (!form.title && !form.date) return 'Add an event title and date, then we can keep moving.';
      if (!form.title) return 'Add an event title, then we can keep moving.';
      return 'Add an event date, then we can keep moving.';
    }
    return '';
  };

  const handleNextStep = () => {
    const validationMessage = getStepValidationMessage();
    if (validationMessage) {
      setStepError(validationMessage);
      return;
    }
    setStepError('');
    setStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  const currentStepLabel = STEP_LABELS[step] || `Step ${step + 1}`;
  const nextStepLabel = STEP_LABELS[step + 1] || '';
  const legalCloseoutNet = useMemo(() => {
    const gross = Number(form.grossTicketRevenue) || 0;
    const sponsorship = Number(form.sponsorshipRevenue) || 0;
    const speakerFees = Number(form.speakerFeesTotal) || 0;
    const venueCosts = Number(form.venueCostsTotal) || 0;
    const complianceCosts = Number(form.complianceCostsTotal) || 0;
    return gross + sponsorship - speakerFees - venueCosts - complianceCosts;
  }, [
    form.grossTicketRevenue,
    form.sponsorshipRevenue,
    form.speakerFeesTotal,
    form.venueCostsTotal,
    form.complianceCostsTotal,
  ]);

  const stepCompletionChecklist = useMemo(() => {
    switch (step) {
      case 0:
        return [
          { label: 'Event type selected', done: !!form.genre },
        ];
      case 1:
        return [
          { label: 'Event title added', done: !!form.title },
          { label: 'Event date added', done: !!form.date },
          { label: 'Description drafted', done: !!String(form.description || '').trim() },
        ];
      case 2:
        return [
          { label: 'At least one cast/crew entry', done: crew.length > 0 || (form.participantProfileIds || []).length > 0 },
          ...(isLegalCleGenre ? [
            { label: 'Legal workflow mode selected', done: !!form.legalWorkflowMode },
            { label: 'Distribution approval configured', done: !form.distributionApprovalRequired || !!form.distributionApproved || !!form.distributionApprovedBy },
          ] : []),
        ];
      case 3:
        return [
          { label: 'Venue name set', done: !!form.venue },
          { label: 'Event start time set', done: !!form.time },
        ];
      case 4:
        return [
          { label: 'Sponsor section reviewed', done: true },
        ];
      case 5:
        return [
          { label: 'Media uploaded or official-assets-only selected', done: uploadedImages.length > 0 || !!form.officialAssetsOnly },
        ];
      case 6:
        return [
          { label: 'Brand colors set', done: !!String(form.brandColors || '').trim() },
          { label: 'Writing tone set', done: !!String(form.writingTone || '').trim() },
        ];
      case 7:
        return [
          { label: 'At least one channel selected', done: Object.values(channels || {}).some(Boolean) },
        ];
      case 8:
        return [
          { label: 'Core event fields valid', done: !!form.title && !!form.date && !!form.genre },
        ];
      default:
        return [];
    }
  }, [channels, crew.length, form, step, uploadedImages.length]);

  const stepCompletion = useMemo(() => {
    const total = stepCompletionChecklist.length;
    const done = stepCompletionChecklist.filter((item) => item.done).length;
    return {
      total,
      done,
      isComplete: total > 0 ? done === total : false,
    };
  }, [stepCompletionChecklist]);

  const currentStepExportData = useMemo(() => {
    switch (step) {
      case 0:
        return { genre: form.genre, availableGenres: GENRES.map((item) => item.key) };
      case 1:
        return {
          title: form.title,
          description: form.description,
          date: form.date,
          time: form.time,
          ticketLink: form.ticketLink,
          ticketPrice: form.ticketPrice,
          ticketProvider: ticketProviderLabel(form),
          ticketProviderEventId: form.ticketProviderEventId,
        };
      case 2:
        return {
          crew,
          selectedParticipantProfiles,
          legalProgram: isLegalCleGenre ? {
            legalWorkflowMode: form.legalWorkflowMode,
            distributionApprovalRequired: !!form.distributionApprovalRequired,
            distributionApproved: !!form.distributionApproved,
            distributionApprovedBy: form.distributionApprovedBy,
            includeLegalDisclaimer: !!form.includeLegalDisclaimer,
            legalDisclaimerTemplate: form.legalDisclaimerTemplate,
            cleCreditHours: form.cleCreditHours,
            mcleStatus: form.mcleStatus,
            cleRegistrants: form.cleRegistrants,
            cleCheckIns: form.cleCheckIns,
          } : null,
        };
      case 3:
        return {
          venue: form.venue,
          venueAddress: form.venueAddress,
          venueCity: form.venueCity,
          venueState: form.venueState,
          venueZip: form.venueZip,
          venuePhone: form.venuePhone,
          venueWebsite: form.venueWebsite,
          seatsAvailable: form.seatsAvailable,
          ticketSalesCount: form.ticketSalesCount,
          performanceZoneId: form.performanceZoneId,
          performanceZoneName: form.performanceZoneName || selectedZone?.name || '',
          bookingStartAt: form.bookingStartAt,
          bookingEndAt: form.bookingEndAt,
        };
      case 4:
        return { sponsors: form.sponsors || [] };
      case 5:
        return {
          officialAssetsOnly: !!form.officialAssetsOnly,
          uploadedImages: uploadedImages.map((item) => ({ url: item.url, source: item.source || 'upload' })),
        };
      case 6:
        return {
          brandColors: form.brandColors,
          writingTone: form.writingTone,
          specialInstructions: form.specialInstructions,
          detectedFonts: form.detectedFonts,
        };
      case 7:
        return {
          selectedChannels: CHANNELS.filter((ch) => channels[ch.key]).map((ch) => ch.label),
        };
      case 8:
        return {
          form,
          crew,
          selectedParticipantProfiles,
          uploadedImages: uploadedImages.map((item) => ({ url: item.url, source: item.source || 'upload' })),
          selectedChannels: CHANNELS.filter((ch) => channels[ch.key]).map((ch) => ch.label),
        };
      default:
        return {};
    }
  }, [channels, crew, form, selectedParticipantProfiles, selectedZone?.name, step, uploadedImages]);

  const handleExportCurrentStepForStakeholders = async ({ sendEmail = false } = {}) => {
    const recipients = parseRecipientEmails(stepExportForm.recipients);
    if (sendEmail && !recipients.length) {
      setStepExportStatus('Add at least one stakeholder email before sending this step.');
      return;
    }
    try {
      setStepExportStatus(sendEmail ? 'Exporting this step and emailing stakeholders...' : 'Exporting this step report...');
      const result = await exportSectionStakeholderReport({
        event: {
          title: form.title || 'Draft Event',
          date: form.date || '',
          venue: form.venue || '',
        },
        sectionKey: `event_create_step_${step + 1}`,
        sectionTitle: `Event Setup - ${currentStepLabel}`,
        sectionDescription: `Progress export from Event Setup step ${step + 1}.`,
        completion: {
          isComplete: stepExportForm.markComplete || stepCompletion.isComplete,
          completedBy: stepExportForm.completedBy || '',
          completedAt: new Date().toISOString(),
          checklist: stepCompletionChecklist,
          notes: stepExportForm.notes || '',
        },
        nextStep: stepExportForm.nextStep || (nextStepLabel ? `Move to ${nextStepLabel}.` : ''),
        content: currentStepExportData,
        recipients: sendEmail ? recipients : [],
      });
      triggerDataUrlDownload(result?.downloadUrl, result?.fileName || `event-step-${step + 1}-stakeholder-report.pdf`);
      setStepExportStatus(
        sendEmail && result?.email?.emailId
          ? `Step exported and emailed to ${recipients.length} stakeholder${recipients.length === 1 ? '' : 's'}.`
          : 'Step exported. Share the report with stakeholders.'
      );
    } catch (err) {
      setStepExportStatus(`Step export failed: ${err.message}`);
    }
  };

  useEffect(() => {
    setStepExportStatus('');
  }, [step]);

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>What type of event?</h2>
          <p className="text-gray-500 mb-6">Choose the event type and I will shape your crew roles, prompts, and workflow around it.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GENRES.map(g => (
              <button key={g.key} onClick={() => {
                setForm({ ...form, genre: g.key });
                setStepError('');
              }}
                className={`p-6 rounded-xl border-2 text-left transition-all cursor-pointer bg-white ${
                  form.genre === g.key ? 'border-[#c8a45e] shadow-lg' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="text-4xl block mb-3">{g.icon}</span>
                <h3 className="font-semibold text-sm mb-1">{g.key.split(' | ')[0]}</h3>
                <p className="text-xs text-gray-500 m-0">{g.desc}</p>
                {form.genre === g.key && (
                  <div className="mt-3 text-xs font-semibold text-[#c8a45e]">✓ Selected</div>
                )}
              </button>
            ))}
          </div>
        </div>
      );

      case 1: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Event Basics</h2>
          <p className="text-gray-500 mb-4">Start with title, description, date, and time.</p>
          <p className="text-xs text-gray-400 mb-4">* Fill the required fields first so distribution and automation stay accurate.</p>

          <SnapAutoFill
            context="basics"
            hint="Snap a poster, flyer, handbill, or screenshot. I will extract title, date, time, and description."
            extracting={extracting.basics}
            onExtract={(files) => handleExtract(files, 'basics')}
          />

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Title <span className="text-red-500">*</span></label>
              <input type="text" value={form.title} onChange={update('title')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="Friday Night Jazz" />
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700 m-0">Description</label>
              </div>
              <DeepResearchPromptBox
                title="OpenAI Deep Research Draft"
                subtitle="I will research band and venue context, draft a fact-checked first pass, then you can edit before anything is saved."
                styleValue={descriptionStyleIntensity}
                onStyleChange={(value) => {
                  setDescriptionStyleManual(true);
                  setDescriptionStyleIntensity(value);
                }}
                defaultStyleLabel={form.genre ? getDescriptionStyleLabel(genreDefaultDescriptionStyle) : ''}
                showUseDefaultButton={descriptionStyleManual && !!form.genre}
                onUseDefaultStyle={() => {
                  setDescriptionStyleManual(false);
                  setDescriptionStyleIntensity(genreDefaultDescriptionStyle);
                }}
                styleOptions={DESCRIPTION_STYLE_OPTIONS}
                styleHelp={DESCRIPTION_STYLE_HELP}
                correctionValue={descriptionResearchCorrections}
                onCorrectionChange={setDescriptionResearchCorrections}
                correctionLabel="Corrections or specific terms for regenerate"
                correctionPlaceholder="Example: Spell 'Nico Laven' correctly, mention Midtown MeetUp residency, and keep this parent-friendly."
                includeTermsValue={descriptionResearchIncludeTerms}
                onIncludeTermsChange={setDescriptionResearchIncludeTerms}
                includeTermsLabel="Use these words or phrases"
                includeTermsPlaceholder="Example: soulful, residency, family-friendly, SATX"
                avoidTermsValue={descriptionResearchAvoidTerms}
                onAvoidTermsChange={setDescriptionResearchAvoidTerms}
                avoidTermsLabel="Avoid these words or phrases"
                avoidTermsPlaceholder="Example: underground, explicit, rave"
                onGenerate={(payload = {}) => generateResearchBackedDescription({
                  allowOverwrite: true,
                  source: 'manual',
                  ...payload,
                })}
                onRegenerate={(payload = {}) => generateResearchBackedDescription({
                  allowOverwrite: true,
                  source: 'manual',
                  ...payload,
                })}
                generating={descriptionResearching}
                canGenerate={!!form.title && !!form.genre}
                statusText={descriptionResearchStatus}
                metaText={descriptionResearchMeta
                  ? `Research coverage: artists requested ${descriptionResearchMeta.artistsRequested}, artists found ${descriptionResearchMeta.artistsResearched}, venue ${descriptionResearchMeta.venueFound ? 'found' : 'not found'}, context ${descriptionResearchMeta.contextFound ? 'found' : 'not found'}, style ${getDescriptionStyleLabel(descriptionResearchMeta.styleIntensity)}, include terms ${descriptionResearchMeta.includeTermsCount || 0}, avoid terms ${descriptionResearchMeta.avoidTermsCount || 0}.`
                  : ''
                }
              />
              <textarea value={form.description} onChange={update('description')} rows={4}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                placeholder="Tell people what this event feels like and why they should show up." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={update('date')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input type="time" value={form.time} onChange={update('time')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
              </div>
            </div>

            <div className="card border border-gray-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold m-0">Recurring Series</h3>
                  <p className="text-xs text-gray-500 m-0">Use one setup for repeated events at familiar venues.</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.recurrenceEnabled}
                    onChange={(e) => setForm(prev => ({ ...prev, recurrenceEnabled: e.target.checked }))}
                    className="accent-[#c8a45e]"
                  />
                  Enable
                </label>
              </div>
              {form.recurrenceEnabled && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Series Name</label>
                      <input
                        type="text"
                        value={form.seriesName}
                        onChange={update('seriesName')}
                        className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                        placeholder={`${form.title || 'Event'} Series`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Repeat Pattern</label>
                      <select
                        value={form.recurrenceFrequency}
                        onChange={update('recurrenceFrequency')}
                        className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                      >
                        {RECURRING_FREQUENCIES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Occurrences</label>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={form.recurrenceCount}
                        onChange={update('recurrenceCount')}
                        className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      />
                    </div>
                  </div>

                  {form.recurrenceFrequency === 'weekly_selected_days' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Days of Week</label>
                      <div className="flex flex-wrap gap-2">
                        {RECURRING_WEEKDAY_OPTIONS.map(day => {
                          const active = (form.recurrenceDaysOfWeek || []).includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleRecurrenceDay(day.value)}
                              className={`px-2.5 py-1.5 border rounded text-xs ${active ? 'bg-[#c8a45e] text-[#0d1b2a] border-[#c8a45e]' : 'bg-white text-gray-700 border-gray-300'}`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(form.recurrenceFrequency === 'monthly_day_of_month' || form.recurrenceFrequency === 'monthly') && (
                    <div className="max-w-[220px]">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Day of Month</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={form.recurrenceDayOfMonth}
                        onChange={update('recurrenceDayOfMonth')}
                        className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                        placeholder={dayOfMonthFromDate(form.date)}
                      />
                    </div>
                  )}

                  {form.recurrenceFrequency === 'monthly_nth_weekday' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Week of Month</label>
                        <select
                          value={form.recurrenceWeekOfMonth}
                          onChange={update('recurrenceWeekOfMonth')}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                        >
                          {RECURRING_WEEK_OF_MONTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Weekday</label>
                        <select
                          value={form.recurrenceWeekday}
                          onChange={update('recurrenceWeekday')}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                        >
                          {RECURRING_WEEKDAY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {form.recurrenceFrequency === 'monthly_last_weekday' && (
                    <div className="max-w-[220px]">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Last Weekday</label>
                      <select
                        value={form.recurrenceWeekday}
                        onChange={update('recurrenceWeekday')}
                        className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                      >
                        {RECURRING_WEEKDAY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Series Notes (optional)</label>
                    <textarea
                      value={form.seriesNotes}
                      onChange={update('seriesNotes')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="Internal notes for recurring scheduling..."
                    />
                  </div>

                  <p className="text-xs text-gray-500 m-0">
                    {recurrenceSummaryText(form)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Cast & Crew</h2>
          <p className="text-gray-500 mb-4">Add performers and team members for your {form.genre?.split(' | ')[0] || 'event'}</p>

          {isTheaterGenre && (
            <div className="card mb-4">
              <h3 className="text-base mb-3">🎟 Theater Production Details</h3>
              <p className="text-xs text-gray-500 mb-3">Broadway-style production metadata for stage management, scheduling, and distribution context.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Production Type</label>
                  <select value={form.productionType} onChange={update('productionType')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
                    <option value="">Select production type...</option>
                    {THEATER_PRODUCTION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Union House</label>
                  <select value={form.unionHouse} onChange={update('unionHouse')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
                    <option value="">Select union status...</option>
                    {THEATER_UNION_HOUSE_OPTIONS.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stage Format</label>
                  <select value={form.stageFormat} onChange={update('stageFormat')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
                    <option value="">Select stage format...</option>
                    {THEATER_STAGE_FORMATS.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Runtime (minutes)</label>
                  <input type="number" min="0" value={form.runtimeMinutes} onChange={update('runtimeMinutes')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    placeholder="120" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Intermissions</label>
                  <input type="number" min="0" value={form.intermissions} onChange={update('intermissions')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    placeholder="1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rehearsal Start</label>
                  <input type="date" value={form.rehearsalStart} onChange={update('rehearsalStart')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Opening Night</label>
                  <input type="date" value={form.openingNight} onChange={update('openingNight')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Closing Night</label>
                  <input type="date" value={form.closingNight} onChange={update('closingNight')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]" />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Production Notes</label>
                <textarea value={form.productionNotes} onChange={update('productionNotes')} rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                  placeholder="Act transitions, blackout cues, orchestra notes, accessibility requirements..." />
              </div>
            </div>
          )}

          {isLegalCleGenre && (
            <div className="card mb-4">
              <h3 className="text-base mb-3">⚖️ CLE / Legal Program Details</h3>
              <p className="text-xs text-gray-500 mb-3">Capture MCLE, approval, compliance, and closeout details so legal distribution and reporting stay clean.</p>
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-blue-900 m-0">Quick Start Mode</p>
                <p className="text-xs text-blue-800 mt-1 mb-2">Pick the workflow you want right now. You can switch any time.</p>
                <div className="flex flex-wrap gap-2">
                  {LEGAL_WORKFLOW_MODES.map((mode) => {
                    const active = normalizeLegalWorkflowMode(form.legalWorkflowMode) === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => applyLegalWorkflowPreset(mode.value)}
                        className={`px-3 py-1.5 rounded border text-xs ${active ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]' : 'bg-white text-gray-700 border-gray-300'}`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-blue-800 mt-2 mb-0">
                  {LEGAL_WORKFLOW_MODES.find((mode) => mode.value === normalizeLegalWorkflowMode(form.legalWorkflowMode))?.description
                    || LEGAL_WORKFLOW_MODES[0].description}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Legal Workflow Mode</label>
                  <select
                    value={normalizeLegalWorkflowMode(form.legalWorkflowMode)}
                    onChange={(e) => applyLegalWorkflowPreset(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                  >
                    {LEGAL_WORKFLOW_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">CLE Credit Hours</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={form.cleCreditHours}
                    onChange={update('cleCreditHours')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    placeholder="1.0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Legal Jurisdiction</label>
                  <select
                    value={form.legalJurisdiction}
                    onChange={update('legalJurisdiction')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                  >
                    <option value="">Select jurisdiction...</option>
                    {LEGAL_JURISDICTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">MCLE Accreditation Provider</label>
                  <input
                    type="text"
                    value={form.mcleAccreditationProvider}
                    onChange={update('mcleAccreditationProvider')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    placeholder="State Bar of Texas MCLE"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bar Association Sponsor</label>
                  <input
                    type="text"
                    value={form.barAssociationSponsor}
                    onChange={update('barAssociationSponsor')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    placeholder="San Antonio Bar Association"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">MCLE Approval Code</label>
                  <input
                    type="text"
                    value={form.mcleApprovalCode}
                    onChange={update('mcleApprovalCode')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    placeholder="174226203"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">MCLE Status</label>
                  <select
                    value={form.mcleStatus}
                    onChange={update('mcleStatus')}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                  >
                    <option value="">Select status...</option>
                    {MCLE_STATUSES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">CLE Program Notes</label>
                <textarea
                  value={form.cleProgramNotes}
                  onChange={update('cleProgramNotes')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                  placeholder="Audience eligibility, reporting window, accreditation notes, etc."
                />
              </div>
              <div className="mt-4 border-t border-gray-200 pt-3">
                <h4 className="text-sm font-semibold mb-2">Distribution Gate + Legal Disclaimer</h4>
                <p className="text-xs text-gray-500 mb-3">Lock distribution until approval when needed, and append legal disclaimer text automatically.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-xs flex items-center gap-2 px-3 py-2 border border-gray-200 rounded bg-white">
                    <input
                      type="checkbox"
                      checked={!!form.distributionApprovalRequired}
                      onChange={(e) => setForm(prev => ({ ...prev, distributionApprovalRequired: e.target.checked }))}
                    />
                    Require approval before distribution
                  </label>
                  <label className="text-xs flex items-center gap-2 px-3 py-2 border border-gray-200 rounded bg-white">
                    <input
                      type="checkbox"
                      checked={!!form.distributionApproved}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        distributionApproved: e.target.checked,
                        distributionApprovedAt: e.target.checked ? (prev.distributionApprovedAt || new Date().toISOString().slice(0, 16)) : '',
                      }))}
                    />
                    Mark distribution approved
                  </label>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Approved By</label>
                    <input
                      type="text"
                      value={form.distributionApprovedBy}
                      onChange={update('distributionApprovedBy')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="Approver name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Approved At</label>
                    <input
                      type="datetime-local"
                      value={form.distributionApprovedAt}
                      onChange={update('distributionApprovedAt')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    />
                  </div>
                  <label className="text-xs flex items-center gap-2 px-3 py-2 border border-gray-200 rounded bg-white md:col-span-2">
                    <input
                      type="checkbox"
                      checked={!!form.includeLegalDisclaimer}
                      onChange={(e) => setForm(prev => ({ ...prev, includeLegalDisclaimer: e.target.checked }))}
                    />
                    Include legal disclaimer text in outbound content
                  </label>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Disclaimer Template</label>
                    <select
                      value={normalizeLegalDisclaimerTemplate(form.legalDisclaimerTemplate)}
                      onChange={(e) => setForm(prev => ({ ...prev, legalDisclaimerTemplate: normalizeLegalDisclaimerTemplate(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                    >
                      {LEGAL_DISCLAIMER_TEMPLATES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Template Preview</label>
                    <p className="text-xs text-gray-600 m-0 px-3 py-2 border border-gray-200 rounded bg-gray-50">
                      {getLegalDisclaimerTemplate(form.legalDisclaimerTemplate).shortText || 'No template text selected.'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Custom Disclaimer Add-On</label>
                    <textarea
                      value={form.legalDisclaimerCustom}
                      onChange={update('legalDisclaimerCustom')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                      placeholder="Optional language to append after the selected template."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Approval Notes</label>
                    <textarea
                      value={form.distributionApprovalNotes}
                      onChange={update('distributionApprovalNotes')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                      placeholder="What was approved, by whom, and any distribution constraints."
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-gray-200 pt-3">
                <h4 className="text-sm font-semibold mb-2">Stakeholder Analytics Snapshot</h4>
                <p className="text-xs text-gray-500 mb-3">Track attendance and money endpoints for stakeholder reporting.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bar Numbers Collected</label>
                    <input
                      type="number"
                      min="0"
                      value={form.cleBarNumbersCollected}
                      onChange={update('cleBarNumbersCollected')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Registrants</label>
                    <input
                      type="number"
                      min="0"
                      value={form.cleRegistrants}
                      onChange={update('cleRegistrants')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Check-Ins</label>
                    <input
                      type="number"
                      min="0"
                      value={form.cleCheckIns}
                      onChange={update('cleCheckIns')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Certificates Issued</label>
                    <input
                      type="number"
                      min="0"
                      value={form.cleCertificatesIssued}
                      onChange={update('cleCertificatesIssued')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tickets Sold</label>
                    <input
                      type="number"
                      min="0"
                      value={form.ticketSalesCount}
                      onChange={update('ticketSalesCount')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Gross Ticket Revenue ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.grossTicketRevenue}
                      onChange={update('grossTicketRevenue')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Net Payout Revenue ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.netPayoutRevenue}
                      onChange={update('netPayoutRevenue')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Analytics Source</label>
                    <select
                      value={form.analyticsSource}
                      onChange={update('analyticsSource')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                    >
                      <option value="">Select source...</option>
                      {LEGAL_ANALYTICS_SOURCES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Analytics Last Synced</label>
                    <input
                      type="datetime-local"
                      value={form.analyticsLastSyncedAt}
                      onChange={update('analyticsLastSyncedAt')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Certificates Delivered</label>
                    <input
                      type="datetime-local"
                      value={form.cleCertificatesDeliveredAt}
                      onChange={update('cleCertificatesDeliveredAt')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Attendance Exported</label>
                    <input
                      type="datetime-local"
                      value={form.cleAttendanceExportedAt}
                      onChange={update('cleAttendanceExportedAt')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Compliance Owner</label>
                    <input
                      type="text"
                      value={form.cleComplianceOwner}
                      onChange={update('cleComplianceOwner')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="Who owns CLE reporting"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Stakeholder Report Exported</label>
                    <input
                      type="datetime-local"
                      value={form.stakeholderReportExportedAt}
                      onChange={update('stakeholderReportExportedAt')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Attendance Roster Lines (Name, Bar #, Check-In, Certificate)</label>
                    <textarea
                      value={form.cleAttendanceRows}
                      onChange={update('cleAttendanceRows')}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                      placeholder="Jane Attorney, 24001234, checked_in, issued&#10;Alex Counsel, 24008765, checked_in, pending"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Compliance Notes</label>
                    <textarea
                      value={form.cleComplianceNotes}
                      onChange={update('cleComplianceNotes')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                      placeholder="Certification deadlines, export handoff notes, bar reporting references."
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-gray-200 pt-3">
                <h4 className="text-sm font-semibold mb-2">CLE Finance Closeout</h4>
                <p className="text-xs text-gray-500 mb-3">Reconcile event revenue and legal program costs for final reporting.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Sponsorship Revenue ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.sponsorshipRevenue}
                      onChange={update('sponsorshipRevenue')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Speaker Fees Total ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.speakerFeesTotal}
                      onChange={update('speakerFeesTotal')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Venue Costs Total ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.venueCostsTotal}
                      onChange={update('venueCostsTotal')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Compliance Costs Total ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.complianceCostsTotal}
                      onChange={update('complianceCostsTotal')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Reconciliation Status</label>
                    <select
                      value={form.reconciliationStatus}
                      onChange={update('reconciliationStatus')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                    >
                      {LEGAL_RECONCILIATION_STATUSES.map(opt => (
                        <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Reconciliation Owner</label>
                    <input
                      type="text"
                      value={form.reconciliationOwner}
                      onChange={update('reconciliationOwner')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                      placeholder="Owner name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Reconciliation Closed At</label>
                    <input
                      type="datetime-local"
                      value={form.reconciliationClosedAt}
                      onChange={update('reconciliationClosedAt')}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-700 mt-3 mb-2">
                  Projected closeout net: <strong>${Number.isFinite(legalCloseoutNet) ? legalCloseoutNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</strong>
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reconciliation Notes</label>
                  <textarea
                    value={form.reconciliationNotes}
                    onChange={update('reconciliationNotes')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                    placeholder="Final payout assumptions, variances, and sign-off notes."
                  />
                </div>
              </div>
            </div>
          )}

          <SnapAutoFill
            context="crew"
            hint={isTheaterGenre
              ? 'Snap a playbill, call sheet, cast list, or production email : AI extracts names, departments, and roles'
              : isLegalCleGenre
                ? 'Snap a CLE agenda, bar flyer, accreditation memo, or legal panel one-sheet : AI extracts speakers, MCLE details, and metrics'
              : 'Snap a playbill, show program, band lineup poster, or press kit : AI extracts names and roles'}
            extracting={extracting.crew}
            onExtract={(files) => handleExtract(files, 'crew')}
          />

          {(isTheaterGenre || isLegalCleGenre) && (
            <div className="card mb-4">
              <h3 className="text-base mb-2">📥 Intake from Email / Call Sheet</h3>
              <p className="text-xs text-gray-500 mb-2">
                {isLegalCleGenre
                  ? 'Paste CLE/ticketing update emails. Parse will map legal program fields and analytics snapshots.'
                  : 'Paste production email text. Parse will assign roles and fill theater production fields automatically.'}
              </p>
              <textarea
                value={crewIntakeText}
                onChange={e => setCrewIntakeText(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                placeholder={isLegalCleGenre
                  ? 'Legal Workflow Mode: branding_only&#10;Distribution Approval Required: no&#10;MCLE Status: Exempt / Informational&#10;Registrants: 128&#10;Bar Numbers Collected: 104&#10;Attendee: Jane Attorney, 24001234, checked_in, issued&#10;Gross Revenue: $3840.00'
                  : 'Production Type: Musical&#10;Opening Night: 2026-04-11&#10;Production Stage Manager: Jane Doe jane@example.com 210-555-0101&#10;John Smith - Fly Operator'}
              />
              <div className="flex items-center gap-2 mt-2">
                <button type="button" onClick={handleParseCrewIntake} className="btn-secondary text-sm">Parse Intake</button>
                {crewIntakeStatus && <span className="text-xs text-gray-600">{crewIntakeStatus}</span>}
              </div>
            </div>
          )}

          <div className="card mb-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-base mb-1">Reusable Acts & Participants</h3>
                <p className="text-xs text-gray-500 m-0">Pick previously saved artists/speakers and add them to this event.</p>
              </div>
              <button type="button" onClick={addSelectedParticipantsToCrew} className="btn-secondary text-sm whitespace-nowrap">
                + Add Selected to Crew
              </button>
            </div>
            <input
              type="text"
              value={participantSearch}
              onChange={e => setParticipantSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] mb-2"
              placeholder="Search saved acts by name, role, or genre..."
            />
            {filteredParticipantProfiles.length > 0 ? (
              <div className="max-h-44 overflow-auto border border-gray-100 rounded-lg">
                {filteredParticipantProfiles.map(profile => {
                  const checked = (form.participantProfileIds || []).includes(profile.id);
                  return (
                    <label key={profile.id} className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0 cursor-pointer">
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleParticipantSelection(profile.id)}
                          className="accent-[#c8a45e]"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate">{profile.name}</span>
                          <span className="block text-xs text-gray-500 truncate">
                            {profile.role || 'Performer'}{profile.genre ? ` · ${profile.genre}` : ''}
                          </span>
                          {profile?.metadata?.defaultOfficialAssetsOnly && (
                            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-[#f8f2e4] text-[#7f5f2b] border border-[#d8bf84]">
                              Official assets default
                            </span>
                          )}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 m-0">No saved acts yet. Add a crew member below, then save them to your library.</p>
            )}
            {participantStatus && <p className="text-xs text-gray-600 mt-2 mb-0">{participantStatus}</p>}
          </div>

          <div className="card mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" value={crewName} onChange={e => setCrewName(e.target.value)} placeholder="Name"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
              <select value={crewRole} onChange={e => {
                const value = e.target.value;
                setCrewRole(value);
                if (isTheaterGenre) setCrewDepartment(getTheaterDepartmentForRole(value) || '');
              }}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white min-w-[200px]">
                <option value="">Select role...</option>
                {roleGroups.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {(group.roles || []).map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                ))}
              </select>
              {isTheaterGenre ? (
                <select value={crewDepartment} onChange={e => setCrewDepartment(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
                  <option value="">Select department...</option>
                  {THEATER_DEPARTMENTS.map(dept => <option key={dept.key} value={dept.label}>{dept.label}</option>)}
                </select>
              ) : (
                <button type="button" onClick={addCrew} className="btn-primary whitespace-nowrap">+ Add</button>
              )}
            </div>
            {isTheaterGenre && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                <input type="email" value={crewEmail} onChange={e => setCrewEmail(e.target.value)} placeholder="Email (optional)"
                  className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                <input type="tel" value={crewPhone} onChange={e => setCrewPhone(e.target.value)} placeholder="Phone (optional)"
                  className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                <input type="text" value={crewCallTime} onChange={e => setCrewCallTime(e.target.value)} placeholder="Call Time (ex: 5:30 PM)"
                  className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                <button type="button" onClick={addCrew} className="btn-primary whitespace-nowrap">+ Add Crew Member</button>
              </div>
            )}
            {isTheaterGenre && (
              <div className="mt-3">
                <textarea value={crewNotes} onChange={e => setCrewNotes(e.target.value)} rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                  placeholder="Role notes: headset channel, cue responsibilities, backstage zone..." />
              </div>
            )}
          </div>

          {crew.length > 0 ? (
            <div className="space-y-2">
              {crew.map(c => (
                <div key={c.id} className="flex items-start justify-between p-3 bg-[#f5f5f5] rounded-lg gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{c.name}</span>
                      <span className="text-xs text-gray-500">({c.role})</span>
                      {c.department && <span className="text-[10px] bg-white border border-gray-200 px-1.5 py-0.5 rounded">{c.department}</span>}
                      {c.callTime && <span className="text-[10px] bg-[#faf8f3] border border-[#c8a45e] px-1.5 py-0.5 rounded">Call: {c.callTime}</span>}
                    </div>
                    {(c.email || c.phone) && (
                      <div className="text-xs text-gray-500 mt-1">
                        {c.email}{c.email && c.phone ? ' · ' : ''}{c.phone}
                      </div>
                    )}
                    {c.notes && <div className="text-xs text-gray-600 mt-1">{c.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveCrewMemberToLibrary(c)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-600 hover:border-[#c8a45e]"
                    >
                      Save
                    </button>
                    <button onClick={() => removeCrew(c.id)} className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer">✕</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-6">No crew added yet. Snap a playbill, paste an email, or add them manually above.</p>
          )}
        </div>
      );

      case 3: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Venue & Tickets</h2>
          <p className="text-gray-500 mb-4">Confirm venue and add ticket information</p>

          <SnapAutoFill
            context="venue"
            hint="Snap a business card, venue sign, or storefront : AI extracts name, address, phone, website"
            extracting={extracting.venue}
            onExtract={(files) => handleExtract(files, 'venue')}
          />

          <div className="card mb-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-base mb-1">Saved Venues</h3>
                <p className="text-xs text-gray-500 m-0">Reuse venue details instead of typing the same location every time.</p>
              </div>
              <button type="button" onClick={saveCurrentVenueToLibrary} className="btn-secondary text-sm whitespace-nowrap">
                Save Current Venue
              </button>
            </div>
            <select
              value={form.venueProfileId || ''}
              onChange={(e) => loadVenueProfileIntoForm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
            >
              <option value="">Select a saved venue...</option>
              {(venueProfiles || []).map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}{profile.city ? ` · ${profile.city}` : ''}{profile.state ? `, ${profile.state}` : ''}
                </option>
              ))}
            </select>
            {venueLibraryStatus && <p className="text-xs text-gray-600 mt-2 mb-0">{venueLibraryStatus}</p>}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
              <input type="text" value={form.venue} onChange={update('venue')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="The Aztec Theatre" />
              {venueLookupLoading && (
                <p className="text-xs text-[#c8a45e] mt-1 mb-0">Looking up venues...</p>
              )}
              {!venueLookupLoading && venueSuggestions.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg bg-white overflow-hidden">
                  {venueSuggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.placeId || suggestion.localVenueProfileId || suggestion.id || 'venue'}-${index}`}
                      type="button"
                      onClick={() => applyVenueSuggestion(suggestion)}
                      className="w-full text-left px-3 py-2 bg-white border-0 border-b border-gray-100 last:border-b-0 hover:bg-[#faf8f3] cursor-pointer"
                    >
                      <p className="text-sm m-0">{suggestion.mainText || suggestion.label}</p>
                      {(suggestion.secondaryText || suggestion.label) && (
                        <p className="text-xs text-gray-500 m-0 mt-0.5">{suggestion.secondaryText || suggestion.label}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {venueLookupStatus && <p className="text-xs text-gray-500 mt-1 mb-0">{venueLookupStatus}</p>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Number</label>
                <input type="text" value={form.venueStreetNumber} onChange={update('venueStreetNumber')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="104" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Name</label>
                <input type="text" value={form.venueStreetName} onChange={update('venueStreetName')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="N St Mary's St" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suite/Unit</label>
              <input type="text" value={form.venueSuite} onChange={update('venueSuite')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="Suite 100 (optional)" />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={form.venueCity} onChange={update('venueCity')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="San Antonio" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={form.venueState} onChange={update('venueState')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="TX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input type="text" value={form.venueZip} onChange={update('venueZip')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="78205" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.venuePhone} onChange={update('venuePhone')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="(210) 555-1234" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input type="url" value={form.venueWebsite} onChange={update('venueWebsite')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="https://theaztectheatre.com" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Link</label>
                <input type="url" value={form.ticketLink} onChange={update('ticketLink')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="https://eventbrite.com/..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Price</label>
                <input type="text" value={form.ticketPrice} onChange={e => {
                  const val = e.target.value;
                  setForm({ ...form, ticketPrice: val });
                }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="$25 / Free / $15-$50" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticketing Provider</label>
                <select
                  value={form.ticketProvider}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      ticketProvider: nextValue,
                      ticketProviderOther: nextValue === 'other' ? prev.ticketProviderOther : '',
                    }));
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
                >
                  <option value="manual">Manual / Unknown</option>
                  <option value="eventbrite">Eventbrite</option>
                  <option value="ticketmaster">Ticketmaster</option>
                  <option value="universe">Universe</option>
                  <option value="square">Square</option>
                  <option value="etix">Etix</option>
                  <option value="other">Other</option>
                </select>
                {form.ticketProvider === 'other' && (
                  <input
                    type="text"
                    value={form.ticketProviderOther}
                    onChange={update('ticketProviderOther')}
                    className="w-full mt-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                    placeholder="Type ticketing provider"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider Event ID (Optional)</label>
                <input
                  type="text"
                  value={form.ticketProviderEventId}
                  onChange={update('ticketProviderEventId')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder={resolveTicketProviderForStorage(form) === 'eventbrite' ? 'Eventbrite event ID' : 'Provider event identifier'}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seats Available (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={form.seatsAvailable}
                  onChange={update('seatsAvailable')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder={selectedZone?.capacity ? String(selectedZone.capacity) : '120'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tickets Sold (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={form.ticketSalesCount}
                  onChange={update('ticketSalesCount')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="card">
              <h3 className="text-base mb-2">Zone-Aware Booking</h3>
              <p className="text-xs text-gray-500 mb-3">Choose a performance zone and booking window. Conflicts are blocked within the same zone.</p>
              {!canAssignProduction && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                  Read-only: booking agents or venue admins can edit zone/time assignments.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Performance Zone</label>
                  <select
                    value={form.performanceZoneId}
                    onChange={e => setForm(prev => ({ ...prev, performanceZoneId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:border-[#c8a45e]"
                    disabled={!canAssignProduction}
                  >
                    <option value="">No specific zone</option>
                    {zoneOptions.map(zone => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}{zone.zone_type ? ` · ${zone.zone_type}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedZone && (
                    <p className="text-xs text-gray-500 mt-1 mb-0">
                      {selectedZone.width_ft && selectedZone.depth_ft ? `${selectedZone.width_ft}ft x ${selectedZone.depth_ft}ft` : 'Dimensions TBD'}
                      {selectedZone.capacity ? ` · Cap ${selectedZone.capacity}` : ''}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Booking Status</label>
                  <select
                    value={form.bookingStatus}
                    onChange={e => setForm(prev => ({ ...prev, bookingStatus: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:border-[#c8a45e]"
                    disabled={!canAssignProduction}
                  >
                    {BOOKING_STATUSES.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Booking Start</label>
                  <input
                    type="datetime-local"
                    value={form.bookingStartAt ? String(form.bookingStartAt).slice(0, 16) : ''}
                    onChange={e => setForm(prev => ({ ...prev, bookingStartAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    disabled={!canAssignProduction}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Booking End</label>
                  <input
                    type="datetime-local"
                    value={form.bookingEndAt ? String(form.bookingEndAt).slice(0, 16) : ''}
                    onChange={e => setForm(prev => ({ ...prev, bookingEndAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                    disabled={!canAssignProduction}
                  />
                </div>
              </div>

              {form.performanceZoneId && bookingConflicts.length > 0 && (
                <div className="mt-3 p-3 rounded border border-red-200 bg-red-50">
                  <p className="text-sm text-red-700 font-semibold m-0">Zone conflict detected</p>
                  <p className="text-xs text-red-600 mt-1 mb-0">
                    {formatZoneConflictSummary(bookingConflicts)}
                  </p>
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="text-base mb-2">Show Configuration</h3>
              <p className="text-xs text-gray-500 mb-3">Attach a reusable stage plot + tech configuration to this booking.</p>

              <select
                value={form.showConfigurationId}
                onChange={e => setForm(prev => ({ ...prev, showConfigurationId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:border-[#c8a45e]"
                disabled={!canAssignProduction}
              >
                <option value="">No show configuration selected</option>
                {(showConfigurations || []).map(config => (
                  <option key={config.id} value={config.id}>
                    {config.name}{config.show_type ? ` · ${config.show_type}` : ''}
                  </option>
                ))}
              </select>

              {selectedShowConfiguration && (
                <p className="text-xs text-gray-500 mt-2 mb-0">
                  {selectedShowConfiguration.summary || selectedShowConfiguration.plot_summary || 'Configuration selected.'}
                </p>
              )}

              <div className="mt-3 border-t border-gray-200 pt-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">Quick Create from Template</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={showTemplateType}
                    onChange={e => {
                      setShowTemplateType(e.target.value);
                      setShowTemplateKey('');
                    }}
                    className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
                    disabled={!canAssignProduction}
                  >
                    {SHOW_TYPE_OPTIONS.map(type => (
                      <option key={type.key} value={type.key}>{type.label}</option>
                    ))}
                  </select>
                  <select
                    value={showTemplateKey}
                    onChange={e => setShowTemplateKey(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
                    disabled={!canAssignProduction}
                  >
                    <option value="">Select template</option>
                    {(SHOW_TEMPLATE_OPTIONS[showTemplateType] || []).map(template => (
                      <option key={template.key} value={template.key}>{template.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    max="128"
                    value={showTemplateCount}
                    onChange={e => setShowTemplateCount(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded text-sm"
                    placeholder="Members / cast count"
                    disabled={!canAssignProduction}
                  />
                </div>
                <button type="button" onClick={createShowConfigFromTemplate} className="btn-secondary text-sm mt-2" disabled={!canCreateShowTemplate || !canAssignProduction}>
                  Create and Attach Show Config
                </button>
                {showConfigStatus && <p className="text-xs text-gray-600 mt-2 mb-0">{showConfigStatus}</p>}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-base m-0">Show Contacts</h3>
                <button type="button" onClick={addShowContact} className="btn-secondary text-sm" disabled={!canAssignProduction}>+ Add Contact</button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Day-of-show contacts for production and venue coordination.</p>
              {(form.showContacts || []).length === 0 ? (
                <p className="text-xs text-gray-500 m-0">No contacts added yet. Add your first day-of-show contact above.</p>
              ) : (
                <div className="space-y-2">
                  {(form.showContacts || []).map((contact, index) => (
                    <div key={`${contact.role || 'contact'}-${index}`} className="border border-gray-200 rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <select value={contact.role || ''} onChange={e => upsertShowContact(index, { role: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white" disabled={!canAssignProduction}>
                          {SHOW_CONTACT_ROLE_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                        <input type="text" value={contact.name || ''} onChange={e => upsertShowContact(index, { name: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Name" disabled={!canAssignProduction} />
                        <input type="text" value={contact.title || ''} onChange={e => upsertShowContact(index, { title: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Title" disabled={!canAssignProduction} />
                        <input type="tel" value={contact.phone || ''} onChange={e => upsertShowContact(index, { phone: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Phone" disabled={!canAssignProduction} />
                        <input type="email" value={contact.email || ''} onChange={e => upsertShowContact(index, { email: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Email" disabled={!canAssignProduction} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <label className="text-xs text-gray-600 inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!contact.isPrimary}
                            onChange={e => {
                              const checked = e.target.checked;
                              setForm(prev => ({
                                ...prev,
                                showContacts: (prev.showContacts || []).map((row, idx) => (
                                  idx === index ? { ...row, isPrimary: checked } : { ...row, isPrimary: checked ? false : !!row.isPrimary }
                                )),
                              }));
                            }}
                            className="accent-[#c8a45e]"
                            disabled={!canAssignProduction}
                          />
                          Primary day-of-show contact
                        </label>
                        <button type="button" onClick={() => removeShowContact(index)} className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded bg-white" disabled={!canAssignProduction}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );

      case 4: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Event Sponsors</h2>
          <p className="text-gray-500 mb-6">Add sponsors, partners, and supporters. Their logos and names will appear in your press materials, social posts, and event graphics.</p>
          <SponsorEditor sponsors={form.sponsors} onChange={(sponsors) => setForm({ ...form, sponsors })} />
        </div>
      );

      case 5: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Media Upload</h2>
          <p className="text-gray-500 mb-4">Upload photos, flyers, artist headshots</p>

          <label className="text-sm flex items-start gap-2 p-3 border border-gray-200 rounded-lg bg-white mb-4">
            <input
              type="checkbox"
              checked={!!form.officialAssetsOnly}
              onChange={(e) => {
                setOfficialAssetsTouched(true);
                setForm(prev => ({ ...prev, officialAssetsOnly: e.target.checked }));
              }}
              className="mt-0.5 accent-[#c8a45e]"
            />
            <span>
              <strong>Use Official Uploaded Artwork Only</strong><br />
              Keep flyer/poster/banner files exactly as provided. IMC Composer will skip AI graphics for this event and distribute with approved assets.
            </span>
          </label>

          <div className="card border-2 border-dashed border-[#c8a45e] bg-[#faf8f3] text-center py-12">
            {extracting.media && <p className="text-sm text-[#c8a45e] animate-pulse mb-3">🔍 Processing...</p>}
            <p className="text-4xl mb-3">📁</p>
            <p className="text-gray-500 mb-1">Upload event photos, flyers, headshots, and graphics</p>
            <p className="text-xs text-gray-400 mb-4">These will be stored to Google Drive and used for campaign visuals</p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={async () => { try { const f = await openCamera(); handleExtract([f], 'media'); } catch {} }}
                className="btn-primary text-sm" disabled={extracting.media}>📷 Take Photo</button>
              <button type="button" onClick={async () => { try { const files = await openFileUpload(true); handleExtract(files, 'media'); } catch {} }}
                className="btn-secondary text-sm" disabled={extracting.media}>📁 Upload Files</button>
            </div>
          </div>
          {uploadedImages.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">{uploadedImages.length} file{uploadedImages.length !== 1 ? 's' : ''} uploaded</p>
              <div className="grid grid-cols-4 gap-3">
                {uploadedImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img.url} alt={img.name} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                    <p className="text-xs text-gray-500 mt-1 truncate">{img.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

      case 6: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Brand & Voice</h2>
          <p className="text-gray-500 mb-4">Confirm your brand settings for this campaign</p>

          <SnapAutoFill
            context="brand"
            hint="Snap existing marketing materials, merch, signage, or social posts : AI detects brand colors, fonts, and tone"
            extracting={extracting.brand}
            onExtract={(files) => handleExtract(files, 'brand')}
          />

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand Colors</label>
              <input type="text" value={form.brandColors} onChange={update('brandColors')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="#0d1b2a, #c8a45e" />
              {form.brandColors && (
                <div className="flex gap-2 mt-2">
                  {form.brandColors.split(',').map((c, i) => {
                    const hex = c.trim();
                    return hex.startsWith('#') ? (
                      <div key={i} className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: hex }} />
                        <span className="text-xs text-gray-500 font-mono">{hex}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Detected Fonts</label>
              <input type="text" value={form.detectedFonts} onChange={update('detectedFonts')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-gray-50"
                placeholder="Auto-detected from scanned materials" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Writing Tone</label>
              <select value={form.writingTone} onChange={update('writingTone')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
                <option>Professional yet approachable</option>
                <option>Casual and fun</option>
                <option>Formal and elegant</option>
                <option>Edgy and bold</option>
                <option>Warm and community-focused</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
              <textarea value={form.specialInstructions} onChange={update('specialInstructions')} rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                placeholder="Any specific notes for content generation..." />
            </div>
          </div>
        </div>
      );

      case 7: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Distribution Channels</h2>
          <p className="text-gray-500 mb-6">Toggle which channels to include in your IMC campaign</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CHANNELS.map(ch => (
              <button key={ch.key}
                onClick={() => setChannels(prev => ({ ...prev, [ch.key]: !prev[ch.key] }))}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer bg-white ${
                  channels[ch.key] ? 'border-[#c8a45e] bg-[#faf8f3]' : 'border-gray-200'
                }`}>
                <span className="text-2xl">{ch.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{ch.label}</div>
                  <div className="text-xs text-gray-500">{ch.desc}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  channels[ch.key] ? 'border-[#c8a45e] bg-[#c8a45e]' : 'border-gray-300'
                }`}>
                  {channels[ch.key] && <span className="text-white text-xs">✓</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      );

      case 8: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Review & Launch</h2>
          <p className="text-gray-500 mb-6">Review everything before generating your IMC campaign</p>

          <div className="space-y-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Genre</h3>
              <p className="text-lg">{GENRES.find(g => g.key === form.genre)?.icon} {form.genre}</p>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Event</h3>
              <p className="text-lg font-semibold">{form.title || 'Untitled'}</p>
              <p className="text-sm text-gray-500">{form.date} at {form.time} · {form.venue}</p>
              {form.venueAddress && <p className="text-xs text-gray-400">{form.venueAddress}</p>}
              {form.description && <p className="text-sm mt-2">{form.description}</p>}
              {form.ticketPrice && <p className="text-sm text-[#c8a45e] mt-1">🎟️ {form.ticketPrice}</p>}
              {resolveTicketProviderForStorage(form) && resolveTicketProviderForStorage(form) !== 'manual' && (
                <p className="text-xs text-gray-500 mt-1">
                  Provider: {ticketProviderLabel(form)}
                  {form.ticketProviderEventId ? ` · ID: ${form.ticketProviderEventId}` : ''}
                </p>
              )}
              {(form.seatsAvailable || form.ticketSalesCount) && (
                <p className="text-xs text-gray-500 mt-1">
                  {form.seatsAvailable ? `Seats: ${form.seatsAvailable}` : 'Seats: —'}
                  {form.ticketSalesCount ? ` · Sold: ${form.ticketSalesCount}` : ''}
                </p>
              )}
            </div>
            {form.recurrenceEnabled && Number.parseInt(form.recurrenceCount, 10) > 1 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Recurring Series</h3>
                <p className="text-sm m-0">
                  {form.seriesName || `${form.title || 'Event'} Series`} · {recurrenceSummaryText(form)}
                </p>
              </div>
            )}
            {form.participantProfileIds?.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Reusable Acts</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedParticipantProfiles.map(profile => (
                    <span key={profile.id} className="text-xs bg-[#faf8f3] border border-[#c8a45e] px-2 py-1 rounded">
                      {profile.name}{profile.role ? ` (${profile.role})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {form.venueProfileId && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Saved Venue Profile</h3>
                <p className="text-sm m-0">
                  {(venueProfiles || []).find(v => v.id === form.venueProfileId)?.name || form.venue}
                </p>
              </div>
            )}
            {(form.performanceZoneId || form.showConfigurationId || (form.showContacts || []).length > 0) && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Production Booking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {form.performanceZoneName && <p className="m-0"><span className="text-gray-500">Zone:</span> {form.performanceZoneName}</p>}
                  {form.bookingStatus && <p className="m-0"><span className="text-gray-500">Status:</span> {form.bookingStatus}</p>}
                  {form.bookingStartAt && <p className="m-0"><span className="text-gray-500">Start:</span> {form.bookingStartAt}</p>}
                  {form.bookingEndAt && <p className="m-0"><span className="text-gray-500">End:</span> {form.bookingEndAt}</p>}
                  {selectedShowConfiguration?.name && <p className="m-0"><span className="text-gray-500">Show Config:</span> {selectedShowConfiguration.name}</p>}
                </div>
                {(form.showContacts || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(form.showContacts || []).map((contact, idx) => (
                      <span key={`${contact.name || contact.role || 'contact'}-${idx}`} className="text-xs bg-[#f5f5f5] px-2 py-1 rounded">
                        {contact.name || 'Contact'} ({contact.role || contact.title || 'role'}){contact.isPrimary ? ' · Primary' : ''}
                      </span>
                    ))}
                  </div>
                )}
                {form.performanceZoneId && bookingConflicts.length > 0 && (
                  <p className="text-xs text-red-600 mt-2 mb-0">
                    Conflict: {formatZoneConflictSummary(bookingConflicts)}
                  </p>
                )}
              </div>
            )}
            {isTheaterGenre && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Theater Production</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {form.productionType && <p className="m-0"><span className="text-gray-500">Type:</span> {form.productionType}</p>}
                  {form.unionHouse && <p className="m-0"><span className="text-gray-500">Union:</span> {form.unionHouse}</p>}
                  {form.stageFormat && <p className="m-0"><span className="text-gray-500">Stage:</span> {form.stageFormat}</p>}
                  {form.runtimeMinutes && <p className="m-0"><span className="text-gray-500">Runtime:</span> {form.runtimeMinutes} min</p>}
                  {form.intermissions && <p className="m-0"><span className="text-gray-500">Intermissions:</span> {form.intermissions}</p>}
                  {form.rehearsalStart && <p className="m-0"><span className="text-gray-500">Rehearsal:</span> {form.rehearsalStart}</p>}
                  {form.openingNight && <p className="m-0"><span className="text-gray-500">Opening:</span> {form.openingNight}</p>}
                  {form.closingNight && <p className="m-0"><span className="text-gray-500">Closing:</span> {form.closingNight}</p>}
                </div>
                {form.productionNotes && <p className="text-xs text-gray-600 mt-2 mb-0">{form.productionNotes}</p>}
              </div>
            )}
            {isLegalCleGenre && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">CLE Program</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="m-0"><span className="text-gray-500">Mode:</span> {LEGAL_WORKFLOW_MODES.find((mode) => mode.value === normalizeLegalWorkflowMode(form.legalWorkflowMode))?.label || 'CLE Compliance + Promotion'}</p>
                  <p className="m-0"><span className="text-gray-500">Approval Gate:</span> {form.distributionApprovalRequired ? 'Required' : 'Optional'}</p>
                  {form.distributionApproved && <p className="m-0"><span className="text-gray-500">Approved:</span> Yes</p>}
                  {form.distributionApprovedBy && <p className="m-0"><span className="text-gray-500">Approved By:</span> {form.distributionApprovedBy}</p>}
                  {form.cleCreditHours && <p className="m-0"><span className="text-gray-500">Credit Hours:</span> {form.cleCreditHours}</p>}
                  {form.legalJurisdiction && <p className="m-0"><span className="text-gray-500">Jurisdiction:</span> {form.legalJurisdiction}</p>}
                  {form.mcleAccreditationProvider && <p className="m-0"><span className="text-gray-500">Provider:</span> {form.mcleAccreditationProvider}</p>}
                  {form.barAssociationSponsor && <p className="m-0"><span className="text-gray-500">Sponsor:</span> {form.barAssociationSponsor}</p>}
                  {form.mcleApprovalCode && <p className="m-0"><span className="text-gray-500">Approval Code:</span> {form.mcleApprovalCode}</p>}
                  {form.mcleStatus && <p className="m-0"><span className="text-gray-500">Status:</span> {form.mcleStatus}</p>}
                  {form.includeLegalDisclaimer && <p className="m-0"><span className="text-gray-500">Disclaimer:</span> {getLegalDisclaimerTemplate(form.legalDisclaimerTemplate).label}</p>}
                  {form.cleBarNumbersCollected && <p className="m-0"><span className="text-gray-500">Bar Numbers:</span> {form.cleBarNumbersCollected}</p>}
                  {form.cleRegistrants && <p className="m-0"><span className="text-gray-500">Registrants:</span> {form.cleRegistrants}</p>}
                  {form.cleCheckIns && <p className="m-0"><span className="text-gray-500">Check-Ins:</span> {form.cleCheckIns}</p>}
                  {form.cleCertificatesIssued && <p className="m-0"><span className="text-gray-500">Certificates:</span> {form.cleCertificatesIssued}</p>}
                  {form.cleCertificatesDeliveredAt && <p className="m-0"><span className="text-gray-500">Delivered:</span> {form.cleCertificatesDeliveredAt}</p>}
                  {form.cleAttendanceExportedAt && <p className="m-0"><span className="text-gray-500">Attendance Export:</span> {form.cleAttendanceExportedAt}</p>}
                  {form.cleComplianceOwner && <p className="m-0"><span className="text-gray-500">Compliance Owner:</span> {form.cleComplianceOwner}</p>}
                  {form.ticketSalesCount && <p className="m-0"><span className="text-gray-500">Tickets Sold:</span> {form.ticketSalesCount}</p>}
                  {form.grossTicketRevenue && <p className="m-0"><span className="text-gray-500">Gross Revenue:</span> ${form.grossTicketRevenue}</p>}
                  {form.netPayoutRevenue && <p className="m-0"><span className="text-gray-500">Net Payout:</span> ${form.netPayoutRevenue}</p>}
                  {form.sponsorshipRevenue && <p className="m-0"><span className="text-gray-500">Sponsorship:</span> ${form.sponsorshipRevenue}</p>}
                  {form.reconciliationStatus && <p className="m-0"><span className="text-gray-500">Reconciliation:</span> {String(form.reconciliationStatus).replace(/_/g, ' ')}</p>}
                  {form.analyticsSource && <p className="m-0"><span className="text-gray-500">Source:</span> {form.analyticsSource}</p>}
                  {form.analyticsLastSyncedAt && <p className="m-0"><span className="text-gray-500">Last Synced:</span> {form.analyticsLastSyncedAt}</p>}
                  {form.stakeholderReportExportedAt && <p className="m-0"><span className="text-gray-500">Report Exported:</span> {form.stakeholderReportExportedAt}</p>}
                </div>
                {form.cleProgramNotes && <p className="text-xs text-gray-600 mt-2 mb-0">{form.cleProgramNotes}</p>}
                {form.distributionApprovalNotes && <p className="text-xs text-gray-600 mt-2 mb-0">Approval Notes: {form.distributionApprovalNotes}</p>}
                {form.cleComplianceNotes && <p className="text-xs text-gray-600 mt-2 mb-0">Compliance Notes: {form.cleComplianceNotes}</p>}
              </div>
            )}
            {crew.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Cast & Crew ({crew.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {crew.map(c => (
                    <span key={c.id} className="text-xs bg-[#f5f5f5] px-2 py-1 rounded">
                      {c.name} ({c.role}){c.department ? ` · ${c.department}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Brand</h3>
              <div className="flex gap-2 items-center">
                {form.brandColors.split(',').map((c, i) => {
                  const hex = c.trim();
                  return hex.startsWith('#') ? (
                    <div key={i} className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: hex }} />
                  ) : null;
                })}
                <span className="text-sm text-gray-500 ml-2">{form.writingTone}</span>
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Channels ({Object.values(channels).filter(Boolean).length})</h3>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.filter(c => channels[c.key]).map(c => (
                  <span key={c.key} className="text-xs bg-[#faf8f3] border border-[#c8a45e] px-2 py-1 rounded">{c.icon} {c.label}</span>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Artwork Mode</h3>
              <p className="text-sm m-0">
                {form.officialAssetsOnly
                  ? 'Official uploaded artwork only (AI graphics skipped).'
                  : 'AI graphics allowed if you choose to generate them in IMC Composer.'}
              </p>
            </div>
            {uploadedImages.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Media ({uploadedImages.length})</h3>
                <div className="flex gap-2">
                  {uploadedImages.slice(0, 8).map((img, i) => (
                    <img key={i} src={img.url} alt="" className="w-12 h-12 object-cover rounded" />
                  ))}
                  {uploadedImages.length > 8 && <span className="text-xs text-gray-400 self-center">+{uploadedImages.length - 8} more</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      {showAiIntakeStarter && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-lg p-4 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 m-0">AI Intake Starter</p>
              <h2 className="text-xl m-0" style={{ fontFamily: "'Playfair Display', serif" }}>Let&apos;s build this from source material</h2>
              <p className="text-sm text-gray-600 m-0">
                Pick your intake style. I will extract the details, draft the fields, and you approve before anything saves.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                className="w-full rounded-lg border border-[#0d1b2a] bg-[#0d1b2a] text-white px-4 py-3 text-left"
                onClick={() => acknowledgeAiIntakeStarter('voice')}
              >
                <span className="block text-sm font-semibold">🎙 Speak</span>
                <span className="block text-xs text-white/80">Talk it through and I will transcribe into form fields.</span>
              </button>
              <button
                type="button"
                className="w-full rounded-lg border border-[#c8a45e] bg-[#faf8f3] text-[#0d1b2a] px-4 py-3 text-left"
                onClick={() => acknowledgeAiIntakeStarter('paste')}
              >
                <span className="block text-sm font-semibold">📧 Paste Email</span>
                <span className="block text-xs text-gray-600">Drop the thread and signature block. I will pull contact, venue, and event clues.</span>
              </button>
              <button
                type="button"
                className="w-full rounded-lg border border-gray-300 bg-white text-[#0d1b2a] px-4 py-3 text-left"
                onClick={() => acknowledgeAiIntakeStarter('upload')}
              >
                <span className="block text-sm font-semibold">📎 Upload File</span>
                <span className="block text-xs text-gray-600">Use a photo, scan, PDF, or Word doc and I will extract what matters.</span>
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-secondary text-xs" onClick={() => acknowledgeAiIntakeStarter()}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <h1 className="text-3xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Start New Event</h1>

      <FormAIAssist
        formType="event"
        currentForm={form}
        onApply={applyEventPatch}
        title="Event AI Assistant"
        description={aiIntakeMode
          ? "Paste the email (signature and all), or speak it out loud. I will extract the people, place, date, and event details so you can approve and move fast."
          : "Say event details once by voice or text, and I will map them into basics, venue, ticketing, brand, production, and legal fields."}
        sourceContext="event_create_form"
        entityType="event"
        entityId={form?.id || ''}
        defaultOpen={aiIntakeMode && !showAiIntakeStarter}
        defaultTab={eventAssistDefaultTab}
        openSignal={eventAssistOpenSignal}
      />

      <CompletionBar completed={step + 1} total={STEP_LABELS.length} label={`Step ${step + 1}: ${STEP_LABELS[step]}`} />

      {/* Step indicators */}
      <div className="flex gap-1 mb-8">
        {STEP_LABELS.map((label, i) => (
          <button key={i} onClick={() => i <= step && setStep(i)}
            className={`flex-1 h-1.5 rounded-full transition-colors cursor-pointer border-none ${
              i <= step ? 'bg-[#c8a45e]' : 'bg-gray-200'
            }`}
            title={label}
          />
        ))}
      </div>

      {renderStep()}

      <div className="mt-6 border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold m-0">Stakeholder Export · {currentStepLabel}</h3>
          <p className="text-[11px] text-gray-600 m-0">
            Completion: {stepCompletion.done}/{stepCompletion.total || 1}
          </p>
        </div>
        <p className="text-[11px] text-gray-500 m-0">
          Export this step as proof for stakeholders. Add emails and I will send the same report directly from here.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded bg-white">
            <input
              type="checkbox"
              checked={stepExportForm.markComplete}
              onChange={(e) => setStepExportForm((prev) => ({ ...prev, markComplete: e.target.checked }))}
            />
            Mark this step complete (auto-detected: {stepCompletion.isComplete ? 'yes' : 'no'})
          </label>
          <input
            type="text"
            value={stepExportForm.completedBy}
            onChange={(e) => setStepExportForm((prev) => ({ ...prev, completedBy: e.target.value }))}
            className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
            placeholder="Completed by (name)"
          />
          <input
            type="text"
            value={stepExportForm.nextStep}
            onChange={(e) => setStepExportForm((prev) => ({ ...prev, nextStep: e.target.value }))}
            className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white md:col-span-2"
            placeholder={nextStepLabel ? `Next step (default: Move to ${nextStepLabel})` : 'Next step for stakeholders'}
          />
          <input
            type="text"
            value={stepExportForm.recipients}
            onChange={(e) => setStepExportForm((prev) => ({ ...prev, recipients: e.target.value }))}
            className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white md:col-span-2"
            placeholder="Stakeholder emails (comma-separated)"
          />
          <textarea
            value={stepExportForm.notes}
            onChange={(e) => setStepExportForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={2}
            className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white md:col-span-2"
            placeholder="Completion notes for this step"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => handleExportCurrentStepForStakeholders({ sendEmail: false })}
          >
            Export Step PDF
          </button>
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={() => handleExportCurrentStepForStakeholders({ sendEmail: true })}
          >
            Export + Email Stakeholders
          </button>
        </div>
        {stepExportStatus && (
          <p className="text-xs text-gray-600 m-0">{stepExportStatus}</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button onClick={() => {
          setStepError('');
          setStep(s => s - 1);
        }} disabled={step === 0}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
            step === 0 ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-gray-700 border-gray-200 hover:border-[#c8a45e]'
          }`}>
          ← Back
        </button>

        {step < STEP_LABELS.length - 1 ? (
          <button onClick={handleNextStep}
            className={`btn-primary px-8 ${!canNext() ? 'opacity-90' : ''}`}>
            Keep Going →
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!form.title || !form.date || !form.genre || submitting}
            className={`px-8 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer border-none text-white ${
              !form.title || !form.date || !form.genre || submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#c8a45e] hover:bg-[#b8943e]'
            }`}>
            {submitting ? '⟳ Saving...' : '🚀 Build My IMC Campaign'}
          </button>
        )}
      </div>

      {stepError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {stepError}
        </div>
      )}
    </div>
  );
}
