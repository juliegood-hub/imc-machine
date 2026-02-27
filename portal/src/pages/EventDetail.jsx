import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useVenue } from '../context/VenueContext';
import { getEventCampaigns, deleteEvent } from '../lib/supabase';
import { parseLocalDate } from '../lib/dateUtils';
import BookingOperationsWorkspace from '../components/BookingOperationsWorkspace';
import TaylorZoneReferenceStrip from '../components/TaylorZoneReferenceStrip';
import {
  computePhaseGateStatus,
  computeProductionPhaseProgress,
  computeTaylorZoneProgress,
  computeEventWorkflowProgress,
  getNextIncompleteWorkflowSection,
  TAYLOR_FRAMEWORK_ATTRIBUTION,
  WORKFLOW_SECTIONS,
  getWorkflowTrackMeta,
  summarizeWorkflowProgress,
} from '../constants/workflowSections';
import {
  LEGAL_WORKFLOW_MODES,
  normalizeLegalWorkflowMode,
  getLegalDisclaimerTemplate,
  isLegalProgramGenre,
} from '../constants/legalProgram';

const STAFFING_DESTINATION_OPTIONS = [
  { value: 'manual', label: 'Manual / Internal Queue' },
  { value: 'email', label: 'Email Dispatch' },
  { value: 'webhook', label: 'Webhook (Zapier/Make)' },
  { value: 'union_local', label: 'Union Local Dispatch (Queued)' },
  { value: 'linkedin_jobs', label: 'LinkedIn Jobs (Queued)' },
  { value: 'indeed', label: 'Indeed (Queued)' },
];

const STAFFING_STATUS_OPTIONS = ['draft', 'queued', 'sent', 'filled', 'cancelled', 'failed'];
const DEAL_MEMO_STATUS_OPTIONS = ['draft', 'sent', 'signed', 'cancelled', 'archived'];
const CHECKIN_STATUS_OPTIONS = ['expected', 'checked_in', 'late', 'no_show', 'cancelled'];
const SETTLEMENT_STATUS_OPTIONS = ['draft', 'submitted', 'approved', 'paid', 'closed'];

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function addHours(dateTimeInput, hours = 3) {
  if (!dateTimeInput) return '';
  const date = new Date(dateTimeInput);
  if (Number.isNaN(date.getTime())) return '';
  date.setHours(date.getHours() + hours);
  return toDateTimeInput(date.toISOString());
}

function downloadBase64File(base64, mimeType, fileName) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildDefaultDealMemoForm(event = {}) {
  return {
    title: event?.title ? `${event.title} Deal Memo` : 'Deal Memo',
    status: 'draft',
    dealType: 'performance',
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    sellerName: '',
    sellerEmail: '',
    sellerPhone: '',
    eventDate: event?.date || '',
    venueName: event?.venue || '',
    compensationModel: 'guarantee',
    guaranteeAmount: '',
    depositAmount: '',
    backendSplit: '',
    doorSplit: '',
    merchSplit: '',
    settlementDueHours: '',
    payeeName: '',
    servicesDescription: '',
    governingLaw: 'Texas',
    signerEmails: '',
    promoCommitments: '',
    techRiderTerms: '',
    hospitalityTerms: '',
    cancellationTerms: '',
    forceMajeureTerms: '',
    notes: '',
  };
}

function mapDealMemoToForm(memo = {}, event = {}) {
  const defaults = buildDefaultDealMemoForm(event);
  const memoMeta = (memo?.metadata && typeof memo.metadata === 'object') ? memo.metadata : {};
  const signerEmails = Array.isArray(memoMeta.signerEmails)
    ? memoMeta.signerEmails.filter(Boolean).join(', ')
    : '';
  return {
    ...defaults,
    title: memo.title || defaults.title,
    status: memo.status || defaults.status,
    dealType: memo.deal_type || defaults.dealType,
    buyerName: memo.buyer_name || '',
    buyerEmail: memo.buyer_email || '',
    buyerPhone: memo.buyer_phone || '',
    sellerName: memo.seller_name || '',
    sellerEmail: memo.seller_email || '',
    sellerPhone: memo.seller_phone || '',
    eventDate: memo.event_date || defaults.eventDate,
    venueName: memo.venue_name || defaults.venueName,
    compensationModel: memo.compensation_model || defaults.compensationModel,
    guaranteeAmount: memo.guarantee_amount ?? '',
    depositAmount: memo.deposit_amount ?? '',
    backendSplit: memo.backend_split || '',
    doorSplit: memo.door_split || '',
    merchSplit: memo.merch_split || '',
    settlementDueHours: memo.settlement_due_hours ?? '',
    payeeName: memoMeta.payeeName || memo.seller_name || '',
    servicesDescription: memoMeta.servicesDescription || '',
    governingLaw: memoMeta.governingLaw || defaults.governingLaw,
    signerEmails,
    promoCommitments: memo.promo_commitments || '',
    techRiderTerms: memo.tech_rider_terms || '',
    hospitalityTerms: memo.hospitality_terms || '',
    cancellationTerms: memo.cancellation_terms || '',
    forceMajeureTerms: memo.force_majeure_terms || '',
    notes: memo.notes || '',
  };
}

function parseSignerEmails(raw = '', fallback = []) {
  const values = Array.isArray(raw) ? raw : String(raw || '').split(/[,;]+/);
  const fallbackValues = Array.isArray(fallback) ? fallback : [];
  const merged = [...values, ...fallbackValues]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(merged));
}

