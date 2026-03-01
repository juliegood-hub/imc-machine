import { parseLocalDate } from '../lib/dateUtils';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
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
const TIMELINE_TRACKS = [
  { key: 'run_of_show', label: 'Run of Show' },
  { key: 'lx', label: 'Lighting (LX)' },
  { key: 'sound', label: 'Sound (SND)' },
  { key: 'deck', label: 'Deck' },
  { key: 'projection', label: 'Projection / Video' },
  { key: 'spot_house', label: 'Spot / House' },
];
const TIMELINE_MODES = [
  { value: 'segment', label: 'Segment Mode' },
  { value: 'timecode', label: 'Timecode Mode' },
];
const PAPERWORK_DEPARTMENTS = ['lighting', 'sound', 'projection', 'deck'];
const PAPERWORK_BATCH_WINDOW_MS = 120000;
const TIMELINE_BASE_SNAP_MS = 5000;
const DEFAULT_TIMELINE_SNAP = {
  segmentBoundaries: true,
  markers: true,
  cueEdges: true,
};

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

function sanitizePrimaryView(value = '') {
  return value === 'source_document' ? 'source_document' : 'clean_editable';
}

function normalizeSourceDocument(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const url = String(input.url || input.original_url || '').trim();
  if (!url) return null;
  return {
    id: input.id || input.mediaId || makeId('source_doc'),
    url,
    mimeType: String(input.mimeType || input.mime_type || '').trim() || 'application/octet-stream',
    label: String(input.label || '').trim() || 'Run of Show Source',
    uploadedAt: input.uploadedAt || input.created_at || new Date().toISOString(),
  };
}

