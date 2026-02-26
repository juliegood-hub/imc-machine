import { parseLocalDate } from '../lib/dateUtils';
import { useState, useEffect } from 'react';
import { useVenue } from '../context/VenueContext';
import { useSearchParams } from 'react-router-dom';
import {
  THEATER_GENRE_KEY,
  findNearestTheaterRole,
  getTheaterDepartmentForRole,
} from '../constants/theaterRoles';

const DEFAULT_ROWS = [
  { id: '1', cueId: 'PRE-1', department: 'STAGE', scriptRef: '', environment: 'House', time: '18:00', duration: '', item: 'Doors Open', crewMember: '', status: 'planned', notes: '' },
  { id: '2', cueId: 'PRE-2', department: 'AUDIO', scriptRef: '', environment: 'Stage', time: '18:30', duration: '', item: 'Sound Check', crewMember: '', status: 'planned', notes: '' },
  { id: '3', cueId: 'SM-1', department: 'STAGE', scriptRef: '', environment: 'Stage', time: '19:00', duration: '5 min', item: 'Welcome / Intro', crewMember: '', status: 'planned', notes: '' },
  { id: '4', cueId: 'SHOW-1', department: 'STAGE', scriptRef: '', environment: 'Performance', time: '19:05', duration: '', item: 'Main Performance', crewMember: '', status: 'planned', notes: '' },
];

const THEATER_DEFAULT_ROWS = [
  { id: '1', cueId: 'FOH-1', department: 'FOH', scriptRef: 'Preset', environment: 'House', time: '18:00', duration: '', item: 'House Opens', crewMember: '', status: 'planned', notes: 'FOH, ushers, and box office active' },
  { id: '2', cueId: 'SM-2', department: 'STAGE', scriptRef: 'SM Call', environment: 'Backstage', time: '18:45', duration: '10 min', item: 'Half Hour / Places Call', crewMember: '', status: 'planned', notes: 'Stage manager confirms cast and crew' },
  { id: '3', cueId: 'ACT1', department: 'STAGE', scriptRef: 'Act I', environment: 'Set A', time: '19:00', duration: '60 min', item: 'Act I', crewMember: '', status: 'planned', notes: 'Cue stack follows prompt book' },
  { id: '4', cueId: 'INT-1', department: 'DECK', scriptRef: 'Intermission', environment: 'House + Deck', time: '20:00', duration: '15 min', item: 'Intermission', crewMember: '', status: 'planned', notes: 'House reset and quick changes' },
  { id: '5', cueId: 'ACT2', department: 'STAGE', scriptRef: 'Act II', environment: 'Set B', time: '20:15', duration: '50 min', item: 'Act II', crewMember: '', status: 'planned', notes: 'Standby for finale and curtain call' },
  { id: '6', cueId: 'END-1', department: 'FOH', scriptRef: 'Curtain', environment: 'House', time: '21:05', duration: '10 min', item: 'Curtain Call / Exit Music', crewMember: '', status: 'planned', notes: 'FOH egress and post-show reset' },
];

const DEFAULT_OPEN_MIC_QUEUE = [
  { id: '1', name: 'Sarah Johnson', song: 'Original Acoustic', notes: 'Needs mic stand', done: false },
  { id: '2', name: 'Mike Chen', song: 'Guitar Cover', notes: '', done: false },
];

const CUE_DEPARTMENTS = ['STAGE', 'LX', 'AUDIO', 'VIDEO', 'DECK', 'FLY', 'FOH'];

const CUE_STATUSES = [
  { value: 'planned', label: 'Planned', color: 'bg-gray-100 text-gray-700' },
  { value: 'standby', label: 'Standby', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'go', label: 'Go', color: 'bg-blue-100 text-blue-700' },
  { value: 'executed', label: 'Executed', color: 'bg-green-100 text-green-700' },
  { value: 'hold', label: 'Hold', color: 'bg-red-100 text-red-700' },
];

const TECH_CHECKLIST_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  { value: 'ready', label: 'Ready', color: 'bg-green-100 text-green-700' },
  { value: 'issue', label: 'Issue', color: 'bg-red-100 text-red-700' },
];

const DEFAULT_TECH_CHECKLIST = [
  { id: 'tech_1', department: 'LX', item: 'Lighting board file loaded and cue stack verified', ownerRole: 'Lighting Supervisor', status: 'pending', notes: '' },
  { id: 'tech_2', department: 'AUDIO', item: 'Playback, RF mics, and monitor sends checked', ownerRole: 'Audio Supervisor', status: 'pending', notes: '' },
  { id: 'tech_3', department: 'DECK', item: 'Props preset, scene transitions, and deck tracks cleared', ownerRole: 'Deck Crew Chief', status: 'pending', notes: '' },
  { id: 'tech_4', department: 'VIDEO', item: 'Projection/video routing tested', ownerRole: 'Technical Director', status: 'pending', notes: '' },
  { id: 'tech_5', department: 'STAGE', item: 'Comms and backstage call system tested', ownerRole: 'Production Stage Manager', status: 'pending', notes: '' },
  { id: 'tech_6', department: 'FOH', item: 'House open flow, seating, and late seating plan confirmed', ownerRole: 'Company Manager', status: 'pending', notes: '' },
  { id: 'tech_7', department: 'STAGE', item: 'Safety walkthrough complete (exits, fire lanes, rigging checks)', ownerRole: 'Technical Director', status: 'pending', notes: '' },
];

function getDefaultRowsForEvent(event) {
  const source = event?.genre === THEATER_GENRE_KEY ? THEATER_DEFAULT_ROWS : DEFAULT_ROWS;
  return source.map((row, index) => ({
    ...row,
    cueId: row.cueId || `CUE-${index + 1}`,
    department: row.department || 'STAGE',
    status: row.status || 'planned',
  }));
}

function getDefaultOpenMicQueue() {
  return DEFAULT_OPEN_MIC_QUEUE.map(item => ({ ...item }));
}

const WORKFLOW_STATUSES = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-100 text-gray-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-100 text-red-700' },
  { value: 'handoff', label: 'Handoff', color: 'bg-purple-100 text-purple-700' },
  { value: 'done', label: 'Done', color: 'bg-green-100 text-green-700' },
];

const DEFAULT_THEATER_STAFF_ASSIGNMENTS = [
  {
    id: 'role_psm',
    role: 'Production Stage Manager',
    assignee: '',
    email: '',
    phone: '',
    responsibility: 'Own inbound email triage, cue call authority, and final run-of-show lock.',
  },
  {
    id: 'role_td',
    role: 'Technical Director',
    assignee: '',
    email: '',
    phone: '',
    responsibility: 'Coordinate cross-department tech readiness and resolve blocked technical dependencies.',
  },
  {
    id: 'role_lx',
    role: 'Lighting Supervisor',
    assignee: '',
    email: '',
    phone: '',
    responsibility: 'Confirm LX cue programming, standby/go readiness, and board-op execution.',
  },
  {
    id: 'role_audio',
    role: 'Audio Supervisor',
    assignee: '',
    email: '',
    phone: '',
    responsibility: 'Confirm audio cue stack, playback, RF checks, and mix execution.',
  },
  {
    id: 'role_deck',
    role: 'Deck Crew Chief',
    assignee: '',
    email: '',
    phone: '',
    responsibility: 'Manage deck/fly/shift cues, scene transitions, and backstage clearances.',
  },
  {
    id: 'role_company',
    role: 'Company Manager',
    assignee: '',
    email: '',
    phone: '',
    responsibility: 'Verify cast/crew call times, distribute call sheet, and close staffing gaps.',
  },
  {
    id: 'role_press',
    role: 'Publicist / Press Coordinator',
    assignee: '',
    email: '',
    phone: '',
    responsibility: 'Draft, approve, and schedule press release distribution after SM handoff.',
  },
];

