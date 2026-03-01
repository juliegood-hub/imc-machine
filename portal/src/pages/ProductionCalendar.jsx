import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import {
  CALENDAR_VIEW_MODES,
  DEFAULT_CALENDAR_EVENT_TYPES,
  filterEntriesByView,
  getCalendarTypeTemplate,
} from '../services/production-calendar';

const STATUS_OPTIONS = ['draft', 'confirmed', 'cancelled'];
const ATTENDANCE_OPTIONS = ['required', 'optional'];
const ASSIGNEE_TYPES = ['user', 'role', 'group', 'external'];
const DEFAULT_REMINDER_TEXT = '1440, 120, 30';

function todayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalDateTimeInput(isoValue = '') {
  if (!isoValue) return '';
  const dt = new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return '';
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(inputValue = '') {
  if (!inputValue) return '';
  const dt = new Date(inputValue);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString();
}

function csvToList(value = '') {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function listToCsv(values = []) {
  return Array.isArray(values) ? values.filter(Boolean).join(', ') : '';
}

function normalizeReminderCsv(value = '') {
  const numbers = csvToList(value)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .map((entry) => Math.round(entry));
  if (!numbers.length) return [1440, 120, 30];
  return Array.from(new Set(numbers)).slice(0, 8);
}

function formatDateHeading(isoValue = '') {
  const dt = new Date(isoValue || '');
  if (Number.isNaN(dt.getTime())) return 'Unknown Date';
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTimeLabel(isoValue = '') {
  const dt = new Date(isoValue || '');
  if (Number.isNaN(dt.getTime())) return 'TBD';
  return dt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildStartInput(anchorDate = '') {
  const safeDate = anchorDate || todayKey();
  return `${safeDate}T10:00`;
}

function buildEndInput(startInput = '', durationMinutes = 120) {
  if (!startInput) return '';
  const dt = new Date(startInput);
  if (Number.isNaN(dt.getTime())) return '';
  const safeDuration = Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 120;
  const end = new Date(dt.getTime() + safeDuration * 60000);
  const local = new Date(end.getTime() - end.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function buildDraftFromType({
  typeKey = '',
  eventId = '',
  orgId = '',
  anchorDate = '',
} = {}) {
  const template = getCalendarTypeTemplate(typeKey) || DEFAULT_CALENDAR_EVENT_TYPES[0] || null;
  const safeTypeKey = template?.key || typeKey || 'performance';
  const startInput = buildStartInput(anchorDate);
  return {
    id: '',
    eventId: eventId || '',
    orgId: orgId || '',
    typeKey: safeTypeKey,
    typeName: template?.name || 'Production Call',
    title: template?.name || 'Production Call',
    startInput,
    endInput: buildEndInput(startInput, template?.durationMinutes || 120),
    timezone: 'America/Chicago',
    location: '',
    status: 'draft',
    requiredAttendance: 'required',
    departmentTagsInput: listToCsv(template?.departmentTags || []),
    assignedRolesInput: listToCsv(template?.typicalRoles || []),
    reminderInput: DEFAULT_REMINDER_TEXT,
    description: '',
    internalNotes: '',
    shareableNotes: '',
  };
}

function mapEntryToDraft(entry = {}) {
  return {
    id: entry.id || '',
    eventId: entry.eventId || '',
    orgId: entry.orgId || '',
    typeKey: entry.typeKey || '',
    typeName: entry.typeName || '',
    title: entry.title || '',
    startInput: toLocalDateTimeInput(entry.startDatetime || ''),
    endInput: toLocalDateTimeInput(entry.endDatetime || ''),
    timezone: entry.timezone || 'America/Chicago',
    location: entry.location || '',
    status: entry.status || 'draft',
    requiredAttendance: entry.requiredAttendance || 'required',
    departmentTagsInput: listToCsv(entry.departmentTags || []),
    assignedRolesInput: listToCsv(entry.assignedRoles || []),
    reminderInput: listToCsv(entry.reminderSettings || [1440, 120, 30]),
    description: entry.description || '',
    internalNotes: entry.internalNotes || '',
    shareableNotes: entry.shareableNotes || '',
  };
}

function inferOrgIdFromEvent(event = null) {
  if (!event) return '';
  return event.venueProfileId || '';
}

export default function ProductionCalendar() {
  const {
    events,
    venueProfiles,
    listCalendarEventTypes,
    listRehearsalCalendarEntries,
    saveRehearsalCalendarEntry,
    removeRehearsalCalendarEntry,
    saveCalendarEntryAssignment,
    removeCalendarEntryAssignment,
    getGoogleCalendarConnectionStatus,
    getGoogleCalendarAuthUrl,
    connectGoogleCalendarAccount,
    listGoogleCalendarsForOrg,
    createGoogleCalendarForOrg,
    syncCalendarEntryRecord,
    syncAllDatedItemsToCalendar,
  } = useVenue();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [viewMode, setViewMode] = useState('week');
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const [eventTypes, setEventTypes] = useState([]);
  const [entries, setEntries] = useState([]);

  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [entryDraft, setEntryDraft] = useState(buildDraftFromType({ anchorDate: todayKey() }));
  const [assignmentDraft, setAssignmentDraft] = useState({
    assigneeName: '',
    assigneeRole: '',
    assigneeType: 'user',
    attendanceRequired: true,
    rsvpStatus: 'pending',
  });

  const [googleConnection, setGoogleConnection] = useState(null);
  const [googleCalendars, setGoogleCalendars] = useState([]);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [googleSettings, setGoogleSettings] = useState({
    defaultCalendarId: 'primary',
    syncEnabled: true,
    autoSyncTypes: ['performance', 'tech_rehearsal', 'soundcheck', 'load_in', 'load_out'],
  });

  const oauthHandledRef = useRef(false);

  const sortedEvents = useMemo(() => {
    const rows = [...(events || [])];
    rows.sort((a, b) => {
      const aTime = new Date(a.bookingStartAt || `${a.date || ''}T${a.time || '00:00'}`).getTime();
      const bTime = new Date(b.bookingStartAt || `${b.date || ''}T${b.time || '00:00'}`).getTime();
      return aTime - bTime;
    });
    return rows;
  }, [events]);

  const orgOptions = useMemo(() => {
    const base = (venueProfiles || []).map((venueProfile) => ({
      id: venueProfile.id,
      name: venueProfile.name || 'Untitled Venue',
    }));
    const fromEvents = sortedEvents
      .filter((row) => row.venueProfileId && row.venue)
      .map((row) => ({ id: row.venueProfileId, name: row.venue }));

    const map = new Map();
    [...base, ...fromEvents].forEach((row) => {
      if (row.id && !map.has(row.id)) map.set(row.id, row);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sortedEvents, venueProfiles]);

  const eventTypeOptions = useMemo(() => {
    if (eventTypes.length) return eventTypes;
    return DEFAULT_CALENDAR_EVENT_TYPES.map((row, index) => ({
      id: `default-type-${index + 1}`,
      typeKey: row.key,
      name: row.name,
      category: row.category,
      defaultDurationMinutes: row.durationMinutes,
      departmentTags: row.departmentTags || [],
      typicalRoles: row.typicalRoles || [],
    }));
  }, [eventTypes]);

  const eventTypeMap = useMemo(() => {
    const map = new Map();
    eventTypeOptions.forEach((row) => {
      map.set(row.typeKey || row.type_key, row);
    });
    return map;
  }, [eventTypeOptions]);

  const selectedEvent = useMemo(
    () => sortedEvents.find((row) => row.id === selectedEventId) || null,
    [selectedEventId, sortedEvents]
  );

  const selectedEntry = useMemo(
    () => entries.find((row) => row.id === selectedEntryId) || null,
    [entries, selectedEntryId]
  );

  const departmentTags = useMemo(() => {
    const tags = new Set();
    eventTypeOptions.forEach((row) => {
      (row.departmentTags || []).forEach((tag) => {
        if (tag) tags.add(tag);
      });
    });
    entries.forEach((row) => {
      (row.departmentTags || []).forEach((tag) => {
        if (tag) tags.add(tag);
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [entries, eventTypeOptions]);

  const filteredEntries = useMemo(() => {
    let rows = [...entries];
    if (typeFilter) rows = rows.filter((row) => row.typeKey === typeFilter);
    if (statusFilter) rows = rows.filter((row) => row.status === statusFilter);
    if (selectedEventId) rows = rows.filter((row) => row.eventId === selectedEventId);
    if (selectedOrgId) rows = rows.filter((row) => row.orgId === selectedOrgId);
    if (departmentFilter) {
      rows = rows.filter((row) => (row.departmentTags || []).includes(departmentFilter));
    }
    rows.sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime());
    return filterEntriesByView(rows, { viewMode, anchorDate, timezone: 'America/Chicago' });
  }, [anchorDate, departmentFilter, entries, selectedEventId, selectedOrgId, statusFilter, typeFilter, viewMode]);

  const groupedEntries = useMemo(() => {
    const groups = new Map();
    filteredEntries.forEach((row) => {
      const dateKey = row.startDatetime ? new Date(row.startDatetime).toISOString().slice(0, 10) : 'unknown';
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(row);
    });
    return Array.from(groups.entries()).map(([dateKey, rows]) => ({
      dateKey,
      label: formatDateHeading(dateKey),
      rows,
    }));
  }, [filteredEntries]);

  const refreshGoogleConnection = useCallback(async (orgId = '') => {
    const connection = await getGoogleCalendarConnectionStatus({ orgId: orgId || undefined });
    setGoogleConnection(connection || null);

    const nextAutoSyncTypes = Array.isArray(connection?.auto_sync_types)
      ? connection.auto_sync_types
      : ['performance', 'tech_rehearsal', 'soundcheck', 'load_in', 'load_out'];

    setGoogleSettings((prev) => ({
      ...prev,
      defaultCalendarId: connection?.default_calendar_id || prev.defaultCalendarId || 'primary',
      syncEnabled: connection?.sync_enabled !== false,
      autoSyncTypes: nextAutoSyncTypes,
    }));

    if (connection?.status === 'connected') {
      const calendars = await listGoogleCalendarsForOrg({ orgId: orgId || undefined });
      setGoogleCalendars(Array.isArray(calendars) ? calendars : []);
    } else {
      setGoogleCalendars([]);
    }
  }, [getGoogleCalendarConnectionStatus, listGoogleCalendarsForOrg]);

  const refreshCalendarData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [types, rows] = await Promise.all([
        listCalendarEventTypes({ orgId: selectedOrgId || undefined }),
        listRehearsalCalendarEntries({
          eventId: selectedEventId || undefined,
          orgId: selectedOrgId || undefined,
        }),
      ]);

      setEventTypes(Array.isArray(types) ? types : []);
      setEntries(Array.isArray(rows) ? rows : []);
      await refreshGoogleConnection(selectedOrgId);
    } catch (err) {
      setError(err.message || 'I hit a snag loading the production calendar data.');
    } finally {
      setLoading(false);
    }
  }, [listCalendarEventTypes, listRehearsalCalendarEntries, refreshGoogleConnection, selectedEventId, selectedOrgId]);

  useEffect(() => {
    refreshCalendarData();
  }, [refreshCalendarData]);

  useEffect(() => {
    if (oauthHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    oauthHandledRef.current = true;

    const state = params.get('state') || '';
    const callbackOrgId = params.get('orgId') || selectedOrgId || '';

    (async () => {
      try {
        setSyncing(true);
        await connectGoogleCalendarAccount({
          code,
          state,
          orgId: callbackOrgId || undefined,
          redirectUri: `${window.location.origin}/production-calendar${callbackOrgId ? `?orgId=${encodeURIComponent(callbackOrgId)}` : ''}`,
        });
        setNotice('Google Calendar connected. You can pick calendars and sync rules below.');
        await refreshGoogleConnection(callbackOrgId);
      } catch (err) {
        setError(err.message || 'Google Calendar connection did not finish.');
      } finally {
        setSyncing(false);
        params.delete('code');
        params.delete('state');
        const cleaned = params.toString();
        const nextUrl = `${window.location.pathname}${cleaned ? `?${cleaned}` : ''}`;
        window.history.replaceState({}, '', nextUrl);
      }
    })();
  }, [connectGoogleCalendarAccount, refreshGoogleConnection, selectedOrgId]);

  const resetEntryDraft = useCallback((typeKey = '') => {
    const inferredOrg = selectedOrgId || inferOrgIdFromEvent(selectedEvent) || '';
    const next = buildDraftFromType({
      typeKey: typeKey || typeFilter || 'performance',
      eventId: selectedEventId || '',
      orgId: inferredOrg,
      anchorDate,
    });
    if (selectedEvent?.venue) next.location = selectedEvent.venue;
    setSelectedEntryId('');
    setEntryDraft(next);
  }, [anchorDate, selectedEvent, selectedEventId, selectedOrgId, typeFilter]);

  const handleTypeChange = (typeKey) => {
    const template = eventTypeMap.get(typeKey) || getCalendarTypeTemplate(typeKey);
    setEntryDraft((prev) => {
      const next = { ...prev, typeKey };
      if (!prev.id) {
        next.typeName = template?.name || prev.typeName;
        if (!prev.title || prev.title === prev.typeName) {
          next.title = template?.name || prev.title;
        }
      }
      if (template?.departmentTags?.length && !prev.departmentTagsInput) {
        next.departmentTagsInput = listToCsv(template.departmentTags);
      }
      if (template?.typicalRoles?.length && !prev.assignedRolesInput) {
        next.assignedRolesInput = listToCsv(template.typicalRoles);
      }
      if (!prev.endInput && prev.startInput) {
        next.endInput = buildEndInput(prev.startInput, template?.defaultDurationMinutes || template?.durationMinutes || 120);
      }
      return next;
    });
  };

  const handleSaveEntry = async () => {
    if (!entryDraft.startInput || !entryDraft.endInput) {
      setError('Start and end date/time are required.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await saveRehearsalCalendarEntry({
        id: entryDraft.id || undefined,
        eventId: entryDraft.eventId || undefined,
        orgId: entryDraft.orgId || undefined,
        typeKey: entryDraft.typeKey || undefined,
        typeName: entryDraft.typeName || undefined,
        title: entryDraft.title || undefined,
        startDatetime: fromLocalDateTimeInput(entryDraft.startInput),
        endDatetime: fromLocalDateTimeInput(entryDraft.endInput),
        timezone: entryDraft.timezone || 'America/Chicago',
        location: entryDraft.location || '',
        status: entryDraft.status || 'draft',
        requiredAttendance: entryDraft.requiredAttendance || 'required',
        departmentTags: csvToList(entryDraft.departmentTagsInput),
        assignedRoles: csvToList(entryDraft.assignedRolesInput),
        reminderSettings: normalizeReminderCsv(entryDraft.reminderInput),
        description: entryDraft.description || '',
        internalNotes: entryDraft.internalNotes || '',
        shareableNotes: entryDraft.shareableNotes || '',
      }, {
        entryId: entryDraft.id || undefined,
        eventId: entryDraft.eventId || undefined,
        orgId: entryDraft.orgId || undefined,
        calendarId: googleSettings.defaultCalendarId || undefined,
        syncToGoogle: true,
      });

      if (response?.entry) {
        setSelectedEntryId(response.entry.id);
        setEntryDraft(mapEntryToDraft(response.entry));
      }

      await refreshCalendarData();
      setNotice(response?.warning || 'Calendar entry saved and synced.');
    } catch (err) {
      setError(err.message || 'I hit a snag saving that calendar entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!entryId) return;
    if (!window.confirm('Delete this calendar entry?')) return;
    try {
      await removeRehearsalCalendarEntry(entryId);
      if (selectedEntryId === entryId) {
        setSelectedEntryId('');
        resetEntryDraft(typeFilter || 'performance');
      }
      await refreshCalendarData();
      setNotice('Calendar entry removed.');
    } catch (err) {
      setError(err.message || 'I could not remove that calendar entry.');
    }
  };

  const handleSyncEntry = async (entry) => {
    if (!entry?.id) return;
    try {
      setSyncing(true);
      const result = await syncCalendarEntryRecord(entry.id, {
        orgId: entry.orgId || selectedOrgId || undefined,
        calendarId: googleSettings.defaultCalendarId || undefined,
      });
      setNotice(result?.warning || `Synced to Google Calendar (${result?.googleCalendarId || googleSettings.defaultCalendarId || 'primary'}).`);
      await refreshCalendarData();
    } catch (err) {
      setError(err.message || 'I could not sync that entry to Google Calendar.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!selectedEntryId) {
      setError('Select a calendar entry before adding assignments.');
      return;
    }
    if (!assignmentDraft.assigneeName.trim()) {
      setError('Assignee name is required.');
      return;
    }
    try {
      await saveCalendarEntryAssignment(selectedEntryId, {
        assigneeName: assignmentDraft.assigneeName,
        assigneeRole: assignmentDraft.assigneeRole,
        assigneeType: assignmentDraft.assigneeType,
        attendanceRequired: assignmentDraft.attendanceRequired,
        rsvpStatus: assignmentDraft.rsvpStatus,
      });
      setAssignmentDraft({
        assigneeName: '',
        assigneeRole: '',
        assigneeType: 'user',
        attendanceRequired: true,
        rsvpStatus: 'pending',
      });
      await refreshCalendarData();
      setNotice('Assignment saved. Notification queue updated.');
    } catch (err) {
      setError(err.message || 'I could not save that assignment.');
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!assignmentId) return;
    try {
      await removeCalendarEntryAssignment(assignmentId);
      await refreshCalendarData();
      setNotice('Assignment removed.');
    } catch (err) {
      setError(err.message || 'I could not remove that assignment.');
    }
  };

  const handleStartGoogleConnect = async () => {
    try {
      setSyncing(true);
      const redirectUri = `${window.location.origin}/production-calendar${selectedOrgId ? `?orgId=${encodeURIComponent(selectedOrgId)}` : ''}`;
      const response = await getGoogleCalendarAuthUrl({
        orgId: selectedOrgId || undefined,
        redirectUri,
      });
      if (!response?.authUrl) throw new Error('Google auth URL was not returned.');
      window.location.assign(response.authUrl);
    } catch (err) {
      setSyncing(false);
      setError(err.message || 'Google Calendar connect flow did not start.');
    }
  };

  const handleCreateGoogleCalendar = async () => {
    const summary = newCalendarName.trim();
    if (!summary) {
      setError('Calendar name is required.');
      return;
    }
    try {
      setSyncing(true);
      const response = await createGoogleCalendarForOrg({
        summary,
        timeZone: 'America/Chicago',
        setAsDefault: true,
      }, {
        orgId: selectedOrgId || undefined,
      });
      setNewCalendarName('');
      setNotice(`Google calendar created: ${response?.calendar?.summary || summary}`);
      await refreshGoogleConnection(selectedOrgId);
      if (response?.calendar?.id) {
        setGoogleSettings((prev) => ({
          ...prev,
          defaultCalendarId: response.calendar.id,
        }));
      }
    } catch (err) {
      setError(err.message || 'I could not create that Google Calendar.');
    } finally {
      setSyncing(false);
    }
  };

  const toggleAutoSyncType = (typeKey) => {
    setGoogleSettings((prev) => {
      const nextSet = new Set(prev.autoSyncTypes || []);
      if (nextSet.has(typeKey)) {
        nextSet.delete(typeKey);
      } else {
        nextSet.add(typeKey);
      }
      return {
        ...prev,
        autoSyncTypes: Array.from(nextSet),
      };
    });
  };

  const handleSaveGoogleSettings = async () => {
    try {
      setSyncing(true);
      await connectGoogleCalendarAccount({
        orgId: selectedOrgId || undefined,
        defaultCalendarId: googleSettings.defaultCalendarId || 'primary',
        autoSyncTypes: googleSettings.autoSyncTypes,
        syncEnabled: googleSettings.syncEnabled,
      });
      setNotice('Google Calendar sync settings saved.');
      await refreshGoogleConnection(selectedOrgId);
    } catch (err) {
      setError(err.message || 'I could not save Google Calendar settings.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAllDatedItems = async () => {
    try {
      setSyncing(true);
      const result = await syncAllDatedItemsToCalendar({
        syncGoogle: true,
        calendarId: googleSettings.defaultCalendarId || undefined,
      });
      const scanned = result?.scanned || {};
      setNotice(
        `Synced dated items. Events: ${scanned.events || 0}, Training: ${scanned.trainingSessions || 0}, Staffing: ${scanned.staffAssignments || 0}, Google synced: ${result?.syncedCount || 0}.`
      );
      await refreshCalendarData();
    } catch (err) {
      setError(err.message || 'I could not sync all dated items to Google Calendar.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="mb-4">
        <h1 className="text-3xl font-semibold">Rehearsal & Production Calendar</h1>
        <p className="text-gray-600 mt-2">
          Schedule rehearsals, calls, tech milestones, and operations in one place, then keep Google Calendar in sync for the whole team.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold mb-3">Calendar Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs font-medium text-gray-700">
              View
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
              >
                {CALENDAR_VIEW_MODES.map((mode) => (
                  <option key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-gray-700">
              Anchor Date
              <input
                type="date"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
            </label>

            <label className="text-xs font-medium text-gray-700">
              Status
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-gray-700">
              Event
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                value={selectedEventId}
                onChange={(e) => {
                  const nextEventId = e.target.value;
                  setSelectedEventId(nextEventId);
                  const eventMatch = sortedEvents.find((row) => row.id === nextEventId);
                  if (eventMatch?.venueProfileId) {
                    setSelectedOrgId(eventMatch.venueProfileId);
                  }
                }}
              >
                <option value="">All events</option>
                {sortedEvents.map((eventRow) => (
                  <option key={eventRow.id} value={eventRow.id}>
                    {eventRow.title || 'Untitled Event'}{eventRow.date ? ` · ${eventRow.date}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-gray-700">
              Organization / Venue
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
              >
                <option value="">All org calendars</option>
                {orgOptions.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-gray-700">
              Type
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All types</option>
                {eventTypeOptions.map((typeRow) => (
                  <option key={typeRow.id || typeRow.typeKey} value={typeRow.typeKey}>{typeRow.name}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-gray-700 md:col-span-3">
              Department Tag
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">All departments</option>
                {departmentTags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Google Calendar Sync</h2>
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              Status:{' '}
              <span className={`font-semibold ${googleConnection?.status === 'connected' ? 'text-green-700' : 'text-amber-700'}`}>
                {googleConnection?.status === 'connected' ? 'Connected' : 'Not Connected'}
              </span>
            </p>
            {googleConnection?.account_email && (
              <p>Account: <span className="font-medium">{googleConnection.account_email}</span></p>
            )}
            <button
              type="button"
              onClick={handleStartGoogleConnect}
              className="w-full rounded bg-[#0d1b2a] text-white px-3 py-2 text-sm"
              disabled={syncing}
            >
              {syncing ? 'Connecting…' : 'Connect Google Calendar'}
            </button>
            <button
              type="button"
              onClick={handleSyncAllDatedItems}
              className="w-full rounded border border-[#0d1b2a] text-[#0d1b2a] px-3 py-2 text-sm"
              disabled={syncing}
            >
              {syncing ? 'Syncing…' : 'Sync All Dated Items'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">Calendar Entries</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                onClick={() => resetEntryDraft(typeFilter || 'performance')}
              >
                New Entry
              </button>
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                onClick={refreshCalendarData}
                disabled={loading}
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading calendar entries…</p>
          ) : groupedEntries.length === 0 ? (
            <p className="text-sm text-gray-500">No entries match the current filters.</p>
          ) : (
            <div className="space-y-4">
              {groupedEntries.map((group) => (
                <div key={group.dateKey}>
                  <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-2">{group.label}</h3>
                  <div className="space-y-2">
                    {group.rows.map((entry) => {
                      const typeName = eventTypeMap.get(entry.typeKey)?.name || entry.typeName || 'Production Call';
                      const isActive = selectedEntryId === entry.id;
                      return (
                        <div
                          key={entry.id}
                          className={`rounded border p-3 ${isActive ? 'border-[#c8a45e] bg-[#fff9eb]' : 'border-gray-200 bg-white'}`}
                        >
                          <div className="flex justify-between gap-3 flex-wrap">
                            <div>
                              <p className="font-semibold text-sm m-0">{entry.title || typeName}</p>
                              <p className="text-xs text-gray-500 m-0 mt-1">
                                {typeName} · {formatDateTimeLabel(entry.startDatetime)} → {formatDateTimeLabel(entry.endDatetime)}
                              </p>
                              <p className="text-xs text-gray-500 m-0 mt-1">
                                {entry.location || 'Location TBD'}
                                {entry.eventId ? ' · Event linked' : ''}
                              </p>
                              <p className="text-xs text-gray-500 m-0 mt-1">
                                Dept: {(entry.departmentTags || []).join(', ') || 'None'}
                              </p>
                            </div>
                            <div className="text-xs text-right text-gray-600">
                              <p className="m-0">Status: <span className="font-medium">{entry.status || 'draft'}</span></p>
                              <p className="m-0">Assignments: {(entry.assignments || []).length}</p>
                              <p className="m-0">Required: {entry.requiredAttendance || 'required'}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mt-3">
                            <button
                              type="button"
                              className="rounded border border-gray-300 px-2 py-1 text-xs"
                              onClick={() => {
                                setSelectedEntryId(entry.id);
                                setEntryDraft(mapEntryToDraft(entry));
                                setNotice('');
                                setError('');
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="rounded border border-gray-300 px-2 py-1 text-xs"
                              onClick={() => handleSyncEntry(entry)}
                              disabled={syncing}
                            >
                              Sync to Google
                            </button>
                            {entry.eventId && (
                              <Link
                                to={`/events/${entry.eventId}`}
                                className="rounded border border-gray-300 px-2 py-1 text-xs text-[#0d1b2a] no-underline"
                              >
                                Open Event
                              </Link>
                            )}
                            <button
                              type="button"
                              className="rounded border border-red-300 text-red-700 px-2 py-1 text-xs"
                              onClick={() => handleDeleteEntry(entry.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Entry Editor</h2>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-700">
              Type
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                value={entryDraft.typeKey}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                {eventTypeOptions.map((typeRow) => (
                  <option key={typeRow.id || typeRow.typeKey} value={typeRow.typeKey}>{typeRow.name}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Title
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={entryDraft.title}
                onChange={(e) => setEntryDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Cue-to-Cue · Hamlet"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Event Link
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                value={entryDraft.eventId}
                onChange={(e) => {
                  const nextEventId = e.target.value;
                  const eventMatch = sortedEvents.find((row) => row.id === nextEventId) || null;
                  setEntryDraft((prev) => ({
                    ...prev,
                    eventId: nextEventId,
                    orgId: eventMatch?.venueProfileId || prev.orgId,
                    location: prev.location || eventMatch?.venue || '',
                  }));
                }}
              >
                <option value="">No event link</option>
                {sortedEvents.map((eventRow) => (
                  <option key={eventRow.id} value={eventRow.id}>
                    {eventRow.title || 'Untitled Event'}{eventRow.date ? ` · ${eventRow.date}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-gray-700">
                Start
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={entryDraft.startInput}
                  onChange={(e) => setEntryDraft((prev) => ({ ...prev, startInput: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                End
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={entryDraft.endInput}
                  onChange={(e) => setEntryDraft((prev) => ({ ...prev, endInput: e.target.value }))}
                />
              </label>
            </div>

            <label className="block text-xs font-medium text-gray-700">
              Location
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={entryDraft.location}
                onChange={(e) => setEntryDraft((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Venue, room, stage, or address"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-gray-700">
                Status
                <select
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                  value={entryDraft.status}
                  onChange={(e) => setEntryDraft((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Attendance
                <select
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                  value={entryDraft.requiredAttendance}
                  onChange={(e) => setEntryDraft((prev) => ({ ...prev, requiredAttendance: e.target.value }))}
                >
                  {ATTENDANCE_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-xs font-medium text-gray-700">
              Department Tags (comma separated)
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={entryDraft.departmentTagsInput}
                onChange={(e) => setEntryDraft((prev) => ({ ...prev, departmentTagsInput: e.target.value }))}
                placeholder="SM, LX, SND"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Assigned Roles (comma separated)
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={entryDraft.assignedRolesInput}
                onChange={(e) => setEntryDraft((prev) => ({ ...prev, assignedRolesInput: e.target.value }))}
                placeholder="Stage Manager, A1, Deck Crew"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Reminder Minutes (comma separated)
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={entryDraft.reminderInput}
                onChange={(e) => setEntryDraft((prev) => ({ ...prev, reminderInput: e.target.value }))}
                placeholder="1440, 120, 30"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Description
              <textarea
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
                value={entryDraft.description}
                onChange={(e) => setEntryDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What this rehearsal/call covers"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Internal Notes
              <textarea
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm min-h-[60px]"
                value={entryDraft.internalNotes}
                onChange={(e) => setEntryDraft((prev) => ({ ...prev, internalNotes: e.target.value }))}
                placeholder="Visible to internal production team"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Shareable Notes
              <textarea
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm min-h-[60px]"
                value={entryDraft.shareableNotes}
                onChange={(e) => setEntryDraft((prev) => ({ ...prev, shareableNotes: e.target.value }))}
                placeholder="Visible in external shared invites"
              />
            </label>

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSaveEntry}
                disabled={saving}
                className="rounded bg-[#0d1b2a] text-white px-3 py-2 text-sm"
              >
                {saving ? 'Saving…' : entryDraft.id ? 'Save Changes' : 'Create Entry'}
              </button>
              <button
                type="button"
                onClick={() => resetEntryDraft(typeFilter || entryDraft.typeKey || 'performance')}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                Reset Draft
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <h2 className="text-lg font-semibold mb-3">Assignments & Notifications</h2>
          {!selectedEntry ? (
            <p className="text-sm text-gray-600">Select an entry to manage call assignments and reminders.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded border border-gray-200 p-3 bg-gray-50">
                <p className="font-semibold text-sm m-0">{selectedEntry.title || selectedEntry.typeName || 'Selected Entry'}</p>
                <p className="text-xs text-gray-500 m-0 mt-1">
                  {formatDateTimeLabel(selectedEntry.startDatetime)} → {formatDateTimeLabel(selectedEntry.endDatetime)}
                </p>
              </div>

              <div className="space-y-2">
                {(selectedEntry.assignments || []).length === 0 ? (
                  <p className="text-sm text-gray-600">No assignments yet.</p>
                ) : (
                  selectedEntry.assignments.map((assignment) => (
                    <div key={assignment.id} className="rounded border border-gray-200 p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="m-0 text-sm font-medium">{assignment.assigneeName || 'Unnamed Assignee'}</p>
                        <p className="m-0 text-xs text-gray-500">
                          {assignment.assigneeRole || assignment.assigneeType || 'Role TBD'} · RSVP: {assignment.rsvpStatus || 'pending'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        className="rounded border border-red-300 text-red-700 px-2 py-1 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded border border-gray-200 p-3">
                <p className="text-sm font-semibold mb-2">Add Assignment</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Assignee name"
                    value={assignmentDraft.assigneeName}
                    onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, assigneeName: e.target.value }))}
                  />
                  <input
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Role (A1, ASM, Security Lead)"
                    value={assignmentDraft.assigneeRole}
                    onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, assigneeRole: e.target.value }))}
                  />
                  <select
                    className="rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                    value={assignmentDraft.assigneeType}
                    onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, assigneeType: e.target.value }))}
                  >
                    {ASSIGNEE_TYPES.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                  <select
                    className="rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                    value={assignmentDraft.rsvpStatus}
                    onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, rsvpStatus: e.target.value }))}
                  >
                    <option value="pending">pending</option>
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                    <option value="maybe">maybe</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                  <input
                    type="checkbox"
                    checked={assignmentDraft.attendanceRequired}
                    onChange={(e) => setAssignmentDraft((prev) => ({ ...prev, attendanceRequired: e.target.checked }))}
                  />
                  Required attendance
                </label>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  className="mt-3 rounded bg-[#0d1b2a] text-white px-3 py-2 text-sm"
                >
                  Save Assignment
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Google Calendar Wizard</h2>
          <div className="space-y-3 text-sm">
            <label className="block text-xs font-medium text-gray-700">
              Default Google Calendar
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
                value={googleSettings.defaultCalendarId}
                onChange={(e) => setGoogleSettings((prev) => ({ ...prev, defaultCalendarId: e.target.value }))}
              >
                <option value="primary">primary</option>
                {googleCalendars.map((calendarRow) => (
                  <option key={calendarRow.id} value={calendarRow.id}>{calendarRow.summary || calendarRow.id}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={googleSettings.syncEnabled}
                onChange={(e) => setGoogleSettings((prev) => ({ ...prev, syncEnabled: e.target.checked }))}
              />
              Sync enabled for this connection
            </label>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Auto-sync event types</p>
              <div className="max-h-40 overflow-auto rounded border border-gray-200 p-2 space-y-1">
                {eventTypeOptions.map((typeRow) => {
                  const key = typeRow.typeKey;
                  const checked = (googleSettings.autoSyncTypes || []).includes(key);
                  return (
                    <label key={key} className="flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAutoSyncType(key)}
                      />
                      {typeRow.name}
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveGoogleSettings}
              className="w-full rounded border border-[#0d1b2a] text-[#0d1b2a] px-3 py-2 text-sm"
              disabled={syncing}
            >
              Save Google Sync Settings
            </button>

            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs font-medium text-gray-700 mb-1">Create org Google calendar</p>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
                placeholder="Example: Midtown MeetUp Production"
              />
              <button
                type="button"
                onClick={handleCreateGoogleCalendar}
                className="mt-2 w-full rounded bg-[#0d1b2a] text-white px-3 py-2 text-sm"
                disabled={syncing}
              >
                Create Google Calendar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
