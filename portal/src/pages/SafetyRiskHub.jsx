import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import { calculateSafetyRiskProfile, parseRiskArray } from '../services/safetyRisk';

const RISK_SUBSECTIONS = [
  { key: 'overview', label: 'Overview Dashboard' },
  { key: 'risk_profile', label: 'Risk Profile & Scoring' },
  { key: 'permits', label: 'Permits & Compliance' },
  { key: 'insurance', label: 'Insurance & Liability' },
  { key: 'fire_egress', label: 'Fire & Egress Planning' },
  { key: 'security_screening', label: 'Security Screening' },
  { key: 'surveillance', label: 'Surveillance (CCTV)' },
  { key: 'access_control', label: 'Access Control' },
  { key: 'crowd_management', label: 'Crowd Management' },
  { key: 'medical', label: 'Medical & First Aid' },
  { key: 'sanitation', label: 'Sanitation & Health' },
  { key: 'weather', label: 'Weather Contingency' },
  { key: 'city', label: 'Law Enforcement & City Coordination' },
  { key: 'incidents', label: 'Incident Reporting' },
  { key: 'eap', label: 'Emergency Action Plan (Auto-Generated)' },
  { key: 'documents', label: 'Documents & Uploads' },
  { key: 'safety_checklists', label: 'Safety Checklists' },
];

const PERMIT_TYPES = [
  'Fire Marshal',
  'Assembly Permit',
  'Outdoor Event Permit',
  'Temporary Use Permit',
  'Alcohol License',
  'Noise Permit',
  'Street Closure',
  'Vendor Permits',
  'Food Handler Permits',
  'Generator Permit',
  'Security Contract',
  'Off-Duty Officer Contract',
  'Special Event Insurance Certificate',
];

const INSURANCE_TYPES = [
  'General Liability',
  'Liquor Liability',
  'Event Cancellation',
  'Workers Comp',
  'Equipment Insurance',
  'Vendor COI',
];

const INCIDENT_TYPES = ['medical', 'security', 'fire', 'weather', 'other'];
const SURVEILLANCE_TYPES = ['fixed_camera', 'ptz_camera', 'dome_camera', 'temporary_event_camera', 'body_cam', 'drone'];
const ACCESS_CONTROL_TYPES = ['bag_check', 'metal_detector', 'hand_wand', 'id_check', 'ticket_scan', 'credential_checkpoint', 'rfid_scan', 'vip_lane'];

function safeDateTimeInput(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
}

function blankRiskProfile() {
  return {
    indoorOutdoor: 'indoor',
    expectedAttendance: '',
    alcoholPresent: false,
    ticketedEvent: true,
    securityStaffCount: '',
    weatherExposure: 'low',
    generatorUse: false,
    fireRiskFactors: '',
    vipAttendance: false,
    localCrimeRisk: '',
    responsiblePerson: '',
    notes: '',
    metadata: {
      fireEgress: {
        occupancyConfirmed: false,
        exitsMarked: false,
        fireLanesClear: false,
        electricalLoadApproved: false,
        marshalWalkthroughComplete: false,
        extinguisherPlacement: '',
        fireAlarmPlacement: '',
        emergencyLighting: '',
        maxOccupancy: '',
      },
      securityScreening: {
        noWeaponsSignage: false,
        clearBagPolicy: false,
        idRequiredNotice: false,
        alcoholNotice: false,
        complianceNotice: false,
        screeningNotes: '',
      },
    },
  };
}

function blankPermit() {
  return {
    permitType: '',
    status: 'pending',
    permitNumber: '',
    issuingAuthority: '',
    expiresAt: '',
    fileUrl: '',
    responsiblePerson: '',
    notes: '',
  };
}

function blankPolicy() {
  return {
    policyType: '',
    policyNumber: '',
    coverageLimits: '',
    deductible: '',
    carrier: '',
    expiresAt: '',
    additionalInsured: '',
    coiFileUrl: '',
    status: 'active',
    notes: '',
  };
}

function blankSurveillanceAsset() {
  return {
    assetType: 'fixed_camera',
    cameraId: '',
    location: '',
    coverageZone: '',
    powerSource: '',
    networkType: '',
    recordingStatus: 'active',
    retentionDays: 30,
    monitoringStation: '',
    monitoringAssignee: '',
    liveFeedUrl: '',
    accessLevel: 'restricted',
    notes: '',
  };
}

function blankAccessPoint() {
  return {
    controlType: 'credential_checkpoint',
    label: '',
    location: '',
    clearanceLevel: 'general',
    assignedStaff: '',
    accessHours: '',
    notes: '',
  };
}

function blankIncident() {
  return {
    occurredAt: '',
    location: '',
    incidentType: 'other',
    description: '',
    staffInvolved: '',
    resolution: '',
    followUpRequired: false,
    followUpNotes: '',
    fileUrl: '',
    visibility: 'internal',
    status: 'open',
  };
}

function blankSafetyChecklist() {
  return {
    title: 'Event Safety Checklist',
    phase: 'pre_show',
  };
}

function blankSafetyChecklistItem() {
  return {
    label: '',
    category: 'general',
    status: 'todo',
    required: true,
    assigneeName: '',
    dueAt: '',
    notes: '',
  };
}

