import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { parseLocalDate } from '../lib/dateUtils';

const FOCUS_SECTIONS = ['staffing', 'event_ops', 'inventory', 'training', 'certifications'];

const TRAINING_CATEGORY_OPTIONS = [
  'software',
  'audio',
  'lighting',
  'safety',
  'foh',
  'operations',
  'other',
];

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sectionClasses(key, focusKey) {
  return `card scroll-mt-24 ${focusKey === key ? 'ring-2 ring-[#c8a45e]' : ''}`;
}

function formatEventDate(event = {}) {
  const raw = event?.bookingStartAt || (event?.date ? `${event.date}T${event.time || '19:00'}` : event?.date);
  const parsed = raw ? new Date(raw) : parseLocalDate(event?.date);
  if (!parsed || Number.isNaN(parsed.getTime())) return 'Date TBD';
  return parsed.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function blankCostumeCharacterDraft() {
  return {
    characterName: '',
    performerName: '',
    costumeLocation: '',
    costumeItems: '',
    quickChangeNotes: '',
  };
}

function blankSetElementDraft() {
  return {
    elementName: '',
    category: 'scenery',
    buildStatus: 'planned',
    storageLocation: '',
    safetyNotes: '',
  };
}

function blankParkingAssignmentDraft() {
  return {
    personOrGroup: '',
    vehiclePlate: '',
    arrivalTime: '',
    notes: '',
  };
}

function blankDressingRoomDraft() {
  return {
    roomNameOrNumber: '',
    capacity: '',
    locationNotes: '',
    amenities: '',
  };
}

function blankDressingAssignmentDraft() {
  return {
    dressingRoomId: '',
    assignedTo: '',
    accessInstructions: '',
    keyCodeOrBadgeNotes: '',
    notes: '',
  };
}

function isMissingSchemaEntityError(error) {
  const message = String(error?.message || error || '');
  return /could not find the table .* in the schema cache/i.test(message)
    || /relation .+ does not exist/i.test(message)
    || /column .+ does not exist/i.test(message);
}

function fulfilledValue(result, fallback) {
  return result?.status === 'fulfilled' ? (result.value ?? fallback) : fallback;
}

function collectRejectedReasons(results = []) {
  return results
    .filter(item => item?.status === 'rejected')
    .map(item => item.reason)
    .filter(Boolean);
}

export default function ProductionOpsHub() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const queryFocus = searchParams.get('focus');
  const pathFocus = location.pathname.endsWith('/staffing')
    ? 'staffing'
    : location.pathname.endsWith('/event-ops')
      ? 'event_ops'
      : location.pathname.endsWith('/inventory')
        ? 'inventory'
        : location.pathname.endsWith('/training')
          ? 'training'
          : location.pathname.endsWith('/certifications')
            ? 'certifications'
            : '';
  const focus = FOCUS_SECTIONS.includes(queryFocus) ? queryFocus : pathFocus;

  const {
    events,
    venueProfiles,
    listTrainingCourses,
    saveTrainingCourse,
    listTrainingSessions,
    saveTrainingSession,
    sendTrainingReminderBatch,
    listStaffProfiles,
    listCertificationTypes,
    seedCertificationLibrary,
    listStaffCertifications,
    saveStaffCertification,
    sendCertificationReminderBatch,
    getCostumePlan,
    saveCostumePlan,
    saveCostumeCharacter,
    removeCostumeCharacter,
    getSetPlan,
    saveSetPlan,
    saveSetElement,
    removeSetElement,
    getParkingPlan,
    saveParkingPlan,
    saveParkingAssignment,
    removeParkingAssignment,
    listDressingRooms,
    saveDressingRoom,
    removeDressingRoom,
    listDressingRoomAssignments,
    saveDressingRoomAssignment,
    removeDressingRoomAssignment,
  } = useVenue();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const [trainingCourses, setTrainingCourses] = useState([]);
  const [trainingSessions, setTrainingSessions] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [certificationTypes, setCertificationTypes] = useState([]);
  const [staffCertifications, setStaffCertifications] = useState([]);

  const [courseForm, setCourseForm] = useState({
    title: '',
    category: 'operations',
    durationMinutes: '',
    description: '',
  });

  const [sessionForm, setSessionForm] = useState({
    trainingCourseId: '',
    sessionType: 'workshop',
    startDatetime: '',
    endDatetime: '',
    locationNotes: '',
    notes: '',
  });

  const [certificationForm, setCertificationForm] = useState({
    staffProfileId: '',
    certificationTypeId: '',
    issuedAt: '',
    expiresAt: '',
    notes: '',
  });

  const selectedVenueProfileId = useMemo(() => (
    venueProfiles?.[0]?.id || ''
  ), [venueProfiles]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...(events || [])]
      .filter((event) => {
        const start = new Date(event.bookingStartAt || `${event.date || ''}T${event.time || '00:00'}`);
        return !Number.isNaN(start.getTime()) && start >= now;
      })
      .sort((a, b) => {
        const aStart = new Date(a.bookingStartAt || `${a.date || ''}T${a.time || '00:00'}`).getTime();
        const bStart = new Date(b.bookingStartAt || `${b.date || ''}T${b.time || '00:00'}`).getTime();
        return aStart - bStart;
      })
      .slice(0, 20);
  }, [events]);

  const [selectedEventId, setSelectedEventId] = useState('');
  const selectedEvent = useMemo(() => (
    (events || []).find((event) => event.id === selectedEventId) || null
  ), [events, selectedEventId]);
  const selectedEventVenueProfileId = selectedEvent?.venueProfileId || selectedVenueProfileId;

  const [costumePlan, setCostumePlan] = useState(null);
  const [costumeCharacters, setCostumeCharacters] = useState([]);
  const [setPlan, setSetPlan] = useState(null);
  const [setElements, setSetElements] = useState([]);
  const [parkingPlan, setParkingPlan] = useState(null);
  const [parkingAssignments, setParkingAssignments] = useState([]);
  const [dressingRooms, setDressingRooms] = useState([]);
  const [dressingAssignments, setDressingAssignments] = useState([]);

  const [costumeDrafts, setCostumeDrafts] = useState([blankCostumeCharacterDraft()]);
  const [setElementDrafts, setSetElementDrafts] = useState([blankSetElementDraft()]);
  const [parkingAssignmentDrafts, setParkingAssignmentDrafts] = useState([blankParkingAssignmentDraft()]);
  const [dressingRoomDrafts, setDressingRoomDrafts] = useState([blankDressingRoomDraft()]);
  const [dressingAssignmentDrafts, setDressingAssignmentDrafts] = useState([blankDressingAssignmentDraft()]);

  const expiringCertifications = useMemo(() => (
    (staffCertifications || []).filter((cert) => ['expiring_soon', 'expired'].includes(String(cert.status || '')))
  ), [staffCertifications]);

  useEffect(() => {
    if (!selectedEventId && upcomingEvents[0]?.id) {
      setSelectedEventId(upcomingEvents[0].id);
    }
  }, [selectedEventId, upcomingEvents]);

  const loadGlobalData = async () => {
    const results = await Promise.allSettled([
        listTrainingCourses({ venueProfileId: selectedVenueProfileId || undefined, activeOnly: false }),
        listTrainingSessions({}),
        listStaffProfiles({ activeOnly: false }),
        listCertificationTypes({ activeOnly: false }),
        listStaffCertifications({ thresholdDays: 30 }),
      ]);

    const [coursesRes, sessionsRes, staffRes, certTypesRes, certsRes] = results;
    const courses = fulfilledValue(coursesRes, []);
    const sessions = fulfilledValue(sessionsRes, []);
    const staff = fulfilledValue(staffRes, []);
    const certTypes = fulfilledValue(certTypesRes, []);
    const certs = fulfilledValue(certsRes, []);
    setTrainingCourses(courses || []);
    setTrainingSessions(sessions || []);
    setStaffProfiles(staff || []);
    setCertificationTypes(certTypes || []);
    setStaffCertifications(certs || []);
    if (!sessionForm.trainingCourseId && courses?.[0]?.id) {
        setSessionForm((prev) => ({ ...prev, trainingCourseId: courses[0].id }));
    }
    if (!certificationForm.staffProfileId && staff?.[0]?.id) {
        setCertificationForm((prev) => ({ ...prev, staffProfileId: staff[0].id }));
    }
    if (!certificationForm.certificationTypeId && certTypes?.[0]?.id) {
        setCertificationForm((prev) => ({ ...prev, certificationTypeId: certTypes[0].id }));
    }

    const rejections = collectRejectedReasons(results);
    if (rejections.length) {
      const allMissingSchema = rejections.every(isMissingSchemaEntityError);
      if (allMissingSchema) {
        setStatus('Some production modules are not active yet because database tables are missing. Run the latest Supabase schema and refresh.');
      } else {
        setStatus(`I loaded what I could, but hit a snag in ${rejections.length} module${rejections.length === 1 ? '' : 's'}.`);
      }
    }
  };

  const loadEventOpsData = async (eventId, venueProfileId) => {
    if (!eventId) {
      setCostumePlan(null);
      setCostumeCharacters([]);
      setSetPlan(null);
      setSetElements([]);
      setParkingPlan(null);
      setParkingAssignments([]);
      setDressingAssignments([]);
      return;
    }

    const results = await Promise.allSettled([
        getCostumePlan(eventId),
        getSetPlan(eventId),
        getParkingPlan(eventId),
        listDressingRoomAssignments(eventId),
        venueProfileId ? listDressingRooms(venueProfileId) : Promise.resolve([]),
      ]);
    const [costumeRes, setRes, parkingRes, assignmentsRes, roomsRes] = results;
    const costume = fulfilledValue(costumeRes, null);
    const setData = fulfilledValue(setRes, null);
    const parking = fulfilledValue(parkingRes, null);
    const assignments = fulfilledValue(assignmentsRes, []);
    const rooms = fulfilledValue(roomsRes, []);

    setCostumePlan(costume?.plan || null);
    setCostumeCharacters(costume?.characters || []);
    setSetPlan(setData?.plan || null);
    setSetElements(setData?.elements || []);
    setParkingPlan(parking?.plan || null);
    setParkingAssignments(parking?.assignments || []);
    setDressingAssignments(assignments || []);
    setDressingRooms(rooms || []);
    if ((rooms || []).length && !dressingAssignmentDrafts[0]?.dressingRoomId) {
      setDressingAssignmentDrafts((prev) => {
        const next = [...prev];
        next[0] = { ...next[0], dressingRoomId: rooms[0].id };
        return next;
      });
    }

    const rejections = collectRejectedReasons(results);
    if (rejections.length) {
      const allMissingSchema = rejections.every(isMissingSchemaEntityError);
      if (allMissingSchema) {
        setStatus('Some event operations modules are not active yet because database tables are missing. Run the latest Supabase schema and refresh.');
      } else {
        setStatus(`I loaded the event operations data I could, but hit a snag in ${rejections.length} module${rejections.length === 1 ? '' : 's'}.`);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      setLoading(true);
      setStatus('');
      await loadGlobalData();
      if (mounted) setLoading(false);
    };
    boot();
    return () => {
      mounted = false;
    };
  }, [selectedVenueProfileId]);

  useEffect(() => {
    loadEventOpsData(selectedEventId, selectedEventVenueProfileId);
  }, [selectedEventId, selectedEventVenueProfileId]);

  useEffect(() => {
    if (!focus) return;
    const target = document.getElementById(focus);
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [focus]);

  const refreshEventOps = async () => {
    await loadEventOpsData(selectedEventId, selectedEventVenueProfileId);
  };

  const handleSaveCourse = async () => {
    if (!courseForm.title.trim()) {
      setStatus('Training course title is required.');
      return;
    }
    try {
      setStatus('Saving training course...');
      await saveTrainingCourse(
        {
          title: courseForm.title.trim(),
          category: courseForm.category,
          durationMinutes: courseForm.durationMinutes ? Number(courseForm.durationMinutes) : null,
          description: courseForm.description,
          isActive: true,
        },
        { venueProfileId: selectedVenueProfileId || undefined },
      );
      setCourseForm({ title: '', category: 'operations', durationMinutes: '', description: '' });
      await loadGlobalData();
      setStatus('Training course saved.');
    } catch (err) {
      setStatus(`I hit a snag saving that training course: ${err.message}`);
    }
  };

  const handleSaveSession = async () => {
    if (!sessionForm.trainingCourseId) {
      setStatus('Pick a course first, then I can schedule the session.');
      return;
    }
    if (!sessionForm.startDatetime) {
      setStatus('Session start date/time is required.');
      return;
    }
    try {
      setStatus('Saving training session...');
      await saveTrainingSession(
        {
          trainingCourseId: sessionForm.trainingCourseId,
          venueId: selectedVenueProfileId || null,
          sessionType: sessionForm.sessionType,
          startDatetime: toIsoOrNull(sessionForm.startDatetime),
          endDatetime: toIsoOrNull(sessionForm.endDatetime),
          locationNotes: sessionForm.locationNotes,
          notes: sessionForm.notes,
        },
        { courseId: sessionForm.trainingCourseId },
      );
      setSessionForm((prev) => ({
        ...prev,
        sessionType: 'workshop',
        startDatetime: '',
        endDatetime: '',
        locationNotes: '',
        notes: '',
      }));
      await loadGlobalData();
      setStatus('Training session saved.');
    } catch (err) {
      setStatus(`I hit a snag saving that training session: ${err.message}`);
    }
  };

  const handleSeedCertificationTypes = async () => {
    try {
      setStatus('Seeding certification library...');
      await seedCertificationLibrary();
      await loadGlobalData();
      setStatus('Certification library seeded.');
    } catch (err) {
      setStatus(`I hit a snag loading the certification library: ${err.message}`);
    }
  };

  const handleSaveCertification = async () => {
    if (!certificationForm.staffProfileId || !certificationForm.certificationTypeId) {
      setStatus('Pick a staff member and certification type, then I can save it.');
      return;
    }
    try {
      setStatus('Saving staff certification...');
      await saveStaffCertification({
        staffProfileId: certificationForm.staffProfileId,
        certificationTypeId: certificationForm.certificationTypeId,
        issuedAt: toIsoOrNull(certificationForm.issuedAt),
        expiresAt: toIsoOrNull(certificationForm.expiresAt),
        notes: certificationForm.notes,
      });
      setCertificationForm((prev) => ({
        ...prev,
        issuedAt: '',
        expiresAt: '',
        notes: '',
      }));
      await loadGlobalData();
      setStatus('Staff certification saved.');
    } catch (err) {
      setStatus(`I hit a snag saving that staff certification: ${err.message}`);
    }
  };

  const handleSendTrainingReminders = async () => {
    try {
      setStatus('Sending training reminders...');
      const result = await sendTrainingReminderBatch({ withinHours: 72 });
      setStatus(`Training reminders sent: ${result?.sent || 0}/${result?.total || 0}.`);
    } catch (err) {
      setStatus(`Training reminders failed: ${err.message}`);
    }
  };

  const handleSendCertificationReminders = async () => {
    try {
      setStatus('Sending certification reminders...');
      const result = await sendCertificationReminderBatch({ thresholdDays: 30 });
      setStatus(`Certification reminders sent: ${result?.sent || 0}/${result?.total || 0}.`);
    } catch (err) {
      setStatus(`Certification reminders failed: ${err.message}`);
    }
  };

  const saveCostumeNotes = async () => {
    if (!selectedEventId) return;
    try {
      setStatus('Saving costume plan notes...');
      await saveCostumePlan(selectedEventId, { notes: costumePlan?.notes || '' });
      await refreshEventOps();
      setStatus('Costume plan updated.');
    } catch (err) {
      setStatus(`I hit a snag saving costume plan notes: ${err.message}`);
    }
  };

  const saveSetNotes = async () => {
    if (!selectedEventId) return;
    try {
      setStatus('Saving set/scenery notes...');
      await saveSetPlan(selectedEventId, { notes: setPlan?.notes || '' });
      await refreshEventOps();
      setStatus('Set plan updated.');
    } catch (err) {
      setStatus(`I hit a snag saving set plan notes: ${err.message}`);
    }
  };

  const saveParkingNotes = async () => {
    if (!selectedEventId) return;
    try {
      setStatus('Saving parking notes...');
      await saveParkingPlan(selectedEventId, {
        venueParkingNotes: parkingPlan?.venue_parking_notes || '',
        loadingZoneNotes: parkingPlan?.loading_zone_notes || '',
      });
      await refreshEventOps();
      setStatus('Parking plan updated.');
    } catch (err) {
      setStatus(`I hit a snag saving parking plan notes: ${err.message}`);
    }
  };

  const handleSaveCostumeDraft = async (index) => {
    const draft = costumeDrafts[index];
    if (!selectedEventId || !draft?.characterName?.trim()) {
      setStatus('Character name is required.');
      return;
    }
    try {
      setStatus('Saving costume character...');
      await saveCostumeCharacter(selectedEventId, {
        characterName: draft.characterName,
        performerName: draft.performerName,
        costumeLocation: draft.costumeLocation,
        quickChangeNotes: draft.quickChangeNotes,
        costumeList: draft.costumeItems.split(',').map((value) => value.trim()).filter(Boolean),
      });
      setCostumeDrafts((prev) => prev.filter((_item, i) => i !== index).concat(prev.length === 1 ? [blankCostumeCharacterDraft()] : []));
      await refreshEventOps();
      setStatus('Costume character saved.');
    } catch (err) {
      setStatus(`I hit a snag saving that costume character: ${err.message}`);
    }
  };

  const handleSaveSetElementDraft = async (index) => {
    const draft = setElementDrafts[index];
    if (!selectedEventId || !draft?.elementName?.trim()) {
      setStatus('Set element name is required.');
      return;
    }
    try {
      setStatus('Saving set element...');
      await saveSetElement(selectedEventId, {
        elementName: draft.elementName,
        category: draft.category,
        buildStatus: draft.buildStatus,
        storageLocation: draft.storageLocation,
        safetyNotes: draft.safetyNotes,
      });
      setSetElementDrafts((prev) => prev.filter((_item, i) => i !== index).concat(prev.length === 1 ? [blankSetElementDraft()] : []));
      await refreshEventOps();
      setStatus('Set element saved.');
    } catch (err) {
      setStatus(`I hit a snag saving that set element: ${err.message}`);
    }
  };

  const handleSaveParkingAssignmentDraft = async (index) => {
    const draft = parkingAssignmentDrafts[index];
    if (!selectedEventId || !draft?.personOrGroup?.trim()) {
      setStatus('Parking assignment person/group is required.');
      return;
    }
    try {
      setStatus('Saving parking assignment...');
      await saveParkingAssignment(selectedEventId, {
        personOrGroup: draft.personOrGroup,
        vehiclePlate: draft.vehiclePlate,
        arrivalTime: toIsoOrNull(draft.arrivalTime),
        notes: draft.notes,
      });
      setParkingAssignmentDrafts((prev) => prev.filter((_item, i) => i !== index).concat(prev.length === 1 ? [blankParkingAssignmentDraft()] : []));
      await refreshEventOps();
      setStatus('Parking assignment saved.');
    } catch (err) {
      setStatus(`I hit a snag saving that parking assignment: ${err.message}`);
    }
  };

  const handleSaveDressingRoomDraft = async (index) => {
    const draft = dressingRoomDrafts[index];
    if (!selectedEventVenueProfileId) {
      setStatus('This event needs a venue profile before dressing rooms can be added.');
      return;
    }
    if (!draft?.roomNameOrNumber?.trim()) {
      setStatus('Dressing room name/number is required.');
      return;
    }
    try {
      setStatus('Saving dressing room...');
      await saveDressingRoom(selectedEventVenueProfileId, {
        roomNameOrNumber: draft.roomNameOrNumber,
        capacity: draft.capacity ? Number(draft.capacity) : null,
        locationNotes: draft.locationNotes,
        amenities: draft.amenities.split(',').map((value) => value.trim()).filter(Boolean),
      });
      setDressingRoomDrafts((prev) => prev.filter((_item, i) => i !== index).concat(prev.length === 1 ? [blankDressingRoomDraft()] : []));
      await refreshEventOps();
      setStatus('Dressing room saved.');
    } catch (err) {
      setStatus(`I hit a snag saving that dressing room: ${err.message}`);
    }
  };

  const handleSaveDressingAssignmentDraft = async (index) => {
    const draft = dressingAssignmentDrafts[index];
    if (!selectedEventId || !draft?.dressingRoomId || !draft?.assignedTo?.trim()) {
      setStatus('Pick a room and assigned group/name first.');
      return;
    }
    try {
      setStatus('Saving dressing room assignment...');
      await saveDressingRoomAssignment(selectedEventId, {
        dressingRoomId: draft.dressingRoomId,
        assignedTo: draft.assignedTo,
        accessInstructions: draft.accessInstructions,
        keyCodeOrBadgeNotes: draft.keyCodeOrBadgeNotes,
        notes: draft.notes,
      });
      setDressingAssignmentDrafts((prev) => prev.filter((_item, i) => i !== index).concat(prev.length === 1 ? [blankDressingAssignmentDraft()] : []));
      await refreshEventOps();
      setStatus('Dressing room assignment saved.');
    } catch (err) {
      setStatus(`I hit a snag saving that dressing room assignment: ${err.message}`);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <h1 className="text-3xl mb-2">Production Ops Command</h1>
      <p className="text-gray-500 mb-6">
        One place for event ops, workforce planning, and venue-side execution.
      </p>

      {loading ? <p className="text-sm text-gray-500 mb-4">Loading your ops tools...</p> : null}
      {status ? <p className="text-sm text-gray-600 mb-4">{status}</p> : null}

      <div className="space-y-5">
        <section id="staffing" className={sectionClasses('staffing', focus)}>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h3 className="text-lg m-0">Staff Scheduling for Upcoming Shows</h3>
              <p className="text-xs text-gray-500 m-0 mt-1">Jump straight to the exact event workspace you need.</p>
            </div>
            <Link className="text-xs text-[#0d1b2a]" to="/production-calendar">Open Full Production Calendar →</Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-gray-500 m-0">No upcoming events yet. Add one and I will wire the rest.</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="border border-gray-200 rounded p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm m-0">{event.title || 'Untitled event'}</p>
                      <p className="text-xs text-gray-500 m-0 mt-1">
                        {formatEventDate(event)} · {event.venue || 'Venue TBD'}
                        {event.performanceZoneName ? ` · ${event.performanceZoneName}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap text-xs">
                      <Link to={`/events/${event.id}?opsTab=staffing`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Staffing</Link>
                      <Link to={`/events/${event.id}?opsTab=production`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Production</Link>
                      <Link to={`/events/${event.id}?opsTab=purchasing`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Purchasing</Link>
                      <Link to={`/events/${event.id}?opsTab=concessions`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Concessions</Link>
                      <Link to={`/events/${event.id}?opsTab=merch`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Merch</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="event_ops" className={sectionClasses('event_ops', focus)}>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div>
              <h3 className="text-lg m-0">Event Operations Modules</h3>
              <p className="text-xs text-gray-500 m-0 mt-1">Costumes, set/scenery, parking, dressing rooms, concessions, and merch.</p>
            </div>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
            >
              <option value="">Choose event...</option>
              {upcomingEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} · {event.date || 'TBD'}
                </option>
              ))}
            </select>
          </div>

          {!selectedEvent ? (
            <p className="text-sm text-gray-500 m-0">Choose an upcoming event and I will load every operations module.</p>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded border border-gray-200">
                <p className="text-sm font-semibold m-0">{selectedEvent.title || 'Selected event'}</p>
                <p className="text-xs text-gray-500 m-0 mt-1">{formatEventDate(selectedEvent)} · {selectedEvent.venue || 'Venue TBD'}</p>
                <div className="mt-2 flex gap-2 flex-wrap text-xs">
                  <Link to={`/events/${selectedEvent.id}?opsTab=production`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Production Tab</Link>
                  <Link to={`/events/${selectedEvent.id}?opsTab=concessions`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Concessions Tab</Link>
                  <Link to={`/events/${selectedEvent.id}?opsTab=merch`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Merch Tab</Link>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold m-0">Costumes + Hair/Makeup</p>
                    <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={saveCostumeNotes}>Save Notes</button>
                  </div>
                  <textarea
                    value={costumePlan?.notes || ''}
                    onChange={(e) => setCostumePlan((prev) => ({ ...(prev || {}), notes: e.target.value }))}
                    placeholder="Costume, quick-change, hair/makeup notes"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />

                  {costumeDrafts.map((draft, index) => (
                    <div key={`costume-draft-${index}`} className="border border-dashed border-gray-300 rounded p-2 space-y-2">
                      <input value={draft.characterName} onChange={(e) => setCostumeDrafts((prev) => prev.map((row, i) => i === index ? { ...row, characterName: e.target.value } : row))} placeholder="Character name" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <input value={draft.performerName} onChange={(e) => setCostumeDrafts((prev) => prev.map((row, i) => i === index ? { ...row, performerName: e.target.value } : row))} placeholder="Performer name" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <input value={draft.costumeLocation} onChange={(e) => setCostumeDrafts((prev) => prev.map((row, i) => i === index ? { ...row, costumeLocation: e.target.value } : row))} placeholder="Costume location / rack" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <input value={draft.costumeItems} onChange={(e) => setCostumeDrafts((prev) => prev.map((row, i) => i === index ? { ...row, costumeItems: e.target.value } : row))} placeholder="Costume items (comma separated)" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <textarea value={draft.quickChangeNotes} onChange={(e) => setCostumeDrafts((prev) => prev.map((row, i) => i === index ? { ...row, quickChangeNotes: e.target.value } : row))} placeholder="Quick-change notes" rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveCostumeDraft(index)}>Save Character</button>
                    </div>
                  ))}
                  <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => setCostumeDrafts((prev) => [...prev, blankCostumeCharacterDraft()])}>Add Another Character</button>

                  <div className="space-y-1 text-xs">
                    {costumeCharacters.map((row) => (
                      <div key={row.id} className="border border-gray-200 rounded px-2 py-1.5 flex items-center justify-between gap-2">
                        <span>{row.character_name} · {row.performer_name || 'TBD'} · {row.costume_location || 'Location TBD'}</span>
                        <button type="button" className="text-red-600 bg-transparent border-none cursor-pointer" onClick={async () => { await removeCostumeCharacter(row.id); await refreshEventOps(); }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-gray-200 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold m-0">Set Design / Scenery</p>
                    <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={saveSetNotes}>Save Notes</button>
                  </div>
                  <textarea
                    value={setPlan?.notes || ''}
                    onChange={(e) => setSetPlan((prev) => ({ ...(prev || {}), notes: e.target.value }))}
                    placeholder="Set/scenery notes"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />

                  {setElementDrafts.map((draft, index) => (
                    <div key={`set-draft-${index}`} className="border border-dashed border-gray-300 rounded p-2 space-y-2">
                      <input value={draft.elementName} onChange={(e) => setSetElementDrafts((prev) => prev.map((row, i) => i === index ? { ...row, elementName: e.target.value } : row))} placeholder="Set element name" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                        <select value={draft.category} onChange={(e) => setSetElementDrafts((prev) => prev.map((row, i) => i === index ? { ...row, category: e.target.value } : row))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
                          <option value="scenery">Scenery</option>
                          <option value="props">Props</option>
                          <option value="furniture">Furniture</option>
                          <option value="rigging">Rigging</option>
                          <option value="special">Special</option>
                        </select>
                        <select value={draft.buildStatus} onChange={(e) => setSetElementDrafts((prev) => prev.map((row, i) => i === index ? { ...row, buildStatus: e.target.value } : row))} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
                          <option value="planned">Planned</option>
                          <option value="in_progress">In Progress</option>
                          <option value="complete">Complete</option>
                          <option value="repaired">Repaired</option>
                        </select>
                      </div>
                      <input value={draft.storageLocation} onChange={(e) => setSetElementDrafts((prev) => prev.map((row, i) => i === index ? { ...row, storageLocation: e.target.value } : row))} placeholder="Storage location" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <textarea value={draft.safetyNotes} onChange={(e) => setSetElementDrafts((prev) => prev.map((row, i) => i === index ? { ...row, safetyNotes: e.target.value } : row))} placeholder="Safety notes" rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveSetElementDraft(index)}>Save Element</button>
                    </div>
                  ))}
                  <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => setSetElementDrafts((prev) => [...prev, blankSetElementDraft()])}>Add Another Set Element</button>

                  <div className="space-y-1 text-xs">
                    {setElements.map((row) => (
                      <div key={row.id} className="border border-gray-200 rounded px-2 py-1.5 flex items-center justify-between gap-2">
                        <span>{row.element_name} · {row.category || 'scenery'} · {row.build_status || 'planned'}</span>
                        <button type="button" className="text-red-600 bg-transparent border-none cursor-pointer" onClick={async () => { await removeSetElement(row.id); await refreshEventOps(); }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-gray-200 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold m-0">Parking + Permits + Maps</p>
                    <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={saveParkingNotes}>Save Notes</button>
                  </div>
                  <textarea
                    value={parkingPlan?.venue_parking_notes || ''}
                    onChange={(e) => setParkingPlan((prev) => ({ ...(prev || {}), venue_parking_notes: e.target.value }))}
                    placeholder="Venue parking notes"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <textarea
                    value={parkingPlan?.loading_zone_notes || ''}
                    onChange={(e) => setParkingPlan((prev) => ({ ...(prev || {}), loading_zone_notes: e.target.value }))}
                    placeholder="Loading zone notes"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />

                  {parkingAssignmentDrafts.map((draft, index) => (
                    <div key={`parking-draft-${index}`} className="border border-dashed border-gray-300 rounded p-2 space-y-2">
                      <input value={draft.personOrGroup} onChange={(e) => setParkingAssignmentDrafts((prev) => prev.map((row, i) => i === index ? { ...row, personOrGroup: e.target.value } : row))} placeholder="Person or group" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={draft.vehiclePlate} onChange={(e) => setParkingAssignmentDrafts((prev) => prev.map((row, i) => i === index ? { ...row, vehiclePlate: e.target.value } : row))} placeholder="Vehicle plate" className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
                        <input type="datetime-local" value={draft.arrivalTime} onChange={(e) => setParkingAssignmentDrafts((prev) => prev.map((row, i) => i === index ? { ...row, arrivalTime: e.target.value } : row))} className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      </div>
                      <textarea value={draft.notes} onChange={(e) => setParkingAssignmentDrafts((prev) => prev.map((row, i) => i === index ? { ...row, notes: e.target.value } : row))} placeholder="Notes" rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveParkingAssignmentDraft(index)}>Save Assignment</button>
                    </div>
                  ))}
                  <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => setParkingAssignmentDrafts((prev) => [...prev, blankParkingAssignmentDraft()])}>Add Another Parking Assignment</button>

                  <div className="space-y-1 text-xs">
                    {parkingAssignments.map((row) => (
                      <div key={row.id} className="border border-gray-200 rounded px-2 py-1.5 flex items-center justify-between gap-2">
                        <span>{row.person_or_group || 'Group'} · Plate: {row.vehicle_plate || 'N/A'}</span>
                        <button type="button" className="text-red-600 bg-transparent border-none cursor-pointer" onClick={async () => { await removeParkingAssignment(row.id); await refreshEventOps(); }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-gray-200 rounded p-3 space-y-2">
                  <p className="text-xs font-semibold m-0">Dressing Rooms + Assignments</p>

                  {dressingRoomDrafts.map((draft, index) => (
                    <div key={`room-draft-${index}`} className="border border-dashed border-gray-300 rounded p-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input value={draft.roomNameOrNumber} onChange={(e) => setDressingRoomDrafts((prev) => prev.map((row, i) => i === index ? { ...row, roomNameOrNumber: e.target.value } : row))} placeholder="Room name/number" className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
                        <input type="number" min="0" value={draft.capacity} onChange={(e) => setDressingRoomDrafts((prev) => prev.map((row, i) => i === index ? { ...row, capacity: e.target.value } : row))} placeholder="Capacity" className="px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      </div>
                      <input value={draft.locationNotes} onChange={(e) => setDressingRoomDrafts((prev) => prev.map((row, i) => i === index ? { ...row, locationNotes: e.target.value } : row))} placeholder="Location notes" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <input value={draft.amenities} onChange={(e) => setDressingRoomDrafts((prev) => prev.map((row, i) => i === index ? { ...row, amenities: e.target.value } : row))} placeholder="Amenities (comma separated)" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveDressingRoomDraft(index)}>Save Dressing Room</button>
                    </div>
                  ))}
                  <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => setDressingRoomDrafts((prev) => [...prev, blankDressingRoomDraft()])}>Add Another Dressing Room</button>

                  <div className="space-y-1 text-xs">
                    {dressingRooms.map((room) => (
                      <div key={room.id} className="border border-gray-200 rounded px-2 py-1.5 flex items-center justify-between gap-2">
                        <span>{room.room_name_or_number} · Capacity {room.capacity || 'N/A'}</span>
                        <button type="button" className="text-red-600 bg-transparent border-none cursor-pointer" onClick={async () => { await removeDressingRoom(room.id); await refreshEventOps(); }}>✕</button>
                      </div>
                    ))}
                  </div>

                  {dressingAssignmentDrafts.map((draft, index) => (
                    <div key={`assignment-draft-${index}`} className="border border-dashed border-gray-300 rounded p-2 space-y-2">
                      <select value={draft.dressingRoomId} onChange={(e) => setDressingAssignmentDrafts((prev) => prev.map((row, i) => i === index ? { ...row, dressingRoomId: e.target.value } : row))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
                        <option value="">Select dressing room...</option>
                        {dressingRooms.map((room) => (
                          <option key={room.id} value={room.id}>{room.room_name_or_number}</option>
                        ))}
                      </select>
                      <input value={draft.assignedTo} onChange={(e) => setDressingAssignmentDrafts((prev) => prev.map((row, i) => i === index ? { ...row, assignedTo: e.target.value } : row))} placeholder="Assigned to (act/star/cast group)" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <input value={draft.accessInstructions} onChange={(e) => setDressingAssignmentDrafts((prev) => prev.map((row, i) => i === index ? { ...row, accessInstructions: e.target.value } : row))} placeholder="Access instructions" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <input value={draft.keyCodeOrBadgeNotes} onChange={(e) => setDressingAssignmentDrafts((prev) => prev.map((row, i) => i === index ? { ...row, keyCodeOrBadgeNotes: e.target.value } : row))} placeholder="Key code / badge notes" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <textarea value={draft.notes} onChange={(e) => setDressingAssignmentDrafts((prev) => prev.map((row, i) => i === index ? { ...row, notes: e.target.value } : row))} placeholder="Notes" rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveDressingAssignmentDraft(index)}>Save Assignment</button>
                    </div>
                  ))}
                  <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => setDressingAssignmentDrafts((prev) => [...prev, blankDressingAssignmentDraft()])}>Add Another Assignment</button>

                  <div className="space-y-1 text-xs">
                    {dressingAssignments.map((assignment) => (
                      <div key={assignment.id} className="border border-gray-200 rounded px-2 py-1.5 flex items-center justify-between gap-2">
                        <span>{assignment.assigned_to || 'Unassigned'} · {assignment?.dressing_room?.room_name_or_number || 'Room TBD'}</span>
                        <button type="button" className="text-red-600 bg-transparent border-none cursor-pointer" onClick={async () => { await removeDressingRoomAssignment(assignment.id); await refreshEventOps(); }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section id="inventory" className={sectionClasses('inventory', focus)}>
          <h3 className="text-lg m-0 mb-2">Venue Inventory + Ordering</h3>
          <p className="text-sm text-gray-600 mb-3">
            Inventory, preferred suppliers, and purchase orders are managed in Venue Setup → Operations.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Link to="/venue-setup?tab=operations" className="btn-primary no-underline">Open Inventory + Suppliers</Link>
            {selectedEvent?.id ? (
              <Link to={`/events/${selectedEvent.id}?opsTab=purchasing`} className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 no-underline">
                Open Purchasing for Selected Event
              </Link>
            ) : null}
          </div>
        </section>

        <section id="training" className={sectionClasses('training', focus)}>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div>
              <h3 className="text-lg m-0">Training Sessions</h3>
              <p className="text-xs text-gray-500 m-0 mt-1">Build training courses and schedule sessions for your team.</p>
            </div>
            <button type="button" onClick={handleSendTrainingReminders} className="px-3 py-1.5 rounded border border-gray-300 text-xs bg-white text-gray-700">
              Send 72h Reminders
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded p-3 space-y-2">
              <p className="text-xs font-semibold m-0">Add Training Course</p>
              <input
                value={courseForm.title}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Course title"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={courseForm.category}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  {TRAINING_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  value={courseForm.durationMinutes}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                  placeholder="Minutes"
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <textarea
                value={courseForm.description}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <button type="button" onClick={handleSaveCourse} className="btn-primary">Save This Course</button>
            </div>

            <div className="border border-gray-200 rounded p-3 space-y-2">
              <p className="text-xs font-semibold m-0">Schedule Session</p>
              <select
                value={sessionForm.trainingCourseId}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, trainingCourseId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="">Choose course...</option>
                {(trainingCourses || []).map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  value={sessionForm.startDatetime}
                  onChange={(e) => setSessionForm((prev) => ({ ...prev, startDatetime: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <input
                  type="datetime-local"
                  value={sessionForm.endDatetime}
                  onChange={(e) => setSessionForm((prev) => ({ ...prev, endDatetime: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <input
                value={sessionForm.locationNotes}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, locationNotes: e.target.value }))}
                placeholder="Location notes"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <textarea
                value={sessionForm.notes}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Session notes"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <button type="button" onClick={handleSaveSession} className="btn-primary">Save This Session</button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold mb-2">Courses ({trainingCourses.length})</p>
              <div className="space-y-1 max-h-48 overflow-auto pr-1">
                {(trainingCourses || []).map((course) => (
                  <div key={course.id} className="border border-gray-200 rounded px-2 py-1.5">
                    <div className="font-medium">{course.title}</div>
                    <div className="text-xs text-gray-500">
                      {course.category || 'other'}
                      {course.duration_minutes ? ` · ${course.duration_minutes} min` : ''}
                    </div>
                  </div>
                ))}
                {!trainingCourses.length ? <p className="text-xs text-gray-500 m-0">No courses yet. Add one above and we are rolling.</p> : null}
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Sessions ({trainingSessions.length})</p>
              <div className="space-y-1 max-h-48 overflow-auto pr-1">
                {(trainingSessions || []).map((session) => {
                  const courseTitle = trainingCourses.find((course) => course.id === session.training_course_id)?.title || 'Course';
                  return (
                    <div key={session.id} className="border border-gray-200 rounded px-2 py-1.5">
                      <div className="font-medium">{courseTitle}</div>
                      <div className="text-xs text-gray-500">
                        {session.start_datetime ? new Date(session.start_datetime).toLocaleString('en-US') : 'Start TBD'}
                      </div>
                    </div>
                  );
                })}
                {!trainingSessions.length ? <p className="text-xs text-gray-500 m-0">No sessions yet. Schedule one and I will track it here.</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section id="certifications" className={sectionClasses('certifications', focus)}>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div>
              <h3 className="text-lg m-0">Certifications + Compliance</h3>
              <p className="text-xs text-gray-500 m-0 mt-1">Track expirations and notify staff before deadlines.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={handleSeedCertificationTypes} className="px-3 py-1.5 rounded border border-gray-300 text-xs bg-white text-gray-700">
                Seed Defaults
              </button>
              <button type="button" onClick={handleSendCertificationReminders} className="px-3 py-1.5 rounded border border-gray-300 text-xs bg-white text-gray-700">
                Send 30d Reminders
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded p-3 space-y-2">
              <p className="text-xs font-semibold m-0">Add Staff Certification</p>
              <select
                value={certificationForm.staffProfileId}
                onChange={(e) => setCertificationForm((prev) => ({ ...prev, staffProfileId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="">Choose staff...</option>
                {(staffProfiles || []).map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.display_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Staff'}</option>
                ))}
              </select>
              <select
                value={certificationForm.certificationTypeId}
                onChange={(e) => setCertificationForm((prev) => ({ ...prev, certificationTypeId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="">Choose certification...</option>
                {(certificationTypes || []).map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  value={certificationForm.issuedAt}
                  onChange={(e) => setCertificationForm((prev) => ({ ...prev, issuedAt: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <input
                  type="datetime-local"
                  value={certificationForm.expiresAt}
                  onChange={(e) => setCertificationForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <textarea
                value={certificationForm.notes}
                onChange={(e) => setCertificationForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <button type="button" onClick={handleSaveCertification} className="btn-primary">Save This Certification</button>
            </div>

            <div className="border border-gray-200 rounded p-3">
              <p className="text-xs font-semibold m-0 mb-2">Expiring / Expired ({expiringCertifications.length})</p>
              <div className="space-y-1 max-h-52 overflow-auto pr-1 text-sm">
                {expiringCertifications.map((cert) => {
                  const staffName = cert?.staff_profile?.display_name
                    || `${cert?.staff_profile?.first_name || ''} ${cert?.staff_profile?.last_name || ''}`.trim()
                    || 'Staff';
                  const typeName = cert?.certification_type?.name || 'Certification';
                  return (
                    <div key={cert.id} className="border border-gray-200 rounded px-2 py-1.5">
                      <div className="font-medium">{staffName} · {typeName}</div>
                      <div className="text-xs text-gray-500">
                        {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString('en-US') : 'No expiry'} · {String(cert.status || '').replace('_', ' ')}
                      </div>
                    </div>
                  );
                })}
                {!expiringCertifications.length ? <p className="text-xs text-gray-500 m-0">No certifications are expiring right now.</p> : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