function normalizeSourceDocumentFromMedia(record = {}, index = 0) {
  return normalizeSourceDocument({
    id: record.id || `source-${index}`,
    url: record.original_url || '',
    mimeType: record.mime_type || '',
    label: record.label || 'Run of Show Source',
    uploadedAt: record.created_at || new Date().toISOString(),
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const base64 = value.includes(',') ? value.split(',')[1] : value;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseClockMinutes(value = '') {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
}

function parseDurationToMinutes(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return 5;
  const match = raw.match(/(-?\d+)/);
  if (!match) return 5;
  const next = Number(match[1]);
  if (!Number.isFinite(next)) return 5;
  return Math.max(0, next);
}

function inferTrackFromDepartment(department = '') {
  const dep = String(department || '').toUpperCase();
  if (dep === 'LX') return 'lx';
  if (dep === 'AUDIO' || dep === 'SND') return 'sound';
  if (dep === 'DECK' || dep === 'FLY') return 'deck';
  if (dep === 'VIDEO' || dep === 'PROJ' || dep === 'VID' || dep === 'IMAG') return 'projection';
  if (dep === 'FOH') return 'spot_house';
  return 'run_of_show';
}

function inferDepartmentFromTrack(track = '') {
  if (track === 'lx') return 'LX';
  if (track === 'sound') return 'AUDIO';
  if (track === 'deck') return 'DECK';
  if (track === 'projection') return 'VIDEO';
  if (track === 'spot_house') return 'FOH';
  return 'STAGE';
}

function rowToTimelineCue(row = {}, index = 0) {
  const minutes = parseClockMinutes(row.time);
  const startMs = minutes === null ? index * 300000 : minutes * 60000;
  const durationMs = parseDurationToMinutes(row.duration) * 60000;
  return {
    id: row.id || makeId('cue_track'),
    sourceCueId: row.id || makeId('cue_row'),
    cueId: row.cueId || `CUE-${index + 1}`,
    label: row.item || 'Cue',
    department: row.department || inferDepartmentFromTrack('run_of_show'),
    track: inferTrackFromDepartment(row.department),
    segmentId: row.cueId || `SEG-${index + 1}`,
    startMs,
    endMs: startMs + Math.max(durationMs, 1000),
    durationMs: Math.max(durationMs, 1000),
    cueType: inferTrackFromDepartment(row.department) === 'projection' ? 'PROJ' : (row.department || 'STAGE'),
    triggerSource: row.scriptRef || row.environment || 'SM Call',
    standbyMarker: false,
    goMarker: false,
    locked: false,
    linkedGroupId: '',
    notes: row.notes || '',
  };
}

function normalizeTimelineCue(cue = {}, fallback = {}) {
  const startMs = Number.isFinite(Number(cue.startMs)) ? Number(cue.startMs) : (Number(fallback.startMs) || 0);
  const durationMsRaw = Number.isFinite(Number(cue.durationMs)) ? Number(cue.durationMs) : Number(fallback.durationMs || 60000);
  const durationMs = Math.max(durationMsRaw, 1000);
  const endMs = Number.isFinite(Number(cue.endMs)) ? Number(cue.endMs) : (startMs + durationMs);
  return {
    id: cue.id || fallback.id || makeId('timeline'),
    sourceCueId: cue.sourceCueId || fallback.sourceCueId || '',
    cueId: cue.cueId || fallback.cueId || '',
    label: cue.label || fallback.label || '',
    department: cue.department || fallback.department || 'STAGE',
    track: cue.track || fallback.track || inferTrackFromDepartment(cue.department || fallback.department),
    segmentId: cue.segmentId || fallback.segmentId || cue.cueId || fallback.cueId || '',
    startMs,
    endMs: Math.max(endMs, startMs + 1000),
    durationMs,
    cueType: cue.cueType || fallback.cueType || cue.department || 'STAGE',
    triggerSource: cue.triggerSource || fallback.triggerSource || '',
    standbyMarker: !!cue.standbyMarker,
    goMarker: !!cue.goMarker,
    locked: !!cue.locked,
    linkedGroupId: cue.linkedGroupId || '',
    notes: cue.notes || fallback.notes || '',
  };
}

function syncTimelineCuesFromRows(rows = [], existingCues = []) {
  const existingBySource = new Map((existingCues || []).map((cue) => [cue.sourceCueId, cue]));
  return rows.map((row, index) => {
    const base = rowToTimelineCue(row, index);
    const existing = existingBySource.get(row.id) || {};
    return normalizeTimelineCue({
      ...base,
      ...existing,
      sourceCueId: row.id,
      cueId: row.cueId || base.cueId,
      label: row.item || base.label,
      department: row.department || base.department,
      track: existing.track || inferTrackFromDepartment(row.department),
      triggerSource: row.scriptRef || row.environment || existing.triggerSource || base.triggerSource,
      notes: row.notes || existing.notes || '',
    }, base);
  });
}

function toPaperworkDepartment(track = '', department = '') {
  const normalizedTrack = String(track || '').toLowerCase();
  if (normalizedTrack === 'lx') return 'lighting';
  if (normalizedTrack === 'sound') return 'sound';
  if (normalizedTrack === 'deck') return 'deck';
  if (normalizedTrack === 'projection') return 'projection';
  const dep = String(department || '').toUpperCase();
  if (dep === 'LX') return 'lighting';
  if (dep === 'AUDIO') return 'sound';
  if (dep === 'DECK' || dep === 'FLY') return 'deck';
  if (dep === 'VIDEO' || dep === 'PROJ' || dep === 'VID' || dep === 'IMAG') return 'projection';
  return '';
}

function toDataUrlText(content = '') {
  const encoded = encodeURIComponent(String(content || ''));
  return `data:text/plain;charset=utf-8,${encoded}`;
}

function buildDepartmentPaperworkText(department = 'lighting', rows = [], timelineCues = []) {
  const title = department.toUpperCase();
  const relevant = (timelineCues || []).filter((cue) => toPaperworkDepartment(cue.track, cue.department) === department);
  const ordered = relevant.slice().sort((a, b) => a.startMs - b.startMs);
  const header = [
    `${title} TIMELINE CUE SHEET`,
    `Generated: ${new Date().toISOString()}`,
    '',
  ];
  const lines = ordered.map((cue, index) => {
    const startMin = Math.round(cue.startMs / 60000);
    const durSec = Math.round((cue.durationMs || 0) / 1000);
    return `${index + 1}. ${cue.cueId || `CUE-${index + 1}`} | ${cue.label || 'Cue'} | T+${startMin}m | ${durSec}s | ${cue.triggerSource || 'SM Call'} | ${cue.notes || ''}`.trim();
  });
  if (!lines.length) {
    lines.push('No cues mapped yet for this department.');
  }

  if (department === 'sound') {
    lines.push('', 'INPUT / PATCH CONTEXT');
    rows
      .filter((row) => String(row.department || '').toUpperCase() === 'AUDIO')
      .forEach((row, index) => {
        lines.push(`- ${index + 1}: ${row.cueId || 'SND'} ${row.item || ''} (${row.crewMember || 'Unassigned'})`);
      });
  }
  if (department === 'lighting') {
    lines.push('', 'LIGHTING CUE CONTEXT');
    rows
      .filter((row) => String(row.department || '').toUpperCase() === 'LX')
      .forEach((row) => {
        lines.push(`- ${row.cueId || 'LX'} ${row.item || ''} | ${row.status || 'planned'}`);
      });
  }
  if (department === 'projection') {
    lines.push('', 'PROJECTION / VIDEO CONTEXT');
    rows
      .filter((row) => ['VIDEO', 'PROJ', 'VID', 'IMAG'].includes(String(row.department || '').toUpperCase()))
      .forEach((row) => {
        lines.push(`- ${row.cueId || 'PROJ'} ${row.item || ''} | ${row.notes || ''}`);
      });
  }
  if (department === 'deck') {
    lines.push('', 'DECK SHIFT CONTEXT');
    rows
      .filter((row) => ['DECK', 'FLY'].includes(String(row.department || '').toUpperCase()))
      .forEach((row) => {
        lines.push(`- ${row.cueId || 'DECK'} ${row.item || ''} | ${row.environment || ''}`);
      });
  }

  return [...header, ...lines].join('\n');
}

function formatClockMinutes(totalMinutes = 0) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function adjustClockTime(value = '', deltaMinutes = 0) {
  const base = parseClockMinutes(value);
  if (base === null) return value;
  return formatClockMinutes(base + deltaMinutes);
}

function adjustDuration(value = '', deltaMinutes = 0) {
  const raw = String(value || '').trim();
  if (!raw) return `${Math.max(deltaMinutes, 0)} min`;
  const match = raw.match(/(-?\d+)/);
  if (!match) return raw;
  const next = Math.max(0, Number(match[1]) + deltaMinutes);
  return `${next} min`;
}

function formatTimecodeFromMs(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatClockFromMs(ms = 0) {
  const totalMinutes = Math.max(0, Math.floor(Number(ms || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseTimecodeToMs(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parts = raw.split(':').map((token) => Number(token));
  if (!parts.every((num) => Number.isFinite(num))) return null;
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (Math.max(0, minutes) * 60 + Math.max(0, seconds)) * 1000;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return ((Math.max(0, hours) * 3600) + (Math.max(0, minutes) * 60) + Math.max(0, seconds)) * 1000;
  }
  return null;
}

function parseClockToMs(value = '') {
  const minutes = parseClockMinutes(value);
  if (minutes === null) return null;
  return minutes * 60000;
}

function msToDurationLabel(ms = 0) {
  const minutes = Math.round(Math.max(0, Number(ms || 0)) / 60000);
  return minutes > 0 ? `${minutes} min` : '';
}

function normalizeTimelineMode(value = '') {
  return value === 'timecode' ? 'timecode' : 'segment';
}

function normalizeTimelineSnap(value = {}) {
  return {
    segmentBoundaries: value.segmentBoundaries !== undefined ? !!value.segmentBoundaries : true,
    markers: value.markers !== undefined ? !!value.markers : true,
    cueEdges: value.cueEdges !== undefined ? !!value.cueEdges : true,
  };
}

function normalizePaperworkStatus(value = '') {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'published') return 'published';
  if (normalized === 'archived') return 'archived';
  return 'draft';
}

function normalizePaperworkVersion(version = {}, index = 0) {
  const department = PAPERWORK_DEPARTMENTS.includes(String(version.department || '').toLowerCase())
    ? String(version.department || '').toLowerCase()
    : 'lighting';
  const links = version.artifactLinks && typeof version.artifactLinks === 'object'
    ? version.artifactLinks
    : version.artifact_links && typeof version.artifact_links === 'object'
      ? version.artifact_links
      : {};
  return {
    id: String(version.id || makeId(`paperwork_${department}_${index}`)),
    eventId: version.eventId || version.event_id || '',
    department,
    versionNumber: Number(version.versionNumber || version.version_number || 1) || 1,
    status: normalizePaperworkStatus(version.status),
    createdBy: version.createdBy || version.created_by || '',
    createdAt: version.createdAt || version.created_at || new Date().toISOString(),
    sourceSnapshotId: version.sourceSnapshotId || version.source_snapshot_id || '',
    changeSummary: version.changeSummary || version.change_summary || '',
    artifactLinks: {
      txt: links.txt || '',
      pdf: links.pdf || '',
    },
  };
}

function cueSignature(cue = {}) {
  return [
    cue.id,
    cue.track,
    cue.startMs,
    cue.endMs,
    cue.durationMs,
    cue.cueId,
    cue.label,
    cue.triggerSource,
    cue.cueType,
    cue.notes,
    cue.locked ? '1' : '0',
    cue.standbyMarker ? '1' : '0',
    cue.goMarker ? '1' : '0',
    cue.linkedGroupId || '',
  ].join('|');
}

function normalizeRunOfShowExtractedCue(cue = {}, index = 0) {
  const timeValue = String(cue.time || cue.startTime || cue.start_time || '').trim();
  return {
    id: makeId('cue'),
    cueId: String(cue.cueId || cue.cue_id || cue.id || `AUTO-${index + 1}`).trim() || `AUTO-${index + 1}`,
    department: String(cue.department || cue.dept || cue.team || '').trim().toUpperCase() || inferCueDepartment(String(cue.item || cue.title || cue.notes || '')),
    scriptRef: String(cue.scriptRef || cue.script_ref || '').trim(),
    environment: String(cue.environment || cue.location || '').trim(),
    time: normalizeEmailTime(timeValue) || timeValue,
    duration: String(cue.duration || cue.length || '').trim(),
    item: String(cue.item || cue.title || cue.description || '').trim(),
    crewMember: String(cue.crewMember || cue.operator || cue.owner || '').trim(),
    status: String(cue.status || 'planned').trim() || 'planned',
    notes: String(cue.notes || cue.note || '').trim(),
  };
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
  const { user } = useAuth();
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
  const [primaryView, setPrimaryView] = useState('clean_editable');
  const [sourceDocument, setSourceDocument] = useState(null);
  const [sourceDocuments, setSourceDocuments] = useState([]);
  const [sourceDocumentsLoading, setSourceDocumentsLoading] = useState(false);
  const [sourceDocumentUploading, setSourceDocumentUploading] = useState(false);
  const [sourceDocumentExtracting, setSourceDocumentExtracting] = useState(false);
  const [sourceDocumentStatus, setSourceDocumentStatus] = useState('');
  const [pendingSourceDraftRows, setPendingSourceDraftRows] = useState([]);
  const [pendingSourceRawText, setPendingSourceRawText] = useState('');
  const sourceDocumentInputRef = useRef(null);
  
  const [saving, setSaving] = useState(false);
  const [printView, setPrintView] = useState(false);
  const [timelineMode, setTimelineMode] = useState('segment');
  const [timelineCues, setTimelineCues] = useState([]);
  const [timelineTrackFilter, setTimelineTrackFilter] = useState('all');
  const [timelineSnap, setTimelineSnap] = useState(DEFAULT_TIMELINE_SNAP);
  const [timelineSelectedCueIds, setTimelineSelectedCueIds] = useState([]);
  const [paperworkDirty, setPaperworkDirty] = useState(() => (
    PAPERWORK_DEPARTMENTS.reduce((acc, department) => ({ ...acc, [department]: false }), {})
  ));
  const [paperworkVersions, setPaperworkVersions] = useState([]);
  const [paperworkStatus, setPaperworkStatus] = useState('');
  const [paperworkPublishing, setPaperworkPublishing] = useState('');

  const timelineCuesRef = useRef([]);
  const rowsRef = useRef([]);
  const paperworkDirtyRef = useRef({});
  const paperworkVersionsRef = useRef([]);
  const lastCueSignaturesRef = useRef(new Map());
  const editSessionRef = useRef({
    timer: null,
    startedAt: null,
    lastChangedAt: null,
    changeCount: 0,
    summary: '',
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const normalizedClientType = String(user?.clientType || '').trim().toLowerCase();
  const canChangePrimaryView = !!(
    user?.isAdmin
    || selectedEvent?.userId === user?.id
    || ['producer', 'manager', 'booking_agent', 'venue_owner', 'venue_manager', 'event_planner'].includes(normalizedClientType)
  );
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
  const timelineCuesByTrack = useMemo(() => {
    const grouped = TIMELINE_TRACKS.reduce((acc, track) => ({ ...acc, [track.key]: [] }), {});
    (timelineCues || []).forEach((cue) => {
      const trackKey = TIMELINE_TRACKS.some((track) => track.key === cue.track) ? cue.track : 'run_of_show';
      if (!grouped[trackKey]) grouped[trackKey] = [];
      grouped[trackKey].push(cue);
    });
    Object.keys(grouped).forEach((trackKey) => {
      grouped[trackKey] = grouped[trackKey].slice().sort((a, b) => Number(a.startMs || 0) - Number(b.startMs || 0));
    });
    return grouped;
  }, [timelineCues]);
  const paperworkVersionsByDepartment = useMemo(() => {
    return PAPERWORK_DEPARTMENTS.reduce((acc, department) => {
      const versions = (paperworkVersions || [])
        .filter((entry) => entry.department === department)
        .slice()
        .sort((a, b) => Number(b.versionNumber || 0) - Number(a.versionNumber || 0));
      return {
        ...acc,
        [department]: versions,
      };
    }, {});
  }, [paperworkVersions]);

  // Load existing run of show data when event is selected
  useEffect(() => {
    if (!selectedEvent) return;

    if (selectedEvent?.run_of_show) {
      const runOfShow = selectedEvent.run_of_show;
      const theaterEvent = selectedEvent.genre === THEATER_GENRE_KEY;
      setPrimaryView(sanitizePrimaryView(runOfShow.primaryView || runOfShow.primary_view));
      setSourceDocument(normalizeSourceDocument(runOfShow.sourceDocument || runOfShow.source_document));
      if (Array.isArray(runOfShow.cues)) setRows(normalizeCueRows(runOfShow.cues));
      else setRows(getDefaultRowsForEvent(selectedEvent));
      setTimelineMode(normalizeTimelineMode(runOfShow.timelineMode || runOfShow.timeline_mode));
      setTimelineTrackFilter(String(runOfShow.timelineTrackFilter || runOfShow.timeline_track_filter || 'all'));
      setTimelineSnap(normalizeTimelineSnap(runOfShow.timelineSnap || runOfShow.timeline_snap || {}));
      const restoredTimelineCues = Array.isArray(runOfShow.timelineCues || runOfShow.timeline_cues)
        ? (runOfShow.timelineCues || runOfShow.timeline_cues)
            .map((cue, index) => normalizeTimelineCue(cue, rowToTimelineCue((runOfShow.cues || [])[index] || {}, index)))
        : [];
      if (restoredTimelineCues.length) setTimelineCues(restoredTimelineCues);
      else {
        const baseRows = Array.isArray(runOfShow.cues) ? normalizeCueRows(runOfShow.cues) : getDefaultRowsForEvent(selectedEvent);
        setTimelineCues(syncTimelineCuesFromRows(baseRows, []));
      }
      const incomingDirty = runOfShow.paperworkDirty || runOfShow.paperwork_dirty || {};
      setPaperworkDirty(PAPERWORK_DEPARTMENTS.reduce((acc, department) => ({
        ...acc,
        [department]: !!incomingDirty[department],
      }), {}));
      const incomingVersions = Array.isArray(runOfShow.paperworkVersions || runOfShow.paperwork_versions)
        ? (runOfShow.paperworkVersions || runOfShow.paperwork_versions).map((entry, index) => normalizePaperworkVersion(entry, index))
        : [];
      setPaperworkVersions(incomingVersions);
      setTimelineSelectedCueIds([]);
      setPaperworkStatus('');
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
      setSourceDocumentStatus('');
      setPendingSourceDraftRows([]);
      setPendingSourceRawText('');
      lastCueSignaturesRef.current = new Map();
      if (editSessionRef.current.timer) clearTimeout(editSessionRef.current.timer);
      editSessionRef.current = {
        timer: null,
        startedAt: null,
        lastChangedAt: null,
        changeCount: 0,
        summary: '',
      };
      return;
    }

    setPrimaryView('clean_editable');
    setSourceDocument(null);
    setRows(getDefaultRowsForEvent(selectedEvent));
    setTimelineMode('segment');
    setTimelineTrackFilter('all');
    setTimelineSnap(DEFAULT_TIMELINE_SNAP);
    setTimelineCues(syncTimelineCuesFromRows(getDefaultRowsForEvent(selectedEvent), []));
    setPaperworkDirty(PAPERWORK_DEPARTMENTS.reduce((acc, department) => ({ ...acc, [department]: false }), {}));
    setPaperworkVersions([]);
    setTimelineSelectedCueIds([]);
    setPaperworkStatus('');
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
    setSourceDocumentStatus('');
    setPendingSourceDraftRows([]);
    setPendingSourceRawText('');
    lastCueSignaturesRef.current = new Map();
    if (editSessionRef.current.timer) clearTimeout(editSessionRef.current.timer);
    editSessionRef.current = {
      timer: null,
      startedAt: null,
      lastChangedAt: null,
      changeCount: 0,
      summary: '',
    };
  }, [selectedEvent]);

  useEffect(() => {
    if (!rows.length) {
      if (activeCueId) setActiveCueId('');
      return;
    }
    const hasActive = rows.some(row => row.id === activeCueId);
    if (!hasActive) setActiveCueId(rows[0].id);
  }, [rows, activeCueId]);

  useEffect(() => {
    if (!selectedEventId || !user?.id) {
      setSourceDocuments([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setSourceDocumentsLoading(true);
      try {
        const res = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'list',
            userId: user.id,
            eventId: selectedEventId,
            category: 'run_of_show_source',
          }),
        });
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || 'I could not load source documents yet.');
        const nextDocs = (data.media || [])
          .map((record, index) => normalizeSourceDocumentFromMedia(record, index))
          .filter(Boolean);
        if (cancelled) return;
        setSourceDocuments(nextDocs);
        setSourceDocument((prev) => {
          if (prev) {
            const matched = nextDocs.find((doc) => doc.id === prev.id || doc.url === prev.url);
            if (matched) return matched;
            return prev;
          }
          return nextDocs[0] || null;
        });
      } catch (err) {
        if (!cancelled) {
          setSourceDocumentStatus(`I hit a snag loading source documents: ${err.message}`);
          setSourceDocuments([]);
        }
      } finally {
        if (!cancelled) setSourceDocumentsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedEventId, user?.id]);

  useEffect(() => {
    timelineCuesRef.current = timelineCues;
  }, [timelineCues]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    paperworkDirtyRef.current = paperworkDirty;
  }, [paperworkDirty]);

  useEffect(() => {
    paperworkVersionsRef.current = paperworkVersions;
  }, [paperworkVersions]);

  useEffect(() => {
    return () => {
      if (editSessionRef.current.timer) {
        clearTimeout(editSessionRef.current.timer);
      }
    };
  }, []);

  useEffect(() => {
    setTimelineCues(prev => syncTimelineCuesFromRows(rows, prev));
  }, [rows]);

  const syncRowsFromTimelineCues = (nextTimelineCues = []) => {
    const bySource = new Map(nextTimelineCues.map(cue => [cue.sourceCueId, cue]));
    setRows(prev => normalizeCueRows(prev.map((row) => {
      const linked = bySource.get(row.id);
      if (!linked) return row;
      const nextDepartment = inferDepartmentFromTrack(linked.track || inferTrackFromDepartment(row.department));
      return {
        ...row,
        cueId: linked.cueId || row.cueId,
        department: nextDepartment,
        scriptRef: linked.triggerSource || row.scriptRef,
        time: formatClockFromMs(linked.startMs),
        duration: msToDurationLabel(linked.durationMs),
        item: linked.label || row.item,
        notes: linked.notes || row.notes,
      };
    })));
  };

  const getNextPaperworkVersionNumber = (versions = [], department = '') => {
    const currentMax = versions
      .filter((entry) => entry.department === department)
      .reduce((max, entry) => Math.max(max, Number(entry.versionNumber || 0)), 0);
    return currentMax + 1;
  };

  const finalizePaperworkSession = ({ reason = 'Timeline edit', force = false } = {}) => {
    const dirtyMap = paperworkDirtyRef.current || {};
    const dirtyDepartments = PAPERWORK_DEPARTMENTS.filter((department) => !!dirtyMap[department]);
    if (!dirtyDepartments.length) return null;

    if (!force && !selectedEvent) return null;

    const existing = paperworkVersionsRef.current || [];
    const generatedAt = new Date().toISOString();
    const generated = dirtyDepartments.map((department) => {
      const content = buildDepartmentPaperworkText(department, rowsRef.current || [], timelineCuesRef.current || []);
      const versionNumber = getNextPaperworkVersionNumber(existing, department);
      return normalizePaperworkVersion({
        id: makeId(`paperwork_${department}`),
        eventId: selectedEvent?.id || '',
        department,
        versionNumber,
        status: 'draft',
        createdBy: user?.email || user?.id || 'system',
        createdAt: generatedAt,
        sourceSnapshotId: makeId('snapshot'),
        changeSummary: reason,
        artifactLinks: {
          txt: toDataUrlText(content),
          pdf: '',
        },
      });
    });

    const nextDirty = PAPERWORK_DEPARTMENTS.reduce((acc, department) => ({ ...acc, [department]: false }), {});
    const nextVersions = [...existing, ...generated];

    setPaperworkDirty(nextDirty);
    setPaperworkVersions(nextVersions);
    paperworkDirtyRef.current = nextDirty;
    paperworkVersionsRef.current = nextVersions;
    setPaperworkStatus(`Generated ${generated.length} updated paperwork draft${generated.length === 1 ? '' : 's'} (${reason}).`);

    if (editSessionRef.current.timer) {
      clearTimeout(editSessionRef.current.timer);
    }
    editSessionRef.current = {
      timer: null,
      startedAt: null,
      lastChangedAt: null,
      changeCount: 0,
      summary: '',
    };

    return {
      paperworkVersions: nextVersions,
      paperworkDirty: nextDirty,
    };
  };

  const queuePaperworkSession = (summary = 'Timeline edited') => {
    const now = Date.now();
    const nextSession = { ...(editSessionRef.current || {}) };
    if (!nextSession.startedAt) nextSession.startedAt = now;
    nextSession.lastChangedAt = now;
    nextSession.changeCount = Number(nextSession.changeCount || 0) + 1;
    nextSession.summary = summary;
    if (nextSession.timer) clearTimeout(nextSession.timer);
    nextSession.timer = setTimeout(() => {
      finalizePaperworkSession({ reason: nextSession.summary || 'Timeline edit session' });
    }, PAPERWORK_BATCH_WINDOW_MS);
    editSessionRef.current = nextSession;
  };

  useEffect(() => {
    const signatureById = new Map((timelineCues || []).map((cue) => [cue.id, cueSignature(cue)]));
    if (lastCueSignaturesRef.current.size === 0) {
      lastCueSignaturesRef.current = signatureById;
      return;
    }

    const touchedDepartments = new Set();
    for (const cue of (timelineCues || [])) {
      const previous = lastCueSignaturesRef.current.get(cue.id);
      const current = signatureById.get(cue.id);
      if (previous !== current) {
        const dep = toPaperworkDepartment(cue.track, cue.department);
        if (dep) touchedDepartments.add(dep);
      }
    }
    for (const [id] of lastCueSignaturesRef.current.entries()) {
      if (!signatureById.has(id)) {
        const prevCue = (timelineCuesRef.current || []).find((cue) => cue.id === id);
        const dep = toPaperworkDepartment(prevCue?.track, prevCue?.department);
        if (dep) touchedDepartments.add(dep);
      }
    }

    if (touchedDepartments.size) {
      setPaperworkDirty(prev => {
        const next = { ...prev };
        touchedDepartments.forEach((department) => {
          next[department] = true;
        });
        paperworkDirtyRef.current = next;
        return next;
      });
      queuePaperworkSession(`Timeline edits (${Array.from(touchedDepartments).join(', ')})`);
    }
    lastCueSignaturesRef.current = signatureById;
  }, [timelineCues]);

  const applyTimelineSnap = (valueMs = 0) => {
    const shouldSnap = !!(timelineSnap.segmentBoundaries || timelineSnap.markers || timelineSnap.cueEdges);
    if (!shouldSnap) return Math.max(0, Math.round(valueMs));
    return Math.max(0, Math.round(valueMs / TIMELINE_BASE_SNAP_MS) * TIMELINE_BASE_SNAP_MS);
  };

  const updateTimelineCue = (cueId, updates = {}, { synchronizeRows = true, sessionSummary = 'Timeline cue updated' } = {}) => {
    setTimelineCues(prev => {
      const next = prev.map((cue) => {
        if (cue.id !== cueId) return cue;
        const raw = {
          ...cue,
          ...updates,
        };
        const startMs = updates.startMs !== undefined ? applyTimelineSnap(Number(updates.startMs) || 0) : Number(raw.startMs || 0);
        const durationMs = updates.durationMs !== undefined
          ? Math.max(1000, Number(updates.durationMs) || 1000)
          : Math.max(1000, Number(raw.durationMs || 1000));
        const normalized = normalizeTimelineCue({
          ...raw,
          startMs,
          durationMs,
          endMs: startMs + durationMs,
        }, cue);
        return normalized;
      });
      if (synchronizeRows) syncRowsFromTimelineCues(next);
      queuePaperworkSession(sessionSummary);
      return next;
    });
  };

  const duplicateTimelineCue = (cueId) => {
    setTimelineCues(prev => {
      const source = prev.find(cue => cue.id === cueId);
      if (!source) return prev;
      const duplicate = normalizeTimelineCue({
        ...source,
        id: makeId('timeline'),
        sourceCueId: '',
        cueId: `${source.cueId || 'CUE'}-COPY`,
        startMs: applyTimelineSnap((Number(source.startMs) || 0) + 5000),
        endMs: (Number(source.endMs) || 0) + 5000,
      }, source);
      const next = [...prev, duplicate];
      queuePaperworkSession('Timeline cue duplicated');
      return next;
    });
  };

  const deleteTimelineCue = (cueId) => {
    setTimelineCues(prev => {
      const next = prev.filter(cue => cue.id !== cueId);
      queuePaperworkSession('Timeline cue removed');
      return next;
    });
    setTimelineSelectedCueIds(prev => prev.filter(id => id !== cueId));
  };

  const shiftTimelineCue = (cueId, deltaMs = 0) => {
    const cue = (timelineCuesRef.current || []).find(entry => entry.id === cueId);
    if (!cue || cue.locked) return;
    updateTimelineCue(
      cueId,
      { startMs: Math.max(0, Number(cue.startMs || 0) + deltaMs) },
      { sessionSummary: 'Timeline cue moved' }
    );
  };

  const trimTimelineCue = (cueId, deltaMs = 0) => {
    const cue = (timelineCuesRef.current || []).find(entry => entry.id === cueId);
    if (!cue || cue.locked) return;
    updateTimelineCue(
      cueId,
      { durationMs: Math.max(1000, Number(cue.durationMs || 1000) + deltaMs) },
      { sessionSummary: 'Timeline cue trimmed' }
    );
  };

  const bulkShiftSelectedTimelineCues = (deltaMs = 0) => {
    if (!timelineSelectedCueIds.length) return;
    setTimelineCues(prev => {
      const selected = new Set(timelineSelectedCueIds);
      const next = prev.map((cue) => {
        if (!selected.has(cue.id) || cue.locked) return cue;
        const startMs = applyTimelineSnap(Math.max(0, Number(cue.startMs || 0) + deltaMs));
        return normalizeTimelineCue({
          ...cue,
          startMs,
          endMs: startMs + Math.max(1000, Number(cue.durationMs || 1000)),
        }, cue);
      });
      syncRowsFromTimelineCues(next);
      queuePaperworkSession('Bulk timeline move');
      return next;
    });
  };

  const linkSelectedTimelineCues = () => {
    if (timelineSelectedCueIds.length < 2) return;
    const linkId = makeId('link_group');
    setTimelineCues(prev => prev.map(cue => (
      timelineSelectedCueIds.includes(cue.id) ? { ...cue, linkedGroupId: linkId } : cue
    )));
    queuePaperworkSession('Linked timeline cues');
  };

  const unlinkSelectedTimelineCues = () => {
    if (!timelineSelectedCueIds.length) return;
    setTimelineCues(prev => prev.map(cue => (
      timelineSelectedCueIds.includes(cue.id) ? { ...cue, linkedGroupId: '' } : cue
    )));
    queuePaperworkSession('Unlinked timeline cues');
  };

  const setTimelineCueSelection = (cueId, isSelected) => {
    setTimelineSelectedCueIds(prev => {
      if (isSelected) return Array.from(new Set([...prev, cueId]));
      return prev.filter(id => id !== cueId);
    });
  };

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

  const adjustRowTime = (id, deltaMinutes = 0) => {
    setRows(prev => prev.map(row => (
      row.id === id ? { ...row, time: adjustClockTime(row.time, deltaMinutes) } : row
    )));
  };

  const adjustRowDuration = (id, deltaMinutes = 0) => {
    setRows(prev => prev.map(row => (
      row.id === id ? { ...row, duration: adjustDuration(row.duration, deltaMinutes) } : row
    )));
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

  const buildRunOfShowPayload = (overrides = {}) => ({
    cues: rows,
    timelineMode,
    timelineCues,
    timelineTrackFilter,
    timelineSnap,
    paperworkDirty,
    paperworkVersions,
    openMicQueue,
    schedulingMode,
    workflowSteps,
    staffAssignments,
    techChecklist,
    emailInbox,
    primaryView,
    sourceDocument,
    sourceDraftRawText: pendingSourceRawText || '',
    lastEmailReceivedAt: emailInbox[0]?.receivedAt || null,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  });

  const persistRunOfShowPatch = async (overrides = {}, opts = {}) => {
    if (!selectedEvent) return;
    const { silent = false } = opts;
    if (!silent) setSaving(true);
    try {
      const runOfShowData = buildRunOfShowPayload(overrides);
      await updateEvent(selectedEvent.id, {
        run_of_show: runOfShowData,
      });
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const refreshSourceDocumentsFromMedia = async () => {
    if (!selectedEventId || !user?.id) return [];
    const res = await fetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list',
        userId: user.id,
        eventId: selectedEventId,
        category: 'run_of_show_source',
      }),
    });
    const data = await res.json();
    if (!data?.success) throw new Error(data?.error || 'I could not load source documents yet.');
    const nextDocs = (data.media || [])
      .map((record, index) => normalizeSourceDocumentFromMedia(record, index))
      .filter(Boolean);
    setSourceDocuments(nextDocs);
    return nextDocs;
  };

  const applyPrimaryViewChange = async (nextValue) => {
    if (!canChangePrimaryView) return;
    const sanitized = sanitizePrimaryView(nextValue);
    setPrimaryView(sanitized);
    await persistRunOfShowPatch({ primaryView: sanitized }, { silent: true });
    setSourceDocumentStatus(`Primary view updated to ${sanitized === 'source_document' ? 'Source Document' : 'Clean Run of Show'}.`);
  };

  const selectSourceDocument = async (nextDoc) => {
    const normalized = normalizeSourceDocument(nextDoc);
    setSourceDocument(normalized);
    await persistRunOfShowPatch({ sourceDocument: normalized }, { silent: true });
  };

  const extractSourceDraftFromFile = async (file) => {
    if (!file) return;
    const mimeType = String(file.type || '').toLowerCase();
    if (!(mimeType.includes('pdf') || mimeType.startsWith('image/'))) {
      setSourceDocumentStatus('Source document uploaded. OCR draft is available for images and PDFs.');
      return;
    }

    setSourceDocumentExtracting(true);
    try {
      const fileData = await fileToBase64(file);
      const extractionPrompt = `You are an OCR parser for live production run-of-show documents.
Return valid JSON only with this shape:
{
  "rawText": "all readable text",
  "cues": [
    {
      "cueId": "optional cue id",
      "department": "STAGE|LX|AUDIO|VIDEO|DECK|FLY|FOH",
      "time": "HH:MM or text",
      "duration": "optional duration",
      "item": "cue title",
      "crewMember": "optional operator/owner",
      "notes": "optional note",
      "environment": "optional location",
      "scriptRef": "optional script ref",
      "status": "planned|standby|go|executed|hold"
    }
  ]
}
Rules:
- Preserve timeline order from the source when possible.
- Include only real cues you can read.
- If time is missing, leave it blank.
- No markdown. JSON only.`;
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract-upload',
          fileData,
          mimeType: file.type || 'application/pdf',
          extractionPrompt,
        }),
      });
      const data = await response.json();
      if (!data?.success) throw new Error(data?.error || 'OCR extraction failed.');

      const extracted = data.extracted || {};
      const rawText = String(extracted.rawText || extracted.raw_text || '').trim();
      const cues = Array.isArray(extracted.cues) ? extracted.cues : [];
      const draftRows = normalizeCueRows(
        cues
          .map((cue, index) => normalizeRunOfShowExtractedCue(cue, index))
          .filter((row) => row.item || row.time)
      );

      setPendingSourceRawText(rawText);
      setPendingSourceDraftRows(draftRows);
      if (draftRows.length) {
        setSourceDocumentStatus(`OCR draft ready: ${draftRows.length} cue${draftRows.length === 1 ? '' : 's'} found. Review and apply when ready.`);
      } else {
        setSourceDocumentStatus('OCR completed, but I could not map timeline cues yet. You can still use the source document as primary.');
      }
    } catch (err) {
      setSourceDocumentStatus(`I hit a snag extracting this source document: ${err.message}`);
    } finally {
      setSourceDocumentExtracting(false);
    }
  };

  const handleSourceDocumentUpload = async (filesLike) => {
    const files = Array.from(filesLike || []).filter(Boolean);
    if (!files.length || !selectedEventId || !user?.id) return;
    setSourceDocumentUploading(true);
    setSourceDocumentStatus('');
    try {
      for (const file of files) {
        const base64 = await fileToBase64(file);
        const uploadRes = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            base64,
            category: 'run_of_show_source',
            label: String(file.name || 'Run of Show Source').replace(/\.[^.]+$/, ''),
            eventId: selectedEventId,
            userId: user.id,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
          }),
        });
        const uploadData = await uploadRes.json();
        if (!uploadData?.success) {
          throw new Error(uploadData?.error || `Upload failed for ${file.name}.`);
        }
      }

      const nextDocs = await refreshSourceDocumentsFromMedia();
      const newestDoc = nextDocs[0] || null;
      if (newestDoc) {
        await selectSourceDocument(newestDoc);
      }
      if (files.length === 1) {
        await extractSourceDraftFromFile(files[0]);
      } else {
        setSourceDocumentStatus(`Uploaded ${files.length} source documents.`);
      }
    } catch (err) {
      setSourceDocumentStatus(`I hit a snag uploading source docs: ${err.message}`);
    } finally {
      setSourceDocumentUploading(false);
    }
  };

  const applySourceDraftToTimeline = (mode = 'merge') => {
    if (!pendingSourceDraftRows.length) return;
    if (mode === 'replace') {
      setRows(normalizeCueRows(pendingSourceDraftRows.map((row) => ({ ...row, id: makeId('cue') }))));
      setSourceDocumentStatus(`Clean run of show replaced with ${pendingSourceDraftRows.length} OCR draft cues.`);
    } else {
      setRows(prev => normalizeCueRows(mergeCueRows(prev, pendingSourceDraftRows)));
      setSourceDocumentStatus(`Merged ${pendingSourceDraftRows.length} OCR draft cues into the clean run of show.`);
    }
    setPendingSourceDraftRows([]);
  };

  const handleRegeneratePaperworkNow = () => {
    const generated = finalizePaperworkSession({ reason: 'Manual paperwork regenerate', force: true });
    if (!generated) {
      setPaperworkStatus('No department paperwork is currently marked out-of-date.');
      return;
    }
    persistRunOfShowPatch({
      paperworkDirty: generated.paperworkDirty,
      paperworkVersions: generated.paperworkVersions,
    }, { silent: true }).catch(() => {});
  };

  const handlePublishPaperworkVersion = (versionId) => {
    if (!versionId) return;
    setPaperworkPublishing(versionId);
    let nextVersions = null;
    setPaperworkVersions(prev => {
      const target = prev.find(entry => entry.id === versionId);
      if (!target) return prev;
      const next = prev.map((entry) => {
        if (entry.department !== target.department) return entry;
        if (entry.id === target.id) return { ...entry, status: 'published' };
        if (entry.status === 'published') return { ...entry, status: 'archived' };
        return entry;
      });
      paperworkVersionsRef.current = next;
      nextVersions = next;
      return next;
    });
    setPaperworkStatus('Published paperwork version updated.');
    if (nextVersions) {
      persistRunOfShowPatch({ paperworkVersions: nextVersions }, { silent: true }).catch(() => {});
    }
    setPaperworkPublishing('');
  };

  const saveToSupabase = async () => {
    if (!selectedEvent) return;

    setSaving(true);
    try {
      const generated = finalizePaperworkSession({ reason: 'Manual save', force: true }) || {};
      await persistRunOfShowPatch({
        timelineMode,
        timelineCues: timelineCuesRef.current || timelineCues,
        timelineTrackFilter,
        timelineSnap,
        paperworkDirty: generated.paperworkDirty || paperworkDirtyRef.current || paperworkDirty,
        paperworkVersions: generated.paperworkVersions || paperworkVersionsRef.current || paperworkVersions,
      }, { silent: true });
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
          <div className="card mb-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg m-0">PRIMARY VIEW (Top of Page)</h3>
                <p className="text-xs text-gray-500 mt-1 mb-0">
                  Choose which run-of-show representation appears first for everyone on this event.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={primaryView}
                  onChange={(e) => applyPrimaryViewChange(e.target.value)}
                  disabled={!canChangePrimaryView}
                  className="px-3 py-2 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:border-[#c8a45e] disabled:bg-gray-100"
                >
                  <option value="source_document">Source Document (Upload)</option>
                  <option value="clean_editable">Clean Run of Show (Editable)</option>
                </select>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => sourceDocumentInputRef.current?.click()}
                  disabled={sourceDocumentUploading}
                >
                  {sourceDocumentUploading ? 'Uploading…' : 'Upload Source Document'}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={refreshSourceDocumentsFromMedia}
                  disabled={sourceDocumentsLoading}
                >
                  {sourceDocumentsLoading ? 'Refreshing…' : 'Refresh Sources'}
                </button>
              </div>
            </div>

            {!canChangePrimaryView && (
              <p className="text-xs text-amber-700 mt-3 mb-0">
                Read-only: event owner, producer, booking agent, or admin can change the primary top-of-page view.
              </p>
            )}

            <input
              ref={sourceDocumentInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files || [];
                handleSourceDocumentUpload(files);
                e.target.value = '';
              }}
            />

            {sourceDocuments.length > 0 && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Current Source Document</label>
                  <select
                    value={sourceDocument?.id || ''}
                    onChange={(e) => {
                      const nextDoc = sourceDocuments.find((doc) => doc.id === e.target.value);
                      if (nextDoc) selectSourceDocument(nextDoc);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:border-[#c8a45e]"
                  >
                    {sourceDocuments.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.label || 'Source Document'} · {new Date(doc.uploadedAt).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">OCR Draft Actions</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={!pendingSourceDraftRows.length}
                      onClick={() => applySourceDraftToTimeline('merge')}
                    >
                      Merge OCR Draft
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={!pendingSourceDraftRows.length}
                      onClick={() => {
                        if (window.confirm('Replace the clean run of show timeline with OCR draft rows?')) {
                          applySourceDraftToTimeline('replace');
                        }
                      }}
                    >
                      Replace with OCR Draft
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={!sourceDocument}
                      onClick={() => {
                        setPendingSourceDraftRows([]);
                        setPendingSourceRawText('');
                        setSourceDocumentStatus('Cleared pending OCR draft.');
                      }}
                    >
                      Clear Draft
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 mb-0">
                    {sourceDocumentExtracting
                      ? 'Extracting OCR draft…'
                      : pendingSourceDraftRows.length
                        ? `${pendingSourceDraftRows.length} draft cue${pendingSourceDraftRows.length === 1 ? '' : 's'} ready to apply.`
                        : 'Upload a PDF/image source to generate an OCR draft for review.'}
                  </p>
                </div>
              </div>
            )}

            {(sourceDocumentStatus || pendingSourceRawText) && (
              <div className="mt-3 p-2 rounded border border-gray-200 bg-gray-50">
                {sourceDocumentStatus && <p className="text-xs text-gray-700 m-0">{sourceDocumentStatus}</p>}
                {pendingSourceRawText && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 cursor-pointer">View OCR raw text</summary>
                    <pre className="text-[11px] mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{pendingSourceRawText}</pre>
                  </details>
                )}
              </div>
            )}
          </div>

          {primaryView === 'source_document' ? (
            <>
              <div className="card mb-6 border-2 border-[#c8a45e]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg m-0">Official Run of Show Source Document</h3>
                  <span className="text-xs px-2 py-1 rounded bg-[#f8f2e4] text-[#7f5f2b] border border-[#d8bf84]">Primary</span>
                </div>
                {sourceDocument ? (
                  <>
                    <p className="text-xs text-gray-500 mt-0 mb-3">
                      {sourceDocument.label || 'Source document'} · {new Date(sourceDocument.uploadedAt).toLocaleString()}
                    </p>
                    {String(sourceDocument.mimeType || '').startsWith('image/') ? (
                      <img src={sourceDocument.url} alt={sourceDocument.label || 'Source document'} className="w-full rounded border border-gray-200" />
                    ) : String(sourceDocument.mimeType || '').includes('pdf') ? (
                      <iframe src={sourceDocument.url} title="Run of show source document" className="w-full h-[640px] rounded border border-gray-200 bg-white" />
                    ) : (
                      <a href={sourceDocument.url} target="_blank" rel="noreferrer" className="text-sm text-[#7f5f2b] underline">
                        Open source document
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 m-0">Upload a source document to show it here.</p>
                )}
              </div>
              <div className="card mb-6">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-lg m-0">Clean Editable Run of Show</h3>
                    <p className="text-xs text-gray-500 mt-1 mb-0">This is your structured manual schedule. Edit full details in the editor below.</p>
                  </div>
                  <a href="#clean-run-of-show-editor" className="btn-secondary text-xs no-underline">Jump to Editor</a>
                </div>
                {rows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[680px]">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 font-medium text-gray-500">Time</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-500">Cue</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-500">Department</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-500">Operator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={`preview-${row.id}`} className="border-b border-gray-100">
                            <td className="py-1 px-2">{row.time || '—'}</td>
                            <td className="py-1 px-2">{row.item || '—'}</td>
                            <td className="py-1 px-2">{row.department || 'STAGE'}</td>
                            <td className="py-1 px-2">{row.crewMember || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 m-0">No cue rows yet.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="card mb-6 border-2 border-[#c8a45e]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg m-0">Clean Editable Run of Show</h3>
                  <span className="text-xs px-2 py-1 rounded bg-[#f8f2e4] text-[#7f5f2b] border border-[#d8bf84]">Primary</span>
                </div>
                <p className="text-xs text-gray-500 mt-0 mb-2">Use the editable timeline below to adjust times, ordering, and cue details.</p>
                <div className="overflow-x-auto mb-2">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Time</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Cue</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Department</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Operator</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`clean-primary-${row.id}`} className="border-b border-gray-100">
                          <td className="py-1 px-2">{row.time || '—'}</td>
                          <td className="py-1 px-2">{row.item || '—'}</td>
                          <td className="py-1 px-2">{row.department || 'STAGE'}</td>
                          <td className="py-1 px-2">{row.crewMember || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <a href="#clean-run-of-show-editor" className="btn-secondary text-xs no-underline">Open Full Editor</a>
              </div>
              <div className="card mb-6">
                <h3 className="text-lg m-0 mb-2">Official Run of Show Source Document</h3>
                {sourceDocument ? (
                  <>
                    <p className="text-xs text-gray-500 mt-0 mb-3">
                      {sourceDocument.label || 'Source document'} · {new Date(sourceDocument.uploadedAt).toLocaleString()}
                    </p>
                    {String(sourceDocument.mimeType || '').startsWith('image/') ? (
                      <img src={sourceDocument.url} alt={sourceDocument.label || 'Source document'} className="w-full rounded border border-gray-200" />
                    ) : String(sourceDocument.mimeType || '').includes('pdf') ? (
                      <iframe src={sourceDocument.url} title="Run of show source document" className="w-full h-[520px] rounded border border-gray-200 bg-white" />
                    ) : (
                      <a href={sourceDocument.url} target="_blank" rel="noreferrer" className="text-sm text-[#7f5f2b] underline">
                        Open source document
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 m-0">Upload a source document to show it here.</p>
                )}
              </div>
            </>
          )}

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

          {/* Timeline Editor */}
          <div className="card mb-6">
            <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
              <div>
                <h3 className="text-lg m-0">🧱 Timeline (Show Control)</h3>
                <p className="text-xs text-gray-500 mt-1 mb-0">
                  Multi-track cue timeline for LX, sound, deck, projection, and show control.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={timelineMode}
                  onChange={(e) => setTimelineMode(normalizeTimelineMode(e.target.value))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
                >
                  {TIMELINE_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
                <select
                  value={timelineTrackFilter}
                  onChange={(e) => setTimelineTrackFilter(e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
                >
                  <option value="all">All Tracks</option>
                  {TIMELINE_TRACKS.map((track) => (
                    <option key={track.key} value={track.key}>{track.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={!!timelineSnap.segmentBoundaries}
                  onChange={(e) => setTimelineSnap(prev => ({ ...prev, segmentBoundaries: e.target.checked }))}
                />
                Snap to Segment Boundaries
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={!!timelineSnap.markers}
                  onChange={(e) => setTimelineSnap(prev => ({ ...prev, markers: e.target.checked }))}
                />
                Snap to Markers
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={!!timelineSnap.cueEdges}
                  onChange={(e) => setTimelineSnap(prev => ({ ...prev, cueEdges: e.target.checked }))}
                />
                Snap to Cue Edges
              </label>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-3">
              <button type="button" className="btn-secondary text-xs" onClick={() => bulkShiftSelectedTimelineCues(-5000)} disabled={!timelineSelectedCueIds.length}>
                Selected -5s
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={() => bulkShiftSelectedTimelineCues(5000)} disabled={!timelineSelectedCueIds.length}>
                Selected +5s
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={linkSelectedTimelineCues} disabled={timelineSelectedCueIds.length < 2}>
                Link Selected
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={unlinkSelectedTimelineCues} disabled={!timelineSelectedCueIds.length}>
                Unlink Selected
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={handleRegeneratePaperworkNow}>
                Regenerate Paperwork Drafts
              </button>
              {!!paperworkStatus && <span className="text-xs text-gray-600">{paperworkStatus}</span>}
            </div>

            <div className="space-y-3">
              {TIMELINE_TRACKS
                .filter((track) => timelineTrackFilter === 'all' || track.key === timelineTrackFilter)
                .map((track) => {
                  const cues = timelineCuesByTrack[track.key] || [];
                  return (
                    <div key={track.key} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold m-0">{track.label}</h4>
                        <span className="text-[11px] text-gray-500">{cues.length} cue{cues.length === 1 ? '' : 's'}</span>
                      </div>
                      {!cues.length ? (
                        <p className="text-xs text-gray-500 m-0">No cues on this track yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {cues.map((cue) => (
                            <div key={cue.id} className={`p-2 rounded border ${timelineSelectedCueIds.includes(cue.id) ? 'border-[#c8a45e] bg-[#f8f2e4]' : 'border-gray-200 bg-white'}`}>
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                                <div className="md:col-span-1">
                                  <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                    <input
                                      type="checkbox"
                                      checked={timelineSelectedCueIds.includes(cue.id)}
                                      onChange={(e) => setTimelineCueSelection(cue.id, e.target.checked)}
                                    />
                                    Pick
                                  </label>
                                </div>
                                <div className="md:col-span-2">
                                  <input
                                    type="text"
                                    value={cue.cueId || ''}
                                    onChange={(e) => updateTimelineCue(cue.id, { cueId: e.target.value }, { sessionSummary: 'Cue ID updated' })}
                                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                    placeholder="LX 12"
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <input
                                    type="text"
                                    value={cue.label || ''}
                                    onChange={(e) => updateTimelineCue(cue.id, { label: e.target.value }, { sessionSummary: 'Cue label updated' })}
                                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                    placeholder="Cue label"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  {timelineMode === 'timecode' ? (
                                    <input
                                      type="text"
                                      value={formatTimecodeFromMs(cue.startMs)}
                                      onChange={(e) => {
                                        const parsed = parseTimecodeToMs(e.target.value);
                                        if (parsed !== null) updateTimelineCue(cue.id, { startMs: parsed }, { sessionSummary: 'Cue timecode updated' });
                                      }}
                                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                      placeholder="HH:MM:SS"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[11px] text-gray-500">T+</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={Math.round(Number(cue.startMs || 0) / 1000)}
                                        onChange={(e) => updateTimelineCue(cue.id, { startMs: Number(e.target.value || 0) * 1000 }, { sessionSummary: 'Cue offset updated' })}
                                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                      />
                                      <span className="text-[11px] text-gray-500">s</span>
                                    </div>
                                  )}
                                </div>
                                <div className="md:col-span-1">
                                  <input
                                    type="number"
                                    min="1"
                                    value={Math.max(1, Math.round(Number(cue.durationMs || 1000) / 1000))}
                                    onChange={(e) => updateTimelineCue(cue.id, { durationMs: Number(e.target.value || 1) * 1000 }, { sessionSummary: 'Cue duration updated' })}
                                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                  />
                                </div>
                                <div className="md:col-span-3 flex items-center gap-1 flex-wrap">
                                  <button type="button" className="btn-secondary text-[11px] px-2 py-1" onClick={() => shiftTimelineCue(cue.id, -5000)} disabled={cue.locked}>-5s</button>
                                  <button type="button" className="btn-secondary text-[11px] px-2 py-1" onClick={() => shiftTimelineCue(cue.id, 5000)} disabled={cue.locked}>+5s</button>
                                  <button type="button" className="btn-secondary text-[11px] px-2 py-1" onClick={() => trimTimelineCue(cue.id, -1000)} disabled={cue.locked}>Trim -1s</button>
                                  <button type="button" className="btn-secondary text-[11px] px-2 py-1" onClick={() => trimTimelineCue(cue.id, 1000)} disabled={cue.locked}>Trim +1s</button>
                                  <button type="button" className="btn-secondary text-[11px] px-2 py-1" onClick={() => duplicateTimelineCue(cue.id)}>Duplicate</button>
                                  <button type="button" className="text-red-600 text-[11px] px-2 py-1 border border-red-200 rounded" onClick={() => deleteTimelineCue(cue.id)}>Delete</button>
                                </div>
                                <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-6 gap-2">
                                  <select
                                    value={cue.track || track.key}
                                    onChange={(e) => updateTimelineCue(cue.id, { track: e.target.value, department: inferDepartmentFromTrack(e.target.value) }, { sessionSummary: 'Cue track updated' })}
                                    className="px-2 py-1 border border-gray-200 rounded text-xs bg-white"
                                  >
                                    {TIMELINE_TRACKS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    value={cue.segmentId || ''}
                                    onChange={(e) => updateTimelineCue(cue.id, { segmentId: e.target.value }, { sessionSummary: 'Cue segment updated' })}
                                    className="px-2 py-1 border border-gray-200 rounded text-xs"
                                    placeholder="Segment ID"
                                  />
                                  <input
                                    type="text"
                                    value={cue.triggerSource || ''}
                                    onChange={(e) => updateTimelineCue(cue.id, { triggerSource: e.target.value }, { sessionSummary: 'Cue trigger updated' })}
                                    className="px-2 py-1 border border-gray-200 rounded text-xs"
                                    placeholder="Trigger source"
                                  />
                                  <input
                                    type="text"
                                    value={cue.linkedGroupId || ''}
                                    onChange={(e) => updateTimelineCue(cue.id, { linkedGroupId: e.target.value }, { sessionSummary: 'Cue linking updated' })}
                                    className="px-2 py-1 border border-gray-200 rounded text-xs"
                                    placeholder="Linked group ID"
                                  />
                                  <label className="flex items-center gap-1 text-[11px] text-gray-700">
                                    <input
                                      type="checkbox"
                                      checked={!!cue.standbyMarker}
                                      onChange={(e) => updateTimelineCue(cue.id, { standbyMarker: e.target.checked }, { sessionSummary: 'Standby marker updated' })}
                                    />
                                    Standby
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1 text-[11px] text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={!!cue.goMarker}
                                        onChange={(e) => updateTimelineCue(cue.id, { goMarker: e.target.checked }, { sessionSummary: 'Go marker updated' })}
                                      />
                                      Go
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px] text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={!!cue.locked}
                                        onChange={(e) => updateTimelineCue(cue.id, { locked: e.target.checked }, { sessionSummary: 'Cue lock updated' })}
                                      />
                                      Lock
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Auto-Versioned Department Paperwork */}
          <div className="card mb-6">
            <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
              <div>
                <h3 className="text-lg m-0">📚 Department Paperwork Versions</h3>
                <p className="text-xs text-gray-500 mt-1 mb-0">
                  Timeline edits mark paperwork out-of-date. Draft versions regenerate in batched edit sessions.
                </p>
              </div>
              <button type="button" className="btn-secondary text-xs" onClick={handleRegeneratePaperworkNow}>
                Regenerate Drafts Now
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PAPERWORK_DEPARTMENTS.map((department) => {
                const versions = paperworkVersionsByDepartment[department] || [];
                const published = versions.find((entry) => entry.status === 'published');
                const dirty = !!paperworkDirty[department];
                return (
                  <div key={department} className="border border-gray-200 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold capitalize">{department}</div>
                      <span className={`text-[11px] px-2 py-0.5 rounded ${dirty ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {dirty ? 'Out of Date' : 'Current'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0 mb-2">
                      {published
                        ? `Published v${published.versionNumber} · ${new Date(published.createdAt).toLocaleString()}`
                        : 'No published version yet'}
                    </p>
                    {!versions.length ? (
                      <p className="text-xs text-gray-500 m-0">No generated versions yet.</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {versions.slice(0, 10).map((version) => (
                          <div key={version.id} className="border border-gray-200 rounded px-2 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs">
                                v{version.versionNumber} · {version.status}
                              </span>
                              <div className="flex items-center gap-1">
                                {version.artifactLinks?.txt ? (
                                  <a href={version.artifactLinks.txt} download={`${selectedEvent?.title || 'event'}-${department}-v${version.versionNumber}.txt`} className="text-[11px] text-[#7f5f2b] underline">
                                    Download
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  className="text-[11px] px-1.5 py-0.5 border border-gray-200 rounded"
                                  onClick={() => handlePublishPaperworkVersion(version.id)}
                                  disabled={paperworkPublishing === version.id || version.status === 'published'}
                                >
                                  Publish
                                </button>
                              </div>
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {new Date(version.createdAt).toLocaleString()} · {version.createdBy || 'system'}
                            </div>
                            {version.changeSummary ? (
                              <div className="text-[11px] text-gray-600">{version.changeSummary}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cue Table */}
          <div id="clean-run-of-show-editor" className="card mb-6 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg m-0">Cue Table (Detailed)</h3>
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
                        <div className="space-y-1">
                          <input 
                            type="time" 
                            value={row.time} 
                            onChange={e => updateRow(row.id, 'time', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); adjustRowTime(row.id, -10); }}
                              className="px-1.5 py-0.5 rounded text-[10px] border border-gray-200 bg-white text-gray-600"
                            >
                              -10
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); adjustRowTime(row.id, -5); }}
                              className="px-1.5 py-0.5 rounded text-[10px] border border-gray-200 bg-white text-gray-600"
                            >
                              -5
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); adjustRowTime(row.id, 5); }}
                              className="px-1.5 py-0.5 rounded text-[10px] border border-gray-200 bg-white text-gray-600"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); adjustRowTime(row.id, 10); }}
                              className="px-1.5 py-0.5 rounded text-[10px] border border-gray-200 bg-white text-gray-600"
                            >
                              +10
                            </button>
                          </div>
                        </div>
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
                      <div className="space-y-1">
                        <input 
                          type="text" 
                          value={row.duration} 
                          onChange={e => updateRow(row.id, 'duration', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                          placeholder="15 min" 
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); adjustRowDuration(row.id, -5); }}
                            className="px-1.5 py-0.5 rounded text-[10px] border border-gray-200 bg-white text-gray-600"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); adjustRowDuration(row.id, 5); }}
                            className="px-1.5 py-0.5 rounded text-[10px] border border-gray-200 bg-white text-gray-600"
                          >
                            +5
                          </button>
                        </div>
                      </div>
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
