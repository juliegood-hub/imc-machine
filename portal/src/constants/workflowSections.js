export const WORKFLOW_TRACKS = [
  {
    key: 'booking_setup',
    label: 'Booking + Setup',
    icon: '🧭',
    description: 'Account setup, reusable libraries, and event fundamentals.',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    cardClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    accentClass: 'text-indigo-700',
  },
  {
    key: 'production_ops',
    label: 'Production Ops',
    icon: '🎬',
    description: 'Run of show, staffing, checklists, and media capture operations.',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    cardClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    accentClass: 'text-emerald-700',
  },
  {
    key: 'marketing_distribution',
    label: 'Marketing + Distribution',
    icon: '🚀',
    description: 'Generate assets, distribute campaigns, and track delivery.',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700',
    cardClass: 'bg-fuchsia-50',
    borderClass: 'border-fuchsia-200',
    accentClass: 'text-fuchsia-700',
  },
  {
    key: 'revenue_reporting',
    label: 'Ticketing + Revenue',
    icon: '💳',
    description: 'Ticketing, settlement, and stakeholder reporting.',
    badgeClass: 'bg-amber-100 text-amber-700',
    cardClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    accentClass: 'text-amber-700',
  },
];

export const WORKFLOW_ACTOR_META = {
  automatic: { icon: '🤖', label: 'Automatic', className: 'bg-blue-100 text-blue-700' },
  human: { icon: '👤', label: 'Human', className: 'bg-amber-100 text-amber-700' },
  review: { icon: '🤝', label: 'AI + Human Review', className: 'bg-purple-100 text-purple-700' },
};

export const WORKFLOW_SECTIONS = [
  {
    id: 'account_profile',
    number: 1,
    title: 'Account + Profile Setup',
    icon: '🏗️',
    track: 'booking_setup',
    summary: 'Set up your identity once so all campaigns and operations stay consistent.',
    steps: [
      { title: 'Sign up by client type', actor: 'human', desc: 'Choose role(s) like Booking Agent, Staff Scheduler, Venue, Artist, or Artisan so forms adapt.' },
      { title: 'Set brand + contact identity', actor: 'human', desc: 'Save contact details, visual identity, and communication defaults.' },
      { title: 'Use AI Assist on forms', actor: 'review', desc: 'Voice, paste, image OCR, and PDF extraction can prefill forms for review before save.' },
      { title: 'Save emergency contacts', actor: 'human', desc: 'Emergency contact coverage supports staffing readiness and policy compliance.' },
    ],
  },
  {
    id: 'reusable_libraries',
    number: 2,
    title: 'Reusable Libraries + Booking Basics',
    icon: '🧩',
    track: 'booking_setup',
    summary: 'Stop retyping by storing acts, venues, zones, and show templates.',
    steps: [
      { title: 'Build reusable acts/participants', actor: 'human', desc: 'Store multiple bands, speakers, artists, and collaborators for reuse.' },
      { title: 'Build reusable venue profiles', actor: 'human', desc: 'Save common venues with core details once.' },
      { title: 'Create performance zones', actor: 'human', desc: 'Define rooms/stages with dimensions, capacity, power, and restrictions.' },
      { title: 'Create zone-aware bookings', actor: 'human', desc: 'Assign event times to specific zones with overlap conflict checks.' },
    ],
  },
  {
    id: 'production_ops',
    number: 3,
    title: 'Production Ops',
    icon: '🎛️',
    track: 'production_ops',
    summary: 'Prepare show execution with run-of-show, checklists, and department plans.',
    steps: [
      { title: 'Stage plot + tech specs', actor: 'human', desc: 'Configure inputs, monitors, backline, power, and stage layout.' },
      { title: 'Run of show workflow', actor: 'review', desc: 'Track cues, timing, and owner responsibilities, including email-ingested updates.' },
      { title: 'Department modules', actor: 'human', desc: 'Manage costumes, set/scenery, dressing rooms, and parking/permits/maps.' },
      { title: 'Production checklists', actor: 'human', desc: 'Track load-in, soundcheck, rehearsal, show call, and strike readiness.' },
    ],
  },
  {
    id: 'staffing_workforce',
    number: 4,
    title: 'Staffing + Workforce',
    icon: '👥',
    track: 'production_ops',
    summary: 'Assign shifts, publish schedules, and confirm day-of-show staffing coverage.',
    steps: [
      { title: 'Onboard staff once', actor: 'human', desc: 'Create reusable staff/contractor/volunteer profiles with roles and rates.' },
      { title: 'Assign shifts by booking', actor: 'human', desc: 'Schedule start/end times with conflict checking and bulk updates.' },
      { title: 'Publish + confirmations', actor: 'automatic', desc: 'Send schedule notifications and track confirm/decline status.' },
      { title: 'Training, certifications, time clock', actor: 'automatic', desc: 'Track compliance and attendance with reminders and QR clock workflow.' },
    ],
  },
  {
    id: 'capture_pipeline',
    number: 5,
    title: 'Capture (Audio + Video)',
    icon: '🎥',
    track: 'production_ops',
    summary: 'Manage capture inputs/devices, Zoom podcast video sessions, and YouTube output routing.',
    steps: [
      { title: 'Set capture plan', actor: 'human', desc: 'Choose recording type (video/audio/both), capture mode, and rights status.' },
      { title: 'Register input devices', actor: 'human', desc: 'Add camera and audio input sources, locations, and operators.' },
      { title: 'Configure Zoom podcast session', actor: 'review', desc: 'Link/create Zoom meeting or webinar with recording + transcript settings.' },
      { title: 'Set YouTube/YouTube Podcast output', actor: 'review', desc: 'Save YouTube destination and publish path for video podcast distribution.' },
    ],
  },
  {
    id: 'marketing_distribution',
    number: 6,
    title: 'Marketing + Distribution',
    icon: '📣',
    track: 'marketing_distribution',
    summary: 'Generate campaign assets, distribute to channels, and track outcomes.',
    steps: [
      { title: 'Generate campaign copy + assets', actor: 'review', desc: 'Create press, social, email, SMS, and channel-ready messaging with edit control.' },
      { title: 'Distribute channels', actor: 'automatic', desc: 'Run Facebook, Instagram, LinkedIn, Twitter/X, email blast, SMS, and calendar queue.' },
      { title: 'Calendar queue processing', actor: 'automatic', desc: 'Do210, SA Current, and Evvnt submissions run asynchronously.' },
      { title: 'Track campaign status', actor: 'automatic', desc: 'See sent/pending/failed states and destination URLs per event.' },
    ],
  },
  {
    id: 'ticketing_revenue',
    number: 7,
    title: 'Ticketing + Revenue + Reporting',
    icon: '📊',
    track: 'revenue_reporting',
    summary: 'Keep ticketing, settlement, and stakeholder visibility in one place.',
    steps: [
      { title: 'Connect ticketing providers', actor: 'human', desc: 'Use Eventbrite now and Ticketmaster/manual linking where needed.' },
      { title: 'Sync ticketing snapshot', actor: 'automatic', desc: 'Store provider IDs/URLs and sold/gross snapshot fields.' },
      { title: 'Settlement + reconciliation', actor: 'human', desc: 'Track gross/net and payout details for post-show closeout.' },
      { title: 'Board/stakeholder reporting', actor: 'automatic', desc: 'Use summary dashboards and packet exports for stakeholders.' },
    ],
  },
];

