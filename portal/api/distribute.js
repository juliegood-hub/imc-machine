// ═══════════════════════════════════════════════════════════════
// IMC Machine: Server-Side Distribution API
// Vercel Serverless Function
//
// All external API calls happen HERE, not in the browser.
// POST /api/distribute
// Body: { action, event, venue, content, images, channels }
//
// Actions:
//   send-email       → Resend API
//   create-eventbrite → Eventbrite API
//   post-facebook    → Facebook Graph API
//   post-facebook-video → Facebook Reels/Video API
//   post-instagram   → Instagram Graph API (via FB)
//   post-instagram-video → Instagram Reels + Stories
//   post-linkedin    → LinkedIn API
//   post-linkedin-video → LinkedIn video post
//   post-youtube-video → YouTube upload API
//   ingest-stage-email → Stage email intake (with optional parse/apply)
//   get-stage-workflow → Fetch run_of_show workflow snapshot
//   set-stage-workflow → Upsert run_of_show workflow/cues/statuses
//   submit-do210     → Do210 (returns form data, manual or Puppeteer)
//   distribute-all   → Run all selected channels
// ═══════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_SUPPLIER_SUGGESTIONS,
  buildPurchaseOrderEmailBody,
  buildPurchaseOrderEmailHtml,
  buildPurchaseOrderEmailSubject,
  formatSupplierAddress,
  groupPoItemsBySupplier,
  normalizePoItems,
} from '../src/services/supplier-po.js';
import {
  DEFAULT_JOB_TITLES,
  STAFF_PAY_TYPES,
  STAFF_ASSIGNMENT_STATUSES,
  buildStaffingCoverage,
  buildStaffingScheduleMessage,
  buildStaffTimeBlocks,
  calculateAssignmentCompensation,
  findStaffAssignmentConflicts,
  normalizePhoneDigits,
  normalizeStaffingInboundAction,
  parseVoiceStaffInput,
} from '../src/services/staffing.js';
import {
  buildPayrollCsv,
  calculatePayrollRows,
  normalizeCertificationStatus,
  signTimeClockToken,
  summarizeVolunteerHours,
  validateEmergencyContacts,
  verifyTimeClockToken,
} from '../src/services/workforce.js';

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_FB_GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v25.0';

function toJulieBackendError(message) {
  const raw = String(message || '').trim();
  if (!raw) return 'Hmm. That did not go through yet. Try once more and I will keep moving.';
  if (/unknown action/i.test(raw)) return `I do not recognize that action yet. ${raw}`;
  if (/not configured/i.test(raw)) return `I need one quick setup step before I can run this: ${raw}`;
  if (/missing /i.test(raw)) return `I still need one detail before I can continue: ${raw}`;
  if (/required/i.test(raw)) return `One more detail and we are good: ${raw}`;
  if (/failed|error/i.test(raw)) return `Hmm. That did not work this round: ${raw}`;
  return raw;
}

function toJulieBackendWarning(message) {
  const raw = String(message || '').trim();
  if (!raw) return raw;
  if (/table missing|table was not found|run latest sql migration|run latest sql|migration/i.test(raw)) {
    return `I need one SQL update before this section is fully live: ${raw}`;
  }
  if (/not configured/i.test(raw)) {
    return `I need one quick setup step before this feature is fully live: ${raw}`;
  }
  return raw;
}

function toJulieBackendMessage(message) {
  const raw = String(message || '').trim();
  if (!raw) return raw;
  if (/video variant job queued/i.test(raw)) return 'Perfect. I queued the video variant job.';
  if (/stage workflow updated/i.test(raw)) return 'Perfect. I saved the stage workflow update.';
  return raw;
}

function voiceifyBackendPayload(value, parentKey = '') {
  if (Array.isArray(value)) {
    if (parentKey === 'errors') {
      return value.map((entry) => (typeof entry === 'string' ? toJulieBackendError(entry) : voiceifyBackendPayload(entry)));
    }
    if (parentKey === 'warnings') {
      return value.map((entry) => (typeof entry === 'string' ? toJulieBackendWarning(entry) : voiceifyBackendPayload(entry)));
    }
    return value.map((entry) => voiceifyBackendPayload(entry));
  }

  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = voiceifyBackendPayload(entry, key);
    }
    return next;
  }

  if (typeof value === 'string') {
    if (parentKey === 'error') return toJulieBackendError(value);
    if (parentKey === 'warning') return toJulieBackendWarning(value);
    if (parentKey === 'message') return toJulieBackendMessage(value);
    if (parentKey === 'reason') return toJulieBackendWarning(value);
    return value;
  }

  return value;
}

// ═══════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT - Reads from env vars first, then Supabase
// ═══════════════════════════════════════════════════════════════

async function getToken(platform) {
  // 1. Check env var first
  const envMap = { 
    facebook: 'FB_PAGE_ACCESS_TOKEN', 
    youtube: 'YOUTUBE_ACCESS_TOKEN',
    linkedin: 'LINKEDIN_ACCESS_TOKEN'
  };
  if (envMap[platform] && process.env[envMap[platform]]) {
    return { token: process.env[envMap[platform]], source: 'env', metadata: {} };
  }
  
  // 2. Fall back to Supabase app_settings (oauth_{platform})
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', `oauth_${platform}`)
    .single();
  
  if (!data?.value) return null;
  
  const conn = data.value;
  
  // 3. For YouTube: auto-refresh if expired
  if (platform === 'youtube') {
    const isExpired = conn.expires_at && new Date() > new Date(conn.expires_at);
    if (isExpired && conn.refresh_token) {
      const refreshed = await refreshYouTubeToken(conn);
      return refreshed; // already returns { token, source, metadata }
    }
  }
  
  return {
    token: conn.access_token,
    source: 'supabase',
    metadata: conn
  };
}

async function refreshYouTubeToken(connection) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('YouTube client credentials not configured');
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    }

    // Update stored token
    const updatedConnection = {
      ...connection,
      access_token: data.access_token,
      expires_at: new Date(Date.now() + (data.expires_in * 1000)).toISOString()
    };

    await supabase
      .from('app_settings')
      .upsert({
        key: 'oauth_youtube',
        value: updatedConnection
      }, { onConflict: 'key' });

    return {
      token: data.access_token,
      source: 'refreshed',
      metadata: updatedConnection
    };

  } catch (err) {
    throw new Error(`Failed to refresh YouTube token: ${err.message}`);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-IMC-Webhook-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Send this endpoint a POST request and I can run it.' });

  const action = req.body?.action
    || req.query?.action
    || (req.body?.event && req.body?.payload ? 'handle-zoom-webhook' : null);

  if (!action) return res.status(400).json({ error: 'Tell me which action you want me to run.' });

  try {
    const payload = normalizeDistributionPayload(req.body || {});
    const { event, venue, content, images, channels, options } = payload;

    if (requiresCompleteEvent(action)) {
      assertEventCompleteness(event, venue);
    }

    let result;
    switch (action) {
      case 'send-email':
        result = await sendEmail(payload);
        break;
      case 'send-press-release':
        result = await sendPressRelease(event, venue, content, options);
        break;
      case 'create-eventbrite':
        result = await createEventbrite(event, venue, options);
        break;
      case 'post-facebook':
        result = await postFacebook(event, venue, content, images, options);
        break;
      case 'post-facebook-video':
        result = await postFacebookVideo(payload);
        break;
      case 'post-instagram':
        result = await postInstagram(event, venue, content, images);
        break;
      case 'post-instagram-video':
        result = await postInstagramVideo(payload);
        break;
      case 'post-linkedin':
        result = await postLinkedIn(event, venue, content, images);
        break;
      case 'post-linkedin-video':
        result = await postLinkedInVideo(payload);
        break;
      case 'post-youtube-video':
        result = await postYouTubeVideo(payload);
        break;
      case 'handle-zoom-webhook':
        result = await handleZoomWebhook(req.body || {});
        break;
      case 'post-twitter':
        result = await postTwitter(payload);
        break;
      case 'send-email-blast':
        result = await sendEmailBlast(payload);
        break;
      case 'send-sms':
        result = await sendSMS(payload);
        break;
      case 'notify-admin-distribution':
        result = await notifyAdminDistribution(payload);
        break;
      case 'update-platform-images':
        result = await updatePlatformImages(payload);
        break;
      case 'submit-calendars':
        result = await submitCalendars(payload);
        break;
      case 'ingest-stage-email':
        result = await ingestStageEmail(payload, req);
        break;
      case 'get-stage-workflow':
        result = await getStageWorkflow(payload, req);
        break;
      case 'set-stage-workflow':
        result = await setStageWorkflow(payload, req);
        break;
      case 'get-production-data':
        result = await getProductionData(payload);
        break;
      case 'upsert-performance-zone':
        result = await upsertPerformanceZone(payload);
        break;
      case 'delete-performance-zone':
        result = await archivePerformanceZone(payload);
        break;
      case 'upsert-show-configuration':
        result = await upsertShowConfiguration(payload);
        break;
      case 'delete-show-configuration':
        result = await deleteShowConfiguration(payload);
        break;
      case 'assign-booking-production':
        result = await assignBookingProduction(payload);
        break;
      case 'upsert-stage-plot-document':
        result = await upsertStagePlotDocument(payload);
        break;
      case 'export-stage-plot-pdf':
        result = await exportStagePlotPdf(payload);
        break;
      case 'search-venues':
        result = await searchVenues(payload);
        break;
      case 'get-venue-details':
        result = await getVenueDetails(payload);
        break;
      case 'get-staffing-requests':
        result = await getStaffingRequests(payload);
        break;
      case 'create-staffing-request':
        result = await createStaffingRequest(payload);
        break;
      case 'update-staffing-request':
        result = await updateStaffingRequest(payload);
        break;
      case 'get-job-titles':
        result = await getJobTitles(payload);
        break;
      case 'seed-job-titles':
        result = await seedJobTitles(payload);
        break;
      case 'upsert-job-title':
        result = await upsertJobTitle(payload);
        break;
      case 'delete-job-title':
        result = await deleteJobTitle(payload);
        break;
      case 'get-staff-profiles':
        result = await getStaffProfiles(payload);
        break;
      case 'parse-staff-voice':
        result = await parseStaffVoice(payload);
        break;
      case 'upsert-staff-profile':
        result = await upsertStaffProfile(payload);
        break;
      case 'delete-staff-profile':
        result = await deleteStaffProfile(payload);
        break;
      case 'get-staff-assignments':
        result = await getStaffAssignments(payload);
        break;
      case 'upsert-staff-assignment':
        result = await upsertStaffAssignment(payload);
        break;
      case 'delete-staff-assignment':
        result = await deleteStaffAssignment(payload);
        break;
      case 'bulk-assign-staff-shift':
        result = await bulkAssignStaffShift(payload);
        break;
      case 'publish-staffing-schedule':
        result = await publishStaffingSchedule(payload);
        break;
      case 'process-staffing-sms':
        result = await processStaffingSms(payload, req);
        break;
      case 'get-staffing-dashboard':
        result = await getStaffingDashboard(payload);
        break;
      case 'export-staff-sheet':
        result = await exportStaffSheet(payload);
        break;
      case 'get-event-messages':
        result = await getEventMessages(payload);
        break;
      case 'send-event-message':
        result = await sendEventMessage(payload);
        break;
      case 'toggle-message-reaction':
        result = await toggleMessageReaction(payload);
        break;
      case 'translate-event-message':
        result = await translateEventMessage(payload);
        break;
      case 'get-event-conversation':
        result = await getEventConversation(payload);
        break;
      case 'upsert-event-conversation':
        result = await upsertEventConversation(payload);
        break;
      case 'get-venue-staffing-policy':
        result = await getVenueStaffingPolicy(payload);
        break;
      case 'upsert-venue-staffing-policy':
        result = await upsertVenueStaffingPolicy(payload);
        break;
      case 'get-emergency-contacts':
        result = await getEmergencyContacts(payload);
        break;
      case 'upsert-emergency-contact':
        result = await upsertEmergencyContact(payload);
        break;
      case 'delete-emergency-contact':
        result = await deleteEmergencyContact(payload);
        break;
      case 'get-training-courses':
        result = await getTrainingCourses(payload);
        break;
      case 'upsert-training-course':
        result = await upsertTrainingCourse(payload);
        break;
      case 'delete-training-course':
        result = await deleteTrainingCourse(payload);
        break;
      case 'get-training-sessions':
        result = await getTrainingSessions(payload);
        break;
      case 'upsert-training-session':
        result = await upsertTrainingSession(payload);
        break;
      case 'delete-training-session':
        result = await deleteTrainingSession(payload);
        break;
      case 'get-training-enrollments':
        result = await getTrainingEnrollments(payload);
        break;
      case 'upsert-training-enrollment':
        result = await upsertTrainingEnrollment(payload);
        break;
      case 'delete-training-enrollment':
        result = await deleteTrainingEnrollment(payload);
        break;
      case 'send-training-reminders':
        result = await sendTrainingReminders(payload);
        break;
      case 'get-certification-types':
        result = await getCertificationTypes(payload);
        break;
      case 'seed-certification-types':
        result = await seedCertificationTypes(payload);
        break;
      case 'upsert-certification-type':
        result = await upsertCertificationType(payload);
        break;
      case 'delete-certification-type':
        result = await deleteCertificationType(payload);
        break;
      case 'get-staff-certifications':
        result = await getStaffCertifications(payload);
        break;
      case 'upsert-staff-certification':
        result = await upsertStaffCertification(payload);
        break;
      case 'delete-staff-certification':
        result = await deleteStaffCertification(payload);
        break;
      case 'send-certification-reminders':
        result = await sendCertificationReminders(payload);
        break;
      case 'generate-time-clock-qr':
        result = await generateTimeClockQr(payload);
        break;
      case 'time-clock-scan':
        result = await processTimeClockScan(payload);
        break;
      case 'override-time-clock-shift':
        result = await overrideTimeClockShift(payload);
        break;
      case 'get-time-clock-shifts':
        result = await getTimeClockShifts(payload);
        break;
      case 'get-payroll-export':
        result = await getPayrollExport(payload);
        break;
      case 'export-payroll-csv':
        result = await exportPayrollCsv(payload);
        break;
      case 'get-volunteer-hours-report':
        result = await getVolunteerHoursReport(payload);
        break;
      case 'list-completion-tasks':
        result = await listCompletionTasks(payload);
        break;
      case 'create-completion-task':
        result = await createCompletionTask(payload);
        break;
      case 'update-completion-task':
        result = await updateCompletionTask(payload);
        break;
      case 'send-completion-reminders':
        result = await sendCompletionReminders(payload);
        break;
      case 'log-ai-assist-run':
        result = await logAiAssistRun(payload);
        break;
      case 'get-ticketing-providers':
        result = await getTicketingProviders(payload);
        break;
      case 'get-venue-ticketing-connections':
        result = await getVenueTicketingConnections(payload);
        break;
      case 'upsert-venue-ticketing-connection':
        result = await upsertVenueTicketingConnection(payload);
        break;
      case 'remove-venue-ticketing-connection':
        result = await removeVenueTicketingConnection(payload);
        break;
      case 'get-booking-ticketing-records':
        result = await getBookingTicketingRecords(payload);
        break;
      case 'create-booking-ticketing-event':
        result = await createBookingTicketingEvent(payload);
        break;
      case 'link-booking-ticketing-event':
        result = await linkBookingTicketingEvent(payload);
        break;
      case 'sync-booking-ticketing-record':
        result = await syncBookingTicketingRecord(payload);
        break;
      case 'get-ticketing-snapshots':
        result = await getTicketingSnapshots(payload);
        break;
      case 'sync-ticketing':
        result = await syncTicketing(payload);
        break;
      case 'get-production-checklists':
        result = await getProductionChecklists(payload);
        break;
      case 'upsert-production-checklist':
        result = await upsertProductionChecklist(payload);
        break;
      case 'upsert-production-checklist-item':
        result = await upsertProductionChecklistItem(payload);
        break;
      case 'delete-production-checklist-item':
        result = await deleteProductionChecklistItem(payload);
        break;
      case 'get-venue-inventory':
        result = await getVenueInventory(payload);
        break;
      case 'upsert-venue-inventory-item':
        result = await upsertVenueInventoryItem(payload);
        break;
      case 'search-suppliers':
        result = await searchSuppliers(payload);
        break;
      case 'get-supplier-details':
        result = await getSupplierDetails(payload);
        break;
      case 'get-venue-suppliers':
        result = await getVenueSuppliers(payload);
        break;
      case 'upsert-venue-supplier':
        result = await upsertVenueSupplier(payload);
        break;
      case 'delete-venue-supplier':
        result = await deleteVenueSupplier(payload);
        break;
      case 'get-supplier-contacts':
        result = await getSupplierContacts(payload);
        break;
      case 'upsert-supplier-contact':
        result = await upsertSupplierContact(payload);
        break;
      case 'delete-supplier-contact':
        result = await deleteSupplierContact(payload);
        break;
      case 'get-inventory-supplier-links':
        result = await getInventorySupplierLinks(payload);
        break;
      case 'upsert-inventory-supplier-link':
        result = await upsertInventorySupplierLink(payload);
        break;
      case 'delete-inventory-supplier-link':
        result = await deleteInventorySupplierLink(payload);
        break;
      case 'get-booking-purchase-orders':
        result = await getBookingPurchaseOrders(payload);
        break;
      case 'upsert-booking-purchase-order':
        result = await upsertBookingPurchaseOrder(payload);
        break;
      case 'split-booking-purchase-orders':
        result = await splitBookingPurchaseOrders(payload);
        break;
      case 'generate-po-supplier-emails':
        result = await generatePoSupplierEmails(payload);
        break;
      case 'get-venue-maintenance':
        result = await getVenueMaintenance(payload);
        break;
      case 'upsert-venue-maintenance-contact':
        result = await upsertVenueMaintenanceContact(payload);
        break;
      case 'upsert-venue-maintenance-task':
        result = await upsertVenueMaintenanceTask(payload);
        break;
      case 'get-booking-documents':
        result = await getBookingDocuments(payload);
        break;
      case 'upsert-booking-document':
        result = await upsertBookingDocument(payload);
        break;
      case 'autofill-booking-document':
        result = await autofillBookingDocument(payload);
        break;
      case 'get-booking-budgets':
        result = await getBookingBudgets(payload);
        break;
      case 'upsert-booking-budget':
        result = await upsertBookingBudget(payload);
        break;
      case 'upsert-booking-budget-line':
        result = await upsertBookingBudgetLine(payload);
        break;
      case 'get-booking-riders':
        result = await getBookingRiders(payload);
        break;
      case 'upsert-booking-rider':
        result = await upsertBookingRider(payload);
        break;
      case 'upsert-booking-rider-item':
        result = await upsertBookingRiderItem(payload);
        break;
      case 'get-media-capture-plan':
        result = await getMediaCapturePlan(payload);
        break;
      case 'upsert-media-capture-plan':
        result = await upsertMediaCapturePlan(payload);
        break;
      case 'get-capture-sources':
        result = await getCaptureSources(payload);
        break;
      case 'upsert-capture-source':
        result = await upsertCaptureSource(payload);
        break;
      case 'delete-capture-source':
        result = await deleteCaptureSource(payload);
        break;
      case 'get-zoom-meeting-config':
        result = await getZoomMeetingConfig(payload);
        break;
      case 'upsert-zoom-meeting-config':
        result = await upsertZoomMeetingConfig(payload);
        break;
      case 'create-zoom-meeting':
        result = await createZoomMeeting(payload);
        break;
      case 'link-zoom-meeting':
        result = await linkZoomMeeting(payload);
        break;
      case 'get-zoom-assets':
        result = await getZoomAssets(payload);
        break;
      case 'upsert-zoom-asset':
        result = await upsertZoomAsset(payload);
        break;
      case 'get-youtube-distribution':
        result = await getYouTubeDistribution(payload);
        break;
      case 'upsert-youtube-distribution':
        result = await upsertYouTubeDistribution(payload);
        break;
      case 'publish-zoom-recording-to-youtube':
        result = await publishZoomRecordingToYouTube(payload);
        break;
      case 'get-concessions-plan':
        result = await getConcessionsPlan(payload);
        break;
      case 'upsert-concessions-plan':
        result = await upsertConcessionsPlan(payload);
        break;
      case 'get-concessions-menu-items':
        result = await getConcessionsMenuItems(payload);
        break;
      case 'upsert-concessions-menu-item':
        result = await upsertConcessionsMenuItem(payload);
        break;
      case 'delete-concessions-menu-item':
        result = await deleteConcessionsMenuItem(payload);
        break;
      case 'get-merch-plan':
        result = await getMerchPlan(payload);
        break;
      case 'upsert-merch-plan':
        result = await upsertMerchPlan(payload);
        break;
      case 'get-merch-participants':
        result = await getMerchParticipants(payload);
        break;
      case 'upsert-merch-participant':
        result = await upsertMerchParticipant(payload);
        break;
      case 'delete-merch-participant':
        result = await deleteMerchParticipant(payload);
        break;
      case 'get-merch-revenue-split':
        result = await getMerchRevenueSplit(payload);
        break;
      case 'upsert-merch-revenue-split':
        result = await upsertMerchRevenueSplit(payload);
        break;
      case 'get-costume-plan':
        result = await getCostumePlan(payload);
        break;
      case 'upsert-costume-plan':
        result = await upsertCostumePlan(payload);
        break;
      case 'upsert-costume-character':
        result = await upsertCostumeCharacter(payload);
        break;
      case 'delete-costume-character':
        result = await deleteCostumeCharacter(payload);
        break;
      case 'get-set-plan':
        result = await getSetPlan(payload);
        break;
      case 'upsert-set-plan':
        result = await upsertSetPlan(payload);
        break;
      case 'upsert-set-element':
        result = await upsertSetElement(payload);
        break;
      case 'delete-set-element':
        result = await deleteSetElement(payload);
        break;
      case 'get-parking-plan':
        result = await getParkingPlan(payload);
        break;
      case 'upsert-parking-plan':
        result = await upsertParkingPlan(payload);
        break;
      case 'upsert-parking-asset':
        result = await upsertParkingAsset(payload);
        break;
      case 'delete-parking-asset':
        result = await deleteParkingAsset(payload);
        break;
      case 'upsert-parking-assignment':
        result = await upsertParkingAssignment(payload);
        break;
      case 'delete-parking-assignment':
        result = await deleteParkingAssignment(payload);
        break;
      case 'get-dressing-rooms':
        result = await getDressingRooms(payload);
        break;
      case 'upsert-dressing-room':
        result = await upsertDressingRoom(payload);
        break;
      case 'delete-dressing-room':
        result = await deleteDressingRoom(payload);
        break;
      case 'get-dressing-room-assignments':
        result = await getDressingRoomAssignments(payload);
        break;
      case 'upsert-dressing-room-assignment':
        result = await upsertDressingRoomAssignment(payload);
        break;
      case 'delete-dressing-room-assignment':
        result = await deleteDressingRoomAssignment(payload);
        break;
      case 'export-operations-packet':
        result = await exportOperationsPacket(payload);
        break;
      case 'generate-ops-share-message':
        result = await generateOperationsShareMessage(payload);
        break;
      case 'get-festivals':
        result = await getFestivals(payload);
        break;
      case 'upsert-festival':
        result = await upsertFestival(payload);
        break;
      case 'upsert-festival-stage':
        result = await upsertFestivalStage(payload);
        break;
      case 'upsert-festival-booking':
        result = await upsertFestivalBooking(payload);
        break;
      case 'get-touring-shows':
        result = await getTouringShows(payload);
        break;
      case 'upsert-touring-show':
        result = await upsertTouringShow(payload);
        break;
      case 'upsert-tour-date':
        result = await upsertTourDate(payload);
        break;
      case 'clone-tour-date-booking':
        result = await cloneTourDateBooking(payload);
        break;
      case 'get-board-dashboard':
        result = await getBoardDashboard(payload);
        break;
      case 'upsert-board-risk-item':
        result = await upsertBoardRiskItem(payload);
        break;
      case 'delete-board-risk-item':
        result = await deleteBoardRiskItem(payload);
        break;
      case 'get-show-checkins':
        result = await getShowCheckins(payload);
        break;
      case 'create-show-checkin':
        result = await createShowCheckin(payload);
        break;
      case 'update-show-checkin':
        result = await updateShowCheckin(payload);
        break;
      case 'get-deal-memos':
        result = await getDealMemos(payload);
        break;
      case 'create-deal-memo':
        result = await createDealMemo(payload);
        break;
      case 'update-deal-memo':
        result = await updateDealMemo(payload);
        break;
      case 'export-deal-memo-pdf':
        result = await exportDealMemoPdf(payload);
        break;
      case 'get-settlement-reports':
        result = await getSettlementReports(payload);
        break;
      case 'create-settlement-report':
        result = await createSettlementReport(payload);
        break;
      case 'update-settlement-report':
        result = await updateSettlementReport(payload);
        break;
      case 'export-settlement-report':
        result = await exportSettlementReport(payload);
        break;
      case 'distribute-all':
        result = await distributeAll(event, venue, content, images, channels, options);
        break;
      case 'upload-image':
        result = await uploadImageToStorage(payload);
        break;
      case 'create-upload-url':
        result = await createUploadUrl(payload);
        break;
      case 'queue-video-variants':
        result = await queueVideoVariants(payload);
        break;
      case 'get-video-variant-job':
        result = await getVideoVariantJob(payload);
        break;
      case 'check-status':
        result = await checkAllStatus();
        break;
      default:
        return res.status(400).json({ error: `I do not recognize "${action}" yet. Pick one of the supported actions and I will run it.` });
    }
    return res.status(200).json({ success: true, ...voiceifyBackendPayload(result) });
  } catch (err) {
    console.error(`[distribute] ${action} error:`, err);
    const status = err.statusCode || 500;
    const voiceError = toJulieBackendError(err.message);
    if (err.missingFields) {
      return res.status(status).json({ success: false, error: voiceError, missingFields: err.missingFields });
    }
    return res.status(status).json({ success: false, error: voiceError });
  }
}

// ═══════════════════════════════════════════════════════════════
// EMAIL via Resend
// ═══════════════════════════════════════════════════════════════

async function sendEmail({ to, subject, html, from, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');

  // Use verified domain if available, otherwise fall back to Resend's test domain
  const defaultFrom = process.env.RESEND_FROM_EMAIL 
    || 'Good Creative Media <events@goodcreativemedia.com>';
  const fallbackFrom = 'Good Creative Media <onboarding@resend.dev>';

  let lastError = null;
  for (const sender of [from || defaultFrom, fallbackFrom]) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        reply_to: replyTo || 'juliegood@goodcreativemedia.com',
      }),
    });
    const data = await response.json();
    if (data.id) return { emailId: data.id, message: `Perfect. I sent that email to ${Array.isArray(to) ? to.length + ' people' : to}.`, from: sender };
    lastError = data.error?.message || 'Resend error';
    // If domain validation error, try fallback
    if (data.error?.message?.includes('not verified') || data.error?.message?.includes('not authorized')) continue;
    throw new Error(lastError);
  }
  throw new Error(lastError || 'Resend error');
}

// SA Media Contacts - Embedded from distribution list
const SA_MEDIA_CONTACTS = {
  tv: [
    { name: 'KSAT 12 Community Calendar', email: 'community@ksat.com', outlet: 'KSAT 12 (ABC)' },
    { name: 'Great Day SA', email: 'greatdaysa@kens5.com', outlet: 'KENS 5 (CBS)' },
    { name: 'News 4 SA Entertainment', email: 'news@news4sanantonio.com', outlet: 'WOAI/News 4 SA (NBC)' },
    { name: 'Daytime SA', email: 'daytime@kabb.com', outlet: 'KABB Fox 29' },
    { name: 'KLRN Arts & Culture', email: 'info@klrn.org', outlet: 'KLRN (PBS)' }
  ],
  radio: [
    { name: 'Texas Public Radio Arts', email: 'arts@tpr.org', outlet: 'TPR/KSTX 89.1' },
    { name: 'KRTU Music', email: 'music@krtu.org', outlet: 'KRTU 91.7' }
  ],
  print: [
    { name: 'S.A. Life', email: 'salife@express-news.net', outlet: 'San Antonio Express-News' },
    { name: 'SA Current Calendar', email: 'calendar@sacurrent.com', outlet: 'San Antonio Current' },
    { name: 'SA Report Tips', email: 'tips@sanantonioreport.org', outlet: 'San Antonio Report' },
    { name: 'SA Magazine Editorial', email: 'editorial@sanantoniomag.com', outlet: 'San Antonio Magazine' },
    { name: 'La Prensa Editor', email: 'editor@laprensatexas.com', outlet: 'La Prensa Texas' },
    { name: 'Out In SA', email: 'info@outinsa.com', outlet: 'Out In SA' }
  ],
  orgs: [
    { name: 'Visit San Antonio PR', email: 'pr@visitsanantonio.com', outlet: 'Visit San Antonio' }
  ]
};

function getAllPressContacts() {
  return [
    ...SA_MEDIA_CONTACTS.tv,
    ...SA_MEDIA_CONTACTS.radio,
    ...SA_MEDIA_CONTACTS.print,
    ...SA_MEDIA_CONTACTS.orgs
  ];
}

async function sendPressRelease(event, venue, content, options = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');

  // Use provided recipients or default to all SA media contacts
  const recipients = options.recipients && options.recipients.length > 0 
    ? options.recipients 
    : getAllPressContacts();

  if (!recipients.length) throw new Error('No recipients available');

  const fbShare = await resolveFacebookEventShareAssets(event);

  // Build proper HTML email content
  const pressReleaseHtml = buildPressReleaseHTML(event, venue, content, { fbShare });

  const results = [];
  for (const r of recipients) {
    try {
      const fromAddr = process.env.RESEND_FROM_EMAIL || 'Good Creative Media <events@goodcreativemedia.com>';
      let data;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromAddr,
          to: [r.email],
          subject: `Press Release: ${event.title}`,
          html: pressReleaseHtml,
          reply_to: 'juliegood@goodcreativemedia.com',
        }),
      });
      data = await response.json();
      // If domain not verified, retry with Resend test domain
      if (data.error && (data.error.message?.includes('not verified') || data.error.message?.includes('not authorized'))) {
        const retryRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Good Creative Media <onboarding@resend.dev>',
            to: [r.email],
            subject: `Press Release: ${event.title}`,
            html: pressReleaseHtml,
            reply_to: 'juliegood@goodcreativemedia.com',
          }),
        });
        data = await retryRes.json();
      }
      results.push({ 
        email: r.email, 
        name: r.name, 
        outlet: r.outlet,
        success: !!data.id, 
        id: data.id, 
        error: data.error?.message 
      });
    } catch (err) {
      results.push({ 
        email: r.email, 
        name: r.name, 
        outlet: r.outlet,
        success: false, 
        error: err.message 
      });
    }
    // Rate limit: 100ms between sends
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const sent = results.filter(r => r.success).length;
  return {
    sent,
    total: recipients.length,
    results,
    facebookEventUrl: fbShare.eventUrl || null,
    facebookEventQrUrl: fbShare.qrImageUrl || null,
  };
}

function buildPressReleaseHTML(event, venue, content, options = {}) {
  const pressText = typeof content === 'string' ? content : (content.pressRelease || content.press || content.html || '');
  const fbShare = options?.fbShare || {};
  const fbEventUrl = fbShare.eventUrl || '';
  const fbQrUrl = fbShare.qrImageUrl || '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Press Release: ${event.title}</title>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #c8a45e; padding-bottom: 10px; margin-bottom: 20px; }
    .company { color: #0d1b2a; font-weight: bold; }
    .dateline { font-weight: bold; margin-bottom: 10px; }
    .content { white-space: pre-line; }
    .fb-share { margin-top: 24px; padding: 16px; border: 1px solid #e4e4e4; background: #faf8f3; border-radius: 6px; }
    .fb-share h4 { margin: 0 0 8px 0; color: #0d1b2a; font-size: 14px; }
    .fb-share p { margin: 0 0 8px 0; font-size: 13px; }
    .fb-share img { width: 180px; height: 180px; border: 1px solid #ddd; background: #fff; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">Good Creative Media</div>
    <div style="font-size: 12px; color: #666;">Integrated Marketing Communications | San Antonio, TX</div>
  </div>
  
  <div class="dateline">SAN ANTONIO, TX — ${new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} —</div>
  
  <div class="content">${pressText}</div>

  ${fbEventUrl ? `
  <div class="fb-share">
    <h4>Facebook Event Link + QR</h4>
    <p><strong>Event URL:</strong> <a href="${escapeHtml(fbEventUrl)}">${escapeHtml(fbEventUrl)}</a></p>
    ${fbQrUrl ? `<p><img src="${escapeHtml(fbQrUrl)}" alt="Facebook Event QR Code" /></p>` : ''}
  </div>` : ''}
  
  <div class="footer">
    <p><strong>Contact:</strong><br>
    Good Creative Media<br>
    Phone: (210) 555-0199<br>
    Email: events@goodcreativemedia.com<br>
    Web: goodcreativemedia.com</p>
    
    <p><strong>About Good Creative Media:</strong> San Antonio-based integrated marketing communications agency specializing in arts venues, live music, theater, and cultural events.</p>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// EVENTBRITE
// ═══════════════════════════════════════════════════════════════

async function createEventbrite(event, venue, options = {}) {
  const token = options.token || process.env.EVENTBRITE_TOKEN;
  if (!token) throw new Error('EVENTBRITE_TOKEN not configured');

  const orgId = process.env.EVENTBRITE_ORG_ID || '276674179461';
  const venueId = options.venueId || process.env.EVENTBRITE_VENUE_ID || '296501198';

  const startLocal = `${event.date}T${convertTo24h(event.time || '19:00')}:00`;
  const endLocal = event.endTime
    ? `${event.endDate || event.date}T${convertTo24h(event.endTime)}:00`
    : `${event.date}T${convertTo24h(event.time || '19:00', 3)}:00`;

  // Build Eventbrite-safe HTML. We always sanitize user/AI text first so tags do not leak to listings.
  const cleanTitle = normalizePlainText(event?.title || 'Untitled Event', 160) || 'Untitled Event';
  const cleanVenueName = normalizePlainText(venue?.name || event?.venue || '', 200);
  const cleanVenueAddr = normalizePlainText(
    [venue?.address, venue?.city || 'San Antonio', venue?.state || 'TX', venue?.zip].filter(Boolean).join(', '),
    300
  );
  const cleanPerformers = normalizePlainText(event?.performers || '', 500);
  const cleanDescription = normalizePlainText(options.description || event?.description || event?.title || '', 5000);
  const cleanTicketPrice = normalizePlainText(String(event?.ticketPrice || ''), 30);

  const performers = cleanPerformers
    ? `<p><strong>Featuring:</strong> ${escapeHtml(cleanPerformers)}</p>`
    : '';
  const ticketInfo = event?.isFree || !event?.ticketPrice
    ? '<p><strong>Free admission.</strong> All ages welcome.</p>'
    : `<p><strong>Tickets:</strong> ${escapeHtml(cleanTicketPrice.startsWith('$') ? cleanTicketPrice : `$${cleanTicketPrice}`)}</p>`;

  const htmlDescription = `<h2>${escapeHtml(cleanTitle)}</h2>
${toSafeParagraphHtml(cleanDescription || cleanTitle)}
${performers}
${ticketInfo}
<h3>Venue</h3>
<p><strong>${escapeHtml(cleanVenueName)}</strong>${cleanVenueAddr ? `<br>${escapeHtml(cleanVenueAddr)}` : ''}</p>
<p><em>Presented by Good Creative Media.</em></p>`;

  // Create event
  const createRes = await fetch(`https://www.eventbriteapi.com/v3/organizations/${orgId}/events/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: {
        name: { html: escapeHtml(cleanTitle) },
        description: { html: htmlDescription },
        start: { timezone: 'America/Chicago', utc: localToUTC(startLocal) },
        end: { timezone: 'America/Chicago', utc: localToUTC(endLocal) },
        currency: 'USD',
        venue_id: venueId,
        listed: true,
        shareable: true,
        online_event: false,
      },
    }),
  });
  const created = await createRes.json();
  if (created.error) throw new Error(created.error_description || created.error);

  const eventId = created.id;

  // Add ticket class
  const ticketRes = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticket_class: {
        name: event.isFree || !event.ticketPrice ? 'General Admission (Free)' : 'General Admission',
        free: event.isFree || !event.ticketPrice,
        ...(event.ticketPrice ? { cost: `USD,${Math.round(event.ticketPrice * 100)}` } : {}),
        quantity_total: options.capacity || 100,
      },
    }),
  });
  const ticket = await ticketRes.json();

  // Upload banner image if provided
  let logoUrl = null;
  const bannerImage = options.bannerImage || options.imageUrl;
  if (bannerImage) {
    try {
      logoUrl = await uploadEventbriteBanner(token, eventId, bannerImage);
    } catch (err) {
      console.warn('[Eventbrite] Banner upload failed:', err.message);
    }
  }

  // Publish
  const pubRes = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/publish/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const pub = await pubRes.json();

  return {
    success: true,
    eventId,
    eventUrl: `https://www.eventbrite.com/e/${eventId}`,
    ticketClassId: ticket.id,
    published: pub.published || false,
    logoUrl,
  };
}

// Upload banner to Eventbrite via their S3 media upload flow
async function uploadEventbriteBanner(token, eventId, imageSource) {
  // Step 1: Get upload token
  const uploadInfoRes = await fetch('https://www.eventbriteapi.com/v3/media/upload/?type=image-event-logo', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const uploadInfo = await uploadInfoRes.json();
  if (!uploadInfo.upload_url || !uploadInfo.upload_token) throw new Error('No upload token received');

  // Step 2: Get image buffer
  let imgBuffer;
  if (imageSource.startsWith('data:')) {
    const b64 = imageSource.split(',')[1];
    imgBuffer = Buffer.from(b64, 'base64');
  } else if (imageSource.startsWith('http')) {
    const imgRes = await fetch(imageSource);
    imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  } else {
    imgBuffer = Buffer.from(imageSource, 'base64');
  }

  // Step 3: Upload to S3 with raw multipart (FormData doesn't work reliably on serverless)
  const boundary = '----EBUpload' + Date.now();
  const fields = uploadInfo.upload_data || {};
  let parts = [];
  for (const [key, val] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}`);
  }
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="banner.png"\r\nContent-Type: image/png\r\n\r\n`);
  const preFile = Buffer.from(parts.join('\r\n') + '\r\n');
  const postFile = Buffer.from(`\r\n--${boundary}--\r\n`);
  const fullBody = Buffer.concat([preFile, imgBuffer, postFile]);

  const s3Res = await fetch(uploadInfo.upload_url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: fullBody,
  });
  // S3 returns 204 on success

  // Step 4: Notify Eventbrite upload is complete
  const notifyRes = await fetch('https://www.eventbriteapi.com/v3/media/upload/', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_token: uploadInfo.upload_token,
      crop_mask: { top_left: { x: 0, y: 0 }, width: 2160, height: 1080 },
    }),
  });
  const mediaData = await notifyRes.json();
  if (!mediaData.id) throw new Error('Media upload notification failed');

  // Step 5: Set as event logo
  const logoRes = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: { logo_id: mediaData.id } }),
  });
  const logoData = await logoRes.json();
  return logoData.logo?.url || mediaData.url;
}

// ═══════════════════════════════════════════════════════════════
// FACEBOOK (Events + Feed Posts)
// ═══════════════════════════════════════════════════════════════

async function postFacebook(event, venue, content, images, options = {}) {
  const tokenData = await getToken('facebook');
  if (!tokenData?.token) throw new Error('Facebook not connected');

  const token = tokenData.token;
  const pageId = resolveFacebookPageId(tokenData);
  const graphVersion = resolveFacebookGraphVersion(options);
  const fallbackPostOnly = !!(options?.fallback_post_only || options?.fallbackPostOnly);
  const alwaysCreateFeedPost = options?.alwaysCreateFeedPost !== false;
  const fingerprint = buildFacebookEventFingerprint(event, venue, pageId);

  const results = {
    success: false,
    mode: 'failed',
    event_create_attempted: !fallbackPostOnly,
    event_created: false,
    event_id: null,
    event_url: null,
    fallback_post_created: false,
    post_id: null,
    errors: [],
    event: null,
    feedPost: null,
    fallback: { triggered: false, reason: null },
    diagnostics: {
      pageId,
      graphVersion,
      idempotencyKey: fingerprint,
      createdAt: new Date().toISOString(),
      timingsMs: {},
    },
  };

  // Idempotency guard: reuse prior Facebook event for this IMC event if present.
  if (!fallbackPostOnly) {
    const existing = await findExistingFacebookEventCampaign(event?.id, fingerprint);
    if ((existing?.eventId || existing?.eventUrl) && existing?.fingerprintMatched) {
      const eventId = existing.eventId || extractFacebookEventId(existing.eventUrl);
      const eventUrl = existing.eventUrl || (eventId ? `https://www.facebook.com/events/${eventId}` : null);
      results.event = {
        success: true,
        reused: true,
        source: 'campaign_cache',
        eventId,
        eventUrl,
        fingerprintMatched: true,
      };
    } else if (existing?.eventId || existing?.eventUrl) {
      results.diagnostics.idempotencyBypassed = 'fingerprint_mismatch';
      results.diagnostics.previousEventId = existing.eventId || null;
      results.diagnostics.previousEventUrl = existing.eventUrl || null;
    }

    if (!results.event) {
      const eventAttempt = await createFacebookPageEvent({
        token,
        pageId,
        graphVersion,
        event,
        venue,
        content,
      });
      results.diagnostics.timingsMs.eventCreate = eventAttempt.elapsedMs;
      if (eventAttempt.success) {
        results.event = {
          success: true,
          source: 'graph_api',
          eventId: eventAttempt.eventId,
          eventUrl: eventAttempt.eventUrl,
          endpoint: eventAttempt.endpoint,
          attempts: eventAttempt.attempts,
        };
      } else {
        const reason = eventAttempt.error || 'Facebook event creation failed';
        results.event = {
          success: false,
          error: reason,
          endpoint: eventAttempt.endpoint,
          statusCode: eventAttempt.statusCode,
          errorDetails: eventAttempt.errorDetails || null,
          attempts: eventAttempt.attempts,
        };
        results.errors.push(reason);
        results.fallback.triggered = shouldFallbackFromFacebookEventError(eventAttempt.errorDetails || eventAttempt.error);
        results.fallback.reason = reason;
      };
    }
  } else {
    results.event = {
      success: false,
      skipped: true,
      error: 'Event creation skipped by fallback_post_only option.',
    };
    results.fallback.triggered = true;
    results.fallback.reason = results.event.error;
  }

  // Keep feed posting as part of social distribution to preserve current behavior.
  if (alwaysCreateFeedPost) {
    const imageUrl = firstValidHttpUrl(images?.fb_post_landscape, images?.fb_event_banner);
    const eventUrl = results.event?.eventUrl || null;
    const feedMessage = buildFacebookFeedMessage(event, venue, content, eventUrl);
    const feedPost = await createFacebookFeedPost({
      token,
      pageId,
      graphVersion,
      message: feedMessage,
      imageUrl,
    });
    results.diagnostics.timingsMs.feedPost = feedPost.elapsedMs;
    if (feedPost.success) {
      results.feedPost = {
        success: true,
        postId: feedPost.postId,
        postUrl: feedPost.postUrl,
        endpoint: feedPost.endpoint,
        mode: feedPost.mode,
        attempts: feedPost.attempts,
      };
    } else {
      const reason = feedPost.error || 'Facebook feed post failed';
      results.feedPost = {
        success: false,
        error: reason,
        endpoint: feedPost.endpoint,
        statusCode: feedPost.statusCode,
        errorDetails: feedPost.errorDetails || null,
        attempts: feedPost.attempts,
      };
      results.errors.push(reason);
    }
  }

  results.event_created = !!results.event?.success;
  results.event_id = results.event?.eventId || null;
  results.event_url = results.event?.eventUrl || null;
  results.fallback_post_created = !!results.feedPost?.success;
  results.post_id = results.feedPost?.postId || null;
  results.success = results.event_created || results.fallback_post_created;
  results.mode = results.event_created
    ? (results.fallback_post_created ? 'event_and_feed' : 'event_only')
    : (results.fallback_post_created ? 'feed_fallback' : 'failed');

  await persistFacebookEventCampaign(event, results, fingerprint);
  return results;
}

function resolveFacebookGraphVersion(options = {}) {
  const candidate = firstNonEmpty(
    options?.facebookGraphVersion,
    options?.graphVersion,
    process.env.FB_GRAPH_VERSION,
    DEFAULT_FB_GRAPH_VERSION
  );
  return /^v\d+\.\d+$/i.test(candidate) ? candidate : DEFAULT_FB_GRAPH_VERSION;
}

function resolveFacebookPageId(tokenData) {
  if (tokenData?.source === 'supabase' && tokenData?.metadata?.page_id) {
    return tokenData.metadata.page_id;
  }
  return process.env.FB_PAGE_ID || '522058047815423';
}

function buildFacebookEventFingerprint(event, venue, pageId) {
  const payload = [
    pageId || '',
    normalizePlainText(event?.title || '', 200).toLowerCase(),
    normalizeDate(event?.date || ''),
    normalizePlainText(event?.time || '', 30).toLowerCase(),
    normalizePlainText(event?.endTime || '', 30).toLowerCase(),
    normalizePlainText(event?.venue || venue?.name || '', 200).toLowerCase(),
    normalizePlainText(event?.venueAddress || venue?.address || '', 300).toLowerCase(),
    normalizePlainText(event?.venueCity || venue?.city || '', 120).toLowerCase(),
    normalizePlainText(event?.venueState || venue?.state || '', 120).toLowerCase(),
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

async function findExistingFacebookEventCampaign(eventId, fingerprint) {
  if (!eventId) return null;
  const { data, error } = await supabase
    .from('campaigns')
    .select('external_id, external_url, metadata, status, updated_at')
    .eq('event_id', eventId)
    .eq('channel', 'facebook_event')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;

  const row = data[0];
  const eventIdValue = normalizePlainText(row.external_id || '', 100);
  const eventUrlValue = normalizePlainText(row.external_url || '', 400);
  if (!eventIdValue && !eventUrlValue) return null;

  const storedFingerprint = row.metadata?.facebook_fingerprint || null;
  return {
    eventId: eventIdValue || extractFacebookEventId(eventUrlValue),
    eventUrl: eventUrlValue || null,
    fingerprintMatched: !storedFingerprint || storedFingerprint === fingerprint,
  };
}

async function createFacebookPageEvent({ token, pageId, graphVersion, event, venue, content }) {
  const endpoint = `https://graph.facebook.com/${graphVersion}/${pageId}/events`;
  const schedule = buildFacebookEventSchedule(event);
  const description = normalizePlainText(
    content?.facebookEventDescription || content?.socialFacebook || buildFBDescription(event, venue),
    6000
  );

  const body = new URLSearchParams();
  appendFormValue(body, 'access_token', token);
  appendFormValue(body, 'name', normalizePlainText(event?.title || 'Untitled Event', 200));
  appendFormValue(body, 'description', description);
  appendFormValue(body, 'start_time', schedule.startLocal);
  appendFormValue(body, 'end_time', schedule.endLocal);
  appendFormValue(body, 'timezone', schedule.timezone);
  appendFormValue(body, 'location', normalizePlainText(venue?.name || event?.venue || '', 200));
  appendFormValue(body, 'street', normalizePlainText(venue?.address || event?.venueAddress || '', 300));
  appendFormValue(body, 'city', normalizePlainText(venue?.city || event?.venueCity || '', 120));
  appendFormValue(body, 'state', normalizePlainText(venue?.state || event?.venueState || '', 120));
  appendFormValue(body, 'zip', normalizePlainText(venue?.zip || event?.venueZip || '', 20));
  appendFormValue(body, 'privacy_type', 'OPEN');
  appendFormValue(body, 'is_online', 'false');

  const response = await fetchGraphWithRetry(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (response.ok && response.data?.id) {
    const eventId = response.data.id;
    return {
      success: true,
      eventId,
      eventUrl: `https://www.facebook.com/events/${eventId}`,
      endpoint,
      elapsedMs: response.elapsedMs,
      attempts: response.attempts,
    };
  }

  return {
    success: false,
    endpoint,
    statusCode: response.statusCode,
    error: formatGraphError(response.errorDetails, response.statusCode),
    errorDetails: response.errorDetails,
    elapsedMs: response.elapsedMs,
    attempts: response.attempts,
  };
}

async function createFacebookFeedPost({ token, pageId, graphVersion, message, imageUrl }) {
  const mode = imageUrl ? 'photo' : 'feed';
  const endpoint = imageUrl
    ? `https://graph.facebook.com/${graphVersion}/${pageId}/photos`
    : `https://graph.facebook.com/${graphVersion}/${pageId}/feed`;
  const body = new URLSearchParams();
  appendFormValue(body, 'access_token', token);
  appendFormValue(body, imageUrl ? 'message' : 'message', message);
  if (imageUrl) appendFormValue(body, 'url', imageUrl);

  const response = await fetchGraphWithRetry(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const postId = response.data?.post_id || response.data?.id || null;
  if (response.ok && postId) {
    return {
      success: true,
      endpoint,
      mode,
      postId,
      postUrl: `https://www.facebook.com/${postId}`,
      elapsedMs: response.elapsedMs,
      attempts: response.attempts,
    };
  }

  return {
    success: false,
    endpoint,
    mode,
    statusCode: response.statusCode,
    error: formatGraphError(response.errorDetails, response.statusCode),
    errorDetails: response.errorDetails,
    elapsedMs: response.elapsedMs,
    attempts: response.attempts,
  };
}

async function fetchGraphWithRetry(url, init, options = {}) {
  const retries = Number.isFinite(options.retries) ? Number(options.retries) : 2;
  const baseDelayMs = Number.isFinite(options.baseDelayMs) ? Number(options.baseDelayMs) : 700;
  let last = {
    ok: false,
    statusCode: 0,
    data: null,
    errorDetails: null,
    elapsedMs: 0,
    attempts: 0,
  };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const started = Date.now();
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      const errorDetails = data?.error || null;
      const ok = res.ok && !errorDetails;
      last = {
        ok,
        statusCode: res.status,
        data,
        errorDetails,
        elapsedMs: Date.now() - started,
        attempts: attempt + 1,
      };
      if (ok) return last;

      if (!isRetryableGraphFailure(res.status, errorDetails) || attempt === retries) {
        return last;
      }
    } catch (err) {
      last = {
        ok: false,
        statusCode: 0,
        data: null,
        errorDetails: { message: err.message, type: err.name || 'FetchError' },
        elapsedMs: Date.now() - started,
        attempts: attempt + 1,
      };
      if (attempt === retries) return last;
    }

    const waitMs = baseDelayMs * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return last;
}

function isRetryableGraphFailure(statusCode, errorDetails = {}) {
  if (statusCode === 429 || statusCode >= 500) return true;
  const code = Number(errorDetails?.code || 0);
  return [1, 2, 4, 17, 341].includes(code);
}

function formatGraphError(errorDetails, statusCode) {
  const message = firstNonEmpty(errorDetails?.message, errorDetails?.error_user_msg, errorDetails?.error_data?.message);
  if (message) return message;
  if (statusCode) return `Graph request failed (${statusCode})`;
  return 'Graph request failed';
}

function shouldFallbackFromFacebookEventError(errorDetails) {
  const message = normalizePlainText(
    typeof errorDetails === 'string' ? errorDetails : errorDetails?.message || '',
    500
  ).toLowerCase();
  const code = Number(errorDetails?.code || 0);
  if ([3, 10, 200].includes(code)) return true;
  return (
    message.includes('unsupported post request')
    || message.includes('capability')
    || message.includes('permission')
    || message.includes('not authorized')
    || message.includes('not available')
    || message.includes('cannot create')
    || message.includes('deprecat')
  );
}

function buildFacebookEventSchedule(event) {
  const date = normalizeDate(event?.date) || new Date().toISOString().slice(0, 10);
  const startTime = convertTo24h(event?.time || '19:00');
  const endTime = event?.endTime ? convertTo24h(event.endTime) : convertTo24h(event?.time || '19:00', 3);
  const timezone = normalizePlainText(event?.timezone || event?.timeZone || 'America/Chicago', 80) || 'America/Chicago';

  return {
    startLocal: `${date}T${startTime}:00`,
    endLocal: `${date}T${endTime}:00`,
    timezone,
  };
}

function buildFacebookFeedMessage(event, venue, content, eventUrl) {
  const provided = normalizePlainText(content?.socialFacebook || content?.facebook || '', 2200);
  if (provided) {
    if (eventUrl && !provided.includes(eventUrl)) {
      return `${provided}\n\nRSVP: ${eventUrl}`.trim();
    }
    return provided;
  }

  const lines = [];
  const title = normalizePlainText(event?.title || '', 200);
  if (title) lines.push(title);
  const whenLine = [normalizeDate(event?.date), normalizePlainText(event?.time || '', 30)].filter(Boolean).join(' · ');
  if (whenLine) lines.push(`📅 ${whenLine}`);
  const venueName = normalizePlainText(venue?.name || event?.venue || '', 200);
  if (venueName) lines.push(`📍 ${venueName}`);
  const addressLine = normalizePlainText(
    [venue?.address || event?.venueAddress, venue?.city || event?.venueCity, venue?.state || event?.venueState]
      .filter(Boolean)
      .join(', '),
    300
  );
  if (addressLine) lines.push(addressLine);
  if (eventUrl) lines.push(`\nRSVP: ${eventUrl}`);
  if (event?.ticketLink) lines.push(`🎟 ${event.ticketLink}`);
  return lines.join('\n').trim().substring(0, 2200);
}

async function persistFacebookEventCampaign(event, result, fingerprint) {
  if (!event?.id) return;
  const status = result.event_created ? 'created' : 'failed';
  const payload = {
    event_id: event.id,
    user_id: event.user_id || null,
    channel: 'facebook_event',
    status,
    external_id: result.event_id || null,
    external_url: result.event_url || null,
    error_message: result.event_created ? null : (result.event?.error || result.errors?.[0] || null),
    metadata: {
      facebook_fingerprint: fingerprint,
      graph_version: result.diagnostics?.graphVersion || DEFAULT_FB_GRAPH_VERSION,
      page_id: result.diagnostics?.pageId || null,
      mode: result.mode,
      fallback: result.fallback || null,
      event: result.event || null,
      feed_post: result.feedPost || null,
    },
    sent_at: result.event_created ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('campaigns')
    .upsert(payload, { onConflict: 'event_id,channel' });

  if (error) {
    console.warn('[facebook] failed to persist campaign state:', error.message);
  }
}

function appendFormValue(form, key, value) {
  const normalized = firstNonEmpty(value);
  if (!normalized) return;
  form.set(key, normalized);
}

function extractFacebookEventId(url) {
  const value = firstNonEmpty(url);
  if (!value) return null;
  const match = value.match(/facebook\.com\/events\/(?:[^/?#]+\/)*(\d+)/i);
  if (match) return match[1];
  const queryMatch = value.match(/[?&](?:event_id|eid)=(\d+)/i);
  if (queryMatch) return queryMatch[1];
  const pathTailMatch = value.match(/\/(\d{8,})(?:[/?#]|$)/);
  if (pathTailMatch) return pathTailMatch[1];
  return null;
}

function isFacebookEventUrl(url) {
  const value = firstNonEmpty(url);
  if (!value) return false;
  if (!/^https?:\/\/(?:www\.)?facebook\.com\/events\//i.test(value)) return false;
  return !!extractFacebookEventId(value);
}

function buildFacebookEventQrImageUrl(eventUrl, size = 320) {
  if (!isFacebookEventUrl(eventUrl)) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(eventUrl)}`;
}

function appendFacebookShareToListing(listingText, fbShare = {}) {
  const base = normalizePlainText(listingText || '', 12000);
  const eventUrl = firstValidHttpUrl(fbShare?.eventUrl);
  const qrUrl = firstValidHttpUrl(fbShare?.qrImageUrl);
  if (!eventUrl && !qrUrl) return base;

  const lines = [base].filter(Boolean);
  lines.push('Facebook Event');
  if (eventUrl) lines.push(`URL: ${eventUrl}`);
  if (qrUrl) lines.push(`QR: ${qrUrl}`);
  return lines.join('\n\n').trim();
}

async function resolveFacebookEventShareAssets(event = {}) {
  let eventUrl = firstValidHttpUrl(
    event?.facebookEventUrl,
    event?.facebook_event_url,
    event?.facebook_event_link,
    event?.fbEventUrl,
  );
  let eventId = extractFacebookEventId(eventUrl);

  if ((!eventUrl || !eventId) && event?.id) {
    const { data } = await supabase
      .from('campaigns')
      .select('external_id, external_url, metadata, status, updated_at')
      .eq('event_id', event.id)
      .eq('channel', 'facebook_event')
      .order('updated_at', { ascending: false })
      .limit(1);

    const row = data?.[0];
    if (row) {
      const metadataUrl = firstValidHttpUrl(
        row.metadata?.event?.eventUrl,
        row.metadata?.manual_event_url,
      );
      const metadataId = firstNonEmpty(
        row.metadata?.event?.eventId,
        row.metadata?.manual_event_id,
      );
      if (!eventUrl) eventUrl = firstValidHttpUrl(row.external_url, metadataUrl);
      if (!eventId) eventId = firstNonEmpty(row.external_id, metadataId);
    }
  }

  if (!eventUrl) {
    const ticketLink = firstValidHttpUrl(event?.ticketLink, event?.ticket_link, event?.url);
    if (isFacebookEventUrl(ticketLink)) {
      eventUrl = ticketLink;
    }
  }

  if (!eventId) eventId = extractFacebookEventId(eventUrl);
  if (!eventUrl && eventId) {
    eventUrl = `https://www.facebook.com/events/${eventId}`;
  }

  if (eventUrl && !isFacebookEventUrl(eventUrl)) {
    eventUrl = '';
    eventId = '';
  }

  return {
    eventUrl: eventUrl || null,
    eventId: eventId || null,
    qrImageUrl: eventUrl ? buildFacebookEventQrImageUrl(eventUrl, 320) : null,
  };
}

// ═══════════════════════════════════════════════════════════════
// IMAGE UPLOAD — Supabase Storage for public HTTPS URLs (needed by Instagram)
// ═══════════════════════════════════════════════════════════════

async function uploadImageToStorage({ imageData, filename, contentType }) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase not configured for image upload');

  // imageData can be a base64 string or a data URL
  let buffer;
  let mime = contentType || 'image/png';
  if (imageData.startsWith('data:')) {
    const [header, b64] = imageData.split(',');
    mime = header.match(/data:(.*?);/)?.[1] || mime;
    buffer = Buffer.from(b64, 'base64');
  } else {
    buffer = Buffer.from(imageData, 'base64');
  }

  const path = `distribution/${Date.now()}-${filename || 'image.png'}`;
  
  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/media/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': mime,
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Storage upload failed: ${err}`);
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/media/${path}`;
  return { success: true, url: publicUrl, path };
}

async function createUploadUrl({ filename, contentType, folder = 'videos' }) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL not configured');
  if (!filename) throw new Error('filename is required');

  const safeName = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '-');
  const path = `distribution/${folder}/${Date.now()}-${safeName}`;
  const bucket = 'media';

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw new Error(`Upload URL failed: ${error.message}`);

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  return {
    success: true,
    bucket,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl,
    contentType: contentType || 'video/mp4',
  };
}

async function queueVideoVariants({ event, video, options = {} }) {
  const sourceUrl = requirePublicHttpsUrl(video?.url || video?.videoUrl, 'Video URL');
  const width = Number(video?.width || 0);
  const height = Number(video?.height || 0);
  const duration = Number(video?.duration || 0);
  const mimeType = video?.mimeType || video?.type || 'video/mp4';
  const sourcePath = video?.path || null;

  const targets = options.targets || ['vertical_9_16', 'square_1_1', 'landscape_16_9'];
  const payload = {
    event_id: event?.id || null,
    status: 'pending',
    source_url: sourceUrl,
    source_path: sourcePath,
    source_meta: {
      width,
      height,
      duration,
      mimeType,
      name: video?.name || null,
      size: Number(video?.size || 0) || null,
    },
    targets,
    outputs: {},
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('video_transcode_jobs')
    .insert(payload)
    .select('id,status,targets,source_url,source_meta,outputs,created_at,updated_at,error')
    .single();

  if (error) {
    throw new Error(`Failed to queue video variants: ${error.message}`);
  }

  return {
    success: true,
    message: 'Video variant job queued.',
    job: data,
  };
}

async function getVideoVariantJob({ jobId }) {
  if (!jobId) throw new Error('jobId is required');
  const { data, error } = await supabase
    .from('video_transcode_jobs')
    .select('id,status,targets,source_url,source_meta,outputs,created_at,updated_at,processed_at,error')
    .eq('id', jobId)
    .single();
  if (error) throw new Error(`Failed to fetch job: ${error.message}`);
  return { success: true, job: data };
}


// INSTAGRAM
// ═══════════════════════════════════════════════════════════════

async function postInstagram(event, venue, content, images) {
  const tokenData = await getToken('instagram'); // Same as Facebook token
  const token = tokenData.token;
  
  // Get page and Instagram IDs from stored connection or env vars
  let pageId = process.env.FB_PAGE_ID || '522058047815423';
  let igId = null;
  
  if (tokenData.source === 'supabase' && tokenData.metadata?.page_id) {
    pageId = tokenData.metadata.page_id;
    if (tokenData.metadata.instagram_account?.id) {
      igId = tokenData.metadata.instagram_account.id;
    }
  }
  
  // If we don't have IG ID from stored data, fetch it
  if (!igId) {
    const igRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${token}`);
    const igData = await igRes.json();
    if (igData.error) throw new Error(igData.error.message);
    if (!igData.instagram_business_account?.id) {
      throw new Error('No Instagram Business account linked. Connect one in Meta Business Suite.');
    }
    igId = igData.instagram_business_account.id;
  }

  let imageUrl = images?.ig_post_square || images?.ig_post_portrait || images?.fb_post_landscape;
  if (!imageUrl) throw new Error('No Instagram image provided. Generate graphics first via the Image Formatter.');

  // If image is base64/data URL, upload to Supabase Storage to get a public HTTPS URL
  if (imageUrl.startsWith('data:') || !imageUrl.startsWith('http')) {
    const uploaded = await uploadImageToStorage({
      imageData: imageUrl,
      filename: `ig-${event.id || Date.now()}.png`,
    });
    imageUrl = uploaded.url;
  }

  const caption = buildIGCaption(event, venue);

  // Create container
  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, image_url: imageUrl, caption }),
  });
  const container = await containerRes.json();
  if (container.error) throw new Error(`IG container: ${container.error.message}`);

  // Poll until container is ready (Instagram needs time to process the image)
  const containerId = container.id;
  let status = 'IN_PROGRESS';
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000)); // wait 3 seconds between checks
    const statusRes = await fetch(`https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${token}`);
    const statusData = await statusRes.json();
    status = statusData.status_code;
    if (status === 'FINISHED') break;
    if (status === 'ERROR') throw new Error('IG container processing failed');
  }
  if (status !== 'FINISHED') throw new Error(`IG container not ready after 30s (status: ${status})`);

  // Publish
  const pubRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, creation_id: containerId }),
  });
  const pub = await pubRes.json();
  if (pub.error) throw new Error(`IG publish: ${pub.error.message}`);

  return { success: true, mediaId: pub.id, igAccountId: igId };
}

// ═══════════════════════════════════════════════════════════════
// LINKEDIN
// ═══════════════════════════════════════════════════════════════

async function postLinkedIn(event, venue, content, images) {
  const tokenData = await getToken('linkedin');
  const token = tokenData.token;
  
  // Determine author: use org if available, otherwise post as person
  let author;
  if (tokenData.source === 'supabase' && tokenData.metadata?.organizations?.length > 0) {
    author = `urn:li:organization:${tokenData.metadata.organizations[0].id}`;
  } else if (process.env.LINKEDIN_ORG_ID) {
    author = `urn:li:organization:${process.env.LINKEDIN_ORG_ID.trim()}`;
  } else if (tokenData.source === 'supabase' && tokenData.metadata?.user_id) {
    author = `urn:li:person:${tokenData.metadata.user_id}`;
  } else {
    throw new Error('No LinkedIn organization or user ID available. Reconnect LinkedIn in Settings.');
  }
  const text = buildLinkedInText(event, venue, content);

  const imageUrl = images?.linkedin_post || images?.fb_post_landscape;

  let imageUrn = null;
  if (imageUrl) {
    // Register upload
    const regRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202602',
      },
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    });
    const regData = await regRes.json();
    if (regData.value) {
      // Upload image
      const imgRes = await fetch(imageUrl);
      const imgBuffer = await imgRes.arrayBuffer();
      await fetch(regData.value.uploadUrl, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: imgBuffer,
      });
      imageUrn = regData.value.image;
    }
  }

  const postBody = {
    author,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
  };
  if (imageUrn) {
    postBody.content = { media: { title: event.title, id: imageUrn } };
  }

  const postRes = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202602',
    },
    body: JSON.stringify(postBody),
  });

  if (postRes.status === 201) {
    const postId = postRes.headers.get('x-restli-id');
    return { success: true, postId, postUrl: postId ? `https://www.linkedin.com/feed/update/${postId}` : null };
  }
  const err = await postRes.json().catch(() => ({}));
  throw new Error(`LinkedIn post failed (${postRes.status}): ${err.message || JSON.stringify(err)}`);
}

async function postFacebookVideo({ event, content, video }) {
  const tokenData = await getToken('facebook');
  if (!tokenData?.token) throw new Error('Facebook not connected');
  const token = tokenData.token;
  let pageId = process.env.FB_PAGE_ID || '522058047815423';
  if (tokenData.source === 'supabase' && tokenData.metadata?.page_id) {
    pageId = tokenData.metadata.page_id;
  }

  const videoUrl = requirePublicHttpsUrl(video?.url || video?.videoUrl, 'Facebook video');
  const caption = normalizePlainText(
    content?.facebookReelCaption || content?.facebookCaption || content?.socialFacebook || event?.title || '',
    2200
  );

  // Attempt native Reels endpoint first; fallback to page video post if unavailable.
  const reelsBody = new URLSearchParams({
    access_token: token,
    video_url: videoUrl,
    description: caption,
  });
  const reelsRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: reelsBody,
  });
  const reelsData = await reelsRes.json().catch(() => ({}));
  if (reelsRes.ok && !reelsData.error) {
    const reelId = reelsData.id || reelsData.video_id || reelsData.post_id || null;
    return {
      success: true,
      mode: 'reel',
      reelId,
      reelUrl: reelId ? `https://www.facebook.com/reel/${reelId}` : null,
    };
  }

  const videoBody = new URLSearchParams({
    access_token: token,
    file_url: videoUrl,
    description: caption,
    title: normalizePlainText(event?.title || 'Video Post', 120),
    published: 'true',
  });
  const videoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: videoBody,
  });
  const videoData = await videoRes.json().catch(() => ({}));
  if (videoRes.ok && !videoData.error) {
    const videoId = videoData.id || null;
    return {
      success: true,
      mode: 'video',
      warning: reelsData?.error?.message || 'Reels endpoint unavailable; published as a page video post instead.',
      videoId,
      videoUrl: videoId ? `https://www.facebook.com/${pageId}/videos/${videoId}` : null,
    };
  }

  throw new Error(videoData?.error?.message || reelsData?.error?.message || 'Facebook video publish failed');
}

async function postInstagramVideo({ event, venue, content, video, modes = ['reel', 'story'] }) {
  const tokenData = await getToken('instagram');
  if (!tokenData?.token) throw new Error('Instagram not connected');
  const token = tokenData.token;

  let pageId = process.env.FB_PAGE_ID || '522058047815423';
  let igId = null;
  if (tokenData.source === 'supabase' && tokenData.metadata?.page_id) {
    pageId = tokenData.metadata.page_id;
    igId = tokenData.metadata.instagram_account?.id || null;
  }
  if (!igId) {
    const igRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${token}`);
    const igData = await igRes.json();
    if (igData.error) throw new Error(igData.error.message);
    igId = igData.instagram_business_account?.id;
  }
  if (!igId) throw new Error('No Instagram business account linked');

  const videoUrl = requirePublicHttpsUrl(video?.url || video?.videoUrl, 'Instagram video');
  const requestedModes = Array.isArray(modes) && modes.length ? modes : ['reel', 'story'];
  const results = {};

  if (requestedModes.includes('reel')) {
    try {
      const reelCaption = normalizePlainText(
        content?.instagramReelCaption || content?.instagramCaption || content?.facebookReelCaption || buildIGCaption(event, venue),
        2200
      );
      const reelContainerRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: token,
          media_type: 'REELS',
          video_url: videoUrl,
          caption: reelCaption,
          share_to_feed: 'true',
        }),
      });
      const reelContainer = await reelContainerRes.json();
      if (reelContainer.error) throw new Error(reelContainer.error.message);
      await waitForInstagramContainerReady(token, reelContainer.id);

      const reelPublishRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: token,
          creation_id: reelContainer.id,
        }),
      });
      const reelPublish = await reelPublishRes.json();
      if (reelPublish.error) throw new Error(reelPublish.error.message);
      results.reel = { success: true, mediaId: reelPublish.id };
    } catch (err) {
      results.reel = { success: false, error: err.message };
    }
  }

  if (requestedModes.includes('story')) {
    try {
      const storyContainerRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: token,
          media_type: 'STORIES',
          video_url: videoUrl,
        }),
      });
      const storyContainer = await storyContainerRes.json();
      if (storyContainer.error) throw new Error(storyContainer.error.message);
      await waitForInstagramContainerReady(token, storyContainer.id);

      const storyPublishRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: token,
          creation_id: storyContainer.id,
        }),
      });
      const storyPublish = await storyPublishRes.json();
      if (storyPublish.error) throw new Error(storyPublish.error.message);
      results.story = { success: true, mediaId: storyPublish.id };
    } catch (err) {
      results.story = { success: false, error: err.message };
    }
  }

  return {
    success: Object.values(results).some((v) => v?.success),
    igAccountId: igId,
    ...results,
  };
}

async function postLinkedInVideo({ event, content, video }) {
  const tokenData = await getToken('linkedin');
  if (!tokenData?.token) throw new Error('LinkedIn not connected');
  const token = tokenData.token;
  const author = resolveLinkedInAuthor(tokenData);
  const videoUrl = requirePublicHttpsUrl(video?.url || video?.videoUrl, 'LinkedIn video');

  const mediaRes = await fetch(videoUrl);
  if (!mediaRes.ok) throw new Error(`Unable to fetch video asset (${mediaRes.status})`);
  const mediaBuffer = Buffer.from(await mediaRes.arrayBuffer());
  const mediaType = mediaRes.headers.get('content-type') || video?.mimeType || 'video/mp4';

  const initRes = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202602',
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: author,
        fileSizeBytes: mediaBuffer.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok || initData?.error || initData?.status >= 400) {
    throw new Error(initData?.error?.message || initData?.message || `LinkedIn video initialize failed (${initRes.status})`);
  }

  const uploadUrl =
    initData?.value?.uploadInstructions?.[0]?.uploadUrl
    || initData?.value?.uploadUrl
    || null;
  const videoUrn =
    initData?.value?.video
    || initData?.value?.id
    || null;
  if (!uploadUrl || !videoUrn) throw new Error('LinkedIn upload did not return upload URL/video URN');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mediaType, 'Authorization': `Bearer ${token}` },
    body: mediaBuffer,
  });
  if (!uploadRes.ok) throw new Error(`LinkedIn video upload failed (${uploadRes.status})`);

  if (initData?.value?.finalizeUploadUrl) {
    await fetch(initData.value.finalizeUploadUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => null);
  }

  const text = normalizePlainText(
    content?.linkedinVideoPost || content?.linkedinPost || content?.linkedin || buildLinkedInText(event, null, content),
    3000
  );
  const postBody = {
    author,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    content: { media: { title: normalizePlainText(event?.title || 'Video', 150), id: videoUrn } },
  };

  const postRes = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202602',
    },
    body: JSON.stringify(postBody),
  });
  if (postRes.status !== 201) {
    const err = await postRes.json().catch(() => ({}));
    throw new Error(err?.message || `LinkedIn video post failed (${postRes.status})`);
  }
  const postId = postRes.headers.get('x-restli-id');
  return {
    success: true,
    postId,
    postUrl: postId ? `https://www.linkedin.com/feed/update/${postId}` : null,
    videoUrn,
  };
}

async function postYouTubeVideo({ event, content, video }) {
  const tokenData = await getToken('youtube');
  if (!tokenData?.token) throw new Error('YouTube not connected');
  const accessToken = tokenData.token;

  const videoUrl = requirePublicHttpsUrl(video?.url || video?.videoUrl, 'YouTube video');
  const sourceRes = await fetch(videoUrl);
  if (!sourceRes.ok) throw new Error(`Unable to fetch video asset (${sourceRes.status})`);
  const mediaBuffer = Buffer.from(await sourceRes.arrayBuffer());
  const mediaType = sourceRes.headers.get('content-type') || video?.mimeType || 'video/mp4';

  const isVertical = Number(video?.height || 0) > Number(video?.width || 0);
  const duration = Number(video?.duration || 0);
  const isShort = duration > 0 ? duration <= 60 && isVertical : false;

  const title = normalizePlainText(content?.youtubeTitle || event?.title || 'Good Creative Media', 95);
  let description = normalizePlainText(
    content?.youtubeDescription || event?.description || event?.title || '',
    4900
  );
  if (isShort && !/\#shorts/i.test(description)) {
    description = `${description}\n\n#Shorts`.trim();
  }

  const tags = parseTagList(content?.youtubeTags);
  const metadata = {
    snippet: {
      title: title || 'Good Creative Media',
      description,
      tags: tags.length ? tags : ['San Antonio', 'SATX', 'Live Events', 'Good Creative Media'],
      categoryId: '10',
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Length': String(mediaBuffer.length),
      'X-Upload-Content-Type': mediaType,
    },
    body: JSON.stringify(metadata),
  });
  const initErr = await initRes.clone().json().catch(() => null);
  if (!initRes.ok) {
    throw new Error(`YouTube init failed: ${initErr?.error?.message || initRes.statusText}`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('YouTube upload URL missing');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mediaType, 'Content-Length': String(mediaBuffer.length) },
    body: mediaBuffer,
  });
  const uploadData = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || uploadData.error) {
    throw new Error(uploadData?.error?.message || `YouTube upload failed (${uploadRes.status})`);
  }

  const videoId = uploadData.id;
  return {
    success: true,
    videoId,
    videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
    isShort,
  };
}

async function postTwitter({ event, content }) {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  if (!apiKey || !accessToken) {
    return { success: false, error: 'I need Twitter credentials before I can post this. Add TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET in Vercel, then I can publish for you.' };
  }
  const text = (content?.twitterPost || content?.socialFacebook || event.title).substring(0, 280);
  try {
    const { TwitterApi } = await import('twitter-api-v2');
    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });
    const { data } = await client.v2.tweet(text);
    return { success: true, tweetId: data.id, tweetUrl: `https://twitter.com/i/status/${data.id}` };
  } catch (err) {
    return { success: false, error: `Twitter pushed back: ${err.message}` };
  }
}

async function sendEmailBlast({ event, venue, content }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('I need RESEND_API_KEY before I can send the email blast.');
  const emailText = typeof content === 'string' ? content : (content.emailBlast || content.email || '');
  const subjectMatch = emailText.match(/subject\s*(?:line)?[:\s]*(.+)/i);
  const subject = subjectMatch ? subjectMatch[1].trim().replace(/^["']|["']$/g, '') : `${event.title} — Event Announcement`;
  const previewMatch = emailText.match(/preview\s*(?:text)?[:\s]*(.+)/i);
  const preview = previewMatch ? previewMatch[1].trim().replace(/^["']|["']$/g, '') : '';
  let body = emailText.replace(/subject\s*(?:line)?[:\s]*.+/i, '').replace(/preview\s*(?:text)?[:\s]*.+/i, '').trim();

  const { data: subscribers } = await supabase.from('profiles').select('email').not('email', 'is', null).eq('email_opt_in', true);
  const recipients = subscribers?.map(s => s.email).filter(Boolean) || [];
  if (recipients.length === 0) {
    return { success: false, error: 'I do not see any opted-in email subscribers yet. Ask people to opt in from profile settings, then we can send.' };
  }

  const fbShare = await resolveFacebookEventShareAssets(event);
  const html = buildEmailBlastHtml(event, venue, subject, body, fbShare);

  let sent = 0;
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    try {
      const fromAddr = process.env.RESEND_FROM_EMAIL || 'Good Creative Media <events@goodcreativemedia.com>';
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromAddr, to: batch, subject, html, reply_to: 'juliegood@goodcreativemedia.com' }),
      });
      const data = await response.json();
      if (data.id) { sent += batch.length; }
      else if (data.error?.message?.includes('not verified')) {
        const retryRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Good Creative Media <onboarding@resend.dev>', to: batch, subject, html, reply_to: 'juliegood@goodcreativemedia.com' }),
        });
        const retryData = await retryRes.json();
        if (retryData.id) sent += batch.length;
      }
    } catch (err) { /* continue */ }
    await new Promise(r => setTimeout(r, 200));
  }
  return {
    success: sent > 0,
    sent,
    total: recipients.length,
    facebookEventUrl: fbShare.eventUrl || null,
    facebookEventQrUrl: fbShare.qrImageUrl || null,
  };
}

function buildEmailBlastHtml(event, venue, subject, body, fbShare = {}) {
  const venueName = venue?.name || 'San Antonio Venue';
  const eventDate = event.date
    ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD';
  const fbEventUrl = fbShare.eventUrl || '';
  const fbQrUrl = fbShare.qrImageUrl || '';
  const safeBody = normalizePlainText(body || '', 12000);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(subject || event.title || 'Event Announcement')}</title>
  <style>
    body{font-family:Inter,Helvetica,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5}
    .container{max-width:600px;margin:0 auto;background:#fff}
    .header{background:#0d1b2a;color:#c8a45e;padding:30px;text-align:center}
    .header h1{margin:0;font-size:24px;color:#c8a45e}
    .body{padding:30px;white-space:pre-line}
    .event-card{background:#faf8f3;border-left:4px solid #c8a45e;padding:20px;margin:20px 0;border-radius:4px}
    .cta{display:inline-block;background:#c8a45e;color:#0d1b2a;padding:14px 28px;text-decoration:none;font-weight:bold;border-radius:6px;margin:20px 0}
    .fb-share{margin-top:20px;padding:14px;background:#faf8f3;border:1px solid #e6e1d5;border-radius:6px;text-align:center}
    .fb-share img{width:170px;height:170px;border:1px solid #ddd;background:#fff}
    .footer{background:#0d1b2a;color:#888;padding:20px;text-align:center;font-size:12px}
    .footer a{color:#c8a45e}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(event.title || 'Event')}</h1>
      <p style="color:#aaa;margin:5px 0 0">Presented by Good Creative Media</p>
    </div>
    <div class="body">
      <div class="event-card">
        <strong>📅 ${escapeHtml(eventDate)}${event.time ? ' · ' + escapeHtml(event.time) : ''}</strong><br>
        <strong>📍 ${escapeHtml(venueName)}</strong>${venue?.address ? '<br>' + escapeHtml(venue.address) + ', ' + escapeHtml(venue.city || 'San Antonio') + ', ' + escapeHtml(venue.state || 'TX') : ''}
      </div>
      ${escapeHtml(safeBody)}
      ${event.ticketLink ? `<p style="text-align:center"><a href="${escapeHtml(event.ticketLink)}" class="cta">Get Tickets</a></p>` : ''}
      ${fbEventUrl ? `<div class="fb-share"><p style="margin:0 0 8px 0"><strong>Facebook Event</strong></p><p style="margin:0 0 10px 0"><a href="${escapeHtml(fbEventUrl)}">${escapeHtml(fbEventUrl)}</a></p>${fbQrUrl ? `<img src="${escapeHtml(fbQrUrl)}" alt="Facebook Event QR Code" />` : ''}</div>` : ''}
    </div>
    <div class="footer">
      <p>Good Creative Media · San Antonio, TX<br><a href="https://goodcreativemedia.com">goodcreativemedia.com</a></p>
      <p style="font-size:10px">You opted in to event announcements.</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendSMS({ event, content, recipients }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    return { success: false, error: 'I need Twilio credentials first. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in Vercel, then I can text everyone.' };
  }

  const message = content?.smsText || (typeof content === 'string' ? content : event.title);
  const { data: smsUsers } = await supabase.from('profiles').select('phone').not('phone', 'is', null).eq('sms_opt_in', true);
  const phones = recipients || smsUsers?.map(u => u.phone).filter(Boolean) || [];
  if (phones.length === 0) {
    return { success: false, error: 'I do not have any opted-in SMS recipients yet. Have people add a phone number and opt in, then I can send the text blast.' };
  }

  let sent = 0;
  for (const phone of phones) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
        body: new URLSearchParams({ To: phone, From: from, Body: message })
      });
      const data = await res.json();
      if (data.sid) sent++;
    } catch (err) { /* continue */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return { success: sent > 0, sent, total: phones.length };
}

async function submitCalendars({ event, venue, content }) {
  const fbShare = await resolveFacebookEventShareAssets(event);
  const calendarListingBase = normalizePlainText(
    typeof content === 'string' ? content : (content?.calendarListing || content?.eventListing || ''),
    12000
  );
  const calendarListing = appendFacebookShareToListing(calendarListingBase, fbShare);
  const calendarPacket = {
    listing: calendarListing || '',
    facebookEventUrl: fbShare.eventUrl || '',
    facebookEventId: fbShare.eventId || '',
    facebookEventQrUrl: fbShare.qrImageUrl || '',
  };

  const { data, error } = await supabase.from('calendar_submissions').insert({
    event_id: event.id,
    event_data: {
      ...event,
      venue: venue?.name, address: venue?.address,
      city: venue?.city || 'San Antonio', state: venue?.state || 'TX',
      zip: venue?.zip, venuePhone: venue?.phone, venueWebsite: venue?.website,
      description: calendarListing || event?.description || event?.title || '',
      calendarListing: calendarListing || '',
      facebookEventUrl: fbShare.eventUrl || null,
      facebookEventId: fbShare.eventId || null,
      facebookEventQrUrl: fbShare.qrImageUrl || null,
      calendarPacket,
    },
    platforms: ['do210', 'tpr'],  // Auto-submittable platforms (SA Current + Evvnt are Cloudflare-blocked → use wizards)
    status: 'pending',
    created_at: new Date().toISOString()
  }).select().single();
  if (error) throw new Error(`I could not queue those calendar submissions yet: ${error.message}`);
  return {
    success: true,
    message: 'Perfect. I queued Do210 + TPR automatically. For SA Current + Evvnt, use the Composer wizards and I will keep everything aligned.',
    submissionId: data.id,
    calendarListing,
    facebookEventUrl: fbShare.eventUrl || null,
    facebookEventQrUrl: fbShare.qrImageUrl || null,
  };
}

const STAGE_CUE_DEPARTMENTS = ['STAGE', 'LX', 'AUDIO', 'VIDEO', 'DECK', 'FLY', 'FOH'];

const DEFAULT_STAGE_WORKFLOW_TEMPLATE = [
  {
    id: 'email_intake',
    what: 'Receive and log production update emails',
    when: 'As emails arrive during pre-production and show week',
    how: 'Ingest via email intake panel or Zapier webhook and log into run-of-show inbox.',
    owner: 'Production Stage Manager',
    ownerRole: 'Production Stage Manager',
    status: 'not_started',
  },
  {
    id: 'intake_validation',
    what: 'Validate parsed data (who/what/when/where) from email',
    when: 'Immediately after each intake',
    how: 'Stage management verifies mapped cues, staffing, and production notes before downstream use.',
    owner: 'Production Stage Manager',
    ownerRole: 'Production Stage Manager',
    status: 'not_started',
  },
  {
    id: 'staffing_confirm',
    what: 'Substantiate employee staffing and call times',
    when: 'Daily after rehearsal report',
    how: 'Confirm assignees for stage, tech, deck, and press; resolve any unfilled roles.',
    owner: 'Company Manager',
    ownerRole: 'Company Manager',
    status: 'not_started',
  },
  {
    id: 'technical_sync',
    what: 'Sync cue execution plan with lighting/audio/deck departments',
    when: 'Before and during tech rehearsals',
    how: 'Tag cues by department, track standby/go/executed state, and mark blocked technical dependencies.',
    owner: 'Technical Director',
    ownerRole: 'Technical Director',
    status: 'not_started',
  },
  {
    id: 'run_of_show_lock',
    what: 'Lock run of show for performance call',
    when: 'No later than 12 hours before show call',
    how: 'Finalize cue order, assignees, and critical notes; publish call sheet version.',
    owner: 'Production Stage Manager',
    ownerRole: 'Production Stage Manager',
    status: 'not_started',
  },
  {
    id: 'press_release_draft',
    what: 'Hand off validated event packet for press release drafting',
    when: 'After run-of-show lock',
    how: 'SM/Company Manager sends approved event packet to press coordinator for draft.',
    owner: 'Publicist / Press Coordinator',
    ownerRole: 'Publicist / Press Coordinator',
    status: 'not_started',
  },
  {
    id: 'press_release_approve',
    what: 'Approve press release content',
    when: 'Before distribution window',
    how: 'Producer/SM reviews and approves final copy for external release.',
    owner: 'Production Stage Manager',
    ownerRole: 'Production Stage Manager',
    status: 'not_started',
  },
  {
    id: 'press_release_distribute',
    what: 'Distribute press release to media list',
    when: 'Campaign launch window',
    how: 'Trigger distribution from IMC Composer and confirm media send results.',
    owner: 'Publicist / Press Coordinator',
    ownerRole: 'Publicist / Press Coordinator',
    status: 'not_started',
  },
  {
    id: 'performance_execution',
    what: 'Run live show and track deviations',
    when: 'Performance day',
    how: 'Call cues in sequence and annotate holds, late cues, and resolved incidents.',
    owner: 'Production Stage Manager',
    ownerRole: 'Production Stage Manager',
    status: 'not_started',
  },
  {
    id: 'post_show_report',
    what: 'Send post-show report and next-day updates',
    when: 'Within 12 hours after show',
    how: 'Summarize incidents, cue variances, attendance impact, and next-day changes.',
    owner: 'Production Manager',
    ownerRole: 'Production Manager',
    status: 'not_started',
  },
];

function getDefaultStageWorkflowSteps() {
  return DEFAULT_STAGE_WORKFLOW_TEMPLATE.map(step => ({ ...step }));
}

function getWebhookSecretFromPayload(payload = {}, req) {
  return firstNonEmpty(
    req?.headers?.['x-imc-webhook-secret'],
    payload?.webhookSecret,
    payload?.options?.webhookSecret
  );
}

function validateWebhookSecret(payload, req, actionLabel) {
  const expectedSecret = process.env.ZAPIER_WEBHOOK_SECRET || '';
  if (!expectedSecret) return;
  const providedSecret = getWebhookSecretFromPayload(payload, req);
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new Error(`Invalid webhook secret for ${actionLabel}`);
  }
}

function resolveStageEventId(payload = {}) {
  return firstNonEmpty(
    payload?.event?.id,
    payload?.eventId,
    payload?.content?.eventId,
    payload?.email?.eventId
  );
}

function normalizeStageDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return new Date().toISOString();
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

function normalizeStageCueTime(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = match[2] || '00';
  const ampm = match[3].toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return raw;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function inferStageCueDepartment(raw = '') {
  const value = String(raw || '').toUpperCase();
  if (!value) return 'STAGE';
  if (value.includes('LX') || value.includes('LIGHT')) return 'LX';
  if (value.includes('AUDIO') || value.includes('SOUND') || value.includes('MIC')) return 'AUDIO';
  if (value.includes('VIDEO') || value.includes('PROJECTION')) return 'VIDEO';
  if (value.includes('DECK') || value.includes('SCENE SHIFT') || value.includes('PROP')) return 'DECK';
  if (value.includes('FLY') || value.includes('RIG')) return 'FLY';
  if (value.includes('FOH') || value.includes('HOUSE') || value.includes('BOX OFFICE') || value.includes('USHER')) return 'FOH';
  return 'STAGE';
}

function normalizeStageCueRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    id: row?.id || `cue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    cueId: normalizePlainText(firstNonEmpty(row?.cueId, row?.id), 80) || `CUE-${index + 1}`,
    department: STAGE_CUE_DEPARTMENTS.includes(String(row?.department || '').toUpperCase())
      ? String(row.department).toUpperCase()
      : inferStageCueDepartment(`${row?.item || ''} ${row?.crewMember || ''}`),
    scriptRef: normalizePlainText(row?.scriptRef, 180) || '',
    environment: normalizePlainText(row?.environment, 180) || '',
    time: normalizeStageCueTime(row?.time || ''),
    duration: normalizePlainText(row?.duration, 80) || '',
    item: normalizePlainText(row?.item, 200) || 'Cue',
    crewMember: normalizePlainText(row?.crewMember, 140) || '',
    status: normalizePlainText(row?.status, 40) || 'planned',
    notes: normalizePlainText(row?.notes, 400) || '',
  }));
}

function parseStageEmailBody(body = '') {
  const lines = String(body || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const cues = [];
  let unknownLines = 0;
  const cueRegex = /^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—:]\s*([^|]+?)(?:\s*\|\s*(.+))?$/i;

  for (const line of lines) {
    const cueMatch = line.match(cueRegex);
    if (!cueMatch) {
      unknownLines++;
      continue;
    }
    cues.push({
      id: `cue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      cueId: `AUTO-${cues.length + 1}`,
      department: inferStageCueDepartment(`${cueMatch[2] || ''} ${cueMatch[3] || ''}`),
      scriptRef: '',
      environment: '',
      time: normalizeStageCueTime(cueMatch[1]),
      duration: '',
      item: normalizePlainText(cueMatch[2], 200) || 'Cue',
      crewMember: normalizePlainText(cueMatch[3], 140) || '',
      status: 'planned',
      notes: 'Imported from inbound email',
    });
  }

  const signals = {
    cuesUpdated: cues.length > 0,
    cuesLocked: /\b(final|locked)\b/i.test(body),
    callSheetSent: /\b(call sheet).*(sent|shared|distributed)\b/i.test(body),
    showCompleted: /\b(show complete|performance complete|strike complete|wrap)\b/i.test(body),
    hasBlockedLanguage: /\b(blocked|delay|issue|problem|urgent)\b/i.test(body),
  };

  return { cues, unknownLines, signals };
}

function mergeStageCues(existingRows = [], incomingRows = []) {
  const normalizedExisting = normalizeStageCueRows(existingRows);
  const normalizedIncoming = normalizeStageCueRows(incomingRows);
  const seen = new Set(
    normalizedExisting.map(row => `${String(row?.time || '').toLowerCase()}|${String(row?.item || '').toLowerCase()}`)
  );
  const merged = [...normalizedExisting];
  for (const row of normalizedIncoming) {
    const key = `${String(row?.time || '').toLowerCase()}|${String(row?.item || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

function normalizeStageWorkflowSteps(steps = []) {
  const defaults = getDefaultStageWorkflowSteps();
  const provided = Array.isArray(steps) ? steps : [];
  if (!provided.length) return defaults;

  const legacyToCurrent = {
    ingest_updates: 'email_intake',
    assign_roles: 'staffing_confirm',
    build_cues: 'technical_sync',
    publish_call_sheet: 'run_of_show_lock',
    run_live_show: 'performance_execution',
    post_show: 'post_show_report',
  };

  return defaults.map(defaultStep => {
    const direct = provided.find(step => step?.id === defaultStep.id);
    const legacyMatch = Object.entries(legacyToCurrent).find(([, mapped]) => mapped === defaultStep.id)?.[0];
    const legacy = legacyMatch ? provided.find(step => step?.id === legacyMatch) : null;
    const existing = direct || legacy;
    if (!existing) return defaultStep;
    return {
      ...defaultStep,
      ...existing,
      id: defaultStep.id,
      ownerRole: defaultStep.ownerRole,
    };
  });
}

function applySignalsToWorkflow(workflowSteps = [], signals = {}) {
  const baseSteps = normalizeStageWorkflowSteps(workflowSteps);
  return baseSteps.map(step => {
    if (step.id === 'email_intake' || step.id === 'ingest_updates') {
      return { ...step, status: 'done' };
    }
    if ((step.id === 'intake_validation') && (signals.cuesUpdated || signals.crewUpdated)) {
      return { ...step, status: step.status === 'done' ? step.status : 'in_progress' };
    }
    if ((step.id === 'staffing_confirm' || step.id === 'assign_roles') && (signals.crewUpdated || signals.cuesUpdated)) {
      return { ...step, status: step.status === 'done' ? step.status : 'in_progress' };
    }
    if ((step.id === 'technical_sync' || step.id === 'build_cues') && signals.cuesUpdated) {
      return { ...step, status: signals.cuesLocked ? 'done' : (step.status === 'done' ? step.status : 'in_progress') };
    }
    if ((step.id === 'run_of_show_lock' || step.id === 'publish_call_sheet') && (signals.callSheetSent || signals.cuesLocked)) {
      return { ...step, status: 'done' };
    }
    if (step.id === 'press_release_draft' && (signals.callSheetSent || signals.cuesLocked)) {
      return { ...step, status: step.status === 'done' ? step.status : 'handoff' };
    }
    if (step.id === 'press_release_approve' && signals.callSheetSent) {
      return { ...step, status: step.status === 'done' ? step.status : 'in_progress' };
    }
    if ((step.id === 'performance_execution' || step.id === 'run_live_show') && signals.showCompleted) {
      return { ...step, status: 'done' };
    }
    if ((step.id === 'post_show_report' || step.id === 'post_show') && signals.showCompleted) {
      return { ...step, status: step.status === 'done' ? step.status : 'in_progress' };
    }
    if (signals.hasBlockedLanguage && (
      step.id === 'intake_validation' ||
      step.id === 'staffing_confirm' ||
      step.id === 'technical_sync' ||
      step.id === 'assign_roles' ||
      step.id === 'build_cues'
    )) {
      return { ...step, status: 'blocked' };
    }
    return step;
  });
}

async function loadStageEvent(eventId) {
  const { data: eventRow, error } = await supabase
    .from('events')
    .select('id,title,date,time,venue_name,run_of_show,updated_at')
    .eq('id', eventId)
    .single();
  if (error || !eventRow) {
    throw new Error(`Event not found for id ${eventId}`);
  }
  const runOfShow = (eventRow.run_of_show && typeof eventRow.run_of_show === 'object')
    ? eventRow.run_of_show
    : {};
  return { eventRow, runOfShow };
}

async function persistStageRunOfShow(eventId, runOfShow) {
  const { error } = await supabase
    .from('events')
    .update({
      run_of_show: runOfShow,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (error) {
    throw new Error(`Failed to save stage workflow: ${error.message}`);
  }
}

async function ingestStageEmail(payload, req) {
  validateWebhookSecret(payload, req, 'ingest-stage-email');

  const eventId = resolveStageEventId(payload);
  if (!eventId) throw new Error('eventId is required for ingest-stage-email');

  const emailPayload = payload?.email || payload?.content || {};
  const body = normalizePlainText(firstNonEmpty(emailPayload?.body, payload?.body, payload?.rawEmail), 24000);
  if (!body) throw new Error('Email body is required for ingest-stage-email');

  const subject = normalizePlainText(firstNonEmpty(emailPayload?.subject, payload?.subject), 280) || '(No subject)';
  const from = normalizePlainText(firstNonEmpty(emailPayload?.from, payload?.from, payload?.sender), 280) || 'unknown@inbound.local';
  const receivedAt = normalizeStageDateTime(firstNonEmpty(emailPayload?.receivedAt, payload?.receivedAt));
  const source = normalizePlainText(firstNonEmpty(payload?.options?.source, payload?.source), 30) || 'webhook';
  const applyParsed = (payload?.options?.applyParsed ?? payload?.applyParsed ?? true) !== false;

  const { eventRow, runOfShow } = await loadStageEvent(eventId);
  const existingInbox = Array.isArray(runOfShow.emailInbox) ? runOfShow.emailInbox : [];
  const parsed = parseStageEmailBody(body);

  const entry = {
    id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source,
    from,
    subject,
    receivedAt,
    ingestedAt: new Date().toISOString(),
    summary: `Cues: ${parsed.cues.length}, Unmapped lines: ${parsed.unknownLines}`,
    preview: body.slice(0, 320),
  };

  const updatedRun = {
    ...runOfShow,
    emailInbox: [entry, ...existingInbox].slice(0, 100),
    lastEmailReceivedAt: receivedAt,
    lastUpdated: new Date().toISOString(),
  };

  if (applyParsed) {
    const existingCues = normalizeStageCueRows(runOfShow.cues || []);
    const existingWorkflow = normalizeStageWorkflowSteps(runOfShow.workflowSteps || []);
    updatedRun.cues = mergeStageCues(existingCues, parsed.cues);
    updatedRun.workflowSteps = applySignalsToWorkflow(existingWorkflow, parsed.signals);
  }

  await persistStageRunOfShow(eventId, updatedRun);

  return {
    success: true,
    eventId,
    eventTitle: eventRow.title || '',
    message: applyParsed
      ? 'Inbound stage email logged and applied to workflow.'
      : 'Inbound stage email saved to run_of_show.emailInbox',
    emailId: entry.id,
    parsed: {
      cues: parsed.cues.length,
      unknownLines: parsed.unknownLines,
    },
    applied: applyParsed,
  };
}

async function getStageWorkflow(payload, req) {
  validateWebhookSecret(payload, req, 'get-stage-workflow');

  const eventId = resolveStageEventId(payload);
  if (!eventId) throw new Error('eventId is required for get-stage-workflow');

  const { eventRow, runOfShow } = await loadStageEvent(eventId);
  const workflowSteps = normalizeStageWorkflowSteps(runOfShow.workflowSteps || []);
  const cues = normalizeStageCueRows(runOfShow.cues || []);
  const emailInbox = Array.isArray(runOfShow.emailInbox) ? runOfShow.emailInbox : [];
  const staffAssignments = Array.isArray(runOfShow.staffAssignments) ? runOfShow.staffAssignments : [];
  const techChecklist = Array.isArray(runOfShow.techChecklist) ? runOfShow.techChecklist : [];

  return {
    success: true,
    event: {
      id: eventRow.id,
      title: eventRow.title || '',
      date: eventRow.date || '',
      time: eventRow.time || '',
      venue: eventRow.venue_name || '',
      updatedAt: eventRow.updated_at || null,
    },
    workflow: {
      workflowSteps,
      cues,
      staffAssignments,
      techChecklist,
      emailInbox,
      lastEmailReceivedAt: runOfShow.lastEmailReceivedAt || null,
      lastUpdated: runOfShow.lastUpdated || null,
    },
  };
}

async function setStageWorkflow(payload, req) {
  validateWebhookSecret(payload, req, 'set-stage-workflow');

  const eventId = resolveStageEventId(payload);
  if (!eventId) throw new Error('eventId is required for set-stage-workflow');

  const { eventRow, runOfShow } = await loadStageEvent(eventId);
  const stagePayload = payload?.runOfShow || payload?.content || {};
  const options = payload?.options || {};

  let nextWorkflow = normalizeStageWorkflowSteps(runOfShow.workflowSteps || []);
  if (Array.isArray(stagePayload.workflowSteps)) {
    nextWorkflow = normalizeStageWorkflowSteps(stagePayload.workflowSteps);
  }

  if (Array.isArray(stagePayload.statusUpdates)) {
    const statusById = new Map(stagePayload.statusUpdates
      .filter(item => item && item.id)
      .map(item => [String(item.id), String(item.status || '')]));
    nextWorkflow = nextWorkflow.map(step => (
      statusById.has(String(step.id))
        ? { ...step, status: statusById.get(String(step.id)) || step.status }
        : step
    ));
  }

  const existingCues = normalizeStageCueRows(runOfShow.cues || []);
  let nextCues = existingCues;
  if (Array.isArray(stagePayload.cues)) {
    const incomingCues = normalizeStageCueRows(stagePayload.cues);
    nextCues = options.replaceCues ? incomingCues : mergeStageCues(existingCues, incomingCues);
  }

  const nextStaffAssignments = Array.isArray(stagePayload.staffAssignments)
    ? stagePayload.staffAssignments
    : (Array.isArray(runOfShow.staffAssignments) ? runOfShow.staffAssignments : []);
  const nextTechChecklist = Array.isArray(stagePayload.techChecklist)
    ? stagePayload.techChecklist
    : (Array.isArray(runOfShow.techChecklist) ? runOfShow.techChecklist : []);

  const existingInbox = Array.isArray(runOfShow.emailInbox) ? runOfShow.emailInbox : [];
  const inboxAppend = Array.isArray(stagePayload.emailInboxAppend)
    ? stagePayload.emailInboxAppend
    : (stagePayload.emailInboxAppend ? [stagePayload.emailInboxAppend] : []);
  const normalizedAppend = inboxAppend.map(item => ({
    id: item?.id || `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source: normalizePlainText(item?.source, 30) || 'webhook',
    from: normalizePlainText(item?.from, 280) || 'unknown@inbound.local',
    subject: normalizePlainText(item?.subject, 280) || '(No subject)',
    receivedAt: normalizeStageDateTime(item?.receivedAt),
    ingestedAt: normalizeStageDateTime(item?.ingestedAt),
    summary: normalizePlainText(item?.summary, 500) || '',
    preview: normalizePlainText(item?.preview, 500) || '',
  }));

  const updatedRun = {
    ...runOfShow,
    workflowSteps: nextWorkflow,
    cues: nextCues,
    staffAssignments: nextStaffAssignments,
    techChecklist: nextTechChecklist,
    emailInbox: [...normalizedAppend, ...existingInbox].slice(0, 100),
    lastUpdated: new Date().toISOString(),
  };

  if (normalizedAppend[0]?.receivedAt) {
    updatedRun.lastEmailReceivedAt = normalizedAppend[0].receivedAt;
  } else if (stagePayload.lastEmailReceivedAt) {
    updatedRun.lastEmailReceivedAt = normalizeStageDateTime(stagePayload.lastEmailReceivedAt);
  }

  await persistStageRunOfShow(eventId, updatedRun);

  return {
    success: true,
    eventId,
    eventTitle: eventRow.title || '',
    message: 'Stage workflow updated',
    counts: {
      workflowSteps: Array.isArray(updatedRun.workflowSteps) ? updatedRun.workflowSteps.length : 0,
      cues: Array.isArray(updatedRun.cues) ? updatedRun.cues.length : 0,
      staffAssignments: Array.isArray(updatedRun.staffAssignments) ? updatedRun.staffAssignments.length : 0,
      techChecklist: Array.isArray(updatedRun.techChecklist) ? updatedRun.techChecklist.length : 0,
      emailInbox: Array.isArray(updatedRun.emailInbox) ? updatedRun.emailInbox.length : 0,
    },
  };
}

function isMissingRelationError(error) {
  const code = String(error?.code || '').trim().toUpperCase();
  const message = String(error?.message || '');
  return code === '42P01'
    || code === 'PGRST205'
    || (/PGRST2\d{2}/.test(code) && /schema cache|table/i.test(message))
    || /relation .+ does not exist/i.test(message)
    || /could not find the table .* in the schema cache/i.test(message);
}

function isMissingConflictTargetError(error) {
  return error?.code === '42P10' || /no unique or exclusion constraint matching the on conflict specification/i.test(error?.message || '');
}

async function resilientServerUpdate(table, updates, eqCol, eqVal) {
  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq(eqCol, eqVal)
    .select('*')
    .single();

  if (error && error.code === '42703') {
    const message = String(error.message || '');
    const match = message.match(/column\s+\w+\.(\w+)\s+does not exist/i)
      || message.match(/column\s+"?(\w+)"?\s+of relation/i)
      || message.match(/column\s+"?(\w+)"?\s+does not exist/i);
    const badColumn = match?.[1] || '';
    if (badColumn && Object.prototype.hasOwnProperty.call(updates, badColumn)) {
      const cleaned = { ...updates };
      delete cleaned[badColumn];
      if (!Object.keys(cleaned).length) throw error;
      return resilientServerUpdate(table, cleaned, eqCol, eqVal);
    }
  }

  if (error) throw error;
  return data;
}

function ensureUserId(payload = {}) {
  const userId = payload.userId || payload.user_id || payload.event?.user_id || payload.showConfiguration?.user_id;
  if (!userId) {
    throw new Error('Missing userId for production action.');
  }
  return userId;
}

function toSlug(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'stage-plot';
}

function splitLine(line = '', max = 94) {
  const text = String(line || '').trim();
  if (!text) return [];
  if (text.length <= max) return [text];
  const words = text.split(' ');
  const out = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max) {
      if (current) out.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

function escapePdfText(value = '') {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildSimplePdfBuffer(title = 'Stage Plot', lines = []) {
  const wrapped = [title, ...lines]
    .flatMap(line => splitLine(line))
    .filter(Boolean)
    .slice(0, 280);

  let y = 770;
  let content = 'BT\n';
  wrapped.forEach((line, idx) => {
    if (y < 36) return;
    const size = idx === 0 ? 14 : (line.startsWith('## ') ? 12 : 10);
    const text = line.startsWith('## ') ? line.slice(3) : line;
    content += `/F1 ${size} Tf\n1 0 0 1 40 ${y} Tm (${escapePdfText(text)}) Tj\n`;
    y -= size + 4;
  });
  content += 'ET\n';

  const objects = [
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
  ];

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(body, 'utf8');
    body += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(body, 'utf8');
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body, 'utf8');
}

function listToSummary(label, rows = [], mapper) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return [`## ${label}`, 'None specified', ''];
  const lines = [`## ${label}`];
  safeRows.forEach((row, idx) => {
    lines.push(`${idx + 1}. ${mapper(row)}`);
  });
  lines.push('');
  return lines;
}

function buildProductionPdfLines(payload = {}) {
  const event = payload.event || {};
  const zone = payload.zone || {};
  const showConfig = payload.showConfiguration || {};
  const contacts = Array.isArray(payload.contacts) ? payload.contacts : (showConfig.show_contacts || event.show_contacts || []);
  const layout = showConfig.stage_plot_layout || payload.stagePlotLayout || {};
  const layoutItems = Array.isArray(layout.items) ? layout.items : [];

  const lines = [
    `Generated: ${new Date().toLocaleString('en-US')}`,
    '',
    '## Event',
    `Title: ${event.title || 'Untitled Event'}`,
    `Date: ${event.date || 'TBD'} ${event.time || ''}`.trim(),
    `Venue: ${event.venue || event.venue_name || zone.venue_name || 'Venue TBD'}`,
    `Zone: ${zone.name || event.performanceZoneName || event.performance_zone_name || 'Zone TBD'}`,
    `Booking Window: ${event.bookingStartAt || event.booking_start_at || 'TBD'} to ${event.bookingEndAt || event.booking_end_at || 'TBD'}`,
    '',
    '## Stage Plot',
    `Grid: ${layout.width || 24}w x ${layout.depth || 16}d`,
    `Items: ${layoutItems.length}`,
    ...(layoutItems.slice(0, 80).map(item => (
      `- ${item.label || item.type || 'item'} @ (${item.x ?? 0},${item.y ?? 0}) size ${item.w || 1}x${item.h || 1} rot ${item.rotation || 0}`
    ))),
    '',
    ...(showConfig.plot_summary ? ['## Plot Summary', showConfig.plot_summary, ''] : []),
  ];

  lines.push(...listToSummary('Input List', showConfig.input_list, row => (
    `${row.label || row.source || 'Input'} | source: ${row.source || 'TBD'} | qty: ${row.quantity || 1} ${row.notes ? `| ${row.notes}` : ''}`
  )));
  lines.push(...listToSummary('Patch List', showConfig.patch_list, row => (
    `ch ${row.channel || '?'} ${row.source || 'source'} -> ${row.destination || 'destination'} ${row.notes ? `| ${row.notes}` : ''}`
  )));
  lines.push(...listToSummary('Monitor Plan', showConfig.monitor_plan, row => (
    `${row.name || 'Mix'} | channels: ${row.channels || 'TBD'} | type: ${row.type || 'wedge'} ${row.notes ? `| ${row.notes}` : ''}`
  )));
  lines.push(...listToSummary('Backline', showConfig.backline, row => (
    `${row.label || 'Item'} x${row.quantity || 1} (${row.provider || 'tbd'}) ${row.notes ? `| ${row.notes}` : ''}`
  )));
  lines.push(...listToSummary('Power', showConfig.power_plan, row => (
    `${row.label || 'Drop'} @ ${row.location || 'TBD'} ${row.voltage ? `| ${row.voltage}` : ''} ${row.provider ? `| ${row.provider}` : ''} ${row.notes ? `| ${row.notes}` : ''}`.trim()
  )));
  lines.push(...listToSummary('Lighting', showConfig.lighting_plan, row => (
    `${row.label || 'Lighting item'} x${row.quantity || 1} (${row.provider || 'tbd'}) ${row.notes ? `| ${row.notes}` : ''}`
  )));

  lines.push('## Contacts');
  if (!contacts.length) {
    lines.push('No show contacts provided.');
  } else {
    contacts.slice(0, 40).forEach((contact, idx) => {
      lines.push(`${idx + 1}. ${contact.name || 'TBD'} | ${contact.role || contact.title || 'Contact'} | ${contact.phone || ''} ${contact.email ? `| ${contact.email}` : ''}${contact.isPrimary ? ' | PRIMARY' : ''}`);
    });
  }
  return lines;
}

async function getProductionData(payload = {}) {
  const userId = ensureUserId(payload);
  const [zonesRes, configsRes, docsRes] = await Promise.all([
    supabase.from('performance_zones').select('*').eq('user_id', userId).eq('is_active', true).order('name', { ascending: true }),
    supabase.from('show_configurations').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
    supabase.from('stage_plot_documents').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(100),
  ]);

  if (zonesRes.error && !isMissingRelationError(zonesRes.error)) throw zonesRes.error;
  if (configsRes.error && !isMissingRelationError(configsRes.error)) throw configsRes.error;
  if (docsRes.error && !isMissingRelationError(docsRes.error)) throw docsRes.error;

  return {
    zones: zonesRes.data || [],
    showConfigurations: configsRes.data || [],
    stagePlotDocuments: docsRes.data || [],
  };
}

async function upsertPerformanceZone(payload = {}) {
  const userId = ensureUserId(payload);
  const zone = payload.zone || {};
  if (!zone.name) throw new Error('Zone name is required.');
  const zoneData = {
    user_id: userId,
    name: normalizePlainText(zone.name, 200),
    zone_type: normalizePlainText(zone.zone_type || zone.zoneType || 'club_stage', 80),
    venue_profile_id: zone.venue_profile_id || zone.venueProfileId || null,
    width_ft: zone.width_ft ?? zone.widthFt ?? null,
    depth_ft: zone.depth_ft ?? zone.depthFt ?? null,
    ceiling_height_ft: zone.ceiling_height_ft ?? zone.ceilingHeightFt ?? null,
    capacity: zone.capacity ?? null,
    fixed_equipment: zone.fixed_equipment || zone.fixedEquipment || [],
    power_spec: zone.power_spec || zone.powerSpec || {},
    restrictions: zone.restrictions || '',
    load_in_notes: zone.load_in_notes || zone.loadInNotes || '',
    default_contacts: zone.default_contacts || zone.defaultContacts || [],
    is_active: zone.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  if (zone.id) {
    const { data, error } = await supabase
      .from('performance_zones')
      .update(zoneData)
      .eq('id', zone.id)
      .select('*')
      .single();
    if (error) throw error;
    return { zone: data };
  }

  const { data, error } = await supabase
    .from('performance_zones')
    .insert({ ...zoneData, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { zone: data };
}

async function archivePerformanceZone(payload = {}) {
  const zoneId = payload.zoneId || payload.id || payload.zone?.id;
  if (!zoneId) throw new Error('Missing zoneId.');
  const { error } = await supabase
    .from('performance_zones')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', zoneId);
  if (error) throw error;
  return { success: true, zoneId };
}

async function upsertShowConfiguration(payload = {}) {
  const userId = ensureUserId(payload);
  const config = payload.showConfiguration || payload.config || {};
  if (!config.name) throw new Error('Show configuration name is required.');
  const configData = {
    user_id: userId,
    participant_profile_id: config.participant_profile_id || config.participantProfileId || null,
    name: normalizePlainText(config.name, 200),
    show_type: normalizePlainText(config.show_type || config.showType || 'band', 80),
    template_key: normalizePlainText(config.template_key || config.templateKey || '', 120),
    member_count: config.member_count ?? config.memberCount ?? null,
    summary: normalizePlainText(config.summary || '', 2000),
    equipment: config.equipment || [],
    input_list: config.input_list || config.inputList || [],
    patch_list: config.patch_list || config.patchList || [],
    monitor_plan: config.monitor_plan || config.monitorPlan || [],
    backline: config.backline || [],
    lighting_plan: config.lighting_plan || config.lightingPlan || [],
    video_plan: config.video_plan || config.videoPlan || [],
    power_plan: config.power_plan || config.powerPlan || [],
    stage_management: config.stage_management || config.stageManagement || [],
    stage_plot_layout: config.stage_plot_layout || config.stagePlotLayout || {},
    plot_summary: config.plot_summary || config.plotSummary || '',
    is_template: !!config.is_template || !!config.isTemplate,
    updated_at: new Date().toISOString(),
  };

  if (config.id) {
    const { data, error } = await supabase
      .from('show_configurations')
      .update(configData)
      .eq('id', config.id)
      .select('*')
      .single();
    if (error) throw error;
    return { showConfiguration: data };
  }

  const { data, error } = await supabase
    .from('show_configurations')
    .insert({ ...configData, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { showConfiguration: data };
}

async function deleteShowConfiguration(payload = {}) {
  const configId = payload.configId || payload.id || payload.showConfiguration?.id;
  if (!configId) throw new Error('Missing configId.');
  const { error } = await supabase
    .from('show_configurations')
    .delete()
    .eq('id', configId);
  if (error) throw error;
  return { success: true, configId };
}

async function assignBookingProduction(payload = {}) {
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId.');

  const zoneId = payload.zoneId || payload.performanceZoneId || payload.event?.performanceZoneId || null;
  const bookingStartAt = payload.bookingStartAt || payload.event?.bookingStartAt || null;
  const bookingEndAt = payload.bookingEndAt || payload.event?.bookingEndAt || null;

  if (zoneId && bookingStartAt && bookingEndAt) {
    const { data: conflicts, error: conflictsError } = await supabase
      .from('events')
      .select('id, title, booking_start_at, booking_end_at')
      .eq('performance_zone_id', zoneId)
      .neq('id', eventId)
      .lt('booking_start_at', bookingEndAt)
      .gt('booking_end_at', bookingStartAt)
      .limit(6);
    if (conflictsError) throw conflictsError;
    if (conflicts?.length) {
      const preview = conflicts.slice(0, 3).map(row => `${row.title || 'Event'} (${row.booking_start_at} - ${row.booking_end_at})`).join('; ');
      throw new Error(`Zone conflict: ${preview}`);
    }
  }

  const updates = {
    performance_zone_id: zoneId,
    performance_zone_name: payload.zoneName || payload.performanceZoneName || payload.event?.performanceZoneName || '',
    booking_start_at: bookingStartAt,
    booking_end_at: bookingEndAt,
    show_configuration_id: payload.showConfigurationId || payload.event?.showConfigurationId || null,
    show_contacts: payload.showContacts || payload.event?.showContacts || [],
    stage_plot_document_id: payload.stagePlotDocumentId || payload.event?.stagePlotDocumentId || null,
    booking_status: payload.bookingStatus || payload.event?.bookingStatus || 'draft',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select('*')
    .single();
  if (error) throw error;
  return { event: data };
}

async function upsertStagePlotDocument(payload = {}) {
  const userId = ensureUserId(payload);
  const document = payload.document || payload.stagePlotDocument || {};
  const shareToken = document.share_token || document.shareToken
    || createHash('sha256').update(`${Date.now()}-${Math.random()}-${userId}`).digest('hex').slice(0, 20);

  const docData = {
    user_id: userId,
    event_id: document.event_id || document.eventId || null,
    show_configuration_id: document.show_configuration_id || document.showConfigurationId || null,
    title: normalizePlainText(document.title || 'Stage Plot', 220),
    content: document.content || {},
    pdf_base64: document.pdf_base64 || document.pdfBase64 || null,
    pdf_filename: document.pdf_filename || document.pdfFileName || null,
    share_token: shareToken,
    updated_at: new Date().toISOString(),
  };

  if (document.id) {
    const { data, error } = await supabase
      .from('stage_plot_documents')
      .update(docData)
      .eq('id', document.id)
      .select('*')
      .single();
    if (error) throw error;
    return { stagePlotDocument: data };
  }

  const { data, error } = await supabase
    .from('stage_plot_documents')
    .insert({ ...docData, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { stagePlotDocument: data };
}

async function exportStagePlotPdf(payload = {}) {
  const event = payload.event || {};
  const zone = payload.zone || {};
  const showConfiguration = payload.showConfiguration || {};
  const options = payload.options || {};
  const titleBase = showConfiguration.name || event.title || 'Stage Plot';
  const packetTitle = normalizePlainText(`${titleBase} Production Packet`, 180);
  const lines = buildProductionPdfLines({
    ...payload,
    event,
    zone,
    showConfiguration,
    contacts: payload.contacts || payload.showContacts || event.showContacts || [],
  });
  const pdfBuffer = buildSimplePdfBuffer(packetTitle, lines);
  const pdfBase64 = pdfBuffer.toString('base64');
  const fileName = `${toSlug(packetTitle)}.pdf`;
  const shareToken = options.includeShareToken
    ? createHash('sha256').update(`${Date.now()}-${Math.random()}-${packetTitle}`).digest('hex').slice(0, 20)
    : null;

  let documentId = null;
  if (options.persist !== false) {
    const userId = ensureUserId(payload);
    const { data: doc, error: docError } = await supabase
      .from('stage_plot_documents')
      .insert({
        user_id: userId,
        event_id: event.id || null,
        show_configuration_id: showConfiguration.id || null,
        title: packetTitle,
        content: {
          event,
          zone,
          showConfiguration,
          lines,
        },
        pdf_base64: pdfBase64,
        pdf_filename: fileName,
        share_token: shareToken,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (docError && !isMissingRelationError(docError)) throw docError;
    documentId = doc?.id || null;

    if (documentId && event.id) {
      const { error: updateEventError } = await supabase
        .from('events')
        .update({ stage_plot_document_id: documentId, updated_at: new Date().toISOString() })
        .eq('id', event.id);
      if (updateEventError) throw updateEventError;
    }
  }

  return {
    success: true,
    fileName,
    pdfBase64,
    downloadUrl: `data:application/pdf;base64,${pdfBase64}`,
    shareToken: shareToken || null,
    documentId,
    generatedAt: new Date().toISOString(),
  };
}

async function searchVenues(payload = {}) {
  const query = normalizePlainText(payload.query || payload.input || '', 160);
  const maxResults = Math.min(Math.max(Number(payload.maxResults) || 8, 1), 15);
  if (!query || query.length < 2) {
    return { suggestions: [], source: 'none' };
  }

  const userId = payload.userId || payload.user_id || null;
  const localSuggestions = await searchLocalVenueProfiles(query, userId, maxResults);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { suggestions: localSuggestions, source: 'local', warning: 'Google Places key not configured' };
  }

  const params = new URLSearchParams({
    input: query,
    types: 'establishment',
    components: 'country:us',
    key: apiKey,
  });
  if (payload.sessionToken) {
    params.set('sessiontoken', normalizePlainText(payload.sessionToken, 120));
  }

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
  const data = await response.json().catch(() => ({}));
  const status = data.status || 'UNKNOWN_ERROR';
  if (status !== 'OK' && status !== 'ZERO_RESULTS') {
    return {
      suggestions: localSuggestions,
      source: 'local',
      warning: `Google Places autocomplete error: ${data.error_message || status}`,
    };
  }

  const googleSuggestions = (data.predictions || []).slice(0, maxResults).map((prediction) => ({
    id: prediction.place_id,
    placeId: prediction.place_id,
    label: prediction.description || '',
    mainText: prediction.structured_formatting?.main_text || prediction.description || '',
    secondaryText: prediction.structured_formatting?.secondary_text || '',
    source: 'google',
  }));

  const combined = [];
  const seen = new Set();
  for (const suggestion of [...googleSuggestions, ...localSuggestions]) {
    const key = `${String(suggestion.placeId || '')}|${String(suggestion.label || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(suggestion);
  }

  return {
    suggestions: combined.slice(0, maxResults),
    source: googleSuggestions.length ? 'google+local' : 'local',
  };
}

async function getVenueDetails(payload = {}) {
  const placeId = normalizePlainText(payload.placeId || payload.id || '', 220);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  let venue = null;
  let source = 'local';
  let warning = '';
  if (apiKey && placeId) {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,url,address_component,geometry,types',
      key: apiKey,
    });
    if (payload.sessionToken) {
      params.set('sessiontoken', normalizePlainText(payload.sessionToken, 120));
    }
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
    const data = await response.json().catch(() => ({}));
    const status = data.status || 'UNKNOWN_ERROR';
    if (status === 'OK' && data.result) {
      venue = mapGooglePlaceDetailsToVenue(data.result);
      source = 'google';
    } else if (status !== 'ZERO_RESULTS') {
      warning = `Google Place Details error: ${data.error_message || status}`;
    }
  } else if (!apiKey) {
    warning = 'Google Places key not configured';
  }

  if (!venue) {
    const fallback = await getLocalVenueDetails(payload);
    if (fallback) {
      venue = fallback;
      source = 'local';
    }
  }

  if (!venue) {
    throw new Error('Venue details not found');
  }

  const fetchSocials = payload.fetchSocials !== false;
  const socialLinks = fetchSocials ? await extractVenueWebsiteSocials(venue.website || '') : {};

  return {
    venue: {
      ...venue,
      socialLinks,
    },
    source,
    warning: warning || undefined,
  };
}

async function getStaffingRequests(payload = {}) {
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for staffing requests.');

  let query = supabase
    .from('staffing_requests')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (payload.userId || payload.user_id) {
    query = query.eq('user_id', payload.userId || payload.user_id);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      return { requests: [], warning: 'staffing_requests table missing; run latest SQL migration.' };
    }
    throw error;
  }
  return { requests: data || [] };
}

async function createStaffingRequest(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for staffing request.');

  const request = payload.request || payload.staffingRequest || {};
  const row = {
    user_id: userId,
    event_id: eventId,
    role: normalizePlainText(request.role || '', 140),
    department: normalizePlainText(request.department || '', 140),
    quantity: Number.isFinite(Number(request.quantity)) ? Math.max(1, Number(request.quantity)) : 1,
    starts_at: normalizeStageDateTime(request.startsAt || request.starts_at) || null,
    ends_at: normalizeStageDateTime(request.endsAt || request.ends_at) || null,
    rate_type: normalizePlainText(request.rateType || request.rate_type || 'flat', 32) || 'flat',
    rate_amount: Number.isFinite(Number(request.rateAmount || request.rate_amount))
      ? Number(request.rateAmount || request.rate_amount)
      : null,
    currency: normalizePlainText(request.currency || 'USD', 8) || 'USD',
    notes: normalizePlainText(request.notes || '', 3000),
    destination_type: normalizePlainText(request.destinationType || request.destination_type || 'manual', 40) || 'manual',
    destination_value: normalizePlainText(request.destinationValue || request.destination_value || '', 500),
    status: normalizePlainText(request.status || 'draft', 32) || 'draft',
    dispatch_result: request.dispatch_result || {},
    metadata: request.metadata || {},
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  if (!row.role) throw new Error('Staffing request role is required.');

  const { data, error } = await supabase
    .from('staffing_requests')
    .insert(row)
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('staffing_requests table missing. Run latest SQL migration first.');
    }
    throw error;
  }

  let saved = data;
  let dispatch = null;
  if (payload.sendNow) {
    dispatch = await dispatchStaffingRequest(saved, payload);
    const status = dispatch.success ? (dispatch.queued ? 'queued' : 'sent') : 'failed';
    const { data: updated, error: updateError } = await supabase
      .from('staffing_requests')
      .update({
        status,
        dispatch_result: dispatch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saved.id)
      .select('*')
      .single();
    if (updateError) throw updateError;
    saved = updated;
  }

  return { request: saved, dispatch };
}

async function updateStaffingRequest(payload = {}) {
  const requestId = payload.requestId || payload.id || payload.request?.id;
  if (!requestId) throw new Error('Missing requestId.');

  const updates = payload.updates || payload.request || {};
  const next = {
    updated_at: new Date().toISOString(),
  };
  if (updates.role !== undefined) next.role = normalizePlainText(updates.role, 140);
  if (updates.department !== undefined) next.department = normalizePlainText(updates.department, 140);
  if (updates.quantity !== undefined) next.quantity = Math.max(1, Number(updates.quantity) || 1);
  if (updates.startsAt !== undefined || updates.starts_at !== undefined) next.starts_at = normalizeStageDateTime(updates.startsAt || updates.starts_at) || null;
  if (updates.endsAt !== undefined || updates.ends_at !== undefined) next.ends_at = normalizeStageDateTime(updates.endsAt || updates.ends_at) || null;
  if (updates.rateType !== undefined || updates.rate_type !== undefined) next.rate_type = normalizePlainText(updates.rateType || updates.rate_type || 'flat', 32);
  if (updates.rateAmount !== undefined || updates.rate_amount !== undefined) next.rate_amount = Number.isFinite(Number(updates.rateAmount ?? updates.rate_amount)) ? Number(updates.rateAmount ?? updates.rate_amount) : null;
  if (updates.currency !== undefined) next.currency = normalizePlainText(updates.currency || 'USD', 8);
  if (updates.notes !== undefined) next.notes = normalizePlainText(updates.notes || '', 3000);
  if (updates.destinationType !== undefined || updates.destination_type !== undefined) next.destination_type = normalizePlainText(updates.destinationType || updates.destination_type || 'manual', 40);
  if (updates.destinationValue !== undefined || updates.destination_value !== undefined) next.destination_value = normalizePlainText(updates.destinationValue || updates.destination_value || '', 500);
  if (updates.status !== undefined) next.status = normalizePlainText(updates.status || '', 32);
  if (updates.dispatch_result !== undefined) next.dispatch_result = updates.dispatch_result || {};

  const { data, error } = await supabase
    .from('staffing_requests')
    .update(next)
    .eq('id', requestId)
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('staffing_requests table missing. Run latest SQL migration first.');
    }
    throw error;
  }

  let saved = data;
  let dispatch = null;
  if (payload.sendNow) {
    dispatch = await dispatchStaffingRequest(saved, payload);
    const status = dispatch.success ? (dispatch.queued ? 'queued' : 'sent') : 'failed';
    const { data: updated, error: updateError } = await supabase
      .from('staffing_requests')
      .update({
        status,
        dispatch_result: dispatch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*')
      .single();
    if (updateError) throw updateError;
    saved = updated;
  }

  return { request: saved, dispatch };
}

function normalizeStaffPayType(value, fallback = 'hourly') {
  const payType = normalizePlainText(value || fallback, 40).toLowerCase();
  return STAFF_PAY_TYPES.includes(payType) ? payType : fallback;
}

function normalizeStaffStatus(value, fallback = 'scheduled') {
  const status = normalizePlainText(value || fallback, 40).toLowerCase();
  return STAFF_ASSIGNMENT_STATUSES.includes(status) ? status : fallback;
}

function normalizeRoleCoverageInput(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => ({
      role: normalizePlainText(row?.role || row?.jobTitle || '', 160),
      requiredCount: Math.max(1, Number(row?.requiredCount || row?.required || 1) || 1),
    }))
    .filter((row) => row.role);
}

function normalizePayloadPhone(value = '') {
  const digits = normalizePhoneDigits(value);
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

async function sendTwilioMessage(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    return { success: false, error: 'I need Twilio configured before I can send staffing texts.', code: 'twilio_not_configured' };
  }
  const toPhone = normalizePayloadPhone(to);
  if (!toPhone) return { success: false, error: 'I need a destination phone number before I can send this text.', code: 'missing_phone' };
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
      body: new URLSearchParams({ To: toPhone, From: from, Body: String(body || '').slice(0, 1600) }),
    });
    const data = await response.json().catch(() => ({}));
    if (data.sid) return { success: true, sid: data.sid };
    return { success: false, error: data.message || data.error?.message || 'I could not send that Twilio message yet.', code: 'twilio_send_failed' };
  } catch (err) {
    return { success: false, error: `I hit a snag sending that Twilio message: ${err.message}`, code: 'twilio_send_failed' };
  }
}

async function getJobTitles(payload = {}) {
  const userId = payload.userId || payload.user_id || null;
  let query = supabase
    .from('job_titles')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (userId) {
    query = query.or(`user_id.is.null,user_id.eq.${userId}`);
  }
  if (payload.activeOnly !== false) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { jobTitles: [], warning: 'job_titles table missing.' };
    throw error;
  }
  return { jobTitles: data || [] };
}

async function seedJobTitles(payload = {}) {
  const existingResponse = await getJobTitles({ activeOnly: false });
  const existing = existingResponse.jobTitles || [];
  const existingSystemNames = new Set(
    existing
      .filter((row) => row.is_system)
      .map((row) => String(row.name || '').trim().toLowerCase())
  );

  const missingRows = DEFAULT_JOB_TITLES
    .filter((row) => !existingSystemNames.has(row.name.toLowerCase()))
    .map((row) => ({
      user_id: null,
      name: row.name,
      department: row.department,
      is_system: true,
      is_active: true,
      sort_order: row.sortOrder,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  if (missingRows.length) {
    const { error } = await supabase.from('job_titles').insert(missingRows);
    if (error && !isMissingRelationError(error)) throw error;
  }
  const refreshed = await getJobTitles({ userId: payload.userId || payload.user_id || null });
  return { seeded: missingRows.length, jobTitles: refreshed.jobTitles || [] };
}

async function upsertJobTitle(payload = {}) {
  const userId = ensureUserId(payload);
  const jobTitle = payload.jobTitle || payload.title || {};
  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    name: normalizePlainText(jobTitle.name || '', 180),
    department: normalizePlainText(jobTitle.department || 'production', 120) || 'production',
    is_system: false,
    is_active: jobTitle.isActive === false ? false : true,
    sort_order: Number.isFinite(Number(jobTitle.sortOrder ?? jobTitle.sort_order))
      ? Number(jobTitle.sortOrder ?? jobTitle.sort_order)
      : 999,
    updated_at: nowIso,
  };
  if (!next.name) throw new Error('Job title name is required.');

  const titleId = payload.jobTitleId || payload.id || jobTitle.id;
  if (titleId) {
    const { data, error } = await supabase
      .from('job_titles')
      .update(next)
      .eq('id', titleId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return { jobTitle: data };
  }

  const { data, error } = await supabase
    .from('job_titles')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { jobTitle: data };
}

async function deleteJobTitle(payload = {}) {
  const titleId = payload.jobTitleId || payload.id;
  const userId = payload.userId || payload.user_id;
  if (!titleId) throw new Error('Missing jobTitleId.');

  let query = supabase
    .from('job_titles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', titleId)
    .eq('is_system', false)
    .select('id');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return { removed: true, jobTitleId: titleId, affected: data?.length || 0 };
}

async function getStaffProfiles(payload = {}) {
  const userId = ensureUserId(payload);
  let query = supabase
    .from('staff_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('display_name', { ascending: true });
  if (payload.activeOnly !== false) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { staffProfiles: [], warning: 'staff_profiles table missing.' };
    throw error;
  }
  return { staffProfiles: data || [] };
}

async function parseStaffVoice(payload = {}) {
  const transcript = normalizePlainText(payload.transcript || payload.voiceText || payload.text || '', 8000);
  if (!transcript) throw new Error('Missing transcript for voice parsing.');
  const titles = await getJobTitles({ userId: payload.userId || payload.user_id || null, activeOnly: true });
  const parsed = parseVoiceStaffInput(
    transcript,
    (titles.jobTitles || []).map((row) => row.name).filter(Boolean)
  );
  return { parsed, transcript };
}

async function upsertStaffProfile(payload = {}) {
  const userId = ensureUserId(payload);
  const profile = payload.profile || payload.staffProfile || {};
  const nowIso = new Date().toISOString();
  const jobTitles = Array.isArray(profile.jobTitles || profile.job_titles)
    ? [...new Set((profile.jobTitles || profile.job_titles).map((title) => normalizePlainText(title, 180)).filter(Boolean))]
    : [];
  const firstName = normalizePlainText(profile.firstName || profile.first_name || '', 120);
  const lastName = normalizePlainText(profile.lastName || profile.last_name || '', 120);
  const displayName = normalizePlainText(profile.displayName || profile.display_name || '', 180)
    || [firstName, lastName].filter(Boolean).join(' ');

  const next = {
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    display_name: displayName,
    phone_number: normalizePlainText(profile.phoneNumber || profile.phone_number || '', 80),
    email: normalizePlainText(profile.email || '', 240),
    job_titles: jobTitles,
    primary_role: normalizePlainText(profile.primaryRole || profile.primary_role || '', 180),
    pay_type: normalizeStaffPayType(profile.payType || profile.pay_type || 'hourly'),
    default_rate: Number.isFinite(Number(profile.defaultRate ?? profile.default_rate))
      ? Number(profile.defaultRate ?? profile.default_rate)
      : null,
    supervisor_contact_id: profile.supervisorContactId || profile.supervisor_contact_id || null,
    emergency_contact: (profile.emergencyContact && typeof profile.emergencyContact === 'object')
      ? profile.emergencyContact
      : (profile.emergency_contact || {}),
    notes: normalizePlainText(profile.notes || '', 4000),
    tax_profile_link: firstValidHttpUrl(profile.taxProfileLink || profile.tax_profile_link || '') || '',
    voice_source_transcript: normalizePlainText(profile.voiceSourceTranscript || profile.voice_source_transcript || payload.transcript || '', 8000),
    is_active: profile.isActive === false ? false : true,
    metadata: (profile.metadata && typeof profile.metadata === 'object') ? profile.metadata : {},
    updated_at: nowIso,
  };

  if (!next.display_name) throw new Error('Display name is required for staff profile.');
  if (!next.phone_number) throw new Error('Phone number is required for staff profile.');

  const profileId = payload.profileId || payload.id || profile.id;
  if (profileId) {
    const { data, error } = await supabase
      .from('staff_profiles')
      .update(next)
      .eq('id', profileId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return { staffProfile: data };
  }

  const { data, error } = await supabase
    .from('staff_profiles')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { staffProfile: data };
}

async function deleteStaffProfile(payload = {}) {
  const profileId = payload.profileId || payload.id;
  const userId = payload.userId || payload.user_id;
  if (!profileId) throw new Error('Missing profileId.');

  let query = supabase
    .from('staff_profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .select('id');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return { removed: true, profileId, affected: data?.length || 0 };
}

async function getStaffAssignments(payload = {}) {
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!bookingId) throw new Error('Missing bookingId/eventId for staff assignments.');
  const userId = payload.userId || payload.user_id;

  let query = supabase
    .from('staff_assignments')
    .select('*, staff_profile:staff_profile_id(*), job_title_ref:job_title_id(*)')
    .eq('booking_id', bookingId)
    .order('start_time', { ascending: true });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { assignments: [], warning: 'staff_assignments table missing.' };
    throw error;
  }
  return { assignments: data || [] };
}

async function assertStaffAssignmentNoConflict({
  userId,
  profileId,
  assignmentId,
  startTime,
  endTime,
}) {
  let query = supabase
    .from('staff_assignments')
    .select('id, staff_profile_id, start_time, end_time, booking_id')
    .eq('staff_profile_id', profileId);
  if (userId) query = query.eq('user_id', userId);
  if (assignmentId) query = query.neq('id', assignmentId);
  const { data, error } = await query;
  if (error) throw error;
  const conflicts = findStaffAssignmentConflicts(data || [], {
    assignmentId,
    staffProfileId: profileId,
    startTime,
    endTime,
  });
  if (conflicts.length) {
    const conflict = conflicts[0];
    throw new Error(`Staff conflict: already booked ${conflict.start_time || ''} to ${conflict.end_time || ''}`);
  }
}

async function upsertStaffAssignment(payload = {}) {
  const userId = ensureUserId(payload);
  const assignment = payload.assignment || {};
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id || assignment.bookingId || assignment.booking_id;
  if (!bookingId) throw new Error('Missing bookingId/eventId for assignment.');
  const profileId = assignment.staffProfileId || assignment.staff_profile_id || payload.staffProfileId || payload.staff_profile_id;
  if (!profileId) throw new Error('Missing staffProfileId for assignment.');

  const startTime = normalizeStageDateTime(assignment.startTime || assignment.start_time);
  const endTime = normalizeStageDateTime(assignment.endTime || assignment.end_time);
  if (!startTime || !endTime) throw new Error('Start and end time are required.');
  if (new Date(endTime) <= new Date(startTime)) throw new Error('Assignment end time must be after start time.');

  const assignmentId = payload.assignmentId || payload.id || assignment.id;
  await assertStaffAssignmentNoConflict({
    userId,
    profileId,
    assignmentId,
    startTime,
    endTime,
  });

  const { data: profileRow, error: profileError } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('id', profileId)
    .single();
  if (profileError) throw profileError;

  const payType = normalizeStaffPayType(assignment.payType || assignment.pay_type || profileRow?.pay_type || 'hourly');
  const next = {
    user_id: userId,
    booking_id: bookingId,
    staff_profile_id: profileId,
    job_title_id: assignment.jobTitleId || assignment.job_title_id || null,
    job_title: normalizePlainText(
      assignment.jobTitle || assignment.job_title || profileRow?.primary_role || '',
      180
    ),
    start_time: startTime,
    end_time: endTime,
    pay_type: payType,
    pay_override: Number.isFinite(Number(assignment.payOverride ?? assignment.pay_override))
      ? Number(assignment.payOverride ?? assignment.pay_override)
      : null,
    status: normalizeStaffStatus(assignment.status || 'scheduled'),
    notes: normalizePlainText(assignment.notes || '', 4000),
    policy_acknowledged: assignment.policyAcknowledged === true || assignment.policy_acknowledged === true,
    published_at: normalizeStageDateTime(assignment.publishedAt || assignment.published_at) || null,
    confirmed_at: normalizeStageDateTime(assignment.confirmedAt || assignment.confirmed_at) || null,
    declined_at: normalizeStageDateTime(assignment.declinedAt || assignment.declined_at) || null,
    notification_log: Array.isArray(assignment.notificationLog || assignment.notification_log)
      ? (assignment.notificationLog || assignment.notification_log)
      : [],
    metadata: (assignment.metadata && typeof assignment.metadata === 'object') ? assignment.metadata : {},
    updated_at: new Date().toISOString(),
  };
  if (!next.job_title) next.job_title = 'Crew';

  let saved;
  if (assignmentId) {
    const { data, error } = await supabase
      .from('staff_assignments')
      .update(next)
      .eq('id', assignmentId)
      .eq('user_id', userId)
      .select('*, staff_profile:staff_profile_id(*), job_title_ref:job_title_id(*)')
      .single();
    if (error) throw error;
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('staff_assignments')
      .insert({ ...next, created_at: new Date().toISOString() })
      .select('*, staff_profile:staff_profile_id(*), job_title_ref:job_title_id(*)')
      .single();
    if (error) throw error;
    saved = data;
  }

  return {
    assignment: saved,
    compensation: calculateAssignmentCompensation(saved, saved?.staff_profile || profileRow || {}),
  };
}

async function deleteStaffAssignment(payload = {}) {
  const assignmentId = payload.assignmentId || payload.id;
  const userId = payload.userId || payload.user_id;
  if (!assignmentId) throw new Error('Missing assignmentId.');

  let query = supabase
    .from('staff_assignments')
    .delete()
    .eq('id', assignmentId);
  if (userId) query = query.eq('user_id', userId);
  const { error } = await query;
  if (error) throw error;
  return { removed: true, assignmentId };
}

async function bulkAssignStaffShift(payload = {}) {
  const userId = ensureUserId(payload);
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!bookingId) throw new Error('Missing bookingId/eventId for bulk assignment.');
  const staffProfileIds = Array.isArray(payload.staffProfileIds)
    ? [...new Set(payload.staffProfileIds.filter(Boolean))]
    : [];
  if (!staffProfileIds.length) throw new Error('staffProfileIds is required for bulk assignment.');

  const startTime = normalizeStageDateTime(payload.startTime || payload.start_time);
  const endTime = normalizeStageDateTime(payload.endTime || payload.end_time);
  if (!startTime || !endTime) throw new Error('Start and end times are required.');
  if (new Date(endTime) <= new Date(startTime)) throw new Error('End time must be after start time.');

  const [{ data: profileRows, error: profileError }, { data: existingRows, error: existingError }] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select('*')
      .eq('user_id', userId)
      .in('id', staffProfileIds),
    supabase
      .from('staff_assignments')
      .select('id,staff_profile_id,start_time,end_time,booking_id')
      .eq('user_id', userId)
      .in('staff_profile_id', staffProfileIds),
  ]);
  if (profileError) throw profileError;
  if (existingError) throw existingError;

  const profileMap = new Map((profileRows || []).map((row) => [row.id, row]));
  const created = [];
  const conflicts = [];

  for (const profileId of staffProfileIds) {
    const profile = profileMap.get(profileId);
    if (!profile) {
      conflicts.push({ staffProfileId: profileId, reason: 'Profile not found' });
      continue;
    }
    const rowConflicts = findStaffAssignmentConflicts(existingRows || [], {
      staffProfileId: profileId,
      startTime,
      endTime,
    });
    if (rowConflicts.length) {
      conflicts.push({
        staffProfileId: profileId,
        profileName: profile.display_name,
        reason: `Conflict with ${rowConflicts[0].start_time} - ${rowConflicts[0].end_time}`,
      });
      continue;
    }

    const assignment = await upsertStaffAssignment({
      userId,
      bookingId,
      assignment: {
        staffProfileId: profileId,
        startTime,
        endTime,
        jobTitle: payload.jobTitle || profile.primary_role || 'Crew',
        jobTitleId: payload.jobTitleId || null,
        payType: payload.payType || profile.pay_type || 'hourly',
        payOverride: payload.payOverride ?? null,
        status: payload.status || 'scheduled',
        notes: payload.notes || '',
      },
    });
    created.push(assignment.assignment);
    existingRows.push(assignment.assignment);
  }

  return {
    created,
    conflicts,
    createdCount: created.length,
    conflictCount: conflicts.length,
  };
}

async function getVenueStaffingPolicy(payload = {}) {
  const venueId = payload.venueProfileId || payload.venueId || payload.venue_profile_id || payload.venue_id;
  if (!venueId) return { policy: null };
  let query = supabase
    .from('venue_staffing_policies')
    .select('*')
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (payload.userId || payload.user_id) {
    query = query.eq('user_id', payload.userId || payload.user_id);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { policy: null, warning: 'venue_staffing_policies table missing.' };
    throw error;
  }
  return { policy: data?.[0] || null };
}

async function upsertVenueStaffingPolicy(payload = {}) {
  const userId = ensureUserId(payload);
  const policy = payload.policy || {};
  const venueId = payload.venueProfileId || payload.venueId || payload.venue_profile_id || payload.venue_id || policy.venueId || policy.venue_id;
  if (!venueId) throw new Error('Missing venueProfileId for staffing policy.');
  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    venue_id: venueId,
    call_in_policy: normalizePlainText(policy.callInPolicy || policy.call_in_policy || '', 4000),
    notice_hours: Math.max(0, Number(policy.noticeHours || policy.notice_hours || 4) || 4),
    supervisor_name: normalizePlainText(policy.supervisorName || policy.supervisor_name || '', 180),
    supervisor_phone: normalizePlainText(policy.supervisorPhone || policy.supervisor_phone || '', 80),
    supervisor_email: normalizePlainText(policy.supervisorEmail || policy.supervisor_email || '', 240),
    is_active: policy.isActive === false ? false : true,
    updated_at: nowIso,
  };
  const policyId = payload.policyId || payload.id || policy.id;
  if (policyId) {
    const { data, error } = await supabase
      .from('venue_staffing_policies')
      .update(next)
      .eq('id', policyId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return { policy: data };
  }
  const { data, error } = await supabase
    .from('venue_staffing_policies')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { policy: data };
}

async function publishStaffingSchedule(payload = {}) {
  const userId = ensureUserId(payload);
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!bookingId) throw new Error('Missing bookingId/eventId for publish.');

  const event = payload.event || await getEventRow(bookingId) || {};
  const venueName = payload.venueName || event.venue_name || event.venue || '';
  const { assignments } = await getStaffAssignments({ userId, bookingId });
  if (!assignments?.length) {
    return {
      published: false,
      sentSms: 0,
      sentEmail: 0,
      errors: ['No staffing assignments to publish.'],
      fallbackMessages: [],
    };
  }

  const staffProfileIds = [...new Set(assignments.map((row) => row.staff_profile_id).filter(Boolean))];
  const emergencyResponse = await getEmergencyContacts({
    userId,
    staffProfileIds,
  });
  const emergencyValidation = validateEmergencyContacts(
    assignments,
    emergencyResponse?.contacts || [],
    { allowOverride: payload.overrideEmergencyGate === true }
  );
  if (!emergencyValidation.ok) {
    return {
      published: false,
      sentSms: 0,
      sentEmail: 0,
      errors: ['Missing primary emergency contact for one or more assigned staff.'],
      missingEmergencyContacts: emergencyValidation.missing,
      fallbackMessages: [],
    };
  }

  const policyRes = event.venue_profile_id
    ? await getVenueStaffingPolicy({ userId, venueProfileId: event.venue_profile_id })
    : { policy: null };
  const policy = payload.policy || policyRes.policy || {};

  const nowIso = new Date().toISOString();
  const notificationRows = [];
  const fallbackMessages = [];
  let sentSms = 0;
  let sentEmail = 0;
  const errors = [];

  for (const assignment of assignments) {
    const staff = assignment.staff_profile || {};
    const staffName = staff.display_name || [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Crew';
    const message = buildStaffingScheduleMessage({
      staffName,
      role: assignment.job_title || staff.primary_role || 'Crew',
      event,
      venueName,
      startTime: assignment.start_time,
      endTime: assignment.end_time,
      policy,
    });

    const smsResult = await sendTwilioMessage(staff.phone_number || '', message);
    if (smsResult.success) sentSms += 1;
    else fallbackMessages.push({
      assignmentId: assignment.id,
      staffProfileId: staff.id,
      phone: staff.phone_number || '',
      message,
      reason: smsResult.error || 'SMS not sent',
    });

    let emailResult = null;
    const emailTarget = normalizePlainText(staff.email || '', 240);
    if (emailTarget) {
      try {
        const emailHtml = `<p>${escapeHtml(message)}</p>`;
        emailResult = await sendEmail({
          to: emailTarget,
          subject: `${event.title || 'Event'} staffing schedule`,
          html: emailHtml,
        });
        if (emailResult?.emailId) sentEmail += 1;
      } catch (err) {
        errors.push(`${staffName}: email failed (${err.message})`);
      }
    }

    const nextLog = Array.isArray(assignment.notification_log) ? [...assignment.notification_log] : [];
    nextLog.unshift({
      sentAt: nowIso,
      sms: smsResult,
      email: emailResult || null,
      message,
    });

    const update = {
      status: normalizeStaffStatus(assignment.status || 'scheduled'),
      published_at: nowIso,
      notification_log: nextLog.slice(0, 20),
      updated_at: nowIso,
    };
    const { data: updatedRow, error: updateError } = await supabase
      .from('staff_assignments')
      .update(update)
      .eq('id', assignment.id)
      .select('*, staff_profile:staff_profile_id(*)')
      .single();
    if (updateError) {
      errors.push(`${staffName}: ${updateError.message}`);
      continue;
    }
    notificationRows.push(updatedRow);
  }

  const messageTemplate = normalizePlainText(payload.messageTemplate || '', 600) || '';
  const { data: publishLog, error: publishLogError } = await supabase
    .from('staffing_publish_logs')
    .insert({
      user_id: userId,
      booking_id: bookingId,
      published_at: nowIso,
      call_in_policy: normalizePlainText(policy.call_in_policy || policy.callInPolicy || '', 4000),
      message_template: messageTemplate,
      sent_count: sentSms + sentEmail,
      failed_count: Math.max(0, assignments.length - sentSms),
      metadata: {
        sentSms,
        sentEmail,
        fallbackCount: fallbackMessages.length,
        errors,
      },
    })
    .select('*')
    .single();
  if (publishLogError && !isMissingRelationError(publishLogError)) throw publishLogError;

  return {
    published: true,
    sentSms,
    sentEmail,
    assignments: notificationRows,
    fallbackMessages,
    errors,
    publishLog: publishLog || null,
    emergencyContactWarning: emergencyValidation.warning || '',
  };
}

async function processStaffingSms(payload = {}, req = null) {
  const webhookSecret = process.env.STAFFING_WEBHOOK_SECRET || process.env.IMC_WEBHOOK_SECRET || '';
  const providedSecret = req?.headers?.['x-imc-webhook-secret'] || payload.webhookSecret || '';
  if (webhookSecret && providedSecret !== webhookSecret) {
    return { processed: false, error: 'Unauthorized webhook secret.' };
  }

  const fromPhone = normalizePlainText(payload.fromPhone || payload.From || payload.from || '', 80);
  const body = normalizePlainText(payload.body || payload.Body || payload.message || '', 1200);
  const parsedAction = normalizeStaffingInboundAction(body);
  const incomingBookingId = payload.bookingId || payload.eventId || null;

  const normalizedIncoming = normalizePhoneDigits(fromPhone);
  if (!normalizedIncoming) throw new Error('Missing inbound phone number.');

  const { data: profiles, error: profileError } = await supabase
    .from('staff_profiles')
    .select('id,user_id,phone_number,display_name')
    .eq('is_active', true);
  if (profileError) throw profileError;
  const matchedProfile = (profiles || []).find((row) => {
    const digits = normalizePhoneDigits(row.phone_number || '');
    return digits.endsWith(normalizedIncoming.slice(-10));
  });

  let assignment = null;
  if (matchedProfile) {
    let query = supabase
      .from('staff_assignments')
      .select('*, staff_profile:staff_profile_id(*)')
      .eq('staff_profile_id', matchedProfile.id)
      .order('start_time', { ascending: true })
      .limit(1);
    if (incomingBookingId) query = query.eq('booking_id', incomingBookingId);
    else query = query.gte('start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    const { data: assignmentRows } = await query;
    assignment = assignmentRows?.[0] || null;
  }

  const nowIso = new Date().toISOString();
  const update = {};
  if (parsedAction === 'confirm') {
    update.status = 'confirmed';
    update.confirmed_at = nowIso;
    update.policy_acknowledged = true;
    update.declined_at = null;
  } else if (parsedAction === 'decline') {
    update.status = 'declined';
    update.declined_at = nowIso;
    update.policy_acknowledged = true;
    update.confirmed_at = null;
  }
  if (assignment && parsedAction !== 'unknown') {
    update.updated_at = nowIso;
    const { error: assignmentError } = await supabase
      .from('staff_assignments')
      .update(update)
      .eq('id', assignment.id);
    if (assignmentError) throw assignmentError;
  }

  const inboundPayload = {
    ...payload,
    headers: req?.headers || {},
  };
  const insertRow = {
    user_id: matchedProfile?.user_id || payload.userId || payload.user_id || null,
    booking_id: assignment?.booking_id || incomingBookingId || null,
    staff_assignment_id: assignment?.id || null,
    from_phone: fromPhone,
    body: body || '',
    parsed_action: parsedAction,
    raw_payload: inboundPayload,
    created_at: nowIso,
  };
  const { data: inboundLog, error: inboundError } = await supabase
    .from('staffing_inbound_messages')
    .insert(insertRow)
    .select('*')
    .single();
  if (inboundError && !isMissingRelationError(inboundError)) throw inboundError;

  return {
    processed: true,
    parsedAction,
    profile: matchedProfile || null,
    assignmentId: assignment?.id || null,
    inboundLog: inboundLog || null,
  };
}

async function getStaffingDashboard(payload = {}) {
  const userId = ensureUserId(payload);
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!bookingId) throw new Error('Missing bookingId/eventId for staffing dashboard.');

  const [{ assignments }, event] = await Promise.all([
    getStaffAssignments({ userId, bookingId }),
    getEventRow(bookingId),
  ]);
  const roleRequirements = normalizeRoleCoverageInput(payload.roleRequirements || payload.rolesRequired || []);
  const coverage = buildStaffingCoverage(assignments || [], roleRequirements);

  let estimatedPayroll = 0;
  (assignments || []).forEach((row) => {
    const cost = calculateAssignmentCompensation(row, row.staff_profile || {});
    estimatedPayroll += Number(cost.estimatedPay || 0);
  });

  return {
    event: event || null,
    coverage: {
      ...coverage,
      estimatedPayroll: Number(estimatedPayroll.toFixed(2)),
      staffingCompleteness: coverage.rolesRequired > 0
        ? Number(((coverage.rolesFilled / coverage.rolesRequired) * 100).toFixed(1))
        : (coverage.totalAssignments > 0 ? 100 : 0),
    },
    assignments: assignments || [],
  };
}

function buildStaffSheetLines({
  event = {},
  assignments = [],
  dashboard = {},
  mode = 'full',
} = {}) {
  const lines = [];
  lines.push(`Generated: ${new Date().toLocaleString('en-US')}`);
  lines.push(`Event: ${event.title || 'Untitled Event'}`);
  lines.push(`Date: ${event.date || 'TBD'} ${event.time || ''}`.trim());
  lines.push(`Venue: ${event.venue_name || event.venue || 'Venue TBD'}`);
  lines.push('');

  if (mode === 'coverage') {
    const coverage = dashboard.coverage || {};
    lines.push('## Staffing Coverage');
    lines.push(`Roles required: ${coverage.rolesRequired || 0}`);
    lines.push(`Roles filled: ${coverage.rolesFilled || 0}`);
    lines.push(`Roles unfilled: ${coverage.rolesUnfilled || 0}`);
    lines.push(`Confirmation rate: ${coverage.confirmationRate || 0}%`);
    lines.push(`Estimated payroll: $${Number(coverage.estimatedPayroll || 0).toFixed(2)}`);
    (coverage.roleCoverage || []).forEach((row, index) => {
      lines.push(`${index + 1}. ${row.role}: required ${row.requiredCount}, assigned ${row.assignedCount}, missing ${row.missing}`);
    });
    return lines;
  }

  if (mode === 'time_block') {
    lines.push('## Time Blocks');
    const blocks = buildStaffTimeBlocks(assignments || []);
    blocks.forEach((block, index) => {
      const start = block.start ? new Date(block.start).toLocaleString('en-US') : 'TBD';
      const end = block.end ? new Date(block.end).toLocaleString('en-US') : 'TBD';
      lines.push(`${index + 1}. ${start} - ${end}`);
      block.rows.forEach((row) => {
        const staff = row.staff_profile || {};
        lines.push(`   - ${staff.display_name || 'Crew'} | ${row.job_title || 'Role TBD'} | ${row.status || 'scheduled'}`);
      });
    });
    return lines;
  }

  if (mode === 'contacts') {
    lines.push('## Contact Sheet');
    (assignments || []).forEach((row, index) => {
      const staff = row.staff_profile || {};
      lines.push(`${index + 1}. ${staff.display_name || 'Crew'} | ${row.job_title || 'Role TBD'} | ${staff.phone_number || 'No phone'} | ${staff.email || 'No email'}`);
    });
    return lines;
  }

  lines.push('## Full Staffing Roster');
  (assignments || []).forEach((row, index) => {
    const staff = row.staff_profile || {};
    const pay = calculateAssignmentCompensation(row, staff);
    const shift = row.start_time && row.end_time
      ? `${new Date(row.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}-${new Date(row.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : 'TBD';
    lines.push(`${index + 1}. ${staff.display_name || 'Crew'} | ${row.job_title || 'Role TBD'} | ${shift} | ${row.status || 'scheduled'}`);
    lines.push(`   Phone: ${staff.phone_number || 'N/A'} | Pay: ${pay.payType}${pay.rate !== null ? ` @ ${pay.rate}` : ''} | Est: $${Number(pay.estimatedPay || 0).toFixed(2)}`);
  });
  return lines;
}

async function exportStaffSheet(payload = {}) {
  const userId = ensureUserId(payload);
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!bookingId) throw new Error('Missing bookingId/eventId for staff export.');
  const mode = normalizePlainText(payload.mode || 'full', 40).toLowerCase();
  const normalizedMode = ['full', 'contacts', 'coverage', 'time_block'].includes(mode) ? mode : 'full';

  const [event, dashboard] = await Promise.all([
    getEventRow(bookingId),
    getStaffingDashboard({ userId, bookingId, roleRequirements: payload.roleRequirements || [] }),
  ]);
  const assignments = dashboard.assignments || [];
  const lines = buildStaffSheetLines({ event: event || {}, assignments, dashboard, mode: normalizedMode });
  const title = `${normalizePlainText(event?.title || 'Event', 120)} staffing ${normalizedMode.replace(/_/g, ' ')}`;
  const pdfBuffer = buildSimplePdfBuffer(title, lines);
  const pdfBase64 = pdfBuffer.toString('base64');
  const htmlContent = `<pre style=\"font-family: Inter, Helvetica, Arial, sans-serif; white-space: pre-wrap;\">${escapeHtml(lines.join('\n'))}</pre>`;

  return {
    mode: normalizedMode,
    fileName: `${toSlug(title)}.pdf`,
    pdfBase64,
    htmlContent,
    downloadUrl: `data:application/pdf;base64,${pdfBase64}`,
    assignments: assignments.length,
    coverage: dashboard.coverage || {},
  };
}

function normalizeMessageType(value = 'user') {
  const next = normalizePlainText(value || '', 40).toLowerCase();
  return ['user', 'system', 'system_critical'].includes(next) ? next : 'user';
}

function normalizeMessageAttachments(input = []) {
  const list = Array.isArray(input) ? input : [input];
  const seen = new Set();
  return list
    .map((row) => {
      const url = normalizePlainText(row?.url || row?.href || row?.path || '', 1000);
      if (!url || (!/^https?:\/\//i.test(url) && !/^data:/i.test(url))) return null;
      const key = `${url.toLowerCase()}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        url,
        name: normalizePlainText(row?.name || row?.fileName || 'Attachment', 200),
        mimeType: normalizePlainText(row?.mimeType || row?.type || '', 120),
        size: Number(row?.size || 0) || 0,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeMessageMentions(input = []) {
  const seen = new Set();
  const items = Array.isArray(input) ? input : [];
  return items
    .map((row) => {
      const mentionedUserId = normalizePlainText(
        row?.mentionedUserId || row?.mentioned_user_id || '',
        120
      );
      const mentionedRoleKey = normalizePlainText(
        row?.mentionedRoleKey || row?.mentioned_role_key || row?.role || '',
        80
      );
      if (!mentionedUserId && !mentionedRoleKey) return null;
      const key = mentionedUserId
        ? `user:${mentionedUserId}`
        : `role:${mentionedRoleKey.toLowerCase()}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        mentioned_user_id: mentionedUserId || null,
        mentioned_role_key: mentionedRoleKey || null,
      };
    })
    .filter(Boolean)
    .slice(0, 25);
}

function summarizeReactionRows(rows = []) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const emoji = normalizePlainText(row?.emoji || '', 20);
    if (!emoji) return;
    const current = map.get(emoji) || { emoji, count: 0 };
    current.count += 1;
    map.set(emoji, current);
  });
  return Array.from(map.values())
    .sort((a, b) => (b.count - a.count) || a.emoji.localeCompare(b.emoji));
}

async function getEventConversation(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('eventId is required for event conversation.');

  const { data, error } = await supabase
    .from('event_conversations')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        conversation: {
          id: null,
          user_id: userId,
          event_id: eventId,
          show_mode_enabled: false,
          mute_non_critical: false,
          pinned_ops_commands: '',
        },
      };
    }
    throw error;
  }

  return { conversation: data };
}

async function upsertEventConversation(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('eventId is required for event conversation.');
  const input = payload.conversation || payload.state || {};

  const next = {
    user_id: userId,
    event_id: eventId,
    show_mode_enabled: input.showModeEnabled === true || input.show_mode_enabled === true,
    mute_non_critical: input.muteNonCritical === true || input.mute_non_critical === true,
    pinned_ops_commands: normalizePlainText(
      input.pinnedOpsCommands || input.pinned_ops_commands || '',
      4000
    ),
    updated_at: new Date().toISOString(),
  };

  let data;
  let error;
  ({ data, error } = await supabase
    .from('event_conversations')
    .upsert(next, { onConflict: 'event_id' })
    .select('*')
    .single());

  if (error && isMissingConflictTargetError(error)) {
    const { data: existing } = await supabase
      .from('event_conversations')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existing?.id) {
      const updateResponse = await supabase
        .from('event_conversations')
        .update(next)
        .eq('id', existing.id)
        .select('*')
        .single();
      data = updateResponse.data;
      error = updateResponse.error;
    } else {
      const insertResponse = await supabase
        .from('event_conversations')
        .insert(next)
        .select('*')
        .single();
      data = insertResponse.data;
      error = insertResponse.error;
    }
  }

  if (error) {
    if (isMissingRelationError(error)) {
      return { conversation: { id: null, ...next } };
    }
    throw error;
  }

  return { conversation: data };
}

async function getEventMessages(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('eventId is required for event messages.');
  const limit = Math.min(250, Math.max(1, Number(payload.limit || 120) || 120));
  const before = normalizePlainText(payload.before || payload.beforeAt || '', 80);

  let query = supabase
    .from('event_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) query = query.lt('created_at', before);

  const { data: rawMessages, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      return {
        messages: [],
        conversation: {
          id: null,
          user_id: userId,
          event_id: eventId,
          show_mode_enabled: false,
          mute_non_critical: false,
          pinned_ops_commands: '',
        },
      };
    }
    throw error;
  }

  const messages = (rawMessages || []).slice().reverse();
  const messageIds = messages.map((row) => row.id).filter(Boolean);

  let reactions = [];
  let mentions = [];
  if (messageIds.length) {
    const [{ data: reactionRows, error: reactionError }, { data: mentionRows, error: mentionError }] = await Promise.all([
      supabase
        .from('message_reactions')
        .select('id, message_id, user_id, emoji, created_at')
        .in('message_id', messageIds),
      supabase
        .from('message_mentions')
        .select('id, message_id, mentioned_user_id, mentioned_role_key, created_at')
        .in('message_id', messageIds),
    ]);
    if (reactionError && !isMissingRelationError(reactionError)) throw reactionError;
    if (mentionError && !isMissingRelationError(mentionError)) throw mentionError;
    reactions = reactionRows || [];
    mentions = mentionRows || [];
  }

  const reactionsByMessageId = new Map();
  reactions.forEach((row) => {
    const list = reactionsByMessageId.get(row.message_id) || [];
    list.push(row);
    reactionsByMessageId.set(row.message_id, list);
  });

  const mentionsByMessageId = new Map();
  mentions.forEach((row) => {
    const list = mentionsByMessageId.get(row.message_id) || [];
    list.push(row);
    mentionsByMessageId.set(row.message_id, list);
  });

  const normalizedMessages = messages.map((row) => {
    const rowReactions = reactionsByMessageId.get(row.id) || [];
    const rowMentions = mentionsByMessageId.get(row.id) || [];
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    return {
      ...row,
      attachments,
      has_attachments: row.has_attachments === true || attachments.length > 0,
      reactions: rowReactions,
      mentions: rowMentions,
      reaction_summary: summarizeReactionRows(rowReactions),
    };
  });

  const { conversation } = await getEventConversation({ userId, eventId }).catch(() => ({ conversation: null }));

  return {
    messages: normalizedMessages,
    conversation,
  };
}

async function lookupUserDisplayName(userId = '') {
  if (!userId) return '';
  const { data, error } = await supabase
    .from('users')
    .select('name,email')
    .eq('id', userId)
    .single();
  if (error || !data) return '';
  return normalizePlainText(data.name || String(data.email || '').split('@')[0] || '', 160);
}

async function sendEventMessage(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('eventId is required for send-event-message.');

  const input = payload.message || payload;
  const bodyText = normalizePlainText(input.bodyText || input.body_text || '', 4000);
  const attachments = normalizeMessageAttachments(input.attachments || []);
  if (!bodyText && !attachments.length) {
    throw new Error('Message text or attachment is required.');
  }

  const nowIso = new Date().toISOString();
  const clientMessageId = normalizePlainText(input.clientMessageId || input.client_message_id || '', 120);
  const authorName = normalizePlainText(input.authorName || input.author_name || '', 160)
    || await lookupUserDisplayName(userId)
    || 'Team';
  const messageType = normalizeMessageType(input.messageType || input.message_type || 'user');
  const metadata = (input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata))
    ? input.metadata
    : {};

  const baseRow = {
    user_id: userId,
    event_id: eventId,
    author_user_id: userId,
    author_name: authorName,
    body_text: bodyText,
    message_type: messageType,
    client_message_id: clientMessageId || null,
    language_hint: normalizePlainText(input.languageHint || input.language_hint || '', 24) || null,
    reply_to_message_id: normalizePlainText(input.replyToMessageId || input.reply_to_message_id || '', 120) || null,
    is_edited: false,
    attachments,
    has_attachments: attachments.length > 0,
    metadata,
    updated_at: nowIso,
  };

  let saved;
  if (clientMessageId) {
    let data;
    let error;
    ({ data, error } = await supabase
      .from('event_messages')
      .upsert(baseRow, { onConflict: 'event_id,client_message_id' })
      .select('*')
      .single());

    if (error && isMissingConflictTargetError(error)) {
      const { data: existing } = await supabase
        .from('event_messages')
        .select('id')
        .eq('event_id', eventId)
        .eq('client_message_id', clientMessageId)
        .maybeSingle();
      if (existing?.id) {
        const updateResponse = await supabase
          .from('event_messages')
          .update(baseRow)
          .eq('id', existing.id)
          .select('*')
          .single();
        data = updateResponse.data;
        error = updateResponse.error;
      } else {
        const insertResponse = await supabase
          .from('event_messages')
          .insert(baseRow)
          .select('*')
          .single();
        data = insertResponse.data;
        error = insertResponse.error;
      }
    }

    if (error) {
      if (isMissingRelationError(error)) {
        throw new Error('event_messages table is missing. Run the latest Supabase schema SQL.');
      }
      throw error;
    }
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('event_messages')
      .insert(baseRow)
      .select('*')
      .single();
    if (error) {
      if (isMissingRelationError(error)) {
        throw new Error('event_messages table is missing. Run the latest Supabase schema SQL.');
      }
      throw error;
    }
    saved = data;
  }

  const normalizedMentions = normalizeMessageMentions(input.mentions || payload.mentions || []);
  const { error: clearMentionsError } = await supabase
    .from('message_mentions')
    .delete()
    .eq('message_id', saved.id);
  if (clearMentionsError && !isMissingRelationError(clearMentionsError)) throw clearMentionsError;

  let mentionRows = [];
  if (normalizedMentions.length) {
    const { data, error } = await supabase
      .from('message_mentions')
      .insert(normalizedMentions.map((mention) => ({
        message_id: saved.id,
        mentioned_user_id: mention.mentioned_user_id,
        mentioned_role_key: mention.mentioned_role_key,
      })))
      .select('*');
    if (error && !isMissingRelationError(error)) throw error;
    mentionRows = data || [];
  }

  return {
    message: {
      ...saved,
      attachments,
      has_attachments: attachments.length > 0,
      reactions: [],
      mentions: mentionRows,
      reaction_summary: [],
    },
  };
}

async function toggleMessageReaction(payload = {}) {
  const userId = ensureUserId(payload);
  const messageId = payload.messageId || payload.message_id || payload.message?.id;
  const emoji = normalizePlainText(payload.emoji || payload.reaction || '', 20);
  if (!messageId) throw new Error('messageId is required.');
  if (!emoji) throw new Error('emoji is required.');

  const { data: messageRow, error: messageError } = await supabase
    .from('event_messages')
    .select('id')
    .eq('id', messageId)
    .single();
  if (messageError || !messageRow) {
    if (isMissingRelationError(messageError)) {
      throw new Error('event_messages table is missing. Run the latest Supabase schema SQL.');
    }
    throw new Error('Message not found.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();
  if (existingError && !isMissingRelationError(existingError)) throw existingError;

  let added = false;
  let removed = false;
  if (existing?.id) {
    const { error: deleteError } = await supabase
      .from('message_reactions')
      .delete()
      .eq('id', existing.id);
    if (deleteError && !isMissingRelationError(deleteError)) throw deleteError;
    removed = true;
  } else {
    const { error: insertError } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: userId,
        emoji,
      });
    if (insertError && !isMissingRelationError(insertError)) throw insertError;
    added = true;
  }

  const { data: reactionRows, error: reactionError } = await supabase
    .from('message_reactions')
    .select('id, message_id, user_id, emoji, created_at')
    .eq('message_id', messageId);
  if (reactionError && !isMissingRelationError(reactionError)) throw reactionError;

  return {
    messageId,
    emoji,
    added,
    removed,
    reactions: reactionRows || [],
    reaction_summary: summarizeReactionRows(reactionRows || []),
  };
}

function resolveTranslationLanguageName(codeOrName = 'es') {
  const normalized = normalizePlainText(codeOrName || '', 40).toLowerCase();
  const map = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
  };
  return map[normalized] || codeOrName;
}

async function runMessageTranslation(text = '', targetLanguage = 'es') {
  const sourceText = normalizePlainText(text, 6000);
  if (!sourceText) return '';
  const target = normalizePlainText(targetLanguage || 'es', 40) || 'es';
  const targetName = resolveTranslationLanguageName(target);
  const instruction = `Translate this operations message into ${targetName}. Keep @mentions, URLs, phone numbers, names, and schedule tokens intact. Return only translated text.`;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${instruction}\n\n${sourceText}` }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    const data = await response.json().catch(() => ({}));
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (translated) return normalizePlainText(translated, 6000);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: instruction },
          { role: 'user', content: sourceText },
        ],
      }),
    });
    const data = await response.json().catch(() => ({}));
    const translated = data?.choices?.[0]?.message?.content;
    if (translated) return normalizePlainText(translated, 6000);
    const errorMessage = data?.error?.message || '';
    if (errorMessage) throw new Error(errorMessage);
  }

  throw new Error('Translation provider is not configured. Add GEMINI_API_KEY or OPENAI_API_KEY.');
}

async function translateEventMessage(payload = {}) {
  ensureUserId(payload);
  const messageId = payload.messageId || payload.message_id || payload.message?.id;
  if (!messageId) throw new Error('messageId is required for translation.');
  const targetLanguage = normalizePlainText(payload.targetLanguage || payload.target_language || 'es', 16).toLowerCase() || 'es';

  const { data: messageRow, error: messageError } = await supabase
    .from('event_messages')
    .select('id, body_text, metadata')
    .eq('id', messageId)
    .single();
  if (messageError || !messageRow) {
    if (isMissingRelationError(messageError)) {
      throw new Error('event_messages table is missing. Run the latest Supabase schema SQL.');
    }
    throw new Error('Message not found.');
  }

  const baseMetadata = (messageRow.metadata && typeof messageRow.metadata === 'object' && !Array.isArray(messageRow.metadata))
    ? messageRow.metadata
    : {};
  const existingTranslations = (baseMetadata.translations && typeof baseMetadata.translations === 'object')
    ? baseMetadata.translations
    : {};

  if (existingTranslations[targetLanguage]) {
    return {
      messageId,
      targetLanguage,
      translation: existingTranslations[targetLanguage],
      cached: true,
    };
  }

  const translation = await runMessageTranslation(messageRow.body_text || '', targetLanguage);
  const nextMetadata = {
    ...baseMetadata,
    translations: {
      ...existingTranslations,
      [targetLanguage]: translation,
    },
    translation_updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('event_messages')
    .update({
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId);
  if (updateError && !isMissingRelationError(updateError)) throw updateError;

  return {
    messageId,
    targetLanguage,
    translation,
    cached: false,
  };
}

const DEFAULT_CERTIFICATION_TYPES = [
  { name: 'CPR', category: 'safety', renewable: true, default_valid_days: 730 },
  { name: 'First Aid', category: 'safety', renewable: true, default_valid_days: 730 },
  { name: 'AED', category: 'safety', renewable: true, default_valid_days: 730 },
  { name: 'TABC', category: 'compliance', renewable: true, default_valid_days: 730 },
  { name: 'Food Handler', category: 'compliance', renewable: true, default_valid_days: 730 },
  { name: 'OSHA Basic', category: 'safety', renewable: true, default_valid_days: 1095 },
  { name: 'Forklift', category: 'operations', renewable: true, default_valid_days: 1095 },
  { name: 'Crowd Management / Security License', category: 'security', renewable: true, default_valid_days: 1095 },
];

const PROFESSOR_GOOD_REMINDER_TEMPLATE = {
  key: 'completion_task_professor_good',
  subject: 'Professor Good reminder: let’s finish your draft',
  body: 'Hi {{name}}, your {{entity_type}} still needs {{missing_fields}}. Give it ten focused minutes and we can publish with confidence.',
};

function normalizeCompletionTaskStatus(value = 'open') {
  const status = normalizePlainText(value || '', 40).toLowerCase();
  return ['open', 'in_progress', 'complete', 'archived'].includes(status) ? status : 'open';
}

function normalizeCompletionTaskPriority(value = 'normal') {
  const priority = normalizePlainText(value || '', 30).toLowerCase();
  return ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal';
}

function buildProfessorGoodReminder(task = {}, userName = 'friend') {
  const entityType = normalizePlainText(task.entity_type || task.entityType || 'item', 120) || 'item';
  const missing = Array.isArray(task.missing_fields_json)
    ? task.missing_fields_json
    : Array.isArray(task.missingFields) ? task.missingFields : [];
  const missingLabel = missing.length ? missing.join(', ') : 'the remaining details';
  return `Professor Good check-in: ${userName}, the ${entityType} is almost there. We still need ${missingLabel}. Clean finish now means fewer surprises later.`;
}

async function getEmergencyContacts(payload = {}) {
  const userId = payload.userId || payload.user_id || null;
  const singleProfileId = payload.staffProfileId || payload.staff_profile_id || null;
  const staffProfileIds = [
    ...(Array.isArray(payload.staffProfileIds) ? payload.staffProfileIds : []),
    ...(singleProfileId ? [singleProfileId] : []),
  ].filter(Boolean);

  let query = supabase
    .from('emergency_contacts')
    .select('*')
    .order('is_primary', { ascending: false })
    .order('updated_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  if (staffProfileIds.length) query = query.in('staff_profile_id', [...new Set(staffProfileIds)]);

  const { data, error } = await query;
  if (!error) {
    return { contacts: data || [] };
  }
  if (!isMissingRelationError(error)) throw error;

  // Legacy fallback: use emergency_contact JSON on staff_profiles.
  let legacyQuery = supabase
    .from('staff_profiles')
    .select('id,first_name,last_name,display_name,emergency_contact');
  if (userId) legacyQuery = legacyQuery.eq('user_id', userId);
  if (staffProfileIds.length) legacyQuery = legacyQuery.in('id', [...new Set(staffProfileIds)]);
  const { data: profiles, error: legacyError } = await legacyQuery;
  if (legacyError) throw legacyError;

  const contacts = [];
  (profiles || []).forEach((profile) => {
    const raw = profile.emergency_contact;
    if (!raw || typeof raw !== 'object') return;
    const name = normalizePlainText(raw.name || raw.contactName || '', 180);
    const phone = normalizePlainText(raw.phone || raw.contactPhone || '', 80);
    const email = normalizePlainText(raw.email || '', 240);
    if (!name && !phone && !email) return;
    contacts.push({
      id: `legacy-${profile.id}`,
      user_id: userId || null,
      staff_profile_id: profile.id,
      name: name || 'Emergency Contact',
      relationship: normalizePlainText(raw.relationship || '', 120) || '',
      phone: phone || '',
      email: email || '',
      notes: normalizePlainText(raw.notes || '', 1000) || '',
      is_primary: true,
      is_legacy: true,
      staff_name: profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Staff',
    });
  });
  return { contacts, warning: 'Using legacy emergency_contact JSON because emergency_contacts table was not found.' };
}

async function upsertEmergencyContact(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.contact || {};
  const staffProfileId = payload.staffProfileId || payload.staff_profile_id || input.staffProfileId || input.staff_profile_id;
  if (!staffProfileId) throw new Error('Missing staffProfileId for emergency contact.');
  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    staff_profile_id: staffProfileId,
    name: normalizePlainText(input.name || '', 180),
    relationship: normalizePlainText(input.relationship || '', 120),
    phone: normalizePlainText(input.phone || '', 80),
    email: normalizePlainText(input.email || '', 240),
    notes: normalizePlainText(input.notes || '', 2000),
    is_primary: input.isPrimary === false || input.is_primary === false ? false : true,
    updated_at: nowIso,
  };
  if (!next.name && !next.phone && !next.email) {
    throw new Error('Emergency contact requires at least name, phone, or email.');
  }

  const contactId = payload.contactId || payload.id || input.id || null;
  let saved = null;
  if (contactId) {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .update(next)
      .eq('id', contactId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) {
      if (!isMissingRelationError(error)) throw error;
    } else {
      saved = data;
    }
  } else {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({ ...next, created_at: nowIso })
      .select('*')
      .single();
    if (error) {
      if (!isMissingRelationError(error)) throw error;
    } else {
      saved = data;
    }
  }

  if (saved) {
    if (saved.is_primary) {
      await supabase
        .from('emergency_contacts')
        .update({ is_primary: false, updated_at: nowIso })
        .eq('staff_profile_id', staffProfileId)
        .eq('user_id', userId)
        .neq('id', saved.id);
    }
    return { contact: saved };
  }

  // Legacy fallback.
  const legacy = {
    name: next.name,
    relationship: next.relationship,
    phone: next.phone,
    email: next.email,
    notes: next.notes,
    updatedAt: nowIso,
  };
  const updated = await resilientServerUpdate('staff_profiles', {
    emergency_contact: legacy,
    updated_at: nowIso,
  }, 'id', staffProfileId);
  return {
    contact: {
      id: `legacy-${staffProfileId}`,
      user_id: userId,
      staff_profile_id: staffProfileId,
      ...legacy,
      is_primary: true,
      is_legacy: true,
    },
    warning: 'Saved to legacy staff_profiles.emergency_contact because emergency_contacts table was not found.',
    staffProfile: updated || null,
  };
}

async function deleteEmergencyContact(payload = {}) {
  const contactId = payload.contactId || payload.id || null;
  const staffProfileId = payload.staffProfileId || payload.staff_profile_id || null;
  if (!contactId && !staffProfileId) throw new Error('Missing contactId or staffProfileId.');

  if (contactId) {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', contactId);
    if (!error) return { removed: true, contactId };
    if (!isMissingRelationError(error)) throw error;
  }

  if (staffProfileId) {
    await resilientServerUpdate('staff_profiles', {
      emergency_contact: {},
      updated_at: new Date().toISOString(),
    }, 'id', staffProfileId);
    return {
      removed: true,
      staffProfileId,
      warning: 'Removed legacy staff_profiles.emergency_contact because emergency_contacts table was not found.',
    };
  }

  return { removed: true, contactId };
}

async function getTrainingCourses(payload = {}) {
  const userId = ensureUserId(payload);
  const venueId = payload.venueId || payload.venue_id || payload.venueProfileId || payload.venue_profile_id || null;
  let query = supabase
    .from('training_courses')
    .select('*')
    .eq('user_id', userId)
    .order('title', { ascending: true });
  if (venueId) query = query.or(`venue_id.is.null,venue_id.eq.${venueId}`);
  if (payload.activeOnly !== false) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { courses: [], warning: 'training_courses table missing.' };
    throw error;
  }
  return { courses: data || [] };
}

async function upsertTrainingCourse(payload = {}) {
  const userId = ensureUserId(payload);
  const course = payload.course || {};
  const venueId = payload.venueId || payload.venue_id || course.venueId || course.venue_id || null;
  const next = {
    user_id: userId,
    venue_id: venueId,
    title: normalizePlainText(course.title || '', 220),
    category: normalizePlainText(course.category || 'other', 80) || 'other',
    description: normalizePlainText(course.description || '', 6000),
    duration_minutes: Number.isFinite(Number(course.durationMinutes ?? course.duration_minutes))
      ? Math.max(0, Number(course.durationMinutes ?? course.duration_minutes))
      : null,
    materials_links: Array.isArray(course.materialsLinks || course.materials_links)
      ? (course.materialsLinks || course.materials_links).map((value) => normalizePlainText(value, 500)).filter(Boolean)
      : [],
    attachments: Array.isArray(course.attachments) ? course.attachments : [],
    is_active: course.isActive === false ? false : true,
    updated_at: new Date().toISOString(),
  };
  if (!next.title) throw new Error('Training course title is required.');
  const courseId = payload.courseId || payload.id || course.id || null;
  if (courseId) {
    const { data, error } = await supabase
      .from('training_courses')
      .update(next)
      .eq('id', courseId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) {
      if (isMissingRelationError(error)) return { course: null, warning: 'training_courses table missing.' };
      throw error;
    }
    return { course: data };
  }
  const { data, error } = await supabase
    .from('training_courses')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) return { course: null, warning: 'training_courses table missing.' };
    throw error;
  }
  return { course: data };
}

async function deleteTrainingCourse(payload = {}) {
  const userId = ensureUserId(payload);
  const courseId = payload.courseId || payload.id;
  if (!courseId) throw new Error('Missing courseId.');
  const { error } = await supabase
    .from('training_courses')
    .delete()
    .eq('id', courseId)
    .eq('user_id', userId);
  if (error) {
    if (isMissingRelationError(error)) return { removed: false, warning: 'training_courses table missing.' };
    throw error;
  }
  return { removed: true, courseId };
}

async function getTrainingSessions(payload = {}) {
  const userId = ensureUserId(payload);
  const courseId = payload.courseId || payload.trainingCourseId || payload.training_course_id || null;
  const venueId = payload.venueId || payload.venue_id || null;
  let query = supabase
    .from('training_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('start_datetime', { ascending: true });
  if (courseId) query = query.eq('training_course_id', courseId);
  if (venueId) query = query.eq('venue_id', venueId);
  if (payload.startFrom) query = query.gte('start_datetime', normalizeStageDateTime(payload.startFrom) || payload.startFrom);
  if (payload.startTo) query = query.lte('start_datetime', normalizeStageDateTime(payload.startTo) || payload.startTo);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { sessions: [], warning: 'training_sessions table missing.' };
    throw error;
  }
  return { sessions: data || [] };
}

async function upsertTrainingSession(payload = {}) {
  const userId = ensureUserId(payload);
  const session = payload.session || {};
  const trainingCourseId = payload.courseId || payload.trainingCourseId || payload.training_course_id || session.trainingCourseId || session.training_course_id;
  if (!trainingCourseId) throw new Error('Missing trainingCourseId for training session.');
  const next = {
    user_id: userId,
    training_course_id: trainingCourseId,
    venue_id: payload.venueId || payload.venue_id || session.venueId || session.venue_id || null,
    zone_id: session.zoneId || session.zone_id || null,
    session_type: normalizePlainText(session.sessionType || session.session_type || 'workshop', 80) || 'workshop',
    start_datetime: normalizeStageDateTime(session.startDatetime || session.start_datetime),
    end_datetime: normalizeStageDateTime(session.endDatetime || session.end_datetime),
    instructor_contact_id: session.instructorContactId || session.instructor_contact_id || null,
    location_notes: normalizePlainText(session.locationNotes || session.location_notes || '', 3000),
    capacity: Number.isFinite(Number(session.capacity)) ? Math.max(0, Number(session.capacity)) : null,
    notes: normalizePlainText(session.notes || '', 4000),
    metadata: (session.metadata && typeof session.metadata === 'object') ? session.metadata : {},
    updated_at: new Date().toISOString(),
  };
  if (!next.start_datetime) throw new Error('Training session start date/time is required.');
  if (next.end_datetime && new Date(next.end_datetime) <= new Date(next.start_datetime)) {
    throw new Error('Training session end time must be after start time.');
  }
  const sessionId = payload.sessionId || payload.id || session.id || null;
  if (sessionId) {
    const { data, error } = await supabase
      .from('training_sessions')
      .update(next)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) {
      if (isMissingRelationError(error)) return { session: null, warning: 'training_sessions table missing.' };
      throw error;
    }
    return { session: data };
  }
  const { data, error } = await supabase
    .from('training_sessions')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) return { session: null, warning: 'training_sessions table missing.' };
    throw error;
  }
  return { session: data };
}

async function deleteTrainingSession(payload = {}) {
  const userId = ensureUserId(payload);
  const sessionId = payload.sessionId || payload.id;
  if (!sessionId) throw new Error('Missing sessionId.');
  const { error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);
  if (error) {
    if (isMissingRelationError(error)) return { removed: false, warning: 'training_sessions table missing.' };
    throw error;
  }
  return { removed: true, sessionId };
}

async function getTrainingEnrollments(payload = {}) {
  const userId = ensureUserId(payload);
  let query = supabase
    .from('training_enrollments')
    .select('*, training_session:training_session_id(*), staff_profile:staff_profile_id(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (payload.sessionId || payload.trainingSessionId) {
    query = query.eq('training_session_id', payload.sessionId || payload.trainingSessionId);
  }
  if (payload.staffProfileId || payload.staff_profile_id) {
    query = query.eq('staff_profile_id', payload.staffProfileId || payload.staff_profile_id);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { enrollments: [], warning: 'training_enrollments table missing.' };
    throw error;
  }
  return { enrollments: data || [] };
}

async function upsertTrainingEnrollment(payload = {}) {
  const userId = ensureUserId(payload);
  const enrollment = payload.enrollment || {};
  const trainingSessionId = payload.sessionId || payload.trainingSessionId || payload.training_session_id || enrollment.trainingSessionId || enrollment.training_session_id;
  const staffProfileId = payload.staffProfileId || payload.staff_profile_id || enrollment.staffProfileId || enrollment.staff_profile_id;
  if (!trainingSessionId || !staffProfileId) {
    throw new Error('trainingSessionId and staffProfileId are required for training enrollment.');
  }
  const status = normalizePlainText(enrollment.status || 'invited', 40).toLowerCase();
  const next = {
    user_id: userId,
    training_session_id: trainingSessionId,
    staff_profile_id: staffProfileId,
    status: ['invited', 'enrolled', 'completed', 'no_show'].includes(status) ? status : 'invited',
    completed_at: normalizeStageDateTime(enrollment.completedAt || enrollment.completed_at) || null,
    notes: normalizePlainText(enrollment.notes || '', 3000),
    reminders_sent_at: normalizeStageDateTime(enrollment.remindersSentAt || enrollment.reminders_sent_at) || null,
    updated_at: new Date().toISOString(),
  };
  const enrollmentId = payload.enrollmentId || payload.id || enrollment.id || null;
  if (enrollmentId) {
    const { data, error } = await supabase
      .from('training_enrollments')
      .update(next)
      .eq('id', enrollmentId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) {
      if (isMissingRelationError(error)) return { enrollment: null, warning: 'training_enrollments table missing.' };
      throw error;
    }
    return { enrollment: data };
  }
  const { data, error } = await supabase
    .from('training_enrollments')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) return { enrollment: null, warning: 'training_enrollments table missing.' };
    throw error;
  }
  return { enrollment: data };
}

async function deleteTrainingEnrollment(payload = {}) {
  const userId = ensureUserId(payload);
  const enrollmentId = payload.enrollmentId || payload.id;
  if (!enrollmentId) throw new Error('Missing enrollmentId.');
  const { error } = await supabase
    .from('training_enrollments')
    .delete()
    .eq('id', enrollmentId)
    .eq('user_id', userId);
  if (error) {
    if (isMissingRelationError(error)) return { removed: false, warning: 'training_enrollments table missing.' };
    throw error;
  }
  return { removed: true, enrollmentId };
}

async function sendTrainingReminders(payload = {}) {
  const userId = ensureUserId(payload);
  const now = new Date();
  const withinHours = Math.max(1, Number(payload.withinHours || payload.windowHours || 24) || 24);
  const end = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
  const { enrollments } = await getTrainingEnrollments({ userId });
  if (!enrollments?.length) return { sent: 0, total: 0, reminders: [] };

  const targetEnrollments = enrollments.filter((entry) => {
    const sessionStart = entry?.training_session?.start_datetime;
    if (!sessionStart) return false;
    const startsAt = new Date(sessionStart);
    if (Number.isNaN(startsAt.getTime())) return false;
    return startsAt >= now && startsAt <= end && ['invited', 'enrolled'].includes(String(entry.status || '').toLowerCase());
  });
  const reminders = [];
  let sent = 0;

  for (const enrollment of targetEnrollments) {
    const session = enrollment.training_session || {};
    const staff = enrollment.staff_profile || {};
    const staffName = staff.display_name || [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Team member';
    const startsAt = session.start_datetime ? new Date(session.start_datetime) : null;
    const whenText = startsAt && !Number.isNaN(startsAt.getTime())
      ? startsAt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'TBD';
    const courseTitle = session?.training_course?.title || 'training session';
    const message = `Reminder: ${staffName}, you are scheduled for ${courseTitle} on ${whenText}.`;

    const sms = await sendTwilioMessage(staff.phone_number || '', message);
    let email = { success: false, error: 'No email' };
    if (staff.email) {
      try {
        const emailResult = await sendEmail({
          to: staff.email,
          subject: `Training reminder: ${courseTitle}`,
          html: `<p>${escapeHtml(message)}</p>`,
        });
        email = { success: !!emailResult?.emailId, emailId: emailResult?.emailId || null };
      } catch (err) {
        email = { success: false, error: err.message };
      }
    }
    if (sms.success || email.success) sent += 1;
    reminders.push({
      enrollmentId: enrollment.id,
      staffProfileId: enrollment.staff_profile_id,
      sms,
      email,
    });

    await supabase
      .from('training_enrollments')
      .update({ reminders_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', enrollment.id);
  }

  return {
    sent,
    total: targetEnrollments.length,
    reminders,
  };
}

async function getCertificationTypes(payload = {}) {
  const userId = payload.userId || payload.user_id || null;
  let query = supabase
    .from('certification_types')
    .select('*')
    .order('name', { ascending: true });
  if (payload.activeOnly !== false) query = query.eq('is_active', true);
  if (userId) query = query.or(`user_id.is.null,user_id.eq.${userId}`);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      return { types: DEFAULT_CERTIFICATION_TYPES.map((row, index) => ({ id: `default-${index + 1}`, ...row, is_active: true })), warning: 'certification_types table missing.' };
    }
    throw error;
  }
  return { types: data || [] };
}

async function seedCertificationTypes(payload = {}) {
  const userId = ensureUserId(payload);
  const rows = DEFAULT_CERTIFICATION_TYPES.map((row, index) => ({
    user_id: null,
    name: row.name,
    category: row.category,
    renewable: row.renewable,
    default_valid_days: row.default_valid_days,
    is_active: true,
    sort_order: index + 1,
  }));
  const { error } = await supabase
    .from('certification_types')
    .upsert(rows, { onConflict: 'name,user_id' });
  if (error) {
    if (isMissingRelationError(error)) return { types: rows, warning: 'certification_types table missing.' };
    throw error;
  }
  return getCertificationTypes({ userId, activeOnly: false });
}

async function upsertCertificationType(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.type || payload.certificationType || {};
  const next = {
    user_id: input.systemType === true ? null : userId,
    name: normalizePlainText(input.name || '', 180),
    category: normalizePlainText(input.category || 'other', 80) || 'other',
    renewable: input.renewable === false ? false : true,
    default_valid_days: Number.isFinite(Number(input.defaultValidDays ?? input.default_valid_days))
      ? Math.max(0, Number(input.defaultValidDays ?? input.default_valid_days))
      : null,
    reminder_offsets_days: Array.isArray(input.reminderOffsetsDays || input.reminder_offsets_days)
      ? (input.reminderOffsetsDays || input.reminder_offsets_days).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0)
      : [60, 30, 7],
    is_active: input.isActive === false ? false : true,
    updated_at: new Date().toISOString(),
  };
  if (!next.name) throw new Error('Certification type name is required.');
  const typeId = payload.typeId || payload.id || input.id || null;
  if (typeId) {
    const { data, error } = await supabase
      .from('certification_types')
      .update(next)
      .eq('id', typeId)
      .select('*')
      .single();
    if (error) {
      if (isMissingRelationError(error)) return { type: null, warning: 'certification_types table missing.' };
      throw error;
    }
    return { type: data };
  }
  const { data, error } = await supabase
    .from('certification_types')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) return { type: null, warning: 'certification_types table missing.' };
    throw error;
  }
  return { type: data };
}

async function deleteCertificationType(payload = {}) {
  const typeId = payload.typeId || payload.id;
  if (!typeId) throw new Error('Missing typeId.');
  const { error } = await supabase
    .from('certification_types')
    .delete()
    .eq('id', typeId);
  if (error) {
    if (isMissingRelationError(error)) return { removed: false, warning: 'certification_types table missing.' };
    throw error;
  }
  return { removed: true, typeId };
}

async function getStaffCertifications(payload = {}) {
  const userId = ensureUserId(payload);
  let query = supabase
    .from('staff_certifications')
    .select('*, certification_type:certification_type_id(*), staff_profile:staff_profile_id(*)')
    .eq('user_id', userId)
    .order('expires_at', { ascending: true });
  if (payload.staffProfileId || payload.staff_profile_id) {
    query = query.eq('staff_profile_id', payload.staffProfileId || payload.staff_profile_id);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { certifications: [], warning: 'staff_certifications table missing.' };
    throw error;
  }
  const certifications = (data || []).map((row) => ({
    ...row,
    status: normalizeCertificationStatus(row.expires_at, {
      now: payload.now || new Date().toISOString(),
      thresholdDays: Number(payload.thresholdDays || 30) || 30,
    }),
  }));
  return { certifications };
}

async function upsertStaffCertification(payload = {}) {
  const userId = ensureUserId(payload);
  const cert = payload.certification || {};
  const staffProfileId = payload.staffProfileId || payload.staff_profile_id || cert.staffProfileId || cert.staff_profile_id;
  const certificationTypeId = payload.certificationTypeId || payload.certification_type_id || cert.certificationTypeId || cert.certification_type_id;
  if (!staffProfileId || !certificationTypeId) {
    throw new Error('staffProfileId and certificationTypeId are required.');
  }
  const expiresAt = normalizeStageDateTime(cert.expiresAt || cert.expires_at) || null;
  const status = normalizeCertificationStatus(expiresAt, {
    now: new Date().toISOString(),
    thresholdDays: Number(payload.thresholdDays || 30) || 30,
  });
  const next = {
    user_id: userId,
    staff_profile_id: staffProfileId,
    certification_type_id: certificationTypeId,
    certificate_number: normalizePlainText(cert.certificateNumber || cert.certificate_number || '', 160) || null,
    issued_at: normalizeStageDateTime(cert.issuedAt || cert.issued_at) || null,
    expires_at: expiresAt,
    status,
    attachment_id: normalizePlainText(cert.attachmentId || cert.attachment_id || '', 320) || null,
    notes: normalizePlainText(cert.notes || '', 3000),
    updated_at: new Date().toISOString(),
  };
  const certId = payload.certificationId || payload.id || cert.id || null;
  if (certId) {
    const { data, error } = await supabase
      .from('staff_certifications')
      .update(next)
      .eq('id', certId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) {
      if (isMissingRelationError(error)) return { certification: null, warning: 'staff_certifications table missing.' };
      throw error;
    }
    return { certification: data };
  }
  const { data, error } = await supabase
    .from('staff_certifications')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) return { certification: null, warning: 'staff_certifications table missing.' };
    throw error;
  }
  return { certification: data };
}

async function deleteStaffCertification(payload = {}) {
  const userId = ensureUserId(payload);
  const certificationId = payload.certificationId || payload.id;
  if (!certificationId) throw new Error('Missing certificationId.');
  const { error } = await supabase
    .from('staff_certifications')
    .delete()
    .eq('id', certificationId)
    .eq('user_id', userId);
  if (error) {
    if (isMissingRelationError(error)) return { removed: false, warning: 'staff_certifications table missing.' };
    throw error;
  }
  return { removed: true, certificationId };
}

async function sendCertificationReminders(payload = {}) {
  const userId = ensureUserId(payload);
  const thresholdDays = Number(payload.thresholdDays || 30) || 30;
  const { certifications } = await getStaffCertifications({ userId, thresholdDays });
  const target = (certifications || []).filter((row) => ['expiring_soon', 'expired'].includes(row.status));
  const reminders = [];
  let sent = 0;

  for (const certification of target) {
    const staff = certification.staff_profile || {};
    const typeName = certification?.certification_type?.name || 'Certification';
    const expiryText = certification.expires_at
      ? new Date(certification.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'unknown';
    const message = `${typeName} status update: ${staff.display_name || 'Staff'} has ${certification.status.replace('_', ' ')} certification (expires ${expiryText}).`;
    const sms = await sendTwilioMessage(staff.phone_number || '', message);
    let email = { success: false, error: 'No email' };
    if (staff.email) {
      try {
        const emailResult = await sendEmail({
          to: staff.email,
          subject: `${typeName} renewal reminder`,
          html: `<p>${escapeHtml(message)}</p>`,
        });
        email = { success: !!emailResult?.emailId, emailId: emailResult?.emailId || null };
      } catch (err) {
        email = { success: false, error: err.message };
      }
    }
    if (sms.success || email.success) sent += 1;
    reminders.push({
      certificationId: certification.id,
      staffProfileId: certification.staff_profile_id,
      status: certification.status,
      sms,
      email,
    });
  }

  return {
    sent,
    total: target.length,
    reminders,
  };
}

async function generateTimeClockQr(payload = {}) {
  const userId = ensureUserId(payload);
  const bookingId = payload.bookingId || payload.eventId || payload.booking_id;
  if (!bookingId) throw new Error('Missing bookingId/eventId for time clock QR.');
  const zoneId = payload.zoneId || payload.zone_id || '';
  const expiresMinutes = Math.max(5, Number(payload.expiresMinutes || payload.expMinutes || 480) || 480);
  const exp = Math.floor(Date.now() / 1000) + (expiresMinutes * 60);
  const tokenSecret = process.env.TIME_CLOCK_QR_SECRET || process.env.STAFFING_WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!tokenSecret) throw new Error('TIME_CLOCK_QR_SECRET or STAFFING_WEBHOOK_SECRET is required for QR signing.');
  const token = signTimeClockToken({
    bookingId,
    zoneId,
    exp,
    nonce: createHash('sha1').update(`${bookingId}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16),
  }, tokenSecret);
  const baseUrl = normalizePlainText(
    payload.scanBaseUrl
    || process.env.IMC_PUBLIC_APP_URL
    || process.env.PUBLIC_APP_URL
    || 'https://imc.goodcreativemedia.com',
    400
  ) || 'https://imc.goodcreativemedia.com';
  const scanUrl = `${baseUrl.replace(/\/$/, '')}/crew-portal?timeClockToken=${encodeURIComponent(token)}&bookingId=${encodeURIComponent(bookingId)}`;
  return {
    userId,
    bookingId,
    zoneId: zoneId || null,
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    scanUrl,
    qrValue: scanUrl,
  };
}

async function processTimeClockScan(payload = {}) {
  const token = normalizePlainText(payload.token || payload.timeClockToken || '', 4000);
  if (!token) throw new Error('Missing time clock token.');
  const tokenSecret = process.env.TIME_CLOCK_QR_SECRET || process.env.STAFFING_WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!tokenSecret) throw new Error('TIME_CLOCK_QR_SECRET or STAFFING_WEBHOOK_SECRET is required for QR verification.');
  const verified = verifyTimeClockToken(token, tokenSecret);
  if (!verified.valid) {
    return { success: false, reason: verified.reason || 'invalid_token' };
  }
  const bookingId = payload.bookingId || payload.eventId || verified.payload?.bookingId;
  const staffProfileId = payload.staffProfileId || payload.staff_profile_id;
  const assignmentId = payload.assignmentId || payload.staffAssignmentId || payload.staff_assignment_id || null;
  if (!bookingId) throw new Error('Missing bookingId for scan.');
  if (!staffProfileId && !assignmentId) throw new Error('Missing staffProfileId or assignmentId for scan.');
  const actionInput = normalizePlainText(payload.action || 'toggle', 40).toLowerCase();
  const action = ['check_in', 'check_out', 'toggle'].includes(actionInput) ? actionInput : 'toggle';

  let assignment = null;
  if (assignmentId) {
    const { data, error } = await supabase
      .from('staff_assignments')
      .select('*, staff_profile:staff_profile_id(*)')
      .eq('id', assignmentId)
      .single();
    if (error) throw error;
    assignment = data;
  } else {
    const { data, error } = await supabase
      .from('staff_assignments')
      .select('*, staff_profile:staff_profile_id(*)')
      .eq('booking_id', bookingId)
      .eq('staff_profile_id', staffProfileId)
      .order('start_time', { ascending: true });
    if (error) throw error;
    assignment = (data || [])[0] || null;
  }

  if (!assignment) {
    return { success: false, reason: 'assignment_not_found' };
  }

  const nowIso = new Date().toISOString();
  const { data: existingRows, error: existingError } = await supabase
    .from('time_clock_shifts')
    .select('*')
    .eq('staff_assignment_id', assignment.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (existingError && !isMissingRelationError(existingError)) throw existingError;
  const existing = existingRows?.[0] || null;
  const shouldCheckIn = action === 'check_in' || (action === 'toggle' && (!existing || existing.status === 'completed' || existing.status === 'flagged'));
  const nextStatus = shouldCheckIn ? 'in_progress' : 'completed';
  let shift = null;

  if (existing && !shouldCheckIn) {
    const update = {
      actual_check_out: nowIso,
      status: nextStatus,
      notes: normalizePlainText(payload.notes || existing.notes || '', 2000),
      updated_at: nowIso,
    };
    const { data, error } = await supabase
      .from('time_clock_shifts')
      .update(update)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) {
      if (isMissingRelationError(error)) return { success: false, reason: 'time_clock_table_missing' };
      throw error;
    }
    shift = data;
  } else if (existing && shouldCheckIn && existing.status === 'in_progress') {
    shift = existing;
  } else {
    const insert = {
      user_id: assignment.user_id || payload.userId || payload.user_id || null,
      booking_id: assignment.booking_id || bookingId,
      staff_assignment_id: assignment.id,
      staff_profile_id: assignment.staff_profile_id || staffProfileId,
      scheduled_start: assignment.start_time || null,
      scheduled_end: assignment.end_time || null,
      actual_check_in: nowIso,
      actual_check_out: shouldCheckIn ? null : nowIso,
      break_minutes: Number.isFinite(Number(payload.breakMinutes || payload.break_minutes)) ? Number(payload.breakMinutes || payload.break_minutes) : 0,
      status: shouldCheckIn ? 'in_progress' : 'completed',
      notes: normalizePlainText(payload.notes || '', 2000),
      token_zone_id: verified.payload?.zoneId || null,
      audit_log: [{
        at: nowIso,
        action: shouldCheckIn ? 'check_in' : 'check_out',
        via: 'qr',
      }],
      created_at: nowIso,
      updated_at: nowIso,
    };
    const { data, error } = await supabase
      .from('time_clock_shifts')
      .insert(insert)
      .select('*')
      .single();
    if (error) {
      if (isMissingRelationError(error)) return { success: false, reason: 'time_clock_table_missing' };
      throw error;
    }
    shift = data;
  }

  return {
    success: true,
    action: shouldCheckIn ? 'check_in' : 'check_out',
    assignment,
    shift,
  };
}

async function overrideTimeClockShift(payload = {}) {
  const userId = ensureUserId(payload);
  const shiftId = payload.shiftId || payload.id;
  if (!shiftId) throw new Error('Missing shiftId.');
  const nowIso = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from('time_clock_shifts')
    .select('*')
    .eq('id', shiftId)
    .single();
  if (existingError) {
    if (isMissingRelationError(existingError)) return { shift: null, warning: 'time_clock_shifts table missing.' };
    throw existingError;
  }
  const next = {
    actual_check_in: payload.actualCheckIn !== undefined ? normalizeStageDateTime(payload.actualCheckIn) : existing.actual_check_in,
    actual_check_out: payload.actualCheckOut !== undefined ? normalizeStageDateTime(payload.actualCheckOut) : existing.actual_check_out,
    break_minutes: payload.breakMinutes !== undefined ? Math.max(0, Number(payload.breakMinutes) || 0) : existing.break_minutes,
    status: normalizePlainText(payload.status || existing.status || 'flagged', 40) || 'flagged',
    notes: normalizePlainText(payload.notes || existing.notes || '', 3000),
    updated_at: nowIso,
  };
  const auditLog = Array.isArray(existing.audit_log) ? [...existing.audit_log] : [];
  auditLog.unshift({
    at: nowIso,
    action: 'manager_override',
    byUserId: userId,
    reason: normalizePlainText(payload.reason || payload.overrideReason || 'Manual override', 300),
  });
  next.audit_log = auditLog.slice(0, 50);

  const { data, error } = await supabase
    .from('time_clock_shifts')
    .update(next)
    .eq('id', shiftId)
    .select('*')
    .single();
  if (error) throw error;
  return { shift: data };
}

async function getTimeClockShifts(payload = {}) {
  let query = supabase
    .from('time_clock_shifts')
    .select('*, staff_assignment:staff_assignment_id(*), staff_profile:staff_profile_id(*)')
    .order('created_at', { ascending: false });
  if (payload.userId || payload.user_id) query = query.eq('user_id', payload.userId || payload.user_id);
  if (payload.bookingId || payload.eventId) query = query.eq('booking_id', payload.bookingId || payload.eventId);
  if (payload.staffProfileId || payload.staff_profile_id) query = query.eq('staff_profile_id', payload.staffProfileId || payload.staff_profile_id);
  if (payload.assignmentId || payload.staffAssignmentId) query = query.eq('staff_assignment_id', payload.assignmentId || payload.staffAssignmentId);
  if (payload.startFrom) query = query.gte('scheduled_start', normalizeStageDateTime(payload.startFrom) || payload.startFrom);
  if (payload.startTo) query = query.lte('scheduled_start', normalizeStageDateTime(payload.startTo) || payload.startTo);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { shifts: [], warning: 'time_clock_shifts table missing.' };
    throw error;
  }
  return { shifts: data || [] };
}

async function getPayrollExport(payload = {}) {
  const userId = ensureUserId(payload);
  const bookingId = payload.bookingId || payload.eventId || payload.booking_id || null;
  let assignmentQuery = supabase
    .from('staff_assignments')
    .select('*, staff_profile:staff_profile_id(*)')
    .eq('user_id', userId)
    .order('start_time', { ascending: true });
  if (bookingId) assignmentQuery = assignmentQuery.eq('booking_id', bookingId);
  if (payload.startFrom) assignmentQuery = assignmentQuery.gte('start_time', normalizeStageDateTime(payload.startFrom) || payload.startFrom);
  if (payload.startTo) assignmentQuery = assignmentQuery.lte('start_time', normalizeStageDateTime(payload.startTo) || payload.startTo);
  const { data: assignments, error: assignmentError } = await assignmentQuery;
  if (assignmentError) throw assignmentError;
  const assignmentIds = (assignments || []).map((row) => row.id).filter(Boolean);

  let shiftRows = [];
  if (assignmentIds.length) {
    const { data, error } = await supabase
      .from('time_clock_shifts')
      .select('*')
      .in('staff_assignment_id', assignmentIds);
    if (error && !isMissingRelationError(error)) throw error;
    shiftRows = data || [];
  }

  const payroll = calculatePayrollRows(assignments || [], shiftRows, {
    externalTransactionId: normalizePlainText(payload.externalTransactionId || '', 120),
  });
  if (payload.groupBy === 'person') {
    const byPerson = payroll.rows.reduce((acc, row) => {
      const key = row.staffProfileId || row.staffName;
      const current = acc[key] || {
        staffProfileId: row.staffProfileId,
        staffName: row.staffName,
        payType: row.payType,
        hours: 0,
        grossPay: 0,
        eventCount: 0,
      };
      current.hours += Number(row.hours || 0);
      current.grossPay += Number(row.grossPay || 0);
      current.eventCount += 1;
      acc[key] = current;
      return acc;
    }, {});
    payroll.byPerson = Object.values(byPerson).map((row) => ({
      ...row,
      hours: Number(row.hours.toFixed(2)),
      grossPay: Number(row.grossPay.toFixed(2)),
    })).sort((a, b) => b.grossPay - a.grossPay);
  }

  return {
    ...payroll,
    bookingId: bookingId || null,
    generatedAt: new Date().toISOString(),
    quickbooks: {
      connected: false,
      status: 'coming_soon',
      message: 'QuickBooks payroll sync is not connected yet. Use CSV export.',
    },
  };
}

async function exportPayrollCsv(payload = {}) {
  const payroll = await getPayrollExport(payload);
  const csv = buildPayrollCsv(payroll.rows || []);
  const fileLabel = payload.bookingId || payload.eventId || 'range';
  return {
    csv,
    mimeType: 'text/csv',
    fileName: `payroll-${toSlug(String(fileLabel))}.csv`,
    downloadUrl: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
    summary: payroll.summary || {},
  };
}

async function getVolunteerHoursReport(payload = {}) {
  const payroll = await getPayrollExport(payload);
  const summary = summarizeVolunteerHours(payroll.rows || []);
  return {
    ...summary,
    generatedAt: new Date().toISOString(),
  };
}

async function listCompletionTasks(payload = {}) {
  const userId = ensureUserId(payload);
  let query = supabase
    .from('completion_tasks')
    .select('*')
    .eq('assigned_to_user_id', userId)
    .order('created_at', { ascending: false });
  if (payload.status) query = query.eq('status', normalizeCompletionTaskStatus(payload.status));
  else if (payload.includeCompleted !== true) query = query.neq('status', 'complete');
  if (payload.entityType) query = query.eq('entity_type', normalizePlainText(payload.entityType, 80));
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { tasks: [], warning: 'completion_tasks table missing.' };
    throw error;
  }
  return { tasks: data || [] };
}

async function createCompletionTask(payload = {}) {
  const userId = ensureUserId(payload);
  const task = payload.task || {};
  const nowIso = new Date().toISOString();
  const next = {
    assigned_to_user_id: userId,
    created_by_user_id: userId,
    entity_type: normalizePlainText(task.entityType || task.entity_type || payload.entityType || 'entity', 120) || 'entity',
    entity_id: normalizePlainText(task.entityId || task.entity_id || payload.entityId || '', 120) || null,
    title: normalizePlainText(task.title || payload.title || 'Complete missing fields', 220) || 'Complete missing fields',
    missing_fields_json: Array.isArray(task.missingFields || task.missing_fields_json || payload.missingFields)
      ? (task.missingFields || task.missing_fields_json || payload.missingFields).map((field) => normalizePlainText(field, 180)).filter(Boolean)
      : [],
    status: normalizeCompletionTaskStatus(task.status || payload.status || 'open'),
    priority: normalizeCompletionTaskPriority(task.priority || payload.priority || 'normal'),
    due_at: normalizeStageDateTime(task.dueAt || task.due_at || payload.dueAt) || null,
    reminder_cadence: Array.isArray(task.reminderCadence || task.reminder_cadence)
      ? (task.reminderCadence || task.reminder_cadence).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
      : [24, 72, 168],
    source_type: normalizePlainText(task.sourceType || task.source_type || payload.sourceType || 'ai_assist', 60) || 'ai_assist',
    source_context: normalizePlainText(task.sourceContext || task.source_context || payload.sourceContext || '', 180),
    metadata: (task.metadata && typeof task.metadata === 'object') ? task.metadata : {},
    created_at: nowIso,
    updated_at: nowIso,
  };
  const { data, error } = await supabase
    .from('completion_tasks')
    .insert(next)
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) return { task: null, warning: 'completion_tasks table missing.' };
    throw error;
  }
  return { task: data };
}

async function updateCompletionTask(payload = {}) {
  const userId = ensureUserId(payload);
  const taskId = payload.taskId || payload.id;
  if (!taskId) throw new Error('Missing taskId.');
  const updates = payload.updates || {};
  const nowIso = new Date().toISOString();
  const next = {
    updated_at: nowIso,
  };
  if (updates.status !== undefined) next.status = normalizeCompletionTaskStatus(updates.status);
  if (updates.priority !== undefined) next.priority = normalizeCompletionTaskPriority(updates.priority);
  if (updates.title !== undefined) next.title = normalizePlainText(updates.title, 220);
  if (updates.dueAt !== undefined || updates.due_at !== undefined) next.due_at = normalizeStageDateTime(updates.dueAt || updates.due_at) || null;
  if (updates.missingFields !== undefined || updates.missing_fields_json !== undefined) {
    const value = updates.missingFields || updates.missing_fields_json;
    next.missing_fields_json = Array.isArray(value) ? value.map((field) => normalizePlainText(field, 180)).filter(Boolean) : [];
  }
  if (updates.metadata !== undefined && updates.metadata && typeof updates.metadata === 'object') next.metadata = updates.metadata;
  if (next.status === 'complete') next.completed_at = nowIso;
  const { data, error } = await supabase
    .from('completion_tasks')
    .update(next)
    .eq('id', taskId)
    .eq('assigned_to_user_id', userId)
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) return { task: null, warning: 'completion_tasks table missing.' };
    throw error;
  }
  return { task: data };
}

async function sendCompletionReminders(payload = {}) {
  const userId = ensureUserId(payload);
  const { tasks } = await listCompletionTasks({
    userId,
    status: 'open',
    includeCompleted: false,
  });
  if (!tasks?.length) return { sent: 0, total: 0, reminders: [] };

  const { data: userRow } = await supabase
    .from('users')
    .select('name,email,cell_phone')
    .eq('id', userId)
    .single();
  const recipientName = normalizePlainText(userRow?.name || 'friend', 120) || 'friend';
  const recipientEmail = normalizePlainText(userRow?.email || '', 240);
  const recipientPhone = normalizePlainText(userRow?.cell_phone || '', 80);

  const reminders = [];
  let sent = 0;
  for (const task of tasks) {
    const text = buildProfessorGoodReminder(task, recipientName);
    let sms = { success: false, error: 'No phone' };
    let email = { success: false, error: 'No email' };
    if (recipientPhone) sms = await sendTwilioMessage(recipientPhone, text);
    if (recipientEmail) {
      try {
        const emailRes = await sendEmail({
          to: recipientEmail,
          subject: PROFESSOR_GOOD_REMINDER_TEMPLATE.subject,
          html: `<p>${escapeHtml(text)}</p>`,
        });
        email = { success: !!emailRes?.emailId, emailId: emailRes?.emailId || null };
      } catch (err) {
        email = { success: false, error: err.message };
      }
    }
    if (sms.success || email.success) sent += 1;
    reminders.push({ taskId: task.id, sms, email });
    await supabase
      .from('completion_tasks')
      .update({
        reminder_last_sent_at: new Date().toISOString(),
        reminder_count: Math.max(0, Number(task.reminder_count || 0)) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);
  }
  return { sent, total: tasks.length, reminders };
}

async function logAiAssistRun(payload = {}) {
  const userId = payload.userId || payload.user_id || null;
  const eventId = payload.eventId || payload.bookingId || payload.event_id || null;
  const log = {
    user_id: userId,
    event_id: eventId,
    form_type: normalizePlainText(payload.formType || payload.form_type || '', 80),
    source_type: normalizePlainText(payload.sourceType || payload.source_type || 'paste', 60) || 'paste',
    source_context: normalizePlainText(payload.sourceContext || payload.source_context || '', 180),
    fields_applied: Array.isArray(payload.fieldsApplied || payload.fields_applied)
      ? (payload.fieldsApplied || payload.fields_applied).map((field) => normalizePlainText(field, 180)).filter(Boolean)
      : [],
    proposed_count: Math.max(0, Number(payload.proposedCount || payload.proposed_count || 0)),
    applied_count: Math.max(0, Number(payload.appliedCount || payload.applied_count || 0)),
    metadata: (payload.metadata && typeof payload.metadata === 'object') ? payload.metadata : {},
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('ai_assist_audit_logs')
    .insert(log)
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) return { logged: false, warning: 'ai_assist_audit_logs table missing.' };
    throw error;
  }
  return { logged: true, log: data };
}

function normalizeTicketingProviderType(value) {
  return normalizePlainText(value || '', 80).toLowerCase();
}

async function getTicketingProviders() {
  const { data, error } = await supabase
    .from('ticketing_providers')
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) {
      return {
        providers: [
          { id: 'eventbrite', name: 'Eventbrite', type: 'eventbrite', auth_type: 'api_key', is_active: true },
          { id: 'ticketmaster', name: 'Ticketmaster', type: 'ticketmaster', auth_type: 'oauth', is_active: true },
        ],
        warning: 'ticketing_providers table missing; run latest SQL migration.',
      };
    }
    throw error;
  }
  return { providers: data || [] };
}

async function getVenueTicketingConnections(payload = {}) {
  const userId = payload.userId || payload.user_id;
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id;
  if (!venueProfileId) throw new Error('Missing venueProfileId.');

  let query = supabase
    .from('venue_ticketing_connections')
    .select('*, ticketing_provider:ticketing_provider_id(*)')
    .eq('venue_profile_id', venueProfileId)
    .order('updated_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { connections: [], warning: 'venue_ticketing_connections table missing.' };
    throw error;
  }
  return { connections: data || [] };
}

async function upsertVenueTicketingConnection(payload = {}) {
  const userId = ensureUserId(payload);
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id;
  const connection = payload.connection || {};
  if (!venueProfileId) throw new Error('Missing venueProfileId.');

  let providerId = connection.ticketing_provider_id || connection.ticketingProviderId || payload.ticketingProviderId;
  const providerType = normalizeTicketingProviderType(connection.providerType || connection.type || payload.providerType);
  if (!providerId && providerType) {
    const { data: providerMatch } = await supabase
      .from('ticketing_providers')
      .select('id')
      .eq('type', providerType)
      .single();
    providerId = providerMatch?.id;
  }
  if (!providerId) throw new Error('Missing ticketing provider for connection.');

  const next = {
    user_id: userId,
    venue_profile_id: venueProfileId,
    ticketing_provider_id: providerId,
    oauth_access_token: connection.oauthAccessToken ?? connection.oauth_access_token ?? null,
    oauth_refresh_token: connection.oauthRefreshToken ?? connection.oauth_refresh_token ?? null,
    api_key: connection.apiKey ?? connection.api_key ?? null,
    account_id: normalizePlainText(connection.accountId ?? connection.account_id ?? '', 200) || null,
    connection_status: normalizePlainText((connection.connectionStatus ?? connection.connection_status ?? 'connected'), 40) || 'connected',
    is_default: !!(connection.isDefault ?? connection.is_default),
    manual_mode: !!(connection.manualMode ?? connection.manual_mode),
    metadata: (connection.metadata && typeof connection.metadata === 'object') ? connection.metadata : {},
    last_synced_at: normalizeStageDateTime(connection.lastSyncedAt ?? connection.last_synced_at) || null,
    updated_at: new Date().toISOString(),
  };

  let saved = null;
  const connectionId = payload.connectionId || payload.id || connection.id;
  if (connectionId) {
    const { data, error } = await supabase
      .from('venue_ticketing_connections')
      .update(next)
      .eq('id', connectionId)
      .select('*, ticketing_provider:ticketing_provider_id(*)')
      .single();
    if (error) throw error;
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('venue_ticketing_connections')
      .upsert({ ...next, created_at: new Date().toISOString() }, { onConflict: 'venue_profile_id,ticketing_provider_id' })
      .select('*, ticketing_provider:ticketing_provider_id(*)')
      .single();
    if (error) throw error;
    saved = data;
  }

  if (next.is_default) {
    await supabase
      .from('venue_ticketing_connections')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('venue_profile_id', venueProfileId)
      .neq('id', saved.id);
    await resilientServerUpdate('venue_profiles', {
      default_ticketing_provider_id: providerId,
      updated_at: new Date().toISOString(),
    }, 'id', venueProfileId);
  }

  return { connection: saved };
}

async function removeVenueTicketingConnection(payload = {}) {
  const connectionId = payload.connectionId || payload.id;
  if (!connectionId) throw new Error('Missing connectionId.');

  const { data: row } = await supabase
    .from('venue_ticketing_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  const { error } = await supabase
    .from('venue_ticketing_connections')
    .delete()
    .eq('id', connectionId);
  if (error) throw error;

  if (row?.is_default && row?.venue_profile_id) {
    await resilientServerUpdate('venue_profiles', {
      default_ticketing_provider_id: null,
      updated_at: new Date().toISOString(),
    }, 'id', row.venue_profile_id);
  }

  return { removed: true, connectionId };
}

async function getBookingTicketingRecords(payload = {}) {
  const userId = payload.userId || payload.user_id;
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!bookingId) throw new Error('Missing bookingId/eventId.');

  let query = supabase
    .from('booking_ticketing_records')
    .select('*, ticketing_provider:ticketing_provider_id(*)')
    .eq('booking_id', bookingId)
    .order('updated_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { records: [], warning: 'booking_ticketing_records table missing.' };
    throw error;
  }
  return { records: data || [] };
}

async function resolveBookingVenueProfileId(eventRow = {}, payload = {}) {
  return payload.venueProfileId
    || payload.venue_profile_id
    || eventRow.venue_profile_id
    || payload.event?.venueProfileId
    || null;
}

async function getTicketingProvider(providerInput = {}) {
  const providerId = providerInput.providerId || providerInput.ticketingProviderId || providerInput.id;
  const providerType = normalizeTicketingProviderType(providerInput.providerType || providerInput.type);
  if (providerId) {
    const { data, error } = await supabase.from('ticketing_providers').select('*').eq('id', providerId).single();
    if (error) throw error;
    return data;
  }
  if (providerType) {
    const { data, error } = await supabase.from('ticketing_providers').select('*').eq('type', providerType).single();
    if (error) throw error;
    return data;
  }
  return null;
}

async function getVenueTicketingConnection(venueProfileId, providerId, userId = null) {
  if (!venueProfileId || !providerId) return null;
  let query = supabase
    .from('venue_ticketing_connections')
    .select('*, ticketing_provider:ticketing_provider_id(*)')
    .eq('venue_profile_id', venueProfileId)
    .eq('ticketing_provider_id', providerId)
    .single();
  if (userId) query = query.eq('user_id', userId);
  const { data } = await query;
  return data || null;
}

function buildTicketingService(providerType, context = {}) {
  const type = normalizeTicketingProviderType(providerType || 'manual');
  if (type === 'eventbrite') {
    return {
      type: 'eventbrite',
      supportsCreate: true,
      supportsSales: true,
      async createEvent(params = {}) {
        const tokenFromConnection = context.connection?.api_key || '';
        const venueIdOverride = context.connection?.account_id || undefined;
        const res = await createEventbrite(params.event, params.venue, {
          token: tokenFromConnection || undefined,
          venueId: venueIdOverride,
          capacity: params.capacity || 100,
        });
        return {
          externalEventId: res.eventId,
          externalEventUrl: res.eventUrl,
          ticketSalesUrl: res.eventUrl,
          raw: res,
        };
      },
      async fetchSales(params = {}) {
        if (!params.externalEventId) throw new Error('Missing Eventbrite externalEventId.');
        return fetchEventbriteTicketingSnapshot(params.externalEventId, context.connection?.api_key || null);
      },
      async fetchEvent(params = {}) {
        if (!params.externalEventId) return null;
        return {
          externalEventId: params.externalEventId,
          externalEventUrl: `https://www.eventbrite.com/e/${params.externalEventId}`,
        };
      },
      async updateEvent() {
        return { ok: false, warning: 'Eventbrite updateEvent not yet implemented in connector layer.' };
      },
      async deleteEvent() {
        return { ok: false, warning: 'Eventbrite deleteEvent not yet implemented in connector layer.' };
      },
    };
  }
  if (type === 'ticketmaster') {
    return {
      type: 'ticketmaster',
      supportsCreate: false,
      supportsSales: false,
      async createEvent() {
        throw new Error('Ticketmaster API create is not enabled yet. Use "Link Existing Ticketing Event".');
      },
      async fetchSales() {
        return null;
      },
      async fetchEvent(params = {}) {
        const url = firstValidHttpUrl(params.externalEventUrl || '');
        const eventId = normalizePlainText(params.externalEventId || extractTicketmasterEventId(url) || '', 180);
        return {
          externalEventId: eventId || null,
          externalEventUrl: url || (eventId ? `https://www.ticketmaster.com/event/${eventId}` : null),
          ticketSalesUrl: url || null,
        };
      },
      async updateEvent() {
        return { ok: false, warning: 'Ticketmaster API connector pending OAuth/API scope enablement.' };
      },
      async deleteEvent() {
        return { ok: false, warning: 'Ticketmaster API connector pending OAuth/API scope enablement.' };
      },
      todo: 'Implement Ticketmaster OAuth/API calls once credentials/scopes are approved.',
    };
  }
  return {
    type: 'manual',
    supportsCreate: false,
    supportsSales: false,
    async createEvent() {
      throw new Error('Manual provider cannot auto-create events.');
    },
    async fetchSales() {
      return null;
    },
    async fetchEvent(params = {}) {
      return {
        externalEventId: normalizePlainText(params.externalEventId || '', 180) || null,
        externalEventUrl: firstValidHttpUrl(params.externalEventUrl || '') || null,
        ticketSalesUrl: firstValidHttpUrl(params.ticketSalesUrl || params.externalEventUrl || '') || null,
      };
    },
    async updateEvent() {
      return { ok: false, warning: 'Manual provider updateEvent not supported.' };
    },
    async deleteEvent() {
      return { ok: false, warning: 'Manual provider deleteEvent not supported.' };
    },
  };
}

function extractTicketmasterEventId(url = '') {
  const text = String(url || '');
  if (!text) return '';
  const eventMatch = text.match(/\/event\/([A-Za-z0-9\-]+)/i);
  if (eventMatch?.[1]) return eventMatch[1];
  const idMatch = text.match(/[?&]id=([A-Za-z0-9\-]+)/i);
  return idMatch?.[1] || '';
}

async function upsertBookingTicketingRecordRow(recordInput = {}) {
  const nowIso = new Date().toISOString();
  const clean = {
    user_id: recordInput.user_id,
    booking_id: recordInput.booking_id,
    ticketing_provider_id: recordInput.ticketing_provider_id || null,
    external_event_id: normalizePlainText(recordInput.external_event_id || '', 220) || null,
    external_event_url: firstValidHttpUrl(recordInput.external_event_url || '') || null,
    ticket_sales_url: firstValidHttpUrl(recordInput.ticket_sales_url || '') || null,
    gross_sales: Number.isFinite(Number(recordInput.gross_sales)) ? Number(recordInput.gross_sales) : null,
    tickets_sold: Number.isFinite(Number(recordInput.tickets_sold)) ? Math.max(0, Math.round(Number(recordInput.tickets_sold))) : null,
    manual_mode: !!recordInput.manual_mode,
    sync_status: normalizePlainText(recordInput.sync_status || 'linked', 40) || 'linked',
    last_synced_at: normalizeStageDateTime(recordInput.last_synced_at) || null,
    metadata: (recordInput.metadata && typeof recordInput.metadata === 'object') ? recordInput.metadata : {},
    updated_at: nowIso,
  };

  if (recordInput.id) {
    const { data, error } = await supabase
      .from('booking_ticketing_records')
      .update(clean)
      .eq('id', recordInput.id)
      .select('*, ticketing_provider:ticketing_provider_id(*)')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('booking_ticketing_records')
    .insert({ ...clean, created_at: nowIso })
    .select('*, ticketing_provider:ticketing_provider_id(*)')
    .single();
  if (error) throw error;
  return data;
}

async function createBookingTicketingEvent(payload = {}) {
  const userId = ensureUserId(payload);
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!bookingId) throw new Error('Missing bookingId/eventId.');

  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', bookingId)
    .single();
  if (eventError) throw eventError;

  const provider = await getTicketingProvider({
    providerId: payload.ticketingProviderId || payload.providerId,
    providerType: payload.providerType || payload.provider,
  });
  if (!provider) throw new Error('Ticketing provider not found.');

  const venueProfileId = await resolveBookingVenueProfileId(eventRow, payload);
  const connection = await getVenueTicketingConnection(venueProfileId, provider.id, userId);
  const service = buildTicketingService(provider.type, { connection, provider });
  if (!service.supportsCreate) {
    return {
      created: false,
      needsManualLink: true,
      provider,
      warning: `${provider.name} auto-create is not available yet. Use "Link Existing Ticketing Event".`,
    };
  }

  const venue = {
    name: eventRow.venue_name,
    address: eventRow.venue_address,
    city: eventRow.venue_city,
    state: eventRow.venue_state,
    website: '',
  };

  const created = await service.createEvent({
    event: {
      ...eventRow,
      venue: eventRow.venue_name,
      date: eventRow.date,
      time: eventRow.time,
      ticketPrice: eventRow.ticket_price,
      isFree: !eventRow.ticket_price,
    },
    venue,
    capacity: payload.capacity || eventRow.production_details?.seatsAvailable || 100,
  });

  const savedRecord = await upsertBookingTicketingRecordRow({
    user_id: userId,
    booking_id: bookingId,
    ticketing_provider_id: provider.id,
    external_event_id: created.externalEventId || null,
    external_event_url: created.externalEventUrl || null,
    ticket_sales_url: created.ticketSalesUrl || created.externalEventUrl || null,
    manual_mode: false,
    sync_status: 'connected',
    last_synced_at: new Date().toISOString(),
    metadata: { createResult: created.raw || created },
  });

  const updatedEvent = await resilientServerUpdate('events', {
    ticket_provider: provider.type,
    ticket_provider_event_id: created.externalEventId || null,
    selected_ticketing_provider_id: provider.id,
    ticketing_manual_mode: false,
    ticket_link: firstValidHttpUrl(created.ticketSalesUrl || created.externalEventUrl || eventRow.ticket_link),
    updated_at: new Date().toISOString(),
  }, 'id', bookingId);

  let snapshot = null;
  if (service.supportsSales && created.externalEventId) {
    try {
      const snapshotPayload = await service.fetchSales({ externalEventId: created.externalEventId });
      snapshot = await persistTicketingSnapshot(userId, bookingId, provider.type, created.externalEventId, snapshotPayload);
      await resilientServerUpdate('booking_ticketing_records', {
        gross_sales: snapshot?.gross_revenue ?? null,
        tickets_sold: snapshot?.tickets_sold ?? null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, 'id', savedRecord.id);
    } catch (err) {
      // Do not fail create flow when snapshot fetch is unavailable.
      snapshot = null;
    }
  }

  return {
    created: true,
    provider,
    connectionStatus: connection?.connection_status || 'connected',
    bookingTicketingRecord: savedRecord,
    event: updatedEvent,
    snapshot,
  };
}

async function linkBookingTicketingEvent(payload = {}) {
  const userId = ensureUserId(payload);
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!bookingId) throw new Error('Missing bookingId/eventId.');

  const provider = await getTicketingProvider({
    providerId: payload.ticketingProviderId || payload.providerId,
    providerType: payload.providerType || payload.provider,
  });
  if (!provider) throw new Error('Ticketing provider not found.');

  const externalEventUrl = firstValidHttpUrl(
    payload.externalEventUrl,
    payload.eventUrl,
    payload.ticketSalesUrl
  );
  const externalEventId = normalizePlainText(
    payload.externalEventId
      || (provider.type === 'ticketmaster' ? extractTicketmasterEventId(externalEventUrl) : '')
      || '',
    220
  );
  if (!externalEventUrl && !externalEventId) {
    throw new Error('Provide at least an external event URL or external event ID.');
  }

  const savedRecord = await upsertBookingTicketingRecordRow({
    id: payload.recordId || payload.id || null,
    user_id: userId,
    booking_id: bookingId,
    ticketing_provider_id: provider.id,
    external_event_id: externalEventId || null,
    external_event_url: externalEventUrl || null,
    ticket_sales_url: firstValidHttpUrl(payload.ticketSalesUrl || externalEventUrl || ''),
    gross_sales: payload.grossSales,
    tickets_sold: payload.ticketsSold,
    manual_mode: !!(payload.manualMode ?? true),
    sync_status: 'linked',
    last_synced_at: normalizeStageDateTime(payload.lastSyncedAt) || null,
    metadata: payload.metadata || {},
  });

  const updatedEvent = await resilientServerUpdate('events', {
    ticket_provider: provider.type,
    ticket_provider_event_id: externalEventId || null,
    selected_ticketing_provider_id: provider.id,
    ticketing_manual_mode: !!(payload.manualMode ?? true),
    ticket_link: externalEventUrl || null,
    updated_at: new Date().toISOString(),
  }, 'id', bookingId);

  return {
    linked: true,
    provider,
    bookingTicketingRecord: savedRecord,
    event: updatedEvent,
  };
}

async function persistTicketingSnapshot(userId, eventId, providerType, providerEventId, snapshotPayload = null) {
  if (!snapshotPayload) return null;
  const nowIso = new Date().toISOString();
  const snapshotInsert = {
    user_id: userId,
    event_id: eventId,
    provider: providerType,
    provider_event_id: providerEventId || null,
    seats_available: snapshotPayload.seatsAvailable ?? null,
    tickets_sold: snapshotPayload.ticketsSold ?? null,
    gross_revenue: snapshotPayload.grossRevenue ?? null,
    net_revenue: snapshotPayload.netRevenue ?? null,
    currency: snapshotPayload.currency || 'USD',
    raw_payload: snapshotPayload.raw || {},
    synced_at: nowIso,
    created_at: nowIso,
  };
  const { data, error } = await supabase
    .from('ticketing_snapshots')
    .insert(snapshotInsert)
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) return { ...snapshotInsert, id: null };
    throw error;
  }
  return data;
}

async function syncBookingTicketingRecord(payload = {}) {
  const userId = ensureUserId(payload);
  const recordId = payload.recordId || payload.id || null;
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;

  let record = null;
  if (recordId) {
    const { data, error } = await supabase
      .from('booking_ticketing_records')
      .select('*, ticketing_provider:ticketing_provider_id(*)')
      .eq('id', recordId)
      .single();
    if (error) throw error;
    record = data;
  } else if (bookingId) {
    const { data } = await supabase
      .from('booking_ticketing_records')
      .select('*, ticketing_provider:ticketing_provider_id(*)')
      .eq('booking_id', bookingId)
      .order('updated_at', { ascending: false })
      .limit(1);
    record = data?.[0] || null;
  }
  if (!record) throw new Error('No booking ticketing record found to sync.');

  const providerType = normalizeTicketingProviderType(record.ticketing_provider?.type || payload.providerType || '');
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id;
  const connection = venueProfileId && record.ticketing_provider_id
    ? await getVenueTicketingConnection(venueProfileId, record.ticketing_provider_id, userId)
    : null;
  const service = buildTicketingService(providerType, { provider: record.ticketing_provider, connection });

  let snapshot = null;
  if (service.supportsSales && record.external_event_id) {
    snapshot = await service.fetchSales({ externalEventId: record.external_event_id, externalEventUrl: record.external_event_url });
  } else {
    const { data: eventRow } = await supabase.from('events').select('*').eq('id', record.booking_id).single();
    snapshot = buildManualTicketingSnapshot(payload, eventRow || {}, providerType || 'manual');
  }

  const snapshotRow = await persistTicketingSnapshot(
    userId,
    record.booking_id,
    providerType || 'manual',
    record.external_event_id,
    snapshot
  );

  const nowIso = new Date().toISOString();
  const syncedRecord = await upsertBookingTicketingRecordRow({
    ...record,
    gross_sales: snapshotRow?.gross_revenue ?? snapshot?.grossRevenue ?? record.gross_sales,
    tickets_sold: snapshotRow?.tickets_sold ?? snapshot?.ticketsSold ?? record.tickets_sold,
    last_synced_at: nowIso,
    sync_status: 'synced',
    manual_mode: !service.supportsSales,
    metadata: { ...(record.metadata || {}), lastSyncSource: service.type },
  });

  const { data: eventRow } = await supabase.from('events').select('*').eq('id', record.booking_id).single();
  const productionDetails = eventRow?.production_details || {};
  const mergedProductionDetails = {
    ...productionDetails,
    seatsAvailable: snapshot?.seatsAvailable ?? productionDetails.seatsAvailable ?? '',
    ticketSalesCount: snapshot?.ticketsSold ?? productionDetails.ticketSalesCount ?? '',
    grossTicketRevenue: snapshot?.grossRevenue ?? productionDetails.grossTicketRevenue ?? '',
    netPayoutRevenue: snapshot?.netRevenue ?? productionDetails.netPayoutRevenue ?? '',
    analyticsSource: `ticketing:${providerType || 'manual'}`,
    analyticsLastSyncedAt: nowIso,
    ticketProvider: providerType || 'manual',
    ticketProviderEventId: record.external_event_id || '',
  };

  const updatedEvent = await resilientServerUpdate('events', {
    ticket_provider: providerType || 'manual',
    ticket_provider_event_id: record.external_event_id || null,
    selected_ticketing_provider_id: record.ticketing_provider_id || null,
    ticketing_manual_mode: !service.supportsSales,
    production_details: mergedProductionDetails,
    updated_at: nowIso,
  }, 'id', record.booking_id);

  return {
    synced: true,
    providerType: providerType || 'manual',
    bookingTicketingRecord: syncedRecord,
    snapshot: snapshotRow,
    event: updatedEvent,
  };
}

async function getProductionChecklists(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId.');

  const { data: checklists, error } = await supabase
    .from('production_checklists')
    .select('*, items:production_checklist_items(*)')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  if (error) {
    if (isMissingRelationError(error)) return { checklists: [], warning: 'production_checklists table missing.' };
    throw error;
  }
  return { checklists: checklists || [] };
}

async function upsertProductionChecklist(payload = {}) {
  const userId = ensureUserId(payload);
  const checklist = payload.checklist || {};
  const eventId = payload.eventId || payload.bookingId || checklist.event_id || checklist.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for checklist.');

  const next = {
    user_id: userId,
    event_id: eventId,
    show_configuration_id: checklist.showConfigurationId || checklist.show_configuration_id || null,
    stage_plot_document_id: checklist.stagePlotDocumentId || checklist.stage_plot_document_id || null,
    title: normalizePlainText(checklist.title || 'Production Checklist', 180) || 'Production Checklist',
    phase: normalizePlainText(checklist.phase || 'preflight', 80) || 'preflight',
    status: normalizePlainText(checklist.status || 'draft', 40) || 'draft',
    metadata: (checklist.metadata && typeof checklist.metadata === 'object') ? checklist.metadata : {},
    updated_at: new Date().toISOString(),
  };
  const checklistId = payload.checklistId || payload.id || checklist.id;
  let saved = null;
  if (checklistId) {
    const { data, error } = await supabase
      .from('production_checklists')
      .update(next)
      .eq('id', checklistId)
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('production_checklists')
      .insert({ ...next, created_at: new Date().toISOString() })
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  }
  return { checklist: saved };
}

async function upsertProductionChecklistItem(payload = {}) {
  const item = payload.item || {};
  const checklistId = payload.checklistId || payload.parentId || item.checklist_id || item.checklistId;
  if (!checklistId) throw new Error('Missing checklistId for checklist item.');

  const nowIso = new Date().toISOString();
  const next = {
    checklist_id: checklistId,
    sort_order: Number.isFinite(Number(item.sortOrder ?? item.sort_order)) ? Number(item.sortOrder ?? item.sort_order) : 0,
    category: normalizePlainText(item.category || 'general', 80) || 'general',
    label: normalizePlainText(item.label || '', 240),
    required: item.required !== false,
    status: normalizePlainText(item.status || 'todo', 40) || 'todo',
    provider_scope: normalizePlainText(item.providerScope || item.provider_scope || 'house', 80) || 'house',
    assignee_name: normalizePlainText(item.assigneeName || item.assignee_name || '', 180),
    assignee_role: normalizePlainText(item.assigneeRole || item.assignee_role || '', 180),
    due_at: normalizeStageDateTime(item.dueAt || item.due_at) || null,
    checked_at: normalizeStageDateTime(item.checkedAt || item.checked_at) || null,
    notes: normalizePlainText(item.notes || '', 3000),
    metadata: (item.metadata && typeof item.metadata === 'object') ? item.metadata : {},
    updated_at: nowIso,
  };
  if (!next.label) throw new Error('Checklist item label is required.');

  const itemId = payload.itemId || payload.id || item.id;
  if (itemId) {
    const { data, error } = await supabase
      .from('production_checklist_items')
      .update(next)
      .eq('id', itemId)
      .select('*')
      .single();
    if (error) throw error;
    return { item: data };
  }
  const { data, error } = await supabase
    .from('production_checklist_items')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { item: data };
}

async function deleteProductionChecklistItem(payload = {}) {
  const itemId = payload.itemId || payload.id;
  if (!itemId) throw new Error('Missing itemId.');
  const { error } = await supabase
    .from('production_checklist_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
  return { removed: true, itemId };
}

async function getVenueInventory(payload = {}) {
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id;
  if (!venueProfileId) throw new Error('Missing venueProfileId.');
  let query = supabase
    .from('venue_inventory_items')
    .select('*')
    .eq('venue_profile_id', venueProfileId)
    .order('item_name', { ascending: true });
  if (payload.userId || payload.user_id) query = query.eq('user_id', payload.userId || payload.user_id);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { inventory: [], warning: 'venue_inventory_items table missing.' };
    throw error;
  }
  return { inventory: data || [] };
}

async function upsertVenueInventoryItem(payload = {}) {
  const userId = ensureUserId(payload);
  const item = payload.item || {};
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id || item.venueProfileId || item.venue_profile_id;
  if (!venueProfileId) throw new Error('Missing venueProfileId.');
  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    venue_profile_id: venueProfileId,
    item_name: normalizePlainText(item.itemName || item.item_name || '', 220),
    category: normalizePlainText(item.category || '', 120),
    subcategory: normalizePlainText(item.subcategory || '', 120),
    quantity: Number.isFinite(Number(item.quantity)) ? Math.max(0, Math.round(Number(item.quantity))) : 1,
    unit: normalizePlainText(item.unit || 'ea', 20) || 'ea',
    serial_number: normalizePlainText(item.serialNumber || item.serial_number || '', 120),
    ownership: normalizePlainText(item.ownership || 'house', 40) || 'house',
    location: normalizePlainText(item.location || '', 200),
    status: normalizePlainText(item.status || 'active', 40) || 'active',
    last_service_at: normalizeStageDateTime(item.lastServiceAt || item.last_service_at) || null,
    next_service_due_at: normalizeStageDateTime(item.nextServiceDueAt || item.next_service_due_at) || null,
    maintenance_interval_days: Number.isFinite(Number(item.maintenanceIntervalDays ?? item.maintenance_interval_days))
      ? Math.max(0, Math.round(Number(item.maintenanceIntervalDays ?? item.maintenance_interval_days)))
      : null,
    notes: normalizePlainText(item.notes || '', 3000),
    metadata: (item.metadata && typeof item.metadata === 'object') ? item.metadata : {},
    updated_at: nowIso,
  };
  if (!next.item_name) throw new Error('Inventory item name is required.');

  const itemId = payload.itemId || payload.id || item.id;
  if (itemId) {
    const { data, error } = await supabase
      .from('venue_inventory_items')
      .update(next)
      .eq('id', itemId)
      .select('*')
      .single();
    if (error) throw error;
    return { item: data };
  }
  const { data, error } = await supabase
    .from('venue_inventory_items')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { item: data };
}

function normalizeSupplierType(value) {
  const type = normalizePlainText(value || 'local_store', 80).toLowerCase();
  return ['local_store', 'online_store', 'distributor', 'rental_house', 'service_vendor'].includes(type)
    ? type
    : 'local_store';
}

async function searchLocalSuppliers(query, venueId, userId, maxResults = 8) {
  if (!venueId) return [];
  const pattern = `%${String(query).replace(/[%_]/g, '').trim()}%`;
  let search = supabase
    .from('venue_suppliers')
    .select('id, supplier_name, supplier_type, city, state, google_place_id, website_url')
    .eq('venue_id', venueId)
    .ilike('supplier_name', pattern)
    .order('supplier_name', { ascending: true })
    .limit(maxResults);
  if (userId) search = search.eq('user_id', userId);

  const { data, error } = await search;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data || []).map((row) => ({
    id: row.id,
    placeId: row.google_place_id || '',
    label: [row.supplier_name, [row.city, row.state].filter(Boolean).join(', ')].filter(Boolean).join(' - '),
    mainText: row.supplier_name || '',
    secondaryText: [row.city, row.state].filter(Boolean).join(', '),
    source: 'local',
    supplierType: row.supplier_type || 'local_store',
    localSupplierId: row.id,
    metadata: {
      websiteUrl: row.website_url || '',
    },
  }));
}

async function readPlaceCache(placeId, placeType = 'supplier') {
  if (!placeId) return null;
  const { data, error } = await supabase
    .from('google_place_cache')
    .select('*')
    .eq('place_id', placeId)
    .eq('place_type', placeType)
    .single();
  if (error) {
    if (isMissingRelationError(error)) return null;
    return null;
  }
  return data || null;
}

async function writePlaceCache(placeId, payload, placeType = 'supplier') {
  if (!placeId || !payload || typeof payload !== 'object') return;
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('google_place_cache')
    .upsert({
      place_id: placeId,
      place_type: placeType,
      payload,
      fetched_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: 'place_id' });
  if (error && !isMissingRelationError(error)) {
    // best effort cache
    console.warn('[suppliers] google_place_cache write failed:', error.message);
  }
}

function mapGooglePlaceDetailsToSupplier(result = {}) {
  const components = parseAddressComponents(result.address_components || []);
  const city = components.locality || components.sublocality_level_1 || '';
  const state = components.administrative_area_level_1 || '';
  const postalCode = components.postal_code || '';
  return {
    googlePlaceId: result.place_id || '',
    supplierName: result.name || '',
    supplierType: 'local_store',
    addressLine1: result.formatted_address || '',
    addressLine2: '',
    city,
    state,
    postalCode,
    country: components.country || 'US',
    phone: result.formatted_phone_number || result.international_phone_number || '',
    websiteUrl: result.website || '',
    orderingUrl: result.website || '',
  };
}

async function searchSuppliers(payload = {}) {
  const query = normalizePlainText(payload.query || payload.input || '', 180);
  const maxResults = Math.min(Math.max(Number(payload.maxResults) || 8, 1), 15);
  if (!query || query.length < 2) {
    return { suggestions: [], source: 'none' };
  }

  const venueId = payload.venueProfileId || payload.venue_profile_id || payload.venueId || payload.venue_id || '';
  const userId = payload.userId || payload.user_id || null;
  const localSuggestions = await searchLocalSuppliers(query, venueId, userId, maxResults);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { suggestions: localSuggestions, source: 'local', warning: 'Google Places key not configured' };
  }

  const params = new URLSearchParams({
    input: query,
    types: 'establishment',
    components: 'country:us',
    key: apiKey,
  });
  if (payload.sessionToken) {
    params.set('sessiontoken', normalizePlainText(payload.sessionToken, 120));
  }
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
  const data = await response.json().catch(() => ({}));
  const status = data.status || 'UNKNOWN_ERROR';
  if (status !== 'OK' && status !== 'ZERO_RESULTS') {
    return {
      suggestions: localSuggestions,
      source: 'local',
      warning: `Google Places autocomplete error: ${data.error_message || status}`,
    };
  }

  const googleSuggestions = (data.predictions || []).slice(0, maxResults).map((prediction) => ({
    id: prediction.place_id,
    placeId: prediction.place_id,
    label: prediction.description || '',
    mainText: prediction.structured_formatting?.main_text || prediction.description || '',
    secondaryText: prediction.structured_formatting?.secondary_text || '',
    source: 'google',
    supplierType: 'local_store',
  }));

  const combined = [];
  const seen = new Set();
  for (const suggestion of [...googleSuggestions, ...localSuggestions]) {
    const key = `${String(suggestion.placeId || '')}|${String(suggestion.mainText || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(suggestion);
  }

  return {
    suggestions: combined.slice(0, maxResults),
    source: googleSuggestions.length ? 'google+local' : 'local',
  };
}

async function getSupplierDetails(payload = {}) {
  const placeId = normalizePlainText(payload.placeId || payload.id || '', 220);
  if (!placeId) throw new Error('Missing placeId for supplier details.');

  const cached = await readPlaceCache(placeId, 'supplier');
  if (cached?.payload && typeof cached.payload === 'object') {
    return {
      supplier: {
        ...cached.payload,
        googlePlaceId: placeId,
      },
      source: 'cache',
    };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('Google Places key not configured');

  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,url,address_component',
    key: apiKey,
  });
  if (payload.sessionToken) {
    params.set('sessiontoken', normalizePlainText(payload.sessionToken, 120));
  }

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const data = await response.json().catch(() => ({}));
  const status = data.status || 'UNKNOWN_ERROR';
  if (status !== 'OK' || !data.result) {
    throw new Error(`Google Place Details error: ${data.error_message || status}`);
  }

  const supplier = mapGooglePlaceDetailsToSupplier(data.result);
  await writePlaceCache(placeId, supplier, 'supplier');
  return {
    supplier,
    source: 'google',
  };
}

async function getVenueSuppliers(payload = {}) {
  const venueId = payload.venueProfileId || payload.venue_profile_id || payload.venueId || payload.venue_id;
  if (!venueId) throw new Error('Missing venueProfileId.');
  const userId = payload.userId || payload.user_id || null;
  const supplierType = payload.supplierType || payload.supplier_type || '';
  const activeOnly = payload.activeOnly === true;

  let query = supabase
    .from('venue_suppliers')
    .select('*')
    .eq('venue_id', venueId)
    .order('is_active', { ascending: false })
    .order('supplier_name', { ascending: true });
  if (userId) query = query.eq('user_id', userId);
  if (supplierType) query = query.eq('supplier_type', normalizeSupplierType(supplierType));
  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      return { suppliers: [], warning: 'venue_suppliers table missing.' };
    }
    throw error;
  }
  const suppliers = data || [];
  if (!suppliers.length) {
    return { suppliers: [], suggestedSuppliers: DEFAULT_SUPPLIER_SUGGESTIONS };
  }

  const supplierIds = suppliers.map((supplier) => supplier.id);
  let contactRows = [];
  let linkRows = [];

  const [{ data: contactsData, error: contactsError }, { data: linksData, error: linksError }] = await Promise.all([
    supabase
      .from('supplier_contacts')
      .select('*')
      .in('venue_supplier_id', supplierIds)
      .order('is_primary', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('inventory_item_supplier_links')
      .select('venue_supplier_id, inventory_item_id')
      .in('venue_supplier_id', supplierIds),
  ]);

  if (!contactsError) contactRows = contactsData || [];
  if (!linksError) linkRows = linksData || [];

  const contactsBySupplier = new Map();
  contactRows.forEach((row) => {
    const list = contactsBySupplier.get(row.venue_supplier_id) || [];
    list.push(row);
    contactsBySupplier.set(row.venue_supplier_id, list);
  });

  const inventoryCounts = new Map();
  linkRows.forEach((row) => {
    if (!row.venue_supplier_id || !row.inventory_item_id) return;
    const set = inventoryCounts.get(row.venue_supplier_id) || new Set();
    set.add(row.inventory_item_id);
    inventoryCounts.set(row.venue_supplier_id, set);
  });

  return {
    suppliers: suppliers.map((supplier) => {
      const contacts = contactsBySupplier.get(supplier.id) || [];
      const primaryContact = contacts.find((contact) => contact.is_primary) || contacts[0] || null;
      return {
        ...supplier,
        contacts,
        contact_count: contacts.length,
        primary_contact: primaryContact,
        linked_item_count: (inventoryCounts.get(supplier.id) || new Set()).size,
      };
    }),
    suggestedSuppliers: DEFAULT_SUPPLIER_SUGGESTIONS,
  };
}

async function upsertVenueSupplier(payload = {}) {
  const userId = ensureUserId(payload);
  const supplier = payload.supplier || {};
  const venueId = payload.venueProfileId || payload.venue_profile_id || payload.venueId || payload.venue_id || supplier.venueId || supplier.venue_id;
  if (!venueId) throw new Error('Missing venueProfileId.');

  const supplierType = normalizeSupplierType(supplier.supplierType || supplier.supplier_type || 'local_store');
  const websiteUrl = firstValidHttpUrl(supplier.websiteUrl || supplier.website_url || '') || '';
  const orderingUrl = firstValidHttpUrl(supplier.orderingUrl || supplier.ordering_url || '') || '';
  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    venue_id: venueId,
    supplier_name: normalizePlainText(supplier.supplierName || supplier.supplier_name || '', 220),
    supplier_type: supplierType,
    google_place_id: normalizePlainText(supplier.googlePlaceId || supplier.google_place_id || '', 220) || null,
    address_line1: normalizePlainText(supplier.addressLine1 || supplier.address_line1 || '', 220),
    address_line2: normalizePlainText(supplier.addressLine2 || supplier.address_line2 || '', 220),
    city: normalizePlainText(supplier.city || '', 120),
    state: normalizePlainText(supplier.state || '', 80),
    postal_code: normalizePlainText(supplier.postalCode || supplier.postal_code || '', 40),
    country: normalizePlainText(supplier.country || 'US', 60) || 'US',
    phone: normalizePlainText(supplier.phone || '', 80) || null,
    email: normalizePlainText(supplier.email || '', 240) || null,
    website_url: websiteUrl || null,
    ordering_url: orderingUrl || null,
    account_number: normalizePlainText(supplier.accountNumber || supplier.account_number || '', 120) || null,
    notes: normalizePlainText(supplier.notes || '', 4000) || null,
    is_active: supplier.isActive === false ? false : true,
    metadata: (supplier.metadata && typeof supplier.metadata === 'object') ? supplier.metadata : {},
    updated_at: nowIso,
  };

  if (!next.supplier_name) throw new Error('Supplier name is required.');
  if (supplierType === 'online_store' && !next.website_url && !next.ordering_url) {
    throw new Error('Online suppliers require website URL or ordering URL.');
  }

  if (next.google_place_id) {
    const cached = await readPlaceCache(next.google_place_id, 'supplier');
    if (cached?.payload && typeof cached.payload === 'object') {
      const cachedPayload = cached.payload;
      next.address_line1 = next.address_line1 || normalizePlainText(cachedPayload.addressLine1 || '', 220);
      next.city = next.city || normalizePlainText(cachedPayload.city || '', 120);
      next.state = next.state || normalizePlainText(cachedPayload.state || '', 80);
      next.postal_code = next.postal_code || normalizePlainText(cachedPayload.postalCode || '', 40);
      next.country = next.country || normalizePlainText(cachedPayload.country || 'US', 60);
      next.phone = next.phone || normalizePlainText(cachedPayload.phone || '', 80) || null;
      next.website_url = next.website_url || firstValidHttpUrl(cachedPayload.websiteUrl || '') || null;
      next.ordering_url = next.ordering_url || firstValidHttpUrl(cachedPayload.orderingUrl || cachedPayload.websiteUrl || '') || null;
    }
  }

  const supplierId = payload.supplierId || payload.id || supplier.id;
  let saved = null;
  if (supplierId) {
    const { data, error } = await supabase
      .from('venue_suppliers')
      .update(next)
      .eq('id', supplierId)
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('venue_suppliers')
      .insert({ ...next, created_at: nowIso })
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  }
  return { supplier: saved };
}

async function deleteVenueSupplier(payload = {}) {
  const supplierId = payload.supplierId || payload.id;
  if (!supplierId) throw new Error('Missing supplierId.');
  const { error } = await supabase
    .from('venue_suppliers')
    .delete()
    .eq('id', supplierId);
  if (error) throw error;
  return { removed: true, supplierId };
}

async function getSupplierContacts(payload = {}) {
  const supplierId = payload.supplierId || payload.venueSupplierId || payload.venue_supplier_id;
  const venueId = payload.venueProfileId || payload.venue_profile_id;
  let query = supabase
    .from('supplier_contacts')
    .select('*')
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true });

  if (supplierId) {
    query = query.eq('venue_supplier_id', supplierId);
  } else if (venueId) {
    const { data: suppliers, error: supplierError } = await supabase
      .from('venue_suppliers')
      .select('id')
      .eq('venue_id', venueId);
    if (supplierError) {
      if (isMissingRelationError(supplierError)) return { contacts: [] };
      throw supplierError;
    }
    const ids = (suppliers || []).map((supplier) => supplier.id);
    if (!ids.length) return { contacts: [] };
    query = query.in('venue_supplier_id', ids);
  } else {
    throw new Error('Missing supplierId or venueProfileId.');
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { contacts: [], warning: 'supplier_contacts table missing.' };
    throw error;
  }
  return { contacts: data || [] };
}

async function upsertSupplierContact(payload = {}) {
  const contact = payload.contact || {};
  const venueSupplierId = payload.supplierId || payload.venueSupplierId || payload.venue_supplier_id || contact.venueSupplierId || contact.venue_supplier_id;
  if (!venueSupplierId) throw new Error('Missing venueSupplierId.');
  const nowIso = new Date().toISOString();
  const next = {
    venue_supplier_id: venueSupplierId,
    name: normalizePlainText(contact.name || '', 180),
    title: normalizePlainText(contact.title || '', 160),
    phone: normalizePlainText(contact.phone || '', 80),
    email: normalizePlainText(contact.email || '', 240),
    notes: normalizePlainText(contact.notes || '', 2000),
    is_primary: !!(contact.isPrimary ?? contact.is_primary),
    updated_at: nowIso,
  };
  if (!next.name) throw new Error('Supplier contact name is required.');

  const contactId = payload.contactId || payload.id || contact.id;
  let saved = null;
  if (contactId) {
    const { data, error } = await supabase
      .from('supplier_contacts')
      .update(next)
      .eq('id', contactId)
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('supplier_contacts')
      .insert({ ...next, created_at: nowIso })
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  }

  if (saved?.is_primary) {
    await supabase
      .from('supplier_contacts')
      .update({ is_primary: false, updated_at: nowIso })
      .eq('venue_supplier_id', venueSupplierId)
      .neq('id', saved.id);
  }
  return { contact: saved };
}

async function deleteSupplierContact(payload = {}) {
  const contactId = payload.contactId || payload.id;
  if (!contactId) throw new Error('Missing contactId.');
  const { error } = await supabase
    .from('supplier_contacts')
    .delete()
    .eq('id', contactId);
  if (error) throw error;
  return { removed: true, contactId };
}

async function getInventorySupplierLinks(payload = {}) {
  const inventoryItemId = payload.inventoryItemId || payload.inventory_item_id || '';
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id || '';
  const userId = payload.userId || payload.user_id || '';
  let inventoryIds = [];

  if (inventoryItemId) {
    inventoryIds = [inventoryItemId];
  } else if (venueProfileId) {
    let inventoryQuery = supabase
      .from('venue_inventory_items')
      .select('id')
      .eq('venue_profile_id', venueProfileId);
    if (userId) inventoryQuery = inventoryQuery.eq('user_id', userId);
    const { data: inventoryRows, error: inventoryError } = await inventoryQuery;
    if (inventoryError) {
      if (isMissingRelationError(inventoryError)) return { links: [], warning: 'inventory tables missing.' };
      throw inventoryError;
    }
    inventoryIds = (inventoryRows || []).map((row) => row.id);
    if (!inventoryIds.length) return { links: [] };
  } else {
    throw new Error('Missing inventoryItemId or venueProfileId.');
  }

  let query = supabase
    .from('inventory_item_supplier_links')
    .select('*, supplier:venue_supplier_id(*), inventory_item:inventory_item_id(id,item_name,venue_profile_id)')
    .in('inventory_item_id', inventoryIds)
    .order('preferred', { ascending: false })
    .order('updated_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { links: [], warning: 'inventory_item_supplier_links table missing.' };
    throw error;
  }
  return { links: data || [] };
}

async function upsertInventorySupplierLink(payload = {}) {
  const userId = ensureUserId(payload);
  const link = payload.link || {};
  const inventoryItemId = payload.inventoryItemId || payload.inventory_item_id || link.inventoryItemId || link.inventory_item_id;
  const supplierId = payload.supplierId || payload.venueSupplierId || payload.venue_supplier_id || link.supplierId || link.venueSupplierId || link.venue_supplier_id;
  if (!inventoryItemId) throw new Error('Missing inventoryItemId.');
  if (!supplierId) throw new Error('Missing venueSupplierId.');

  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    inventory_item_id: inventoryItemId,
    venue_supplier_id: supplierId,
    supplier_sku: normalizePlainText(link.supplierSku || link.supplier_sku || '', 180) || null,
    supplier_item_url: firstValidHttpUrl(link.supplierItemUrl || link.supplier_item_url || '') || null,
    preferred: !!(link.preferred ?? false),
    last_price_paid: Number.isFinite(Number(link.lastPricePaid ?? link.last_price_paid))
      ? Number(link.lastPricePaid ?? link.last_price_paid)
      : null,
    notes: normalizePlainText(link.notes || '', 2000) || null,
    metadata: (link.metadata && typeof link.metadata === 'object') ? link.metadata : {},
    updated_at: nowIso,
  };

  const linkId = payload.linkId || payload.id || link.id;
  let saved = null;
  if (linkId) {
    const { data, error } = await supabase
      .from('inventory_item_supplier_links')
      .update(next)
      .eq('id', linkId)
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('inventory_item_supplier_links')
      .upsert({ ...next, created_at: nowIso }, { onConflict: 'inventory_item_id,venue_supplier_id' })
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  }

  if (saved?.preferred) {
    await supabase
      .from('inventory_item_supplier_links')
      .update({ preferred: false, updated_at: nowIso })
      .eq('inventory_item_id', saved.inventory_item_id)
      .neq('id', saved.id);
  }
  return { link: saved };
}

async function deleteInventorySupplierLink(payload = {}) {
  const linkId = payload.linkId || payload.id;
  if (!linkId) throw new Error('Missing linkId.');
  const { error } = await supabase
    .from('inventory_item_supplier_links')
    .delete()
    .eq('id', linkId);
  if (error) throw error;
  return { removed: true, linkId };
}

function calculatePurchaseOrderTotal(items = []) {
  return normalizePoItems(items).reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);
}

function normalizePoStatus(value) {
  const status = normalizePlainText(value || 'draft', 40).toLowerCase();
  return ['draft', 'sent', 'submitted', 'fulfilled', 'cancelled', 'needs_supplier'].includes(status)
    ? status
    : 'draft';
}

async function getBookingPurchaseOrders(payload = {}) {
  const eventId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing bookingId/eventId.');
  const userId = payload.userId || payload.user_id;
  let query = supabase
    .from('booking_purchase_orders')
    .select('*, supplier:venue_supplier_id(*)')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { purchaseOrders: [], warning: 'booking_purchase_orders table missing.' };
    throw error;
  }
  return { purchaseOrders: data || [] };
}

async function upsertBookingPurchaseOrder(payload = {}) {
  const userId = ensureUserId(payload);
  const purchaseOrder = payload.purchaseOrder || payload.po || {};
  const eventId = payload.bookingId || payload.eventId || payload.event?.id || purchaseOrder.eventId || purchaseOrder.event_id;
  if (!eventId) throw new Error('Missing bookingId/eventId.');
  const nowIso = new Date().toISOString();
  const items = normalizePoItems(purchaseOrder.items || payload.items || []);
  const totalAmount = Number.isFinite(Number(purchaseOrder.totalAmount ?? purchaseOrder.total_amount))
    ? Number(purchaseOrder.totalAmount ?? purchaseOrder.total_amount)
    : calculatePurchaseOrderTotal(items);

  const { data: eventRow } = await supabase
    .from('events')
    .select('id, title, venue_profile_id, venue_name, venue_address, venue_city, venue_state')
    .eq('id', eventId)
    .single();

  const venueProfileId = payload.venueProfileId || payload.venue_profile_id || purchaseOrder.venueProfileId || purchaseOrder.venue_profile_id || eventRow?.venue_profile_id || null;
  const supplierId = purchaseOrder.venueSupplierId || purchaseOrder.venue_supplier_id || payload.venueSupplierId || payload.venue_supplier_id || null;
  let supplierRow = null;
  if (supplierId) {
    const { data } = await supabase
      .from('venue_suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();
    supplierRow = data || null;
  }

  const next = {
    user_id: userId,
    event_id: eventId,
    venue_profile_id: venueProfileId,
    venue_supplier_id: supplierId,
    supplier_name: normalizePlainText(
      purchaseOrder.supplierName || purchaseOrder.supplier_name || supplierRow?.supplier_name || '',
      220
    ),
    supplier_email: normalizePlainText(
      purchaseOrder.supplierEmail || purchaseOrder.supplier_email || supplierRow?.email || '',
      240
    ),
    ordering_url: firstValidHttpUrl(
      purchaseOrder.orderingUrl || purchaseOrder.ordering_url || supplierRow?.ordering_url || supplierRow?.website_url || ''
    ) || null,
    supplier_address: normalizePlainText(
      purchaseOrder.supplierAddress || purchaseOrder.supplier_address || formatSupplierAddress(supplierRow || {}),
      800
    ),
    status: normalizePoStatus(purchaseOrder.status),
    currency: normalizePlainText(purchaseOrder.currency || 'USD', 8) || 'USD',
    delivery_instructions: normalizePlainText(purchaseOrder.deliveryInstructions || purchaseOrder.delivery_instructions || '', 2000),
    receiving_hours: normalizePlainText(purchaseOrder.receivingHours || purchaseOrder.receiving_hours || '', 500),
    dock_notes: normalizePlainText(purchaseOrder.dockNotes || purchaseOrder.dock_notes || '', 1000),
    purchaser_name: normalizePlainText(purchaseOrder.purchaserName || purchaseOrder.purchaser_name || '', 180),
    purchaser_email: normalizePlainText(purchaseOrder.purchaserEmail || purchaseOrder.purchaser_email || '', 240),
    split_key: normalizePlainText(purchaseOrder.splitKey || purchaseOrder.split_key || '', 120),
    items,
    total_amount: Number.isFinite(totalAmount) ? totalAmount : null,
    manual_mode: !!(purchaseOrder.manualMode ?? purchaseOrder.manual_mode),
    metadata: (purchaseOrder.metadata && typeof purchaseOrder.metadata === 'object') ? purchaseOrder.metadata : {},
    updated_at: nowIso,
  };

  const poId = payload.purchaseOrderId || payload.id || purchaseOrder.id;
  if (poId) {
    const { data, error } = await supabase
      .from('booking_purchase_orders')
      .update(next)
      .eq('id', poId)
      .select('*, supplier:venue_supplier_id(*)')
      .single();
    if (error) throw error;
    return { purchaseOrder: data };
  }

  const { data, error } = await supabase
    .from('booking_purchase_orders')
    .insert({ ...next, created_at: nowIso })
    .select('*, supplier:venue_supplier_id(*)')
    .single();
  if (error) throw error;
  return { purchaseOrder: data };
}

async function splitBookingPurchaseOrders(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing bookingId/eventId.');
  const items = normalizePoItems(payload.items || []);
  if (!items.length) throw new Error('No items provided for supplier split.');

  const { data: eventRow } = await supabase
    .from('events')
    .select('id, title, venue_profile_id, venue_name, venue_address')
    .eq('id', eventId)
    .single();
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id || eventRow?.venue_profile_id || null;
  if (!venueProfileId) throw new Error('Missing venueProfileId for split routing.');

  const [{ data: supplierRows, error: supplierError }, { data: preferredLinks, error: preferredError }] = await Promise.all([
    supabase
      .from('venue_suppliers')
      .select('*')
      .eq('venue_id', venueProfileId)
      .eq('is_active', true),
    supabase
      .from('inventory_item_supplier_links')
      .select('*')
      .in('inventory_item_id', items.map((item) => item.inventoryItemId).filter(Boolean))
      .eq('preferred', true),
  ]);
  if (supplierError) throw supplierError;
  if (preferredError && !isMissingRelationError(preferredError)) throw preferredError;

  const suppliersById = new Map((supplierRows || []).map((supplier) => [supplier.id, supplier]));
  const preferredByInventory = new Map((preferredLinks || []).map((link) => [link.inventory_item_id, link]));

  const routedItems = items.map((item) => {
    const preferred = preferredByInventory.get(item.inventoryItemId) || null;
    return {
      ...item,
      supplierId: item.supplierId || preferred?.venue_supplier_id || '',
      supplierSku: item.supplierSku || preferred?.supplier_sku || '',
      supplierItemUrl: item.supplierItemUrl || preferred?.supplier_item_url || '',
    };
  });

  const grouped = groupPoItemsBySupplier(routedItems, suppliersById);
  const splitKey = createHash('sha256')
    .update(`${eventId}-${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 16);

  const createdOrders = [];
  for (const group of grouped.groups) {
    const created = await upsertBookingPurchaseOrder({
      userId,
      bookingId: eventId,
      venueProfileId,
      purchaseOrder: {
        supplierName: group.supplierName,
        supplierEmail: group.supplierEmail,
        orderingUrl: group.orderingUrl,
        supplierAddress: group.supplierAddress,
        venueSupplierId: group.supplierId,
        status: 'draft',
        currency: payload.currency || 'USD',
        deliveryInstructions: payload.deliveryInstructions || '',
        receivingHours: payload.receivingHours || '',
        dockNotes: payload.dockNotes || '',
        purchaserName: payload.purchaserName || '',
        purchaserEmail: payload.purchaserEmail || '',
        splitKey,
        manualMode: false,
        items: group.items,
        totalAmount: group.totalAmount,
      },
    });
    if (created?.purchaseOrder) createdOrders.push(created.purchaseOrder);
  }

  return {
    purchaseOrders: createdOrders,
    splitKey,
    unassigned: grouped.unassigned,
    warning: grouped.unassigned.length
      ? 'Some items have no preferred supplier and were left in Unassigned.'
      : undefined,
  };
}

async function generatePoSupplierEmails(payload = {}) {
  const eventId = payload.bookingId || payload.eventId || payload.event?.id;
  const purchaseOrderIds = Array.isArray(payload.purchaseOrderIds) ? payload.purchaseOrderIds : [];
  if (!eventId && !purchaseOrderIds.length) throw new Error('Missing eventId or purchaseOrderIds.');

  let query = supabase
    .from('booking_purchase_orders')
    .select('*, supplier:venue_supplier_id(*)')
    .order('created_at', { ascending: false });

  if (purchaseOrderIds.length) {
    query = query.in('id', purchaseOrderIds);
  } else {
    query = query.eq('event_id', eventId);
  }

  const { data: orders, error } = await query;
  if (error) throw error;
  const rows = orders || [];
  if (!rows.length) return { emailDrafts: [], sent: 0 };

  const venueNameFromPayload = normalizePlainText(payload.venueName || payload.venue?.name || '', 220);
  const venueAddressFromPayload = normalizePlainText(payload.venueAddress || payload.venue?.address || '', 320);

  const emailDrafts = [];
  let sent = 0;
  for (const order of rows) {
    const supplier = order.supplier || {};
    const supplierName = order.supplier_name || supplier.supplier_name || 'Supplier';
    const supplierEmail = order.supplier_email || supplier.email || '';
    const orderingUrl = order.ordering_url || supplier.ordering_url || supplier.website_url || '';
    const venueName = venueNameFromPayload || order.metadata?.venueName || 'Venue';
    const venueAddress = venueAddressFromPayload || order.metadata?.venueAddress || '';
    const subject = buildPurchaseOrderEmailSubject({
      venueName,
      supplierName,
      date: order.created_at,
    });
    const body = buildPurchaseOrderEmailBody({
      venue: { name: venueName, address: venueAddress },
      supplier: {
        ...supplier,
        supplier_name: supplierName,
        email: supplierEmail,
        ordering_url: orderingUrl,
      },
      items: Array.isArray(order.items) ? order.items : [],
      deliveryInstructions: order.delivery_instructions || '',
      receivingHours: order.receiving_hours || '',
      dockNotes: order.dock_notes || '',
      purchaserName: order.purchaser_name || '',
      purchaserEmail: order.purchaser_email || '',
    });
    const html = buildPurchaseOrderEmailHtml({
      venue: { name: venueName, address: venueAddress },
      supplier: {
        ...supplier,
        supplier_name: supplierName,
        email: supplierEmail,
        ordering_url: orderingUrl,
      },
      items: Array.isArray(order.items) ? order.items : [],
      deliveryInstructions: order.delivery_instructions || '',
      receivingHours: order.receiving_hours || '',
      dockNotes: order.dock_notes || '',
      purchaserName: order.purchaser_name || '',
      purchaserEmail: order.purchaser_email || '',
    });
    const internalEmail = normalizePlainText(
      payload.internalPurchaserEmail || payload.internalEmail || order.purchaser_email || '',
      240
    );

    const draft = {
      orderId: order.id,
      supplierName,
      supplierEmail,
      orderingUrl,
      internalEmail,
      subject,
      body,
      html,
      openOrderingUrl: !supplierEmail && orderingUrl ? orderingUrl : '',
    };

    if (payload.sendNow) {
      const sendResults = [];
      if (supplierEmail) {
        const supplierSend = await sendEmail({
          to: supplierEmail,
          subject,
          html,
        });
        sendResults.push({ type: 'supplier', email: supplierEmail, emailId: supplierSend.emailId || null });
        sent += 1;
      }
      if (internalEmail) {
        const internalSend = await sendEmail({
          to: internalEmail,
          subject: `[Copy] ${subject}`,
          html,
        });
        sendResults.push({ type: 'internal', email: internalEmail, emailId: internalSend.emailId || null });
        sent += 1;
      }
      draft.sent = sendResults;
    }

    emailDrafts.push(draft);
  }

  return {
    emailDrafts,
    sent,
    total: emailDrafts.length,
  };
}

async function getVenueMaintenance(payload = {}) {
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id;
  if (!venueProfileId) throw new Error('Missing venueProfileId.');
  const userId = payload.userId || payload.user_id;

  let contactsQuery = supabase
    .from('venue_maintenance_contacts')
    .select('*')
    .eq('venue_profile_id', venueProfileId)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true });
  if (userId) contactsQuery = contactsQuery.eq('user_id', userId);

  let tasksQuery = supabase
    .from('venue_maintenance_tasks')
    .select('*')
    .eq('venue_profile_id', venueProfileId)
    .order('scheduled_for', { ascending: true });
  if (userId) tasksQuery = tasksQuery.eq('user_id', userId);

  const [{ data: contacts, error: contactsError }, { data: tasks, error: tasksError }] = await Promise.all([
    contactsQuery,
    tasksQuery,
  ]);

  if (contactsError || tasksError) {
    const err = contactsError || tasksError;
    if (isMissingRelationError(err)) {
      return { contacts: [], tasks: [], warning: 'venue maintenance tables missing.' };
    }
    throw err;
  }
  return { contacts: contacts || [], tasks: tasks || [] };
}

async function upsertVenueMaintenanceContact(payload = {}) {
  const userId = ensureUserId(payload);
  const contact = payload.contact || {};
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id || contact.venueProfileId || contact.venue_profile_id;
  if (!venueProfileId) throw new Error('Missing venueProfileId.');

  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    venue_profile_id: venueProfileId,
    name: normalizePlainText(contact.name || '', 180),
    role: normalizePlainText(contact.role || '', 140),
    company: normalizePlainText(contact.company || '', 180),
    phone: normalizePlainText(contact.phone || '', 60),
    email: normalizePlainText(contact.email || '', 240),
    contact_type: normalizePlainText(contact.contactType || contact.contact_type || 'vendor', 80) || 'vendor',
    preferred_method: normalizePlainText(contact.preferredMethod || contact.preferred_method || 'email', 40) || 'email',
    is_primary: !!(contact.isPrimary ?? contact.is_primary),
    notes: normalizePlainText(contact.notes || '', 2000),
    metadata: (contact.metadata && typeof contact.metadata === 'object') ? contact.metadata : {},
    updated_at: nowIso,
  };
  if (!next.name) throw new Error('Maintenance contact name is required.');

  const contactId = payload.contactId || payload.id || contact.id;
  let saved = null;
  if (contactId) {
    const { data, error } = await supabase
      .from('venue_maintenance_contacts')
      .update(next)
      .eq('id', contactId)
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('venue_maintenance_contacts')
      .insert({ ...next, created_at: nowIso })
      .select('*')
      .single();
    if (error) throw error;
    saved = data;
  }

  if (saved?.is_primary) {
    await supabase
      .from('venue_maintenance_contacts')
      .update({ is_primary: false, updated_at: nowIso })
      .eq('venue_profile_id', venueProfileId)
      .neq('id', saved.id);
  }

  return { contact: saved };
}

async function upsertVenueMaintenanceTask(payload = {}) {
  const userId = ensureUserId(payload);
  const task = payload.task || {};
  const venueProfileId = payload.venueProfileId || payload.venue_profile_id || task.venueProfileId || task.venue_profile_id;
  if (!venueProfileId) throw new Error('Missing venueProfileId.');

  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    venue_profile_id: venueProfileId,
    inventory_item_id: task.inventoryItemId || task.inventory_item_id || null,
    assigned_contact_id: task.assignedContactId || task.assigned_contact_id || null,
    title: normalizePlainText(task.title || '', 220),
    description: normalizePlainText(task.description || '', 4000),
    status: normalizePlainText(task.status || 'scheduled', 40) || 'scheduled',
    priority: normalizePlainText(task.priority || 'normal', 40) || 'normal',
    scheduled_for: normalizeStageDateTime(task.scheduledFor || task.scheduled_for) || null,
    completed_at: normalizeStageDateTime(task.completedAt || task.completed_at) || null,
    notes: normalizePlainText(task.notes || '', 2000),
    metadata: (task.metadata && typeof task.metadata === 'object') ? task.metadata : {},
    updated_at: nowIso,
  };
  if (!next.title) throw new Error('Maintenance task title is required.');

  const taskId = payload.taskId || payload.id || task.id;
  if (taskId) {
    const { data, error } = await supabase
      .from('venue_maintenance_tasks')
      .update(next)
      .eq('id', taskId)
      .select('*')
      .single();
    if (error) throw error;
    return { task: data };
  }
  const { data, error } = await supabase
    .from('venue_maintenance_tasks')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { task: data };
}

async function getBookingDocuments(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId.');
  let query = supabase
    .from('booking_documents')
    .select('*, template:template_id(*)')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  if (payload.userId || payload.user_id) query = query.eq('user_id', payload.userId || payload.user_id);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { documents: [], warning: 'booking_documents table missing.' };
    throw error;
  }
  return { documents: data || [] };
}

function collectDocumentAutofillPayload(event = {}, extra = {}) {
  const addressParts = [event.venue_address, event.venue_city, event.venue_state].filter(Boolean).join(', ');
  return {
    event_title: event.title || '',
    event_date: event.date || '',
    event_time: event.time || '',
    event_venue: event.venue_name || '',
    event_address: addressParts,
    ticket_link: event.ticket_link || '',
    ticket_provider: event.ticket_provider || '',
    ...extra,
  };
}

function renderTemplateWithPayload(templateBody = '', payload = {}) {
  const source = String(templateBody || '');
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, key) => (
    payload[key] !== undefined && payload[key] !== null ? String(payload[key]) : ''
  ));
}

async function upsertBookingDocument(payload = {}) {
  const userId = ensureUserId(payload);
  const doc = payload.document || {};
  const eventId = payload.eventId || payload.bookingId || doc.eventId || doc.event_id || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId.');
  const nowIso = new Date().toISOString();

  const next = {
    user_id: userId,
    event_id: eventId,
    template_id: doc.templateId || doc.template_id || null,
    doc_type: normalizePlainText(doc.docType || doc.doc_type || 'contract', 80) || 'contract',
    title: normalizePlainText(doc.title || '', 220),
    status: normalizePlainText(doc.status || 'draft', 40) || 'draft',
    draft_body: String(doc.draftBody ?? doc.draft_body ?? ''),
    final_body: String(doc.finalBody ?? doc.final_body ?? ''),
    autofill_payload: (doc.autofillPayload && typeof doc.autofillPayload === 'object') ? doc.autofillPayload : (doc.autofill_payload || {}),
    pdf_base64: doc.pdfBase64 ?? doc.pdf_base64 ?? null,
    pdf_filename: doc.pdfFilename ?? doc.pdf_filename ?? null,
    share_token: normalizePlainText(doc.shareToken || doc.share_token || '', 120) || null,
    sent_at: normalizeStageDateTime(doc.sentAt || doc.sent_at) || null,
    signed_at: normalizeStageDateTime(doc.signedAt || doc.signed_at) || null,
    metadata: (doc.metadata && typeof doc.metadata === 'object') ? doc.metadata : {},
    updated_at: nowIso,
  };
  if (!next.title) next.title = `${next.doc_type} · ${eventId}`;

  const docId = payload.documentId || payload.id || doc.id;
  if (docId) {
    const { data, error } = await supabase
      .from('booking_documents')
      .update(next)
      .eq('id', docId)
      .select('*, template:template_id(*)')
      .single();
    if (error) throw error;
    return { document: data };
  }
  const { data, error } = await supabase
    .from('booking_documents')
    .insert({ ...next, created_at: nowIso })
    .select('*, template:template_id(*)')
    .single();
  if (error) throw error;
  return { document: data };
}

async function autofillBookingDocument(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId.');
  const templateId = payload.templateId || payload.documentTemplateId;
  if (!templateId) throw new Error('Missing templateId.');

  const [{ data: eventRow, error: eventError }, { data: template, error: templateError }] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('document_templates').select('*').eq('id', templateId).single(),
  ]);
  if (eventError) throw eventError;
  if (templateError) throw templateError;

  const mergedPayload = collectDocumentAutofillPayload(eventRow, payload.autofill || {});
  const rendered = renderTemplateWithPayload(template.template_body || '', mergedPayload);

  return {
    template,
    autofillPayload: mergedPayload,
    renderedBody: rendered,
  };
}

async function getBookingBudgets(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId.');
  const { data, error } = await supabase
    .from('booking_budgets')
    .select('*, lines:booking_budget_lines(*)')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  if (error) {
    if (isMissingRelationError(error)) return { budgets: [], warning: 'booking_budgets table missing.' };
    throw error;
  }
  return { budgets: data || [] };
}

async function upsertBookingBudget(payload = {}) {
  const userId = ensureUserId(payload);
  const budget = payload.budget || {};
  const eventId = payload.eventId || payload.bookingId || budget.eventId || budget.event_id || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId.');
  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    event_id: eventId,
    title: normalizePlainText(budget.title || 'Show Budget', 200) || 'Show Budget',
    currency: normalizePlainText(budget.currency || 'USD', 8) || 'USD',
    status: normalizePlainText(budget.status || 'draft', 40) || 'draft',
    total_budget: Number.isFinite(Number(budget.totalBudget ?? budget.total_budget)) ? Number(budget.totalBudget ?? budget.total_budget) : null,
    estimated_gross: Number.isFinite(Number(budget.estimatedGross ?? budget.estimated_gross)) ? Number(budget.estimatedGross ?? budget.estimated_gross) : null,
    estimated_net: Number.isFinite(Number(budget.estimatedNet ?? budget.estimated_net)) ? Number(budget.estimatedNet ?? budget.estimated_net) : null,
    actual_gross: Number.isFinite(Number(budget.actualGross ?? budget.actual_gross)) ? Number(budget.actualGross ?? budget.actual_gross) : null,
    actual_net: Number.isFinite(Number(budget.actualNet ?? budget.actual_net)) ? Number(budget.actualNet ?? budget.actual_net) : null,
    notes: normalizePlainText(budget.notes || '', 4000),
    metadata: (budget.metadata && typeof budget.metadata === 'object') ? budget.metadata : {},
    updated_at: nowIso,
  };

  const budgetId = payload.budgetId || payload.id || budget.id;
  if (budgetId) {
    const { data, error } = await supabase
      .from('booking_budgets')
      .update(next)
      .eq('id', budgetId)
      .select('*')
      .single();
    if (error) throw error;
    return { budget: data };
  }
  const { data, error } = await supabase
    .from('booking_budgets')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { budget: data };
}

async function upsertBookingBudgetLine(payload = {}) {
  const line = payload.line || {};
  const budgetId = payload.budgetId || payload.parentId || line.budgetId || line.budget_id;
  if (!budgetId) throw new Error('Missing budgetId.');
  const nowIso = new Date().toISOString();
  const next = {
    budget_id: budgetId,
    category: normalizePlainText(line.category || '', 120),
    line_item_name: normalizePlainText(line.lineItemName || line.line_item_name || '', 220),
    vendor_name: normalizePlainText(line.vendorName || line.vendor_name || '', 220),
    cost_type: normalizePlainText(line.costType || line.cost_type || 'estimated', 40) || 'estimated',
    amount: Number.isFinite(Number(line.amount)) ? Number(line.amount) : null,
    quantity: Number.isFinite(Number(line.quantity)) ? Number(line.quantity) : 1,
    tax_rate: Number.isFinite(Number(line.taxRate ?? line.tax_rate)) ? Number(line.taxRate ?? line.tax_rate) : null,
    notes: normalizePlainText(line.notes || '', 3000),
    metadata: (line.metadata && typeof line.metadata === 'object') ? line.metadata : {},
    updated_at: nowIso,
  };
  if (!next.line_item_name) throw new Error('Budget line item name is required.');

  const lineId = payload.lineId || payload.id || line.id;
  if (lineId) {
    const { data, error } = await supabase
      .from('booking_budget_lines')
      .update(next)
      .eq('id', lineId)
      .select('*')
      .single();
    if (error) throw error;
    return { line: data };
  }
  const { data, error } = await supabase
    .from('booking_budget_lines')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { line: data };
}

async function getBookingRiders(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId.');
  const { data, error } = await supabase
    .from('booking_riders')
    .select('*, items:booking_rider_items(*)')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  if (error) {
    if (isMissingRelationError(error)) return { riders: [], warning: 'booking_riders table missing.' };
    throw error;
  }
  return { riders: data || [] };
}

async function upsertBookingRider(payload = {}) {
  const userId = ensureUserId(payload);
  const rider = payload.rider || {};
  const eventId = payload.eventId || payload.bookingId || rider.eventId || rider.event_id || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId.');
  const nowIso = new Date().toISOString();
  const next = {
    user_id: userId,
    event_id: eventId,
    title: normalizePlainText(rider.title || 'Green Room Rider', 200) || 'Green Room Rider',
    rider_type: normalizePlainText(rider.riderType || rider.rider_type || 'hospitality', 80) || 'hospitality',
    status: normalizePlainText(rider.status || 'draft', 40) || 'draft',
    notes: normalizePlainText(rider.notes || '', 4000),
    metadata: (rider.metadata && typeof rider.metadata === 'object') ? rider.metadata : {},
    updated_at: nowIso,
  };
  const riderId = payload.riderId || payload.id || rider.id;
  if (riderId) {
    const { data, error } = await supabase
      .from('booking_riders')
      .update(next)
      .eq('id', riderId)
      .select('*')
      .single();
    if (error) throw error;
    return { rider: data };
  }
  const { data, error } = await supabase
    .from('booking_riders')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { rider: data };
}

async function upsertBookingRiderItem(payload = {}) {
  const item = payload.item || {};
  const riderId = payload.riderId || payload.parentId || item.riderId || item.rider_id;
  if (!riderId) throw new Error('Missing riderId.');
  const nowIso = new Date().toISOString();
  const next = {
    rider_id: riderId,
    section: normalizePlainText(item.section || 'hospitality', 120) || 'hospitality',
    label: normalizePlainText(item.label || '', 240),
    quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
    unit: normalizePlainText(item.unit || 'ea', 20) || 'ea',
    required: item.required !== false,
    status: normalizePlainText(item.status || 'requested', 40) || 'requested',
    provided_by: normalizePlainText(item.providedBy || item.provided_by || 'venue', 80) || 'venue',
    notes: normalizePlainText(item.notes || '', 3000),
    metadata: (item.metadata && typeof item.metadata === 'object') ? item.metadata : {},
    updated_at: nowIso,
  };
  if (!next.label) throw new Error('Rider item label is required.');

  const itemId = payload.itemId || payload.id || item.id;
  if (itemId) {
    const { data, error } = await supabase
      .from('booking_rider_items')
      .update(next)
      .eq('id', itemId)
      .select('*')
      .single();
    if (error) throw error;
    return { item: data };
  }
  const { data, error } = await supabase
    .from('booking_rider_items')
    .insert({ ...next, created_at: nowIso })
    .select('*')
    .single();
  if (error) throw error;
  return { item: data };
}

async function getTicketingSnapshots(payload = {}) {
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for ticketing snapshots.');

  const { data, error } = await supabase
    .from('ticketing_snapshots')
    .select('*')
    .eq('event_id', eventId)
    .order('synced_at', { ascending: false })
    .limit(20);
  if (error) {
    if (isMissingRelationError(error)) {
      return { snapshots: [], warning: 'ticketing_snapshots table missing; run latest SQL migration.' };
    }
    throw error;
  }
  return { snapshots: data || [] };
}

async function syncTicketing(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for ticketing sync.');

  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
  if (eventError) throw eventError;

  const productionDetails = eventRow.production_details || {};
  const provider = normalizePlainText(
    payload.provider
      || payload.ticketProvider
      || eventRow.ticket_provider
      || productionDetails.ticketProvider
      || 'manual',
    60
  ).toLowerCase();
  const providerEventId = normalizePlainText(
    payload.providerEventId
      || payload.ticketProviderEventId
      || eventRow.ticket_provider_event_id
      || productionDetails.ticketProviderEventId,
    140
  );

  let snapshot = null;
  if (provider === 'eventbrite' && providerEventId && process.env.EVENTBRITE_TOKEN) {
    snapshot = await fetchEventbriteTicketingSnapshot(providerEventId);
  } else {
    snapshot = buildManualTicketingSnapshot(payload, eventRow, provider);
  }

  const nowIso = new Date().toISOString();
  const mergedProductionDetails = {
    ...productionDetails,
    seatsAvailable: snapshot.seatsAvailable ?? productionDetails.seatsAvailable ?? '',
    ticketSalesCount: snapshot.ticketsSold ?? productionDetails.ticketSalesCount ?? '',
    grossTicketRevenue: snapshot.grossRevenue ?? productionDetails.grossTicketRevenue ?? '',
    netPayoutRevenue: snapshot.netRevenue ?? productionDetails.netPayoutRevenue ?? '',
    analyticsSource: `ticketing:${provider}`,
    analyticsLastSyncedAt: nowIso,
    ticketProvider: provider,
    ticketProviderEventId: providerEventId || '',
  };

  const updatedEvent = await resilientServerUpdate('events', {
      ticket_provider: provider,
      ticket_provider_event_id: providerEventId || null,
      production_details: mergedProductionDetails,
      updated_at: nowIso,
    }, 'id', eventId);

  let snapshotRow = null;
  const snapshotInsert = {
    user_id: userId,
    event_id: eventId,
    provider,
    provider_event_id: providerEventId || null,
    seats_available: snapshot.seatsAvailable ?? null,
    tickets_sold: snapshot.ticketsSold ?? null,
    gross_revenue: snapshot.grossRevenue ?? null,
    net_revenue: snapshot.netRevenue ?? null,
    currency: snapshot.currency || 'USD',
    raw_payload: snapshot.raw || {},
    synced_at: nowIso,
    created_at: nowIso,
  };
  const { data: insertedSnapshot, error: snapshotError } = await supabase
    .from('ticketing_snapshots')
    .insert(snapshotInsert)
    .select('*')
    .single();

  if (snapshotError && !isMissingRelationError(snapshotError)) {
    throw snapshotError;
  }
  snapshotRow = insertedSnapshot || null;

  return {
    provider,
    providerEventId: providerEventId || '',
    snapshot: snapshotRow || {
      ...snapshotInsert,
      id: null,
    },
    event: updatedEvent,
    warning: snapshotError && isMissingRelationError(snapshotError)
      ? 'ticketing_snapshots table missing; event updated without snapshot history.'
      : undefined,
  };
}

async function searchLocalVenueProfiles(query, userId, maxResults = 8) {
  if (!userId) return [];
  const pattern = `%${String(query).replace(/[%_]/g, '').trim()}%`;
  const { data, error } = await supabase
    .from('venue_profiles')
    .select('id, name, street_number, street_name, suite, city, state, postal_code, phone, website')
    .eq('user_id', userId)
    .ilike('name', pattern)
    .order('name', { ascending: true })
    .limit(maxResults);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  return (data || []).map((row) => {
    const addressParts = [
      [row.street_number, row.street_name].filter(Boolean).join(' ').trim(),
      row.suite || '',
      [row.city, row.state, row.postal_code].filter(Boolean).join(', '),
    ].filter(Boolean);
    const address = addressParts.join(', ');
    return {
      id: row.id,
      placeId: '',
      label: address ? `${row.name} · ${address}` : row.name,
      mainText: row.name || '',
      secondaryText: address,
      source: 'local',
      localVenueProfileId: row.id,
    };
  });
}

async function getLocalVenueDetails(payload = {}) {
  const userId = payload.userId || payload.user_id || null;
  const localVenueProfileId = normalizePlainText(payload.localVenueProfileId || '', 120);
  if (localVenueProfileId) {
    const { data, error } = await supabase
      .from('venue_profiles')
      .select('*')
      .eq('id', localVenueProfileId)
      .single();
    if (!error && data) return mapVenueProfileToVenue(data);
  }
  if (!userId) return null;

  const query = normalizePlainText(payload.query || payload.name || '', 160);
  if (!query) return null;
  const pattern = `%${String(query).replace(/[%_]/g, '').trim()}%`;
  const { data, error } = await supabase
    .from('venue_profiles')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', pattern)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return mapVenueProfileToVenue(data);
}

function mapVenueProfileToVenue(profile = {}) {
  const streetNumber = firstNonEmpty(profile.street_number);
  const streetName = firstNonEmpty(profile.street_name);
  const suite = firstNonEmpty(profile.suite);
  const streetParts = [streetNumber, streetName].filter(Boolean);
  const addressLine1 = streetParts.join(' ').trim();
  const formattedAddress = [addressLine1, suite, [profile.city, profile.state, profile.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    placeId: '',
    name: profile.name || '',
    streetNumber,
    streetName,
    suite,
    address: formattedAddress,
    city: profile.city || '',
    state: profile.state || '',
    zip: profile.postal_code || '',
    phone: profile.phone || '',
    website: profile.website || '',
    googleMapsUrl: '',
    source: 'local',
  };
}

function mapGooglePlaceDetailsToVenue(result = {}) {
  const components = parseAddressComponents(result.address_components || []);
  const streetNumber = components.street_number || '';
  const streetName = components.route || '';
  const suite = components.subpremise || '';
  const line1 = [streetNumber, streetName].filter(Boolean).join(' ').trim();
  return {
    placeId: result.place_id || '',
    name: result.name || '',
    streetNumber,
    streetName,
    suite,
    address: result.formatted_address || [line1, suite, [components.locality, components.administrative_area_level_1, components.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    city: components.locality || components.sublocality_level_1 || '',
    state: components.administrative_area_level_1 || '',
    zip: components.postal_code || '',
    phone: result.formatted_phone_number || result.international_phone_number || '',
    website: result.website || '',
    googleMapsUrl: result.url || '',
    lat: result.geometry?.location?.lat ?? null,
    lng: result.geometry?.location?.lng ?? null,
    source: 'google',
  };
}

function parseAddressComponents(components = []) {
  const mapped = {};
  for (const component of components) {
    if (!component?.types?.length) continue;
    for (const type of component.types) {
      if (!mapped[type]) {
        mapped[type] = component.short_name || component.long_name || '';
      }
    }
  }
  return mapped;
}

async function extractVenueWebsiteSocials(websiteUrl) {
  const url = firstValidHttpUrl(websiteUrl);
  if (!url) return {};

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'IMCMachineBot/1.0 (+https://imc.goodcreativemedia.com)',
      },
    });
    if (!response.ok) return {};
    const html = await response.text();
    if (!html) return {};

    const hrefMatches = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)];
    const links = hrefMatches
      .map((match) => match[1])
      .map((href) => {
        try {
          return new URL(href, url).toString();
        } catch {
          return '';
        }
      })
      .filter(Boolean);

    const pick = (fragment) => links.find((link) => link.toLowerCase().includes(fragment)) || '';
    return {
      instagram: pick('instagram.com'),
      facebook: pick('facebook.com'),
      tiktok: pick('tiktok.com'),
      youtube: pick('youtube.com'),
      linkedin: pick('linkedin.com'),
      twitter: pick('x.com') || pick('twitter.com'),
    };
  } catch {
    return {};
  }
}

async function dispatchStaffingRequest(requestRow = {}, payload = {}) {
  const destinationType = normalizePlainText(
    payload.destinationType
      || payload.destination_type
      || requestRow.destination_type
      || 'manual',
    40
  ) || 'manual';
  const destinationValue = normalizePlainText(
    payload.destinationValue
      || payload.destination_value
      || requestRow.destination_value
      || '',
    500
  );
  const event = payload.event || {};
  const startAt = requestRow.starts_at || requestRow.startsAt || event.bookingStartAt || event.booking_start_at || '';
  const endAt = requestRow.ends_at || requestRow.endsAt || event.bookingEndAt || event.booking_end_at || '';
  const role = requestRow.role || 'Crew role';
  const qty = requestRow.quantity || 1;
  const note = requestRow.notes || '';

  const subject = `${event.title || 'Event'} · Staffing request: ${role}`;
  const body = [
    `Event: ${event.title || 'Untitled Event'}`,
    `Role: ${role}`,
    `Quantity: ${qty}`,
    startAt ? `Start: ${startAt}` : '',
    endAt ? `End: ${endAt}` : '',
    event.venue || event.venue_name ? `Venue: ${event.venue || event.venue_name}` : '',
    note ? `Notes: ${note}` : '',
  ].filter(Boolean).join('\n');

  if (destinationType === 'email') {
    if (!destinationValue) throw new Error('Destination email is required for email dispatch.');
    const emailResult = await sendEmail({
      to: destinationValue,
      subject,
      html: `<pre style="font-family:Inter,Helvetica,Arial,sans-serif;line-height:1.6">${escapeHtml(body)}</pre>`,
    });
    return {
      success: true,
      queued: false,
      destinationType,
      destinationValue,
      provider: 'resend',
      emailId: emailResult.emailId || null,
      sentAt: new Date().toISOString(),
      summary: 'Dispatched via email.',
    };
  }

  if (destinationType === 'webhook') {
    if (!firstValidHttpUrl(destinationValue)) {
      throw new Error('Destination webhook URL must be a valid HTTP(S) URL.');
    }
    const webhookRes = await fetch(destinationValue, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'imc_machine',
        type: 'staffing_request',
        request: requestRow,
        event,
        requestedAt: new Date().toISOString(),
      }),
    });
    const ok = webhookRes.ok;
    const responseText = await webhookRes.text().catch(() => '');
    return {
      success: ok,
      queued: false,
      destinationType,
      destinationValue,
      provider: 'webhook',
      statusCode: webhookRes.status,
      response: responseText.slice(0, 1200),
      sentAt: new Date().toISOString(),
      summary: ok ? 'Dispatched to webhook.' : `Webhook dispatch failed (${webhookRes.status}).`,
    };
  }

  // For job boards / union locals, queue payload so integrations can run when creds/workflows are connected.
  return {
    success: true,
    queued: true,
    destinationType,
    destinationValue,
    provider: destinationType,
    queuedAt: new Date().toISOString(),
    summary: `Queued for ${destinationType} dispatch.`,
    payload: {
      role,
      quantity: qty,
      startsAt: startAt || null,
      endsAt: endAt || null,
      notes: note || '',
      eventId: event.id || requestRow.event_id || null,
      eventTitle: event.title || '',
      venue: event.venue || event.venue_name || '',
    },
  };
}

async function fetchEventbriteTicketingSnapshot(eventbriteEventId, tokenOverride = null) {
  const token = tokenOverride || process.env.EVENTBRITE_TOKEN;
  if (!token) throw new Error('EVENTBRITE_TOKEN not configured for Eventbrite sync.');

  const headers = { Authorization: `Bearer ${token}` };
  const [eventRes, classesRes, attendeesRes] = await Promise.all([
    fetch(`https://www.eventbriteapi.com/v3/events/${eventbriteEventId}/`, { headers }),
    fetch(`https://www.eventbriteapi.com/v3/events/${eventbriteEventId}/ticket_classes/`, { headers }),
    fetch(`https://www.eventbriteapi.com/v3/events/${eventbriteEventId}/attendees/?page_size=1`, { headers }),
  ]);

  const [eventData, classesData, attendeesData] = await Promise.all([
    eventRes.json().catch(() => ({})),
    classesRes.json().catch(() => ({})),
    attendeesRes.json().catch(() => ({})),
  ]);

  if (!eventRes.ok) {
    throw new Error(eventData.error_description || eventData.error || `Eventbrite event lookup failed (${eventRes.status}).`);
  }

  const ticketClasses = Array.isArray(classesData.ticket_classes) ? classesData.ticket_classes : [];
  const soldFromClasses = ticketClasses.reduce((sum, ticketClass) => (
    sum + (Number(ticketClass.quantity_sold) || 0)
  ), 0);
  const soldFromAttendees = Number(attendeesData.pagination?.object_count) || 0;
  const ticketsSold = soldFromAttendees || soldFromClasses;

  const grossRevenue = ticketClasses.reduce((sum, ticketClass) => {
    const sold = Number(ticketClass.quantity_sold) || 0;
    const amount = Number(ticketClass.cost?.major_value) || 0;
    return sum + (sold * amount);
  }, 0);

  const capacity = Number(eventData.capacity) || ticketClasses.reduce((sum, ticketClass) => (
    sum + (Number(ticketClass.quantity_total) || 0)
  ), 0);
  const seatsAvailable = capacity ? Math.max(capacity - ticketsSold, 0) : null;
  const currency = ticketClasses.find((ticketClass) => ticketClass.cost?.currency)?.cost?.currency || eventData.currency || 'USD';

  return {
    seatsAvailable,
    ticketsSold,
    grossRevenue: grossRevenue || null,
    netRevenue: null,
    currency,
    raw: {
      provider: 'eventbrite',
      event: eventData,
      ticket_classes: ticketClasses,
      attendees_pagination: attendeesData.pagination || {},
    },
  };
}

function buildManualTicketingSnapshot(payload = {}, eventRow = {}, provider = 'manual') {
  const pd = eventRow.production_details || {};
  const toInt = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.round(parsed));
  };
  const toFloat = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    seatsAvailable: toInt(
      payload.seatsAvailable
      ?? payload.event?.seatsAvailable
      ?? payload.event?.productionDetails?.seatsAvailable
      ?? pd.seatsAvailable
    ),
    ticketsSold: toInt(
      payload.ticketsSold
      ?? payload.ticketSalesCount
      ?? payload.event?.ticketSalesCount
      ?? payload.event?.productionDetails?.ticketSalesCount
      ?? pd.ticketSalesCount
    ),
    grossRevenue: toFloat(
      payload.grossRevenue
      ?? payload.grossTicketRevenue
      ?? payload.event?.grossTicketRevenue
      ?? payload.event?.productionDetails?.grossTicketRevenue
      ?? pd.grossTicketRevenue
    ),
    netRevenue: toFloat(
      payload.netRevenue
      ?? payload.netPayoutRevenue
      ?? payload.event?.netPayoutRevenue
      ?? payload.event?.productionDetails?.netPayoutRevenue
      ?? pd.netPayoutRevenue
    ),
    currency: normalizePlainText(payload.currency || pd.currency || 'USD', 8) || 'USD',
    raw: {
      provider,
      source: 'manual',
      payload,
    },
  };
}

async function getEventRow(eventId) {
  if (!eventId) return null;
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
  return data || null;
}

function normalizeMerchSplitType(value = 'gross') {
  const normalized = normalizePlainText(value || '', 30).toLowerCase();
  return ['gross', 'net'].includes(normalized) ? normalized : 'gross';
}

function normalizeCaptureMode(value = 'static') {
  const normalized = normalizePlainText(value || '', 40).toLowerCase();
  return ['static', 'multi_cam', 'ai_directed'].includes(normalized) ? normalized : 'static';
}

function normalizeRecordingType(value = 'video') {
  const normalized = normalizePlainText(value || '', 30).toLowerCase();
  return ['video', 'audio', 'both'].includes(normalized) ? normalized : 'video';
}

function normalizeZoomMeetingType(value = 'meeting') {
  const normalized = normalizePlainText(value || '', 30).toLowerCase();
  return ['meeting', 'webinar'].includes(normalized) ? normalized : 'meeting';
}

function normalizeZoomStatus(value = 'not_scheduled') {
  const normalized = normalizePlainText(value || '', 40).toLowerCase();
  return ['not_scheduled', 'scheduled', 'live', 'ended'].includes(normalized) ? normalized : 'not_scheduled';
}

function validateMerchSplitAllocations(allocations = []) {
  if (!Array.isArray(allocations) || !allocations.length) {
    throw new Error('At least one revenue split allocation is required.');
  }
  const normalized = allocations
    .map((row) => ({
      party_type: normalizePlainText(row.partyType || row.party_type || 'other', 80) || 'other',
      party_reference_id: normalizePlainText(row.partyReferenceId || row.party_reference_id || '', 120) || null,
      label: normalizePlainText(row.label || '', 180) || null,
      percentage: Number(row.percentage || 0),
    }))
    .filter((row) => Number.isFinite(row.percentage) && row.percentage >= 0);
  if (!normalized.length) throw new Error('Revenue split allocations contain no valid percentages.');
  const total = normalized.reduce((sum, row) => sum + row.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Revenue split percentages must total 100. Current total: ${total.toFixed(2)}.`);
  }
  return normalized.map((row) => ({ ...row, percentage: Number(row.percentage.toFixed(2)) }));
}

async function getMediaCapturePlan(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for media capture plan.');
  const { data, error } = await supabase
    .from('media_capture_plans')
    .select('*')
    .eq('booking_id', eventId)
    .single();
  if (error) {
    if (isMissingRelationError(error) || error.code === 'PGRST116') return { plan: null };
    throw error;
  }
  return { plan: data || null };
}

async function upsertMediaCapturePlan(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.plan || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for media capture plan.');
  const next = {
    user_id: userId,
    booking_id: eventId,
    recording_type: normalizeRecordingType(input.recordingType || input.recording_type || 'video'),
    capture_mode: normalizeCaptureMode(input.captureMode || input.capture_mode || 'static'),
    primary_platform: normalizePlainText(input.primaryPlatform || input.primary_platform || 'youtube', 80) || 'youtube',
    stream_live: input.streamLive === true || input.stream_live === true,
    post_production_notes: normalizePlainText(input.postProductionNotes || input.post_production_notes || '', 6000),
    rights_clearance_status: normalizePlainText(input.rightsClearanceStatus || input.rights_clearance_status || 'pending', 80) || 'pending',
    distribution_channels: Array.isArray(input.distributionChannels || input.distribution_channels)
      ? (input.distributionChannels || input.distribution_channels).map((row) => normalizePlainText(row, 120)).filter(Boolean)
      : [],
    updated_at: new Date().toISOString(),
  };
  const planId = payload.planId || payload.id || input.id;
  if (planId) {
    const { data, error } = await supabase
      .from('media_capture_plans')
      .update(next)
      .eq('id', planId)
      .select('*')
      .single();
    if (error) throw error;
    return { plan: data };
  }
  const { data, error } = await supabase
    .from('media_capture_plans')
    .upsert({ ...next, created_at: new Date().toISOString() }, { onConflict: 'booking_id' })
    .select('*')
    .single();
  if (error) throw error;
  return { plan: data };
}

async function getCaptureSources(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for capture sources.');
  const { data, error } = await supabase
    .from('capture_sources')
    .select('*')
    .eq('booking_id', eventId)
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) return { sources: [] };
    throw error;
  }
  return { sources: data || [] };
}

async function upsertCaptureSource(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.source || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for capture source.');
  const type = normalizePlainText(input.type || 'camera', 40).toLowerCase();
  const next = {
    user_id: userId,
    booking_id: eventId,
    type: ['camera', 'audio_input'].includes(type) ? type : 'camera',
    name: normalizePlainText(input.name || '', 200),
    location: normalizePlainText(input.location || '', 220),
    operator: normalizePlainText(input.operator || '', 180),
    ai_control_enabled: input.aiControlEnabled === true || input.ai_control_enabled === true,
    metadata: (input.metadata && typeof input.metadata === 'object') ? input.metadata : {},
    updated_at: new Date().toISOString(),
  };
  if (!next.name) throw new Error('Capture source name is required.');
  const sourceId = payload.sourceId || payload.id || input.id;
  if (sourceId) {
    const { data, error } = await supabase
      .from('capture_sources')
      .update(next)
      .eq('id', sourceId)
      .select('*')
      .single();
    if (error) throw error;
    return { source: data };
  }
  const { data, error } = await supabase
    .from('capture_sources')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { source: data };
}

async function deleteCaptureSource(payload = {}) {
  const sourceId = payload.sourceId || payload.id;
  if (!sourceId) throw new Error('Missing sourceId.');
  const { error } = await supabase
    .from('capture_sources')
    .delete()
    .eq('id', sourceId);
  if (error) throw error;
  return { removed: true, sourceId };
}

async function getZoomMeetingConfig(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for Zoom config.');
  const { data, error } = await supabase
    .from('zoom_meeting_configs')
    .select('*')
    .eq('booking_id', eventId)
    .single();
  if (error) {
    if (isMissingRelationError(error) || error.code === 'PGRST116') return { config: null };
    throw error;
  }
  return { config: data || null };
}

async function upsertZoomMeetingConfig(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.config || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for Zoom config.');
  const next = {
    user_id: userId,
    booking_id: eventId,
    zoom_meeting_type: normalizeZoomMeetingType(input.zoomMeetingType || input.zoom_meeting_type || 'meeting'),
    zoom_meeting_id: normalizePlainText(input.zoomMeetingId || input.zoom_meeting_id || '', 120) || null,
    zoom_join_url: firstValidHttpUrl(input.zoomJoinUrl || input.zoom_join_url || '') || null,
    zoom_host_email: normalizePlainText(input.zoomHostEmail || input.zoom_host_email || '', 240) || null,
    zoom_passcode: normalizePlainText(input.zoomPasscode || input.zoom_passcode || '', 120) || null,
    zoom_settings_json: (input.zoomSettingsJson && typeof input.zoomSettingsJson === 'object')
      ? input.zoomSettingsJson
      : ((input.zoom_settings_json && typeof input.zoom_settings_json === 'object') ? input.zoom_settings_json : {}),
    zoom_cloud_recording_enabled: input.zoomCloudRecordingEnabled === true || input.zoom_cloud_recording_enabled === true,
    zoom_transcript_enabled: input.zoomTranscriptEnabled === true || input.zoom_transcript_enabled === true,
    zoom_status: normalizeZoomStatus(input.zoomStatus || input.zoom_status || 'not_scheduled'),
    updated_at: new Date().toISOString(),
  };
  const configId = payload.configId || payload.id || input.id;
  if (configId) {
    const { data, error } = await supabase
      .from('zoom_meeting_configs')
      .update(next)
      .eq('id', configId)
      .select('*')
      .single();
    if (error) throw error;
    return { config: data };
  }
  const { data, error } = await supabase
    .from('zoom_meeting_configs')
    .upsert({ ...next, created_at: new Date().toISOString() }, { onConflict: 'booking_id' })
    .select('*')
    .single();
  if (error) throw error;
  return { config: data };
}

async function createZoomMeeting(payload = {}) {
  // Zoom is the canonical capture layer, but OAuth/API may not be configured yet.
  const event = payload.event || await getEventRow(payload.eventId || payload.bookingId || payload.event?.id) || {};
  const fallbackMeetingId = `${Math.floor(Math.random() * 900000000) + 100000000}`;
  const joinUrl = firstValidHttpUrl(payload.zoomJoinUrl || '') || `https://zoom.us/j/${fallbackMeetingId}`;
  const configResponse = await upsertZoomMeetingConfig({
    ...payload,
    config: {
      ...(payload.config || {}),
      zoomMeetingId: payload.zoomMeetingId || fallbackMeetingId,
      zoomJoinUrl: joinUrl,
      zoomStatus: 'scheduled',
      zoomMeetingType: payload.zoomMeetingType || payload.config?.zoomMeetingType || 'meeting',
      zoomCloudRecordingEnabled: payload.zoomCloudRecordingEnabled !== false,
      zoomTranscriptEnabled: payload.zoomTranscriptEnabled !== false,
      zoomSettingsJson: {
        providerMode: 'stub_manual',
        note: 'Zoom OAuth is not connected yet. Meeting details can be edited manually.',
        eventTitle: event.title || '',
      },
    },
  });
  return {
    config: configResponse.config,
    mode: 'manual_stub',
    warning: 'Zoom OAuth/API integration is not connected. Created a manual Zoom meeting placeholder.',
  };
}

async function linkZoomMeeting(payload = {}) {
  return upsertZoomMeetingConfig({
    ...payload,
    config: {
      ...(payload.config || {}),
      zoomMeetingId: payload.zoomMeetingId || payload.config?.zoomMeetingId,
      zoomJoinUrl: payload.zoomJoinUrl || payload.config?.zoomJoinUrl,
      zoomStatus: payload.zoomStatus || 'scheduled',
    },
  });
}

function mapZoomRecordingAssetType(file = {}) {
  const recordingType = normalizePlainText(file.recording_type || file.file_type || '', 80).toLowerCase();
  if (recordingType.includes('transcript') || recordingType.includes('caption')) return 'transcript';
  if (recordingType.includes('chat')) return 'chat_log';
  if (recordingType.includes('whiteboard')) return 'whiteboard_export';
  if (recordingType.includes('shared_screen') || recordingType.includes('screen')) return 'shared_files';
  return 'cloud_recording';
}

async function handleZoomWebhook(rawPayload = {}) {
  const eventType = normalizePlainText(rawPayload?.event || rawPayload?.event_type || '', 80).toLowerCase();
  const object = (rawPayload?.payload && typeof rawPayload.payload === 'object' && rawPayload.payload.object)
    ? rawPayload.payload.object
    : {};
  const meetingId = normalizePlainText(
    object?.id || object?.meeting_id || rawPayload?.meeting_id || rawPayload?.meetingId || '',
    120
  );

  if (!eventType) return { received: true, ignored: true, reason: 'No event type' };
  if (!meetingId) return { received: true, ignored: true, eventType, reason: 'No meeting id' };

  const { data: config, error: configError } = await supabase
    .from('zoom_meeting_configs')
    .select('*')
    .eq('zoom_meeting_id', meetingId)
    .single();
  if (configError || !config) {
    return { received: true, ignored: true, eventType, meetingId, reason: 'No matching booking' };
  }

  const updates = { updated_at: new Date().toISOString() };
  if (eventType === 'meeting.started') updates.zoom_status = 'live';
  if (eventType === 'meeting.ended') updates.zoom_status = 'ended';
  if (eventType === 'recording.completed' || eventType === 'transcript.completed') updates.zoom_status = 'ended';

  const { error: updateError } = await supabase
    .from('zoom_meeting_configs')
    .update(updates)
    .eq('id', config.id);
  if (updateError) throw new Error(`Zoom config update failed: ${updateError.message}`);

  const files = Array.isArray(object?.recording_files) ? object.recording_files : [];
  const transcriptFiles = Array.isArray(object?.transcript_files) ? object.transcript_files : [];
  const assetsToInsert = [];

  if (eventType === 'recording.completed') {
    for (const file of files) {
      assetsToInsert.push({
        user_id: config.user_id,
        booking_id: config.booking_id,
        asset_type: mapZoomRecordingAssetType(file),
        provider: 'zoom',
        external_asset_id: normalizePlainText(file.id || file.recording_id || '', 220) || null,
        download_url: firstValidHttpUrl(file.download_url || file.play_url || '') || null,
        metadata: {
          eventType,
          recording_type: file.recording_type || file.file_type || '',
          file_type: file.file_type || '',
          file_size: file.file_size || null,
          recording_start: file.recording_start || null,
          recording_end: file.recording_end || null,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (eventType === 'transcript.completed') {
    if (transcriptFiles.length) {
      for (const file of transcriptFiles) {
        assetsToInsert.push({
          user_id: config.user_id,
          booking_id: config.booking_id,
          asset_type: 'transcript',
          provider: 'zoom',
          external_asset_id: normalizePlainText(file.id || file.file_id || '', 220) || null,
          download_url: firstValidHttpUrl(file.download_url || '') || null,
          metadata: {
            eventType,
            file_type: file.file_type || '',
            recording_start: file.recording_start || null,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } else if (firstValidHttpUrl(object?.download_url || '')) {
      assetsToInsert.push({
        user_id: config.user_id,
        booking_id: config.booking_id,
        asset_type: 'transcript',
        provider: 'zoom',
        external_asset_id: normalizePlainText(object.id || object.uuid || '', 220) || null,
        download_url: firstValidHttpUrl(object.download_url || '') || null,
        metadata: { eventType },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (assetsToInsert.length) {
    const { error: assetError } = await supabase
      .from('zoom_assets')
      .insert(assetsToInsert);
    if (assetError) throw new Error(`Zoom asset insert failed: ${assetError.message}`);
  }

  if (eventType === 'recording.completed') {
    await supabase
      .from('youtube_distributions')
      .upsert({
        user_id: config.user_id,
        booking_id: config.booking_id,
        publish_status: 'queued',
        publish_notes: 'Zoom recording completed. Ready for YouTube publish.',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'booking_id' });
  }

  return {
    received: true,
    eventType,
    meetingId,
    bookingId: config.booking_id,
    assetsQueued: assetsToInsert.length,
  };
}

async function getZoomAssets(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for Zoom assets.');
  const { data, error } = await supabase
    .from('zoom_assets')
    .select('*')
    .eq('booking_id', eventId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingRelationError(error)) return { assets: [] };
    throw error;
  }
  return { assets: data || [] };
}

async function upsertZoomAsset(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.asset || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for Zoom asset.');
  const next = {
    user_id: userId,
    booking_id: eventId,
    asset_type: normalizePlainText(input.assetType || input.asset_type || 'cloud_recording', 60) || 'cloud_recording',
    provider: normalizePlainText(input.provider || 'zoom', 60) || 'zoom',
    external_asset_id: normalizePlainText(input.externalAssetId || input.external_asset_id || '', 220) || null,
    download_url: firstValidHttpUrl(input.downloadUrl || input.download_url || '') || null,
    file_attachment_id: normalizePlainText(input.fileAttachmentId || input.file_attachment_id || '', 320) || null,
    metadata: (input.metadata && typeof input.metadata === 'object') ? input.metadata : {},
    updated_at: new Date().toISOString(),
  };
  const assetId = payload.assetId || payload.id || input.id;
  if (assetId) {
    const { data, error } = await supabase
      .from('zoom_assets')
      .update(next)
      .eq('id', assetId)
      .select('*')
      .single();
    if (error) throw error;
    return { asset: data };
  }
  const { data, error } = await supabase
    .from('zoom_assets')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { asset: data };
}

async function getYouTubeDistribution(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for YouTube distribution.');
  const { data, error } = await supabase
    .from('youtube_distributions')
    .select('*')
    .eq('booking_id', eventId)
    .single();
  if (error) {
    if (isMissingRelationError(error) || error.code === 'PGRST116') return { distribution: null };
    throw error;
  }
  return { distribution: data || null };
}

async function upsertYouTubeDistribution(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.distribution || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for YouTube distribution.');
  const next = {
    user_id: userId,
    booking_id: eventId,
    youtube_video_id: normalizePlainText(input.youtubeVideoId || input.youtube_video_id || '', 120) || null,
    youtube_video_url: firstValidHttpUrl(input.youtubeVideoUrl || input.youtube_video_url || '') || null,
    publish_status: normalizePlainText(input.publishStatus || input.publish_status || 'not_published', 40) || 'not_published',
    publish_notes: normalizePlainText(input.publishNotes || input.publish_notes || '', 5000),
    updated_at: new Date().toISOString(),
  };
  const distributionId = payload.distributionId || payload.id || input.id;
  if (distributionId) {
    const { data, error } = await supabase
      .from('youtube_distributions')
      .update(next)
      .eq('id', distributionId)
      .select('*')
      .single();
    if (error) throw error;
    return { distribution: data };
  }
  const { data, error } = await supabase
    .from('youtube_distributions')
    .upsert({ ...next, created_at: new Date().toISOString() }, { onConflict: 'booking_id' })
    .select('*')
    .single();
  if (error) throw error;
  return { distribution: data };
}

async function publishZoomRecordingToYouTube(payload = {}) {
  const input = payload.distribution || {};
  // If a direct YouTube URL was provided, treat as manual publish complete.
  if (firstValidHttpUrl(input.youtubeVideoUrl || payload.youtubeVideoUrl || '')) {
    const response = await upsertYouTubeDistribution({
      ...payload,
      distribution: {
        ...input,
        youtubeVideoUrl: input.youtubeVideoUrl || payload.youtubeVideoUrl,
        youtubeVideoId: input.youtubeVideoId || payload.youtubeVideoId || '',
        publishStatus: 'published',
        publishNotes: input.publishNotes || 'Linked manually from Zoom recording output.',
      },
    });
    return { distribution: response.distribution, mode: 'manual_linked' };
  }

  // API upload path can be wired once Zoom recording download + YouTube upload pipeline is connected.
  const queued = await upsertYouTubeDistribution({
    ...payload,
    distribution: {
      ...input,
      publishStatus: 'queued',
      publishNotes: input.publishNotes || 'Queued for Zoom recording upload to YouTube (connector pending).',
    },
  });
  return {
    distribution: queued.distribution,
    mode: 'queued_stub',
    warning: 'YouTube upload connector is not fully wired for Zoom recordings yet. Record marked queued.',
  };
}

async function getConcessionsPlan(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for concessions plan.');
  const { data, error } = await supabase
    .from('concessions_plans')
    .select('*')
    .eq('booking_id', eventId)
    .single();
  if (error) {
    if (isMissingRelationError(error) || error.code === 'PGRST116') return { plan: null };
    throw error;
  }
  return { plan: data || null };
}

async function upsertConcessionsPlan(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.plan || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for concessions plan.');
  const next = {
    user_id: userId,
    booking_id: eventId,
    is_active: input.isActive === false || input.is_active === false ? false : true,
    manager_contact_id: input.managerContactId || input.manager_contact_id || null,
    bar_open_time: normalizeStageDateTime(input.barOpenTime || input.bar_open_time) || null,
    bar_close_time: normalizeStageDateTime(input.barCloseTime || input.bar_close_time) || null,
    intermission_service: input.intermissionService === true || input.intermission_service === true,
    cashless_only: input.cashlessOnly === true || input.cashless_only === true,
    notes: normalizePlainText(input.notes || '', 5000),
    metadata: (input.metadata && typeof input.metadata === 'object') ? input.metadata : {},
    updated_at: new Date().toISOString(),
  };
  const planId = payload.planId || payload.id || input.id;
  if (planId) {
    const { data, error } = await supabase
      .from('concessions_plans')
      .update(next)
      .eq('id', planId)
      .select('*')
      .single();
    if (error) throw error;
    return { plan: data };
  }
  const { data, error } = await supabase
    .from('concessions_plans')
    .upsert({ ...next, created_at: new Date().toISOString() }, { onConflict: 'booking_id' })
    .select('*')
    .single();
  if (error) throw error;
  return { plan: data };
}

async function getConcessionsMenuItems(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for concessions menu.');
  const { data, error } = await supabase
    .from('concessions_menu_items')
    .select('*')
    .eq('booking_id', eventId)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) return { items: [] };
    throw error;
  }
  return { items: data || [] };
}

async function upsertConcessionsMenuItem(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.item || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for menu item.');
  const next = {
    user_id: userId,
    booking_id: eventId,
    name: normalizePlainText(input.name || '', 200),
    category: normalizePlainText(input.category || 'other', 60) || 'other',
    price: Number.isFinite(Number(input.price)) ? Number(input.price) : null,
    cost_basis: Number.isFinite(Number(input.costBasis || input.cost_basis)) ? Number(input.costBasis || input.cost_basis) : null,
    supplier_reference: normalizePlainText(input.supplierReference || input.supplier_reference || '', 220) || null,
    alcohol_flag: input.alcoholFlag === true || input.alcohol_flag === true,
    inventory_link: normalizePlainText(input.inventoryLink || input.inventory_link || '', 220) || null,
    is_signature_item: input.isSignatureItem === true || input.is_signature_item === true,
    availability_status: normalizePlainText(input.availabilityStatus || input.availability_status || 'available', 40) || 'available',
    notes: normalizePlainText(input.notes || '', 3000),
    updated_at: new Date().toISOString(),
  };
  if (!next.name) throw new Error('Menu item name is required.');
  const itemId = payload.itemId || payload.id || input.id;
  if (itemId) {
    const { data, error } = await supabase
      .from('concessions_menu_items')
      .update(next)
      .eq('id', itemId)
      .select('*')
      .single();
    if (error) throw error;
    return { item: data };
  }
  const { data, error } = await supabase
    .from('concessions_menu_items')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { item: data };
}

async function deleteConcessionsMenuItem(payload = {}) {
  const itemId = payload.itemId || payload.id;
  if (!itemId) throw new Error('Missing itemId.');
  const { error } = await supabase
    .from('concessions_menu_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
  return { removed: true, itemId };
}

async function getMerchPlan(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for merch plan.');
  const { data, error } = await supabase
    .from('merch_plans')
    .select('*')
    .eq('booking_id', eventId)
    .single();
  if (error) {
    if (isMissingRelationError(error) || error.code === 'PGRST116') return { plan: null };
    throw error;
  }
  return { plan: data || null };
}

async function upsertMerchPlan(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.plan || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for merch plan.');
  const next = {
    user_id: userId,
    booking_id: eventId,
    merch_manager_contact_id: input.merchManagerContactId || input.merch_manager_contact_id || null,
    table_fee: input.tableFee === true || input.table_fee === true,
    table_fee_amount: Number.isFinite(Number(input.tableFeeAmount || input.table_fee_amount)) ? Number(input.tableFeeAmount || input.table_fee_amount) : null,
    merch_area_location: normalizePlainText(input.merchAreaLocation || input.merch_area_location || '', 240),
    load_in_time: normalizeStageDateTime(input.loadInTime || input.load_in_time) || null,
    marketplace_mode: input.marketplaceMode === true || input.marketplace_mode === true,
    notes: normalizePlainText(input.notes || '', 5000),
    updated_at: new Date().toISOString(),
  };
  const planId = payload.planId || payload.id || input.id;
  if (planId) {
    const { data, error } = await supabase
      .from('merch_plans')
      .update(next)
      .eq('id', planId)
      .select('*')
      .single();
    if (error) throw error;
    return { plan: data };
  }
  const { data, error } = await supabase
    .from('merch_plans')
    .upsert({ ...next, created_at: new Date().toISOString() }, { onConflict: 'booking_id' })
    .select('*')
    .single();
  if (error) throw error;
  return { plan: data };
}

async function getMerchParticipants(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for merch participants.');
  const { data, error } = await supabase
    .from('merch_participants')
    .select('*')
    .eq('booking_id', eventId)
    .order('name', { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) return { participants: [] };
    throw error;
  }
  return { participants: data || [] };
}

async function upsertMerchParticipant(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.participant || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for merch participant.');
  const next = {
    user_id: userId,
    booking_id: eventId,
    name: normalizePlainText(input.name || '', 220),
    contact_id: input.contactId || input.contact_id || null,
    organization_name: normalizePlainText(input.organizationName || input.organization_name || '', 220),
    emergency_contact_name: normalizePlainText(input.emergencyContactName || input.emergency_contact_name || '', 180),
    emergency_contact_phone: normalizePlainText(input.emergencyContactPhone || input.emergency_contact_phone || '', 80),
    emergency_contact_email: normalizePlainText(input.emergencyContactEmail || input.emergency_contact_email || '', 240),
    supervisor_name: normalizePlainText(input.supervisorName || input.supervisor_name || '', 180),
    merch_table_required: input.merchTableRequired === true || input.merch_table_required === true,
    staff_running_table: normalizePlainText(input.staffRunningTable || input.staff_running_table || '', 220),
    e_retail_links: Array.isArray(input.eRetailLinks || input.e_retail_links) ? (input.eRetailLinks || input.e_retail_links) : [],
    on_site_inventory_description: normalizePlainText(input.onSiteInventoryDescription || input.on_site_inventory_description || '', 3000),
    payment_methods_accepted: Array.isArray(input.paymentMethodsAccepted || input.payment_methods_accepted)
      ? (input.paymentMethodsAccepted || input.payment_methods_accepted).map((row) => normalizePlainText(row, 120)).filter(Boolean)
      : [],
    table_assignment_label: normalizePlainText(input.tableAssignmentLabel || input.table_assignment_label || '', 120) || null,
    notes: normalizePlainText(input.notes || '', 4000),
    updated_at: new Date().toISOString(),
  };
  if (!next.name) throw new Error('Merch participant name is required.');
  const participantId = payload.participantId || payload.id || input.id;
  if (participantId) {
    const { data, error } = await supabase
      .from('merch_participants')
      .update(next)
      .eq('id', participantId)
      .select('*')
      .single();
    if (error) throw error;
    return { participant: data };
  }
  const { data, error } = await supabase
    .from('merch_participants')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { participant: data };
}

async function deleteMerchParticipant(payload = {}) {
  const participantId = payload.participantId || payload.id;
  if (!participantId) throw new Error('Missing participantId.');
  const { error } = await supabase
    .from('merch_participants')
    .delete()
    .eq('id', participantId);
  if (error) throw error;
  return { removed: true, participantId };
}

async function getMerchRevenueSplit(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for merch revenue split.');
  const { data, error } = await supabase
    .from('merch_revenue_splits')
    .select('*')
    .eq('booking_id', eventId)
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) return { splits: [] };
    throw error;
  }
  return { splits: data || [] };
}

async function upsertMerchRevenueSplit(payload = {}) {
  const userId = ensureUserId(payload);
  const input = payload.split || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || input.bookingId || input.booking_id;
  if (!eventId) throw new Error('Missing eventId for merch revenue split.');
  const allocations = validateMerchSplitAllocations(input.percentageAllocations || input.percentage_allocations || []);
  const next = {
    user_id: userId,
    booking_id: eventId,
    applies_to: normalizePlainText(input.appliesTo || input.applies_to || 'all_merch', 80) || 'all_merch',
    participant_id: input.participantId || input.participant_id || null,
    split_type: normalizeMerchSplitType(input.splitType || input.split_type || 'gross'),
    table_fee_deducted_first: input.tableFeeDeductedFirst === true || input.table_fee_deducted_first === true,
    percentage_allocations: allocations,
    notes: normalizePlainText(input.notes || '', 3000),
    updated_at: new Date().toISOString(),
  };
  const splitId = payload.splitId || payload.id || input.id;
  if (splitId) {
    const { data, error } = await supabase
      .from('merch_revenue_splits')
      .update(next)
      .eq('id', splitId)
      .select('*')
      .single();
    if (error) throw error;
    return { split: data };
  }
  const { data, error } = await supabase
    .from('merch_revenue_splits')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { split: data };
}

async function getCostumePlan(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for costume plan.');
  const [planRes, charactersRes] = await Promise.all([
    supabase.from('production_costume_plans').select('*').eq('event_id', eventId).single(),
    supabase.from('costume_characters').select('*').eq('event_id', eventId).order('character_name', { ascending: true }),
  ]);

  if (planRes.error && !isMissingRelationError(planRes.error) && planRes.error.code !== 'PGRST116') throw planRes.error;
  if (charactersRes.error && !isMissingRelationError(charactersRes.error)) throw charactersRes.error;

  return {
    plan: planRes.data || null,
    characters: charactersRes.data || [],
  };
}

async function upsertCostumePlan(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || payload.plan?.eventId || payload.plan?.event_id;
  if (!eventId) throw new Error('Missing eventId for costume plan.');
  const plan = payload.plan || {};
  const next = {
    user_id: userId,
    event_id: eventId,
    costume_designer_contact_id: plan.costumeDesignerContactId || plan.costume_designer_contact_id || null,
    wardrobe_supervisor_contact_id: plan.wardrobeSupervisorContactId || plan.wardrobe_supervisor_contact_id || null,
    hair_makeup_lead_contact_id: plan.hairMakeupLeadContactId || plan.hair_makeup_lead_contact_id || null,
    notes: normalizePlainText(plan.notes || '', 8000),
    metadata: (plan.metadata && typeof plan.metadata === 'object') ? plan.metadata : {},
    updated_at: new Date().toISOString(),
  };
  const planId = payload.planId || payload.id || plan.id;
  if (planId) {
    const { data, error } = await supabase
      .from('production_costume_plans')
      .update(next)
      .eq('id', planId)
      .select('*')
      .single();
    if (error) throw error;
    return { plan: data };
  }
  const { data, error } = await supabase
    .from('production_costume_plans')
    .upsert({ ...next, created_at: new Date().toISOString() }, { onConflict: 'event_id' })
    .select('*')
    .single();
  if (error) throw error;
  return { plan: data };
}

async function ensureCostumePlan(userId, eventId) {
  const { data } = await supabase
    .from('production_costume_plans')
    .select('*')
    .eq('event_id', eventId)
    .single();
  if (data) return data;
  const { data: inserted, error } = await supabase
    .from('production_costume_plans')
    .insert({
      user_id: userId,
      event_id: eventId,
      notes: '',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return inserted;
}

async function upsertCostumeCharacter(payload = {}) {
  const userId = ensureUserId(payload);
  const character = payload.character || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || character.eventId || character.event_id;
  if (!eventId) throw new Error('Missing eventId for costume character.');
  const plan = await ensureCostumePlan(userId, eventId);
  const next = {
    costume_plan_id: plan.id,
    event_id: eventId,
    character_name: normalizePlainText(character.characterName || character.character_name || '', 180),
    performer_name: normalizePlainText(character.performerName || character.performer_name || '', 180),
    performer_contact_id: character.performerContactId || character.performer_contact_id || null,
    costume_list: Array.isArray(character.costumeList || character.costume_list) ? (character.costumeList || character.costume_list) : [],
    costume_location: normalizePlainText(character.costumeLocation || character.costume_location || '', 220),
    quick_change_notes: normalizePlainText(character.quickChangeNotes || character.quick_change_notes || '', 3000),
    fittings_schedule: normalizePlainText(character.fittingsSchedule || character.fittings_schedule || '', 1000),
    special_requirements: normalizePlainText(character.specialRequirements || character.special_requirements || '', 3000),
    attachments: Array.isArray(character.attachments) ? character.attachments : [],
    notes: normalizePlainText(character.notes || '', 3000),
    updated_at: new Date().toISOString(),
  };
  if (!next.character_name) throw new Error('Character name is required.');
  const characterId = payload.characterId || payload.id || character.id;
  if (characterId) {
    const { data, error } = await supabase
      .from('costume_characters')
      .update(next)
      .eq('id', characterId)
      .select('*')
      .single();
    if (error) throw error;
    return { character: data };
  }
  const { data, error } = await supabase
    .from('costume_characters')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { character: data };
}

async function deleteCostumeCharacter(payload = {}) {
  const characterId = payload.characterId || payload.id;
  if (!characterId) throw new Error('Missing characterId.');
  const { error } = await supabase
    .from('costume_characters')
    .delete()
    .eq('id', characterId);
  if (error) throw error;
  return { removed: true, characterId };
}

async function getSetPlan(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for set plan.');
  const [planRes, elementsRes] = await Promise.all([
    supabase.from('production_set_plans').select('*').eq('event_id', eventId).single(),
    supabase.from('set_elements').select('*').eq('event_id', eventId).order('updated_at', { ascending: false }),
  ]);
  if (planRes.error && !isMissingRelationError(planRes.error) && planRes.error.code !== 'PGRST116') throw planRes.error;
  if (elementsRes.error && !isMissingRelationError(elementsRes.error)) throw elementsRes.error;
  return {
    plan: planRes.data || null,
    elements: elementsRes.data || [],
  };
}

async function upsertSetPlan(payload = {}) {
  const userId = ensureUserId(payload);
  const plan = payload.plan || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || plan.eventId || plan.event_id;
  if (!eventId) throw new Error('Missing eventId for set plan.');
  const next = {
    user_id: userId,
    event_id: eventId,
    scenic_designer_contact_id: plan.scenicDesignerContactId || plan.scenic_designer_contact_id || null,
    technical_director_contact_id: plan.technicalDirectorContactId || plan.technical_director_contact_id || null,
    props_master_contact_id: plan.propsMasterContactId || plan.props_master_contact_id || null,
    notes: normalizePlainText(plan.notes || '', 8000),
    metadata: (plan.metadata && typeof plan.metadata === 'object') ? plan.metadata : {},
    updated_at: new Date().toISOString(),
  };
  const planId = payload.planId || payload.id || plan.id;
  if (planId) {
    const { data, error } = await supabase
      .from('production_set_plans')
      .update(next)
      .eq('id', planId)
      .select('*')
      .single();
    if (error) throw error;
    return { plan: data };
  }
  const { data, error } = await supabase
    .from('production_set_plans')
    .upsert({ ...next, created_at: new Date().toISOString() }, { onConflict: 'event_id' })
    .select('*')
    .single();
  if (error) throw error;
  return { plan: data };
}

async function ensureSetPlan(userId, eventId) {
  const { data } = await supabase
    .from('production_set_plans')
    .select('*')
    .eq('event_id', eventId)
    .single();
  if (data) return data;
  const { data: inserted, error } = await supabase
    .from('production_set_plans')
    .insert({
      user_id: userId,
      event_id: eventId,
      notes: '',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return inserted;
}

async function upsertSetElement(payload = {}) {
  const userId = ensureUserId(payload);
  const element = payload.element || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || element.eventId || element.event_id;
  if (!eventId) throw new Error('Missing eventId for set element.');
  const plan = await ensureSetPlan(userId, eventId);
  const next = {
    set_plan_id: plan.id,
    event_id: eventId,
    element_name: normalizePlainText(element.elementName || element.element_name || '', 220),
    category: normalizePlainText(element.category || 'scenery', 80) || 'scenery',
    dimensions: normalizePlainText(element.dimensions || '', 200),
    build_status: normalizePlainText(element.buildStatus || element.build_status || 'planned', 60) || 'planned',
    storage_location: normalizePlainText(element.storageLocation || element.storage_location || '', 220),
    load_in_requirements: normalizePlainText(element.loadInRequirements || element.load_in_requirements || '', 3000),
    strike_requirements: normalizePlainText(element.strikeRequirements || element.strike_requirements || '', 3000),
    safety_notes: normalizePlainText(element.safetyNotes || element.safety_notes || '', 3000),
    attachments: Array.isArray(element.attachments) ? element.attachments : [],
    notes: normalizePlainText(element.notes || '', 3000),
    updated_at: new Date().toISOString(),
  };
  if (!next.element_name) throw new Error('Element name is required.');
  const elementId = payload.elementId || payload.id || element.id;
  if (elementId) {
    const { data, error } = await supabase
      .from('set_elements')
      .update(next)
      .eq('id', elementId)
      .select('*')
      .single();
    if (error) throw error;
    return { element: data };
  }
  const { data, error } = await supabase
    .from('set_elements')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { element: data };
}

async function deleteSetElement(payload = {}) {
  const elementId = payload.elementId || payload.id;
  if (!elementId) throw new Error('Missing elementId.');
  const { error } = await supabase
    .from('set_elements')
    .delete()
    .eq('id', elementId);
  if (error) throw error;
  return { removed: true, elementId };
}

async function getParkingPlan(payload = {}) {
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for parking plan.');
  const [planRes, assetsRes, assignmentsRes] = await Promise.all([
    supabase.from('parking_plans').select('*').eq('event_id', eventId).single(),
    supabase.from('parking_assets').select('*').eq('event_id', eventId).order('updated_at', { ascending: false }),
    supabase.from('parking_assignments').select('*').eq('event_id', eventId).order('updated_at', { ascending: false }),
  ]);
  if (planRes.error && !isMissingRelationError(planRes.error) && planRes.error.code !== 'PGRST116') throw planRes.error;
  if (assetsRes.error && !isMissingRelationError(assetsRes.error)) throw assetsRes.error;
  if (assignmentsRes.error && !isMissingRelationError(assignmentsRes.error)) throw assignmentsRes.error;
  return {
    plan: planRes.data || null,
    assets: assetsRes.data || [],
    assignments: assignmentsRes.data || [],
  };
}

async function ensureParkingPlan(userId, eventId) {
  const { data } = await supabase
    .from('parking_plans')
    .select('*')
    .eq('event_id', eventId)
    .single();
  if (data) return data;
  const { data: inserted, error } = await supabase
    .from('parking_plans')
    .insert({
      user_id: userId,
      event_id: eventId,
      venue_parking_notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return inserted;
}

async function upsertParkingPlan(payload = {}) {
  const userId = ensureUserId(payload);
  const plan = payload.plan || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || plan.eventId || plan.event_id;
  if (!eventId) throw new Error('Missing eventId for parking plan.');
  const next = {
    user_id: userId,
    event_id: eventId,
    parking_coordinator_contact_id: plan.parkingCoordinatorContactId || plan.parking_coordinator_contact_id || null,
    venue_parking_notes: normalizePlainText(plan.venueParkingNotes || plan.venue_parking_notes || '', 4000),
    arrival_window_notes: normalizePlainText(plan.arrivalWindowNotes || plan.arrival_window_notes || '', 3000),
    loading_zone_notes: normalizePlainText(plan.loadingZoneNotes || plan.loading_zone_notes || '', 3000),
    rideshare_notes: normalizePlainText(plan.rideshareNotes || plan.rideshare_notes || '', 3000),
    metadata: (plan.metadata && typeof plan.metadata === 'object') ? plan.metadata : {},
    updated_at: new Date().toISOString(),
  };
  const planId = payload.planId || payload.id || plan.id;
  if (planId) {
    const { data, error } = await supabase
      .from('parking_plans')
      .update(next)
      .eq('id', planId)
      .select('*')
      .single();
    if (error) throw error;
    return { plan: data };
  }
  const { data, error } = await supabase
    .from('parking_plans')
    .upsert({ ...next, created_at: new Date().toISOString() }, { onConflict: 'event_id' })
    .select('*')
    .single();
  if (error) throw error;
  return { plan: data };
}

async function upsertParkingAsset(payload = {}) {
  const userId = ensureUserId(payload);
  const asset = payload.asset || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || asset.eventId || asset.event_id;
  if (!eventId) throw new Error('Missing eventId for parking asset.');
  const plan = await ensureParkingPlan(userId, eventId);
  const next = {
    parking_plan_id: plan.id,
    event_id: eventId,
    asset_type: normalizePlainText(asset.assetType || asset.asset_type || 'instruction_pdf', 80) || 'instruction_pdf',
    title: normalizePlainText(asset.title || '', 220),
    file_attachment_id: normalizePlainText(asset.fileAttachmentId || asset.file_attachment_id || '', 300),
    who_is_it_for: normalizePlainText(asset.whoIsItFor || asset.who_is_it_for || '', 220),
    distribution_list: Array.isArray(asset.distributionList || asset.distribution_list) ? (asset.distributionList || asset.distribution_list) : [],
    notes: normalizePlainText(asset.notes || '', 3000),
    updated_at: new Date().toISOString(),
  };
  if (!next.title || !next.file_attachment_id) throw new Error('Parking asset title and file attachment are required.');
  const assetId = payload.assetId || payload.id || asset.id;
  if (assetId) {
    const { data, error } = await supabase
      .from('parking_assets')
      .update(next)
      .eq('id', assetId)
      .select('*')
      .single();
    if (error) throw error;
    return { asset: data };
  }
  const { data, error } = await supabase
    .from('parking_assets')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { asset: data };
}

async function deleteParkingAsset(payload = {}) {
  const assetId = payload.assetId || payload.id;
  if (!assetId) throw new Error('Missing assetId.');
  const { error } = await supabase
    .from('parking_assets')
    .delete()
    .eq('id', assetId);
  if (error) throw error;
  return { removed: true, assetId };
}

async function upsertParkingAssignment(payload = {}) {
  const userId = ensureUserId(payload);
  const assignment = payload.assignment || {};
  const eventId = payload.eventId || payload.bookingId || payload.event?.id || assignment.eventId || assignment.event_id;
  if (!eventId) throw new Error('Missing eventId for parking assignment.');
  const plan = await ensureParkingPlan(userId, eventId);
  const next = {
    parking_plan_id: plan.id,
    event_id: eventId,
    permit_asset_id: assignment.permitAssetId || assignment.permit_asset_id || null,
    person_or_group: normalizePlainText(assignment.personOrGroup || assignment.person_or_group || '', 220),
    assigned_contact_id: assignment.assignedContactId || assignment.assigned_contact_id || null,
    vehicle_plate: normalizePlainText(assignment.vehiclePlate || assignment.vehicle_plate || '', 80),
    arrival_time: normalizeStageDateTime(assignment.arrivalTime || assignment.arrival_time) || null,
    notes: normalizePlainText(assignment.notes || '', 2000),
    updated_at: new Date().toISOString(),
  };
  const assignmentId = payload.assignmentId || payload.id || assignment.id;
  if (assignmentId) {
    const { data, error } = await supabase
      .from('parking_assignments')
      .update(next)
      .eq('id', assignmentId)
      .select('*')
      .single();
    if (error) throw error;
    return { assignment: data };
  }
  const { data, error } = await supabase
    .from('parking_assignments')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { assignment: data };
}

async function deleteParkingAssignment(payload = {}) {
  const assignmentId = payload.assignmentId || payload.id;
  if (!assignmentId) throw new Error('Missing assignmentId.');
  const { error } = await supabase
    .from('parking_assignments')
    .delete()
    .eq('id', assignmentId);
  if (error) throw error;
  return { removed: true, assignmentId };
}

async function getDressingRooms(payload = {}) {
  const venueId = payload.venueId || payload.venueProfileId || payload.venue_profile_id;
  if (!venueId) throw new Error('Missing venueId for dressing rooms.');
  let query = supabase
    .from('dressing_rooms')
    .select('*')
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('room_name_or_number', { ascending: true });
  if (payload.zoneId || payload.zone_id) query = query.eq('zone_id', payload.zoneId || payload.zone_id);
  if (payload.userId || payload.user_id) query = query.eq('user_id', payload.userId || payload.user_id);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { dressingRooms: [] };
    throw error;
  }
  return { dressingRooms: data || [] };
}

async function upsertDressingRoom(payload = {}) {
  const userId = ensureUserId(payload);
  const room = payload.room || {};
  const venueId = payload.venueId || payload.venueProfileId || payload.venue_profile_id || room.venueId || room.venue_id;
  if (!venueId) throw new Error('Missing venueId for dressing room.');
  const next = {
    user_id: userId,
    venue_id: venueId,
    zone_id: room.zoneId || room.zone_id || null,
    room_name_or_number: normalizePlainText(room.roomNameOrNumber || room.room_name_or_number || '', 180),
    capacity: Number.isFinite(Number(room.capacity)) ? Number(room.capacity) : null,
    location_notes: normalizePlainText(room.locationNotes || room.location_notes || '', 3000),
    amenities: Array.isArray(room.amenities) ? room.amenities : [],
    is_active: room.isActive === false ? false : true,
    updated_at: new Date().toISOString(),
  };
  if (!next.room_name_or_number) throw new Error('Room name/number is required.');
  const roomId = payload.roomId || payload.id || room.id;
  if (roomId) {
    const { data, error } = await supabase
      .from('dressing_rooms')
      .update(next)
      .eq('id', roomId)
      .select('*')
      .single();
    if (error) throw error;
    return { room: data };
  }
  const { data, error } = await supabase
    .from('dressing_rooms')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { room: data };
}

async function deleteDressingRoom(payload = {}) {
  const roomId = payload.roomId || payload.id;
  if (!roomId) throw new Error('Missing roomId.');
  const { error } = await supabase
    .from('dressing_rooms')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', roomId);
  if (error) throw error;
  return { removed: true, roomId };
}

async function getDressingRoomAssignments(payload = {}) {
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id;
  if (!bookingId) throw new Error('Missing bookingId for dressing room assignments.');
  const { data, error } = await supabase
    .from('dressing_room_assignments')
    .select('*, dressing_room:dressing_room_id(*)')
    .eq('booking_id', bookingId)
    .order('updated_at', { ascending: false });
  if (error) {
    if (isMissingRelationError(error)) return { assignments: [] };
    throw error;
  }
  return { assignments: data || [] };
}

async function upsertDressingRoomAssignment(payload = {}) {
  const userId = ensureUserId(payload);
  const assignment = payload.assignment || {};
  const bookingId = payload.bookingId || payload.eventId || payload.event?.id || assignment.bookingId || assignment.booking_id;
  if (!bookingId) throw new Error('Missing bookingId.');
  const next = {
    user_id: userId,
    booking_id: bookingId,
    dressing_room_id: assignment.dressingRoomId || assignment.dressing_room_id || null,
    assigned_to: normalizePlainText(assignment.assignedTo || assignment.assigned_to || '', 220),
    assigned_contact_id: assignment.assignedContactId || assignment.assigned_contact_id || null,
    notes: normalizePlainText(assignment.notes || '', 3000),
    access_instructions: normalizePlainText(assignment.accessInstructions || assignment.access_instructions || '', 3000),
    key_code_or_badge_notes: normalizePlainText(assignment.keyCodeOrBadgeNotes || assignment.key_code_or_badge_notes || '', 1000),
    updated_at: new Date().toISOString(),
  };
  const assignmentId = payload.assignmentId || payload.id || assignment.id;
  if (assignmentId) {
    const { data, error } = await supabase
      .from('dressing_room_assignments')
      .update(next)
      .eq('id', assignmentId)
      .select('*, dressing_room:dressing_room_id(*)')
      .single();
    if (error) throw error;
    return { assignment: data };
  }
  const { data, error } = await supabase
    .from('dressing_room_assignments')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*, dressing_room:dressing_room_id(*)')
    .single();
  if (error) throw error;
  return { assignment: data };
}

async function deleteDressingRoomAssignment(payload = {}) {
  const assignmentId = payload.assignmentId || payload.id;
  if (!assignmentId) throw new Error('Missing assignmentId.');
  const { error } = await supabase
    .from('dressing_room_assignments')
    .delete()
    .eq('id', assignmentId);
  if (error) throw error;
  return { removed: true, assignmentId };
}

function buildOperationsPacketLines(packet = {}) {
  const lines = [];
  const event = packet.event || {};
  lines.push(`Generated: ${new Date().toLocaleString('en-US')}`);
  lines.push(`Event: ${event.title || 'Untitled Event'}`);
  lines.push(`Date: ${event.date || 'TBD'} ${event.time || ''}`.trim());
  lines.push(`Venue: ${event.venue_name || event.venue || 'Venue TBD'}`);
  lines.push('');

  if (packet.costumes) {
    lines.push('## Costumes + Hair/Makeup');
    lines.push(packet.costumes.plan?.notes || 'No plan notes.');
    (packet.costumes.characters || []).forEach((row, index) => {
      lines.push(`${index + 1}. ${row.character_name} | Performer: ${row.performer_name || 'TBD'} | Location: ${row.costume_location || 'TBD'}`);
      if (row.quick_change_notes) lines.push(`   Quick change: ${row.quick_change_notes}`);
    });
    lines.push('');
  }

  if (packet.setPlan) {
    lines.push('## Set Design / Scenery');
    lines.push(packet.setPlan.plan?.notes || 'No set notes.');
    (packet.setPlan.elements || []).forEach((row, index) => {
      lines.push(`${index + 1}. ${row.element_name} | ${row.category || 'scenery'} | ${row.build_status || 'planned'} | ${row.storage_location || 'TBD'}`);
    });
    lines.push('');
  }

  if (packet.parking) {
    lines.push('## Parking + Permits + Maps');
    lines.push(packet.parking.plan?.venue_parking_notes || 'No parking notes.');
    (packet.parking.assets || []).forEach((asset, index) => {
      lines.push(`${index + 1}. ${asset.title} (${asset.asset_type}) -> ${asset.file_attachment_id}`);
    });
    (packet.parking.assignments || []).forEach((assignment, index) => {
      lines.push(`Assignment ${index + 1}: ${assignment.person_or_group || 'Group'} | Plate: ${assignment.vehicle_plate || 'N/A'} | Arrival: ${assignment.arrival_time || 'TBD'}`);
    });
    lines.push('');
  }

  if (packet.dressingRooms) {
    lines.push('## Dressing Rooms');
    (packet.dressingRooms.rooms || []).forEach((room, index) => {
      lines.push(`${index + 1}. ${room.room_name_or_number} | cap ${room.capacity || 'n/a'} | ${room.location_notes || ''}`);
    });
    (packet.dressingRooms.assignments || []).forEach((assignment, index) => {
      lines.push(`Assign ${index + 1}: ${assignment.assigned_to || 'TBD'} -> ${assignment.dressing_room?.room_name_or_number || 'Room TBD'} | ${assignment.access_instructions || ''}`);
    });
    lines.push('');
  }

  if (packet.media) {
    lines.push('## Media Capture (Zoom-First Podcast)');
    const mediaPlan = packet.media.plan || {};
    const zoom = packet.media.zoomConfig || {};
    const youtube = packet.media.youtubeDistribution || {};
    lines.push(`Recording Type: ${mediaPlan.recording_type || 'video'}`);
    lines.push(`Capture Mode: ${mediaPlan.capture_mode || 'static'}`);
    lines.push(`Primary Platform: ${mediaPlan.primary_platform || 'youtube'}`);
    lines.push(`Zoom Status: ${zoom.zoom_status || 'not_scheduled'}`);
    if (zoom.zoom_join_url) lines.push(`Zoom Join URL: ${zoom.zoom_join_url}`);
    if (zoom.zoom_meeting_id) lines.push(`Zoom Meeting ID: ${zoom.zoom_meeting_id}`);
    if (youtube.youtube_video_url) lines.push(`YouTube URL: ${youtube.youtube_video_url}`);
    if (youtube.publish_status) lines.push(`YouTube Publish Status: ${youtube.publish_status}`);
    (packet.media.captureSources || []).forEach((source, index) => {
      lines.push(`Source ${index + 1}: ${source.type} | ${source.name} | ${source.location || 'Location TBD'} | AI control: ${source.ai_control_enabled ? 'yes' : 'no'}`);
    });
    lines.push('');
  }

  if (packet.concessions) {
    lines.push('## Concessions / Food & Beverage');
    const concessionsPlan = packet.concessions.plan || {};
    lines.push(`Active: ${concessionsPlan.is_active ? 'Yes' : 'No'}`);
    if (concessionsPlan.bar_open_time) lines.push(`Bar Open: ${new Date(concessionsPlan.bar_open_time).toLocaleString('en-US')}`);
    if (concessionsPlan.bar_close_time) lines.push(`Bar Close: ${new Date(concessionsPlan.bar_close_time).toLocaleString('en-US')}`);
    lines.push(`Intermission Service: ${concessionsPlan.intermission_service ? 'Yes' : 'No'}`);
    lines.push(`Cashless Only: ${concessionsPlan.cashless_only ? 'Yes' : 'No'}`);
    (packet.concessions.menuItems || []).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.name} | ${item.category} | $${Number(item.price || 0).toFixed(2)} | ${item.availability_status || 'available'}`);
    });
    lines.push('');
  }

  if (packet.merch) {
    lines.push('## Merchandising + Vendor Marketplace');
    const merchPlan = packet.merch.plan || {};
    lines.push(`Marketplace Mode: ${merchPlan.marketplace_mode ? 'Enabled' : 'Disabled'}`);
    if (merchPlan.merch_area_location) lines.push(`Merch Area: ${merchPlan.merch_area_location}`);
    if (merchPlan.load_in_time) lines.push(`Load-in: ${new Date(merchPlan.load_in_time).toLocaleString('en-US')}`);
    if (Number.isFinite(Number(merchPlan.table_fee_amount))) lines.push(`Table Fee: $${Number(merchPlan.table_fee_amount).toFixed(2)}`);
    (packet.merch.participants || []).forEach((participant, index) => {
      lines.push(`${index + 1}. ${participant.name} | ${participant.organization_name || 'Org TBD'} | Table: ${participant.table_assignment_label || 'TBD'}`);
      if (participant.emergency_contact_name || participant.emergency_contact_phone) {
        lines.push(`   Emergency: ${participant.emergency_contact_name || 'Contact'} ${participant.emergency_contact_phone || ''}`.trim());
      }
    });
    (packet.merch.splits || []).forEach((split, index) => {
      const allocations = Array.isArray(split.percentage_allocations) ? split.percentage_allocations : [];
      const summary = allocations.map((row) => `${row.party_type}:${row.percentage}%`).join(' | ');
      lines.push(`Split ${index + 1}: ${split.split_type || 'gross'} | ${split.applies_to || 'all_merch'} | ${summary}`);
    });
    lines.push('');
  }

  if (packet.staffing) {
    lines.push('## Staffing');
    const coverage = packet.staffing.coverage || {};
    lines.push(`Roles required: ${coverage.rolesRequired || 0}`);
    lines.push(`Roles filled: ${coverage.rolesFilled || 0}`);
    lines.push(`Roles unfilled: ${coverage.rolesUnfilled || 0}`);
    lines.push(`Confirmation rate: ${coverage.confirmationRate || 0}%`);
    lines.push(`Estimated payroll: $${Number(coverage.estimatedPayroll || 0).toFixed(2)}`);
    (packet.staffing.assignments || []).forEach((row, index) => {
      const staff = row.staff_profile || {};
      lines.push(`${index + 1}. ${staff.display_name || 'Crew'} | ${row.job_title || 'Role TBD'} | ${row.status || 'scheduled'}`);
    });
    lines.push('');
  }

  return lines;
}

function resolveOperationsPacketSections(preset, sections = []) {
  if (Array.isArray(sections) && sections.length) return sections;
  const map = {
    production_dept: ['costumes', 'set', 'dressing_rooms', 'staffing', 'media'],
    cast_artist_logistics: ['parking', 'dressing_rooms', 'staffing', 'media'],
    facilities: ['set', 'parking', 'dressing_rooms', 'concessions'],
    concessions_packet: ['concessions', 'staffing'],
    merch_vendor_packet: ['merch', 'parking', 'staffing'],
    vendor_marketplace_map: ['merch'],
    revenue_split_agreement_sheet: ['merch'],
  };
  return map[preset] || ['costumes', 'set', 'parking', 'dressing_rooms', 'staffing', 'media'];
}

async function exportOperationsPacket(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.bookingId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for operations packet.');
  const preset = normalizePlainText(payload.preset || 'production_dept', 80) || 'production_dept';
  const sections = resolveOperationsPacketSections(preset, payload.sections);
  const sanitized = !!payload.sanitized;
  const event = payload.event || await getEventRow(eventId) || {};

  const [costumes, setPlan, parking, dressingAssignments, staffing, mediaPlan, captureSources, zoomConfig, zoomAssets, youtubeDistribution, concessionsPlan, concessionsMenu, merchPlan, merchParticipants, merchSplits] = await Promise.all([
    getCostumePlan({ eventId }),
    getSetPlan({ eventId }),
    getParkingPlan({ eventId }),
    getDressingRoomAssignments({ bookingId: eventId }),
    getStaffingDashboard({ userId, bookingId: eventId, roleRequirements: payload.roleRequirements || [] }),
    getMediaCapturePlan({ eventId }),
    getCaptureSources({ eventId }),
    getZoomMeetingConfig({ eventId }),
    getZoomAssets({ eventId }),
    getYouTubeDistribution({ eventId }),
    getConcessionsPlan({ eventId }),
    getConcessionsMenuItems({ eventId }),
    getMerchPlan({ eventId }),
    getMerchParticipants({ eventId }),
    getMerchRevenueSplit({ eventId }),
  ]);
  const rooms = event.venue_profile_id ? (await getDressingRooms({ venueId: event.venue_profile_id })).dressingRooms : [];

  const packetData = {
    event,
    costumes: sections.length && !sections.includes('costumes') ? null : costumes,
    setPlan: sections.length && !sections.includes('set') ? null : setPlan,
    parking: sections.length && !sections.includes('parking') ? null : parking,
    dressingRooms: sections.length && !sections.includes('dressing_rooms') ? null : { rooms, assignments: dressingAssignments.assignments },
    media: sections.length && !sections.includes('media') ? null : {
      plan: mediaPlan.plan || null,
      captureSources: captureSources.sources || [],
      zoomConfig: zoomConfig.config || null,
      zoomAssets: zoomAssets.assets || [],
      youtubeDistribution: youtubeDistribution.distribution || null,
    },
    concessions: sections.length && !sections.includes('concessions') ? null : {
      plan: concessionsPlan.plan || null,
      menuItems: concessionsMenu.items || [],
    },
    merch: sections.length && !sections.includes('merch') ? null : {
      plan: merchPlan.plan || null,
      participants: merchParticipants.participants || [],
      splits: merchSplits.splits || [],
    },
    staffing: sections.length && !sections.includes('staffing') ? null : staffing,
  };

  const lines = buildOperationsPacketLines(packetData);
  const title = `${normalizePlainText(event.title || 'Event', 120)} ${preset.replace(/_/g, ' ')} packet`;
  const pdfBuffer = buildSimplePdfBuffer(title, lines);
  const pdfBase64 = pdfBuffer.toString('base64');
  const htmlContent = `<pre style="font-family: Inter, Helvetica, Arial, sans-serif; white-space: pre-wrap;">${escapeHtml(lines.join('\n'))}</pre>`;
  const shareToken = createHash('sha256').update(`${eventId}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 20);
  const fileName = `${toSlug(title)}.pdf`;

  const { data: packetRow, error } = await supabase
    .from('operations_packets')
    .insert({
      user_id: userId,
      event_id: eventId,
      packet_type: preset,
      sections,
      sanitized,
      html_content: htmlContent,
      pdf_base64: pdfBase64,
      pdf_filename: fileName,
      share_token: shareToken,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error && !isMissingRelationError(error)) throw error;

  return {
    packet: packetRow || null,
    fileName,
    pdfBase64,
    htmlContent,
    sections,
    sanitized,
    shareToken,
    downloadUrl: `data:application/pdf;base64,${pdfBase64}`,
  };
}

async function generateOperationsShareMessage(payload = {}) {
  const event = payload.event || await getEventRow(payload.eventId || payload.bookingId || payload.event?.id) || {};
  const moduleName = normalizePlainText(payload.moduleName || payload.module || 'operations', 120) || 'operations';
  const link = firstValidHttpUrl(payload.link || payload.packetUrl || '') || '';
  const base = `For ${event.title || 'this event'} on ${event.date || 'TBD'} at ${event.venue_name || event.venue || 'the venue'}, here are the ${moduleName} details.`;
  const text = `${base}${link ? ` ${link}` : ''}`;
  return {
    message: normalizePlainText(text, 600) || base,
    smsFallback: normalizePlainText(text, 160),
  };
}

async function getFestivals(payload = {}) {
  const userId = ensureUserId(payload);
  const festivalId = payload.festivalId || payload.id || '';
  let query = supabase
    .from('festivals')
    .select('*')
    .eq('user_id', userId)
    .order('starts_on', { ascending: true });
  if (festivalId) query = query.eq('id', festivalId);
  const { data: festivals, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { festivals: [] };
    throw error;
  }
  const ids = (festivals || []).map((festival) => festival.id);
  if (!ids.length) return { festivals: [] };
  const [{ data: stages }, { data: bookings }] = await Promise.all([
    supabase.from('festival_stages').select('*').in('festival_id', ids).order('sort_order', { ascending: true }),
    supabase.from('festival_bookings').select('*, event:event_id(id,title,date,time)').in('festival_id', ids).order('starts_at', { ascending: true }),
  ]);
  return {
    festivals: (festivals || []).map((festival) => ({
      ...festival,
      stages: (stages || []).filter((stage) => stage.festival_id === festival.id),
      bookings: (bookings || []).filter((booking) => booking.festival_id === festival.id),
    })),
  };
}

async function upsertFestival(payload = {}) {
  const userId = ensureUserId(payload);
  const festival = payload.festival || {};
  const next = {
    user_id: userId,
    name: normalizePlainText(festival.name || '', 220),
    starts_on: festival.startsOn || festival.starts_on || null,
    ends_on: festival.endsOn || festival.ends_on || null,
    venue_profile_id: festival.venueProfileId || festival.venue_profile_id || null,
    venue_or_district: normalizePlainText(festival.venueOrDistrict || festival.venue_or_district || '', 220),
    notes: normalizePlainText(festival.notes || '', 6000),
    site_map_attachments: Array.isArray(festival.siteMapAttachments || festival.site_map_attachments) ? (festival.siteMapAttachments || festival.site_map_attachments) : [],
    updated_at: new Date().toISOString(),
  };
  if (!next.name) throw new Error('Festival name is required.');
  const festivalId = payload.festivalId || payload.id || festival.id;
  if (festivalId) {
    const { data, error } = await supabase
      .from('festivals')
      .update(next)
      .eq('id', festivalId)
      .select('*')
      .single();
    if (error) throw error;
    return { festival: data };
  }
  const { data, error } = await supabase
    .from('festivals')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { festival: data };
}

async function upsertFestivalStage(payload = {}) {
  const stage = payload.stage || {};
  const festivalId = payload.festivalId || stage.festivalId || stage.festival_id;
  if (!festivalId) throw new Error('Missing festivalId for stage.');
  const next = {
    festival_id: festivalId,
    zone_id: stage.zoneId || stage.zone_id || null,
    stage_name: normalizePlainText(stage.stageName || stage.stage_name || '', 220),
    sort_order: Number.isFinite(Number(stage.sortOrder || stage.sort_order)) ? Number(stage.sortOrder || stage.sort_order) : 0,
    notes: normalizePlainText(stage.notes || '', 3000),
    updated_at: new Date().toISOString(),
  };
  if (!next.stage_name) throw new Error('Stage name is required.');
  const stageId = payload.stageId || payload.id || stage.id;
  if (stageId) {
    const { data, error } = await supabase
      .from('festival_stages')
      .update(next)
      .eq('id', stageId)
      .select('*')
      .single();
    if (error) throw error;
    return { stage: data };
  }
  const { data, error } = await supabase
    .from('festival_stages')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { stage: data };
}

async function upsertFestivalBooking(payload = {}) {
  const booking = payload.festivalBooking || payload.booking || {};
  const festivalId = payload.festivalId || booking.festivalId || booking.festival_id;
  if (!festivalId) throw new Error('Missing festivalId.');
  const startsAt = normalizeStageDateTime(booking.startsAt || booking.starts_at) || null;
  const endsAt = normalizeStageDateTime(booking.endsAt || booking.ends_at) || null;
  const stageId = booking.stageId || booking.stage_id || null;
  if (stageId && startsAt && endsAt) {
    let overlapQuery = supabase
      .from('festival_bookings')
      .select('id, event_id, starts_at, ends_at')
      .eq('festival_id', festivalId)
      .eq('stage_id', stageId)
      .lt('starts_at', endsAt)
      .gt('ends_at', startsAt);
    const bookingId = payload.festivalBookingId || payload.id || booking.id;
    if (bookingId) overlapQuery = overlapQuery.neq('id', bookingId);
    const { data: overlaps, error: overlapError } = await overlapQuery.limit(1);
    if (overlapError) throw overlapError;
    if (overlaps?.length) throw new Error('Festival stage conflict detected for the selected time range.');
  }
  const next = {
    festival_id: festivalId,
    event_id: booking.eventId || booking.event_id || null,
    stage_id: stageId,
    zone_id: booking.zoneId || booking.zone_id || null,
    starts_at: startsAt,
    ends_at: endsAt,
    notes: normalizePlainText(booking.notes || '', 2000),
    updated_at: new Date().toISOString(),
  };
  const bookingId = payload.festivalBookingId || payload.id || booking.id;
  if (bookingId) {
    const { data, error } = await supabase
      .from('festival_bookings')
      .update(next)
      .eq('id', bookingId)
      .select('*')
      .single();
    if (error) throw error;
    return { festivalBooking: data };
  }
  const { data, error } = await supabase
    .from('festival_bookings')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { festivalBooking: data };
}

async function getTouringShows(payload = {}) {
  const userId = ensureUserId(payload);
  const touringShowId = payload.touringShowId || payload.id || '';
  let query = supabase
    .from('touring_shows')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (touringShowId) query = query.eq('id', touringShowId);
  const { data: shows, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { touringShows: [] };
    throw error;
  }
  const ids = (shows || []).map((show) => show.id);
  if (!ids.length) return { touringShows: [] };
  const { data: dates } = await supabase
    .from('tour_dates')
    .select('*, venue:venue_id(*), zone:zone_id(*), booking:booking_id(id,title,date,time)')
    .in('touring_show_id', ids)
    .order('starts_at', { ascending: true });
  return {
    touringShows: (shows || []).map((show) => ({
      ...show,
      dates: (dates || []).filter((date) => date.touring_show_id === show.id),
    })),
  };
}

async function upsertTouringShow(payload = {}) {
  const userId = ensureUserId(payload);
  const show = payload.touringShow || payload.show || {};
  const next = {
    user_id: userId,
    name: normalizePlainText(show.name || '', 220),
    show_type: normalizePlainText(show.showType || show.show_type || 'band', 80) || 'band',
    default_show_configuration_id: show.defaultShowConfigurationId || show.default_show_configuration_id || null,
    default_checklists: Array.isArray(show.defaultChecklists || show.default_checklists) ? (show.defaultChecklists || show.default_checklists) : [],
    default_hospitality_rider: Array.isArray(show.defaultHospitalityRider || show.default_hospitality_rider) ? (show.defaultHospitalityRider || show.default_hospitality_rider) : [],
    default_set_package: (show.defaultSetPackage && typeof show.defaultSetPackage === 'object') ? show.defaultSetPackage : (show.default_set_package || {}),
    default_costume_package: (show.defaultCostumePackage && typeof show.defaultCostumePackage === 'object') ? show.defaultCostumePackage : (show.default_costume_package || {}),
    touring_staff_contacts: Array.isArray(show.touringStaffContacts || show.touring_staff_contacts) ? (show.touringStaffContacts || show.touring_staff_contacts) : [],
    notes: normalizePlainText(show.notes || '', 6000),
    updated_at: new Date().toISOString(),
  };
  if (!next.name) throw new Error('Touring show name is required.');
  const showId = payload.touringShowId || payload.id || show.id;
  if (showId) {
    const { data, error } = await supabase
      .from('touring_shows')
      .update(next)
      .eq('id', showId)
      .select('*')
      .single();
    if (error) throw error;
    return { touringShow: data };
  }
  const { data, error } = await supabase
    .from('touring_shows')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { touringShow: data };
}

async function upsertTourDate(payload = {}) {
  const tourDate = payload.tourDate || payload.date || {};
  const touringShowId = payload.touringShowId || tourDate.touringShowId || tourDate.touring_show_id;
  if (!touringShowId) throw new Error('Missing touringShowId for tour date.');
  const next = {
    touring_show_id: touringShowId,
    venue_id: tourDate.venueId || tourDate.venue_id || null,
    zone_id: tourDate.zoneId || tourDate.zone_id || null,
    booking_id: tourDate.bookingId || tourDate.booking_id || null,
    starts_at: normalizeStageDateTime(tourDate.startsAt || tourDate.starts_at) || null,
    ends_at: normalizeStageDateTime(tourDate.endsAt || tourDate.ends_at) || null,
    notes: normalizePlainText(tourDate.notes || '', 4000),
    updated_at: new Date().toISOString(),
  };
  const tourDateId = payload.tourDateId || payload.id || tourDate.id;
  if (tourDateId) {
    const { data, error } = await supabase
      .from('tour_dates')
      .update(next)
      .eq('id', tourDateId)
      .select('*')
      .single();
    if (error) throw error;
    return { tourDate: data };
  }
  const { data, error } = await supabase
    .from('tour_dates')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { tourDate: data };
}

async function cloneTourDateBooking(payload = {}) {
  const userId = ensureUserId(payload);
  const tourDateId = payload.tourDateId || payload.id;
  if (!tourDateId) throw new Error('Missing tourDateId.');
  const { data: tourDate, error: dateError } = await supabase
    .from('tour_dates')
    .select('*, touring_show:touring_show_id(*)')
    .eq('id', tourDateId)
    .single();
  if (dateError) throw dateError;
  if (tourDate.booking_id) {
    const eventRow = await getEventRow(tourDate.booking_id);
    return { event: eventRow, tourDate };
  }

  const startsAt = normalizeStageDateTime(tourDate.starts_at) || new Date().toISOString();
  const startDate = startsAt.slice(0, 10);
  const startTime = startsAt.slice(11, 16);
  const baseTitle = tourDate.touring_show?.name || 'Tour Date';

  const insertRow = {
    user_id: userId,
    title: `${baseTitle} Tour Stop`,
    date: startDate,
    time: startTime,
    venue_profile_id: tourDate.venue_id || null,
    performance_zone_id: tourDate.zone_id || null,
    booking_start_at: startsAt,
    booking_end_at: normalizeStageDateTime(tourDate.ends_at) || null,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data: eventRow, error: insertError } = await supabase
    .from('events')
    .insert(insertRow)
    .select('*')
    .single();
  if (insertError) throw insertError;

  const { data: updatedDate, error: updateDateError } = await supabase
    .from('tour_dates')
    .update({ booking_id: eventRow.id, updated_at: new Date().toISOString() })
    .eq('id', tourDateId)
    .select('*')
    .single();
  if (updateDateError) throw updateDateError;
  return { event: eventRow, tourDate: updatedDate };
}

async function getBoardDashboard(payload = {}) {
  const userId = ensureUserId(payload);
  const horizonDays = Number.isFinite(Number(payload.horizonDays)) ? Number(payload.horizonDays) : 90;
  const today = new Date();
  const endDate = new Date(today.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const startIso = today.toISOString().slice(0, 10);
  const endIso = endDate.toISOString().slice(0, 10);

  const [
    eventsRes,
    ticketingRes,
    budgetsRes,
    poRes,
    checklistRes,
    maintenanceRes,
    riskRes,
  ] = await Promise.all([
    supabase.from('events').select('id,title,date,time,status,venue_name').eq('user_id', userId).gte('date', startIso).lte('date', endIso).order('date', { ascending: true }),
    supabase.from('booking_ticketing_records').select('tickets_sold,gross_sales').eq('user_id', userId),
    supabase.from('booking_budgets').select('total_budget,actual_gross,actual_net').eq('user_id', userId),
    supabase.from('booking_purchase_orders').select('status,total_amount').eq('user_id', userId),
    supabase.from('production_checklist_items').select('status'),
    supabase.from('venue_maintenance_tasks').select('status,scheduled_for').eq('user_id', userId),
    supabase.from('board_risk_items').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(20),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  if (ticketingRes.error && !isMissingRelationError(ticketingRes.error)) throw ticketingRes.error;
  if (budgetsRes.error && !isMissingRelationError(budgetsRes.error)) throw budgetsRes.error;
  if (poRes.error && !isMissingRelationError(poRes.error)) throw poRes.error;
  if (checklistRes.error && !isMissingRelationError(checklistRes.error)) throw checklistRes.error;
  if (maintenanceRes.error && !isMissingRelationError(maintenanceRes.error)) throw maintenanceRes.error;
  if (riskRes.error && !isMissingRelationError(riskRes.error)) throw riskRes.error;

  const ticketingRows = ticketingRes.data || [];
  const budgetRows = budgetsRes.data || [];
  const poRows = poRes.data || [];
  const checklistRows = checklistRes.data || [];
  const maintenanceRows = maintenanceRes.data || [];

  const sold = ticketingRows.reduce((sum, row) => sum + (Number(row.tickets_sold) || 0), 0);
  const gross = ticketingRows.reduce((sum, row) => sum + (Number(row.gross_sales) || 0), 0);
  const totalBudget = budgetRows.reduce((sum, row) => sum + (Number(row.total_budget) || 0), 0);
  const totalActualNet = budgetRows.reduce((sum, row) => sum + (Number(row.actual_net) || 0), 0);
  const poOpen = poRows.filter((row) => !['fulfilled', 'cancelled'].includes((row.status || '').toLowerCase()));
  const poOpenTotal = poOpen.reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0);
  const checklistDone = checklistRows.filter((row) => (row.status || '').toLowerCase() === 'done').length;
  const checklistCompletion = checklistRows.length ? Math.round((checklistDone / checklistRows.length) * 100) : 0;
  const maintenanceDue = maintenanceRows.filter((row) => ['scheduled', 'in_progress'].includes((row.status || '').toLowerCase())).length;

  return {
    dashboard: {
      horizonDays,
      upcomingEvents: eventsRes.data || [],
      ticketingSnapshot: {
        ticketsSold: sold,
        grossSales: gross,
      },
      budgetSnapshot: {
        totalBudget,
        actualNet: totalActualNet,
      },
      procurementSnapshot: {
        openPurchaseOrders: poOpen.length,
        openValue: poOpenTotal,
      },
      productionReadiness: {
        checklistCompletionPercent: checklistCompletion,
      },
      facilitiesHealth: {
        maintenanceDueItems: maintenanceDue,
      },
      risks: riskRes.data || [],
    },
  };
}

async function upsertBoardRiskItem(payload = {}) {
  const userId = ensureUserId(payload);
  const risk = payload.risk || {};
  const eventId = payload.eventId || risk.eventId || risk.event_id;
  if (!eventId) throw new Error('Missing eventId for board risk item.');
  const next = {
    user_id: userId,
    event_id: eventId,
    title: normalizePlainText(risk.title || '', 220),
    severity: normalizePlainText(risk.severity || 'medium', 40) || 'medium',
    status: normalizePlainText(risk.status || 'open', 40) || 'open',
    owner_contact_id: risk.ownerContactId || risk.owner_contact_id || null,
    notes: normalizePlainText(risk.notes || '', 4000),
    updated_at: new Date().toISOString(),
  };
  if (!next.title) throw new Error('Risk item title is required.');
  const riskId = payload.riskId || payload.id || risk.id;
  if (riskId) {
    const { data, error } = await supabase
      .from('board_risk_items')
      .update(next)
      .eq('id', riskId)
      .select('*')
      .single();
    if (error) throw error;
    return { risk: data };
  }
  const { data, error } = await supabase
    .from('board_risk_items')
    .insert({ ...next, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { risk: data };
}

async function deleteBoardRiskItem(payload = {}) {
  const riskId = payload.riskId || payload.id;
  if (!riskId) throw new Error('Missing riskId.');
  const { error } = await supabase
    .from('board_risk_items')
    .delete()
    .eq('id', riskId);
  if (error) throw error;
  return { removed: true, riskId };
}

function normalizeCheckinInput(input = {}) {
  const normalizeStatus = (value) => {
    const allowed = new Set(['expected', 'checked_in', 'late', 'no_show', 'cancelled']);
    const status = normalizePlainText(value || 'expected', 32).toLowerCase();
    return allowed.has(status) ? status : 'expected';
  };

  return {
    contact_name: normalizePlainText(input.contactName || input.contact_name || '', 180),
    contact_role: normalizePlainText(input.contactRole || input.contact_role || '', 180),
    contact_type: normalizePlainText(input.contactType || input.contact_type || 'crew', 60).toLowerCase() || 'crew',
    credential_label: normalizePlainText(input.credentialLabel || input.credential_label || '', 160),
    phone: normalizePlainText(input.phone || '', 60),
    email: normalizePlainText(input.email || '', 240),
    status: normalizeStatus(input.status),
    checked_in_at: normalizeStageDateTime(input.checkedInAt || input.checked_in_at) || null,
    check_in_method: normalizePlainText(input.checkInMethod || input.check_in_method || 'manual', 60).toLowerCase() || 'manual',
    notes: normalizePlainText(input.notes || '', 4000),
    metadata: (input.metadata && typeof input.metadata === 'object') ? input.metadata : {},
    updated_at: new Date().toISOString(),
  };
}

async function getShowCheckins(payload = {}) {
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for show check-ins.');

  let query = supabase
    .from('show_checkins')
    .select('*')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });

  if (payload.userId || payload.user_id) {
    query = query.eq('user_id', payload.userId || payload.user_id);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      return { checkins: [], warning: 'show_checkins table missing; run latest SQL migration.' };
    }
    throw error;
  }
  return { checkins: data || [] };
}

async function createShowCheckin(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for show check-in.');

  const input = payload.checkin || payload.record || {};
  const row = {
    user_id: userId,
    event_id: eventId,
    ...normalizeCheckinInput(input),
    created_at: new Date().toISOString(),
  };
  if (!row.contact_name) throw new Error('Contact name is required for check-in.');
  if (row.status === 'checked_in' && !row.checked_in_at) {
    row.checked_in_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('show_checkins')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('show_checkins table missing. Run latest SQL migration first.');
    }
    throw error;
  }
  return { checkin: data };
}

async function updateShowCheckin(payload = {}) {
  const checkinId = payload.checkinId || payload.id || payload.checkin?.id || payload.record?.id;
  if (!checkinId) throw new Error('Missing checkinId.');

  const { data: existing, error: existingError } = await supabase
    .from('show_checkins')
    .select('*')
    .eq('id', checkinId)
    .single();
  if (existingError) throw existingError;

  const updates = normalizeCheckinInput(payload.checkin || payload.record || payload.updates || {});
  if (payload.markCheckedIn || updates.status === 'checked_in') {
    updates.status = 'checked_in';
    updates.checked_in_at = updates.checked_in_at || existing.checked_in_at || new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('show_checkins')
    .update(updates)
    .eq('id', checkinId)
    .select('*')
    .single();
  if (error) throw error;
  return { checkin: data };
}

function toCurrencyNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSettlementInput(input = {}, existing = {}) {
  const statusInput = normalizePlainText(input.status || existing.status || 'draft', 32).toLowerCase();
  const allowedStatuses = new Set(['draft', 'submitted', 'approved', 'paid', 'closed']);
  const status = allowedStatuses.has(statusInput) ? statusInput : 'draft';

  const grossRevenue = toCurrencyNumber(input.grossRevenue ?? input.gross_revenue, existing.gross_revenue ?? null);
  const taxesFees = toCurrencyNumber(input.taxesFees ?? input.taxes_fees, existing.taxes_fees ?? null) || 0;
  const promoterCosts = toCurrencyNumber(input.promoterCosts ?? input.promoter_costs, existing.promoter_costs ?? null) || 0;
  const productionCosts = toCurrencyNumber(input.productionCosts ?? input.production_costs, existing.production_costs ?? null) || 0;
  const otherDeductions = toCurrencyNumber(input.otherDeductions ?? input.other_deductions, existing.other_deductions ?? null) || 0;
  const explicitNet = toCurrencyNumber(input.netRevenue ?? input.net_revenue, null);
  const computedNet = grossRevenue === null ? null : (grossRevenue - taxesFees - promoterCosts - productionCosts - otherDeductions);

  const payoutLines = Array.isArray(input.payoutLines || input.payout_lines)
    ? (input.payoutLines || input.payout_lines)
    : (Array.isArray(existing.payout_lines) ? existing.payout_lines : []);
  const splits = (input.splits && typeof input.splits === 'object')
    ? input.splits
    : (existing.splits && typeof existing.splits === 'object' ? existing.splits : {});

  return {
    title: normalizePlainText(input.title || existing.title || 'Settlement Report', 180) || 'Settlement Report',
    status,
    currency: normalizePlainText(input.currency || existing.currency || 'USD', 8) || 'USD',
    gross_revenue: grossRevenue,
    taxes_fees: taxesFees,
    promoter_costs: promoterCosts,
    production_costs: productionCosts,
    other_deductions: otherDeductions,
    net_revenue: explicitNet ?? computedNet,
    guaranteed_payout: toCurrencyNumber(input.guaranteedPayout ?? input.guaranteed_payout, existing.guaranteed_payout ?? null),
    actual_payout: toCurrencyNumber(input.actualPayout ?? input.actual_payout, existing.actual_payout ?? null),
    splits,
    payout_lines: payoutLines,
    notes: normalizePlainText(input.notes || existing.notes || '', 8000),
    reported_at: normalizeStageDateTime(input.reportedAt || input.reported_at) || existing.reported_at || null,
    approved_at: normalizeStageDateTime(input.approvedAt || input.approved_at) || existing.approved_at || null,
    metadata: (input.metadata && typeof input.metadata === 'object')
      ? input.metadata
      : (existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
    updated_at: new Date().toISOString(),
  };
}

async function getSettlementReports(payload = {}) {
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for settlement reports.');

  let query = supabase
    .from('settlement_reports')
    .select('*')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });

  if (payload.userId || payload.user_id) {
    query = query.eq('user_id', payload.userId || payload.user_id);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      return { settlementReports: [], warning: 'settlement_reports table missing; run latest SQL migration.' };
    }
    throw error;
  }
  return { settlementReports: data || [] };
}

async function createSettlementReport(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for settlement report.');

  const input = payload.report || payload.settlementReport || {};
  const row = {
    user_id: userId,
    event_id: eventId,
    ...normalizeSettlementInput(input, {}),
    created_at: new Date().toISOString(),
  };

  if ((payload.markSubmitted || row.status === 'submitted') && !row.reported_at) {
    row.status = 'submitted';
    row.reported_at = new Date().toISOString();
  }
  if ((payload.markApproved || row.status === 'approved' || row.status === 'paid' || row.status === 'closed') && !row.approved_at) {
    row.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('settlement_reports')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('settlement_reports table missing. Run latest SQL migration first.');
    }
    throw error;
  }
  return { settlementReport: data };
}

async function updateSettlementReport(payload = {}) {
  const reportId = payload.reportId || payload.id || payload.report?.id || payload.settlementReport?.id;
  if (!reportId) throw new Error('Missing reportId.');

  const { data: existing, error: existingError } = await supabase
    .from('settlement_reports')
    .select('*')
    .eq('id', reportId)
    .single();
  if (existingError) throw existingError;

  const updates = normalizeSettlementInput(payload.report || payload.settlementReport || payload.updates || {}, existing);
  if ((payload.markSubmitted || updates.status === 'submitted') && !updates.reported_at) {
    updates.status = 'submitted';
    updates.reported_at = new Date().toISOString();
  }
  if ((payload.markApproved || updates.status === 'approved' || updates.status === 'paid' || updates.status === 'closed') && !updates.approved_at) {
    updates.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('settlement_reports')
    .update(updates)
    .eq('id', reportId)
    .select('*')
    .single();
  if (error) throw error;
  return { settlementReport: data };
}

function buildSettlementCsv(report = {}, event = {}) {
  const payoutLines = Array.isArray(report.payout_lines) ? report.payout_lines : [];
  const rows = [
    ['Event', event.title || ''],
    ['Event Date', event.date || ''],
    ['Venue', event.venue_name || event.venue || ''],
    ['Report Title', report.title || 'Settlement Report'],
    ['Status', report.status || 'draft'],
    ['Currency', report.currency || 'USD'],
    ['Gross Revenue', report.gross_revenue ?? ''],
    ['Taxes + Fees', report.taxes_fees ?? ''],
    ['Promoter Costs', report.promoter_costs ?? ''],
    ['Production Costs', report.production_costs ?? ''],
    ['Other Deductions', report.other_deductions ?? ''],
    ['Net Revenue', report.net_revenue ?? ''],
    ['Guaranteed Payout', report.guaranteed_payout ?? ''],
    ['Actual Payout', report.actual_payout ?? ''],
    ['Reported At', report.reported_at || ''],
    ['Approved At', report.approved_at || ''],
    ['Notes', report.notes || ''],
  ];

  if (payoutLines.length) {
    rows.push([]);
    rows.push(['Payout Lines']);
    rows.push(['Payee', 'Amount', 'Notes']);
    payoutLines.forEach((line) => {
      rows.push([
        normalizePlainText(line?.payee || line?.name || '', 180),
        toCurrencyNumber(line?.amount, ''),
        normalizePlainText(line?.notes || '', 300),
      ]);
    });
  }

  return rows.map((row) => row
    .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
    .join(','))
    .join('\n');
}

async function exportSettlementReport(payload = {}) {
  const reportId = payload.reportId || payload.id || payload.report?.id || payload.settlementReport?.id;
  let report = payload.report || payload.settlementReport || null;
  if (!report && reportId) {
    const { data, error } = await supabase
      .from('settlement_reports')
      .select('*')
      .eq('id', reportId)
      .single();
    if (error) throw error;
    report = data;
  }
  if (!report) throw new Error('Missing settlement report payload.');

  const { data: eventRow } = await supabase
    .from('events')
    .select('*')
    .eq('id', report.event_id)
    .single();

  const csv = buildSettlementCsv(report, eventRow || {});
  const csvBase64 = Buffer.from(csv, 'utf8').toString('base64');
  const fileName = `${toSlug(report.title || `${eventRow?.title || 'event'}-settlement`)}.csv`;

  if (payload.persist !== false && report.id) {
    await resilientServerUpdate('settlement_reports', {
      exported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, 'id', report.id);
  }

  return {
    settlementReportId: report.id || null,
    fileName,
    csvBase64,
    downloadUrl: `data:text/csv;base64,${csvBase64}`,
    generatedAt: new Date().toISOString(),
  };
}

async function getDealMemos(payload = {}) {
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for deal memos.');

  let query = supabase
    .from('deal_memos')
    .select('*')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });

  if (payload.userId || payload.user_id) {
    query = query.eq('user_id', payload.userId || payload.user_id);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      return { dealMemos: [], warning: 'deal_memos table missing; run latest SQL migration.' };
    }
    throw error;
  }
  return { dealMemos: data || [] };
}

function normalizeDealMemoInput(input = {}, eventRow = {}, existing = {}) {
  const toNum = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const status = normalizePlainText(input.status || 'draft', 32).toLowerCase();
  const allowedStatuses = new Set(['draft', 'sent', 'signed', 'cancelled', 'archived']);
  const normalizedStatus = allowedStatuses.has(status) ? status : 'draft';
  const existingMetadata = (existing?.metadata && typeof existing.metadata === 'object') ? existing.metadata : {};
  const inputMetadata = (input?.metadata && typeof input.metadata === 'object') ? input.metadata : {};
  const payeeName = normalizePlainText(
    input.payeeName
      || input.payee_name
      || inputMetadata.payeeName
      || existingMetadata.payeeName
      || input.sellerName
      || input.seller_name
      || '',
    200
  );
  const servicesDescription = normalizePlainText(
    input.servicesDescription
      || input.services_description
      || inputMetadata.servicesDescription
      || existingMetadata.servicesDescription
      || '',
    6000
  );
  const governingLaw = normalizePlainText(
    input.governingLaw
      || input.governing_law
      || inputMetadata.governingLaw
      || existingMetadata.governingLaw
      || 'Texas',
    120
  ) || 'Texas';
  const signerSeed = input.signerEmails
    || input.signer_emails
    || inputMetadata.signerEmails
    || existingMetadata.signerEmails
    || [];
  const signerEmails = (Array.isArray(signerSeed) ? signerSeed : String(signerSeed).split(/[,;]+/))
    .map((email) => normalizePlainText(email, 240).toLowerCase())
    .filter(Boolean);

  return {
    title: normalizePlainText(input.title || `${eventRow.title || 'Event'} Deal Memo`, 180) || 'Deal Memo',
    status: normalizedStatus,
    deal_type: normalizePlainText(input.dealType || input.deal_type || 'performance', 60) || 'performance',
    buyer_name: normalizePlainText(input.buyerName || input.buyer_name || '', 200),
    buyer_email: normalizePlainText(input.buyerEmail || input.buyer_email || '', 240),
    buyer_phone: normalizePlainText(input.buyerPhone || input.buyer_phone || '', 60),
    seller_name: normalizePlainText(input.sellerName || input.seller_name || '', 200),
    seller_email: normalizePlainText(input.sellerEmail || input.seller_email || '', 240),
    seller_phone: normalizePlainText(input.sellerPhone || input.seller_phone || '', 60),
    event_date: normalizeDate(input.eventDate || input.event_date || eventRow.date || ''),
    venue_name: normalizePlainText(input.venueName || input.venue_name || eventRow.venue_name || eventRow.venue || '', 220),
    compensation_model: normalizePlainText(input.compensationModel || input.compensation_model || 'guarantee', 80) || 'guarantee',
    guarantee_amount: toNum(input.guaranteeAmount ?? input.guarantee_amount),
    deposit_amount: toNum(input.depositAmount ?? input.deposit_amount),
    backend_split: normalizePlainText(input.backendSplit || input.backend_split || '', 80),
    door_split: normalizePlainText(input.doorSplit || input.door_split || '', 80),
    merch_split: normalizePlainText(input.merchSplit || input.merch_split || '', 80),
    settlement_due_hours: toNum(input.settlementDueHours ?? input.settlement_due_hours),
    cancellation_terms: normalizePlainText(input.cancellationTerms || input.cancellation_terms || '', 6000),
    force_majeure_terms: normalizePlainText(input.forceMajeureTerms || input.force_majeure_terms || '', 4000),
    hospitality_terms: normalizePlainText(input.hospitalityTerms || input.hospitality_terms || '', 4000),
    tech_rider_terms: normalizePlainText(input.techRiderTerms || input.tech_rider_terms || '', 6000),
    promo_commitments: normalizePlainText(input.promoCommitments || input.promo_commitments || '', 6000),
    notes: normalizePlainText(input.notes || '', 8000),
    signed_at: normalizeStageDateTime(input.signedAt || input.signed_at) || null,
    sent_at: normalizeStageDateTime(input.sentAt || input.sent_at) || null,
    version: Number.isFinite(Number(input.version)) ? Math.max(1, Number(input.version)) : 1,
    metadata: {
      ...existingMetadata,
      ...inputMetadata,
      ...(payeeName ? { payeeName } : {}),
      ...(servicesDescription ? { servicesDescription } : {}),
      governingLaw,
      ...(signerEmails.length ? { signerEmails } : {}),
    },
    updated_at: new Date().toISOString(),
  };
}

function buildDealMemoLines(memo = {}, event = {}) {
  const dollars = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '';
    return `$${parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const memoMeta = (memo?.metadata && typeof memo.metadata === 'object') ? memo.metadata : {};
  const payeeName = normalizePlainText(memoMeta.payeeName || '', 200) || memo.seller_name || 'TBD';
  const servicesDescription = normalizePlainText(memoMeta.servicesDescription || '', 6000) || memo.promo_commitments || '';
  const governingLaw = normalizePlainText(memoMeta.governingLaw || '', 120) || 'Texas';
  const signerEmails = Array.isArray(memoMeta.signerEmails) ? memoMeta.signerEmails.filter(Boolean) : [];

  return [
    `Generated: ${new Date().toLocaleString('en-US')}`,
    '',
    'NOTICE: Informational template only. This is not legal advice.',
    '',
    '## Deal Overview',
    `Title: ${memo.title || 'Deal Memo'}`,
    `Status: ${memo.status || 'draft'}`,
    `Deal Type: ${memo.deal_type || 'performance'}`,
    `Event: ${event.title || ''}`,
    `Event Date: ${memo.event_date || event.date || 'TBD'}`,
    `Venue: ${memo.venue_name || event.venue_name || event.venue || 'TBD'}`,
    '',
    '## Parties',
    `Buyer: ${memo.buyer_name || 'TBD'}${memo.buyer_email ? ` | ${memo.buyer_email}` : ''}${memo.buyer_phone ? ` | ${memo.buyer_phone}` : ''}`,
    `Seller: ${memo.seller_name || 'TBD'}${memo.seller_email ? ` | ${memo.seller_email}` : ''}${memo.seller_phone ? ` | ${memo.seller_phone}` : ''}`,
    '',
    '## Compensation',
    `Model: ${memo.compensation_model || 'guarantee'}`,
    memo.guarantee_amount ? `Guarantee: ${dollars(memo.guarantee_amount)}` : 'Guarantee: —',
    memo.deposit_amount ? `Deposit: ${dollars(memo.deposit_amount)}` : 'Deposit: —',
    memo.backend_split ? `Backend Split: ${memo.backend_split}` : 'Backend Split: —',
    memo.door_split ? `Door Split: ${memo.door_split}` : 'Door Split: —',
    memo.merch_split ? `Merch Split: ${memo.merch_split}` : 'Merch Split: —',
    memo.settlement_due_hours ? `Settlement Due: ${memo.settlement_due_hours} hours` : 'Settlement Due: —',
    `Payee (to whom): ${payeeName}`,
    servicesDescription ? `Services (for what): ${servicesDescription}` : 'Services (for what): —',
    '',
    '## Legal',
    `Governing Law: ${governingLaw}`,
    signerEmails.length ? `Signature Routing Emails: ${signerEmails.join(', ')}` : 'Signature Routing Emails: —',
    '',
    ...(memo.promo_commitments ? ['## Promo Commitments', memo.promo_commitments, ''] : []),
    ...(memo.tech_rider_terms ? ['## Tech Rider Terms', memo.tech_rider_terms, ''] : []),
    ...(memo.hospitality_terms ? ['## Hospitality Terms', memo.hospitality_terms, ''] : []),
    ...(memo.cancellation_terms ? ['## Cancellation Terms', memo.cancellation_terms, ''] : []),
    ...(memo.force_majeure_terms ? ['## Force Majeure', memo.force_majeure_terms, ''] : []),
    ...(memo.notes ? ['## Notes', memo.notes, ''] : []),
    memo.sent_at ? `Sent At: ${memo.sent_at}` : '',
    memo.signed_at ? `Signed At: ${memo.signed_at}` : '',
  ].filter(Boolean);
}

function buildDealMemoHtml(memo = {}, event = {}) {
  const lines = buildDealMemoLines(memo, event);
  return `<pre style="font-family:Inter,Helvetica,Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${escapeHtml(lines.join('\n'))}</pre>`;
}

async function createDealMemo(payload = {}) {
  const userId = ensureUserId(payload);
  const eventId = payload.eventId || payload.event?.id;
  if (!eventId) throw new Error('Missing eventId for deal memo.');

  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
  if (eventError) throw eventError;

  const memoInput = payload.memo || payload.dealMemo || {};
  const memoData = normalizeDealMemoInput(memoInput, eventRow, {});
  const row = {
    user_id: userId,
    event_id: eventId,
    ...memoData,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('deal_memos')
    .insert(row)
    .select('*')
    .single();
  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('deal_memos table missing. Run latest SQL migration first.');
    }
    throw error;
  }

  let memo = data;
  let dispatch = null;
  if (payload.sendNow && memo.buyer_email) {
    const subject = `${memo.title || 'Deal Memo'} · ${eventRow.title || 'Event'}`;
    const emailResult = await sendEmail({
      to: memo.buyer_email,
      subject,
      html: buildDealMemoHtml(memo, eventRow),
      replyTo: memo.seller_email || undefined,
    });
    dispatch = {
      success: !!emailResult?.emailId,
      emailId: emailResult?.emailId || null,
      sentTo: memo.buyer_email,
    };
    const { data: updatedMemo, error: updateError } = await supabase
      .from('deal_memos')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', memo.id)
      .select('*')
      .single();
    if (!updateError && updatedMemo) memo = updatedMemo;
  }

  return { dealMemo: memo, dispatch };
}

async function updateDealMemo(payload = {}) {
  const memoId = payload.memoId || payload.id || payload.memo?.id || payload.dealMemo?.id;
  if (!memoId) throw new Error('Missing memoId.');
  const memoInput = payload.memo || payload.dealMemo || payload.updates || {};

  const { data: existing, error: existingError } = await supabase
    .from('deal_memos')
    .select('*')
    .eq('id', memoId)
    .single();
  if (existingError) throw existingError;

  const normalized = normalizeDealMemoInput(memoInput, {}, existing);
  const updates = {
    ...normalized,
    sent_at: normalized.status === 'sent' ? (normalized.sent_at || existing.sent_at || new Date().toISOString()) : normalized.sent_at,
    signed_at: normalized.status === 'signed' ? (normalized.signed_at || existing.signed_at || new Date().toISOString()) : normalized.signed_at,
    version: Number(existing.version || 1) + (payload.bumpVersion ? 1 : 0),
  };

  const { data, error } = await supabase
    .from('deal_memos')
    .update(updates)
    .eq('id', memoId)
    .select('*')
    .single();
  if (error) throw error;

  let memo = data;
  let dispatch = null;
  if (payload.sendNow && memo.buyer_email) {
    const { data: eventRow } = await supabase
      .from('events')
      .select('*')
      .eq('id', memo.event_id)
      .single();
    const emailResult = await sendEmail({
      to: memo.buyer_email,
      subject: `${memo.title || 'Deal Memo'} · ${eventRow?.title || 'Event'}`,
      html: buildDealMemoHtml(memo, eventRow || {}),
      replyTo: memo.seller_email || undefined,
    });
    dispatch = {
      success: !!emailResult?.emailId,
      emailId: emailResult?.emailId || null,
      sentTo: memo.buyer_email,
    };
    const { data: updatedMemo, error: updateError } = await supabase
      .from('deal_memos')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', memo.id)
      .select('*')
      .single();
    if (!updateError && updatedMemo) memo = updatedMemo;
  }

  return { dealMemo: memo, dispatch };
}

async function exportDealMemoPdf(payload = {}) {
  const memoId = payload.memoId || payload.id || payload.memo?.id || payload.dealMemo?.id;
  let memo = payload.memo || payload.dealMemo || null;
  if (!memo && memoId) {
    const { data, error } = await supabase
      .from('deal_memos')
      .select('*')
      .eq('id', memoId)
      .single();
    if (error) throw error;
    memo = data;
  }
  if (!memo) throw new Error('Missing deal memo payload.');

  const { data: eventRow } = await supabase
    .from('events')
    .select('*')
    .eq('id', memo.event_id)
    .single();

  const lines = buildDealMemoLines(memo, eventRow || {});
  const title = normalizePlainText(memo.title || `${eventRow?.title || 'Event'} Deal Memo`, 180) || 'Deal Memo';
  const pdfBuffer = buildSimplePdfBuffer(title, lines);
  const pdfBase64 = pdfBuffer.toString('base64');
  const fileName = `${toSlug(title)}.pdf`;

  if (payload.persist !== false && memo.id) {
    await resilientServerUpdate('deal_memos', {
      pdf_base64: pdfBase64,
      pdf_filename: fileName,
      updated_at: new Date().toISOString(),
    }, 'id', memo.id);
  }

  return {
    dealMemoId: memo.id || null,
    fileName,
    pdfBase64,
    downloadUrl: `data:application/pdf;base64,${pdfBase64}`,
    generatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════
// DISTRIBUTE ALL — Fire all selected channels
// ═══════════════════════════════════════════════════════════════

async function distributeAll(event, venue, content, images, channels = [], options = {}) {
  const results = {};
  const allChannels = channels.length ? channels : ['email', 'eventbrite', 'facebook', 'instagram', 'linkedin'];

  const tasks = allChannels.map(async (ch) => {
    try {
      switch (ch) {
        case 'email':
        case 'press':
          results.email = await sendPressRelease(event, venue, content, { recipients: content.recipients || [] });
          break;
        case 'eventbrite':
          results.eventbrite = await createEventbrite(event, venue, {
            bannerImage: images?.eventbrite_banner || images?.fb_event_banner || images?.fb_post_landscape,
          });
          break;
        case 'facebook':
          results.facebook = await postFacebook(event, venue, content, images, options);
          break;
        case 'instagram':
          results.instagram = await postInstagram(event, venue, content, images);
          break;
        case 'linkedin':
          results.linkedin = await postLinkedIn(event, venue, content, images);
          break;
        default:
          results[ch] = { success: false, error: `Unknown channel: ${ch}` };
      }
    } catch (err) {
      results[ch] = { success: false, error: err.message };
    }
  });

  await Promise.all(tasks);

  const succeeded = Object.entries(results).filter(([, r]) => r.success || r.sent > 0).map(([k]) => k);
  const failed = Object.entries(results).filter(([, r]) => !r.success && !(r.sent > 0)).map(([k]) => k);

  return { results, summary: { succeeded, failed, total: allChannels.length } };
}

// ═══════════════════════════════════════════════════════════════
// CHECK STATUS — Which channels are configured?
// ═══════════════════════════════════════════════════════════════

async function checkAllStatus() {
  const status = {
    email: { ready: !!process.env.RESEND_API_KEY, provider: 'Resend' },
    eventbrite: { ready: !!process.env.EVENTBRITE_TOKEN, provider: 'Eventbrite' },
    facebook: { ready: false, provider: 'Meta Graph API' },
    instagram: { ready: false, provider: 'Meta Graph API (needs IG link)' },
    linkedin: { ready: false, provider: 'LinkedIn Marketing API' },
    youtube: { ready: false, provider: 'YouTube Data API' },
  };

  // Check OAuth connections
  try {
    for (const platform of ['facebook', 'instagram', 'linkedin', 'youtube']) {
      try {
        await getToken(platform);
        status[platform].ready = true;
      } catch (err) {
        // Token not available or expired
        status[platform].ready = false;
        status[platform].error = err.message;
      }
    }
  } catch (err) {
    console.error('Error checking OAuth status:', err);
  }

  return status;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

class RequestValidationError extends Error {
  constructor(message, missingFields = []) {
    super(message);
    this.name = 'RequestValidationError';
    this.statusCode = 400;
    this.missingFields = missingFields;
  }
}

function requiresCompleteEvent(action) {
  const required = new Set([
    'send-press-release',
    'create-eventbrite',
    'post-facebook',
    'post-facebook-video',
    'post-instagram',
    'post-instagram-video',
    'post-linkedin',
    'post-linkedin-video',
    'post-youtube-video',
    'post-twitter',
    'send-email-blast',
    'send-sms',
    'submit-calendars',
    'distribute-all',
    'notify-admin-distribution',
  ]);
  return required.has(action);
}

function normalizeDistributionPayload(payload = {}) {
  const rawEvent = payload.event || {};
  const rawVenue = payload.venue || {};

  const venueName = normalizePlainText(
    firstNonEmpty(rawVenue?.name, rawEvent?.venue, rawEvent?.venueName),
    200
  );
  const venueAddress = normalizePlainText(
    firstNonEmpty(rawVenue?.address, rawEvent?.venueAddress, buildStreetAddress(rawEvent)),
    300
  );
  const venueCity = normalizePlainText(firstNonEmpty(rawVenue?.city, rawEvent?.venueCity), 120);
  const venueState = normalizePlainText(firstNonEmpty(rawVenue?.state, rawEvent?.venueState), 120);
  const venueZip = normalizePlainText(firstNonEmpty(rawVenue?.zip, rawEvent?.venueZip), 20);
  const venueWebsite = normalizePlainText(firstNonEmpty(rawVenue?.website, rawEvent?.venueWebsite), 300);
  const ticketLink = firstValidHttpUrl(
    rawEvent?.ticketLink,
    rawEvent?.ticket_link,
    rawEvent?.registrationLink,
    rawEvent?.rsvpLink,
    rawEvent?.signupLink,
    rawEvent?.eventUrl,
    rawEvent?.url,
    venueWebsite,
  );

  const event = {
    ...rawEvent,
    title: normalizePlainText(rawEvent?.title, 200),
    description: normalizePlainText(rawEvent?.description, 6000),
    date: normalizeDate(rawEvent?.date),
    time: normalizePlainText(rawEvent?.time, 30),
    endTime: normalizePlainText(rawEvent?.endTime, 30),
    venue: venueName,
    venueAddress,
    venueCity,
    venueState,
    venueZip,
    venueWebsite,
    ticketLink,
  };

  const venue = {
    ...rawVenue,
    name: venueName,
    address: venueAddress,
    city: venueCity,
    state: venueState,
    zip: venueZip,
    website: venueWebsite,
  };

  return {
    ...payload,
    event,
    venue,
  };
}

function assertEventCompleteness(event, venue) {
  const missing = [];
  if (!normalizePlainText(event?.title, 200)) missing.push('title');
  if (!normalizeDate(event?.date)) missing.push('date');
  if (!normalizePlainText(event?.time, 30)) missing.push('start time');
  if (!normalizePlainText(event?.venue || venue?.name, 200)) missing.push('venue name');
  if (!normalizePlainText(event?.venueCity || venue?.city, 120)) missing.push('venue city');
  if (!normalizePlainText(event?.venueState || venue?.state, 120)) missing.push('venue state');
  if (!firstValidHttpUrl(
    event?.ticketLink,
    event?.ticket_link,
    event?.registrationLink,
    event?.rsvpLink,
    event?.signupLink,
    event?.eventUrl,
    event?.url,
    venue?.website,
    event?.venueWebsite
  )) {
    missing.push('CTA link (ticket/RSVP/registration URL)');
  }
  if (missing.length) {
    throw new RequestValidationError(
      `Event is incomplete for distribution. Missing: ${missing.join(', ')}`,
      missing
    );
  }
}

function normalizeDate(value) {
  const text = normalizePlainText(value, 40);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function firstNonEmpty(...values) {
  for (const value of values.flat()) {
    if (value === null || value === undefined) continue;
    const candidate = String(value).trim();
    if (candidate) return candidate;
  }
  return '';
}

function firstValidHttpUrl(...values) {
  for (const value of values.flat()) {
    const candidate = firstNonEmpty(value);
    if (!candidate) continue;
    if (/^https?:\/\//i.test(candidate)) return candidate;
  }
  return '';
}

function buildStreetAddress(event) {
  const parts = [event?.venueStreetNumber, event?.venueStreetName, event?.venueSuite]
    .map((value) => firstNonEmpty(value))
    .filter(Boolean);
  return parts.join(' ').trim();
}

function requirePublicHttpsUrl(url, label = 'Media URL') {
  const value = String(url || '').trim();
  if (!value) throw new Error(`${label} is required`);
  if (!/^https:\/\//i.test(value)) {
    throw new Error(`${label} must be a public HTTPS URL`);
  }
  return value;
}

async function waitForInstagramContainerReady(token, containerId) {
  let status = 'IN_PROGRESS';
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${token}`);
    const statusData = await statusRes.json();
    status = statusData.status_code || statusData.status || status;
    if (status === 'FINISHED' || status === 'READY') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Instagram container status: ${status}`);
    }
  }
  throw new Error(`Instagram container not ready (last status: ${status})`);
}

function resolveLinkedInAuthor(tokenData) {
  if (tokenData?.source === 'supabase' && tokenData?.metadata?.organizations?.length > 0) {
    return `urn:li:organization:${tokenData.metadata.organizations[0].id}`;
  }
  if (process.env.LINKEDIN_ORG_ID) {
    return `urn:li:organization:${process.env.LINKEDIN_ORG_ID.trim()}`;
  }
  if (tokenData?.source === 'supabase' && tokenData?.metadata?.user_id) {
    return `urn:li:person:${tokenData.metadata.user_id}`;
  }
  throw new Error('No LinkedIn organization or user author available');
}

function parseTagList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 15);
  return String(raw)
    .split(/[\n,;|]+/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 15);
}

function decodeBasicEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripMarkdownSyntax(text) {
  return text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)');
}

function normalizePlainText(input, maxLen = 5000) {
  if (!input) return '';
  let text = String(input);

  // Drop code fences so accidental pasted code doesn't end up in listings.
  text = text.replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''));
  text = decodeBasicEntities(text);

  // Remove HTML and script/style blocks.
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li|h[1-6]|section|article|blockquote)>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');

  // Remove common markdown formatting.
  text = stripMarkdownSyntax(text);

  // Normalize whitespace.
  text = text.replace(/\r/g, '');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/[ \t]{2,}/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  if (maxLen && text.length > maxLen) {
    text = text.substring(0, maxLen).trim();
  }
  return text;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toSafeParagraphHtml(input) {
  const text = normalizePlainText(input, 6000);
  if (!text) return '';
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function convertTo24h(timeStr, addHours = 0) {
  if (!timeStr) return '19:00';
  const match = String(timeStr).match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return '19:00';
  let h = parseInt(match[1], 10);
  const m = match[2] || '00';
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  h = ((h + addHours) % 24 + 24) % 24;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function localToUTC(localDatetime) {
  // Assume CST (UTC-6)
  const d = new Date(localDatetime + '-06:00');
  return d.toISOString().replace('.000Z', 'Z');
}

function buildFBDescription(event, venue) {
  let desc = event.description || event.title;
  desc += '\n\n';
  if (venue?.name) desc += `📍 ${venue.name}\n`;
  if (venue?.address) desc += `${venue.address}, ${venue.city || 'San Antonio'}, ${venue.state || 'TX'}\n`;
  if (event.ticketLink) desc += `\n🎟️ Tickets: ${event.ticketLink}\n`;
  desc += '\nPresented by Good Creative Media\ngoodcreativemedia.com';
  return desc;
}

function buildIGCaption(event, venue) {
  const lines = [];
  
  // Title
  lines.push(event.title);
  lines.push('');
  
  // Date and time
  if (event.date) {
    const d = new Date(event.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    lines.push(`📅 ${dateStr}${event.time ? ` · ${event.time}` : ''}${event.endTime ? ` – ${event.endTime}` : ''}`);
  }
  
  // Venue with full address
  if (venue?.name) {
    lines.push(`📍 ${venue.name}`);
    const addr = venue.address || venue.street;
    if (addr) {
      lines.push(`   ${addr}${venue.city ? ', ' + venue.city : ', San Antonio'}${venue.state ? ', ' + venue.state : ', TX'}`);
    }
  }
  
  // Admission
  if (event.isFree || event.is_free) lines.push('🎟️ Free admission');
  else if (event.ticketLink || event.ticket_link) lines.push(`🎟️ Tickets: link in bio`);
  else if (event.ticketPrice || event.ticket_price) lines.push(`🎟️ ${event.ticketPrice || event.ticket_price}`);
  
  lines.push('');
  
  // Description
  const desc = event.description || '';
  if (desc) {
    // Trim to ~600 chars for IG readability
    lines.push(desc.length > 600 ? desc.substring(0, 597) + '...' : desc);
    lines.push('');
  }
  
  // Performers / hosts
  if (event.performers) lines.push(`🎤 ${event.performers}`);
  if (event.cast_crew?.length) {
    const names = event.cast_crew.map(c => c.name).filter(Boolean);
    if (names.length) lines.push(`🎤 Featuring: ${names.join(', ')}`);
  }
  
  // Venue tag (from venue metadata if available)
  const venueTags = [];
  if (venue?.instagram) venueTags.push(`@${venue.instagram.replace('@', '')}`);
  if (event.venue_instagram) venueTags.push(`@${event.venue_instagram.replace('@', '')}`);
  if (venueTags.length) {
    lines.push('');
    lines.push(`🏠 ${venueTags.join(' ')}`);
  }
  
  lines.push('');
  lines.push('Presented by @goodcreativemedia');
  lines.push('');
  
  // Hashtags — genre-aware
  const genre = (event.genre || '').toLowerCase();
  const baseTags = ['#SanAntonio', '#SATX', '#SanAntonioEvents', '#SATXEvents', '#SanAntonioNightlife'];
  
  if (genre.includes('comedy') || genre.includes('open mic')) {
    baseTags.push('#Comedy', '#OpenMic', '#StandUpComedy', '#SATXComedy', '#FindYourFunny', '#ComedyNight', '#OpenMicNight');
  } else if (genre.includes('jazz') || genre.includes('music')) {
    baseTags.push('#LiveMusic', '#Jazz', '#JazzJam', '#SATXMusic', '#LiveJazz', '#SanAntonioMusic', '#SupportLocalMusic');
  } else if (genre.includes('dance') || genre.includes('belly')) {
    baseTags.push('#Dance', '#BellyDance', '#LiveDance', '#SATXDance', '#LiveMusic', '#SanAntonioMusic', '#CulturalArts');
  } else {
    baseTags.push('#LiveMusic', '#LiveEvents', '#SATXMusic', '#SupportLocal');
  }
  
  // Add venue-specific tags
  if (venue?.name?.toLowerCase().includes('dakota')) baseTags.push('#TheDakotaSA', '#EastSideSA');
  if (venue?.name?.toLowerCase().includes('midtown')) baseTags.push('#MidtownSA', '#MidtownMeetup');
  
  lines.push(baseTags.join(' '));
  
  return lines.join('\n').substring(0, 2200);
}

function buildLinkedInText(event, venue, content) {
  const lines = [event.title, ''];
  if (event.date) {
    const d = new Date(event.date + 'T00:00:00');
    lines.push(`📅 ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${event.time ? ` · ${event.time}` : ''}`);
  }
  if (venue?.name) lines.push(`📍 ${venue.name}, San Antonio`);
  lines.push('');
  if (event.description) lines.push(event.description.substring(0, 800), '');
  if (event.ticketLink) lines.push(`🎟️ ${event.ticketLink}`, '');
  lines.push('#SanAntonio #LiveEvents #SATX');
  return lines.join('\n').substring(0, 3000);
}

// ═══════════════════════════════════════════════════════════════
// UPDATE PLATFORM IMAGES — Push graphics to already-distributed platforms
// ═══════════════════════════════════════════════════════════════

async function updatePlatformImages({ event, venue, images, distributionResults }) {
  const results = [];

  // Facebook: Update event cover photo
  try {
    const tokenData = await getToken('facebook');
    if (tokenData?.token) {
      const token = tokenData.token;
      let pageId = process.env.FB_PAGE_ID || '522058047815423';
      if (tokenData.source === 'supabase' && tokenData.metadata?.page_id) pageId = tokenData.metadata.page_id;

      const imageUrl = images?.fb_event_banner || images?.fb_post_landscape;
      if (imageUrl) {
        // If we have a Facebook event ID from distribution results, update its cover
        const fbEventId = distributionResults?.social?.facebook?.event?.eventId;
        if (fbEventId) {
          const coverRes = await fetch(`https://graph.facebook.com/v19.0/${fbEventId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, cover: { source: imageUrl } }),
          });
          const coverData = await coverRes.json();
          results.push({ platform: 'Facebook Event Cover', success: !coverData.error, error: coverData.error?.message });
        }

        // Also post the image to the page feed as an update
        const postRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token, url: imageUrl, message: `🎨 Event graphic for: ${event.title}` }),
        });
        const postData = await postRes.json();
        results.push({ platform: 'Facebook Photo', success: !postData.error, error: postData.error?.message });
      }
    }
  } catch (err) { results.push({ platform: 'Facebook', success: false, error: err.message }); }

  // Eventbrite: Update event logo/image using working S3 multipart upload
  try {
    const ebToken = process.env.EVENTBRITE_TOKEN;
    const ebEventId = distributionResults?.calendar?.eventId;
    const imageUrl = images?.eventbrite_banner || images?.fb_event_banner;

    if (ebToken && ebEventId && imageUrl) {
      const logoUrl = await uploadEventbriteBanner(ebToken, ebEventId, imageUrl);
      results.push({ platform: 'Eventbrite', success: true, logoUrl });
    } else {
      if (!ebEventId) results.push({ platform: 'Eventbrite', success: false, error: 'No Eventbrite event to update (distribute calendar first)' });
    }
  } catch (err) { results.push({ platform: 'Eventbrite', success: false, error: err.message }); }

  // Instagram: Can't update existing posts, skip
  results.push({ platform: 'Instagram', success: false, error: 'Instagram does not allow updating images on existing posts. Next distribution will include the graphic.' });

  // LinkedIn: Can't update existing posts
  results.push({ platform: 'LinkedIn', success: false, error: 'LinkedIn does not allow updating images on existing posts. Next distribution will include the graphic.' });

  return { success: results.some(r => r.success), results };
}

// ═══════════════════════════════════════════════════════════════
// ADMIN NOTIFICATION — Email Julie with distribution results + URLs
// ═══════════════════════════════════════════════════════════════

async function notifyAdminDistribution({ event, venue, distributionResults, channels, distributedBy }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { success: false, error: 'I need RESEND_API_KEY before I can send this admin summary.' };

  const adminEmail = 'juliegood@goodcreativemedia.com';
  const eventDate = event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
  const venueName = venue?.name || event.venue || 'Unknown venue';

  // Build the results summary
  const lines = [];

  // Press
  if (distributionResults?.press) {
    const pressCount = distributionResults.press.count || distributionResults.press.length || 0;
    lines.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">📰 Press Release</td><td style="padding:8px;border-bottom:1px solid #eee">✅ Sent to ${pressCount} media contacts</td><td style="padding:8px;border-bottom:1px solid #eee">—</td></tr>`);
  }

  // Calendar / Eventbrite
  if (distributionResults?.calendar) {
    const ebUrl = distributionResults.calendar.eventUrl;
    lines.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">🎟️ Eventbrite</td><td style="padding:8px;border-bottom:1px solid #eee">${ebUrl ? '✅ Created' : '⚠️ Error'}</td><td style="padding:8px;border-bottom:1px solid #eee">${ebUrl ? `<a href="${ebUrl}" style="color:#c8a45e">${ebUrl}</a>` : '—'}</td></tr>`);
  }

  // Social platforms
  if (distributionResults?.social) {
    const social = distributionResults.social;

    // Facebook
    if (social.facebook) {
      const fbEventUrl = social.facebook.event?.eventUrl;
      const fbPostId = social.facebook.feedPost?.postId;
      const fbUrl = fbEventUrl || (fbPostId ? `https://facebook.com/${fbPostId}` : null);
      lines.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">📱 Facebook</td><td style="padding:8px;border-bottom:1px solid #eee">${social.facebook.success ? '✅ Posted' : '⚠️ ' + (social.facebook.error || 'Failed')}</td><td style="padding:8px;border-bottom:1px solid #eee">${fbUrl ? `<a href="${fbUrl}" style="color:#c8a45e">${fbUrl}</a>` : '—'}</td></tr>`);
    }

    // Instagram
    if (social.instagram) {
      lines.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">📸 Instagram</td><td style="padding:8px;border-bottom:1px solid #eee">${social.instagram.success ? '✅ Posted' : '⚠️ ' + (social.instagram.error || 'Failed')}</td><td style="padding:8px;border-bottom:1px solid #eee">—</td></tr>`);
    }

    // LinkedIn
    if (social.linkedin) {
      const liUrl = social.linkedin.postUrl;
      lines.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">💼 LinkedIn</td><td style="padding:8px;border-bottom:1px solid #eee">${social.linkedin.success ? '✅ Posted' : '⚠️ ' + (social.linkedin.error || 'Failed')}</td><td style="padding:8px;border-bottom:1px solid #eee">${liUrl ? `<a href="${liUrl}" style="color:#c8a45e">${liUrl}</a>` : '—'}</td></tr>`);
    }

    // Twitter
    if (social.twitter) {
      const twUrl = social.twitter.tweetUrl;
      lines.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">🐦 Twitter/X</td><td style="padding:8px;border-bottom:1px solid #eee">${social.twitter.success ? '✅ Tweeted' : '⚠️ ' + (social.twitter.error || 'Failed')}</td><td style="padding:8px;border-bottom:1px solid #eee">${twUrl ? `<a href="${twUrl}" style="color:#c8a45e">${twUrl}</a>` : '—'}</td></tr>`);
    }

    // Calendars (Do210/SA Current/Evvnt)
    if (social.calendars) {
      lines.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">📅 Do210/SA Current/Evvnt</td><td style="padding:8px;border-bottom:1px solid #eee">${social.calendars.success ? '✅ Queued' : '⚠️ ' + (social.calendars.error || 'Failed')}</td><td style="padding:8px;border-bottom:1px solid #eee">—</td></tr>`);
    }
  }

  // Email blast
  if (channels?.includes('email')) {
    lines.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">📧 Email Blast</td><td style="padding:8px;border-bottom:1px solid #eee">Attempted</td><td style="padding:8px;border-bottom:1px solid #eee">—</td></tr>`);
  }

  // SMS
  if (channels?.includes('sms')) {
    lines.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">💬 SMS</td><td style="padding:8px;border-bottom:1px solid #eee">Attempted</td><td style="padding:8px;border-bottom:1px solid #eee">—</td></tr>`);
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Inter,Helvetica,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5}
.container{max-width:650px;margin:0 auto;background:#fff}
.header{background:#0d1b2a;color:#c8a45e;padding:24px 30px}
.header h1{margin:0;font-size:20px;color:#c8a45e}
.header p{margin:4px 0 0;color:#aaa;font-size:13px}
.body{padding:24px 30px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:10px 8px;background:#faf8f3;color:#0d1b2a;font-weight:600;border-bottom:2px solid #c8a45e}
.meta{background:#faf8f3;border-left:4px solid #c8a45e;padding:16px;margin:0 0 20px;border-radius:4px;font-size:13px}
.footer{background:#0d1b2a;color:#888;padding:16px 30px;text-align:center;font-size:11px}
.footer a{color:#c8a45e}</style></head>
<body><div class="container">
<div class="header"><h1>🚀 Distribution Complete</h1><p>IMC Machine Notification</p></div>
<div class="body">
<div class="meta">
<strong>${event.title}</strong><br>
📅 ${eventDate}${event.time ? ' · ' + event.time : ''}<br>
📍 ${venueName}${venue?.address ? ', ' + venue.address : ''}<br>
👤 Distributed by: ${distributedBy || 'Unknown'}
</div>
<table>
<tr><th>Channel</th><th>Status</th><th>URL</th></tr>
${lines.join('\n')}
</table>
<p style="margin-top:20px;font-size:12px;color:#888">Review each URL for accuracy. <a href="https://imc.goodcreativemedia.com" style="color:#c8a45e">Open IMC Machine →</a></p>
</div>
<div class="footer">The IMC Machine · Good Creative Media · San Antonio, TX<br><a href="https://imc.goodcreativemedia.com">imc.goodcreativemedia.com</a></div>
</div></body></html>`;

  try {
    const fromAddr = process.env.RESEND_FROM_EMAIL || 'Good Creative Media <events@goodcreativemedia.com>';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddr,
        to: [adminEmail],
        subject: `🚀 IMC Distribution: ${event.title} — ${venueName}`,
        html,
        reply_to: 'juliegood@goodcreativemedia.com',
      }),
    });
    const data = await response.json();
    if (data.id) return { success: true, emailId: data.id };

    // Retry with Resend test domain if not verified
    if (data.error?.message?.includes('not verified')) {
      const retryRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Good Creative Media <onboarding@resend.dev>',
          to: [adminEmail],
          subject: `🚀 IMC Distribution: ${event.title} — ${venueName}`,
          html,
          reply_to: 'juliegood@goodcreativemedia.com',
        }),
      });
      const retryData = await retryRes.json();
      if (retryData.id) return { success: true, emailId: retryData.id };
    }
    return { success: false, error: data.error?.message || 'I could not send that admin email yet.' };
  } catch (err) {
    return { success: false, error: `I hit a snag sending that admin email: ${err.message}` };
  }
}

export const __test__ = {
  resolveFacebookGraphVersion,
  buildFacebookEventFingerprint,
  shouldFallbackFromFacebookEventError,
  buildFacebookEventSchedule,
  extractFacebookEventId,
  formatGraphError,
};