function normalizeEventStart(event = {}) {
  const raw = event?.bookingStartAt || (event?.date ? `${event.date}T${event.time || '19:00'}` : event?.date);
  const dt = raw ? new Date(raw) : null;
  if (!dt || Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString();
}

export default function SafetyRiskHub() {
  const { user } = useAuth();
  const {
    events,
    getEventSafetyProfile,
    saveEventSafetyProfile,
    listEventPermits,
    saveEventPermit,
    removeEventPermit,
    listEventInsurancePolicies,
    saveEventInsurancePolicy,
    removeEventInsurancePolicy,
    listEventSurveillanceAssets,
    saveEventSurveillanceAsset,
    removeEventSurveillanceAsset,
    listEventAccessControlPoints,
    saveEventAccessControlPoint,
    removeEventAccessControlPoint,
    getEventCrowdPlan,
    saveEventCrowdPlan,
    getEventMedicalPlan,
    saveEventMedicalPlan,
    getEventSanitationPlan,
    saveEventSanitationPlan,
    getEventWeatherPlan,
    saveEventWeatherPlan,
    getEventCityCoordination,
    saveEventCityCoordination,
    listEventIncidents,
    saveEventIncident,
    removeEventIncident,
    listEventSafetyChecklists,
    saveEventSafetyChecklist,
    saveEventSafetyChecklistItem,
    removeEventSafetyChecklistItem,
    generateEventEap,
    listEventEaps,
    getEventSafetyDashboard,
  } = useVenue();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const sortedEvents = useMemo(() => (
    [...(events || [])].sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime())
  ), [events]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const selectedEvent = useMemo(() => sortedEvents.find((row) => row.id === selectedEventId) || null, [sortedEvents, selectedEventId]);

  const [dashboard, setDashboard] = useState(null);
  const [riskProfile, setRiskProfile] = useState(blankRiskProfile());
  const [permits, setPermits] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [surveillanceAssets, setSurveillanceAssets] = useState([]);
  const [accessPoints, setAccessPoints] = useState([]);
  const [crowdPlan, setCrowdPlan] = useState({});
  const [medicalPlan, setMedicalPlan] = useState({});
  const [sanitationPlan, setSanitationPlan] = useState({});
  const [weatherPlan, setWeatherPlan] = useState({});
  const [cityPlan, setCityPlan] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [eapDocs, setEapDocs] = useState([]);

  const [permitDraft, setPermitDraft] = useState(blankPermit());
  const [policyDraft, setPolicyDraft] = useState(blankPolicy());
  const [surveillanceDraft, setSurveillanceDraft] = useState(blankSurveillanceAsset());
  const [accessDraft, setAccessDraft] = useState(blankAccessPoint());
  const [incidentDraft, setIncidentDraft] = useState(blankIncident());
  const [checklistDraft, setChecklistDraft] = useState(blankSafetyChecklist());
  const [checklistItemDraft, setChecklistItemDraft] = useState(blankSafetyChecklistItem());
  const [activeChecklistId, setActiveChecklistId] = useState('');

  const riskResult = useMemo(() => calculateSafetyRiskProfile(riskProfile), [riskProfile]);

  useEffect(() => {
    if (!selectedEventId && sortedEvents.length > 0) {
      setSelectedEventId(sortedEvents[0].id);
    }
  }, [selectedEventId, sortedEvents]);

  const loadSafetyData = async (eventId) => {
    if (!eventId) return;
    setLoading(true);
    setStatus('');
    const result = await Promise.allSettled([
      getEventSafetyDashboard(eventId),
      getEventSafetyProfile(eventId),
      listEventPermits(eventId),
      listEventInsurancePolicies(eventId),
      listEventSurveillanceAssets(eventId),
      listEventAccessControlPoints(eventId),
      getEventCrowdPlan(eventId),
      getEventMedicalPlan(eventId),
      getEventSanitationPlan(eventId),
      getEventWeatherPlan(eventId),
      getEventCityCoordination(eventId),
      listEventIncidents(eventId),
      listEventSafetyChecklists(eventId),
      listEventEaps(eventId),
    ]);
    setLoading(false);

    const failed = result.filter((row) => row.status === 'rejected');
    if (failed.length > 0) {
      setStatus(`I hit ${failed.length} load issue${failed.length === 1 ? '' : 's'}. You can still work and save section by section.`);
    }

    const values = result.map((row, idx) => (row.status === 'fulfilled' ? row.value : null));
    setDashboard(values[0] || null);
    const profileRow = values[1] || null;
    setRiskProfile({
      ...blankRiskProfile(),
      ...(profileRow || {}),
      fireRiskFactors: Array.isArray(profileRow?.fire_risk_factors)
        ? profileRow.fire_risk_factors.join(', ')
        : (profileRow?.fire_risk_factors || ''),
      metadata: {
        ...blankRiskProfile().metadata,
        ...((profileRow?.metadata && typeof profileRow.metadata === 'object') ? profileRow.metadata : {}),
      },
    });
    setPermits(values[2] || []);
    setPolicies(values[3] || []);
    setSurveillanceAssets(values[4] || []);
    setAccessPoints(values[5] || []);
    setCrowdPlan(values[6] || {});
    setMedicalPlan(values[7] || {});
    setSanitationPlan(values[8] || {});
    setWeatherPlan(values[9] || {});
    setCityPlan(values[10] || {});
    setIncidents(values[11] || []);
    const checklistRows = values[12] || [];
    setChecklists(checklistRows);
    if (!activeChecklistId && checklistRows.length > 0) setActiveChecklistId(checklistRows[0].id);
    setEapDocs(values[13] || []);
  };

  useEffect(() => {
    if (selectedEventId) {
      loadSafetyData(selectedEventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  const handleSaveRiskProfile = async () => {
    if (!selectedEventId) return;
    try {
      setStatus('Saving risk profile and recalculating score...');
      await saveEventSafetyProfile(selectedEventId, {
        ...riskProfile,
        fireRiskFactors: parseRiskArray(riskProfile.fireRiskFactors),
      });
      await loadSafetyData(selectedEventId);
      setStatus('Risk profile saved.');
    } catch (err) {
      setStatus(`Could not save risk profile: ${err.message}`);
    }
  };

  const handleSavePermit = async () => {
    if (!selectedEventId) return;
    try {
      await saveEventPermit(selectedEventId, permitDraft);
      setPermitDraft(blankPermit());
      await loadSafetyData(selectedEventId);
      setStatus('Permit saved.');
    } catch (err) {
      setStatus(`Could not save permit: ${err.message}`);
    }
  };

  const handleSavePolicy = async () => {
    if (!selectedEventId) return;
    try {
      await saveEventInsurancePolicy(selectedEventId, policyDraft);
      setPolicyDraft(blankPolicy());
      await loadSafetyData(selectedEventId);
      setStatus('Insurance policy saved.');
    } catch (err) {
      setStatus(`Could not save policy: ${err.message}`);
    }
  };

  const handleSaveSurveillance = async () => {
    if (!selectedEventId) return;
    try {
      await saveEventSurveillanceAsset(selectedEventId, surveillanceDraft);
      setSurveillanceDraft(blankSurveillanceAsset());
      await loadSafetyData(selectedEventId);
      setStatus('Surveillance asset saved.');
    } catch (err) {
      setStatus(`Could not save surveillance asset: ${err.message}`);
    }
  };

  const handleSaveAccessPoint = async () => {
    if (!selectedEventId) return;
    try {
      await saveEventAccessControlPoint(selectedEventId, accessDraft);
      setAccessDraft(blankAccessPoint());
      await loadSafetyData(selectedEventId);
      setStatus('Access control point saved.');
    } catch (err) {
      setStatus(`Could not save access point: ${err.message}`);
    }
  };

  const handleSaveIncident = async () => {
    if (!selectedEventId) return;
    try {
      await saveEventIncident(selectedEventId, incidentDraft);
      setIncidentDraft(blankIncident());
      await loadSafetyData(selectedEventId);
      setStatus('Incident report saved.');
    } catch (err) {
      setStatus(`Could not save incident: ${err.message}`);
    }
  };

  const handleSaveChecklist = async () => {
    if (!selectedEventId) return;
    try {
      const checklist = await saveEventSafetyChecklist(selectedEventId, checklistDraft);
      setChecklistDraft(blankSafetyChecklist());
      setActiveChecklistId(checklist?.id || '');
      await loadSafetyData(selectedEventId);
      setStatus('Safety checklist saved.');
    } catch (err) {
      setStatus(`Could not save safety checklist: ${err.message}`);
    }
  };

  const handleSaveChecklistItem = async () => {
    if (!selectedEventId || !activeChecklistId) return;
    try {
      await saveEventSafetyChecklistItem(selectedEventId, activeChecklistId, checklistItemDraft);
      setChecklistItemDraft(blankSafetyChecklistItem());
      await loadSafetyData(selectedEventId);
      setStatus('Safety checklist item saved.');
    } catch (err) {
      setStatus(`Could not save checklist item: ${err.message}`);
    }
  };

  const handleGenerateEap = async () => {
    if (!selectedEventId) return;
    try {
      setStatus('Generating Emergency Action Plan...');
      await generateEventEap(selectedEventId, {
        generatedBy: user?.name || user?.email || 'IMC Safety Lead',
      });
      await loadSafetyData(selectedEventId);
      setStatus('Emergency Action Plan generated.');
    } catch (err) {
      setStatus(`Could not generate EAP: ${err.message}`);
    }
  };

  const activeChecklist = useMemo(() => (
    checklists.find((row) => row.id === activeChecklistId) || checklists[0] || null
  ), [checklists, activeChecklistId]);

  const documentLinks = useMemo(() => {
    const links = [];
    permits.forEach((row) => {
      if (row.file_url) links.push({ label: `Permit: ${row.permit_type || 'Permit'}`, url: row.file_url });
    });
    policies.forEach((row) => {
      if (row.coi_file_url) links.push({ label: `Insurance: ${row.policy_type || 'Policy'} COI`, url: row.coi_file_url });
    });
    incidents.forEach((row) => {
      if (row.file_url) links.push({ label: `Incident Attachment (${row.incident_type || 'other'})`, url: row.file_url });
    });
    return links;
  }, [incidents, permits, policies]);

  const applySimplePlanPatch = async (saveFn, plan, label) => {
    if (!selectedEventId) return;
    try {
      await saveFn(selectedEventId, plan);
      await loadSafetyData(selectedEventId);
      setStatus(`${label} saved.`);
    } catch (err) {
      setStatus(`Could not save ${label.toLowerCase()}: ${err.message}`);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mt-0 mb-1">Safety & Risk Management</h2>
            <p className="text-sm text-gray-600 m-0">Professional event safety, compliance, security, and emergency planning tied directly to your live event.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm bg-white">
              <option value="">Choose event</option>
              {sortedEvents.map((event) => (
                <option key={event.id} value={event.id}>{event.title || 'Untitled Event'} · {normalizeEventStart(event)}</option>
              ))}
            </select>
            <button type="button" className="btn-secondary text-sm" onClick={() => selectedEventId && loadSafetyData(selectedEventId)} disabled={!selectedEventId || loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        {selectedEvent && (
          <p className="text-xs text-gray-500 mt-2 mb-0">
            Event: <strong>{selectedEvent.title}</strong> · <Link to={`/events/${selectedEvent.id}`}>Open Event</Link> · <Link to={`/production-ops/event-ops?eventId=${selectedEvent.id}&focus=event_ops`}>Open Production Ops</Link>
          </p>
        )}
        {status && <p className="text-xs text-[#0d1b2a] mt-2 mb-0">{status}</p>}
      </div>

      <div className="card">
        <p className="text-xs uppercase tracking-wide text-gray-500 m-0 mb-2">Sections</p>
        <div className="flex flex-wrap gap-2">
          {RISK_SUBSECTIONS.map((section) => (
            <a key={section.key} href={`#${section.key}`} className="px-2 py-1 border border-gray-300 rounded text-xs no-underline text-[#0d1b2a] bg-white">
              {section.label}
            </a>
          ))}
        </div>
      </div>

      <section id="overview" className="card">
        <h3 className="mt-0">Overview Dashboard</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="p-2 rounded bg-gray-50"><strong>{dashboard?.riskLevel || riskResult.riskLevel}</strong><br />Risk Level</div>
          <div className="p-2 rounded bg-gray-50"><strong>{dashboard?.riskScore ?? riskResult.riskScore}</strong><br />Risk Score</div>
          <div className="p-2 rounded bg-gray-50"><strong>{dashboard?.permitStatus?.expired || 0}</strong><br />Expired Permits</div>
          <div className="p-2 rounded bg-gray-50"><strong>{dashboard?.insuranceStatus?.expired || 0}</strong><br />Expired Policies</div>
          <div className="p-2 rounded bg-gray-50"><strong>{dashboard?.openIncidents || 0}</strong><br />Open Incidents</div>
        </div>
        {(dashboard?.complianceAlerts || []).length > 0 && (
          <div className="mt-3 p-2 border border-amber-300 rounded bg-amber-50 text-xs">
            <p className="font-semibold m-0 mb-1">Compliance Alerts</p>
            {(dashboard.complianceAlerts || []).map((line, idx) => <p key={`alert-${idx}`} className="m-0">• {line}</p>)}
          </div>
        )}
      </section>

      <section id="risk_profile" className="card space-y-2">
        <h3 className="mt-0">Risk Profile & Scoring</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select value={riskProfile.indoorOutdoor || 'indoor'} onChange={(e) => setRiskProfile((prev) => ({ ...prev, indoorOutdoor: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
          <input type="number" min="0" value={riskProfile.expectedAttendance || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, expectedAttendance: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Expected attendance" />
          <input type="number" min="0" value={riskProfile.securityStaffCount || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, securityStaffCount: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Security staff count" />
          <select value={riskProfile.weatherExposure || 'low'} onChange={(e) => setRiskProfile((prev) => ({ ...prev, weatherExposure: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            <option value="low">Weather exposure: Low</option>
            <option value="medium">Weather exposure: Medium</option>
            <option value="high">Weather exposure: High</option>
          </select>
          <input type="text" value={riskProfile.localCrimeRisk || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, localCrimeRisk: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Local crime risk (optional)" />
          <input type="text" value={riskProfile.responsiblePerson || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, responsiblePerson: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Safety officer / responsible person" />
          <label className="text-xs flex items-center gap-2 border border-gray-300 rounded px-2 py-1.5"><input type="checkbox" checked={!!riskProfile.alcoholPresent} onChange={(e) => setRiskProfile((prev) => ({ ...prev, alcoholPresent: e.target.checked }))} /> Alcohol present</label>
          <label className="text-xs flex items-center gap-2 border border-gray-300 rounded px-2 py-1.5"><input type="checkbox" checked={!!riskProfile.ticketedEvent} onChange={(e) => setRiskProfile((prev) => ({ ...prev, ticketedEvent: e.target.checked }))} /> Ticketed event</label>
          <label className="text-xs flex items-center gap-2 border border-gray-300 rounded px-2 py-1.5"><input type="checkbox" checked={!!riskProfile.generatorUse} onChange={(e) => setRiskProfile((prev) => ({ ...prev, generatorUse: e.target.checked }))} /> Generator use</label>
          <label className="text-xs flex items-center gap-2 border border-gray-300 rounded px-2 py-1.5"><input type="checkbox" checked={!!riskProfile.vipAttendance} onChange={(e) => setRiskProfile((prev) => ({ ...prev, vipAttendance: e.target.checked }))} /> VIP attendance</label>
        </div>
        <textarea value={riskProfile.fireRiskFactors || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, fireRiskFactors: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Fire risk factors (open flame, pyro, haze, gas, etc.)" />
        <textarea value={riskProfile.notes || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, notes: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Risk notes" />
        <div className="p-2 rounded bg-[#faf8f3] border border-[#c8a45e33] text-xs">
          <strong>Current score:</strong> {riskResult.riskScore} ({riskResult.riskLevel}) · Security ratio {riskResult.staffingRatio ?? 'N/A'}
          {(riskResult.recommendations || []).map((line, idx) => <p key={`risk-rec-${idx}`} className="m-0 mt-1">• {line}</p>)}
        </div>
        <button type="button" className="btn-primary text-xs" onClick={handleSaveRiskProfile}>Save Risk Profile</button>
      </section>

      <section id="permits" className="card space-y-2">
        <h3 className="mt-0">Permits & Compliance</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select value={permitDraft.permitType} onChange={(e) => setPermitDraft((prev) => ({ ...prev, permitType: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            <option value="">Permit type</option>
            {PERMIT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input type="text" value={permitDraft.permitNumber} onChange={(e) => setPermitDraft((prev) => ({ ...prev, permitNumber: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Permit number" />
          <input type="text" value={permitDraft.issuingAuthority} onChange={(e) => setPermitDraft((prev) => ({ ...prev, issuingAuthority: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Issuing authority" />
          <input type="datetime-local" value={safeDateTimeInput(permitDraft.expiresAt)} onChange={(e) => setPermitDraft((prev) => ({ ...prev, expiresAt: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
          <input type="url" value={permitDraft.fileUrl} onChange={(e) => setPermitDraft((prev) => ({ ...prev, fileUrl: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-2" placeholder="Permit file URL" />
          <input type="text" value={permitDraft.responsiblePerson} onChange={(e) => setPermitDraft((prev) => ({ ...prev, responsiblePerson: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Responsible person" />
          <select value={permitDraft.status} onChange={(e) => setPermitDraft((prev) => ({ ...prev, status: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <textarea value={permitDraft.notes} onChange={(e) => setPermitDraft((prev) => ({ ...prev, notes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-4" placeholder="Permit notes" />
        </div>
        <button type="button" className="btn-secondary text-xs" onClick={handleSavePermit}>Save Permit</button>
        <div className="space-y-1 text-xs">
          {permits.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded px-2 py-1">
              <span>{row.permit_type} · {row.status} {row.expires_at ? `· Expires ${new Date(row.expires_at).toLocaleDateString()}` : ''}</span>
              <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeEventPermit(row.id).then(() => loadSafetyData(selectedEventId))}>Remove</button>
            </div>
          ))}
          {permits.length === 0 && <p className="text-gray-500 m-0">No permits logged yet.</p>}
        </div>
      </section>

      <section id="insurance" className="card space-y-2">
        <h3 className="mt-0">Insurance & Liability</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select value={policyDraft.policyType} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, policyType: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            <option value="">Policy type</option>
            {INSURANCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input type="text" value={policyDraft.policyNumber} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, policyNumber: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Policy number" />
          <input type="text" value={policyDraft.carrier} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, carrier: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Carrier" />
          <input type="datetime-local" value={safeDateTimeInput(policyDraft.expiresAt)} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, expiresAt: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
          <input type="text" value={policyDraft.coverageLimits} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, coverageLimits: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-2" placeholder="Coverage limits" />
          <input type="number" value={policyDraft.deductible} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, deductible: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Deductible" />
          <input type="text" value={policyDraft.additionalInsured} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, additionalInsured: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Additional insured" />
          <input type="url" value={policyDraft.coiFileUrl} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, coiFileUrl: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-2" placeholder="COI file URL" />
          <select value={policyDraft.status} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, status: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
          </select>
          <textarea value={policyDraft.notes} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, notes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-4" placeholder="Insurance notes" />
        </div>
        <button type="button" className="btn-secondary text-xs" onClick={handleSavePolicy}>Save Insurance Policy</button>
        <div className="space-y-1 text-xs">
          {policies.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded px-2 py-1">
              <span>{row.policy_type} · {row.status} {row.expires_at ? `· Expires ${new Date(row.expires_at).toLocaleDateString()}` : ''}</span>
              <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeEventInsurancePolicy(row.id).then(() => loadSafetyData(selectedEventId))}>Remove</button>
            </div>
          ))}
          {policies.length === 0 && <p className="text-gray-500 m-0">No insurance policies logged yet.</p>}
        </div>
      </section>

      <section id="fire_egress" className="card space-y-2">
        <h3 className="mt-0">Fire & Egress Planning</h3>
        <p className="text-xs text-gray-600 m-0">Map exits, occupancy, and emergency routes in Plots & Layouts Safety View, then confirm these checks.</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
          {[
            ['occupancyConfirmed', 'Occupancy confirmed'],
            ['exitsMarked', 'Exits marked'],
            ['fireLanesClear', 'Fire lanes clear'],
            ['electricalLoadApproved', 'Electrical load approved'],
            ['marshalWalkthroughComplete', 'Marshal walkthrough complete'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 px-2 py-1.5 border border-gray-300 rounded">
              <input
                type="checkbox"
                checked={!!riskProfile.metadata?.fireEgress?.[key]}
                onChange={(e) => setRiskProfile((prev) => ({
                  ...prev,
                  metadata: {
                    ...(prev.metadata || {}),
                    fireEgress: {
                      ...(prev.metadata?.fireEgress || {}),
                      [key]: e.target.checked,
                    },
                  },
                }))}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input type="text" value={riskProfile.metadata?.fireEgress?.extinguisherPlacement || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, metadata: { ...(prev.metadata || {}), fireEgress: { ...(prev.metadata?.fireEgress || {}), extinguisherPlacement: e.target.value } } }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Extinguisher placement" />
          <input type="text" value={riskProfile.metadata?.fireEgress?.fireAlarmPlacement || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, metadata: { ...(prev.metadata || {}), fireEgress: { ...(prev.metadata?.fireEgress || {}), fireAlarmPlacement: e.target.value } } }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Fire alarm placement" />
          <input type="text" value={riskProfile.metadata?.fireEgress?.emergencyLighting || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, metadata: { ...(prev.metadata || {}), fireEgress: { ...(prev.metadata?.fireEgress || {}), emergencyLighting: e.target.value } } }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Emergency lighting notes" />
          <input type="text" value={riskProfile.metadata?.fireEgress?.maxOccupancy || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, metadata: { ...(prev.metadata || {}), fireEgress: { ...(prev.metadata?.fireEgress || {}), maxOccupancy: e.target.value } } }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Maximum occupancy" />
        </div>
        <p className="text-xs m-0"><Link to={`/production-ops/event-ops?eventId=${selectedEventId}&focus=event_ops`}>Open Plots & Layouts Safety View</Link></p>
        <button type="button" className="btn-secondary text-xs" onClick={handleSaveRiskProfile}>Save Fire & Egress</button>
      </section>

      <section id="security_screening" className="card space-y-2">
        <h3 className="mt-0">Security Screening</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
          {[
            ['noWeaponsSignage', 'No Weapons signage'],
            ['clearBagPolicy', 'Clear bag policy'],
            ['idRequiredNotice', 'ID required notice'],
            ['alcoholNotice', 'Alcohol enforcement notice'],
            ['complianceNotice', 'State/federal compliance notice'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 px-2 py-1.5 border border-gray-300 rounded">
              <input
                type="checkbox"
                checked={!!riskProfile.metadata?.securityScreening?.[key]}
                onChange={(e) => setRiskProfile((prev) => ({
                  ...prev,
                  metadata: {
                    ...(prev.metadata || {}),
                    securityScreening: {
                      ...(prev.metadata?.securityScreening || {}),
                      [key]: e.target.checked,
                    },
                  },
                }))}
              />
              {label}
            </label>
          ))}
        </div>
        <textarea value={riskProfile.metadata?.securityScreening?.screeningNotes || ''} onChange={(e) => setRiskProfile((prev) => ({ ...prev, metadata: { ...(prev.metadata || {}), securityScreening: { ...(prev.metadata?.securityScreening || {}), screeningNotes: e.target.value } } }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Screening layout notes (bag check, metal detector, credential points)" />
        <button type="button" className="btn-secondary text-xs" onClick={handleSaveRiskProfile}>Save Security Screening</button>
      </section>

      <section id="surveillance" className="card space-y-2">
        <h3 className="mt-0">Surveillance (CCTV)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select value={surveillanceDraft.assetType} onChange={(e) => setSurveillanceDraft((prev) => ({ ...prev, assetType: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            {SURVEILLANCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input type="text" value={surveillanceDraft.cameraId} onChange={(e) => setSurveillanceDraft((prev) => ({ ...prev, cameraId: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Camera ID" />
          <input type="text" value={surveillanceDraft.location} onChange={(e) => setSurveillanceDraft((prev) => ({ ...prev, location: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Location" />
          <input type="text" value={surveillanceDraft.coverageZone} onChange={(e) => setSurveillanceDraft((prev) => ({ ...prev, coverageZone: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Coverage zone" />
          <input type="number" min="0" value={surveillanceDraft.retentionDays} onChange={(e) => setSurveillanceDraft((prev) => ({ ...prev, retentionDays: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Retention days" />
          <input type="text" value={surveillanceDraft.monitoringAssignee} onChange={(e) => setSurveillanceDraft((prev) => ({ ...prev, monitoringAssignee: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Monitoring assignee" />
          <input type="url" value={surveillanceDraft.liveFeedUrl} onChange={(e) => setSurveillanceDraft((prev) => ({ ...prev, liveFeedUrl: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-2" placeholder="Live feed URL" />
        </div>
        <button type="button" className="btn-secondary text-xs" onClick={handleSaveSurveillance}>Save Surveillance Asset</button>
        <div className="space-y-1 text-xs">
          {surveillanceAssets.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded px-2 py-1">
              <span>{row.asset_type} · {row.location || 'Location TBD'} · monitor: {row.monitoring_assignee || 'unassigned'} · retention: {row.retention_days || 0}d</span>
              <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeEventSurveillanceAsset(row.id).then(() => loadSafetyData(selectedEventId))}>Remove</button>
            </div>
          ))}
        </div>
      </section>

      <section id="access_control" className="card space-y-2">
        <h3 className="mt-0">Access Control</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select value={accessDraft.controlType} onChange={(e) => setAccessDraft((prev) => ({ ...prev, controlType: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            {ACCESS_CONTROL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input type="text" value={accessDraft.label} onChange={(e) => setAccessDraft((prev) => ({ ...prev, label: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Checkpoint label" />
          <input type="text" value={accessDraft.location} onChange={(e) => setAccessDraft((prev) => ({ ...prev, location: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Location" />
          <input type="text" value={accessDraft.clearanceLevel} onChange={(e) => setAccessDraft((prev) => ({ ...prev, clearanceLevel: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Clearance level" />
          <input type="text" value={accessDraft.assignedStaff} onChange={(e) => setAccessDraft((prev) => ({ ...prev, assignedStaff: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Assigned staff" />
          <input type="text" value={accessDraft.accessHours} onChange={(e) => setAccessDraft((prev) => ({ ...prev, accessHours: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Access hours" />
          <textarea value={accessDraft.notes} onChange={(e) => setAccessDraft((prev) => ({ ...prev, notes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-2" placeholder="Notes" />
        </div>
        <button type="button" className="btn-secondary text-xs" onClick={handleSaveAccessPoint}>Save Access Point</button>
        <div className="space-y-1 text-xs">
          {accessPoints.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded px-2 py-1">
              <span>{row.control_type} · {row.label || 'Checkpoint'} · {row.location || 'Location TBD'}</span>
              <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeEventAccessControlPoint(row.id).then(() => loadSafetyData(selectedEventId))}>Remove</button>
            </div>
          ))}
        </div>
      </section>

      <section id="crowd_management" className="card space-y-2">
        <h3 className="mt-0">Crowd Management</h3>
        <textarea value={crowdPlan?.barricade_plan || ''} onChange={(e) => setCrowdPlan((prev) => ({ ...(prev || {}), barricade_plan: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Barricade plan" />
        <textarea value={crowdPlan?.queue_plan || ''} onChange={(e) => setCrowdPlan((prev) => ({ ...(prev || {}), queue_plan: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Queue line plan" />
        <textarea value={crowdPlan?.vip_lane_plan || ''} onChange={(e) => setCrowdPlan((prev) => ({ ...(prev || {}), vip_lane_plan: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="VIP lane plan" />
        <textarea value={crowdPlan?.ada_access_plan || ''} onChange={(e) => setCrowdPlan((prev) => ({ ...(prev || {}), ada_access_plan: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="ADA access plan" />
        <textarea value={crowdPlan?.emergency_assembly_points || ''} onChange={(e) => setCrowdPlan((prev) => ({ ...(prev || {}), emergency_assembly_points: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Emergency assembly points" />
        <button type="button" className="btn-secondary text-xs" onClick={() => applySimplePlanPatch(saveEventCrowdPlan, crowdPlan, 'Crowd plan')}>Save Crowd Plan</button>
      </section>

      <section id="medical" className="card space-y-2">
        <h3 className="mt-0">Medical & First Aid</h3>
        <textarea value={medicalPlan?.first_aid_station || ''} onChange={(e) => setMedicalPlan((prev) => ({ ...(prev || {}), first_aid_station: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="First aid station" />
        <textarea value={medicalPlan?.emt_staffing || ''} onChange={(e) => setMedicalPlan((prev) => ({ ...(prev || {}), emt_staffing: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="EMT staffing" />
        <textarea value={medicalPlan?.aed_locations || ''} onChange={(e) => setMedicalPlan((prev) => ({ ...(prev || {}), aed_locations: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="AED locations" />
        <textarea value={medicalPlan?.hydration_stations || ''} onChange={(e) => setMedicalPlan((prev) => ({ ...(prev || {}), hydration_stations: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Hydration stations" />
        <button type="button" className="btn-secondary text-xs" onClick={() => applySimplePlanPatch(saveEventMedicalPlan, medicalPlan, 'Medical plan')}>Save Medical Plan</button>
      </section>

      <section id="sanitation" className="card space-y-2">
        <h3 className="mt-0">Sanitation & Health</h3>
        <textarea value={sanitationPlan?.restrooms || ''} onChange={(e) => setSanitationPlan((prev) => ({ ...(prev || {}), restrooms: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Restroom plan" />
        <textarea value={sanitationPlan?.hand_washing_stations || ''} onChange={(e) => setSanitationPlan((prev) => ({ ...(prev || {}), hand_washing_stations: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Hand-washing stations" />
        <textarea value={sanitationPlan?.sanitizer_stations || ''} onChange={(e) => setSanitationPlan((prev) => ({ ...(prev || {}), sanitizer_stations: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Sanitizer stations" />
        <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-300 rounded">
          <input type="checkbox" checked={!!sanitationPlan?.food_vendor_permits_verified} onChange={(e) => setSanitationPlan((prev) => ({ ...(prev || {}), food_vendor_permits_verified: e.target.checked }))} />
          Food vendor health permits verified
        </label>
        <button type="button" className="btn-secondary text-xs" onClick={() => applySimplePlanPatch(saveEventSanitationPlan, sanitationPlan, 'Sanitation plan')}>Save Sanitation Plan</button>
      </section>

      <section id="weather" className="card space-y-2">
        <h3 className="mt-0">Weather Contingency</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input type="text" value={weatherPlan?.heat_index_threshold || ''} onChange={(e) => setWeatherPlan((prev) => ({ ...(prev || {}), heat_index_threshold: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Heat index threshold" />
          <input type="text" value={weatherPlan?.wind_threshold || ''} onChange={(e) => setWeatherPlan((prev) => ({ ...(prev || {}), wind_threshold: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Wind threshold" />
          <input type="text" value={weatherPlan?.weather_monitor_assignee || ''} onChange={(e) => setWeatherPlan((prev) => ({ ...(prev || {}), weather_monitor_assignee: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Weather monitor assigned" />
        </div>
        <textarea value={weatherPlan?.rain_plan || ''} onChange={(e) => setWeatherPlan((prev) => ({ ...(prev || {}), rain_plan: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Rain plan" />
        <textarea value={weatherPlan?.lightning_protocol || ''} onChange={(e) => setWeatherPlan((prev) => ({ ...(prev || {}), lightning_protocol: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Lightning protocol" />
        <textarea value={weatherPlan?.evacuation_shelter_location || ''} onChange={(e) => setWeatherPlan((prev) => ({ ...(prev || {}), evacuation_shelter_location: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Evacuation shelter location" />
        <button type="button" className="btn-secondary text-xs" onClick={() => applySimplePlanPatch(saveEventWeatherPlan, weatherPlan, 'Weather plan')}>Save Weather Plan</button>
      </section>

      <section id="city" className="card space-y-2">
        <h3 className="mt-0">Law Enforcement & City Coordination</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input type="text" value={cityPlan?.police_liaison || ''} onChange={(e) => setCityPlan((prev) => ({ ...(prev || {}), police_liaison: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Police liaison" />
          <input type="text" value={cityPlan?.fire_department_contact || ''} onChange={(e) => setCityPlan((prev) => ({ ...(prev || {}), fire_department_contact: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Fire department contact" />
          <input type="text" value={cityPlan?.ems_contact || ''} onChange={(e) => setCityPlan((prev) => ({ ...(prev || {}), ems_contact: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="EMS contact" />
          <input type="text" value={cityPlan?.city_event_contact || ''} onChange={(e) => setCityPlan((prev) => ({ ...(prev || {}), city_event_contact: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="City event contact" />
          <input type="text" value={cityPlan?.command_center_location || ''} onChange={(e) => setCityPlan((prev) => ({ ...(prev || {}), command_center_location: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Command center location" />
          <input type="number" min="0" value={cityPlan?.off_duty_officers_count || ''} onChange={(e) => setCityPlan((prev) => ({ ...(prev || {}), off_duty_officers_count: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Off-duty officers count" />
        </div>
        <textarea value={cityPlan?.communication_plan || ''} onChange={(e) => setCityPlan((prev) => ({ ...(prev || {}), communication_plan: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Communication plan" />
        <button type="button" className="btn-secondary text-xs" onClick={() => applySimplePlanPatch(saveEventCityCoordination, cityPlan, 'City coordination plan')}>Save City Coordination</button>
      </section>

      <section id="incidents" className="card space-y-2">
        <h3 className="mt-0">Incident Reporting</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input type="datetime-local" value={safeDateTimeInput(incidentDraft.occurredAt)} onChange={(e) => setIncidentDraft((prev) => ({ ...prev, occurredAt: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
          <input type="text" value={incidentDraft.location} onChange={(e) => setIncidentDraft((prev) => ({ ...prev, location: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Location" />
          <select value={incidentDraft.incidentType} onChange={(e) => setIncidentDraft((prev) => ({ ...prev, incidentType: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            {INCIDENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={incidentDraft.status} onChange={(e) => setIncidentDraft((prev) => ({ ...prev, status: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
          <textarea value={incidentDraft.description} onChange={(e) => setIncidentDraft((prev) => ({ ...prev, description: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-2" placeholder="Description" />
          <textarea value={incidentDraft.resolution} onChange={(e) => setIncidentDraft((prev) => ({ ...prev, resolution: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-2" placeholder="Resolution / response" />
          <input type="url" value={incidentDraft.fileUrl} onChange={(e) => setIncidentDraft((prev) => ({ ...prev, fileUrl: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-2" placeholder="Attachment URL" />
          <label className="text-xs flex items-center gap-2 border border-gray-300 rounded px-2 py-1.5"><input type="checkbox" checked={!!incidentDraft.followUpRequired} onChange={(e) => setIncidentDraft((prev) => ({ ...prev, followUpRequired: e.target.checked }))} /> Follow-up required</label>
        </div>
        <button type="button" className="btn-secondary text-xs" onClick={handleSaveIncident}>Save Incident</button>
        <div className="space-y-1 text-xs">
          {incidents.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded px-2 py-1">
              <span>{new Date(row.occurred_at || row.created_at).toLocaleString()} · {row.incident_type} · {row.status}</span>
              <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeEventIncident(row.id).then(() => loadSafetyData(selectedEventId))}>Remove</button>
            </div>
          ))}
        </div>
      </section>

      <section id="eap" className="card space-y-2">
        <h3 className="mt-0">Emergency Action Plan (Auto-Generated)</h3>
        <p className="text-xs text-gray-600 m-0">Generate a fresh EAP from event details, risk score, permits, insurance, weather, medical, and incident context.</p>
        <button type="button" className="btn-primary text-xs" onClick={handleGenerateEap}>Generate Emergency Action Plan</button>
        <div className="space-y-1 text-xs">
          {eapDocs.map((row) => (
            <div key={row.id} className="border border-gray-200 rounded px-2 py-1">
              <strong>{row.title}</strong> · v{row.version_number} · {row.risk_level} risk · {row.generated_at ? new Date(row.generated_at).toLocaleString() : 'Generated'}
            </div>
          ))}
          {eapDocs.length === 0 && <p className="text-gray-500 m-0">No EAP generated yet.</p>}
        </div>
      </section>

      <section id="documents" className="card space-y-2">
        <h3 className="mt-0">Documents & Uploads</h3>
        <p className="text-xs text-gray-600 m-0">Collect permit files, COIs, and incident attachments here for stakeholder and city submission packets.</p>
        <div className="space-y-1 text-xs">
          {documentLinks.map((row, idx) => (
            <p key={`doc-link-${idx}`} className="m-0"><a href={row.url} target="_blank" rel="noreferrer">{row.label}</a></p>
          ))}
          {documentLinks.length === 0 && <p className="text-gray-500 m-0">No uploaded links yet. Add file URLs in permits, insurance, or incidents.</p>}
        </div>
      </section>

      <section id="safety_checklists" className="card space-y-2">
        <h3 className="mt-0">Safety Checklists</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input type="text" value={checklistDraft.title} onChange={(e) => setChecklistDraft((prev) => ({ ...prev, title: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Checklist title" />
          <input type="text" value={checklistDraft.phase} onChange={(e) => setChecklistDraft((prev) => ({ ...prev, phase: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Phase (pre_show, live_show, closeout)" />
          <button type="button" className="btn-secondary text-xs" onClick={handleSaveChecklist}>Save Checklist</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <select value={activeChecklistId} onChange={(e) => setActiveChecklistId(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white md:col-span-2">
            <option value="">Choose checklist</option>
            {checklists.map((row) => <option key={row.id} value={row.id}>{row.title} · {row.phase}</option>)}
          </select>
          <input type="text" value={checklistItemDraft.label} onChange={(e) => setChecklistItemDraft((prev) => ({ ...prev, label: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-2" placeholder="Checklist item" />
          <input type="text" value={checklistItemDraft.category} onChange={(e) => setChecklistItemDraft((prev) => ({ ...prev, category: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Category" />
          <select value={checklistItemDraft.status} onChange={(e) => setChecklistItemDraft((prev) => ({ ...prev, status: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
          <input type="text" value={checklistItemDraft.assigneeName} onChange={(e) => setChecklistItemDraft((prev) => ({ ...prev, assigneeName: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Assignee" />
          <input type="datetime-local" value={safeDateTimeInput(checklistItemDraft.dueAt)} onChange={(e) => setChecklistItemDraft((prev) => ({ ...prev, dueAt: e.target.value }))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
          <label className="text-xs flex items-center gap-2 px-2 py-1.5 border border-gray-300 rounded"><input type="checkbox" checked={checklistItemDraft.required !== false} onChange={(e) => setChecklistItemDraft((prev) => ({ ...prev, required: e.target.checked }))} /> Required</label>
          <textarea value={checklistItemDraft.notes} onChange={(e) => setChecklistItemDraft((prev) => ({ ...prev, notes: e.target.value }))} rows={2} className="px-2 py-1.5 border border-gray-300 rounded text-xs md:col-span-3" placeholder="Notes" />
          <button type="button" className="btn-secondary text-xs" onClick={handleSaveChecklistItem} disabled={!activeChecklistId}>Save Checklist Item</button>
        </div>
        {activeChecklist && (
          <div className="space-y-1 text-xs">
            {(activeChecklist.items || []).map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded px-2 py-1">
                <span>{row.label} · {row.category} · {row.status}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={row.status || 'todo'}
                    onChange={(e) => saveEventSafetyChecklistItem(selectedEventId, activeChecklist.id, { id: row.id, ...row, status: e.target.value, checklistId: activeChecklist.id }).then(() => loadSafetyData(selectedEventId))}
                    className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <button type="button" className="text-[11px] px-2 py-0.5 border border-red-300 text-red-700 rounded bg-white" onClick={() => removeEventSafetyChecklistItem(row.id).then(() => loadSafetyData(selectedEventId))}>Remove</button>
                </div>
              </div>
            ))}
            {(activeChecklist.items || []).length === 0 && <p className="text-gray-500 m-0">No items in this checklist yet.</p>}
          </div>
        )}
      </section>
    </div>
  );
}
