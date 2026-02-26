import { useEffect, useMemo, useState } from 'react';
import { useVenue } from '../context/VenueContext';
import FormAIAssist from './FormAIAssist';
import EventMessagingPanel from './EventMessagingPanel';
import {
  MERCH_PARTY_TYPE_OPTIONS,
  normalizeMerchAllocations,
  calculateMerchAllocationTotal,
  allocationsTotalIsValid,
} from '../services/merch-revenue';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'media', label: 'Media' },
  { key: 'production', label: 'Production' },
  { key: 'staffing', label: 'Staffing' },
  { key: 'messaging', label: 'Messaging' },
  { key: 'budget', label: 'Budget' },
  { key: 'hospitality', label: 'Hospitality' },
  { key: 'concessions', label: 'Concessions' },
  { key: 'merch', label: 'Merch/Vendors' },
  { key: 'documents', label: 'Documents' },
  { key: 'ticketing', label: 'Ticketing' },
  { key: 'purchasing', label: 'Purchasing' },
];

function resolveTabKey(value) {
  const requested = String(value || '').trim().toLowerCase();
  if (!requested) return 'overview';
  return TABS.some(tab => tab.key === requested) ? requested : 'overview';
}

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function replaceTemplateVars(template = '', payload = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, key) => (
    payload[key] !== undefined && payload[key] !== null ? String(payload[key]) : ''
  ));
}

function blankChecklistItem() {
  return { label: '', category: 'general', providerScope: 'house', status: 'todo' };
}

function blankBudgetLine() {
  return { lineItemName: '', category: '', vendorName: '', costType: 'estimated', amount: '' };
}

function blankRiderItem() {
  return { section: 'hospitality', label: '', quantity: 1, unit: 'ea', required: true, providedBy: 'venue' };
}

function blankDocumentDraft(event = {}) {
  return {
    title: event?.title ? `${event.title} Deal Memo` : 'Deal Memo',
    docType: 'contract',
    templateBody: [
      'Event: {{event_title}}',
      'Date: {{event_date}}',
      'Time: {{event_time}}',
      'Venue: {{event_venue}}',
      'Address: {{event_address}}',
      'Ticket URL: {{ticket_link}}',
      '',
      'Terms:',
      '- Compensation: ',
      '- Deposit: ',
      '- Cancellation Policy: ',
    ].join('\n'),
    renderedBody: '',
  };
}

function blankPoItem() {
  return {
    inventoryItemId: '',
    label: '',
    quantity: 1,
    unit: 'ea',
    unitCost: '',
    supplierId: '',
    supplierSku: '',
    supplierItemUrl: '',
    notes: '',
  };
}

function blankCaptureSource() {
  return {
    type: 'camera',
    name: '',
    location: '',
    operator: '',
    aiControlEnabled: false,
  };
}

function blankConcessionsMenuItem() {
  return {
    name: '',
    category: 'other',
    price: '',
    costBasis: '',
    supplierReference: '',
    alcoholFlag: false,
    inventoryLink: '',
    isSignatureItem: false,
    availabilityStatus: 'available',
    notes: '',
  };
}

function blankMerchParticipant() {
  return {
    name: '',
    organizationName: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
    supervisorName: '',
    merchTableRequired: true,
    staffRunningTable: '',
    paymentMethodsAccepted: [],
    tableAssignmentLabel: '',
    notes: '',
  };
}

function blankMerchSplit() {
  return {
    appliesTo: 'all_merch',
    participantId: '',
    splitType: 'gross',
    tableFeeDeductedFirst: false,
    notes: '',
    percentageAllocations: [
      { partyType: 'venue', percentage: 50 },
      { partyType: 'artist', percentage: 50 },
    ],
  };
}

function blankStaffProfile() {
  return {
    firstName: '',
    lastName: '',
    displayName: '',
    phoneNumber: '',
    email: '',
    primaryRole: '',
    payType: 'hourly',
    defaultRate: '',
    jobTitles: [],
    notes: '',
    isActive: true,
  };
}

function blankStaffAssignment() {
  return {
    staffProfileId: '',
    jobTitleId: '',
    jobTitle: '',
    startTime: '',
    endTime: '',
    payType: 'hourly',
    payOverride: '',
    status: 'scheduled',
    notes: '',
  };
}

function blankRoleRequirement() {
  return {
    role: '',
    requiredCount: 1,
  };
}

function toJulieOpsStatus(message) {
  const raw = String(message || '').trim();
  if (!raw) return '';
  if (/could not|failed/i.test(raw)) return `I hit a snag: ${raw}`;
  if (/is required|needs a/i.test(raw)) return `One more detail and we are set: ${raw}`;
  if (/select /i.test(raw)) return raw.replace(/^select /i, 'Choose ');
  return raw;
}

function isMissingSchemaEntityError(error) {
  const message = String(error?.message || error || '');
  return /could not find the table .* in the schema cache/i.test(message)
    || /relation .+ does not exist/i.test(message)
    || /column .+ does not exist/i.test(message);
}