export function getWorkflowTrackMeta(trackKey) {
  return WORKFLOW_TRACKS.find((track) => track.key === trackKey) || WORKFLOW_TRACKS[0];
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function hasAnyValue(input) {
  if (!input) return false;
  if (Array.isArray(input)) return input.length > 0;
  if (typeof input === 'object') return Object.values(input).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value;
    return hasText(value);
  });
  return hasText(input);
}

function normalizeStatus(value) {
  return String(value || '').toLowerCase().trim();
}

function asChecks(items = []) {
  return items.map(item => ({ label: item.label, done: !!item.done }));
}

function buildProgressSection({ id, title, track, opsTab, ctaLabel, checks = [] }) {
  const completed = checks.filter(check => check.done).length;
  const total = checks.length;
  const missing = checks.filter(check => !check.done).map(check => check.label);
  const status = completed >= total ? 'complete' : (completed > 0 ? 'in_progress' : 'not_started');
  return { id, title, track, opsTab, ctaLabel, checks, completed, total, missing, status };
}

export function computeEventWorkflowProgress({
  event,
  campaigns = [],
  staffingRequests = [],
  showCheckins = [],
  settlementReports = [],
  mediaCapturePlan = null,
  captureSources = [],
  zoomMeetingConfig = null,
  youtubeDistribution = null,
} = {}) {
  const productionDetails = event?.productionDetails || {};
  const runOfShow = event?.run_of_show || {};
  const workflowSteps = Array.isArray(runOfShow.workflowSteps) ? runOfShow.workflowSteps : [];
  const techChecklist = Array.isArray(runOfShow.techChecklist) ? runOfShow.techChecklist : [];
  const doneWorkflowSteps = workflowSteps.filter((step) => normalizeStatus(step.status) === 'done').length;
  const readyTechItems = techChecklist.filter((item) => normalizeStatus(item.status) === 'ready').length;

  const channels = event?.channels;
  const configuredChannelCount = Array.isArray(channels)
    ? channels.length
    : (channels && typeof channels === 'object'
      ? Object.values(channels).filter((value) => {
        if (typeof value === 'boolean') return value;
        const normalized = normalizeStatus(value);
        return normalized && !['false', 'off', 'disabled', 'none'].includes(normalized);
      }).length
      : 0);

  const normalizedCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const activeCampaigns = normalizedCampaigns.filter((item) => ['sent', 'published', 'created', 'success'].includes(normalizeStatus(item.status)));
  const failedCampaigns = normalizedCampaigns.filter((item) => ['failed', 'error'].includes(normalizeStatus(item.status)));

  const ticketSalesCount = Number(productionDetails.ticketSalesCount || productionDetails.ticket_sales_count || event?.ticketSalesCount || 0);
  const seatsAvailable = Number(productionDetails.seatsAvailable || productionDetails.seats_available || event?.seatsAvailable || 0);
  const hasTicketSnapshot = Number.isFinite(ticketSalesCount) && ticketSalesCount > 0
    || Number.isFinite(seatsAvailable) && seatsAvailable > 0;

  const staffingRows = Array.isArray(staffingRequests) ? staffingRequests : [];
  const staffingFilledRows = staffingRows.filter((row) => ['filled', 'sent', 'confirmed'].includes(normalizeStatus(row.status)));
  const checkinRows = Array.isArray(showCheckins) ? showCheckins : [];
  const checkedInRows = checkinRows.filter((row) => normalizeStatus(row.status) === 'checked_in');

  const settlementRows = Array.isArray(settlementReports) ? settlementReports : [];
  const closedSettlements = settlementRows.filter((row) => ['approved', 'paid', 'closed'].includes(normalizeStatus(row.status)));
  const sourceRows = Array.isArray(captureSources) ? captureSources : [];
  const normalizedRecordingType = normalizeStatus(mediaCapturePlan?.recording_type || mediaCapturePlan?.recordingType || '');
  const zoomJoinUrl = zoomMeetingConfig?.zoom_join_url || zoomMeetingConfig?.zoomJoinUrl || '';
  const zoomMeetingId = zoomMeetingConfig?.zoom_meeting_id || zoomMeetingConfig?.zoomMeetingId || '';
  const normalizedZoomStatus = normalizeStatus(zoomMeetingConfig?.zoom_status || zoomMeetingConfig?.zoomStatus || '');
  const youtubeVideoUrl = youtubeDistribution?.youtube_video_url || youtubeDistribution?.youtubeVideoUrl || '';
  const youtubeVideoId = youtubeDistribution?.youtube_video_id || youtubeDistribution?.youtubeVideoId || '';
  const normalizedYouTubeStatus = normalizeStatus(youtubeDistribution?.publish_status || youtubeDistribution?.publishStatus || '');
  const hasCameraSource = sourceRows.some((row) => normalizeStatus(row?.type) === 'camera');
  const hasAudioSource = sourceRows.some((row) => normalizeStatus(row?.type) === 'audio_input');

  return [
    buildProgressSection({
      id: 'event_build',
      title: 'Event Build',
      track: 'booking_setup',
      opsTab: 'overview',
      ctaLabel: 'Finish event basics',
      checks: asChecks([
        { label: 'Event title', done: hasText(event?.title) },
        { label: 'Date + time', done: hasText(event?.date) && (hasText(event?.time) || hasText(event?.bookingStartAt)) },
        { label: 'Event type/genre', done: hasText(event?.genre) },
        { label: 'Venue details', done: hasText(event?.venue) || hasText(event?.venueAddress) },
        { label: 'Primary performer/host context', done: hasText(event?.performers) || hasAnyValue(event?.participantProfileIds) },
      ]),
    }),
    buildProgressSection({
      id: 'production_readiness',
      title: 'Production Readiness',
      track: 'production_ops',
      opsTab: 'production',
      ctaLabel: 'Open production tab',
      checks: asChecks([
        { label: 'Performance zone assigned', done: hasText(event?.performanceZoneId) || hasText(event?.performanceZoneName) },
        { label: 'Booking window set', done: hasText(event?.bookingStartAt) && hasText(event?.bookingEndAt) },
        { label: 'Show configuration selected', done: hasText(event?.showConfigurationId) || hasAnyValue(productionDetails.showType) },
        { label: 'Run of show workflow started', done: workflowSteps.length > 0 && doneWorkflowSteps > 0 },
        { label: 'Tech checklist started', done: techChecklist.length > 0 && readyTechItems > 0 },
      ]),
    }),
    buildProgressSection({
      id: 'marketing_assets',
      title: 'Marketing Assets',
      track: 'marketing_distribution',
      opsTab: 'overview',
      ctaLabel: 'Review marketing assets',
      checks: asChecks([
        { label: 'Event description/copy', done: hasText(event?.description) },
        { label: 'Ticket CTA/link', done: hasText(event?.ticketLink) },
        { label: 'Brand direction (tone/colors)', done: hasText(event?.writingTone) || hasText(event?.brandColors) },
        { label: 'Distribution channels selected', done: configuredChannelCount > 0 },
      ]),
    }),
    buildProgressSection({
      id: 'distribution_delivery',
      title: 'Distribution Delivery',
      track: 'marketing_distribution',
      ctaLabel: 'Open IMC Composer',
      checks: asChecks([
        { label: 'Campaign records created', done: normalizedCampaigns.length > 0 },
        { label: 'At least one successful distribution', done: activeCampaigns.length > 0 },
        { label: 'No failed channel records', done: failedCampaigns.length === 0 && normalizedCampaigns.length > 0 },
      ]),
    }),
    buildProgressSection({
      id: 'staffing_day_of_show',
      title: 'Staffing + Day-of-Show',
      track: 'production_ops',
      opsTab: 'staffing',
      ctaLabel: 'Open staffing tab',
      checks: asChecks([
        { label: 'Staffing requests created', done: staffingRows.length > 0 },
        { label: 'At least one role filled/confirmed', done: staffingFilledRows.length > 0 },
        { label: 'Check-in plan created', done: checkinRows.length > 0 },
        { label: 'At least one check-in recorded', done: checkedInRows.length > 0 },
      ]),
    }),
    buildProgressSection({
      id: 'capture_pipeline',
      title: 'Capture (Audio + Video)',
      track: 'production_ops',
      opsTab: 'media',
      ctaLabel: 'Open media tab',
      checks: asChecks([
        { label: 'Capture plan saved', done: !!mediaCapturePlan },
        { label: 'Capture mode selected', done: hasText(mediaCapturePlan?.capture_mode || mediaCapturePlan?.captureMode) },
        { label: 'Input devices added', done: sourceRows.length > 0 },
        { label: 'Camera source present', done: hasCameraSource },
        { label: 'Audio input source present', done: normalizedRecordingType === 'video' ? true : hasAudioSource },
        { label: 'Zoom session linked', done: hasText(zoomJoinUrl) || hasText(zoomMeetingId) || ['scheduled', 'live', 'ended'].includes(normalizedZoomStatus) },
        { label: 'YouTube output configured', done: hasText(youtubeVideoUrl) || hasText(youtubeVideoId) || ['queued', 'published'].includes(normalizedYouTubeStatus) },
      ]),
    }),
    buildProgressSection({
      id: 'ticketing_revenue',
      title: 'Ticketing + Revenue',
      track: 'revenue_reporting',
      opsTab: 'ticketing',
      ctaLabel: 'Open ticketing tab',
      checks: asChecks([
        { label: 'Ticketing provider or URL linked', done: hasText(event?.ticketProvider) || hasText(event?.ticketProviderEventId) || hasText(event?.ticketLink) },
        { label: 'Ticketing snapshot tracked', done: hasTicketSnapshot },
        { label: 'Settlement/reconciliation started', done: settlementRows.length > 0 },
        { label: 'Settlement approved/closed', done: closedSettlements.length > 0 },
      ]),
    }),
  ];
}

export function summarizeWorkflowProgress(sectionProgress = []) {
  const sections = Array.isArray(sectionProgress) ? sectionProgress : [];
  const totalSections = sections.length;
  const completedSections = sections.filter((section) => section.status === 'complete').length;
  const totalChecks = sections.reduce((sum, section) => sum + section.total, 0);
  const completedChecks = sections.reduce((sum, section) => sum + section.completed, 0);
  const remainingItems = Math.max(totalChecks - completedChecks, 0);
  return { totalSections, completedSections, totalChecks, completedChecks, remainingItems };
}

export function getNextIncompleteWorkflowSection(sectionProgress = []) {
  const sections = Array.isArray(sectionProgress) ? sectionProgress : [];
  return sections.find((section) => section.status !== 'complete') || null;
}