const DEFAULT_THEATER_WORKFLOW = [
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

function getDefaultWorkflow(isTheaterEvent) {
  if (!isTheaterEvent) return [];
  return DEFAULT_THEATER_WORKFLOW.map(step => ({ ...step }));
}

function normalizeWorkflowSteps(steps = [], isTheaterEvent = false) {
  if (!isTheaterEvent) return [];
  const defaults = getDefaultWorkflow(true);
  if (!Array.isArray(steps) || steps.length === 0) return defaults;

  const legacyToCurrent = {
    ingest_updates: 'email_intake',
    assign_roles: 'staffing_confirm',
    build_cues: 'technical_sync',
    publish_call_sheet: 'run_of_show_lock',
    run_live_show: 'performance_execution',
  };

  return defaults.map(defaultStep => {
    const directMatch = steps.find(step => step.id === defaultStep.id);
    const legacyMatch = Object.entries(legacyToCurrent)
      .find(([, mappedId]) => mappedId === defaultStep.id)?.[0];
    const existing = directMatch || (legacyMatch ? steps.find(step => step.id === legacyMatch) : null);
    if (!existing) return defaultStep;
    return {
      ...defaultStep,
      ...existing,
      id: defaultStep.id,
      ownerRole: defaultStep.ownerRole,
    };
  });
}

function getDefaultStaffAssignments(isTheaterEvent) {
  if (!isTheaterEvent) return [];
  return DEFAULT_THEATER_STAFF_ASSIGNMENTS.map(row => ({ ...row }));
}

function getDefaultTechChecklist(isTheaterEvent) {
  if (!isTheaterEvent) return [];
  return DEFAULT_TECH_CHECKLIST.map(row => ({ ...row }));
}

function normalizeStaffAssignments(assignments = [], isTheaterEvent = false) {
  if (!isTheaterEvent) return [];
  const defaults = getDefaultStaffAssignments(true);
  if (!Array.isArray(assignments) || assignments.length === 0) return defaults;
  return defaults.map(defaultRow => {
    const existing = assignments.find(row => row.id === defaultRow.id || row.role === defaultRow.role);
    return existing ? { ...defaultRow, ...existing } : defaultRow;
  });
}

function normalizeCueRows(rows = []) {
  return rows.map((row, index) => ({
    ...row,
    id: row.id || makeId('cue'),
    cueId: row.cueId || `CUE-${index + 1}`,
    department: row.department || 'STAGE',
    scriptRef: row.scriptRef || '',
    environment: row.environment || '',
    status: row.status || 'planned',
  }));
}

function normalizeTechChecklist(checklist = [], isTheaterEvent = false) {
  if (!isTheaterEvent) return [];
  const defaults = getDefaultTechChecklist(true);
  if (!Array.isArray(checklist) || checklist.length === 0) return defaults;
  return defaults.map(defaultRow => {
    const existing = checklist.find(row => row.id === defaultRow.id);
    return existing ? { ...defaultRow, ...existing } : defaultRow;
  });
}

function getTechnicalSyncStatusFromChecklist(checklistRows = []) {
  if (!Array.isArray(checklistRows) || checklistRows.length === 0) return 'not_started';
  if (checklistRows.some(row => row.status === 'issue')) return 'blocked';
  const readyCount = checklistRows.filter(row => row.status === 'ready').length;
  if (readyCount === 0) return 'not_started';
  if (readyCount === checklistRows.length) return 'done';
  return 'in_progress';
}

function makeId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEmailTime(input = '') {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = match[2] || '00';
  const ampm = match[3].toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return '';
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function inferCueDepartment(raw = '') {
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

function mergeCueRows(existingRows = [], incomingRows = []) {
  const seen = new Set(
    existingRows.map(row => `${String(row.time || '').toLowerCase()}|${String(row.item || '').toLowerCase()}`)
  );
  const merged = [...existingRows];
  for (const row of incomingRows) {
    const key = `${String(row.time || '').toLowerCase()}|${String(row.item || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

function mergeCrewMembers(existingCrew = [], incomingCrew = []) {
  const seen = new Set(
    existingCrew.map(member => `${String(member.name || '').trim().toLowerCase()}|${String(member.role || '').trim().toLowerCase()}`)
  );
  const merged = [...existingCrew];
  for (const member of incomingCrew) {
    const key = `${String(member.name || '').trim().toLowerCase()}|${String(member.role || '').trim().toLowerCase()}`;
    if (!member.name || seen.has(key)) continue;
    seen.add(key);
    merged.push(member);
  }
  return merged;
}

function parseEmailToStageUpdates(emailBody = '', isTheaterEvent = false) {
  const body = String(emailBody || '');
  const lines = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const cues = [];
  const crewMembers = [];
  let unknownLines = 0;

  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}/g;
  const cueRegex = /^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—:]\s*([^|]+?)(?:\s*\|\s*(.+))?$/i;
  const roleFirstRegex = /^([^:]{2,80})\s*:\s*(.+)$/;

  for (const line of lines) {
    const cueMatch = line.match(cueRegex);
    if (cueMatch) {
      const cueTime = normalizeEmailTime(cueMatch[1]) || cueMatch[1];
      const cueItem = cueMatch[2].trim();
      const cueAssignment = (cueMatch[3] || '').trim();
      cues.push({
        id: makeId('cue'),
        cueId: `AUTO-${cues.length + 1}`,
        department: inferCueDepartment(`${cueItem} ${cueAssignment}`),
        scriptRef: '',
        environment: '',
        time: cueTime,
        duration: '',
        item: cueItem,
        crewMember: cueAssignment,
        status: 'planned',
        notes: 'Imported from email intake',
      });
      continue;
    }

    const roleLine = line.match(roleFirstRegex);
    if (roleLine && isTheaterEvent) {
      const rawRole = roleLine[1].trim();
      const mappedRole = findNearestTheaterRole(rawRole);
      if (mappedRole) {
        const detail = roleLine[2].trim();
        const emails = detail.match(emailRegex) || [];
        const phones = detail.match(phoneRegex) || [];
        const callTimeMatch = detail.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i);
        const cleanedName = detail
          .replace(emailRegex, '')
          .replace(phoneRegex, '')
          .replace(/\b(call|report)\s*time?\b[:\s-]*/i, '')
          .replace(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i, '')
          .replace(/[|,;]+$/g, '')
          .trim();
        crewMembers.push({
          id: makeId('crew'),
          name: cleanedName || detail,
          role: mappedRole,
          department: getTheaterDepartmentForRole(mappedRole),
          email: emails[0] || '',
          phone: phones[0] || '',
          callTime: callTimeMatch ? String(callTimeMatch[1]).trim() : '',
          notes: 'Imported from email intake',
        });
        continue;
      }
    }

    unknownLines++;
  }

  const lowerBody = body.toLowerCase();
  const signals = {
    hasBlockedLanguage: /\b(blocked|delay|issue|problem|urgent)\b/i.test(body),
    callSheetSent: /\b(call sheet).*(sent|shared|distributed)\b/i.test(body),
    showCompleted: /\b(show complete|performance complete|strike complete|wrap)\b/i.test(body),
  };

  if (cues.length > 0) signals.cuesUpdated = true;
  if (crewMembers.length > 0) signals.crewUpdated = true;
  if (lowerBody.includes('final') || lowerBody.includes('locked')) signals.cuesLocked = true;

  return { cues, crewMembers, unknownLines, signals };
}

export default function RunOfShow() {
  const { events, crew, addCrewMember, updateEvent } = useVenue();
  const [searchParams] = useSearchParams();
  const preselectedEventId = searchParams.get('eventId');
  
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [schedulingMode, setSchedulingMode] = useState('clock'); // 'clock' or 'duration'
  const [rows, setRows] = useState(() => getDefaultRowsForEvent(null));
  const [activeCueId, setActiveCueId] = useState('');
  
  // Open mic queue
  const [openMicQueue, setOpenMicQueue] = useState(() => getDefaultOpenMicQueue());
  const [workflowSteps, setWorkflowSteps] = useState(() => getDefaultWorkflow(false));
  const [staffAssignments, setStaffAssignments] = useState(() => getDefaultStaffAssignments(false));
  const [techChecklist, setTechChecklist] = useState(() => getDefaultTechChecklist(false));
  const [emailInbox, setEmailInbox] = useState([]);
  const [emailDraft, setEmailDraft] = useState({
    from: '',
    subject: '',
    receivedAt: '',
    body: '',
  });
  const [emailParseStatus, setEmailParseStatus] = useState('');
  const [emailIngesting, setEmailIngesting] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [printView, setPrintView] = useState(false);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const isTheaterEvent = selectedEvent?.genre === THEATER_GENRE_KEY;
  const checklistSummary = {
    total: techChecklist.length,
    ready: techChecklist.filter(row => row.status === 'ready').length,
    issue: techChecklist.filter(row => row.status === 'issue').length,
    pending: techChecklist.filter(row => row.status === 'pending').length,
  };
  const departmentReadiness = CUE_DEPARTMENTS.map(department => {
    const cuesByDepartment = rows.filter(row => (row.department || 'STAGE') === department);
    const checklistByDepartment = techChecklist.filter(row => row.department === department);
    const executed = cuesByDepartment.filter(row => row.status === 'executed').length;
    const go = cuesByDepartment.filter(row => row.status === 'go').length;
    const standby = cuesByDepartment.filter(row => row.status === 'standby').length;
    const hold = cuesByDepartment.filter(row => row.status === 'hold').length;
    const issueChecks = checklistByDepartment.filter(row => row.status === 'issue').length;

    let readiness = 'Not Used';
    if (cuesByDepartment.length || checklistByDepartment.length) readiness = 'Planned';
    if (standby + go + executed > 0) readiness = 'Active';
    if (hold > 0 || issueChecks > 0) readiness = 'Blocked';
    if (cuesByDepartment.length > 0 && executed === cuesByDepartment.length && issueChecks === 0) readiness = 'Complete';

    return {
      department,
      cueCount: cuesByDepartment.length,
      checklistCount: checklistByDepartment.length,
      executed,
      go,
      standby,
      hold,
      issueChecks,
      readiness,
    };
  });
  const staffingAssignedCount = staffAssignments.filter(row => String(row.assignee || '').trim()).length;
  const cueAssignedCount = rows.filter(row => String(row.crewMember || '').trim()).length;
  const cueHoldCount = rows.filter(row => row.status === 'hold').length;
  const technicalStatus = getTechnicalSyncStatusFromChecklist(techChecklist);
  const readyForRunLock = staffingAssignedCount === staffAssignments.length && technicalStatus === 'done' && cueHoldCount === 0;
  const readyForPressHandoff = readyForRunLock && cueAssignedCount > 0;
  const runLockStep = workflowSteps.find(step => step.id === 'run_of_show_lock' || step.id === 'publish_call_sheet');
  const pressDraftStep = workflowSteps.find(step => step.id === 'press_release_draft');
  const activeCueIndex = rows.findIndex(row => row.id === activeCueId);
  const activeCue = activeCueIndex >= 0 ? rows[activeCueIndex] : null;
  const previousCue = activeCueIndex > 0 ? rows[activeCueIndex - 1] : null;
  const nextCue = activeCueIndex >= 0 && activeCueIndex < rows.length - 1 ? rows[activeCueIndex + 1] : null;

  // Load existing run of show data when event is selected
  useEffect(() => {
    if (!selectedEvent) return;

    if (selectedEvent?.run_of_show) {
      const runOfShow = selectedEvent.run_of_show;
      const theaterEvent = selectedEvent.genre === THEATER_GENRE_KEY;
      if (Array.isArray(runOfShow.cues)) setRows(normalizeCueRows(runOfShow.cues));
      else setRows(getDefaultRowsForEvent(selectedEvent));
      if (Array.isArray(runOfShow.openMicQueue)) setOpenMicQueue(runOfShow.openMicQueue);
      else setOpenMicQueue(theaterEvent ? [] : getDefaultOpenMicQueue());
      if (runOfShow.schedulingMode) setSchedulingMode(runOfShow.schedulingMode);
      else setSchedulingMode('clock');
      const nextWorkflowSteps = Array.isArray(runOfShow.workflowSteps)
        ? normalizeWorkflowSteps(runOfShow.workflowSteps, theaterEvent)
        : getDefaultWorkflow(theaterEvent);
      const nextStaffAssignments = Array.isArray(runOfShow.staffAssignments)
        ? normalizeStaffAssignments(runOfShow.staffAssignments, theaterEvent)
        : getDefaultStaffAssignments(theaterEvent);
      const nextTechChecklist = Array.isArray(runOfShow.techChecklist)
        ? normalizeTechChecklist(runOfShow.techChecklist, theaterEvent)
        : getDefaultTechChecklist(theaterEvent);
      const roleOwners = new Map(
        nextStaffAssignments.map(assignment => [String(assignment.role || '').trim().toLowerCase(), assignment])
      );
      const workflowWithSyncedOwners = nextWorkflowSteps.map(step => {
        if (!theaterEvent) return step;
        const match = roleOwners.get(String(step.ownerRole || '').trim().toLowerCase());
        if (!match || !match.assignee) return step;
        return { ...step, owner: `${match.assignee} (${match.role})` };
      });
      setWorkflowSteps(workflowWithSyncedOwners);
      setStaffAssignments(nextStaffAssignments);
      setTechChecklist(nextTechChecklist);
      if (Array.isArray(runOfShow.emailInbox)) setEmailInbox(runOfShow.emailInbox);
      else setEmailInbox([]);
      setEmailDraft({ from: '', subject: '', receivedAt: '', body: '' });
      setEmailParseStatus('');
      setHandoffStatus('');
      setActiveCueId('');
      return;
    }

    setRows(getDefaultRowsForEvent(selectedEvent));
    setOpenMicQueue(selectedEvent.genre === THEATER_GENRE_KEY ? [] : getDefaultOpenMicQueue());
    setSchedulingMode('clock');
    setWorkflowSteps(getDefaultWorkflow(selectedEvent.genre === THEATER_GENRE_KEY));
    setStaffAssignments(getDefaultStaffAssignments(selectedEvent.genre === THEATER_GENRE_KEY));
    setTechChecklist(getDefaultTechChecklist(selectedEvent.genre === THEATER_GENRE_KEY));
    setEmailInbox([]);
    setEmailDraft({ from: '', subject: '', receivedAt: '', body: '' });
    setEmailParseStatus('');
    setHandoffStatus('');
    setActiveCueId('');
  }, [selectedEvent]);

  useEffect(() => {
    if (!rows.length) {
      if (activeCueId) setActiveCueId('');
      return;
    }
    const hasActive = rows.some(row => row.id === activeCueId);
    if (!hasActive) setActiveCueId(rows[0].id);
  }, [rows, activeCueId]);

  const addRow = () => {
    setRows([...rows, { 
      id: Date.now().toString(), 
      cueId: `CUE-${rows.length + 1}`,
      department: 'STAGE',
      scriptRef: '',
      environment: '',
      time: '', 
      duration: '', 
      item: '', 
      crewMember: '', 
      status: 'planned',
      notes: '' 
    }]);
  };

  const removeRow = (id) => {
    if (rows.length <= 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const moveRow = (index, direction) => {
    const newRows = [...rows];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newRows.length) return;
    [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
    setRows(newRows);
  };

  const jumpActiveCue = (direction) => {
    if (activeCueIndex < 0) return;
    const targetIndex = activeCueIndex + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    setActiveCueId(rows[targetIndex].id);
  };

  const setActiveCueStatus = (statusValue) => {
    if (!activeCue) return;
    updateRow(activeCue.id, 'status', statusValue);
  };

  // Open Mic Queue functions
  const addOpenMicPerformer = () => {
    const name = prompt('Performer name:');
    if (!name) return;
    
    const song = prompt('Song/performance:');
    setOpenMicQueue(prev => [...prev, {
      id: Date.now().toString(),
      name,
      song: song || '',
      notes: '',
      done: false
    }]);
  };

  const updateOpenMicPerformer = (id, field, value) => {
    setOpenMicQueue(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const moveOpenMicPerformer = (index, direction) => {
    const newQueue = [...openMicQueue];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;
    [newQueue[index], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[index]];
    setOpenMicQueue(newQueue);
  };

  const removeOpenMicPerformer = (id) => {
    setOpenMicQueue(prev => prev.filter(p => p.id !== id));
  };

  const updateWorkflowStep = (id, field, value) => {
    setWorkflowSteps(prev => prev.map(step => (
      step.id === id ? { ...step, [field]: value } : step
    )));
  };

  const setWorkflowStepStatuses = (updates = []) => {
    const byId = new Map(updates.map(update => [update.id, update]));
    setWorkflowSteps(prev => prev.map(step => {
      const update = byId.get(step.id);
      if (!update) return step;
      return {
        ...step,
        ...(update.status ? { status: update.status } : {}),
        ...(update.owner ? { owner: update.owner } : {}),
      };
    }));
  };

  const handleLockRunOfShow = () => {
    if (!readyForRunLock) {
      const reasons = [];
      if (staffingAssignedCount !== staffAssignments.length) reasons.push('staff assignments incomplete');
      if (technicalStatus !== 'done') reasons.push('technical checklist not fully ready');
      if (cueHoldCount > 0) reasons.push('one or more cues are on hold');
      alert(`I cannot lock run of show yet. Still pending: ${reasons.join(', ')}.`);
      return;
    }
    setWorkflowStepStatuses([
      { id: 'run_of_show_lock', status: 'done' },
      { id: 'publish_call_sheet', status: 'done' },
      { id: 'press_release_draft', status: 'handoff' },
    ]);
  };

  const handlePressHandoff = () => {
    if (!readyForPressHandoff) {
      alert('Before press handoff, I need run-of-show lock, technical preflight complete, no held cues, and at least one cue with an assigned operator.');
      return;
    }
    setWorkflowStepStatuses([
      { id: 'press_release_draft', status: 'handoff' },
      { id: 'press_release_approve', status: 'in_progress' },
      { id: 'press_release_distribute', status: 'in_progress' },
    ]);
  };

  const handlePerformanceComplete = () => {
    setWorkflowStepStatuses([
      { id: 'performance_execution', status: 'done' },
      { id: 'run_live_show', status: 'done' },
      { id: 'post_show_report', status: 'in_progress' },
    ]);
  };

  const buildPressHandoffPacket = () => {
    const eventTitle = selectedEvent?.title || 'Untitled Event';
    const eventDate = selectedEvent?.date
      ? parseLocalDate(selectedEvent.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      : 'TBD';
    const eventTime = selectedEvent?.time || 'TBD';
    const venueLine = [selectedEvent?.venue, selectedEvent?.city, selectedEvent?.state].filter(Boolean).join(', ') || 'Venue TBD';
    const assignedStaff = staffAssignments
      .filter(row => row.assignee)
      .map(row => `- ${row.role}: ${row.assignee}${row.email ? ` (${row.email})` : ''}`)
      .join('\n') || '- No staff assigned';
    const topCues = rows
      .slice()
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
      .slice(0, 12)
      .map(row => `- ${row.time || 'TBD'} | ${row.cueId || 'CUE'} | ${row.department || 'STAGE'} | ${row.item || 'Cue'} | ${row.status || 'planned'}`)
      .join('\n') || '- No cues';
    const unresolvedIssues = techChecklist
      .filter(item => item.status === 'issue')
      .map(item => `- ${item.department}: ${item.item}${item.notes ? ` (${item.notes})` : ''}`)
      .join('\n') || '- None';

    return `PRESS HANDOFF PACKET

Event: ${eventTitle}
Date: ${eventDate}
Time: ${eventTime}
Venue: ${venueLine}

Workflow Status:
- Run of Show Lock: ${runLockStep?.status || 'not_started'}
- Press Draft: ${pressDraftStep?.status || 'not_started'}
- Technical Readiness: ${technicalStatus}

Key Staff:
${assignedStaff}

Cue Highlights:
${topCues}

Unresolved Technical Issues:
${unresolvedIssues}
`;
  };

  const handleCopyPressHandoffPacket = async () => {
    try {
      const packet = buildPressHandoffPacket();
      await navigator.clipboard.writeText(packet);
      setHandoffStatus('Press handoff packet copied.');
    } catch (err) {
      setHandoffStatus(`I hit a snag copying that packet: ${err.message}`);
    }
  };

  const updateStaffAssignment = (id, field, value) => {
    setStaffAssignments(prev => {
      const next = prev.map(row => (
        row.id === id ? { ...row, [field]: value } : row
      ));
      if (field === 'assignee' || field === 'role') {
        syncWorkflowOwnersFromStaff(next);
      }
      return next;
    });
  };

  const syncWorkflowOwnersFromStaff = (assignments = staffAssignments) => {
    const byRole = new Map(
      assignments.map(row => [String(row.role || '').trim().toLowerCase(), row])
    );
    setWorkflowSteps(prev => prev.map(step => {
      const ownerRole = String(step.ownerRole || step.owner || '').trim().toLowerCase();
      const match = byRole.get(ownerRole);
      if (!match) return step;
      const owner = match.assignee?.trim()
        ? `${match.assignee.trim()} (${match.role})`
        : match.role;
      return { ...step, owner };
    }));
  };

  const autofillStaffAssignmentsFromCrew = (incomingCrew = []) => {
    const sourceCrew = incomingCrew.length ? incomingCrew : (selectedEvent?.crew || []);
    if (!sourceCrew.length) return;
    const updatedAssignments = staffAssignments.map(assignment => {
      const canonicalRole = String(assignment.role || '').trim().toLowerCase();
      const matchedCrew = sourceCrew.find(member => {
        const mappedRole = findNearestTheaterRole(member.role || '');
        return String(mappedRole || '').trim().toLowerCase() === canonicalRole;
      });
      if (!matchedCrew) return assignment;
      return {
        ...assignment,
        assignee: assignment.assignee || matchedCrew.name || '',
        email: assignment.email || matchedCrew.email || '',
        phone: assignment.phone || matchedCrew.phone || '',
      };
    });
    setStaffAssignments(updatedAssignments);
    syncWorkflowOwnersFromStaff(updatedAssignments);
  };

  const applyTechnicalChecklistToWorkflow = (checklistRows = techChecklist) => {
    const technicalStatus = getTechnicalSyncStatusFromChecklist(checklistRows);
    setWorkflowSteps(prev => prev.map(step => {
      const stepId = String(step.id || '');
      const isTechnicalStep = stepId === 'technical_sync' || stepId === 'build_cues';
      if (isTechnicalStep) {
        if (step.status === 'done' && technicalStatus !== 'blocked') return step;
        return { ...step, status: technicalStatus };
      }
      if ((stepId === 'run_of_show_lock' || stepId === 'publish_call_sheet') && technicalStatus === 'done' && step.status === 'not_started') {
        return { ...step, status: 'in_progress' };
      }
      return step;
    }));
  };

  useEffect(() => {
    if (!isTheaterEvent) return;
    applyTechnicalChecklistToWorkflow(techChecklist);
  }, [isTheaterEvent, techChecklist]); // Keep workflow aligned with technical preflight state

  const updateTechChecklistRow = (id, field, value) => {
    setTechChecklist(prev => {
      const next = prev.map(row => (
        row.id === id ? { ...row, [field]: value } : row
      ));
      if (field === 'status') {
        applyTechnicalChecklistToWorkflow(next);
      }
      return next;
    });
  };

  const applyEmailSignalsToWorkflow = (signals = {}) => {
    setWorkflowSteps(prev => prev.map(step => {
      const stepId = String(step.id || '');
      const theaterSignals = {
        intake: ['ingest_updates', 'email_intake'],
        intakeValidation: ['intake_validation'],
        staffing: ['assign_roles', 'staffing_confirm'],
        cues: ['build_cues', 'technical_sync'],
        lock: ['publish_call_sheet', 'run_of_show_lock'],
        pressDraft: ['press_release_draft'],
        pressApprove: ['press_release_approve'],
        execution: ['run_live_show', 'performance_execution'],
        postShow: ['post_show_report'],
      };

      const setStepStatus = (value) => (
        step.status === 'done' && value !== 'blocked' ? step.status : value
      );

      if (signals.hasBlockedLanguage && [...theaterSignals.intakeValidation, ...theaterSignals.staffing, ...theaterSignals.cues].includes(stepId)) {
        return { ...step, status: 'blocked' };
      }
      if (theaterSignals.intake.includes(stepId)) {
        return { ...step, status: setStepStatus('done') };
      }
      if (signals.cuesUpdated || signals.crewUpdated) {
        if (theaterSignals.intakeValidation.includes(stepId)) return { ...step, status: setStepStatus('in_progress') };
      }
      if (signals.crewUpdated && theaterSignals.staffing.includes(stepId)) {
        return { ...step, status: setStepStatus('in_progress') };
      }
      if (signals.cuesUpdated && theaterSignals.cues.includes(stepId)) {
        return { ...step, status: setStepStatus(signals.cuesLocked ? 'done' : 'in_progress') };
      }
      if ((signals.cuesLocked || signals.callSheetSent) && theaterSignals.lock.includes(stepId)) {
        return { ...step, status: setStepStatus('done') };
      }
      if ((signals.cuesLocked || signals.callSheetSent) && theaterSignals.pressDraft.includes(stepId)) {
        return { ...step, status: setStepStatus('handoff') };
      }
      if (signals.callSheetSent && theaterSignals.pressApprove.includes(stepId)) {
        return { ...step, status: setStepStatus('in_progress') };
      }
      if (signals.showCompleted && theaterSignals.execution.includes(stepId)) {
        return { ...step, status: setStepStatus('done') };
      }
      if (signals.showCompleted && theaterSignals.postShow.includes(stepId)) {
        return { ...step, status: setStepStatus('in_progress') };
      }
      return step;
    }));
  };

  const ingestEmailViaApi = async (payload) => {
    try {
      const res = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ingest-stage-email',
          event: { id: selectedEvent?.id },
          email: payload,
          options: {
            source: 'manual',
            applyParsed: false,
          },
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Webhook ingest did not go through');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const handleEmailIngest = async () => {
    if (!selectedEvent || !emailDraft.body.trim()) {
      setEmailParseStatus('Paste the inbound email body first.');
      return;
    }

    setEmailIngesting(true);
    try {
      const parsed = parseEmailToStageUpdates(emailDraft.body, isTheaterEvent);
      const receivedAtIso = emailDraft.receivedAt
        ? new Date(emailDraft.receivedAt).toISOString()
        : new Date().toISOString();

      const emailEntry = {
        id: makeId('email'),
        source: 'manual',
        from: emailDraft.from || 'Unknown sender',
        subject: emailDraft.subject || '(No subject)',
        receivedAt: receivedAtIso,
        ingestedAt: new Date().toISOString(),
        summary: `Cues: ${parsed.cues.length}, Crew: ${parsed.crewMembers.length}, Unmapped lines: ${parsed.unknownLines}`,
        preview: emailDraft.body.slice(0, 300),
      };

      if (parsed.cues.length > 0) {
        setRows(prev => mergeCueRows(prev, parsed.cues));
      }

      if (parsed.crewMembers.length > 0) {
        const existingByNameRole = new Set(
          (crew || []).map(member => `${String(member.name || '').trim().toLowerCase()}|${String(member.role || '').trim().toLowerCase()}`)
        );
        const newGlobalCrew = parsed.crewMembers.filter(member => {
          const key = `${String(member.name || '').trim().toLowerCase()}|${String(member.role || '').trim().toLowerCase()}`;
          return member.name && !existingByNameRole.has(key);
        });

        for (const member of newGlobalCrew) {
          addCrewMember({
            name: member.name,
            email: member.email || '',
            role: member.role || 'Crew',
            department: member.department || '',
            status: 'invited',
          });
        }

        const mergedEventCrew = mergeCrewMembers(selectedEvent.crew || [], parsed.crewMembers);
        if (mergedEventCrew.length !== (selectedEvent.crew || []).length) {
          await updateEvent(selectedEvent.id, { crew: mergedEventCrew });
        }
        autofillStaffAssignmentsFromCrew(parsed.crewMembers);
      }

      applyEmailSignalsToWorkflow(parsed.signals);

      setEmailInbox(prev => [emailEntry, ...prev].slice(0, 60));

      const apiIngest = await ingestEmailViaApi({
        from: emailDraft.from || '',
        subject: emailDraft.subject || '',
        receivedAt: receivedAtIso,
        body: emailDraft.body,
      });

      const apiMessage = apiIngest.success ? 'Webhook log saved.' : `I could not save the webhook log yet: ${apiIngest.error}`;
      setEmailParseStatus(`Parsed email. ${emailEntry.summary}. ${apiMessage}`);
      setEmailDraft({ from: '', subject: '', receivedAt: '', body: '' });
    } catch (err) {
      setEmailParseStatus(`I hit a snag with email intake: ${err.message}`);
    } finally {
      setEmailIngesting(false);
    }
  };

  const saveToSupabase = async () => {
    if (!selectedEvent) return;

    setSaving(true);
    try {
      const runOfShowData = {
        cues: rows,
        openMicQueue,
        schedulingMode,
        workflowSteps,
        staffAssignments,
        techChecklist,
        emailInbox,
        lastEmailReceivedAt: emailInbox[0]?.receivedAt || null,
        lastUpdated: new Date().toISOString()
      };

      await updateEvent(selectedEvent.id, { 
        run_of_show: runOfShowData 
      });

      alert('Perfect. Run of show is saved.');
    } catch (err) {
      console.error('Failed to save:', err);
      alert('I hit a snag saving run of show: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (printView) {
    return (
      <div className="print:block p-4 max-w-4xl mx-auto bg-white text-black">
        <div className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">{selectedEvent?.title || 'Event'} - Run of Show</h1>
          <p className="text-gray-600">
            {selectedEvent && parseLocalDate(selectedEvent.date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </p>
          <p className="text-sm text-gray-500">
            Generated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Event Timeline</h2>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Cue ID</th>
                <th className="border border-gray-300 p-2 text-left">Dept</th>
                <th className="border border-gray-300 p-2 text-left">Script Ref</th>
                <th className="border border-gray-300 p-2 text-left">Environment</th>
                <th className="border border-gray-300 p-2 text-left">Time</th>
                <th className="border border-gray-300 p-2 text-left">Duration</th>
                <th className="border border-gray-300 p-2 text-left">Item</th>
                <th className="border border-gray-300 p-2 text-left">Crew</th>
                <th className="border border-gray-300 p-2 text-left">Status</th>
                <th className="border border-gray-300 p-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td className="border border-gray-300 p-2">{row.cueId}</td>
                  <td className="border border-gray-300 p-2">{row.department}</td>
                  <td className="border border-gray-300 p-2">{row.scriptRef}</td>
                  <td className="border border-gray-300 p-2">{row.environment}</td>
                  <td className="border border-gray-300 p-2">{row.time}</td>
                  <td className="border border-gray-300 p-2">{row.duration}</td>
                  <td className="border border-gray-300 p-2">{row.item}</td>
                  <td className="border border-gray-300 p-2">{row.crewMember}</td>
                  <td className="border border-gray-300 p-2">{row.status}</td>
                  <td className="border border-gray-300 p-2">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isTheaterEvent && staffAssignments.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Theater Staff Assignments</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Role</th>
                  <th className="border border-gray-300 p-2 text-left">Assignee</th>
                  <th className="border border-gray-300 p-2 text-left">Email</th>
                  <th className="border border-gray-300 p-2 text-left">Phone</th>
                  <th className="border border-gray-300 p-2 text-left">Responsibility</th>
                </tr>
              </thead>
              <tbody>
                {staffAssignments.map(assignment => (
                  <tr key={assignment.id}>
                    <td className="border border-gray-300 p-2">{assignment.role}</td>
                    <td className="border border-gray-300 p-2">{assignment.assignee || 'Unassigned'}</td>
                    <td className="border border-gray-300 p-2">{assignment.email || '—'}</td>
                    <td className="border border-gray-300 p-2">{assignment.phone || '—'}</td>
                    <td className="border border-gray-300 p-2">{assignment.responsibility}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isTheaterEvent && techChecklist.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Technical Preflight Checklist</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Department</th>
                  <th className="border border-gray-300 p-2 text-left">Item</th>
                  <th className="border border-gray-300 p-2 text-left">Owner Role</th>
                  <th className="border border-gray-300 p-2 text-left">Status</th>
                  <th className="border border-gray-300 p-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {techChecklist.map(row => (
                  <tr key={row.id}>
                    <td className="border border-gray-300 p-2">{row.department}</td>
                    <td className="border border-gray-300 p-2">{row.item}</td>
                    <td className="border border-gray-300 p-2">{row.ownerRole}</td>
                    <td className="border border-gray-300 p-2">{row.status}</td>
                    <td className="border border-gray-300 p-2">{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isTheaterEvent && workflowSteps.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Stage Director Workflow</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Status</th>
                  <th className="border border-gray-300 p-2 text-left">What</th>
                  <th className="border border-gray-300 p-2 text-left">When</th>
                  <th className="border border-gray-300 p-2 text-left">How</th>
                  <th className="border border-gray-300 p-2 text-left">Owner</th>
                </tr>
              </thead>
              <tbody>
                {workflowSteps.map(step => (
                  <tr key={step.id}>
                    <td className="border border-gray-300 p-2">{step.status}</td>
                    <td className="border border-gray-300 p-2">{step.what}</td>
                    <td className="border border-gray-300 p-2">{step.when}</td>
                    <td className="border border-gray-300 p-2">{step.how}</td>
                    <td className="border border-gray-300 p-2">{step.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isTheaterEvent && openMicQueue.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Open Mic Queue</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">#</th>
                  <th className="border border-gray-300 p-2 text-left">Performer</th>
                  <th className="border border-gray-300 p-2 text-left">Song/Performance</th>
                  <th className="border border-gray-300 p-2 text-left">Notes</th>
                  <th className="border border-gray-300 p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {openMicQueue.map((performer, index) => (
                  <tr key={performer.id} className={performer.done ? 'opacity-50' : ''}>
                    <td className="border border-gray-300 p-2">{index + 1}</td>
                    <td className="border border-gray-300 p-2">{performer.name}</td>
                    <td className="border border-gray-300 p-2">{performer.song}</td>
                    <td className="border border-gray-300 p-2">{performer.notes}</td>
                    <td className="border border-gray-300 p-2">{performer.done ? 'Done' : 'Waiting'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 pt-4 border-t text-center">
          <button 
            onClick={() => setPrintView(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded no-print"
          >
            ← Back to Edit
          </button>
          <button 
            onClick={handlePrint}
            className="ml-3 px-4 py-2 bg-blue-600 text-white rounded no-print"
          >
            🖨️ Print
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <h1 className="text-3xl mb-2">📋 Run of Show</h1>
      <p className="text-gray-500 mb-6">{isTheaterEvent ? 'Build your production cue timeline and assign the right crew to each cue.' : 'Build your event timeline and manage open mic queue.'}</p>

      {/* Event Selection */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
        <div className="flex gap-3 items-center flex-wrap">
          <select 
            value={selectedEventId} 
            onChange={e => setSelectedEventId(e.target.value)}
            className="flex-1 min-w-64 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
          >
            <option value="">Choose an event...</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>
                {e.title} · {parseLocalDate(e.date).toLocaleDateString()}
              </option>
            ))}
          </select>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setSchedulingMode(schedulingMode === 'clock' ? 'duration' : 'clock')}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                schedulingMode === 'clock' 
                  ? 'bg-[#c8a45e] text-white border-[#c8a45e]' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#c8a45e]'
              }`}
            >
              {schedulingMode === 'clock' ? '🕐 Clock Time' : '⏱️ Duration'}
            </button>
          </div>
        </div>
      </div>

      {selectedEvent && (
        <>
          {isTheaterEvent && (
            <div className="card mb-6 overflow-x-auto">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg m-0">🎭 Stage Director Workflow</h3>
                  <p className="text-xs text-gray-500 mt-1 mb-0">Track what is happening, when it happens, and how it should be executed.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">
                    {workflowSteps.filter(step => step.status === 'done').length}/{workflowSteps.length} steps done
                  </span>
                  <button
                    onClick={() => window.location.href = `/imc-composer?eventId=${selectedEvent.id}`}
                    className="btn-secondary text-xs"
                  >
                    Open IMC Composer (Press)
                  </button>
                </div>
              </div>

              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-36">Status</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">What</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">When</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">How</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-40">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {workflowSteps.map(step => (
                    <tr key={step.id} className="border-b border-gray-100">
                      <td className="py-1 px-2">
                        <select
                          value={step.status}
                          onChange={e => updateWorkflowStep(step.id, 'status', e.target.value)}
                          className={`w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:border-[#c8a45e] ${
                            WORKFLOW_STATUSES.find(s => s.value === step.status)?.color || ''
                          }`}
                        >
                          {WORKFLOW_STATUSES.map(status => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={step.what}
                          onChange={e => updateWorkflowStep(step.id, 'what', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={step.when}
                          onChange={e => updateWorkflowStep(step.id, 'when', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={step.how}
                          onChange={e => updateWorkflowStep(step.id, 'how', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={step.owner}
                          onChange={e => updateWorkflowStep(step.id, 'owner', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isTheaterEvent && (
            <div className="card mb-6">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg m-0">🎬 Production Control Summary</h3>
                  <p className="text-xs text-gray-500 mt-1 mb-0">Stage manager command panel for lock, press handoff, and performance closeout.</p>
                </div>
                <div className="text-xs text-gray-600">
                  Run Lock: {runLockStep?.status || 'not_started'} · Press: {pressDraftStep?.status || 'not_started'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                <div className="p-3 rounded border border-gray-200 bg-gray-50">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Staffing Coverage</div>
                  <div className="text-lg font-semibold">{staffingAssignedCount}/{staffAssignments.length || 0}</div>
                </div>
                <div className="p-3 rounded border border-gray-200 bg-gray-50">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Technical Readiness</div>
                  <div className="text-lg font-semibold capitalize">{technicalStatus.replace('_', ' ')}</div>
                </div>
                <div className="p-3 rounded border border-gray-200 bg-gray-50">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Operator Assigned Cues</div>
                  <div className="text-lg font-semibold">{cueAssignedCount}/{rows.length || 0}</div>
                </div>
                <div className="p-3 rounded border border-gray-200 bg-gray-50">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Cue Holds</div>
                  <div className={`text-lg font-semibold ${cueHoldCount > 0 ? 'text-red-600' : 'text-green-700'}`}>{cueHoldCount}</div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={handleLockRunOfShow} className="btn-secondary text-xs">
                  Lock Run of Show
                </button>
                <button onClick={handlePressHandoff} className="btn-secondary text-xs">
                  Handoff to Press
                </button>
                <button onClick={handlePerformanceComplete} className="btn-secondary text-xs">
                  Mark Performance Complete
                </button>
                <button onClick={handleCopyPressHandoffPacket} className="btn-secondary text-xs">
                  Copy Press Handoff Packet
                </button>
              </div>
              {handoffStatus && <p className="text-xs text-gray-600 mt-2 mb-0">{handoffStatus}</p>}
            </div>
          )}

          {isTheaterEvent && (
            <div className="card mb-6 overflow-x-auto">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg m-0">👥 Theater Staff Assignments</h3>
                  <p className="text-xs text-gray-500 mt-1 mb-0">Assign each production role so email intake, run-of-show, and press release handoff always have clear ownership.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => autofillStaffAssignmentsFromCrew()} className="btn-secondary text-xs">
                    Auto-fill From Crew
                  </button>
                  <button onClick={() => syncWorkflowOwnersFromStaff()} className="btn-secondary text-xs">
                    Sync Workflow Owners
                  </button>
                </div>
              </div>

              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-52">Role</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-48">Assignee</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-56">Email</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-40">Phone</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Responsibility</th>
                  </tr>
                </thead>
                <tbody>
                  {staffAssignments.map(assignment => (
                    <tr key={assignment.id} className="border-b border-gray-100">
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={assignment.role}
                          onChange={e => updateStaffAssignment(assignment.id, 'role', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={assignment.assignee}
                          onChange={e => updateStaffAssignment(assignment.id, 'assignee', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                          placeholder="Name"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="email"
                          value={assignment.email}
                          onChange={e => updateStaffAssignment(assignment.id, 'email', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                          placeholder="name@theater.org"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={assignment.phone}
                          onChange={e => updateStaffAssignment(assignment.id, 'phone', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                          placeholder="210-555-0000"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={assignment.responsibility}
                          onChange={e => updateStaffAssignment(assignment.id, 'responsibility', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isTheaterEvent && (
            <div className="card mb-6 overflow-x-auto">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg m-0">🧭 Department Readiness</h3>
                  <p className="text-xs text-gray-500 mt-1 mb-0">Single view across stage, LX, audio, video, deck, fly, and FOH to identify blocked departments before show call.</p>
                </div>
                <div className="text-xs text-gray-600">
                  Ready: {checklistSummary.ready}/{checklistSummary.total} · Pending: {checklistSummary.pending} · Issues: {checklistSummary.issue}
                </div>
              </div>

              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Department</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Readiness</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Cues</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Standby</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Go</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Executed</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Holds</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Checklist Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentReadiness.map(row => (
                    <tr key={row.department} className="border-b border-gray-100">
                      <td className="py-1 px-2 font-medium">{row.department}</td>
                      <td className="py-1 px-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          row.readiness === 'Blocked'
                            ? 'bg-red-100 text-red-700'
                            : row.readiness === 'Complete'
                              ? 'bg-green-100 text-green-700'
                              : row.readiness === 'Active'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                        }`}>
                          {row.readiness}
                        </span>
                      </td>
                      <td className="py-1 px-2">{row.cueCount}</td>
                      <td className="py-1 px-2">{row.standby}</td>
                      <td className="py-1 px-2">{row.go}</td>
                      <td className="py-1 px-2">{row.executed}</td>
                      <td className="py-1 px-2">{row.hold}</td>
                      <td className="py-1 px-2">{row.issueChecks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isTheaterEvent && (
            <div className="card mb-6 overflow-x-auto">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg m-0">🔧 Technical Preflight Checklist</h3>
                  <p className="text-xs text-gray-500 mt-1 mb-0">Use this with department heads before call. Status updates auto-sync the technical workflow step.</p>
                </div>
                <button
                  onClick={() => applyTechnicalChecklistToWorkflow(techChecklist)}
                  className="btn-secondary text-xs"
                >
                  Sync Technical Workflow Status
                </button>
              </div>

              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-20">Dept</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Checklist Item</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-44">Owner Role</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-32">Status</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {techChecklist.map(item => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-1 px-2 font-medium">{item.department}</td>
                      <td className="py-1 px-2">{item.item}</td>
                      <td className="py-1 px-2">{item.ownerRole}</td>
                      <td className="py-1 px-2">
                        <select
                          value={item.status}
                          onChange={e => updateTechChecklistRow(item.id, 'status', e.target.value)}
                          className={`w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:border-[#c8a45e] ${
                            TECH_CHECKLIST_STATUSES.find(status => status.value === item.status)?.color || ''
                          }`}
                        >
                          {TECH_CHECKLIST_STATUSES.map(status => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={item.notes}
                          onChange={e => updateTechChecklistRow(item.id, 'notes', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                          placeholder="Issue details / completion notes"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isTheaterEvent && (
            <div className="card mb-6">
              <h3 className="text-lg mb-2">📨 Email Intake (Manual now, Zapier-ready next)</h3>
              <p className="text-xs text-gray-500 mb-3">
                Paste inbound production emails below for immediate parsing. Zapier endpoints are ready on <code>/api/distribute</code> with actions <code>ingest-stage-email</code>, <code>get-stage-workflow</code>, and <code>set-stage-workflow</code>.
              </p>
              <div className="mb-3 p-3 rounded border border-gray-200 bg-gray-50">
                <p className="text-xs font-medium text-gray-700 m-0 mb-2">Zapier Webhook Payload Examples</p>
                <pre className="text-[11px] m-0 overflow-x-auto whitespace-pre-wrap break-words">
{`1) Ingest + apply email updates
{
  "action": "ingest-stage-email",
  "eventId": "${selectedEvent?.id || "EVENT_ID"}",
  "email": {
    "from": "stage.manager@theater.org",
    "subject": "Rehearsal Report",
    "receivedAt": "2026-02-25T19:00:00-06:00",
    "body": "19:00 - House opens | FOH\\n19:30 - Places call | Stage Manager"
  },
  "webhookSecret": "YOUR_SECRET"
}

2) Read current workflow snapshot
{
  "action": "get-stage-workflow",
  "eventId": "${selectedEvent?.id || "EVENT_ID"}",
  "webhookSecret": "YOUR_SECRET"
}

3) Update statuses/cues from automation
{
  "action": "set-stage-workflow",
  "eventId": "${selectedEvent?.id || "EVENT_ID"}",
  "runOfShow": {
    "statusUpdates": [{ "id": "technical_sync", "status": "done" }],
    "cues": [{ "cueId": "INT-1", "department": "DECK", "time": "20:00", "item": "Intermission", "crewMember": "FOH", "status": "planned" }]
  },
  "webhookSecret": "YOUR_SECRET"
}`}
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  value={emailDraft.from}
                  onChange={e => setEmailDraft(prev => ({ ...prev, from: e.target.value }))}
                  placeholder="From (ex: sm@theater.org)"
                  className="px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                />
                <input
                  type="text"
                  value={emailDraft.subject}
                  onChange={e => setEmailDraft(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Subject"
                  className="px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                />
                <input
                  type="datetime-local"
                  value={emailDraft.receivedAt}
                  onChange={e => setEmailDraft(prev => ({ ...prev, receivedAt: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e]"
                />
              </div>

              <textarea
                value={emailDraft.body}
                onChange={e => setEmailDraft(prev => ({ ...prev, body: e.target.value }))}
                rows={7}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                placeholder="Paste the full inbound production email. Example:
19:00 - House opens | FOH team
19:30 - Places call | Stage Manager
Lighting Designer: Dana Hall dana@example.com 210-555-0144 Call time 5:30 PM"
              />

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={handleEmailIngest} disabled={emailIngesting} className="btn-primary text-sm disabled:opacity-50">
                  {emailIngesting ? 'Parsing…' : 'Parse + Apply Email'}
                </button>
                <button
                  onClick={() => {
                    setEmailDraft({ from: '', subject: '', receivedAt: '', body: '' });
                    setEmailParseStatus('');
                  }}
                  className="btn-secondary text-sm"
                >
                  Clear
                </button>
                {emailParseStatus && <span className="text-xs text-gray-600">{emailParseStatus}</span>}
              </div>

              {emailInbox.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm m-0 mb-2">Recent Email Activity ({emailInbox.length})</h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {emailInbox.map(entry => (
                      <div key={entry.id} className="p-2 bg-[#f5f5f5] rounded border border-gray-200">
                        <div className="text-xs font-medium">{entry.subject || '(No subject)'}</div>
                        <div className="text-[11px] text-gray-500">
                          {entry.from} · {entry.receivedAt ? new Date(entry.receivedAt).toLocaleString() : 'Unknown time'}
                        </div>
                        {entry.summary && <div className="text-[11px] text-gray-600 mt-1">{entry.summary}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isTheaterEvent && rows.length > 0 && (
            <div className="card mb-6">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg m-0">🎛️ Cue Call Console</h3>
                  <p className="text-xs text-gray-500 mt-1 mb-0">Fast cue-calling controls for stage manager and technical director during rehearsal or show run.</p>
                </div>
                <div className="text-xs text-gray-600">
                  Active Cue: {activeCue ? `${activeCue.cueId || 'CUE'} · ${activeCue.department || 'STAGE'}` : 'None'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="p-3 rounded border border-gray-200 bg-gray-50">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Previous Cue</div>
                  <div className="text-sm font-medium mt-1">{previousCue ? `${previousCue.time || 'TBD'} · ${previousCue.item || 'Cue'}` : '—'}</div>
                </div>
                <div className="p-3 rounded border border-[#c8a45e] bg-[#f8f2e4]">
                  <div className="text-[11px] text-gray-600 uppercase tracking-wide">Current Cue</div>
                  <div className="text-sm font-semibold mt-1">{activeCue ? `${activeCue.time || 'TBD'} · ${activeCue.item || 'Cue'}` : 'Select cue'}</div>
                  {activeCue && (
                    <div className="text-[11px] text-gray-600 mt-1">
                      Script: {activeCue.scriptRef || '—'} · Env: {activeCue.environment || '—'} · Operator: {activeCue.crewMember || 'Unassigned'}
                    </div>
                  )}
                </div>
                <div className="p-3 rounded border border-gray-200 bg-gray-50">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Next Cue</div>
                  <div className="text-sm font-medium mt-1">{nextCue ? `${nextCue.time || 'TBD'} · ${nextCue.item || 'Cue'}` : '—'}</div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => jumpActiveCue(-1)} className="btn-secondary text-xs" disabled={!previousCue}>
                  ← Previous Cue
                </button>
                <button onClick={() => jumpActiveCue(1)} className="btn-secondary text-xs" disabled={!nextCue}>
                  Next Cue →
                </button>
                <button onClick={() => setActiveCueStatus('standby')} className="btn-secondary text-xs">
                  Call Standby
                </button>
                <button onClick={() => setActiveCueStatus('go')} className="btn-secondary text-xs">
                  Call Go
                </button>
                <button onClick={() => {
                  setActiveCueStatus('executed');
                  if (nextCue) setActiveCueId(nextCue.id);
                }} className="btn-secondary text-xs">
                  Mark Executed + Advance
                </button>
                <button onClick={() => setActiveCueStatus('hold')} className="btn-secondary text-xs">
                  Put Cue on Hold
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="card mb-6 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg m-0">Event Timeline</h3>
              <div className="flex gap-2">
                <button onClick={addRow} className="btn-primary text-sm">+ Add Cue</button>
                <button 
                  onClick={saveToSupabase} 
                  disabled={saving}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  {saving ? '💾 Saving...' : '💾 Save'}
                </button>
                <button 
                  onClick={() => setPrintView(true)} 
                  className="btn-secondary text-sm"
                >
                  🖨️ Print View
                </button>
              </div>
            </div>

            <table className="w-full text-sm min-w-[1400px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-8">Order</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-24">Cue ID</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-24">Dept</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-28">Script Ref</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-28">Environment</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-24">
                    {schedulingMode === 'clock' ? 'Time' : 'Start'}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-20">Duration</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">Cue Item</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-36">Crew Member</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-36">Status</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">Notes</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => setActiveCueId(row.id)}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${activeCueId === row.id ? 'bg-[#f8f2e4]' : ''}`}
                  >
                    <td className="py-1 px-2">
                      <div className="flex flex-col">
                        <button 
                          onClick={() => moveRow(i, -1)} 
                          disabled={i === 0}
                          className="text-xs text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 p-0"
                        >
                          ▲
                        </button>
                        <span className="text-xs text-gray-500 text-center">{i + 1}</span>
                        <button 
                          onClick={() => moveRow(i, 1)} 
                          disabled={i === rows.length - 1}
                          className="text-xs text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 p-0"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        value={row.cueId || ''}
                        onChange={e => updateRow(row.id, 'cueId', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                        placeholder="SM-1"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <select
                        value={row.department || 'STAGE'}
                        onChange={e => updateRow(row.id, 'department', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e] bg-white"
                      >
                        {CUE_DEPARTMENTS.map(department => (
                          <option key={department} value={department}>{department}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        value={row.scriptRef || ''}
                        onChange={e => updateRow(row.id, 'scriptRef', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                        placeholder="Act I, p.24, Q17"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        value={row.environment || ''}
                        onChange={e => updateRow(row.id, 'environment', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]"
                        placeholder="Set A / House / Backstage"
                      />
                    </td>
                    <td className="py-1 px-2">
                      {schedulingMode === 'clock' ? (
                        <input 
                          type="time" 
                          value={row.time} 
                          onChange={e => updateRow(row.id, 'time', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        />
                      ) : (
                        <input 
                          type="text" 
                          value={row.time} 
                          onChange={e => updateRow(row.id, 'time', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                          placeholder="After cue X"
                        />
                      )}
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        value={row.duration} 
                        onChange={e => updateRow(row.id, 'duration', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        placeholder="15 min" 
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        value={row.item} 
                        onChange={e => updateRow(row.id, 'item', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        placeholder="Cue item..." 
                      />
                    </td>
                    <td className="py-1 px-2">
                      <select 
                        value={row.crewMember} 
                        onChange={e => updateRow(row.id, 'crewMember', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e] bg-white"
                      >
                        <option value="">Assign...</option>
                        {crew.map(c => (
                          <option key={c.id} value={c.name}>{`${c.name}${c.role ? ` · ${c.role}` : ''}`}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-2">
                      <select
                        value={row.status || 'planned'}
                        onChange={e => updateRow(row.id, 'status', e.target.value)}
                        className={`w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e] bg-white ${
                          CUE_STATUSES.find(status => status.value === row.status)?.color || ''
                        }`}
                      >
                        {CUE_STATUSES.map(status => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                      {isTheaterEvent && (
                        <div className="flex gap-1 mt-1">
                          {['standby', 'go', 'executed'].map(statusValue => (
                            <button
                              key={statusValue}
                              onClick={() => updateRow(row.id, 'status', statusValue)}
                              className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                row.status === statusValue
                                  ? 'border-[#c8a45e] text-[#7f5f2b] bg-[#f8f2e4]'
                                  : 'border-gray-200 text-gray-500 bg-white'
                              }`}
                            >
                              {statusValue.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        value={row.notes} 
                        onChange={e => updateRow(row.id, 'notes', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        placeholder="Notes..." 
                      />
                    </td>
                    <td className="py-1 px-2">
                      <button 
                        onClick={() => removeRow(row.id)}
                        className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm p-0"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Open Mic Queue */}
          {!isTheaterEvent && (
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg m-0">🎤 Open Mic Queue</h3>
              <div className="flex gap-2">
                <button onClick={addOpenMicPerformer} className="btn-primary text-sm">+ Add Performer</button>
              </div>
            </div>

            {openMicQueue.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-4xl mb-3">🎤</p>
                <p>No performers in queue yet. Add someone and I will build the order.</p>
              </div>
            ) : (
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-8">Order</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Performer</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Song/Performance</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Notes</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-20">Status</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {openMicQueue.map((performer, i) => (
                    <tr 
                      key={performer.id} 
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        performer.done ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-1 px-2">
                        <div className="flex flex-col">
                          <button 
                            onClick={() => moveOpenMicPerformer(i, -1)} 
                            disabled={i === 0}
                            className="text-xs text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 p-0"
                          >
                            ▲
                          </button>
                          <span className="text-xs text-gray-500 text-center">{i + 1}</span>
                          <button 
                            onClick={() => moveOpenMicPerformer(i, 1)} 
                            disabled={i === openMicQueue.length - 1}
                            className="text-xs text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 p-0"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td className="py-1 px-2">
                        <input 
                          type="text" 
                          value={performer.name} 
                          onChange={e => updateOpenMicPerformer(performer.id, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input 
                          type="text" 
                          value={performer.song} 
                          onChange={e => updateOpenMicPerformer(performer.id, 'song', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                          placeholder="Song title or performance type"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input 
                          type="text" 
                          value={performer.notes} 
                          onChange={e => updateOpenMicPerformer(performer.id, 'notes', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                          placeholder="Equipment needs, etc."
                        />
                      </td>
                      <td className="py-1 px-2">
                        <button
                          onClick={() => updateOpenMicPerformer(performer.id, 'done', !performer.done)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            performer.done 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {performer.done ? '✓ Done' : 'Waiting'}
                        </button>
                      </td>
                      <td className="py-1 px-2">
                        <button 
                          onClick={() => removeOpenMicPerformer(performer.id)}
                          className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm p-0"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          )}
        </>
      )}
    </div>
  );
}