function moneyLabel(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return `$${parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildTexasLiveEventContractText(form = {}, event = {}) {
  const eventDate = form.eventDate || event?.date || 'TBD';
  const eventTime = event?.time || 'TBD';
  const venueName = form.venueName || event?.venue || 'Venue TBD';
  const amount = moneyLabel(form.guaranteeAmount);
  const deposit = moneyLabel(form.depositAmount);
  const payee = form.payeeName || form.sellerName || 'TBD';
  const payer = form.buyerName || 'TBD';
  const services = form.servicesDescription || form.promoCommitments || 'Live event performance and related event services.';
  const law = form.governingLaw || 'Texas';
  const signerEmails = parseSignerEmails(form.signerEmails, [form.buyerEmail, form.sellerEmail]);

  return [
    `${form.title || `${event?.title || 'Live Event'} Contract`}`,
    '',
    'NOTICE: Informational template only. This document is not legal advice.',
    'Review with qualified Texas counsel before relying on it.',
    '',
    '1) Parties',
    `Buyer/Promoter: ${payer}${form.buyerEmail ? ` (${form.buyerEmail})` : ''}${form.buyerPhone ? ` · ${form.buyerPhone}` : ''}`,
    `Artist/Provider (Payee): ${payee}${form.sellerEmail ? ` (${form.sellerEmail})` : ''}${form.sellerPhone ? ` · ${form.sellerPhone}` : ''}`,
    '',
    '2) Event Details',
    `Event: ${event?.title || 'TBD'}`,
    `Date/Time: ${eventDate}${eventTime ? ` at ${eventTime}` : ''}`,
    `Venue: ${venueName}`,
    '',
    '3) Services (for what)',
    services,
    '',
    '4) Compensation (amount paid to whom)',
    `Total Compensation: ${amount || 'TBD'}`,
    `Payee: ${payee}`,
    `Deposit: ${deposit || 'None specified'}`,
    form.backendSplit ? `Backend Split: ${form.backendSplit}` : 'Backend Split: —',
    form.doorSplit ? `Door Split: ${form.doorSplit}` : 'Door Split: —',
    form.merchSplit ? `Merch Split: ${form.merchSplit}` : 'Merch Split: —',
    form.settlementDueHours ? `Settlement Due: ${form.settlementDueHours} hours after performance` : 'Settlement Due: —',
    '',
    '5) Operations + Performance Terms',
    form.techRiderTerms || 'Technical rider terms to be attached and incorporated.',
    '',
    '6) Hospitality',
    form.hospitalityTerms || 'Hospitality terms to be confirmed by both parties.',
    '',
    '7) Promo Commitments',
    form.promoCommitments || 'Promo commitments to be confirmed by both parties.',
    '',
    '8) Cancellation + Force Majeure',
    form.cancellationTerms || 'Cancellation terms to be confirmed by both parties.',
    form.forceMajeureTerms || 'Force majeure terms to be confirmed by both parties.',
    '',
    '9) Governing Law',
    `${law} (State of Texas)`,
    '',
    '10) Signature Routing',
    signerEmails.length ? signerEmails.join(', ') : 'No routing emails set yet.',
    '',
    '11) Additional Notes',
    form.notes || 'None.',
    '',
    'Signature Blocks',
    `Buyer/Promoter: ________________________ Date: __________`,
    `Artist/Provider: _______________________ Date: __________`,
  ].join('\n');
}

function buildDefaultCheckinForm() {
  return {
    contactName: '',
    contactRole: '',
    contactType: 'crew',
    credentialLabel: '',
    phone: '',
    email: '',
    status: 'expected',
    notes: '',
  };
}

function buildDefaultSettlementForm(event = {}) {
  return {
    title: event?.title ? `${event.title} Settlement Report` : 'Settlement Report',
    status: 'draft',
    currency: 'USD',
    grossRevenue: '',
    taxesFees: '',
    promoterCosts: '',
    productionCosts: '',
    otherDeductions: '',
    netRevenue: '',
    guaranteedPayout: '',
    actualPayout: '',
    notes: '',
  };
}

function buildDefaultPostProductionDebrief(event = {}) {
  return {
    status: 'draft',
    overallOutcome: '',
    peopleSummary: '',
    moneySummary: '',
    placeStuffSummary: '',
    purposeProgramSummary: '',
    wins: '',
    issues: '',
    nextActions: '',
    owner: '',
    dueDate: '',
    eventTitle: event?.title || '',
  };
}

function mapPostProductionDebriefToForm(input = {}, event = {}) {
  const defaults = buildDefaultPostProductionDebrief(event);
  const source = (input && typeof input === 'object') ? input : {};
  return {
    ...defaults,
    status: source.status || defaults.status,
    overallOutcome: source.overallOutcome || '',
    peopleSummary: source.peopleSummary || '',
    moneySummary: source.moneySummary || '',
    placeStuffSummary: source.placeStuffSummary || '',
    purposeProgramSummary: source.purposeProgramSummary || '',
    wins: source.wins || '',
    issues: source.issues || '',
    nextActions: source.nextActions || '',
    owner: source.owner || '',
    dueDate: source.dueDate || '',
    eventTitle: source.eventTitle || defaults.eventTitle,
  };
}

function mapSettlementReportToForm(report = {}, event = {}) {
  const defaults = buildDefaultSettlementForm(event);
  return {
    ...defaults,
    title: report.title || defaults.title,
    status: report.status || defaults.status,
    currency: report.currency || defaults.currency,
    grossRevenue: report.gross_revenue ?? '',
    taxesFees: report.taxes_fees ?? '',
    promoterCosts: report.promoter_costs ?? '',
    productionCosts: report.production_costs ?? '',
    otherDeductions: report.other_deductions ?? '',
    netRevenue: report.net_revenue ?? '',
    guaranteedPayout: report.guaranteed_payout ?? '',
    actualPayout: report.actual_payout ?? '',
    notes: report.notes || '',
  };
}

function parseCleAttendanceRows(rawValue = '') {
  return String(rawValue || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((part) => part.trim());
      return {
        name: parts[0] || '',
        barNumber: parts[1] || '',
        checkinStatus: parts[2] || '',
        certificateStatus: parts[3] || '',
      };
    });
}

function buildCleComplianceCsv(event = {}, productionDetails = {}) {
  const rows = [
    ['Event Title', event.title || ''],
    ['Event Date', event.date || ''],
    ['Event Time', event.time || ''],
    ['Venue', event.venue || event.venue_name || ''],
    ['CLE Credit Hours', productionDetails.cleCreditHours || ''],
    ['Legal Workflow Mode', normalizeLegalWorkflowMode(productionDetails.legalWorkflowMode || 'cle_full')],
    ['MCLE Status', productionDetails.mcleStatus || ''],
    ['MCLE Approval Code', productionDetails.mcleApprovalCode || ''],
    ['MCLE Provider', productionDetails.mcleAccreditationProvider || ''],
    ['Bar Association Sponsor', productionDetails.barAssociationSponsor || ''],
    ['Registrants', productionDetails.cleRegistrants || ''],
    ['Check-Ins', productionDetails.cleCheckIns || ''],
    ['Bar Numbers Collected', productionDetails.cleBarNumbersCollected || ''],
    ['Certificates Issued', productionDetails.cleCertificatesIssued || ''],
    ['Certificates Delivered At', productionDetails.cleCertificatesDeliveredAt || ''],
    ['Attendance Exported At', productionDetails.cleAttendanceExportedAt || ''],
    ['Compliance Owner', productionDetails.cleComplianceOwner || ''],
    ['Compliance Notes', productionDetails.cleComplianceNotes || ''],
    [],
    ['Attendee Name', 'Bar Number', 'Check-In Status', 'Certificate Status'],
  ];

  const attendeeRows = parseCleAttendanceRows(productionDetails.cleAttendanceRows || '');
  if (attendeeRows.length) {
    attendeeRows.forEach((row) => {
      rows.push([row.name, row.barNumber, row.checkinStatus, row.certificateStatus]);
    });
  }

  return rows.map((row) => row
    .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
    .join(','))
    .join('\n');
}

function downloadTextFile(text = '', mimeType = 'text/plain', fileName = 'download.txt') {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function EventDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    venue,
    events,
    updateEvent,
    showConfigurations,
    listStaffingRequests,
    createStaffingRequestRecord,
    updateStaffingRequestRecord,
    getTicketingSnapshots,
    syncEventTicketing,
    listShowCheckins,
    createShowCheckinRecord,
    updateShowCheckinRecord,
    listDealMemos,
    createDealMemoRecord,
    updateDealMemoRecord,
    exportDealMemoPDF,
    listSettlementReports,
    createSettlementReportRecord,
    updateSettlementReportRecord,
    exportSettlementReportFile,
    getMediaCapturePlan,
    listCaptureSources,
    getZoomMeetingConfig,
    getYouTubeDistribution,
  } = useVenue();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [staffingRequests, setStaffingRequests] = useState([]);
  const [staffingLoading, setStaffingLoading] = useState(false);
  const [staffingStatus, setStaffingStatus] = useState('');
  const [ticketingSnapshots, setTicketingSnapshots] = useState([]);
  const [ticketingLoading, setTicketingLoading] = useState(false);
  const [ticketingStatus, setTicketingStatus] = useState('');
  const [showCheckins, setShowCheckins] = useState([]);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinStatus, setCheckinStatus] = useState('');
  const [dealMemos, setDealMemos] = useState([]);
  const [dealMemoLoading, setDealMemoLoading] = useState(false);
  const [googleSignLoading, setGoogleSignLoading] = useState(false);
  const [dealMemoStatus, setDealMemoStatus] = useState('');
  const [activeDealMemoId, setActiveDealMemoId] = useState('');
  const [settlementReports, setSettlementReports] = useState([]);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementStatus, setSettlementStatus] = useState('');
  const [activeSettlementId, setActiveSettlementId] = useState('');
  const [mediaCapturePlan, setMediaCapturePlan] = useState(null);
  const [captureSources, setCaptureSources] = useState([]);
  const [zoomMeetingConfig, setZoomMeetingConfig] = useState(null);
  const [youtubeDistribution, setYouTubeDistribution] = useState(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefStatus, setDebriefStatus] = useState('');
  const [cleComplianceStatus, setCleComplianceStatus] = useState('');
  const [sectionNotice, setSectionNotice] = useState('');
  const previousSectionStatusRef = useRef({});

  const event = events.find(e => e.id === id);
  const selectedShowConfig = (showConfigurations || []).find(cfg => cfg.id === event?.showConfigurationId);
  const [staffingForm, setStaffingForm] = useState({
    role: '',
    department: '',
    quantity: 1,
    startsAt: '',
    endsAt: '',
    destinationType: 'manual',
    destinationValue: '',
    notes: '',
  });
  const [ticketingForm, setTicketingForm] = useState({
    provider: event?.ticketProvider || event?.productionDetails?.ticketProvider || 'manual',
    providerEventId: event?.ticketProviderEventId || event?.productionDetails?.ticketProviderEventId || '',
  });
  const [checkinForm, setCheckinForm] = useState(() => buildDefaultCheckinForm());
  const [dealMemoForm, setDealMemoForm] = useState(() => buildDefaultDealMemoForm(event));
  const [settlementForm, setSettlementForm] = useState(() => buildDefaultSettlementForm(event));
  const [postDebriefForm, setPostDebriefForm] = useState(() => mapPostProductionDebriefToForm(event?.productionDetails?.postProductionDebrief || {}, event));

  useEffect(() => {
    if (event) {
      loadCampaigns();
      loadStaffing();
      loadTicketing();
      loadShowCheckins();
      loadDealMemos();
      loadSettlementReports();
      loadCaptureWorkflow();
    }
  }, [event?.id]);

  useEffect(() => {
    if (!event) return;
    const defaultStart = toDateTimeInput(event.bookingStartAt)
      || (event.date ? `${event.date}T${String(event.time || '19:00').slice(0, 5)}` : '');
    const defaultEnd = toDateTimeInput(event.bookingEndAt) || addHours(defaultStart, 3);
    setStaffingForm(prev => ({
      ...prev,
      startsAt: prev.startsAt || defaultStart,
      endsAt: prev.endsAt || defaultEnd,
    }));
    setTicketingForm({
      provider: event.ticketProvider || event.productionDetails?.ticketProvider || 'manual',
      providerEventId: event.ticketProviderEventId || event.productionDetails?.ticketProviderEventId || '',
    });
  }, [event?.id, event?.bookingStartAt, event?.bookingEndAt, event?.date, event?.time, event?.ticketProvider, event?.ticketProviderEventId, event?.productionDetails?.ticketProvider, event?.productionDetails?.ticketProviderEventId]);

  useEffect(() => {
    if (!event?.id) return;
    setCheckinForm(buildDefaultCheckinForm());
    setCheckinStatus('');
    setActiveDealMemoId('');
    setDealMemoForm(buildDefaultDealMemoForm(event));
    setDealMemoStatus('');
    setActiveSettlementId('');
    setSettlementForm(buildDefaultSettlementForm(event));
    setSettlementStatus('');
    setMediaCapturePlan(null);
    setCaptureSources([]);
    setZoomMeetingConfig(null);
    setYouTubeDistribution(null);
    setPostDebriefForm(mapPostProductionDebriefToForm(event?.productionDetails?.postProductionDebrief || {}, event));
    setDebriefStatus('');
    setCleComplianceStatus('');
  }, [event?.id]);

  useEffect(() => {
    previousSectionStatusRef.current = {};
    setSectionNotice('');
  }, [event?.id]);

  useEffect(() => {
    if (!event?.id) return;
    setPostDebriefForm(mapPostProductionDebriefToForm(event?.productionDetails?.postProductionDebrief || {}, event));
  }, [event?.id, event?.productionDetails?.postProductionDebrief, event?.title]);

  const loadCampaigns = async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const campaignData = await getEventCampaigns(event.id);
      setCampaigns(campaignData);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStaffing = async () => {
    if (!event?.id) return;
    setStaffingLoading(true);
    try {
      const requests = await listStaffingRequests(event.id);
      setStaffingRequests(requests || []);
    } catch (err) {
      console.error('Failed to load staffing requests:', err);
      setStaffingStatus(`I hit a snag loading staffing requests: ${err.message}`);
    } finally {
      setStaffingLoading(false);
    }
  };

  const loadTicketing = async () => {
    if (!event?.id) return;
    setTicketingLoading(true);
    try {
      const snapshots = await getTicketingSnapshots(event.id);
      setTicketingSnapshots(snapshots || []);
    } catch (err) {
      console.error('Failed to load ticketing snapshots:', err);
      setTicketingStatus(`I hit a snag loading ticketing snapshots: ${err.message}`);
    } finally {
      setTicketingLoading(false);
    }
  };

  const loadShowCheckins = async () => {
    if (!event?.id) return;
    setCheckinLoading(true);
    try {
      const records = await listShowCheckins(event.id);
      setShowCheckins(records || []);
    } catch (err) {
      console.error('Failed to load show check-ins:', err);
      setCheckinStatus(`I hit a snag loading check-ins: ${err.message}`);
    } finally {
      setCheckinLoading(false);
    }
  };

  const loadDealMemos = async () => {
    if (!event?.id) return;
    setDealMemoLoading(true);
    try {
      const memos = await listDealMemos(event.id);
      const next = memos || [];
      setDealMemos(next);
      if (next.length) {
        const selected = next.find((row) => row.id === activeDealMemoId) || next[0];
        setActiveDealMemoId(selected.id);
        setDealMemoForm(mapDealMemoToForm(selected, event));
      } else {
        setActiveDealMemoId('');
        setDealMemoForm(buildDefaultDealMemoForm(event));
      }
    } catch (err) {
      console.error('Failed to load deal memos:', err);
      setDealMemoStatus(`I hit a snag loading deal memos: ${err.message}`);
    } finally {
      setDealMemoLoading(false);
    }
  };

  const loadSettlementReports = async () => {
    if (!event?.id) return;
    setSettlementLoading(true);
    try {
      const reports = await listSettlementReports(event.id);
      const next = reports || [];
      setSettlementReports(next);
      if (next.length) {
        const selected = next.find((row) => row.id === activeSettlementId) || next[0];
        setActiveSettlementId(selected.id);
        setSettlementForm(mapSettlementReportToForm(selected, event));
      } else {
        setActiveSettlementId('');
        setSettlementForm(buildDefaultSettlementForm(event));
      }
    } catch (err) {
      console.error('Failed to load settlement reports:', err);
      setSettlementStatus(`I hit a snag loading settlement reports: ${err.message}`);
    } finally {
      setSettlementLoading(false);
    }
  };

  const loadCaptureWorkflow = async () => {
    if (!event?.id) return;
    try {
      const [plan, sources, zoomConfig, youtube] = await Promise.all([
        getMediaCapturePlan(event.id),
        listCaptureSources(event.id),
        getZoomMeetingConfig(event.id),
        getYouTubeDistribution(event.id),
      ]);
      setMediaCapturePlan(plan || null);
      setCaptureSources(sources || []);
      setZoomMeetingConfig(zoomConfig || null);
      setYouTubeDistribution(youtube || null);
    } catch (err) {
      console.error('Failed to load capture workflow state:', err);
    }
  };

  const handleCreateStaffingRequest = async (sendNow = false) => {
    if (!event?.id) return;
    if (!String(staffingForm.role || '').trim()) {
      setStaffingStatus('Role is required for staffing dispatch.');
      return;
    }
    setStaffingStatus(sendNow ? 'Dispatching staffing request...' : 'Saving staffing request...');
    try {
      const created = await createStaffingRequestRecord(event.id, {
        role: staffingForm.role,
        department: staffingForm.department,
        quantity: staffingForm.quantity,
        startsAt: toIsoOrNull(staffingForm.startsAt),
        endsAt: toIsoOrNull(staffingForm.endsAt),
        destinationType: staffingForm.destinationType,
        destinationValue: staffingForm.destinationValue,
        notes: staffingForm.notes,
        status: sendNow ? 'queued' : 'draft',
      }, {
        sendNow,
        event,
      });
      setStaffingRequests(prev => [created, ...prev]);
      setStaffingStatus(sendNow ? 'Staffing request dispatched.' : 'Staffing request saved.');
      setStaffingForm(prev => ({
        ...prev,
        role: '',
        department: '',
        quantity: 1,
        destinationValue: '',
        notes: '',
      }));
    } catch (err) {
      setStaffingStatus(`Staffing request failed: ${err.message}`);
    }
  };

  const handleDispatchExistingRequest = async (requestId) => {
    if (!requestId) return;
    setStaffingStatus('Dispatching staffing request...');
    try {
      const updated = await updateStaffingRequestRecord(requestId, {}, {
        sendNow: true,
        event,
      });
      setStaffingRequests(prev => prev.map(item => (item.id === requestId ? updated : item)));
      setStaffingStatus('Staffing request dispatched.');
    } catch (err) {
      setStaffingStatus(`Dispatch failed: ${err.message}`);
    }
  };

  const handleUpdateStaffingStatus = async (requestId, status) => {
    if (!requestId || !status) return;
    try {
      const updated = await updateStaffingRequestRecord(requestId, { status });
      setStaffingRequests(prev => prev.map(item => (item.id === requestId ? updated : item)));
    } catch (err) {
      setStaffingStatus(`I hit a snag updating that status: ${err.message}`);
    }
  };

  const handleSyncTicketing = async () => {
    if (!event?.id) return;
    setTicketingLoading(true);
    setTicketingStatus('Syncing ticketing data...');
    try {
      const synced = await syncEventTicketing(event.id, {
        provider: ticketingForm.provider,
        providerEventId: ticketingForm.providerEventId,
      });
      if (synced?.snapshot) {
        setTicketingSnapshots(prev => [synced.snapshot, ...prev.filter(row => row.id !== synced.snapshot.id)]);
      }
      setTicketingStatus('Ticketing sync complete.');
    } catch (err) {
      setTicketingStatus(`Ticketing sync failed: ${err.message}`);
    } finally {
      setTicketingLoading(false);
    }
  };

  const handleCreateCheckin = async () => {
    if (!event?.id) return;
    if (!String(checkinForm.contactName || '').trim()) {
      setCheckinStatus('Contact name is required.');
      return;
    }
    setCheckinLoading(true);
    setCheckinStatus('Saving check-in record...');
    try {
      const created = await createShowCheckinRecord(event.id, {
        contactName: checkinForm.contactName,
        contactRole: checkinForm.contactRole,
        contactType: checkinForm.contactType,
        credentialLabel: checkinForm.credentialLabel,
        phone: checkinForm.phone,
        email: checkinForm.email,
        status: checkinForm.status,
        notes: checkinForm.notes,
      });
      if (created) {
        setShowCheckins(prev => [created, ...prev.filter(row => row.id !== created.id)]);
      }
      setCheckinForm(buildDefaultCheckinForm());
      setCheckinStatus('Check-in record saved.');
    } catch (err) {
      setCheckinStatus(`Check-in failed: ${err.message}`);
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleMarkCheckedIn = async (checkinId) => {
    if (!checkinId) return;
    setCheckinLoading(true);
    setCheckinStatus('Marking checked-in...');
    try {
      const updated = await updateShowCheckinRecord(checkinId, { status: 'checked_in' }, { markCheckedIn: true });
      if (updated) {
        setShowCheckins(prev => prev.map(row => (row.id === checkinId ? updated : row)));
      }
      setCheckinStatus('Checked in.');
    } catch (err) {
      setCheckinStatus(`I hit a snag updating that check-in: ${err.message}`);
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleUpdateCheckinStatus = async (checkinId, status) => {
    if (!checkinId || !status) return;
    try {
      const updated = await updateShowCheckinRecord(checkinId, { status }, { markCheckedIn: status === 'checked_in' });
      if (updated) {
        setShowCheckins(prev => prev.map(row => (row.id === checkinId ? updated : row)));
      }
    } catch (err) {
      setCheckinStatus(`I hit a snag setting that status: ${err.message}`);
    }
  };

  const buildDealMemoPayload = () => ({
    title: dealMemoForm.title,
    status: dealMemoForm.status,
    dealType: dealMemoForm.dealType,
    buyerName: dealMemoForm.buyerName,
    buyerEmail: dealMemoForm.buyerEmail,
    buyerPhone: dealMemoForm.buyerPhone,
    sellerName: dealMemoForm.sellerName,
    sellerEmail: dealMemoForm.sellerEmail,
    sellerPhone: dealMemoForm.sellerPhone,
    eventDate: dealMemoForm.eventDate,
    venueName: dealMemoForm.venueName,
    compensationModel: dealMemoForm.compensationModel,
    guaranteeAmount: dealMemoForm.guaranteeAmount,
    depositAmount: dealMemoForm.depositAmount,
    backendSplit: dealMemoForm.backendSplit,
    doorSplit: dealMemoForm.doorSplit,
    merchSplit: dealMemoForm.merchSplit,
    settlementDueHours: dealMemoForm.settlementDueHours,
    payeeName: dealMemoForm.payeeName || dealMemoForm.sellerName,
    servicesDescription: dealMemoForm.servicesDescription,
    governingLaw: dealMemoForm.governingLaw || 'Texas',
    signerEmails: parseSignerEmails(dealMemoForm.signerEmails, [dealMemoForm.buyerEmail, dealMemoForm.sellerEmail]),
    promoCommitments: dealMemoForm.promoCommitments,
    techRiderTerms: dealMemoForm.techRiderTerms,
    hospitalityTerms: dealMemoForm.hospitalityTerms,
    cancellationTerms: dealMemoForm.cancellationTerms,
    forceMajeureTerms: dealMemoForm.forceMajeureTerms,
    notes: dealMemoForm.notes,
    metadata: {
      ...((activeDealMemo?.metadata && typeof activeDealMemo.metadata === 'object') ? activeDealMemo.metadata : {}),
      payeeName: dealMemoForm.payeeName || dealMemoForm.sellerName || '',
      servicesDescription: dealMemoForm.servicesDescription || '',
      governingLaw: dealMemoForm.governingLaw || 'Texas',
      signerEmails: parseSignerEmails(dealMemoForm.signerEmails, [dealMemoForm.buyerEmail, dealMemoForm.sellerEmail]),
    },
  });

  const upsertDealMemoList = (memo) => {
    if (!memo?.id) return;
    setDealMemos(prev => [memo, ...prev.filter(row => row.id !== memo.id)]);
    setActiveDealMemoId(memo.id);
    setDealMemoForm(mapDealMemoToForm(memo, event));
  };

  const handleSelectDealMemo = (memoId) => {
    const selected = dealMemos.find(row => row.id === memoId);
    if (!selected) return;
    setActiveDealMemoId(selected.id);
    setDealMemoForm(mapDealMemoToForm(selected, event));
    setDealMemoStatus('');
  };

  const handleStartNewDealMemo = () => {
    setActiveDealMemoId('');
    setDealMemoForm(buildDefaultDealMemoForm(event));
    setDealMemoStatus('New draft ready.');
  };

  const handleSaveDealMemo = async (sendNow = false) => {
    if (!event?.id) return;
    setDealMemoLoading(true);
    setDealMemoStatus(sendNow ? 'Sending deal memo...' : 'Saving deal memo...');
    try {
      const payload = buildDealMemoPayload();
      const response = activeDealMemoId
        ? await updateDealMemoRecord(activeDealMemoId, payload, {
          sendNow,
          bumpVersion: !sendNow,
        })
        : await createDealMemoRecord(event.id, payload, { sendNow });
      const memo = response?.dealMemo;
      if (memo) upsertDealMemoList(memo);
      const sentTo = response?.dispatch?.sentTo ? ` to ${response.dispatch.sentTo}` : '';
      setDealMemoStatus(sendNow ? `Deal memo sent${sentTo}.` : 'Deal memo saved.');
    } catch (err) {
      setDealMemoStatus(`Deal memo failed: ${err.message}`);
    } finally {
      setDealMemoLoading(false);
    }
  };

  const handleMarkDealMemoSigned = async () => {
    if (!activeDealMemoId) {
      setDealMemoStatus('Select a deal memo first.');
      return;
    }
    setDealMemoLoading(true);
    setDealMemoStatus('Marking as signed...');
    try {
      const response = await updateDealMemoRecord(activeDealMemoId, {
        ...buildDealMemoPayload(),
        status: 'signed',
      }, { bumpVersion: true });
      if (response?.dealMemo) upsertDealMemoList(response.dealMemo);
      setDealMemoStatus('Deal memo marked signed.');
    } catch (err) {
      setDealMemoStatus(`I hit a snag marking that memo as signed: ${err.message}`);
    } finally {
      setDealMemoLoading(false);
    }
  };

  const handleExportDealMemo = async () => {
    if (!activeDealMemoId) {
      setDealMemoStatus('Select a deal memo first.');
      return;
    }
    setDealMemoLoading(true);
    setDealMemoStatus('Generating PDF...');
    try {
      const response = await exportDealMemoPDF(activeDealMemoId);
      if (!response?.pdfBase64) throw new Error('Missing PDF payload from server.');
      downloadBase64File(response.pdfBase64, 'application/pdf', response.fileName || 'deal-memo.pdf');
      setDealMemoStatus(`Downloaded ${response.fileName || 'deal-memo.pdf'}.`);
      await loadDealMemos();
    } catch (err) {
      setDealMemoStatus(`PDF export failed: ${err.message}`);
    } finally {
      setDealMemoLoading(false);
    }
  };

  const ensureEventDriveFolder = async () => {
    if (event?.driveEventFolderId) return event.driveEventFolderId;
    if (!venue?.driveRootFolderId) {
      throw new Error('Google Drive is not connected for this account yet. Connect it in Settings first.');
    }
    const response = await fetch('/api/drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-event-folder',
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        clientFolderId: venue.driveRootFolderId,
      }),
    });
    const data = await response.json();
    if (!data?.success || !data?.driveEventFolderId) {
      throw new Error(data?.error || 'Could not create the Google Drive event folder.');
    }
    await updateEvent(event.id, { driveEventFolderId: data.driveEventFolderId });
    return data.driveEventFolderId;
  };

  const handleCreateGoogleSignatureDoc = async () => {
    if (!event?.id) return;
    const amountReady = Number.isFinite(Number(dealMemoForm.guaranteeAmount)) && Number(dealMemoForm.guaranteeAmount) > 0;
    const payeeReady = String(dealMemoForm.payeeName || dealMemoForm.sellerName || '').trim();
    const servicesReady = String(dealMemoForm.servicesDescription || '').trim();
    if (!amountReady || !payeeReady || !servicesReady) {
      setDealMemoStatus('Before Google eSignature, fill these: amount, payee (to whom), and services (for what).');
      return;
    }

    setGoogleSignLoading(true);
    setDealMemoStatus('Building Google eSignature contract document...');
    try {
      const payload = buildDealMemoPayload();
      const upsertResponse = activeDealMemoId
        ? await updateDealMemoRecord(activeDealMemoId, payload, { bumpVersion: true })
        : await createDealMemoRecord(event.id, payload, { sendNow: false });
      const memo = upsertResponse?.dealMemo;
      if (!memo?.id) throw new Error('Could not save deal memo before Google eSignature.');
      upsertDealMemoList(memo);

      const folderId = await ensureEventDriveFolder();
      const nextForm = mapDealMemoToForm(memo, event);
      const contractText = buildTexasLiveEventContractText(nextForm, event);
      const fileName = `${memo.title || `${event.title} Deal Memo`} - Texas Live Event Contract`;

      const driveResp = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload-file',
          folderId,
          fileName,
          content: contractText,
          mimeType: 'text/plain',
        }),
      });
      const driveData = await driveResp.json();
      if (!driveData?.success || !driveData?.fileId) {
        throw new Error(driveData?.error || 'Could not create Google contract document.');
      }

      const signerEmails = parseSignerEmails(nextForm.signerEmails, [nextForm.buyerEmail, nextForm.sellerEmail]);
      const googleSignature = {
        provider: 'google_esignature',
        fileId: driveData.fileId,
        fileUrl: driveData.url || '',
        folderId,
        signerEmails,
        createdAt: new Date().toISOString(),
        workflow: 'manual_request_from_google_docs',
      };

      const updateResponse = await updateDealMemoRecord(memo.id, {
        ...payload,
        status: 'sent',
        sentAt: new Date().toISOString(),
        metadata: {
          ...((memo.metadata && typeof memo.metadata === 'object') ? memo.metadata : {}),
          ...payload.metadata,
          googleSignature,
        },
      }, { bumpVersion: true });

      if (updateResponse?.dealMemo) {
        upsertDealMemoList(updateResponse.dealMemo);
      }

      if (googleSignature.fileUrl) {
        window.open(googleSignature.fileUrl, '_blank', 'noopener,noreferrer');
      }
      setDealMemoStatus('Google contract doc is ready. In Google Docs: Tools → eSignature → Request eSignature, then add signer emails and send.');
    } catch (err) {
      setDealMemoStatus(`Google eSignature setup failed: ${err.message}`);
    } finally {
      setGoogleSignLoading(false);
    }
  };

  const handleOpenGoogleSignatureDoc = () => {
    const fileUrl = activeDealMemo?.metadata?.googleSignature?.fileUrl;
    if (!fileUrl) {
      setDealMemoStatus('No Google eSignature document has been generated yet.');
      return;
    }
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const buildSettlementPayload = () => ({
    title: settlementForm.title,
    status: settlementForm.status,
    currency: settlementForm.currency,
    grossRevenue: settlementForm.grossRevenue,
    taxesFees: settlementForm.taxesFees,
    promoterCosts: settlementForm.promoterCosts,
    productionCosts: settlementForm.productionCosts,
    otherDeductions: settlementForm.otherDeductions,
    netRevenue: settlementForm.netRevenue,
    guaranteedPayout: settlementForm.guaranteedPayout,
    actualPayout: settlementForm.actualPayout,
    notes: settlementForm.notes,
  });

  const upsertSettlementList = (report) => {
    if (!report?.id) return;
    setSettlementReports(prev => [report, ...prev.filter(row => row.id !== report.id)]);
    setActiveSettlementId(report.id);
    setSettlementForm(mapSettlementReportToForm(report, event));
  };

  const handleSelectSettlement = (reportId) => {
    const selected = settlementReports.find(row => row.id === reportId);
    if (!selected) return;
    setActiveSettlementId(selected.id);
    setSettlementForm(mapSettlementReportToForm(selected, event));
    setSettlementStatus('');
  };

  const handleStartNewSettlement = () => {
    setActiveSettlementId('');
    setSettlementForm(buildDefaultSettlementForm(event));
    setSettlementStatus('New settlement draft ready.');
  };

  const handleSaveSettlement = async (markSubmitted = false) => {
    if (!event?.id) return;
    setSettlementLoading(true);
      setSettlementStatus(markSubmitted ? 'Saving and sending settlement...' : 'Saving settlement...');
    try {
      const payload = buildSettlementPayload();
      const report = activeSettlementId
        ? await updateSettlementReportRecord(activeSettlementId, payload, { markSubmitted })
        : await createSettlementReportRecord(event.id, payload, { markSubmitted });
      if (report) upsertSettlementList(report);
      setSettlementStatus(markSubmitted ? 'Settlement submitted.' : 'Settlement saved.');
    } catch (err) {
      setSettlementStatus(`Settlement failed: ${err.message}`);
    } finally {
      setSettlementLoading(false);
    }
  };

  const handleApproveSettlement = async () => {
    if (!activeSettlementId) {
      setSettlementStatus('Choose a settlement first.');
      return;
    }
    setSettlementLoading(true);
    setSettlementStatus('Marking approved...');
    try {
      const report = await updateSettlementReportRecord(activeSettlementId, {
        ...buildSettlementPayload(),
        status: 'approved',
      }, { markApproved: true });
      if (report) upsertSettlementList(report);
      setSettlementStatus('Settlement approved.');
    } catch (err) {
      setSettlementStatus(`I hit a snag approving that settlement: ${err.message}`);
    } finally {
      setSettlementLoading(false);
    }
  };

  const handleExportSettlement = async () => {
    if (!activeSettlementId) {
      setSettlementStatus('Choose a settlement first.');
      return;
    }
    setSettlementLoading(true);
    setSettlementStatus('Building settlement CSV...');
    try {
      const response = await exportSettlementReportFile(activeSettlementId);
      if (!response?.csvBase64) throw new Error('Missing CSV payload from server.');
      downloadBase64File(response.csvBase64, 'text/csv', response.fileName || 'settlement-report.csv');
      setSettlementStatus(`Downloaded ${response.fileName || 'settlement-report.csv'}.`);
      await loadSettlementReports();
    } catch (err) {
      setSettlementStatus(`I hit a snag exporting CSV: ${err.message}`);
    } finally {
      setSettlementLoading(false);
    }
  };

  const handleExportCleComplianceCsv = () => {
    if (!event?.id) return;
    const productionDetails = event.productionDetails || {};
    const attendeeRows = parseCleAttendanceRows(productionDetails.cleAttendanceRows || '');
    const csv = buildCleComplianceCsv(event, productionDetails);
    const fileName = `${String(event.title || 'cle-compliance').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-cle-compliance.csv`;
    downloadTextFile(csv, 'text/csv', fileName);
    setCleComplianceStatus(`Downloaded ${fileName} (${attendeeRows.length} attendee row${attendeeRows.length === 1 ? '' : 's'}).`);
  };

  const handleSavePostDebrief = async () => {
    if (!event?.id) return;
    setDebriefLoading(true);
    setDebriefStatus('Saving post-production debrief...');
    try {
      const nextDebrief = {
        ...postDebriefForm,
        status: postDebriefForm.status || 'draft',
        updatedAt: new Date().toISOString(),
      };
      const nextProductionDetails = {
        ...(event.productionDetails || {}),
        postProductionDebrief: nextDebrief,
      };
      await updateEvent(event.id, { productionDetails: nextProductionDetails });
      setDebriefStatus('Post-production debrief saved.');
    } catch (err) {
      setDebriefStatus(`I hit a snag saving that debrief: ${err.message}`);
    } finally {
      setDebriefLoading(false);
    }
  };

  const handleResetPostDebriefTemplate = () => {
    setPostDebriefForm(buildDefaultPostProductionDebrief(event));
    setDebriefStatus('Template reset. Fill the four-zone notes and save when ready.');
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    setDeleting(true);
    try {
      await deleteEvent(event.id);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete event:', err);
      alert('I hit a snag deleting that event: ' + err.message);
      setDeleting(false);
    }
  };

  const workflowSectionProgress = useMemo(() => computeEventWorkflowProgress({
    event,
    campaigns,
    staffingRequests,
    showCheckins,
    settlementReports,
    mediaCapturePlan,
    captureSources,
    zoomMeetingConfig,
    youtubeDistribution,
  }), [event, campaigns, staffingRequests, showCheckins, settlementReports, mediaCapturePlan, captureSources, zoomMeetingConfig, youtubeDistribution]);

  const workflowSummary = useMemo(
    () => summarizeWorkflowProgress(workflowSectionProgress),
    [workflowSectionProgress]
  );
  const nextWorkflowSection = useMemo(
    () => getNextIncompleteWorkflowSection(workflowSectionProgress),
    [workflowSectionProgress]
  );
  const productionPhaseProgress = useMemo(
    () => computeProductionPhaseProgress(workflowSectionProgress),
    [workflowSectionProgress]
  );
  const taylorZoneProgress = useMemo(
    () => computeTaylorZoneProgress(workflowSectionProgress),
    [workflowSectionProgress]
  );
  const sectionZoneReferenceRows = useMemo(() => {
    const sectionNumberById = WORKFLOW_SECTIONS.reduce((acc, section) => {
      acc[section.id] = section.number;
      return acc;
    }, {});
    return workflowSectionProgress.map((section, index) => ({
      ...section,
      number: sectionNumberById[section.id] || index + 1,
    }));
  }, [workflowSectionProgress]);
  const phaseGateStatus = useMemo(
    () => computePhaseGateStatus(workflowSectionProgress),
    [workflowSectionProgress]
  );

  useEffect(() => {
    const previousStatuses = previousSectionStatusRef.current || {};
    const hasPreviousSnapshot = Object.keys(previousStatuses).length > 0;
    const currentStatuses = {};
    workflowSectionProgress.forEach((section) => {
      currentStatuses[section.id] = section.status;
    });

    if (hasPreviousSnapshot) {
      const newlyCompleted = workflowSectionProgress.filter((section) => (
        section.status === 'complete' && previousStatuses[section.id] !== 'complete'
      ));
      if (newlyCompleted.length > 0) {
        const latest = newlyCompleted[newlyCompleted.length - 1];
        if (nextWorkflowSection) {
          const remaining = nextWorkflowSection.missing.length;
          setSectionNotice(`✅ ${latest.title} complete. ${remaining} ${remaining === 1 ? 'item' : 'items'} left in ${nextWorkflowSection.title}.`);
        } else {
          setSectionNotice('✅ All workflow sections are complete for this event.');
        }
      }
    }

    previousSectionStatusRef.current = currentStatuses;
  }, [nextWorkflowSection, workflowSectionProgress]);

  if (!event) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl mb-4">I could not find that event yet</h2>
        <Link to="/" className="text-[#c8a45e] hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const date = parseLocalDate(event.date);
  const hasCampaigns = campaigns.length > 0;
  const activeCampaigns = campaigns.filter(c => c.status === 'sent' || c.status === 'published' || c.status === 'created');
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending' || c.status === 'queued');
  const failedCampaigns = campaigns.filter(c => c.status === 'failed' || c.status === 'error');
  const productionDetails = event.productionDetails || {};
  const hasProductionDetails = Object.values(productionDetails).some(v => String(v || '').trim());
  const hasTheaterDetails = !!(productionDetails.productionType || productionDetails.unionHouse || productionDetails.stageFormat);
  const hasTicketingDetails = !!(
    event.ticketProvider ||
    event.ticketProviderEventId ||
    productionDetails.ticketProvider ||
    productionDetails.ticketProviderEventId ||
    productionDetails.seatsAvailable ||
    productionDetails.ticketSalesCount
  );
  const hasCleDetails = !!(
    productionDetails.cleCreditHours ||
    productionDetails.mcleAccreditationProvider ||
    productionDetails.barAssociationSponsor ||
    productionDetails.legalJurisdiction ||
    productionDetails.mcleApprovalCode ||
    productionDetails.mcleStatus ||
    productionDetails.legalWorkflowMode ||
    productionDetails.distributionApprovalRequired === true ||
    productionDetails.distributionApproved === true ||
    productionDetails.distributionApprovedBy ||
    productionDetails.distributionApprovedAt ||
    productionDetails.distributionApprovalNotes ||
    productionDetails.includeLegalDisclaimer === true ||
    productionDetails.legalDisclaimerTemplate ||
    productionDetails.legalDisclaimerCustom ||
    productionDetails.cleProgramNotes ||
    productionDetails.cleBarNumbersCollected ||
    productionDetails.cleRegistrants ||
    productionDetails.cleCheckIns ||
    productionDetails.cleCertificatesIssued ||
    productionDetails.cleCertificatesDeliveredAt ||
    productionDetails.cleAttendanceExportedAt ||
    productionDetails.cleComplianceOwner ||
    productionDetails.cleComplianceNotes ||
    productionDetails.cleAttendanceRows ||
    productionDetails.grossTicketRevenue ||
    productionDetails.netPayoutRevenue ||
    productionDetails.sponsorshipRevenue ||
    productionDetails.speakerFeesTotal ||
    productionDetails.venueCostsTotal ||
    productionDetails.complianceCostsTotal ||
    productionDetails.reconciliationStatus ||
    productionDetails.reconciliationOwner ||
    productionDetails.reconciliationClosedAt ||
    productionDetails.reconciliationNotes ||
    productionDetails.analyticsSource ||
    productionDetails.analyticsLastSyncedAt ||
    productionDetails.stakeholderReportExportedAt
  );
  const legalProgramEvent = isLegalProgramGenre(event.genre || '');
  const legalWorkflowMode = normalizeLegalWorkflowMode(productionDetails.legalWorkflowMode || 'cle_full');
  const legalWorkflowLabel = LEGAL_WORKFLOW_MODES.find((mode) => mode.value === legalWorkflowMode)?.label || 'CLE Compliance + Promotion';
  const legalDisclaimerTemplate = getLegalDisclaimerTemplate(productionDetails.legalDisclaimerTemplate || 'cle_education');
  const legalDisclaimerEnabled = !!(productionDetails.includeLegalDisclaimer || productionDetails.legalDisclaimerCustom);
  const legalAttendeeRows = parseCleAttendanceRows(productionDetails.cleAttendanceRows || '');
  const formatCurrency = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return value;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const latestTicketSnapshot = ticketingSnapshots[0] || null;
  const openStaffingRequests = staffingRequests.filter((row) => !['filled', 'cancelled'].includes(String(row.status || '').toLowerCase()));
  const checkedInCount = showCheckins.filter((row) => String(row.status || '').toLowerCase() === 'checked_in').length;
  const activeDealMemo = dealMemos.find((row) => row.id === activeDealMemoId) || null;
  const activeGoogleSignature = (activeDealMemo?.metadata && typeof activeDealMemo.metadata === 'object')
    ? activeDealMemo.metadata.googleSignature || null
    : null;
  const activeSettlement = settlementReports.find((row) => row.id === activeSettlementId) || null;
  const activeBlockingPhase = phaseGateStatus?.blockingPhase ? phaseGateStatus?.byKey?.[phaseGateStatus.blockingPhase] : null;
  const nextLockedPhase = (phaseGateStatus?.phases || []).find((phase) => phase.locked) || null;
  const resolveWorkflowSectionLink = (section) => {
    if (!section) return `/events/${event.id}`;
    if (section.id === 'distribution_delivery' || section.id === 'marketing_assets') {
      return `/imc-composer?eventId=${event.id}`;
    }
    if (section.opsTab) return `/events/${event.id}?opsTab=${section.opsTab}`;
    return `/events/${event.id}`;
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Link to="/" className="text-sm text-gray-500 hover:text-[#c8a45e] no-underline mb-4 block">
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <h1 className="text-3xl mb-2">{event.title}</h1>
            <div className="flex flex-wrap gap-2 mb-3">
              {event.genre && (
                <span className="inline-block text-xs font-semibold text-[#c8a45e] bg-[#c8a45e1a] px-3 py-1 rounded-full">
                  {event.genre}
                </span>
              )}
              {legalProgramEvent && (
                <span className="inline-block text-xs font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                  {legalWorkflowLabel}
                </span>
              )}
              {event.campaign && (
                <span className="inline-block text-xs font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                  Campaign Active
                </span>
              )}
              {event.driveEventFolderId && (
                <a
                  href={`https://drive.google.com/drive/folders/${event.driveEventFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full hover:bg-blue-200 no-underline"
                >
                  📁 Open in Google Drive
                </a>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-[#c8a45e]">
              {date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </div>
            {event.time && (
              <div className="text-sm text-gray-600">
                {new Date(`1970-01-01T${event.time}`).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit' 
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {sectionNotice && (
        <div className="mb-4 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg px-3 py-2 text-sm flex items-start justify-between gap-2">
          <span>{sectionNotice}</span>
          <button
            type="button"
            className="text-emerald-700 border border-emerald-300 rounded px-2 py-0.5 text-xs bg-white"
            onClick={() => setSectionNotice('')}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="card mb-6 border border-[#c8a45e33] bg-[#faf8f3]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg m-0">🧭 Section Progress</h3>
            <p className="text-xs text-gray-600 m-0">
              {workflowSummary.completedSections}/{workflowSummary.totalSections} sections complete · {workflowSummary.remainingItems} checklist items remaining
            </p>
          </div>
          {nextWorkflowSection ? (
            <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
              Next: {nextWorkflowSection.title}
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800">
              All Sections Complete
            </span>
          )}
        </div>

        {nextWorkflowSection && (
          <div className="mb-3 p-3 rounded border border-amber-200 bg-amber-50">
            <p className="m-0 text-sm font-semibold text-amber-900">
              You are close: {nextWorkflowSection.missing.length} {nextWorkflowSection.missing.length === 1 ? 'item' : 'items'} left in {nextWorkflowSection.title}.
            </p>
            {nextWorkflowSection.missing.length > 0 && (
              <p className="m-0 mt-1 text-xs text-amber-800">
                Remaining: {nextWorkflowSection.missing.slice(0, 3).join(' · ')}
              </p>
            )}
          </div>
        )}

        {nextLockedPhase && (
          <div className="mb-3 p-3 rounded border border-blue-200 bg-blue-50">
            <p className="m-0 text-sm font-semibold text-blue-900">
              🔒 Phase gate active: complete {activeBlockingPhase?.label || 'the current phase'} to unlock {nextLockedPhase.label}.
            </p>
            {activeBlockingPhase?.missing?.length > 0 && (
              <p className="m-0 mt-1 text-xs text-blue-800">
                Still needed: {activeBlockingPhase.missing.slice(0, 3).join(' · ')}
              </p>
            )}
          </div>
        )}

        <TaylorZoneReferenceStrip
          sections={sectionZoneReferenceRows}
          className="mb-3"
          description="This event maps each workflow section to People, Money, Place + Stuff, and Purpose + Program."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          {productionPhaseProgress.map((phase) => {
            const pct = phase.total > 0 ? Math.round((phase.completed / phase.total) * 100) : 0;
            const statusIcon = phase.status === 'complete' ? '✅' : (phase.status === 'in_progress' ? '🟡' : '⚪');
            return (
              <div key={phase.key} className="rounded border border-gray-200 bg-white px-3 py-2">
                <p className="m-0 text-sm font-semibold">{statusIcon} {phase.icon} {phase.label}</p>
                <p className="m-0 text-xs text-gray-600">{phase.completed}/{phase.total} checks ({pct}%)</p>
              </div>
            );
          })}
        </div>

        <div className="mb-3 rounded border border-[#0d1b2a1a] bg-white p-3">
          <p className="m-0 text-sm font-semibold">🧠 Taylor 4-Zone Readiness</p>
          <p className="m-0 mt-1 text-xs text-gray-500">{TAYLOR_FRAMEWORK_ATTRIBUTION}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {taylorZoneProgress.map((zone) => {
              const pct = zone.total > 0 ? Math.round((zone.completed / zone.total) * 100) : 0;
              const statusIcon = zone.status === 'complete' ? '✅' : (zone.status === 'in_progress' ? '🟡' : '⚪');
              return (
                <div key={zone.key} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="m-0 text-sm font-semibold">{statusIcon} {zone.icon} {zone.label}</p>
                  <p className="m-0 text-xs text-gray-600">{zone.completed}/{zone.total} checks ({pct}%)</p>
                  {zone.missing.length > 0 && (
                    <p className="m-0 mt-1 text-xs text-gray-500">
                      Remaining: {zone.missing.slice(0, 2).join(' · ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          {workflowSectionProgress.map((section) => {
            const trackMeta = getWorkflowTrackMeta(section.track);
            const pct = section.total > 0 ? Math.round((section.completed / section.total) * 100) : 0;
            const isComplete = section.status === 'complete';
            const phaseGate = phaseGateStatus?.byKey?.[section.productionPhase];
            const sectionLocked = !!phaseGate?.locked;
            const blockedByLabel = phaseGate?.blockedBy ? (phaseGateStatus?.byKey?.[phaseGate.blockedBy]?.label || phaseGate.blockedBy) : '';
            return (
              <div key={section.id} className={`rounded border p-3 ${trackMeta.borderClass} ${trackMeta.cardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className={`m-0 text-xs font-semibold ${trackMeta.accentClass}`}>{trackMeta.icon} {trackMeta.label}</p>
                    <p className="m-0 text-sm font-semibold">{isComplete ? '✅' : '🟡'} {section.title}</p>
                    <p className="m-0 text-xs text-gray-600">{section.completed}/{section.total} checks complete ({pct}%)</p>
                    <p className="m-0 mt-1 text-[11px] text-gray-500">
                      {section.productionPhase === 'post_production' ? '📦 Post-Production' : section.productionPhase === 'production' ? '🎬 Production' : '🛠️ Pre-Production'}
                      {Array.isArray(section.taylorZones) && section.taylorZones.length > 0
                        ? ` · ${section.taylorZones
                          .map((zone) => {
                            if (zone === 'people') return '👥 People';
                            if (zone === 'money') return '💵 Money';
                            if (zone === 'place_stuff') return '🏛️ Place + Stuff';
                            if (zone === 'purpose_program') return '🎭 Purpose + Program';
                            return null;
                          })
                          .filter(Boolean)
                          .join(' · ')}`
                        : ''}
                    </p>
                  </div>
                  {sectionLocked ? (
                    <span className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-500">
                      Locked until {blockedByLabel || 'prior phase'} is complete
                    </span>
                  ) : (
                    <Link
                      to={resolveWorkflowSectionLink(section)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:border-[#c8a45e] no-underline"
                    >
                      {section.ctaLabel || 'Open section'} →
                    </Link>
                  )}
                </div>
                {section.missing.length > 0 && (
                  <p className="m-0 mt-2 text-xs text-gray-600">
                    Remaining: {section.missing.slice(0, 2).join(' · ')}
                  </p>
                )}
                {sectionLocked && (
                  <p className="m-0 mt-2 text-xs text-blue-700">
                    Complete {blockedByLabel || 'the previous phase'} first, then this section unlocks automatically.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="card mb-6">
          <h3 className="text-lg mb-3">Description</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
        </div>
      )}

      {/* Event Details */}
      <div className="card mb-6">
        <h3 className="text-lg mb-4">Event Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div>
              <span className="text-gray-500 block mb-1">Venue</span>
              <span className="font-medium">{event.venue || '—'}</span>
            </div>
            {event.performanceZoneName && (
              <div>
                <span className="text-gray-500 block mb-1">Performance Zone</span>
                <span className="font-medium">{event.performanceZoneName}</span>
              </div>
            )}
            {event.venueAddress && (
              <div>
                <span className="text-gray-500 block mb-1">Address</span>
                <span className="font-medium">{event.venueAddress}</span>
              </div>
            )}
            {event.performers && (
              <div>
                <span className="text-gray-500 block mb-1">Performers</span>
                <span className="font-medium">{event.performers}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {event.ticketLink && (
              <div>
                <span className="text-gray-500 block mb-1">Tickets</span>
                <a href={event.ticketLink} target="_blank" rel="noopener noreferrer" 
                   className="text-[#c8a45e] hover:underline">
                  View Tickets →
                </a>
                {event.ticketPrice && (
                  <span className="block text-gray-600">{event.ticketPrice}</span>
                )}
              </div>
            )}
            {hasTicketingDetails && (
              <div>
                <span className="text-gray-500 block mb-1">Ticketing Snapshot</span>
                <span className="font-medium">
                  {(event.ticketProvider || productionDetails.ticketProvider) ? `Provider: ${event.ticketProvider || productionDetails.ticketProvider}` : ''}
                  {(event.ticketProvider || productionDetails.ticketProvider) && (event.ticketProviderEventId || productionDetails.ticketProviderEventId) ? ' · ' : ''}
                  {(event.ticketProviderEventId || productionDetails.ticketProviderEventId) ? `ID: ${event.ticketProviderEventId || productionDetails.ticketProviderEventId}` : ''}
                  {(event.ticketProvider || productionDetails.ticketProvider || event.ticketProviderEventId || productionDetails.ticketProviderEventId) && (productionDetails.seatsAvailable || productionDetails.ticketSalesCount) ? ' · ' : ''}
                  {productionDetails.seatsAvailable ? `Seats: ${productionDetails.seatsAvailable}` : 'Seats: —'}
                  {productionDetails.ticketSalesCount ? ` · Sold: ${productionDetails.ticketSalesCount}` : ''}
                </span>
              </div>
            )}
            {event.venueWebsite && (
              <div>
                <span className="text-gray-500 block mb-1">Venue Website</span>
                <a href={event.venueWebsite} target="_blank" rel="noopener noreferrer"
                   className="text-[#c8a45e] hover:underline">
                  Visit Website →
                </a>
              </div>
            )}
            {(event.bookingStartAt || event.bookingEndAt) && (
              <div>
                <span className="text-gray-500 block mb-1">Booking Window</span>
                <span className="font-medium">
                  {event.bookingStartAt ? new Date(event.bookingStartAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
                  {' '}→{' '}
                  {event.bookingEndAt ? new Date(event.bookingEndAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
                </span>
              </div>
            )}
            {event.bookingStatus && (
              <div>
                <span className="text-gray-500 block mb-1">Booking Status</span>
                <span className="font-medium capitalize">{event.bookingStatus.replace(/_/g, ' ')}</span>
              </div>
            )}
            {selectedShowConfig && (
              <div>
                <span className="text-gray-500 block mb-1">Show Configuration</span>
                <span className="font-medium">{selectedShowConfig.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <BookingOperationsWorkspace
        event={event}
        initialTab={searchParams.get('opsTab') || ''}
        phaseGateStatus={phaseGateStatus}
      />

      <div className="card mb-6 border border-[#0d1b2a1a] bg-[#faf8f3]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg m-0">🧾 Post-Production Debrief (Taylor 4-Zone)</h3>
            <p className="text-xs text-gray-500 m-0 mt-1">Close out people, money, place/stuff, and purpose/program in one debrief record.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={postDebriefForm.status}
              onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, status: e.target.value }))}
              className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
            >
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              <option value="submitted">Submitted</option>
              <option value="complete">Complete</option>
            </select>
            <button
              type="button"
              onClick={handleResetPostDebriefTemplate}
              className="btn-secondary text-xs"
              disabled={debriefLoading}
            >
              Reset Template
            </button>
            <button
              type="button"
              onClick={handleSavePostDebrief}
              className="btn-primary text-xs"
              disabled={debriefLoading}
            >
              {debriefLoading ? 'Saving...' : 'Save Debrief'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="bg-white border border-gray-200 rounded p-3">
            <p className="m-0 text-xs font-semibold">👥 People</p>
            <textarea
              rows={3}
              value={postDebriefForm.peopleSummary}
              onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, peopleSummary: e.target.value }))}
              className="w-full mt-2 px-2 py-1.5 border border-gray-200 rounded text-xs"
              placeholder="Crew performance, staffing gaps, communication wins, and handoff notes."
            />
          </div>
          <div className="bg-white border border-gray-200 rounded p-3">
            <p className="m-0 text-xs font-semibold">💵 Money</p>
            <textarea
              rows={3}
              value={postDebriefForm.moneySummary}
              onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, moneySummary: e.target.value }))}
              className="w-full mt-2 px-2 py-1.5 border border-gray-200 rounded text-xs"
              placeholder="Ticket pace, settlement notes, overages, savings, and payout issues."
            />
          </div>
          <div className="bg-white border border-gray-200 rounded p-3">
            <p className="m-0 text-xs font-semibold">🏛️ Place + Stuff</p>
            <textarea
              rows={3}
              value={postDebriefForm.placeStuffSummary}
              onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, placeStuffSummary: e.target.value }))}
              className="w-full mt-2 px-2 py-1.5 border border-gray-200 rounded text-xs"
              placeholder="Venue flow, zone logistics, inventory, gear reliability, and load-in/strike notes."
            />
          </div>
          <div className="bg-white border border-gray-200 rounded p-3">
            <p className="m-0 text-xs font-semibold">🎭 Purpose + Program</p>
            <textarea
              rows={3}
              value={postDebriefForm.purposeProgramSummary}
              onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, purposeProgramSummary: e.target.value }))}
              className="w-full mt-2 px-2 py-1.5 border border-gray-200 rounded text-xs"
              placeholder="How the show/program landed, audience response, and artistic/program outcomes."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <textarea
            rows={2}
            value={postDebriefForm.wins}
            onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, wins: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded text-xs"
            placeholder="Top wins to repeat next time."
          />
          <textarea
            rows={2}
            value={postDebriefForm.issues}
            onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, issues: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded text-xs"
            placeholder="Issues to fix before the next event."
          />
          <textarea
            rows={2}
            value={postDebriefForm.nextActions}
            onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, nextActions: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded text-xs md:col-span-2"
            placeholder="Next actions, owners, and due dates."
          />
          <input
            type="text"
            value={postDebriefForm.owner}
            onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, owner: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded text-xs"
            placeholder="Debrief owner"
          />
          <input
            type="date"
            value={postDebriefForm.dueDate}
            onChange={(e) => setPostDebriefForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded text-xs"
          />
        </div>
        {debriefStatus && <p className="text-xs text-gray-600 mt-3 mb-0">{debriefStatus}</p>}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg m-0">Ticketing Snapshot</h3>
          <button
            type="button"
            onClick={handleSyncTicketing}
            className="btn-secondary text-sm"
            disabled={ticketingLoading}
          >
            {ticketingLoading ? 'Syncing...' : 'Sync Ticketing Now'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Pull seats sold and revenue from your provider now. Eventbrite is live; other providers stay manual until connector keys are added.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Provider</label>
            <select
              value={ticketingForm.provider}
              onChange={(e) => setTicketingForm(prev => ({ ...prev, provider: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white"
            >
              <option value="manual">Manual / Unknown</option>
              <option value="eventbrite">Eventbrite</option>
              <option value="ticketmaster">Ticketmaster</option>
              <option value="universe">Universe</option>
              <option value="square">Square</option>
              <option value="etix">Etix</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Provider Event ID</label>
            <input
              type="text"
              value={ticketingForm.providerEventId}
              onChange={(e) => setTicketingForm(prev => ({ ...prev, providerEventId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
              placeholder={ticketingForm.provider === 'eventbrite' ? 'Eventbrite ID' : 'Provider event ID'}
            />
          </div>
        </div>
        {ticketingStatus && <p className="text-xs text-gray-600 mb-3">{ticketingStatus}</p>}
        {latestTicketSnapshot ? (
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="m-0 font-medium mb-1">Latest Snapshot</p>
            <p className="m-0 text-xs text-gray-500 mb-2">
              {latestTicketSnapshot.synced_at ? new Date(latestTicketSnapshot.synced_at).toLocaleString() : 'Recently synced'}
              {latestTicketSnapshot.provider ? ` · ${latestTicketSnapshot.provider}` : ''}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <p className="m-0"><span className="text-gray-500">Seats:</span> {latestTicketSnapshot.seats_available ?? '—'}</p>
              <p className="m-0"><span className="text-gray-500">Sold:</span> {latestTicketSnapshot.tickets_sold ?? '—'}</p>
              <p className="m-0"><span className="text-gray-500">Gross:</span> {latestTicketSnapshot.gross_revenue ? formatCurrency(latestTicketSnapshot.gross_revenue) : '—'}</p>
              <p className="m-0"><span className="text-gray-500">Net:</span> {latestTicketSnapshot.net_revenue ? formatCurrency(latestTicketSnapshot.net_revenue) : '—'}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 m-0">No ticketing snapshots yet. Run sync once and I will log the first one.</p>
        )}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg m-0">Staffing Requests</h3>
          <span className="text-xs text-gray-500">{openStaffingRequests.length} open request{openStaffingRequests.length === 1 ? '' : 's'}</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">Add role requests and dispatch by email or webhook. LinkedIn Jobs, Indeed, and union local connectors stay queued until credentials are configured.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
          <input
            type="text"
            value={staffingForm.role}
            onChange={(e) => setStaffingForm(prev => ({ ...prev, role: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Role (ex: FOH Engineer)"
          />
          <input
            type="text"
            value={staffingForm.department}
            onChange={(e) => setStaffingForm(prev => ({ ...prev, department: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Department"
          />
          <input
            type="number"
            min="1"
            value={staffingForm.quantity}
            onChange={(e) => setStaffingForm(prev => ({ ...prev, quantity: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Qty"
          />
          <input
            type="datetime-local"
            value={staffingForm.startsAt}
            onChange={(e) => setStaffingForm(prev => ({ ...prev, startsAt: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
          />
          <input
            type="datetime-local"
            value={staffingForm.endsAt}
            onChange={(e) => setStaffingForm(prev => ({ ...prev, endsAt: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
          />
          <select
            value={staffingForm.destinationType}
            onChange={(e) => setStaffingForm(prev => ({ ...prev, destinationType: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
          >
            {STAFFING_DESTINATION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={staffingForm.destinationValue}
            onChange={(e) => setStaffingForm(prev => ({ ...prev, destinationValue: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            placeholder={staffingForm.destinationType === 'email' ? 'dispatcher@union.org' : staffingForm.destinationType === 'webhook' ? 'https://hooks.zapier.com/...' : 'Optional endpoint / destination'}
          />
          <input
            type="text"
            value={staffingForm.notes}
            onChange={(e) => setStaffingForm(prev => ({ ...prev, notes: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Notes"
          />
        </div>
        <div className="flex gap-2 mb-3">
          <button type="button" className="btn-secondary text-sm" onClick={() => handleCreateStaffingRequest(false)}>Save Draft</button>
          <button type="button" className="btn-primary text-sm" onClick={() => handleCreateStaffingRequest(true)}>Dispatch Now</button>
        </div>
        {staffingStatus && <p className="text-xs text-gray-600 mb-3">{staffingStatus}</p>}
        {staffingLoading ? (
          <p className="text-xs text-gray-500 m-0">Loading staffing requests...</p>
        ) : staffingRequests.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No staffing requests yet. Add your first role request above.</p>
        ) : (
          <div className="space-y-2">
            {staffingRequests.map(request => (
              <div key={request.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-medium">{request.role || 'Role TBD'}{request.quantity ? ` x${request.quantity}` : ''}</p>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded capitalize">{request.status || 'draft'}</span>
                </div>
                <p className="m-0 text-xs text-gray-500 mt-1">
                  {request.department || 'Department TBD'}
                  {request.starts_at ? ` · ${new Date(request.starts_at).toLocaleString()}` : ''}
                  {request.ends_at ? ` → ${new Date(request.ends_at).toLocaleString()}` : ''}
                </p>
                <p className="m-0 text-xs text-gray-500 mt-1">
                  Destination: {request.destination_type || 'manual'}
                  {request.destination_value ? ` · ${request.destination_value}` : ''}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleDispatchExistingRequest(request.id)}>Dispatch</button>
                  {STAFFING_STATUS_OPTIONS.filter(status => status !== (request.status || '')).map(status => (
                    <button key={status} type="button" className="text-xs px-2 py-1 border border-gray-200 rounded bg-white capitalize" onClick={() => handleUpdateStaffingStatus(request.id, status)}>
                      Mark {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg m-0">Credential + Day-of-Show Check-In</h3>
          <span className="text-xs text-gray-500">{checkedInCount}/{showCheckins.length} checked in</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">Track cast/crew/vendor arrivals and credential status for run-of-show visibility.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
          <input
            type="text"
            value={checkinForm.contactName}
            onChange={(e) => setCheckinForm(prev => ({ ...prev, contactName: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Name"
          />
          <input
            type="text"
            value={checkinForm.contactRole}
            onChange={(e) => setCheckinForm(prev => ({ ...prev, contactRole: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Role"
          />
          <select
            value={checkinForm.contactType}
            onChange={(e) => setCheckinForm(prev => ({ ...prev, contactType: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
          >
            <option value="cast">Cast / Artist</option>
            <option value="crew">Crew</option>
            <option value="vendor">Vendor</option>
            <option value="guest">Guest</option>
            <option value="press">Press</option>
            <option value="vip">VIP</option>
            <option value="speaker">Speaker</option>
          </select>
          <input
            type="text"
            value={checkinForm.credentialLabel}
            onChange={(e) => setCheckinForm(prev => ({ ...prev, credentialLabel: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Credential (all-access, backstage, etc.)"
          />
          <input
            type="text"
            value={checkinForm.phone}
            onChange={(e) => setCheckinForm(prev => ({ ...prev, phone: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Phone"
          />
          <input
            type="email"
            value={checkinForm.email}
            onChange={(e) => setCheckinForm(prev => ({ ...prev, email: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Email"
          />
          <select
            value={checkinForm.status}
            onChange={(e) => setCheckinForm(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
          >
            {CHECKIN_STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <input
            type="text"
            value={checkinForm.notes}
            onChange={(e) => setCheckinForm(prev => ({ ...prev, notes: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            placeholder="Notes"
          />
        </div>
        <div className="flex gap-2 mb-3">
          <button type="button" className="btn-secondary text-sm" onClick={() => setCheckinForm(buildDefaultCheckinForm())} disabled={checkinLoading}>Clear</button>
          <button type="button" className="btn-primary text-sm" onClick={handleCreateCheckin} disabled={checkinLoading}>Save Check-In Record</button>
        </div>
        {checkinStatus && <p className="text-xs text-gray-600 mb-3">{checkinStatus}</p>}
        {checkinLoading ? (
          <p className="text-xs text-gray-500 m-0">Loading check-ins...</p>
        ) : showCheckins.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No check-in records yet.</p>
        ) : (
          <div className="space-y-2">
            {showCheckins.map((row) => (
              <div key={row.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-medium">{row.contact_name || 'Unknown'}{row.contact_role ? ` · ${row.contact_role}` : ''}</p>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded capitalize">{row.status || 'expected'}</span>
                </div>
                <p className="m-0 text-xs text-gray-500 mt-1">
                  {(row.contact_type || 'crew').replace(/_/g, ' ')}
                  {row.credential_label ? ` · Credential: ${row.credential_label}` : ''}
                  {row.checked_in_at ? ` · Checked in ${new Date(row.checked_in_at).toLocaleString()}` : ''}
                </p>
                {(row.phone || row.email) && (
                  <p className="m-0 text-xs text-gray-500 mt-1">
                    {row.phone}{row.phone && row.email ? ' · ' : ''}{row.email}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleMarkCheckedIn(row.id)}>
                    Mark Checked In
                  </button>
                  {CHECKIN_STATUS_OPTIONS.filter(status => status !== (row.status || '')).map(status => (
                    <button key={status} type="button" className="text-xs px-2 py-1 border border-gray-200 rounded bg-white capitalize" onClick={() => handleUpdateCheckinStatus(row.id, status)}>
                      Set {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg m-0">Contracting / Deal Memo</h3>
          <span className="text-xs text-gray-500">{dealMemos.length} memo{dealMemos.length === 1 ? '' : 's'}</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">Draft terms, send memo, mark signed, and export PDF from one place. Each save creates a tracked revision.</p>
        <p className="text-xs text-gray-500 mb-3">
          Google-first flow: save draft → create Google eSignature doc → in Google Docs click <strong>Tools → eSignature → Request eSignature</strong> → add signer emails → send.
        </p>
        <div className="mb-3 p-3 rounded border border-gray-200 bg-gray-50 text-xs text-gray-700">
          <p className="m-0 font-medium text-gray-800">Texas live event contract process</p>
          <p className="m-0 mt-1">1. Fill payment terms: <strong>Guarantee amount</strong>, <strong>Payment to whom (payee)</strong>, and <strong>Services for what</strong>.</p>
          <p className="m-0 mt-1">2. Confirm parties, event date, and venue details.</p>
          <p className="m-0 mt-1">3. Click <strong>Create Google eSignature Doc</strong> to generate the contract in Google Docs.</p>
          <p className="m-0 mt-1">4. In Google Docs: <strong>Tools → eSignature → Request eSignature</strong>, add signer emails, then send.</p>
          <p className="m-0 mt-1">Governing law defaults to <strong>Texas</strong> and can be edited if needed.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            value={dealMemoForm.title}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, title: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Deal memo title"
          />
          <select
            value={dealMemoForm.status}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
          >
            {DEAL_MEMO_STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select
            value={dealMemoForm.dealType}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, dealType: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
          >
            <option value="performance">Performance</option>
            <option value="appearance">Appearance</option>
            <option value="speaking">Speaking</option>
            <option value="workshop">Workshop</option>
            <option value="custom">Custom</option>
          </select>
          <select
            value={dealMemoForm.compensationModel}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, compensationModel: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
          >
            <option value="guarantee">Guarantee</option>
            <option value="door_split">Door Split</option>
            <option value="backend">Backend</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <input
            type="date"
            value={dealMemoForm.eventDate}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, eventDate: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
          />
          <input
            type="text"
            value={dealMemoForm.venueName}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, venueName: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Venue name"
          />
          <input
            type="text"
            value={dealMemoForm.buyerName}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, buyerName: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Buyer name"
          />
          <input
            type="email"
            value={dealMemoForm.buyerEmail}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, buyerEmail: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Buyer email (for send)"
          />
          <input
            type="text"
            value={dealMemoForm.buyerPhone}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, buyerPhone: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Buyer phone"
          />
          <input
            type="text"
            value={dealMemoForm.sellerName}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, sellerName: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Seller name"
          />
          <input
            type="email"
            value={dealMemoForm.sellerEmail}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, sellerEmail: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Seller email"
          />
          <input
            type="text"
            value={dealMemoForm.sellerPhone}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, sellerPhone: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Seller phone"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={dealMemoForm.guaranteeAmount}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, guaranteeAmount: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Guarantee amount"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={dealMemoForm.depositAmount}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, depositAmount: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Deposit amount"
          />
          <input
            type="text"
            value={dealMemoForm.backendSplit}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, backendSplit: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Backend split"
          />
          <input
            type="text"
            value={dealMemoForm.doorSplit}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, doorSplit: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Door split"
          />
          <input
            type="text"
            value={dealMemoForm.merchSplit}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, merchSplit: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Merch split"
          />
          <input
            type="number"
            min="0"
            value={dealMemoForm.settlementDueHours}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, settlementDueHours: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Settlement due hours"
          />
          <input
            type="text"
            value={dealMemoForm.payeeName}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, payeeName: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Payment to whom (payee name)"
          />
          <input
            type="text"
            value={dealMemoForm.governingLaw}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, governingLaw: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Governing law (Texas)"
          />
          <input
            type="text"
            value={dealMemoForm.signerEmails}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, signerEmails: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            placeholder="Signer emails (comma-separated)"
          />
          <textarea
            value={dealMemoForm.servicesDescription}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, servicesDescription: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            rows={2}
            placeholder="Services for what (scope of work)"
          />
          <textarea
            value={dealMemoForm.promoCommitments}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, promoCommitments: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            rows={2}
            placeholder="Promo commitments"
          />
          <textarea
            value={dealMemoForm.techRiderTerms}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, techRiderTerms: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            rows={2}
            placeholder="Tech rider terms"
          />
          <textarea
            value={dealMemoForm.hospitalityTerms}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, hospitalityTerms: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            rows={2}
            placeholder="Hospitality terms"
          />
          <textarea
            value={dealMemoForm.cancellationTerms}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, cancellationTerms: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            rows={2}
            placeholder="Cancellation terms"
          />
          <textarea
            value={dealMemoForm.forceMajeureTerms}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, forceMajeureTerms: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            rows={2}
            placeholder="Force majeure terms"
          />
          <textarea
            value={dealMemoForm.notes}
            onChange={(e) => setDealMemoForm(prev => ({ ...prev, notes: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            rows={3}
            placeholder="Internal notes"
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" className="btn-secondary text-sm" onClick={handleStartNewDealMemo} disabled={dealMemoLoading || googleSignLoading}>New Memo</button>
          <button type="button" className="btn-secondary text-sm" onClick={() => handleSaveDealMemo(false)} disabled={dealMemoLoading || googleSignLoading}>
            {activeDealMemo ? 'Update Draft' : 'Save Draft'}
          </button>
          <button type="button" className="btn-primary text-sm" onClick={() => handleSaveDealMemo(true)} disabled={dealMemoLoading || googleSignLoading}>Send Memo</button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={handleCreateGoogleSignatureDoc}
            disabled={dealMemoLoading || googleSignLoading}
          >
            {googleSignLoading ? 'Creating Google Doc…' : 'Create Google eSignature Doc'}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={handleOpenGoogleSignatureDoc}
            disabled={!activeGoogleSignature?.fileUrl}
          >
            Open Google Sign Doc
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={handleMarkDealMemoSigned} disabled={dealMemoLoading || googleSignLoading || !activeDealMemoId}>Mark Signed</button>
          <button type="button" className="btn-secondary text-sm" onClick={handleExportDealMemo} disabled={dealMemoLoading || googleSignLoading || !activeDealMemoId}>Export PDF</button>
        </div>
        {activeGoogleSignature?.fileUrl && (
          <p className="text-xs text-gray-500 mb-3">
            Google doc ready. Signer routing: {Array.isArray(activeGoogleSignature.signerEmails) && activeGoogleSignature.signerEmails.length
              ? activeGoogleSignature.signerEmails.join(', ')
              : 'not set'}.
          </p>
        )}
        {dealMemoStatus && <p className="text-xs text-gray-600 mb-3">{dealMemoStatus}</p>}
        {dealMemoLoading ? (
          <p className="text-xs text-gray-500 m-0">Loading deal memos...</p>
        ) : dealMemos.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No deal memos yet. Create one to lock in terms.</p>
        ) : (
          <div className="space-y-2">
            {dealMemos.map((memo) => (
              <button
                key={memo.id}
                type="button"
                onClick={() => handleSelectDealMemo(memo.id)}
                className={`w-full text-left border rounded-lg p-3 text-sm bg-white ${memo.id === activeDealMemoId ? 'border-[#c8a45e]' : 'border-gray-200'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-medium">{memo.title || 'Deal Memo'}</p>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded capitalize">{memo.status || 'draft'}</span>
                </div>
                <p className="m-0 text-xs text-gray-500 mt-1">
                  {memo.buyer_name || 'Buyer TBD'}
                  {memo.event_date ? ` · ${memo.event_date}` : ''}
                  {memo.updated_at ? ` · Updated ${new Date(memo.updated_at).toLocaleString()}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg m-0">Settlement / Reconciliation</h3>
          <span className="text-xs text-gray-500">{settlementReports.length} report{settlementReports.length === 1 ? '' : 's'}</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">Track gross/net, deductions, payouts, and export stakeholder-ready settlement CSV snapshots.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            value={settlementForm.title}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, title: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Settlement title"
          />
          <select
            value={settlementForm.status}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
          >
            {SETTLEMENT_STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <input
            type="text"
            value={settlementForm.currency}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, currency: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Currency (USD)"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={settlementForm.grossRevenue}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, grossRevenue: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Gross revenue"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={settlementForm.taxesFees}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, taxesFees: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Taxes + fees"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={settlementForm.promoterCosts}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, promoterCosts: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Promoter costs"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={settlementForm.productionCosts}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, productionCosts: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Production costs"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={settlementForm.otherDeductions}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, otherDeductions: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Other deductions"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={settlementForm.netRevenue}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, netRevenue: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Net revenue (optional override)"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={settlementForm.guaranteedPayout}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, guaranteedPayout: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Guaranteed payout"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={settlementForm.actualPayout}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, actualPayout: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder="Actual payout"
          />
          <textarea
            value={settlementForm.notes}
            onChange={(e) => setSettlementForm(prev => ({ ...prev, notes: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2"
            rows={3}
            placeholder="Settlement notes"
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" className="btn-secondary text-sm" onClick={handleStartNewSettlement} disabled={settlementLoading}>New Report</button>
          <button type="button" className="btn-secondary text-sm" onClick={() => handleSaveSettlement(false)} disabled={settlementLoading}>
            {activeSettlement ? 'Update Draft' : 'Save Draft'}
          </button>
          <button type="button" className="btn-primary text-sm" onClick={() => handleSaveSettlement(true)} disabled={settlementLoading}>Submit Settlement</button>
          <button type="button" className="btn-secondary text-sm" onClick={handleApproveSettlement} disabled={settlementLoading || !activeSettlementId}>Mark Approved</button>
          <button type="button" className="btn-secondary text-sm" onClick={handleExportSettlement} disabled={settlementLoading || !activeSettlementId}>Export CSV</button>
        </div>
        {settlementStatus && <p className="text-xs text-gray-600 mb-3">{settlementStatus}</p>}
        {settlementLoading ? (
          <p className="text-xs text-gray-500 m-0">Loading settlements...</p>
        ) : settlementReports.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No settlement reports yet. Add one to track gross, net, and payouts.</p>
        ) : (
          <div className="space-y-2">
            {settlementReports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => handleSelectSettlement(report.id)}
                className={`w-full text-left border rounded-lg p-3 text-sm bg-white ${report.id === activeSettlementId ? 'border-[#c8a45e]' : 'border-gray-200'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-medium">{report.title || 'Settlement Report'}</p>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded capitalize">{report.status || 'draft'}</span>
                </div>
                <p className="m-0 text-xs text-gray-500 mt-1">
                  Gross: {report.gross_revenue ? formatCurrency(report.gross_revenue) : '—'}
                  {' · '}
                  Net: {report.net_revenue ? formatCurrency(report.net_revenue) : '—'}
                  {report.updated_at ? ` · Updated ${new Date(report.updated_at).toLocaleString()}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {event.showContacts?.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg mb-3">Show Contacts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {event.showContacts.map((contact, index) => (
              <div key={`${contact.name || contact.role || 'contact'}-${index}`} className="border border-gray-200 rounded-lg p-3 text-sm">
                <p className="font-semibold m-0">
                  {contact.name || 'TBD'} {contact.isPrimary ? <span className="text-xs text-[#c8a45e]">· Primary</span> : null}
                </p>
                <p className="text-gray-500 m-0 mt-1">{contact.role || contact.title || 'Contact'}</p>
                {(contact.phone || contact.email) && (
                  <p className="text-xs text-gray-500 m-0 mt-1">
                    {contact.phone}{contact.phone && contact.email ? ' · ' : ''}{contact.email}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasProductionDetails && (
        <div className="card mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <h3 className="text-lg m-0">{hasCleDetails ? 'CLE / Legal Program Details' : 'Production Details'}</h3>
            {hasCleDetails && (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={handleExportCleComplianceCsv}
              >
                Export CLE Compliance CSV
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {hasTicketingDetails && (
              <>
                {(event.ticketProvider || productionDetails.ticketProvider) && <p className="m-0"><span className="text-gray-500">Ticket Provider:</span> {event.ticketProvider || productionDetails.ticketProvider}</p>}
                {(event.ticketProviderEventId || productionDetails.ticketProviderEventId) && <p className="m-0"><span className="text-gray-500">Provider Event ID:</span> {event.ticketProviderEventId || productionDetails.ticketProviderEventId}</p>}
                {productionDetails.seatsAvailable && <p className="m-0"><span className="text-gray-500">Seats Available:</span> {productionDetails.seatsAvailable}</p>}
                {!hasCleDetails && productionDetails.ticketSalesCount && <p className="m-0"><span className="text-gray-500">Tickets Sold:</span> {productionDetails.ticketSalesCount}</p>}
              </>
            )}
            {hasTheaterDetails && (
              <>
                {productionDetails.productionType && <p className="m-0"><span className="text-gray-500">Production Type:</span> {productionDetails.productionType}</p>}
                {productionDetails.unionHouse && <p className="m-0"><span className="text-gray-500">Union House:</span> {productionDetails.unionHouse}</p>}
                {productionDetails.stageFormat && <p className="m-0"><span className="text-gray-500">Stage Format:</span> {productionDetails.stageFormat}</p>}
                {productionDetails.runtimeMinutes && <p className="m-0"><span className="text-gray-500">Runtime:</span> {productionDetails.runtimeMinutes} min</p>}
                {productionDetails.intermissions && <p className="m-0"><span className="text-gray-500">Intermissions:</span> {productionDetails.intermissions}</p>}
                {productionDetails.rehearsalStart && <p className="m-0"><span className="text-gray-500">Rehearsal Start:</span> {productionDetails.rehearsalStart}</p>}
                {productionDetails.openingNight && <p className="m-0"><span className="text-gray-500">Opening Night:</span> {productionDetails.openingNight}</p>}
                {productionDetails.closingNight && <p className="m-0"><span className="text-gray-500">Closing Night:</span> {productionDetails.closingNight}</p>}
              </>
            )}
            {hasCleDetails && (
              <>
                <p className="m-0"><span className="text-gray-500">Workflow Mode:</span> {legalWorkflowLabel}</p>
                <p className="m-0"><span className="text-gray-500">Approval Gate:</span> {productionDetails.distributionApprovalRequired ? 'Required' : 'Optional'}</p>
                <p className="m-0"><span className="text-gray-500">Distribution Approved:</span> {productionDetails.distributionApproved ? 'Yes' : 'No'}</p>
                {productionDetails.distributionApprovedBy && <p className="m-0"><span className="text-gray-500">Approved By:</span> {productionDetails.distributionApprovedBy}</p>}
                {productionDetails.distributionApprovedAt && <p className="m-0"><span className="text-gray-500">Approved At:</span> {productionDetails.distributionApprovedAt}</p>}
                {legalDisclaimerEnabled && <p className="m-0"><span className="text-gray-500">Disclaimer Template:</span> {legalDisclaimerTemplate.label}</p>}
                {productionDetails.cleCreditHours && <p className="m-0"><span className="text-gray-500">CLE Credit Hours:</span> {productionDetails.cleCreditHours}</p>}
                {productionDetails.legalJurisdiction && <p className="m-0"><span className="text-gray-500">Legal Jurisdiction:</span> {productionDetails.legalJurisdiction}</p>}
                {productionDetails.mcleAccreditationProvider && <p className="m-0"><span className="text-gray-500">MCLE Provider:</span> {productionDetails.mcleAccreditationProvider}</p>}
                {productionDetails.barAssociationSponsor && <p className="m-0"><span className="text-gray-500">Bar Sponsor:</span> {productionDetails.barAssociationSponsor}</p>}
                {productionDetails.mcleApprovalCode && <p className="m-0"><span className="text-gray-500">MCLE Approval Code:</span> {productionDetails.mcleApprovalCode}</p>}
                {productionDetails.mcleStatus && <p className="m-0"><span className="text-gray-500">MCLE Status:</span> {productionDetails.mcleStatus}</p>}
                {productionDetails.cleBarNumbersCollected && <p className="m-0"><span className="text-gray-500">Bar Numbers Collected:</span> {productionDetails.cleBarNumbersCollected}</p>}
                {productionDetails.cleRegistrants && <p className="m-0"><span className="text-gray-500">Registrants:</span> {productionDetails.cleRegistrants}</p>}
                {productionDetails.cleCheckIns && <p className="m-0"><span className="text-gray-500">Check-Ins:</span> {productionDetails.cleCheckIns}</p>}
                {productionDetails.cleCertificatesIssued && <p className="m-0"><span className="text-gray-500">Certificates Issued:</span> {productionDetails.cleCertificatesIssued}</p>}
                {productionDetails.cleCertificatesDeliveredAt && <p className="m-0"><span className="text-gray-500">Certificates Delivered:</span> {productionDetails.cleCertificatesDeliveredAt}</p>}
                {productionDetails.cleAttendanceExportedAt && <p className="m-0"><span className="text-gray-500">Attendance Exported:</span> {productionDetails.cleAttendanceExportedAt}</p>}
                {productionDetails.cleComplianceOwner && <p className="m-0"><span className="text-gray-500">Compliance Owner:</span> {productionDetails.cleComplianceOwner}</p>}
                {legalAttendeeRows.length > 0 && <p className="m-0"><span className="text-gray-500">Attendance Rows:</span> {legalAttendeeRows.length}</p>}
                {productionDetails.ticketSalesCount && <p className="m-0"><span className="text-gray-500">Tickets Sold:</span> {productionDetails.ticketSalesCount}</p>}
                {productionDetails.grossTicketRevenue && <p className="m-0"><span className="text-gray-500">Gross Ticket Revenue:</span> {formatCurrency(productionDetails.grossTicketRevenue)}</p>}
                {productionDetails.netPayoutRevenue && <p className="m-0"><span className="text-gray-500">Net Payout Revenue:</span> {formatCurrency(productionDetails.netPayoutRevenue)}</p>}
                {productionDetails.sponsorshipRevenue && <p className="m-0"><span className="text-gray-500">Sponsorship Revenue:</span> {formatCurrency(productionDetails.sponsorshipRevenue)}</p>}
                {productionDetails.speakerFeesTotal && <p className="m-0"><span className="text-gray-500">Speaker Fees:</span> {formatCurrency(productionDetails.speakerFeesTotal)}</p>}
                {productionDetails.venueCostsTotal && <p className="m-0"><span className="text-gray-500">Venue Costs:</span> {formatCurrency(productionDetails.venueCostsTotal)}</p>}
                {productionDetails.complianceCostsTotal && <p className="m-0"><span className="text-gray-500">Compliance Costs:</span> {formatCurrency(productionDetails.complianceCostsTotal)}</p>}
                {productionDetails.reconciliationStatus && <p className="m-0"><span className="text-gray-500">Reconciliation:</span> {String(productionDetails.reconciliationStatus).replace(/_/g, ' ')}</p>}
                {productionDetails.reconciliationOwner && <p className="m-0"><span className="text-gray-500">Reconciliation Owner:</span> {productionDetails.reconciliationOwner}</p>}
                {productionDetails.reconciliationClosedAt && <p className="m-0"><span className="text-gray-500">Reconciliation Closed:</span> {productionDetails.reconciliationClosedAt}</p>}
                {productionDetails.analyticsSource && <p className="m-0"><span className="text-gray-500">Analytics Source:</span> {productionDetails.analyticsSource}</p>}
                {productionDetails.analyticsLastSyncedAt && <p className="m-0"><span className="text-gray-500">Analytics Last Synced:</span> {productionDetails.analyticsLastSyncedAt}</p>}
                {productionDetails.stakeholderReportExportedAt && <p className="m-0"><span className="text-gray-500">Stakeholder Report Exported:</span> {productionDetails.stakeholderReportExportedAt}</p>}
              </>
            )}
          </div>
          {productionDetails.productionNotes && (
            <p className="text-xs text-gray-600 mt-3 mb-0">{productionDetails.productionNotes}</p>
          )}
          {productionDetails.cleProgramNotes && (
            <p className="text-xs text-gray-600 mt-3 mb-0">{productionDetails.cleProgramNotes}</p>
          )}
          {productionDetails.distributionApprovalNotes && (
            <p className="text-xs text-gray-600 mt-3 mb-0">Approval Notes: {productionDetails.distributionApprovalNotes}</p>
          )}
          {productionDetails.cleComplianceNotes && (
            <p className="text-xs text-gray-600 mt-3 mb-0">Compliance Notes: {productionDetails.cleComplianceNotes}</p>
          )}
          {productionDetails.reconciliationNotes && (
            <p className="text-xs text-gray-600 mt-3 mb-0">Reconciliation Notes: {productionDetails.reconciliationNotes}</p>
          )}
          {cleComplianceStatus && (
            <p className="text-xs text-gray-600 mt-3 mb-0">{cleComplianceStatus}</p>
          )}
        </div>
      )}

      {/* Campaign Status */}
      {hasCampaigns && (
        <div className="card mb-6">
          <h3 className="text-lg mb-4">Campaign Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{activeCampaigns.length}</div>
              <div className="text-sm text-green-700">Active</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{pendingCampaigns.length}</div>
              <div className="text-sm text-yellow-700">Pending</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{failedCampaigns.length}</div>
              <div className="text-sm text-red-700">Failed</div>
            </div>
          </div>
          
          {campaigns.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 mb-2">Campaign Details</h4>
              {campaigns.map(campaign => (
                <div key={campaign.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded text-sm">
                  <div className="flex items-center gap-3">
                    <span className="capitalize font-medium">{campaign.channel.replace(/_/g, ' ')}</span>
                    {campaign.external_url && (
                      <a href={campaign.external_url} target="_blank" rel="noopener noreferrer"
                         className="text-[#c8a45e] hover:underline">
                        View →
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${{
                      'sent': 'bg-green-100 text-green-700',
                      'published': 'bg-green-100 text-green-700',
                      'created': 'bg-green-100 text-green-700',
                      'pending': 'bg-yellow-100 text-yellow-700',
                      'queued': 'bg-yellow-100 text-yellow-700',
                      'failed': 'bg-red-100 text-red-700',
                      'error': 'bg-red-100 text-red-700',
                    }[campaign.status] || 'bg-gray-100 text-gray-700'}`}>
                      {campaign.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Crew & Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Crew */}
        {event.crew && event.crew.length > 0 && (
          <div className="card">
            <h3 className="text-lg mb-3">Crew</h3>
            <div className="space-y-2">
              {event.crew.map((member, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-[#c8a45e] text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {member.name?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div>
                    <div className="font-medium">{member.name || 'Crew Member'}</div>
                    {member.role && (
                      <div className="text-gray-500">{member.role}</div>
                    )}
                    {member.department && (
                      <div className="text-[11px] text-gray-400">{member.department}</div>
                    )}
                    {(member.email || member.phone) && (
                      <div className="text-[11px] text-gray-400">
                        {member.email}{member.email && member.phone ? ' · ' : ''}{member.phone}
                      </div>
                    )}
                    {member.callTime && (
                      <div className="text-[11px] text-gray-400">Call: {member.callTime}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channels */}
        {event.channels && Object.keys(event.channels).length > 0 && (
          <div className="card">
            <h3 className="text-lg mb-3">Distribution Channels</h3>
            <div className="space-y-2">
              {Object.entries(event.channels).filter(([key, enabled]) => enabled).map(([channel]) => (
                <div key={channel} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="capitalize">{channel.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link 
          to={`/events/create?edit=${event.id}`}
          className="btn-secondary no-underline"
        >
          ✏️ Edit Event
        </Link>
        <Link 
          to={`/imc-composer?eventId=${event.id}`}
          className="btn-primary no-underline"
        >
          ✨ Generate Content
        </Link>
        <Link 
          to={`/run-of-show?eventId=${event.id}`}
          className="btn-secondary no-underline"
        >
          📋 Run of Show
        </Link>
        <Link 
          to={`/media?eventId=${event.id}`}
          className="btn-secondary no-underline"
        >
          🖼️ Media Gallery
        </Link>
        <Link 
          to={`/press-page/${event.id}`}
          className="btn-secondary no-underline"
        >
          📰 Press Page
        </Link>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200 bg-red-50">
        <h3 className="text-lg mb-3 text-red-700">Danger Zone</h3>
        <p className="text-sm text-red-600 mb-4">
          This action cannot be undone. This will permanently delete the event and all associated campaigns.
        </p>
        <button 
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete Event'}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-3">Delete Event</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{event.title}"? This action cannot be undone and will also delete:
            </p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1">
              <li>• All generated content</li>
              <li>• All generated images</li>
              <li>• All campaign data</li>
              <li>• Run of show data</li>
            </ul>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