export default function BookingOperationsWorkspace({ event, initialTab = '' }) {
  const {
    getTicketingProviders,
    listVenueTicketingConnections,
    listBookingTicketingRecords,
    createBookingTicketingEventRecord,
    linkBookingTicketingEventRecord,
    syncBookingTicketingRecordData,
    listProductionChecklists,
    saveProductionChecklist,
    saveProductionChecklistItem,
    removeProductionChecklistItem,
    listJobTitles,
    seedJobTitleLibrary,
    saveJobTitle,
    removeJobTitle,
    listStaffProfiles,
    parseStaffVoiceProfile,
    saveStaffProfile,
    removeStaffProfile,
    listStaffAssignments,
    saveStaffAssignment,
    removeStaffAssignment,
    bulkAssignStaffShift,
    publishStaffingSchedule,
    getStaffingDashboard,
    exportStaffSheet,
    getVenueStaffingPolicy,
    saveVenueStaffingPolicy,
    listBookingBudgets,
    saveBookingBudget,
    saveBookingBudgetLine,
    listBookingRiders,
    saveBookingRider,
    saveBookingRiderItem,
    getMediaCapturePlan,
    saveMediaCapturePlan,
    listCaptureSources,
    saveCaptureSource,
    removeCaptureSource,
    getZoomMeetingConfig,
    saveZoomMeetingConfig,
    createZoomMeeting,
    linkZoomMeeting,
    listZoomAssets,
    saveZoomAsset,
    getYouTubeDistribution,
    saveYouTubeDistribution,
    publishZoomRecordingToYouTube,
    getConcessionsPlan,
    saveConcessionsPlan,
    listConcessionsMenuItems,
    saveConcessionsMenuItem,
    removeConcessionsMenuItem,
    getMerchPlan,
    saveMerchPlan,
    listMerchParticipants,
    saveMerchParticipant,
    removeMerchParticipant,
    listMerchRevenueSplits,
    saveMerchRevenueSplit,
    listBookingDocuments,
    saveBookingDocument,
    listVenueSuppliers,
    listVenueInventory,
    listInventorySupplierLinks,
    listBookingPurchaseOrders,
    saveBookingPurchaseOrder,
    splitBookingPurchaseOrdersBySupplier,
    generatePurchaseOrderEmails,
  } = useVenue();

  const [activeTab, setActiveTab] = useState(() => resolveTabKey(initialTab));
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [ticketingRecords, setTicketingRecords] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [staffAssignments, setStaffAssignments] = useState([]);
  const [staffingDashboard, setStaffingDashboard] = useState({ coverage: {}, assignments: [] });
  const [staffingPolicy, setStaffingPolicy] = useState({
    callInPolicy: '',
    noticeHours: 4,
    supervisorName: '',
    supervisorPhone: '',
    supervisorEmail: '',
  });
  const [staffingFilters, setStaffingFilters] = useState({
    role: '',
    staffProfileId: '',
  });
  const [staffingWeekStart, setStaffingWeekStart] = useState(event?.date || '');
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [riders, setRiders] = useState([]);
  const [mediaCapturePlan, setMediaCapturePlan] = useState(null);
  const [captureSources, setCaptureSources] = useState([]);
  const [zoomMeetingConfig, setZoomMeetingConfig] = useState(null);
  const [zoomAssets, setZoomAssets] = useState([]);
  const [youtubeDistribution, setYouTubeDistribution] = useState(null);
  const [concessionsPlan, setConcessionsPlan] = useState(null);
  const [concessionsMenuItems, setConcessionsMenuItems] = useState([]);
  const [merchPlan, setMerchPlan] = useState(null);
  const [merchParticipants, setMerchParticipants] = useState([]);
  const [merchRevenueSplits, setMerchRevenueSplits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [venueSuppliers, setVenueSuppliers] = useState([]);
  const [venueInventory, setVenueInventory] = useState([]);
  const [inventorySupplierLinks, setInventorySupplierLinks] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poEmailDrafts, setPoEmailDrafts] = useState([]);

  const [ticketingForm, setTicketingForm] = useState({
    providerId: '',
    providerType: 'eventbrite',
    externalEventId: '',
    externalEventUrl: '',
    ticketSalesUrl: '',
    manualMode: true,
  });
  const [checklistForm, setChecklistForm] = useState({
    title: event?.title ? `${event.title} Production Checklist` : 'Production Checklist',
    phase: 'preflight',
  });
  const [checklistDraftItems, setChecklistDraftItems] = useState([blankChecklistItem()]);
  const [jobTitleDraft, setJobTitleDraft] = useState({ name: '', department: 'production' });
  const [staffProfileForm, setStaffProfileForm] = useState(blankStaffProfile());
  const [staffAssignmentForm, setStaffAssignmentForm] = useState(blankStaffAssignment());
  const [roleRequirements, setRoleRequirements] = useState([blankRoleRequirement()]);
  const [bulkShift, setBulkShift] = useState({
    startTime: '',
    endTime: '',
    jobTitle: '',
    jobTitleId: '',
    payType: 'hourly',
    payOverride: '',
    status: 'scheduled',
    notes: '',
  });
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [budgetForm, setBudgetForm] = useState({
    title: event?.title ? `${event.title} Show Budget` : 'Show Budget',
    currency: 'USD',
    status: 'draft',
    totalBudget: '',
  });
  const [budgetDraftLines, setBudgetDraftLines] = useState([blankBudgetLine()]);
  const [riderForm, setRiderForm] = useState({
    title: event?.title ? `${event.title} Green Room Rider` : 'Green Room Rider',
    riderType: 'hospitality',
    status: 'draft',
  });
  const [riderDraftItems, setRiderDraftItems] = useState([blankRiderItem()]);
  const [mediaPlanForm, setMediaPlanForm] = useState({
    recordingType: 'video',
    captureMode: 'static',
    primaryPlatform: 'youtube',
    streamLive: false,
    rightsClearanceStatus: 'pending',
    postProductionNotes: '',
  });
  const [captureSourceDraft, setCaptureSourceDraft] = useState(blankCaptureSource());
  const [zoomForm, setZoomForm] = useState({
    zoomMeetingType: 'meeting',
    zoomMeetingId: '',
    zoomJoinUrl: '',
    zoomHostEmail: '',
    zoomPasscode: '',
    zoomCloudRecordingEnabled: true,
    zoomTranscriptEnabled: true,
    zoomStatus: 'not_scheduled',
  });
  const [youtubeForm, setYouTubeForm] = useState({
    youtubeVideoUrl: '',
    youtubeVideoId: '',
    publishStatus: 'not_published',
    publishNotes: '',
  });
  const [concessionsForm, setConcessionsForm] = useState({
    isActive: true,
    managerContactId: '',
    barOpenTime: '',
    barCloseTime: '',
    intermissionService: false,
    cashlessOnly: false,
    notes: '',
  });
  const [concessionsDraftItems, setConcessionsDraftItems] = useState([blankConcessionsMenuItem()]);
  const [merchPlanForm, setMerchPlanForm] = useState({
    merchManagerContactId: '',
    tableFee: false,
    tableFeeAmount: '',
    merchAreaLocation: '',
    loadInTime: '',
    marketplaceMode: false,
    notes: '',
  });
  const [merchDraftParticipants, setMerchDraftParticipants] = useState([blankMerchParticipant()]);
  const [merchSplitForm, setMerchSplitForm] = useState(blankMerchSplit());
  const [documentDrafts, setDocumentDrafts] = useState([blankDocumentDraft(event)]);
  const [poForm, setPoForm] = useState({
    supplierId: '',
    currency: 'USD',
    deliveryInstructions: '',
    receivingHours: '',
    dockNotes: '',
    purchaserName: '',
    purchaserEmail: '',
  });
  const [poDraftItems, setPoDraftItems] = useState([blankPoItem()]);

  useEffect(() => {
    setActiveTab(resolveTabKey(initialTab));
  }, [initialTab]);

  const autofillPayload = useMemo(() => ({
    event_title: event?.title || '',
    event_date: event?.date || '',
    event_time: event?.time || '',
    event_venue: event?.venue || '',
    event_address: event?.venueAddress || '',
    ticket_link: event?.ticketLink || '',
    ticket_provider: event?.ticketProvider || '',
  }), [event]);

  const supplierById = useMemo(() => {
    const map = new Map();
    (venueSuppliers || []).forEach((supplier) => map.set(supplier.id, supplier));
    return map;
  }, [venueSuppliers]);

  const preferredSupplierLinkByInventory = useMemo(() => {
    const map = new Map();
    (inventorySupplierLinks || []).forEach((link) => {
      if (!link?.inventory_item_id) return;
      if (link.preferred || !map.has(link.inventory_item_id)) {
        map.set(link.inventory_item_id, link);
      }
    });
    return map;
  }, [inventorySupplierLinks]);

  const filteredStaffAssignments = useMemo(() => (
    (staffAssignments || []).filter((assignment) => {
      if (staffingFilters.role && !(assignment.job_title || '').toLowerCase().includes(staffingFilters.role.toLowerCase())) {
        return false;
      }
      if (staffingFilters.staffProfileId && assignment.staff_profile_id !== staffingFilters.staffProfileId) {
        return false;
      }
      return true;
    })
  ), [staffAssignments, staffingFilters]);

  const weeklyStaffAssignments = useMemo(() => {
    if (!staffingWeekStart) return filteredStaffAssignments;
    const start = new Date(`${staffingWeekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) return filteredStaffAssignments;
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return filteredStaffAssignments.filter((assignment) => {
      if (!assignment.start_time) return false;
      const date = new Date(assignment.start_time);
      if (Number.isNaN(date.getTime())) return false;
      return date >= start && date < end;
    });
  }, [filteredStaffAssignments, staffingWeekStart]);

  const loadAll = async () => {
    if (!event?.id) return;
    setLoading(true);
    setStatus('');
    try {
      const loadIssues = [];
      const safeLoad = async (label, task, fallback) => {
        try {
          return await task();
        } catch (err) {
          loadIssues.push({ label, err });
          return fallback;
        }
      };

      const [
        providerRows,
        venueConnections,
        bookingRecords,
        checklistRows,
        jobTitleRows,
        staffProfileRows,
        staffAssignmentRows,
        staffingDashboardRow,
        staffingPolicyRow,
        budgetRows,
        riderRows,
        mediaPlanRow,
        captureSourceRows,
        zoomConfigRow,
        zoomAssetRows,
        youtubeDistributionRow,
        concessionsPlanRow,
        concessionsMenuRows,
        merchPlanRow,
        merchParticipantRows,
        merchSplitRows,
        documentRows,
        supplierRows,
        inventoryRows,
        supplierLinks,
        purchaseOrderRows,
      ] = await Promise.all([
        safeLoad('ticketing providers', () => getTicketingProviders(), []),
        event.venueProfileId
          ? safeLoad('venue ticketing connections', () => listVenueTicketingConnections(event.venueProfileId), [])
          : Promise.resolve([]),
        safeLoad('ticketing records', () => listBookingTicketingRecords(event.id), []),
        safeLoad('production checklists', () => listProductionChecklists(event.id), []),
        safeLoad('job titles', () => listJobTitles(), []),
        safeLoad('staff profiles', () => listStaffProfiles(), []),
        safeLoad('staff assignments', () => listStaffAssignments(event.id), []),
        safeLoad('staffing dashboard', () => getStaffingDashboard(event.id, { roleRequirements }), { coverage: {}, assignments: [] }),
        event.venueProfileId
          ? safeLoad('staffing policy', () => getVenueStaffingPolicy(event.venueProfileId), null)
          : Promise.resolve(null),
        safeLoad('budgets', () => listBookingBudgets(event.id), []),
        safeLoad('hospitality riders', () => listBookingRiders(event.id), []),
        safeLoad('media capture plan', () => getMediaCapturePlan(event.id), null),
        safeLoad('capture sources', () => listCaptureSources(event.id), []),
        safeLoad('Zoom config', () => getZoomMeetingConfig(event.id), null),
        safeLoad('Zoom assets', () => listZoomAssets(event.id), []),
        safeLoad('YouTube distribution', () => getYouTubeDistribution(event.id), null),
        safeLoad('concessions plan', () => getConcessionsPlan(event.id), null),
        safeLoad('concessions menu', () => listConcessionsMenuItems(event.id), []),
        safeLoad('merch plan', () => getMerchPlan(event.id), null),
        safeLoad('merch participants', () => listMerchParticipants(event.id), []),
        safeLoad('merch revenue splits', () => listMerchRevenueSplits(event.id), []),
        safeLoad('booking documents', () => listBookingDocuments(event.id), []),
        event.venueProfileId
          ? safeLoad('venue suppliers', () => listVenueSuppliers(event.venueProfileId), [])
          : Promise.resolve([]),
        event.venueProfileId
          ? safeLoad('venue inventory', () => listVenueInventory(event.venueProfileId), [])
          : Promise.resolve([]),
        event.venueProfileId
          ? safeLoad('inventory supplier links', () => listInventorySupplierLinks({ venueProfileId: event.venueProfileId }), [])
          : Promise.resolve([]),
        safeLoad('purchase orders', () => listBookingPurchaseOrders(event.id), []),
      ]);
      setProviders(providerRows || []);
      setConnections(venueConnections || []);
      setTicketingRecords(bookingRecords || []);
      setChecklists(checklistRows || []);
      setJobTitles(jobTitleRows || []);
      setStaffProfiles(staffProfileRows || []);
      setStaffAssignments(staffAssignmentRows || []);
      setStaffingDashboard(staffingDashboardRow || { coverage: {}, assignments: [] });
      if (staffingPolicyRow) {
        setStaffingPolicy({
          id: staffingPolicyRow.id,
          callInPolicy: staffingPolicyRow.call_in_policy || '',
          noticeHours: staffingPolicyRow.notice_hours ?? 4,
          supervisorName: staffingPolicyRow.supervisor_name || '',
          supervisorPhone: staffingPolicyRow.supervisor_phone || '',
          supervisorEmail: staffingPolicyRow.supervisor_email || '',
        });
      } else {
        setStaffingPolicy({
          callInPolicy: '',
          noticeHours: 4,
          supervisorName: '',
          supervisorPhone: '',
          supervisorEmail: '',
        });
      }
      setBudgets(budgetRows || []);
      setRiders(riderRows || []);
      setMediaCapturePlan(mediaPlanRow || null);
      setCaptureSources(captureSourceRows || []);
      setZoomMeetingConfig(zoomConfigRow || null);
      setZoomAssets(zoomAssetRows || []);
      setYouTubeDistribution(youtubeDistributionRow || null);
      setConcessionsPlan(concessionsPlanRow || null);
      setConcessionsMenuItems(concessionsMenuRows || []);
      setMerchPlan(merchPlanRow || null);
      setMerchParticipants(merchParticipantRows || []);
      setMerchRevenueSplits(merchSplitRows || []);
      setDocuments(documentRows || []);
      setVenueSuppliers(supplierRows || []);
      setVenueInventory(inventoryRows || []);
      setInventorySupplierLinks(supplierLinks || []);
      setPurchaseOrders(purchaseOrderRows || []);

      if (mediaPlanRow) {
        setMediaPlanForm({
          recordingType: mediaPlanRow.recording_type || 'video',
          captureMode: mediaPlanRow.capture_mode || 'static',
          primaryPlatform: mediaPlanRow.primary_platform || 'youtube',
          streamLive: !!mediaPlanRow.stream_live,
          rightsClearanceStatus: mediaPlanRow.rights_clearance_status || 'pending',
          postProductionNotes: mediaPlanRow.post_production_notes || '',
        });
      } else {
        setMediaPlanForm({
          recordingType: 'video',
          captureMode: 'static',
          primaryPlatform: 'youtube',
          streamLive: false,
          rightsClearanceStatus: 'pending',
          postProductionNotes: '',
        });
      }

      if (zoomConfigRow) {
        setZoomForm({
          zoomMeetingType: zoomConfigRow.zoom_meeting_type || 'meeting',
          zoomMeetingId: zoomConfigRow.zoom_meeting_id || '',
          zoomJoinUrl: zoomConfigRow.zoom_join_url || '',
          zoomHostEmail: zoomConfigRow.zoom_host_email || '',
          zoomPasscode: zoomConfigRow.zoom_passcode || '',
          zoomCloudRecordingEnabled: !!zoomConfigRow.zoom_cloud_recording_enabled,
          zoomTranscriptEnabled: !!zoomConfigRow.zoom_transcript_enabled,
          zoomStatus: zoomConfigRow.zoom_status || 'not_scheduled',
        });
      }

      if (youtubeDistributionRow) {
        setYoutubeForm({
          youtubeVideoUrl: youtubeDistributionRow.youtube_video_url || '',
          youtubeVideoId: youtubeDistributionRow.youtube_video_id || '',
          publishStatus: youtubeDistributionRow.publish_status || 'not_published',
          publishNotes: youtubeDistributionRow.publish_notes || '',
        });
      }

      if (concessionsPlanRow) {
        setConcessionsForm({
          isActive: concessionsPlanRow.is_active !== false,
          managerContactId: concessionsPlanRow.manager_contact_id || '',
          barOpenTime: toDateTimeInput(concessionsPlanRow.bar_open_time),
          barCloseTime: toDateTimeInput(concessionsPlanRow.bar_close_time),
          intermissionService: !!concessionsPlanRow.intermission_service,
          cashlessOnly: !!concessionsPlanRow.cashless_only,
          notes: concessionsPlanRow.notes || '',
        });
      } else {
        setConcessionsForm({
          isActive: true,
          managerContactId: '',
          barOpenTime: '',
          barCloseTime: '',
          intermissionService: false,
          cashlessOnly: false,
          notes: '',
        });
      }

      if (merchPlanRow) {
        setMerchPlanForm({
          merchManagerContactId: merchPlanRow.merch_manager_contact_id || '',
          tableFee: !!merchPlanRow.table_fee,
          tableFeeAmount: merchPlanRow.table_fee_amount || '',
          merchAreaLocation: merchPlanRow.merch_area_location || '',
          loadInTime: toDateTimeInput(merchPlanRow.load_in_time),
          marketplaceMode: !!merchPlanRow.marketplace_mode,
          notes: merchPlanRow.notes || '',
        });
      } else {
        setMerchPlanForm({
          merchManagerContactId: '',
          tableFee: false,
          tableFeeAmount: '',
          merchAreaLocation: '',
          loadInTime: '',
          marketplaceMode: false,
          notes: '',
        });
      }

      if (!ticketingForm.providerId && providerRows?.length) {
        const defaultFromVenue = venueConnections?.find(row => row.is_default);
        const providerId = defaultFromVenue?.ticketing_provider_id || providerRows[0].id;
        const provider = providerRows.find(row => row.id === providerId);
        setTicketingForm(prev => ({
          ...prev,
          providerId,
          providerType: provider?.type || prev.providerType,
        }));
      }
      if (loadIssues.length) {
        const missingOnly = loadIssues.every((issue) => isMissingSchemaEntityError(issue.err));
        if (missingOnly) {
          setStatus('Some operations modules are not active yet because database tables are missing. Run the latest Supabase schema and refresh.');
        } else {
          setStatus(`Loaded what I could, but ${loadIssues.length} module${loadIssues.length === 1 ? '' : 's'} need attention.`);
        }
      }
    } catch (err) {
      setStatus(`Could not load operations workspace data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [event?.id]);

  useEffect(() => {
    setDocumentDrafts([blankDocumentDraft(event)]);
    setPoDraftItems([blankPoItem()]);
    setPoEmailDrafts([]);
    setStaffProfileForm(blankStaffProfile());
    setStaffAssignmentForm(blankStaffAssignment());
    setRoleRequirements([blankRoleRequirement()]);
    setSelectedStaffIds([]);
    setStaffingFilters({ role: '', staffProfileId: '' });
    setStaffingWeekStart(event?.date || '');
    setBulkShift({
      startTime: '',
      endTime: '',
      jobTitle: '',
      jobTitleId: '',
      payType: 'hourly',
      payOverride: '',
      status: 'scheduled',
      notes: '',
    });
    setVoiceTranscript('');
    setCaptureSourceDraft(blankCaptureSource());
    setConcessionsDraftItems([blankConcessionsMenuItem()]);
    setMerchDraftParticipants([blankMerchParticipant()]);
    setMerchSplitForm(blankMerchSplit());
    setPoForm({
      supplierId: '',
      currency: 'USD',
      deliveryInstructions: '',
      receivingHours: '',
      dockNotes: '',
      purchaserName: '',
      purchaserEmail: '',
    });
  }, [event?.id]);

  const handleCreateTicketingEvent = async () => {
    if (!event?.id) return;
    if (!ticketingForm.providerId && !ticketingForm.providerType) {
      setStatus('Choose a ticketing provider first.');
      return;
    }
    try {
      setStatus('Creating ticketing event...');
      const response = await createBookingTicketingEventRecord(event.id, {
        ticketingProviderId: ticketingForm.providerId || undefined,
        providerType: ticketingForm.providerType,
      });
      if (response?.needsManualLink) {
        setStatus(response.warning || 'Auto-create not available for this provider. Link an existing event.');
      } else {
        setStatus('Ticketing event created and linked.');
      }
      await loadAll();
    } catch (err) {
      setStatus(`Ticketing create failed: ${err.message}`);
    }
  };

  const handleLinkTicketingEvent = async () => {
    if (!event?.id) return;
    try {
      setStatus('Linking external ticketing event...');
      await linkBookingTicketingEventRecord(event.id, {
        ticketingProviderId: ticketingForm.providerId || undefined,
        providerType: ticketingForm.providerType,
        externalEventId: ticketingForm.externalEventId,
        externalEventUrl: ticketingForm.externalEventUrl,
        ticketSalesUrl: ticketingForm.ticketSalesUrl || ticketingForm.externalEventUrl,
        manualMode: ticketingForm.manualMode,
      });
      setTicketingForm(prev => ({ ...prev, externalEventId: '', externalEventUrl: '', ticketSalesUrl: '' }));
      setStatus('Ticketing event linked.');
      await loadAll();
    } catch (err) {
      setStatus(`Ticketing link failed: ${err.message}`);
    }
  };

  const handleSyncTicketingRecord = async (recordId) => {
    try {
      setStatus('Syncing ticketing record...');
      await syncBookingTicketingRecordData(recordId, {
        venueProfileId: event?.venueProfileId || null,
      });
      setStatus('Ticketing snapshot synced.');
      await loadAll();
    } catch (err) {
      setStatus(`Ticketing sync failed: ${err.message}`);
    }
  };

  const handleSaveChecklist = async () => {
    try {
      setStatus('Saving production checklist...');
      const checklist = await saveProductionChecklist(event.id, checklistForm);
      for (const item of checklistDraftItems) {
        if (!String(item.label || '').trim()) continue;
        await saveProductionChecklistItem(checklist.id, item);
      }
      setChecklistDraftItems([blankChecklistItem()]);
      setStatus('Production checklist saved.');
      await loadAll();
    } catch (err) {
      setStatus(`Checklist save failed: ${err.message}`);
    }
  };

  const applyStaffProfilePatch = (patch = {}) => {
    if (!patch || typeof patch !== 'object') return;
    setStaffProfileForm(prev => ({
      ...prev,
      ...patch,
      jobTitles: Array.isArray(patch.jobTitles) ? patch.jobTitles : prev.jobTitles,
      payType: patch.payType || prev.payType || 'hourly',
      defaultRate: patch.defaultRate ?? prev.defaultRate,
    }));
  };

  const handleParseVoiceStaff = async () => {
    if (!voiceTranscript.trim()) {
      setStatus('Add transcript text first.');
      return;
    }
    try {
      setStatus('Parsing staff voice transcript...');
      const parsed = await parseStaffVoiceProfile(voiceTranscript);
      applyStaffProfilePatch(parsed);
      setStatus('Voice transcript parsed. Review before saving.');
    } catch (err) {
      setStatus(`Voice parse failed: ${err.message}`);
    }
  };

  const handleSaveJobTitle = async () => {
    if (!jobTitleDraft.name.trim()) {
      setStatus('Job title name is required.');
      return;
    }
    try {
      setStatus('Saving job title...');
      await saveJobTitle(jobTitleDraft);
      setJobTitleDraft({ name: '', department: 'production' });
      await loadAll();
      setStatus('Job title saved.');
    } catch (err) {
      setStatus(`Job title save failed: ${err.message}`);
    }
  };

  const handleSaveStaffProfile = async () => {
    if (!staffProfileForm.displayName && !(staffProfileForm.firstName || '').trim()) {
      setStatus('Staff profile needs a name.');
      return;
    }
    if (!(staffProfileForm.phoneNumber || '').trim()) {
      setStatus('Staff profile needs a phone number.');
      return;
    }
    try {
      setStatus('Saving staff profile...');
      await saveStaffProfile(staffProfileForm);
      setStaffProfileForm(blankStaffProfile());
      setVoiceTranscript('');
      await loadAll();
      setStatus('Staff profile saved.');
    } catch (err) {
      setStatus(`Staff profile save failed: ${err.message}`);
    }
  };

  const toggleStaffProfileSelection = (profileId) => {
    setSelectedStaffIds(prev => (
      prev.includes(profileId)
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    ));
  };

  const toggleJobTitleSelection = (titleName) => {
    setStaffProfileForm(prev => {
      const exists = (prev.jobTitles || []).includes(titleName);
      return {
        ...prev,
        jobTitles: exists
          ? prev.jobTitles.filter(name => name !== titleName)
          : [...(prev.jobTitles || []), titleName],
      };
    });
  };

  const handleSaveStaffAssignment = async () => {
    if (!staffAssignmentForm.staffProfileId) {
      setStatus('Select a staff member for assignment.');
      return;
    }
    if (!staffAssignmentForm.startTime || !staffAssignmentForm.endTime) {
      setStatus('Start and end time are required.');
      return;
    }
    try {
      setStatus('Saving staff assignment...');
      await saveStaffAssignment(event.id, {
        ...staffAssignmentForm,
        startTime: toIsoOrNull(staffAssignmentForm.startTime),
        endTime: toIsoOrNull(staffAssignmentForm.endTime),
        payOverride: staffAssignmentForm.payOverride === '' ? null : Number(staffAssignmentForm.payOverride),
      });
      setStaffAssignmentForm(blankStaffAssignment());
      await loadAll();
      setStatus('Staff assignment saved.');
    } catch (err) {
      setStatus(`Assignment save failed: ${err.message}`);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedStaffIds.length) {
      setStatus('Select at least one staff profile for bulk shift.');
      return;
    }
    if (!bulkShift.startTime || !bulkShift.endTime) {
      setStatus('Bulk shift start/end are required.');
      return;
    }
    try {
      setStatus('Creating bulk staff assignments...');
      const response = await bulkAssignStaffShift(event.id, {
        staffProfileIds: selectedStaffIds,
        startTime: toIsoOrNull(bulkShift.startTime),
        endTime: toIsoOrNull(bulkShift.endTime),
        jobTitle: bulkShift.jobTitle,
        jobTitleId: bulkShift.jobTitleId || null,
        payType: bulkShift.payType,
        payOverride: bulkShift.payOverride === '' ? null : Number(bulkShift.payOverride),
        status: bulkShift.status,
        notes: bulkShift.notes,
      });
      setSelectedStaffIds([]);
      await loadAll();
      setStatus(`Bulk assignment created: ${response.createdCount || 0}. Conflicts: ${response.conflictCount || 0}.`);
    } catch (err) {
      setStatus(`Bulk assignment failed: ${err.message}`);
    }
  };

  const handlePublishStaffing = async () => {
    try {
      setStatus('Publishing staffing schedule and notifying crew...');
      const response = await publishStaffingSchedule(event.id, {
        policy: staffingPolicy,
      });
      await loadAll();
      setStatus(
        `Staffing published. SMS sent: ${response.sentSms || 0}. Email sent: ${response.sentEmail || 0}. `
        + `Fallback messages: ${response.fallbackMessages?.length || 0}.`
      );
    } catch (err) {
      setStatus(`Publish staffing failed: ${err.message}`);
    }
  };

  const handleSaveStaffingPolicy = async () => {
    if (!event?.venueProfileId) {
      setStatus('This booking has no venue profile, so staffing policy cannot be saved yet.');
      return;
    }
    try {
      setStatus('Saving staffing call-in policy...');
      const saved = await saveVenueStaffingPolicy(event.venueProfileId, staffingPolicy);
      setStaffingPolicy(prev => ({
        ...prev,
        id: saved?.id || prev.id,
      }));
      setStatus('Staffing policy saved.');
    } catch (err) {
      setStatus(`Policy save failed: ${err.message}`);
    }
  };

  const handleExportStaffSheet = async (mode) => {
    try {
      setStatus('Exporting staff sheet...');
      const response = await exportStaffSheet(event.id, {
        mode,
        roleRequirements: roleRequirements.filter((row) => row.role),
      });
      const link = document.createElement('a');
      link.href = response.downloadUrl;
      link.download = response.fileName || `staff-${mode}.pdf`;
      link.click();
      setStatus('Staff sheet exported.');
    } catch (err) {
      setStatus(`Staff sheet export failed: ${err.message}`);
    }
  };

  const handleRefreshStaffingDashboard = async () => {
    try {
      const response = await getStaffingDashboard(event.id, {
        roleRequirements: roleRequirements.filter((row) => row.role),
      });
      setStaffingDashboard(response || { coverage: {}, assignments: [] });
    } catch (err) {
      setStatus(`Could not refresh staffing dashboard: ${err.message}`);
    }
  };

  const handleSaveBudget = async () => {
    try {
      setStatus('Saving budget...');
      const budget = await saveBookingBudget(event.id, budgetForm);
      for (const line of budgetDraftLines) {
        if (!String(line.lineItemName || '').trim()) continue;
        await saveBookingBudgetLine(budget.id, line);
      }
      setBudgetDraftLines([blankBudgetLine()]);
      setStatus('Budget saved.');
      await loadAll();
    } catch (err) {
      setStatus(`Budget save failed: ${err.message}`);
    }
  };

  const handleSaveRider = async () => {
    try {
      setStatus('Saving rider...');
      const rider = await saveBookingRider(event.id, riderForm);
      for (const item of riderDraftItems) {
        if (!String(item.label || '').trim()) continue;
        await saveBookingRiderItem(rider.id, item);
      }
      setRiderDraftItems([blankRiderItem()]);
      setStatus('Rider saved.');
      await loadAll();
    } catch (err) {
      setStatus(`Rider save failed: ${err.message}`);
    }
  };

  const handleSaveMediaPlan = async () => {
    try {
      setStatus('Saving media capture plan...');
      await saveMediaCapturePlan(event.id, mediaPlanForm);
      await loadAll();
      setStatus('Media capture plan saved.');
    } catch (err) {
      setStatus(`Media plan save failed: ${err.message}`);
    }
  };

  const handleSaveCaptureSource = async () => {
    if (!String(captureSourceDraft.name || '').trim()) {
      setStatus('Capture source name is required.');
      return;
    }
    try {
      setStatus('Saving capture source...');
      await saveCaptureSource(event.id, captureSourceDraft);
      setCaptureSourceDraft(blankCaptureSource());
      await loadAll();
      setStatus('Capture source saved.');
    } catch (err) {
      setStatus(`Capture source save failed: ${err.message}`);
    }
  };

  const handleSaveZoomConfig = async () => {
    try {
      setStatus('Saving Zoom podcast settings...');
      await saveZoomMeetingConfig(event.id, zoomForm);
      await loadAll();
      setStatus('Zoom settings saved.');
    } catch (err) {
      setStatus(`Zoom settings save failed: ${err.message}`);
    }
  };

  const handleCreateZoomMeeting = async () => {
    try {
      setStatus('Creating Zoom meeting placeholder...');
      await createZoomMeeting(event.id, zoomForm);
      await loadAll();
      setStatus('Zoom meeting configured.');
    } catch (err) {
      setStatus(`Create Zoom meeting failed: ${err.message}`);
    }
  };

  const handleLinkZoomMeeting = async () => {
    try {
      setStatus('Linking Zoom meeting...');
      await linkZoomMeeting(event.id, zoomForm);
      await loadAll();
      setStatus('Zoom meeting linked.');
    } catch (err) {
      setStatus(`Link Zoom meeting failed: ${err.message}`);
    }
  };

  const handleSaveZoomAsset = async () => {
    const asset = {
      assetType: 'cloud_recording',
      provider: 'zoom',
      externalAssetId: zoomForm.zoomMeetingId || '',
      downloadUrl: zoomForm.zoomJoinUrl || '',
      metadata: {
        note: 'Added from booking media tab',
        zoomStatus: zoomForm.zoomStatus || 'scheduled',
      },
    };
    try {
      setStatus('Saving Zoom asset record...');
      await saveZoomAsset(event.id, asset);
      await loadAll();
      setStatus('Zoom asset saved.');
    } catch (err) {
      setStatus(`Zoom asset save failed: ${err.message}`);
    }
  };

  const handleSaveYouTubeDistribution = async () => {
    try {
      setStatus('Saving YouTube distribution details...');
      await saveYouTubeDistribution(event.id, youtubeForm);
      await loadAll();
      setStatus('YouTube distribution saved.');
    } catch (err) {
      setStatus(`YouTube distribution save failed: ${err.message}`);
    }
  };

  const handlePublishZoomToYouTube = async () => {
    try {
      setStatus('Publishing Zoom recording to YouTube...');
      const response = await publishZoomRecordingToYouTube(event.id, youtubeForm);
      await loadAll();
      if (response?.warning) {
        setStatus(`Publish queued: ${response.warning}`);
      } else {
        setStatus('Zoom recording published to YouTube.');
      }
    } catch (err) {
      setStatus(`Publish to YouTube failed: ${err.message}`);
    }
  };

  const handleSaveConcessionsPlan = async () => {
    try {
      setStatus('Saving concessions plan...');
      await saveConcessionsPlan(event.id, {
        ...concessionsForm,
        barOpenTime: toIsoOrNull(concessionsForm.barOpenTime),
        barCloseTime: toIsoOrNull(concessionsForm.barCloseTime),
      });
      await loadAll();
      setStatus('Concessions plan saved.');
    } catch (err) {
      setStatus(`Concessions plan save failed: ${err.message}`);
    }
  };

  const handleSaveConcessionsItems = async () => {
    try {
      setStatus('Saving concessions menu items...');
      for (const item of concessionsDraftItems) {
        if (!String(item.name || '').trim()) continue;
        await saveConcessionsMenuItem(event.id, {
          ...item,
          price: item.price === '' ? null : Number(item.price),
          costBasis: item.costBasis === '' ? null : Number(item.costBasis),
        });
      }
      setConcessionsDraftItems([blankConcessionsMenuItem()]);
      await loadAll();
      setStatus('Concessions menu items saved.');
    } catch (err) {
      setStatus(`Concessions menu save failed: ${err.message}`);
    }
  };

  const handleSaveMerchPlan = async () => {
    try {
      setStatus('Saving merch/vendor plan...');
      await saveMerchPlan(event.id, {
        ...merchPlanForm,
        loadInTime: toIsoOrNull(merchPlanForm.loadInTime),
        tableFeeAmount: merchPlanForm.tableFeeAmount === '' ? null : Number(merchPlanForm.tableFeeAmount),
      });
      await loadAll();
      setStatus('Merch plan saved.');
    } catch (err) {
      setStatus(`Merch plan save failed: ${err.message}`);
    }
  };

  const handleSaveMerchParticipants = async () => {
    try {
      setStatus('Saving merch participants...');
      for (const participant of merchDraftParticipants) {
        if (!String(participant.name || '').trim()) continue;
        await saveMerchParticipant(event.id, participant);
      }
      setMerchDraftParticipants([blankMerchParticipant()]);
      await loadAll();
      setStatus('Merch participants saved.');
    } catch (err) {
      setStatus(`Merch participant save failed: ${err.message}`);
    }
  };

  const handleSaveMerchSplit = async () => {
    const allocations = normalizeMerchAllocations(merchSplitForm.percentageAllocations || []);
    const total = calculateMerchAllocationTotal(allocations);
    if (!allocationsTotalIsValid(allocations)) {
      setStatus(`Revenue split must total 100%. Current total: ${total.toFixed(2)}%.`);
      return;
    }
    try {
      setStatus('Saving merch revenue split...');
      await saveMerchRevenueSplit(event.id, {
        ...merchSplitForm,
        percentageAllocations: allocations.map((row) => ({
          partyType: row.partyType,
          percentage: row.percentage,
          label: row.label || '',
          partyReferenceId: row.partyReferenceId || '',
        })),
      });
      setMerchSplitForm(blankMerchSplit());
      await loadAll();
      setStatus('Merch revenue split saved.');
    } catch (err) {
      setStatus(`Merch split save failed: ${err.message}`);
    }
  };

  const handleSaveDocumentDraft = async (index) => {
    const draft = documentDrafts[index];
    if (!String(draft.title || '').trim()) {
      setStatus('Document title is required.');
      return;
    }
    try {
      const rendered = replaceTemplateVars(draft.templateBody, autofillPayload);
      setStatus('Saving document...');
      await saveBookingDocument(event.id, {
        title: draft.title,
        docType: draft.docType,
        status: 'draft',
        draftBody: draft.templateBody,
        finalBody: rendered,
        autofillPayload,
      });
      setDocumentDrafts(prev => prev.map((row, i) => (
        i === index ? { ...row, renderedBody: rendered } : row
      )));
      setStatus('Document saved with autofill.');
      await loadAll();
    } catch (err) {
      setStatus(`Document save failed: ${err.message}`);
    }
  };

  const handlePoInventorySelect = (index, inventoryItemId) => {
    const inventoryItem = venueInventory.find((item) => item.id === inventoryItemId);
    const preferredLink = preferredSupplierLinkByInventory.get(inventoryItemId);
    setPoDraftItems(prev => prev.map((row, i) => (
      i === index
        ? {
          ...row,
          inventoryItemId,
          label: inventoryItem?.item_name || row.label,
          unit: inventoryItem?.unit || row.unit || 'ea',
          supplierId: row.supplierId || preferredLink?.venue_supplier_id || '',
          supplierSku: row.supplierSku || preferredLink?.supplier_sku || '',
          supplierItemUrl: row.supplierItemUrl || preferredLink?.supplier_item_url || '',
        }
        : row
    )));
  };

  const normalizePoItemsForSubmit = () => poDraftItems
    .map((item) => ({
      inventoryItemId: item.inventoryItemId,
      label: item.label,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      supplierId: item.supplierId || poForm.supplierId || '',
      supplierSku: item.supplierSku || '',
      supplierItemUrl: item.supplierItemUrl || '',
      notes: item.notes || '',
    }))
    .filter((item) => String(item.label || '').trim());

  const handleCreateSinglePo = async () => {
    if (!event?.id) return;
    const items = normalizePoItemsForSubmit();
    if (!items.length) {
      setStatus('Add at least one PO line item.');
      return;
    }
    try {
      setStatus('Creating purchase order...');
      await saveBookingPurchaseOrder(event.id, {
        venueSupplierId: poForm.supplierId || items[0].supplierId || null,
        currency: poForm.currency || 'USD',
        deliveryInstructions: poForm.deliveryInstructions,
        receivingHours: poForm.receivingHours,
        dockNotes: poForm.dockNotes,
        purchaserName: poForm.purchaserName,
        purchaserEmail: poForm.purchaserEmail,
        manualMode: true,
        items,
      });
      setPoDraftItems([blankPoItem()]);
      setStatus('Purchase order saved.');
      await loadAll();
    } catch (err) {
      setStatus(`Purchase order save failed: ${err.message}`);
    }
  };

  const handleSplitPoBySupplier = async () => {
    if (!event?.id) return;
    const items = normalizePoItemsForSubmit();
    if (!items.length) {
      setStatus('Add at least one PO line item.');
      return;
    }
    try {
      setStatus('Splitting purchase orders by supplier...');
      const response = await splitBookingPurchaseOrdersBySupplier(event.id, {
        venueProfileId: event.venueProfileId || undefined,
        items,
        currency: poForm.currency || 'USD',
        deliveryInstructions: poForm.deliveryInstructions,
        receivingHours: poForm.receivingHours,
        dockNotes: poForm.dockNotes,
        purchaserName: poForm.purchaserName,
        purchaserEmail: poForm.purchaserEmail,
      });
      setPoDraftItems([blankPoItem()]);
      if (response?.unassigned?.length) {
        setStatus(`Split complete with ${response.unassigned.length} unassigned items.`);
      } else {
        setStatus('Split purchase orders created.');
      }
      await loadAll();
    } catch (err) {
      setStatus(`Split failed: ${err.message}`);
    }
  };

  const handleGeneratePoEmails = async (sendNow = false) => {
    if (!event?.id) return;
    try {
      setStatus(sendNow ? 'Sending supplier emails...' : 'Generating supplier email drafts...');
      const response = await generatePurchaseOrderEmails(event.id, {
        internalPurchaserEmail: poForm.purchaserEmail || '',
        venueName: event.venue || event.venueName || '',
        venueAddress: event.venueAddress || '',
        sendNow,
      });
      setPoEmailDrafts(response?.emailDrafts || []);
      setStatus(sendNow ? `Sent ${response?.sent || 0} emails.` : 'Email drafts generated.');
    } catch (err) {
      setStatus(`Could not generate PO emails: ${err.message}`);
    }
  };

  const summaryCounts = {
    ticketingConnections: connections.length,
    ticketingRecords: ticketingRecords.length,
    captureSources: captureSources.length,
    zoomAssets: zoomAssets.length,
    checklists: checklists.length,
    staffingProfiles: staffProfiles.length,
    staffingAssignments: staffAssignments.length,
    staffingCompleteness: staffingDashboard?.coverage?.staffingCompleteness || 0,
    budgets: budgets.length,
    riders: riders.length,
    concessionsItems: concessionsMenuItems.length,
    merchParticipants: merchParticipants.length,
    merchSplits: merchRevenueSplits.length,
    documents: documents.length,
    purchaseOrders: purchaseOrders.length,
  };

  const merchSplitTotal = useMemo(() => (
    calculateMerchAllocationTotal(merchSplitForm.percentageAllocations || [])
  ), [merchSplitForm.percentageAllocations]);

  return (
    <div className="card mb-6" id="booking-operations-workspace">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg m-0">Event Operations Workspace</h3>
          <p className="text-xs text-gray-500 m-0 mt-1">Tabs for production, budget, hospitality, documents, and ticketing connectors.</p>
        </div>
        {loading ? <span className="text-xs text-gray-500">Refreshing...</span> : null}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded border text-xs ${activeTab === tab.key ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]' : 'bg-white border-gray-300 text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {status && <p className="text-xs text-gray-600 mb-3">{toJulieOpsStatus(status)}</p>}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.ticketingConnections}</strong><br />Venue Connectors</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.ticketingRecords}</strong><br />Ticketing Records</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.captureSources}</strong><br />Capture Sources</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.zoomAssets}</strong><br />Zoom Assets</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.checklists}</strong><br />Checklists</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.staffingProfiles}</strong><br />Staff Profiles</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.staffingAssignments}</strong><br />Staff Assignments</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.staffingCompleteness}%</strong><br />Staffing Complete</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.budgets}</strong><br />Budgets</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.riders}</strong><br />Riders</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.concessionsItems}</strong><br />Concessions Items</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.merchParticipants}</strong><br />Merch Participants</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.merchSplits}</strong><br />Merch Splits</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.documents}</strong><br />Documents</div>
          <div className="p-2 rounded bg-gray-50"><strong>{summaryCounts.purchaseOrders}</strong><br />Purchase Orders</div>
        </div>
      )}

      {activeTab === 'media' && (
        <div className="space-y-4">
          <FormAIAssist
            formType="media_capture"
            currentForm={mediaPlanForm}
            onApply={(fields) => setMediaPlanForm(prev => ({ ...prev, ...fields }))}
            title="Media Capture AI Assistant"
            description="Paste production notes or upload run sheets to map recording mode, platform, and rights status."
            sourceContext="booking_media_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <p className="text-xs font-semibold m-0">Media Capture Plan</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select value={mediaPlanForm.recordingType} onChange={(e) => setMediaPlanForm(prev => ({ ...prev, recordingType: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="both">Both</option>
              </select>
              <select value={mediaPlanForm.captureMode} onChange={(e) => setMediaPlanForm(prev => ({ ...prev, captureMode: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="static">Static</option>
                <option value="multi_cam">Multi-Cam</option>
                <option value="ai_directed">AI Directed</option>
              </select>
              <input type="text" value={mediaPlanForm.primaryPlatform} onChange={(e) => setMediaPlanForm(prev => ({ ...prev, primaryPlatform: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Primary platform (youtube/podcast)" />
              <input type="text" value={mediaPlanForm.rightsClearanceStatus} onChange={(e) => setMediaPlanForm(prev => ({ ...prev, rightsClearanceStatus: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Rights clearance status" />
              <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
                <input type="checkbox" checked={mediaPlanForm.streamLive} onChange={(e) => setMediaPlanForm(prev => ({ ...prev, streamLive: e.target.checked }))} />
                Stream live
              </label>
              <button type="button" className="btn-primary text-xs" onClick={handleSaveMediaPlan}>Save Plan</button>
              <textarea value={mediaPlanForm.postProductionNotes} onChange={(e) => setMediaPlanForm(prev => ({ ...prev, postProductionNotes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-3" placeholder="Post-production notes" />
            </div>
          </div>

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold m-0">Capture Sources</p>
              <button type="button" className="btn-primary text-xs" onClick={handleSaveCaptureSource}>Save Source</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <select value={captureSourceDraft.type} onChange={(e) => setCaptureSourceDraft(prev => ({ ...prev, type: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="camera">Camera</option>
                <option value="audio_input">Audio Input</option>
              </select>
              <input type="text" value={captureSourceDraft.name} onChange={(e) => setCaptureSourceDraft(prev => ({ ...prev, name: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Source name" />
              <input type="text" value={captureSourceDraft.location} onChange={(e) => setCaptureSourceDraft(prev => ({ ...prev, location: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Location" />
              <input type="text" value={captureSourceDraft.operator} onChange={(e) => setCaptureSourceDraft(prev => ({ ...prev, operator: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Operator" />
              <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
                <input type="checkbox" checked={captureSourceDraft.aiControlEnabled} onChange={(e) => setCaptureSourceDraft(prev => ({ ...prev, aiControlEnabled: e.target.checked }))} />
                AI control
              </label>
            </div>
            <div className="space-y-1">
              {captureSources.map((source) => (
                <div key={source.id} className="text-xs flex items-center justify-between gap-2 border border-gray-200 rounded px-2 py-1.5">
                  <span>{source.type} · {source.name} · {source.location || 'Location TBD'} {source.ai_control_enabled ? '· AI' : ''}</span>
                  <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeCaptureSource(source.id).then(loadAll).catch((err) => setStatus(`Could not remove source: ${err.message}`))}>Remove</button>
                </div>
              ))}
              {captureSources.length === 0 ? <p className="text-xs text-gray-500 m-0">No capture sources saved.</p> : null}
            </div>
          </div>

          <FormAIAssist
            formType="zoom_meeting"
            currentForm={zoomForm}
            onApply={(fields) => setZoomForm(prev => ({ ...prev, ...fields }))}
            title="Zoom Podcast AI Assistant"
            description="Parse meeting invites and Zoom details into booking media settings."
            sourceContext="booking_zoom_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold m-0">Zoom-First Podcast Settings</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={handleSaveZoomConfig}>Save Settings</button>
                <button type="button" className="btn-secondary text-xs" onClick={handleCreateZoomMeeting}>Create Zoom Meeting</button>
                <button type="button" className="btn-primary text-xs" onClick={handleLinkZoomMeeting}>Link Existing Zoom</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select value={zoomForm.zoomMeetingType} onChange={(e) => setZoomForm(prev => ({ ...prev, zoomMeetingType: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="meeting">Meeting</option>
                <option value="webinar">Webinar</option>
              </select>
              <input type="text" value={zoomForm.zoomMeetingId} onChange={(e) => setZoomForm(prev => ({ ...prev, zoomMeetingId: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Zoom Meeting ID" />
              <input type="url" value={zoomForm.zoomJoinUrl} onChange={(e) => setZoomForm(prev => ({ ...prev, zoomJoinUrl: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Zoom Join URL" />
              <input type="email" value={zoomForm.zoomHostEmail} onChange={(e) => setZoomForm(prev => ({ ...prev, zoomHostEmail: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Host email" />
              <input type="text" value={zoomForm.zoomPasscode} onChange={(e) => setZoomForm(prev => ({ ...prev, zoomPasscode: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Passcode" />
              <input type="text" value={zoomForm.zoomStatus} onChange={(e) => setZoomForm(prev => ({ ...prev, zoomStatus: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Status" />
              <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
                <input type="checkbox" checked={zoomForm.zoomCloudRecordingEnabled} onChange={(e) => setZoomForm(prev => ({ ...prev, zoomCloudRecordingEnabled: e.target.checked }))} />
                Cloud recording
              </label>
              <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
                <input type="checkbox" checked={zoomForm.zoomTranscriptEnabled} onChange={(e) => setZoomForm(prev => ({ ...prev, zoomTranscriptEnabled: e.target.checked }))} />
                Transcript
              </label>
              <button type="button" className="btn-secondary text-xs" onClick={handleSaveZoomAsset}>Save Recording Asset</button>
            </div>
            {zoomMeetingConfig ? (
              <p className="text-xs text-gray-600 m-0">Current: {zoomMeetingConfig.zoom_status || 'not_scheduled'} {zoomMeetingConfig.zoom_join_url ? `· ${zoomMeetingConfig.zoom_join_url}` : ''}</p>
            ) : null}
            {zoomAssets.length > 0 ? (
              <div className="space-y-1">
                {zoomAssets.map((asset) => (
                  <p key={asset.id} className="text-xs m-0 text-gray-600">• {asset.asset_type} {asset.download_url ? <a href={asset.download_url} target="_blank" rel="noopener noreferrer" className="text-[#c8a45e]">Open</a> : ''}</p>
                ))}
              </div>
            ) : null}
          </div>

          <FormAIAssist
            formType="youtube_distribution"
            currentForm={youtubeForm}
            onApply={(fields) => setYoutubeForm(prev => ({ ...prev, ...fields }))}
            title="YouTube Distribution AI Assistant"
            description="Map recording metadata and publishing status from notes."
            sourceContext="booking_youtube_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <p className="text-xs font-semibold m-0">Zoom → YouTube Distribution</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input type="url" value={youtubeForm.youtubeVideoUrl} onChange={(e) => setYoutubeForm(prev => ({ ...prev, youtubeVideoUrl: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="YouTube video URL" />
              <input type="text" value={youtubeForm.youtubeVideoId} onChange={(e) => setYoutubeForm(prev => ({ ...prev, youtubeVideoId: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="YouTube video ID" />
              <input type="text" value={youtubeForm.publishStatus} onChange={(e) => setYoutubeForm(prev => ({ ...prev, publishStatus: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Publish status" />
              <textarea value={youtubeForm.publishNotes} onChange={(e) => setYoutubeForm(prev => ({ ...prev, publishNotes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2" placeholder="Publish notes" />
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={handleSaveYouTubeDistribution}>Save</button>
                <button type="button" className="btn-primary text-xs" onClick={handlePublishZoomToYouTube}>Publish to YouTube</button>
              </div>
            </div>
            {youtubeDistribution ? (
              <p className="text-xs text-gray-600 m-0">Current status: {youtubeDistribution.publish_status || 'not_published'} {youtubeDistribution.youtube_video_url ? `· ${youtubeDistribution.youtube_video_url}` : ''}</p>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === 'ticketing' && (
        <div className="space-y-3">
          <FormAIAssist
            formType="ticketing"
            currentForm={ticketingForm}
            onApply={(fields) => setTicketingForm(prev => ({ ...prev, ...fields }))}
            title="Ticketing AI Assistant"
            description="Paste a ticketing email or upload a screenshot/PDF to map provider links and IDs."
            sourceContext="booking_ticketing_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={ticketingForm.providerId}
              onChange={(e) => {
                const provider = providers.find(row => row.id === e.target.value);
                setTicketingForm(prev => ({ ...prev, providerId: e.target.value, providerType: provider?.type || prev.providerType }));
              }}
              className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
            >
              <option value="">Choose Provider</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
            <input type="text" value={ticketingForm.externalEventId} onChange={(e) => setTicketingForm(prev => ({ ...prev, externalEventId: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="External Event ID" />
            <input type="url" value={ticketingForm.externalEventUrl} onChange={(e) => setTicketingForm(prev => ({ ...prev, externalEventUrl: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="External Event URL" />
            <input type="url" value={ticketingForm.ticketSalesUrl} onChange={(e) => setTicketingForm(prev => ({ ...prev, ticketSalesUrl: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-2" placeholder="Ticket sales URL" />
            <label className="text-xs flex items-center gap-2 px-3 py-2 border border-gray-200 rounded">
              <input type="checkbox" checked={ticketingForm.manualMode} onChange={(e) => setTicketingForm(prev => ({ ...prev, manualMode: e.target.checked }))} />
              Manual Mode
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={handleCreateTicketingEvent}>Create Ticketing Event</button>
            <button type="button" className="btn-primary text-sm" onClick={handleLinkTicketingEvent}>Link Existing Ticketing Event</button>
          </div>
          {ticketingRecords.length === 0 ? (
            <p className="text-xs text-gray-500 m-0">No ticketing records linked yet. Link one and I will track it here.</p>
          ) : (
            <div className="space-y-2">
              {ticketingRecords.map(record => (
                <div key={record.id} className="border border-gray-200 rounded p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 font-semibold">{record.ticketing_provider?.name || 'Provider'}</p>
                    <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSyncTicketingRecord(record.id)}>
                      Sync Snapshot
                    </button>
                  </div>
                  <p className="m-0 text-gray-500 mt-1">
                    {record.external_event_url ? <a href={record.external_event_url} target="_blank" rel="noopener noreferrer" className="text-[#c8a45e]">Event URL</a> : 'No URL'}
                    {record.external_event_id ? ` · ID: ${record.external_event_id}` : ''}
                    {record.tickets_sold !== null && record.tickets_sold !== undefined ? ` · Sold: ${record.tickets_sold}` : ''}
                    {record.gross_sales !== null && record.gross_sales !== undefined ? ` · Gross: $${Number(record.gross_sales).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                    {record.last_synced_at ? ` · Last Sync: ${new Date(record.last_synced_at).toLocaleString()}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'production' && (
        <div className="space-y-3">
          <FormAIAssist
            formType="production_checklist"
            currentForm={checklistForm}
            onApply={(fields) => setChecklistForm(prev => ({ ...prev, ...fields }))}
            title="Production Checklist AI Assistant"
            description="Paste run sheets or production emails to prefill checklist title and phase."
            sourceContext="booking_production_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input type="text" value={checklistForm.title} onChange={(e) => setChecklistForm(prev => ({ ...prev, title: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Checklist title" />
            <input type="text" value={checklistForm.phase} onChange={(e) => setChecklistForm(prev => ({ ...prev, phase: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Phase (load-in, soundcheck, strike)" />
            <button type="button" className="btn-primary text-sm" onClick={handleSaveChecklist}>Save Checklist</button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 m-0">Checklist items track who provides what: house, tour, or promoter.</p>
            <button type="button" className="btn-secondary text-xs" onClick={() => setChecklistDraftItems(prev => [...prev, blankChecklistItem()])}>+ Add Another Item</button>
          </div>
          <div className="space-y-2">
            {checklistDraftItems.map((item, index) => (
              <div key={`draft-check-item-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-2 border border-gray-200 rounded p-2">
                <input type="text" value={item.label} onChange={(e) => setChecklistDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, label: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Checklist item" />
                <input type="text" value={item.category} onChange={(e) => setChecklistDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, category: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Category" />
                <select value={item.providerScope} onChange={(e) => setChecklistDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, providerScope: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                  <option value="house">House Provides</option>
                  <option value="tour">Tour Provides</option>
                  <option value="promoter">Promoter Provides</option>
                </select>
                <select value={item.status} onChange={(e) => setChecklistDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, status: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            ))}
          </div>
          {checklists.length === 0 ? (
            <p className="text-xs text-gray-500 m-0">No production checklists yet. Save one and I will keep it organized here.</p>
          ) : (
            <div className="space-y-2">
              {checklists.map(checklist => (
                <div key={checklist.id} className="border border-gray-200 rounded p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="m-0 font-semibold">{checklist.title}</p>
                    <span className="text-gray-500">{checklist.phase}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(checklist.items || []).map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <span>{item.label} <span className="text-gray-400">({item.provider_scope || 'house'})</span></span>
                        <div className="flex items-center gap-2">
                          <span className="capitalize text-gray-500">{item.status || 'todo'}</span>
                          <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeProductionChecklistItem(item.id)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'staffing' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="p-2 rounded bg-gray-50"><strong>{staffingDashboard?.coverage?.rolesRequired || 0}</strong><br />Roles Needed</div>
            <div className="p-2 rounded bg-gray-50"><strong>{staffingDashboard?.coverage?.rolesFilled || 0}</strong><br />Roles Filled</div>
            <div className="p-2 rounded bg-gray-50"><strong>{staffingDashboard?.coverage?.rolesUnfilled || 0}</strong><br />Roles Unfilled</div>
            <div className="p-2 rounded bg-gray-50"><strong>{staffingDashboard?.coverage?.confirmationRate || 0}%</strong><br />Confirmation Rate</div>
            <div className="p-2 rounded bg-gray-50"><strong>${Number(staffingDashboard?.coverage?.estimatedPayroll || 0).toFixed(2)}</strong><br />Estimated Payroll</div>
          </div>

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold m-0">Role Requirements</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={() => setRoleRequirements(prev => [...prev, blankRoleRequirement()])}>+ Add Role</button>
                <button type="button" className="btn-secondary text-xs" onClick={handleRefreshStaffingDashboard}>Refresh Coverage</button>
              </div>
            </div>
            {roleRequirements.map((row, index) => (
              <div key={`role-req-${index}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={row.role}
                  onChange={(e) => setRoleRequirements(prev => prev.map((entry, i) => (i === index ? { ...entry, role: e.target.value } : entry)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                  placeholder="Role name"
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={row.requiredCount}
                  onChange={(e) => setRoleRequirements(prev => prev.map((entry, i) => (i === index ? { ...entry, requiredCount: Number(e.target.value) || 1 } : entry)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                  placeholder="Required count"
                />
                <button
                  type="button"
                  className="text-xs px-2 py-1.5 border border-red-300 text-red-700 rounded bg-white"
                  onClick={() => setRoleRequirements(prev => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold m-0">Job Titles Library</p>
              <button type="button" className="btn-secondary text-xs" onClick={async () => {
                try {
                  setStatus('Seeding default staffing roles...');
                  await seedJobTitleLibrary();
                  await loadAll();
                  setStatus('Default staffing roles loaded.');
                } catch (err) {
                  setStatus(`Could not seed default roles: ${err.message}`);
                }
              }}>Load 55 Defaults</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                value={jobTitleDraft.name}
                onChange={(e) => setJobTitleDraft(prev => ({ ...prev, name: e.target.value }))}
                className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2"
                placeholder="New job title"
              />
              <input
                type="text"
                value={jobTitleDraft.department}
                onChange={(e) => setJobTitleDraft(prev => ({ ...prev, department: e.target.value }))}
                className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                placeholder="Department"
              />
              <button type="button" className="btn-primary text-xs" onClick={handleSaveJobTitle}>Save Title</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {jobTitles.map((title) => (
                <span key={title.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-gray-50 border border-gray-200">
                  {title.name}
                  {!title.is_system ? (
                    <button
                      type="button"
                      className="text-red-700"
                      onClick={async () => {
                        try {
                          await removeJobTitle(title.id);
                          await loadAll();
                        } catch (err) {
                          setStatus(`Could not remove title: ${err.message}`);
                        }
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <FormAIAssist
            formType="staff_profile"
            currentForm={staffProfileForm}
            onApply={applyStaffProfilePatch}
            title="Staffing AI Assistant"
            description="Speak or upload one-sheet contact docs and AI will populate staff profile fields."
          />

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <p className="text-xs font-semibold m-0">Voice Transcript Quick Parse</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <textarea
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                rows={2}
                className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-3"
                placeholder="Example: John Smith, bartender, $18 per hour, 210-555-1234, john@email.com"
              />
              <button type="button" className="btn-secondary text-xs" onClick={handleParseVoiceStaff}>Parse Transcript</button>
            </div>
          </div>

          <FormAIAssist
            formType="staff_assignment"
            currentForm={staffAssignmentForm}
            onApply={(fields) => setStaffAssignmentForm(prev => ({ ...prev, ...fields }))}
            title="Staff Assignment AI Assistant"
            description="Paste schedules or staffing request text to prefill assignment timing and role fields."
            sourceContext="booking_staffing_assignment"
            entityType="booking"
            entityId={event?.id || ''}
          />

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <p className="text-xs font-semibold m-0">Add / Update Staff Profile</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input type="text" value={staffProfileForm.firstName} onChange={(e) => setStaffProfileForm(prev => ({ ...prev, firstName: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="First name" />
              <input type="text" value={staffProfileForm.lastName} onChange={(e) => setStaffProfileForm(prev => ({ ...prev, lastName: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Last name" />
              <input type="text" value={staffProfileForm.displayName} onChange={(e) => setStaffProfileForm(prev => ({ ...prev, displayName: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Display name" />
              <input type="tel" value={staffProfileForm.phoneNumber} onChange={(e) => setStaffProfileForm(prev => ({ ...prev, phoneNumber: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Phone number (required)" />
              <input type="email" value={staffProfileForm.email} onChange={(e) => setStaffProfileForm(prev => ({ ...prev, email: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Email" />
              <input type="text" value={staffProfileForm.primaryRole} onChange={(e) => setStaffProfileForm(prev => ({ ...prev, primaryRole: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Primary role" />
              <select value={staffProfileForm.payType} onChange={(e) => setStaffProfileForm(prev => ({ ...prev, payType: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="hourly">Hourly</option>
                <option value="flat">Flat</option>
                <option value="salary">Salary</option>
                <option value="volunteer">Volunteer</option>
              </select>
              <input type="number" min="0" step="0.01" value={staffProfileForm.defaultRate} onChange={(e) => setStaffProfileForm(prev => ({ ...prev, defaultRate: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Default rate" />
              <textarea value={staffProfileForm.notes} onChange={(e) => setStaffProfileForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-4" placeholder="Notes" />
            </div>
            <div className="border border-gray-100 rounded p-2 bg-gray-50">
              <p className="text-[11px] text-gray-500 m-0 mb-1">Job Titles (select all that apply)</p>
              <div className="flex flex-wrap gap-2">
                {jobTitles.map((title) => (
                  <label key={`staff-form-title-${title.id}`} className="text-[11px] inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={(staffProfileForm.jobTitles || []).includes(title.name)}
                      onChange={() => toggleJobTitleSelection(title.name)}
                    />
                    {title.name}
                  </label>
                ))}
              </div>
            </div>
            <button type="button" className="btn-primary text-xs" onClick={handleSaveStaffProfile}>Save Staff Profile</button>
          </div>

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold m-0">Staff Profiles</p>
              <p className="text-[11px] text-gray-500 m-0">Select profiles for bulk assignment.</p>
            </div>
            {staffProfiles.length === 0 ? (
              <p className="text-xs text-gray-500 m-0">No staff profiles yet.</p>
            ) : (
              <div className="space-y-1">
                {staffProfiles.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between gap-2 border border-gray-200 rounded p-2 text-xs">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedStaffIds.includes(profile.id)}
                        onChange={() => toggleStaffProfileSelection(profile.id)}
                      />
                      <span>
                        {profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                        <span className="text-gray-500"> · {profile.primary_role || 'Role TBD'}</span>
                        <span className="text-gray-500"> · {profile.phone_number || 'No phone'}</span>
                      </span>
                    </label>
                    <button
                      type="button"
                      className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white"
                      onClick={async () => {
                        try {
                          await removeStaffProfile(profile.id);
                          await loadAll();
                        } catch (err) {
                          setStatus(`Could not remove profile: ${err.message}`);
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <p className="text-xs font-semibold m-0">Assign Staff to Event</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select value={staffAssignmentForm.staffProfileId} onChange={(e) => {
                const profile = staffProfiles.find(row => row.id === e.target.value);
                setStaffAssignmentForm(prev => ({
                  ...prev,
                  staffProfileId: e.target.value,
                  jobTitle: prev.jobTitle || profile?.primary_role || '',
                  payType: prev.payType || profile?.pay_type || 'hourly',
                }));
              }} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">Select staff</option>
                {staffProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
              <select value={staffAssignmentForm.jobTitleId} onChange={(e) => {
                const title = jobTitles.find(row => row.id === e.target.value);
                setStaffAssignmentForm(prev => ({ ...prev, jobTitleId: e.target.value, jobTitle: title?.name || prev.jobTitle }));
              }} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">Job title (optional)</option>
                {jobTitles.map((title) => (
                  <option key={title.id} value={title.id}>{title.name}</option>
                ))}
              </select>
              <input type="text" value={staffAssignmentForm.jobTitle} onChange={(e) => setStaffAssignmentForm(prev => ({ ...prev, jobTitle: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Role label" />
              <select value={staffAssignmentForm.status} onChange={(e) => setStaffAssignmentForm(prev => ({ ...prev, status: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="declined">Declined</option>
                <option value="no_show">No Show</option>
              </select>
              <input type="datetime-local" value={staffAssignmentForm.startTime} onChange={(e) => setStaffAssignmentForm(prev => ({ ...prev, startTime: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
              <input type="datetime-local" value={staffAssignmentForm.endTime} onChange={(e) => setStaffAssignmentForm(prev => ({ ...prev, endTime: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
              <select value={staffAssignmentForm.payType} onChange={(e) => setStaffAssignmentForm(prev => ({ ...prev, payType: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="hourly">Hourly</option>
                <option value="flat">Flat</option>
                <option value="salary">Salary</option>
                <option value="volunteer">Volunteer</option>
              </select>
              <input type="number" min="0" step="0.01" value={staffAssignmentForm.payOverride} onChange={(e) => setStaffAssignmentForm(prev => ({ ...prev, payOverride: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Pay override" />
              <textarea value={staffAssignmentForm.notes} onChange={(e) => setStaffAssignmentForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-4" placeholder="Assignment notes" />
            </div>
            <button type="button" className="btn-primary text-xs" onClick={handleSaveStaffAssignment}>Save Assignment</button>
          </div>

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <p className="text-xs font-semibold m-0">Bulk Assign Shift</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input type="datetime-local" value={bulkShift.startTime} onChange={(e) => setBulkShift(prev => ({ ...prev, startTime: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
              <input type="datetime-local" value={bulkShift.endTime} onChange={(e) => setBulkShift(prev => ({ ...prev, endTime: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
              <input type="text" value={bulkShift.jobTitle} onChange={(e) => setBulkShift(prev => ({ ...prev, jobTitle: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Role label" />
              <select value={bulkShift.status} onChange={(e) => setBulkShift(prev => ({ ...prev, status: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="declined">Declined</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
            <button type="button" className="btn-secondary text-xs" onClick={handleBulkAssign}>Assign Shift to Selected Staff</button>
          </div>

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <p className="text-xs font-semibold m-0">Venue Call-In Policy</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input type="number" min="0" step="1" value={staffingPolicy.noticeHours} onChange={(e) => setStaffingPolicy(prev => ({ ...prev, noticeHours: Number(e.target.value) || 0 }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Notice hours" />
              <input type="text" value={staffingPolicy.supervisorName} onChange={(e) => setStaffingPolicy(prev => ({ ...prev, supervisorName: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Supervisor name" />
              <input type="tel" value={staffingPolicy.supervisorPhone} onChange={(e) => setStaffingPolicy(prev => ({ ...prev, supervisorPhone: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Supervisor phone" />
              <input type="email" value={staffingPolicy.supervisorEmail} onChange={(e) => setStaffingPolicy(prev => ({ ...prev, supervisorEmail: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Supervisor email" />
              <textarea value={staffingPolicy.callInPolicy} onChange={(e) => setStaffingPolicy(prev => ({ ...prev, callInPolicy: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-4" placeholder="Call-in policy shown during publish." />
            </div>
            <button type="button" className="btn-secondary text-xs" onClick={handleSaveStaffingPolicy}>Save Call-In Policy</button>
          </div>

          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={handlePublishStaffing}>Publish Staffing Schedule</button>
              <button type="button" className="btn-secondary text-sm" onClick={() => handleExportStaffSheet('full')}>Export Full Roster</button>
              <button type="button" className="btn-secondary text-sm" onClick={() => handleExportStaffSheet('contacts')}>Export Contact Sheet</button>
              <button type="button" className="btn-secondary text-sm" onClick={() => handleExportStaffSheet('coverage')}>Export Role Coverage</button>
              <button type="button" className="btn-secondary text-sm" onClick={() => handleExportStaffSheet('time_block')}>Export Time Blocks</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                value={staffingFilters.role}
                onChange={(e) => setStaffingFilters(prev => ({ ...prev, role: e.target.value }))}
                className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                placeholder="Filter by role"
              />
              <select
                value={staffingFilters.staffProfileId}
                onChange={(e) => setStaffingFilters(prev => ({ ...prev, staffProfileId: e.target.value }))}
                className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
              >
                <option value="">Filter by staff member</option>
                {staffProfiles.map((profile) => (
                  <option key={`filter-staff-${profile.id}`} value={profile.id}>
                    {profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={staffingWeekStart}
                onChange={(e) => setStaffingWeekStart(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                title="Week start date"
              />
              <p className="text-[11px] text-gray-500 m-0 self-center">
                Venue filter: current booking venue ({event?.venue || event?.venueName || 'Venue'}).
              </p>
            </div>

            {staffAssignments.length === 0 ? (
              <p className="text-xs text-gray-500 m-0">No assignments yet.</p>
            ) : weeklyStaffAssignments.length === 0 ? (
              <p className="text-xs text-gray-500 m-0">No assignments match current filters.</p>
            ) : (
              <div className="space-y-1">
                {weeklyStaffAssignments.map((assignment) => {
                  const staff = assignment.staff_profile || {};
                  return (
                    <div key={assignment.id} className="border border-gray-200 rounded p-2 text-xs flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {staff.display_name || [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Crew'} · {assignment.job_title || 'Role TBD'} · {assignment.start_time ? new Date(assignment.start_time).toLocaleString() : 'TBD'}
                        {assignment.end_time ? ` → ${new Date(assignment.end_time).toLocaleString()}` : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={assignment.status || 'scheduled'}
                          onChange={async (e) => {
                            try {
                              await saveStaffAssignment(event.id, {
                                id: assignment.id,
                                staffProfileId: assignment.staff_profile_id,
                                jobTitle: assignment.job_title,
                                jobTitleId: assignment.job_title_id,
                                startTime: assignment.start_time,
                                endTime: assignment.end_time,
                                payType: assignment.pay_type,
                                payOverride: assignment.pay_override,
                                status: e.target.value,
                                notes: assignment.notes || '',
                                notificationLog: assignment.notification_log || [],
                                policyAcknowledged: assignment.policy_acknowledged,
                                publishedAt: assignment.published_at,
                                confirmedAt: assignment.confirmed_at,
                                declinedAt: assignment.declined_at,
                              });
                              await loadAll();
                            } catch (err) {
                              setStatus(`Could not update assignment status: ${err.message}`);
                            }
                          }}
                          className="px-2 py-1 border border-gray-200 rounded text-xs bg-white"
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="declined">Declined</option>
                          <option value="no_show">No Show</option>
                        </select>
                        <button
                          type="button"
                          className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white"
                          onClick={async () => {
                            try {
                              await removeStaffAssignment(assignment.id);
                              await loadAll();
                            } catch (err) {
                              setStatus(`Could not remove assignment: ${err.message}`);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'messaging' && (
        <EventMessagingPanel event={event} staffProfiles={staffProfiles} />
      )}

      {activeTab === 'budget' && (
        <div className="space-y-3">
          <FormAIAssist
            formType="budget"
            currentForm={budgetForm}
            onApply={(fields) => setBudgetForm(prev => ({ ...prev, ...fields }))}
            title="Budget AI Assistant"
            description="Paste budget notes or deal terms to prefill budget header details."
            sourceContext="booking_budget_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input type="text" value={budgetForm.title} onChange={(e) => setBudgetForm(prev => ({ ...prev, title: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Budget title" />
            <input type="text" value={budgetForm.currency} onChange={(e) => setBudgetForm(prev => ({ ...prev, currency: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Currency" />
            <input type="number" min="0" step="0.01" value={budgetForm.totalBudget} onChange={(e) => setBudgetForm(prev => ({ ...prev, totalBudget: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Total budget" />
            <button type="button" className="btn-primary text-sm" onClick={handleSaveBudget}>Save Budget</button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 m-0">Line items support estimated vs actual costs.</p>
            <button type="button" className="btn-secondary text-xs" onClick={() => setBudgetDraftLines(prev => [...prev, blankBudgetLine()])}>+ Add Another Line</button>
          </div>
          {budgetDraftLines.map((line, index) => (
            <div key={`draft-budget-line-${index}`} className="grid grid-cols-1 md:grid-cols-5 gap-2 border border-gray-200 rounded p-2">
              <input type="text" value={line.lineItemName} onChange={(e) => setBudgetDraftLines(prev => prev.map((row, i) => (i === index ? { ...row, lineItemName: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Line item" />
              <input type="text" value={line.category} onChange={(e) => setBudgetDraftLines(prev => prev.map((row, i) => (i === index ? { ...row, category: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Category" />
              <input type="text" value={line.vendorName} onChange={(e) => setBudgetDraftLines(prev => prev.map((row, i) => (i === index ? { ...row, vendorName: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Vendor" />
              <select value={line.costType} onChange={(e) => setBudgetDraftLines(prev => prev.map((row, i) => (i === index ? { ...row, costType: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="estimated">Estimated</option>
                <option value="actual">Actual</option>
              </select>
              <input type="number" min="0" step="0.01" value={line.amount} onChange={(e) => setBudgetDraftLines(prev => prev.map((row, i) => (i === index ? { ...row, amount: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Amount" />
            </div>
          ))}
          <div className="space-y-1">
            {budgets.map(budget => (
              <p key={budget.id} className="text-xs m-0 text-gray-600">
                • {budget.title} · {budget.currency || 'USD'} · {budget.total_budget ? Number(budget.total_budget).toLocaleString() : 'No total'}
                {Array.isArray(budget.lines) ? ` · ${budget.lines.length} lines` : ''}
              </p>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'hospitality' && (
        <div className="space-y-3">
          <FormAIAssist
            formType="rider"
            currentForm={riderForm}
            onApply={(fields) => setRiderForm(prev => ({ ...prev, ...fields }))}
            title="Hospitality Rider AI Assistant"
            description="Paste rider emails or notes to prefill rider summary fields."
            sourceContext="booking_hospitality_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input type="text" value={riderForm.title} onChange={(e) => setRiderForm(prev => ({ ...prev, title: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Rider title" />
            <input type="text" value={riderForm.riderType} onChange={(e) => setRiderForm(prev => ({ ...prev, riderType: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Type (hospitality, technical)" />
            <button type="button" className="btn-primary text-sm" onClick={handleSaveRider}>Save Rider</button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 m-0">Green room requests, quantities, and provider ownership.</p>
            <button type="button" className="btn-secondary text-xs" onClick={() => setRiderDraftItems(prev => [...prev, blankRiderItem()])}>+ Add Another Item</button>
          </div>
          {riderDraftItems.map((item, index) => (
            <div key={`draft-rider-item-${index}`} className="grid grid-cols-1 md:grid-cols-5 gap-2 border border-gray-200 rounded p-2">
              <input type="text" value={item.label} onChange={(e) => setRiderDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, label: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Request item" />
              <input type="text" value={item.section} onChange={(e) => setRiderDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, section: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Section" />
              <input type="number" min="0" step="1" value={item.quantity} onChange={(e) => setRiderDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, quantity: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Qty" />
              <select value={item.providedBy} onChange={(e) => setRiderDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, providedBy: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="venue">Venue Provides</option>
                <option value="tour">Tour Provides</option>
                <option value="promoter">Promoter Provides</option>
              </select>
              <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
                <input type="checkbox" checked={item.required} onChange={(e) => setRiderDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, required: e.target.checked } : row)))} />
                Required
              </label>
            </div>
          ))}
          <div className="space-y-1">
            {riders.map(rider => (
              <p key={rider.id} className="text-xs m-0 text-gray-600">
                • {rider.title} · {rider.rider_type || 'hospitality'} · {Array.isArray(rider.items) ? rider.items.length : 0} items
              </p>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'concessions' && (
        <div className="space-y-3">
          <FormAIAssist
            formType="concessions_plan"
            currentForm={concessionsForm}
            onApply={(fields) => setConcessionsForm(prev => ({ ...prev, ...fields }))}
            title="Concessions AI Assistant"
            description="Paste lobby/bar planning notes to prefill service windows and operations settings."
            sourceContext="booking_concessions_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
              <input type="checkbox" checked={concessionsForm.isActive} onChange={(e) => setConcessionsForm(prev => ({ ...prev, isActive: e.target.checked }))} />
              Active
            </label>
            <input type="text" value={concessionsForm.managerContactId} onChange={(e) => setConcessionsForm(prev => ({ ...prev, managerContactId: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Manager contact ID (optional)" />
            <input type="datetime-local" value={concessionsForm.barOpenTime} onChange={(e) => setConcessionsForm(prev => ({ ...prev, barOpenTime: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
            <input type="datetime-local" value={concessionsForm.barCloseTime} onChange={(e) => setConcessionsForm(prev => ({ ...prev, barCloseTime: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
            <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
              <input type="checkbox" checked={concessionsForm.intermissionService} onChange={(e) => setConcessionsForm(prev => ({ ...prev, intermissionService: e.target.checked }))} />
              Intermission service
            </label>
            <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
              <input type="checkbox" checked={concessionsForm.cashlessOnly} onChange={(e) => setConcessionsForm(prev => ({ ...prev, cashlessOnly: e.target.checked }))} />
              Cashless only
            </label>
            <button type="button" className="btn-primary text-xs md:col-span-2" onClick={handleSaveConcessionsPlan}>Save Concessions Plan</button>
            <textarea value={concessionsForm.notes} onChange={(e) => setConcessionsForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-4" placeholder="Concessions notes" />
          </div>

          <FormAIAssist
            formType="concessions_menu_item"
            currentForm={concessionsDraftItems[0] || {}}
            onApply={(fields) => setConcessionsDraftItems(prev => (
              prev.length ? prev.map((row, idx) => (idx === 0 ? { ...row, ...fields } : row)) : [{ ...blankConcessionsMenuItem(), ...fields }]
            ))}
            title="Concessions Menu AI Assistant"
            description="Extract menu item names/pricing from snapshots or PDFs."
            sourceContext="booking_concessions_menu_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 m-0">Menu builder supports pricing, cost basis, inventory links, and alcohol flag.</p>
            <button type="button" className="btn-secondary text-xs" onClick={() => setConcessionsDraftItems(prev => [...prev, blankConcessionsMenuItem()])}>+ Add Another Item</button>
          </div>
          {concessionsDraftItems.map((item, index) => (
            <div key={`concessions-item-${index}`} className="grid grid-cols-1 md:grid-cols-7 gap-2 border border-gray-200 rounded p-2">
              <input type="text" value={item.name} onChange={(e) => setConcessionsDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2" placeholder="Menu item name" />
              <input type="text" value={item.category} onChange={(e) => setConcessionsDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, category: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Category" />
              <input type="number" min="0" step="0.01" value={item.price} onChange={(e) => setConcessionsDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, price: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Price" />
              <input type="number" min="0" step="0.01" value={item.costBasis} onChange={(e) => setConcessionsDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, costBasis: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Cost basis" />
              <input type="text" value={item.availabilityStatus} onChange={(e) => setConcessionsDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, availabilityStatus: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Availability" />
              <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
                <input type="checkbox" checked={item.alcoholFlag} onChange={(e) => setConcessionsDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, alcoholFlag: e.target.checked } : row)))} />
                Alcohol
              </label>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" onClick={handleSaveConcessionsItems}>Save Menu Items</button>
          </div>
          <div className="space-y-1">
            {concessionsMenuItems.map((item) => (
              <div key={item.id} className="text-xs flex items-center justify-between gap-2 border border-gray-200 rounded p-2">
                <span>{item.name} · {item.category} · ${Number(item.price || 0).toFixed(2)} · {item.availability_status || 'available'}</span>
                <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeConcessionsMenuItem(item.id).then(loadAll).catch((err) => setStatus(`Could not remove menu item: ${err.message}`))}>Remove</button>
              </div>
            ))}
            {concessionsMenuItems.length === 0 ? <p className="text-xs text-gray-500 m-0">No concessions menu items saved.</p> : null}
          </div>
        </div>
      )}

      {activeTab === 'merch' && (
        <div className="space-y-3">
          <FormAIAssist
            formType="merch_plan"
            currentForm={merchPlanForm}
            onApply={(fields) => setMerchPlanForm(prev => ({ ...prev, ...fields }))}
            title="Merch/Vendor AI Assistant"
            description="Parse vendor coordination notes into merch plan settings."
            sourceContext="booking_merch_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input type="text" value={merchPlanForm.merchManagerContactId} onChange={(e) => setMerchPlanForm(prev => ({ ...prev, merchManagerContactId: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Merch manager contact ID" />
            <input type="number" min="0" step="0.01" value={merchPlanForm.tableFeeAmount} onChange={(e) => setMerchPlanForm(prev => ({ ...prev, tableFeeAmount: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Table fee amount" />
            <input type="text" value={merchPlanForm.merchAreaLocation} onChange={(e) => setMerchPlanForm(prev => ({ ...prev, merchAreaLocation: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Merch area location" />
            <input type="datetime-local" value={merchPlanForm.loadInTime} onChange={(e) => setMerchPlanForm(prev => ({ ...prev, loadInTime: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
            <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
              <input type="checkbox" checked={merchPlanForm.tableFee} onChange={(e) => setMerchPlanForm(prev => ({ ...prev, tableFee: e.target.checked }))} />
              Table fee enabled
            </label>
            <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
              <input type="checkbox" checked={merchPlanForm.marketplaceMode} onChange={(e) => setMerchPlanForm(prev => ({ ...prev, marketplaceMode: e.target.checked }))} />
              Marketplace mode
            </label>
            <button type="button" className="btn-primary text-xs md:col-span-2" onClick={handleSaveMerchPlan}>Save Merch Plan</button>
            <textarea value={merchPlanForm.notes} onChange={(e) => setMerchPlanForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-4" placeholder="Merch notes" />
          </div>

          <FormAIAssist
            formType="merch_participant"
            currentForm={merchDraftParticipants[0] || {}}
            onApply={(fields) => setMerchDraftParticipants(prev => (
              prev.length ? prev.map((row, idx) => (idx === 0 ? { ...row, ...fields } : row)) : [{ ...blankMerchParticipant(), ...fields }]
            ))}
            title="Merch Participant AI Assistant"
            description="Paste vendor submissions to prefill participant contacts and emergency fields."
            sourceContext="booking_merch_participants_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 m-0">Marketplace mode supports unlimited vendors and table assignments.</p>
            <button type="button" className="btn-secondary text-xs" onClick={() => setMerchDraftParticipants(prev => [...prev, blankMerchParticipant()])}>+ Add Another Vendor</button>
          </div>
          {merchDraftParticipants.map((participant, index) => (
            <div key={`merch-participant-${index}`} className="grid grid-cols-1 md:grid-cols-6 gap-2 border border-gray-200 rounded p-2">
              <input type="text" value={participant.name} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Participant name" />
              <input type="text" value={participant.organizationName} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, organizationName: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Organization" />
              <input type="text" value={participant.tableAssignmentLabel} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, tableAssignmentLabel: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Table assignment" />
              <input type="text" value={participant.emergencyContactName} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, emergencyContactName: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Emergency contact name" />
              <input type="text" value={participant.emergencyContactPhone} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, emergencyContactPhone: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Emergency phone" />
              <input type="email" value={participant.emergencyContactEmail} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, emergencyContactEmail: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Emergency email" />
              <input type="text" value={participant.staffRunningTable} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, staffRunningTable: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2" placeholder="Staff running table" />
              <input type="text" value={participant.supervisorName} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, supervisorName: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2" placeholder="Supervisor" />
              <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
                <input type="checkbox" checked={participant.merchTableRequired} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, merchTableRequired: e.target.checked } : row)))} />
                Table required
              </label>
              <textarea value={participant.notes} onChange={(e) => setMerchDraftParticipants(prev => prev.map((row, i) => (i === index ? { ...row, notes: e.target.value } : row)))} rows={2} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-6" placeholder="Participant notes" />
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" onClick={handleSaveMerchParticipants}>Save Merch Participants</button>
          </div>
          <div className="space-y-1">
            {merchParticipants.map((participant) => (
              <div key={participant.id} className="text-xs flex items-center justify-between gap-2 border border-gray-200 rounded p-2">
                <span>{participant.name} · {participant.organization_name || 'Org TBD'} · {participant.table_assignment_label || 'Table TBD'}</span>
                <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeMerchParticipant(participant.id).then(loadAll).catch((err) => setStatus(`Could not remove merch participant: ${err.message}`))}>Remove</button>
              </div>
            ))}
          </div>

          <FormAIAssist
            formType="merch_revenue_split"
            currentForm={merchSplitForm}
            onApply={(fields) => setMerchSplitForm(prev => ({ ...prev, ...fields }))}
            title="Revenue Split AI Assistant"
            description="Parse deal terms and propose gross/net split allocations."
            sourceContext="booking_merch_split_tab"
            entityType="booking"
            entityId={event?.id || ''}
          />
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <p className="text-xs font-semibold m-0">Revenue Split Modeling</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input type="text" value={merchSplitForm.appliesTo} onChange={(e) => setMerchSplitForm(prev => ({ ...prev, appliesTo: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Applies to (all_merch/specific_participant)" />
              <select value={merchSplitForm.participantId} onChange={(e) => setMerchSplitForm(prev => ({ ...prev, participantId: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">All participants</option>
                {merchParticipants.map((participant) => (
                  <option key={`split-participant-${participant.id}`} value={participant.id}>{participant.name}</option>
                ))}
              </select>
              <select value={merchSplitForm.splitType} onChange={(e) => setMerchSplitForm(prev => ({ ...prev, splitType: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="gross">Gross</option>
                <option value="net">Net</option>
              </select>
              <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded">
                <input type="checkbox" checked={merchSplitForm.tableFeeDeductedFirst} onChange={(e) => setMerchSplitForm(prev => ({ ...prev, tableFeeDeductedFirst: e.target.checked }))} />
                Deduct table fee first
              </label>
            </div>
            {(merchSplitForm.percentageAllocations || []).map((allocation, index) => (
              <div key={`split-allocation-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <select value={allocation.partyType || 'other'} onChange={(e) => setMerchSplitForm(prev => ({ ...prev, percentageAllocations: prev.percentageAllocations.map((row, i) => (i === index ? { ...row, partyType: e.target.value } : row)) }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                  {MERCH_PARTY_TYPE_OPTIONS.map((type) => (
                    <option key={`split-party-${type}`} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
                    </option>
                  ))}
                </select>
                <input type="number" min="0" step="0.01" value={allocation.percentage} onChange={(e) => setMerchSplitForm(prev => ({ ...prev, percentageAllocations: prev.percentageAllocations.map((row, i) => (i === index ? { ...row, percentage: e.target.value } : row)) }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Percentage" />
                <input type="text" value={allocation.label || ''} onChange={(e) => setMerchSplitForm(prev => ({ ...prev, percentageAllocations: prev.percentageAllocations.map((row, i) => (i === index ? { ...row, label: e.target.value } : row)) }))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Label (optional)" />
                <button type="button" className="text-[11px] px-2 py-1.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => setMerchSplitForm(prev => ({ ...prev, percentageAllocations: prev.percentageAllocations.filter((_, i) => i !== index) }))}>Remove</button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setMerchSplitForm(prev => ({ ...prev, percentageAllocations: [...(prev.percentageAllocations || []), { partyType: 'other', percentage: 0 }] }))}>+ Add Allocation</button>
              <p className={`text-xs m-0 ${Math.abs(merchSplitTotal - 100) <= 0.01 ? 'text-green-700' : 'text-red-700'}`}>Allocation total: {merchSplitTotal.toFixed(2)}%</p>
            </div>
            <textarea value={merchSplitForm.notes} onChange={(e) => setMerchSplitForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Split notes" />
            <button type="button" className="btn-primary text-sm" onClick={handleSaveMerchSplit}>Save Revenue Split</button>
          </div>
          <div className="space-y-1">
            {merchRevenueSplits.map((split) => {
              const allocations = Array.isArray(split.percentage_allocations) ? split.percentage_allocations : [];
              const summary = allocations.map((row) => `${row.party_type}:${row.percentage}%`).join(' | ');
              return <p key={split.id} className="text-xs text-gray-600 m-0">• {split.split_type || 'gross'} · {split.applies_to || 'all_merch'} · {summary}</p>;
            })}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-3">
          <FormAIAssist
            formType="booking_document"
            currentForm={documentDrafts[0] || {}}
            onApply={(fields) => setDocumentDrafts(prev => (
              prev.length
                ? prev.map((draft, index) => (index === 0 ? { ...draft, ...fields } : draft))
                : [{ ...blankDocumentDraft(event), ...fields }]
            ))}
            title="Documents AI Assistant"
            description="Paste contract text or upload documents to prefill title/type and contract body notes."
            sourceContext="booking_documents_tab"
            entityType="booking_document"
            entityId={event?.id || ''}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 m-0">Contracts and forms autofill from booking data. Use placeholders like <code>{'{{event_title}}'}</code>.</p>
            <button type="button" className="btn-secondary text-xs" onClick={() => setDocumentDrafts(prev => [...prev, blankDocumentDraft(event)])}>+ Add Another Document</button>
          </div>
          {documentDrafts.map((draft, index) => (
            <div key={`doc-draft-${index}`} className="border border-gray-200 rounded p-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input type="text" value={draft.title} onChange={(e) => setDocumentDrafts(prev => prev.map((row, i) => (i === index ? { ...row, title: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Document title" />
                <input type="text" value={draft.docType} onChange={(e) => setDocumentDrafts(prev => prev.map((row, i) => (i === index ? { ...row, docType: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Doc type" />
              </div>
              <textarea value={draft.templateBody} onChange={(e) => setDocumentDrafts(prev => prev.map((row, i) => (i === index ? { ...row, templateBody: e.target.value } : row)))} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs" rows={6} />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => setDocumentDrafts(prev => prev.map((row, i) => (
                    i === index ? { ...row, renderedBody: replaceTemplateVars(row.templateBody, autofillPayload) } : row
                  )))}
                >
                  Preview Autofill
                </button>
                <button type="button" className="btn-primary text-xs" onClick={() => handleSaveDocumentDraft(index)}>Save Document</button>
              </div>
              {draft.renderedBody ? (
                <pre className="text-[11px] bg-gray-50 border border-gray-200 rounded p-2 whitespace-pre-wrap">{draft.renderedBody}</pre>
              ) : null}
            </div>
          ))}
          <div className="space-y-1">
            {documents.map(doc => (
              <p key={doc.id} className="text-xs m-0 text-gray-600">
                • {doc.title} · {doc.doc_type || 'doc'} · {doc.status || 'draft'}{doc.signed_at ? ` · Signed ${new Date(doc.signed_at).toLocaleDateString()}` : ''}
              </p>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'purchasing' && (
        <div className="space-y-3">
          <FormAIAssist
            formType="purchase_order"
            currentForm={poForm}
            onApply={(fields) => setPoForm(prev => ({ ...prev, ...fields }))}
            title="Purchasing AI Assistant"
            description="Paste supplier emails or invoices to prefill PO supplier and delivery fields."
            sourceContext="booking_purchasing_tab"
            entityType="booking_purchase_order"
            entityId={event?.id || ''}
          />
          <p className="text-xs text-gray-500 m-0">Build vendor-ready POs, split by preferred supplier, and generate email drafts with SKU and item URLs.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select value={poForm.supplierId} onChange={(e) => setPoForm(prev => ({ ...prev, supplierId: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm bg-white">
              <option value="">Default supplier (optional)</option>
              {venueSuppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
              ))}
            </select>
            <input type="text" value={poForm.currency} onChange={(e) => setPoForm(prev => ({ ...prev, currency: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Currency" />
            <input type="email" value={poForm.purchaserEmail} onChange={(e) => setPoForm(prev => ({ ...prev, purchaserEmail: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Purchaser Email (internal copy)" />
            <input type="text" value={poForm.purchaserName} onChange={(e) => setPoForm(prev => ({ ...prev, purchaserName: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Purchaser Name" />
            <input type="text" value={poForm.receivingHours} onChange={(e) => setPoForm(prev => ({ ...prev, receivingHours: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Receiving Hours" />
            <input type="text" value={poForm.dockNotes} onChange={(e) => setPoForm(prev => ({ ...prev, dockNotes: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Dock Notes" />
            <textarea value={poForm.deliveryInstructions} onChange={(e) => setPoForm(prev => ({ ...prev, deliveryInstructions: e.target.value }))} rows={2} className="px-3 py-2 border border-gray-200 rounded text-sm md:col-span-3" placeholder="Delivery instructions" />
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 m-0">PO line items can be linked to inventory and supplier SKUs.</p>
            <button type="button" className="btn-secondary text-xs" onClick={() => setPoDraftItems(prev => [...prev, blankPoItem()])}>+ Add Another Item</button>
          </div>
          <div className="space-y-2">
            {poDraftItems.map((item, index) => (
              <div key={`po-draft-item-${index}`} className="grid grid-cols-1 md:grid-cols-8 gap-2 border border-gray-200 rounded p-2">
                <select value={item.inventoryItemId} onChange={(e) => handlePoInventorySelect(index, e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white md:col-span-2">
                  <option value="">Inventory item</option>
                  {venueInventory.map((inventoryItem) => (
                    <option key={inventoryItem.id} value={inventoryItem.id}>{inventoryItem.item_name}</option>
                  ))}
                </select>
                <input type="text" value={item.label} onChange={(e) => setPoDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, label: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2" placeholder="Item label" />
                <input type="number" min="0" step="1" value={item.quantity} onChange={(e) => setPoDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, quantity: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Qty" />
                <input type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => setPoDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, unitCost: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Unit cost" />
                <select value={item.supplierId} onChange={(e) => setPoDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, supplierId: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                  <option value="">Supplier</option>
                  {venueSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
                  ))}
                </select>
                <input type="text" value={item.supplierSku} onChange={(e) => setPoDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, supplierSku: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="SKU" />
                <input type="url" value={item.supplierItemUrl} onChange={(e) => setPoDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, supplierItemUrl: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-3" placeholder="Item URL" />
                <input type="text" value={item.notes} onChange={(e) => setPoDraftItems(prev => prev.map((row, i) => (i === index ? { ...row, notes: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-3" placeholder="Line notes" />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={handleCreateSinglePo}>Create One PO</button>
            <button type="button" className="btn-secondary text-sm" onClick={handleSplitPoBySupplier}>Split into POs by Supplier</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => handleGeneratePoEmails(false)}>Generate Email Drafts</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => handleGeneratePoEmails(true)}>Send Emails</button>
          </div>

          <div className="space-y-2">
            {purchaseOrders.length === 0 ? (
              <p className="text-xs text-gray-500 m-0">No purchase orders yet. Create one above and I will track the rest.</p>
            ) : (
              purchaseOrders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded p-3 text-xs">
                  <p className="m-0 font-semibold">
                    {order.supplier_name || order.supplier?.supplier_name || 'Unassigned Supplier'}
                    <span className="text-gray-500"> · {order.status || 'draft'}</span>
                  </p>
                  <p className="m-0 text-gray-500 mt-1">
                    Items: {Array.isArray(order.items) ? order.items.length : 0}
                    {Number.isFinite(Number(order.total_amount)) ? ` · Total: ${order.currency || 'USD'} ${Number(order.total_amount).toFixed(2)}` : ''}
                    {order.ordering_url ? <span> · <a href={order.ordering_url} target="_blank" rel="noopener noreferrer" className="text-[#c8a45e]">Ordering URL</a></span> : ''}
                  </p>
                </div>
              ))
            )}
          </div>

          {poEmailDrafts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 m-0">Supplier Email Drafts</p>
              {poEmailDrafts.map((draft) => (
                <div key={`po-email-draft-${draft.orderId}`} className="border border-gray-200 rounded p-3 text-xs">
                  <p className="m-0 font-semibold">{draft.subject}</p>
                  <p className="m-0 text-gray-500 mt-1">
                    Supplier: {draft.supplierName} {draft.supplierEmail ? `(${draft.supplierEmail})` : '(no supplier email)'}
                    {draft.internalEmail ? ` · Internal: ${draft.internalEmail}` : ''}
                    {draft.openOrderingUrl ? <span> · <a href={draft.openOrderingUrl} target="_blank" rel="noopener noreferrer" className="text-[#c8a45e]">Open Ordering URL</a></span> : ''}
                  </p>
                  <pre className="text-[11px] bg-gray-50 border border-gray-200 rounded p-2 mt-2 whitespace-pre-wrap">{draft.body}</pre>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
