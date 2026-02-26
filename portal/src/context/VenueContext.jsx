import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  getProfile,
  upsertProfile,
  getUserEvents,
  createEvent as createSupabaseEvent,
  updateEvent as updateSupabaseEvent,
  getParticipantProfiles,
  createParticipantProfile,
  updateParticipantProfile,
  deleteParticipantProfile,
  getVenueProfiles,
  createVenueProfile,
  updateVenueProfile,
  deleteVenueProfile,
  getEventSeries,
  createEventSeries,
  replaceEventParticipants,
} from '../lib/supabase';
import { findZoneBookingConflicts, formatZoneConflictSummary } from '../services/zone-conflicts';

const VenueContext = createContext(null);

const CREW_STORAGE_KEY = 'imc_crew';
const PARTICIPANT_STORAGE_KEY = 'imc_participant_profiles';
const VENUE_PROFILE_STORAGE_KEY = 'imc_venue_profiles';
const SERIES_STORAGE_KEY = 'imc_event_series';
const ZONES_STORAGE_KEY = 'imc_performance_zones';
const SHOW_CONFIGS_STORAGE_KEY = 'imc_show_configurations';
const STAGE_DOCS_STORAGE_KEY = 'imc_stage_plot_documents';

const defaultVenue = {
  name: '', logo: null, address: '', city: '', state: '', zip: '',
  brandPrimary: '#c8a45e', brandSecondary: '#0d1b2a',
  website: '', facebook: '', instagram: '', twitter: '',
  tiktok: '', youtube: '', spotify: '', linkedin: '',
  onlineMenu: '', squareStore: '', shopifyStore: '', amazonStore: '',
  etsyStore: '', merchStore: '', otherStore: '',
};

function readLocalArray(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value || []));
  } catch {
    // Ignore localStorage write failures.
  }
}

function isMissingProductionRelation(error) {
  const message = String(error?.message || '');
  const code = String(error?.code || '').trim().toUpperCase();
  return code === '42P01'
    || code === 'PGRST205'
    || /relation .+ does not exist/i.test(message)
    || /column .+ does not exist/i.test(message)
    || /could not find the table .* in the schema cache/i.test(message);
}

function normalizeDate(dateString) {
  if (!dateString) return '';
  if (dateString.includes('T')) return dateString.split('T')[0];
  return dateString;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function dateOnlyToLocalDate(dateOnly = '') {
  const dt = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(12, 0, 0, 0);
  return dt;
}

function localDateToDateOnly(dt) {
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateObj, days = 0) {
  const dt = new Date(dateObj);
  dt.setDate(dt.getDate() + days);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

function weekdayKeyFromDate(dateObj) {
  return WEEKDAY_KEYS[dateObj.getDay()] || 'sun';
}

function normalizeWeekdayKey(value = '', fallback = 'sun') {
  const normalized = String(value || '').trim().toLowerCase();
  return WEEKDAY_KEYS.includes(normalized) ? normalized : fallback;
}

function weekdayIndexFromKey(value = 'sun') {
  const normalized = normalizeWeekdayKey(value, 'sun');
  const idx = WEEKDAY_KEYS.indexOf(normalized);
  return idx === -1 ? 0 : idx;
}

function normalizeSelectedWeekdays(input, fallbackDayKey) {
  const fallback = normalizeWeekdayKey(fallbackDayKey, 'sun');
  const fromInput = Array.isArray(input) ? input : [];
  const normalized = fromInput
    .map((value) => normalizeWeekdayKey(value, ''))
    .filter(Boolean);
  const unique = Array.from(new Set(normalized));
  if (!unique.length) return [fallback];
  return WEEKDAY_KEYS.filter((key) => unique.includes(key));
}

function monthDayFor(year, monthIndex, requestedDay) {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(requestedDay, 1), maxDay);
}

function nthWeekdayOfMonth(year, monthIndex, weekdayIndex, nth = 1) {
  if (nth === -1) {
    const lastDay = new Date(year, monthIndex + 1, 0, 12, 0, 0, 0);
    const back = (lastDay.getDay() - weekdayIndex + 7) % 7;
    return addDays(lastDay, -back);
  }

  const firstDay = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const forward = (weekdayIndex - firstDay.getDay() + 7) % 7;
  const firstMatch = addDays(firstDay, forward);
  return addDays(firstMatch, (Math.max(nth, 1) - 1) * 7);
}

function generateOccurrenceDates(startDateOnly, recurrence = {}, occurrenceCount = 1) {
  const start = dateOnlyToLocalDate(startDateOnly);
  if (!start) return [startDateOnly].filter(Boolean);
  const total = Math.max(1, Number.parseInt(occurrenceCount, 10) || 1);
  if (total === 1) return [localDateToDateOnly(start)];

  const frequency = String(recurrence.frequency || 'weekly').trim().toLowerCase();
  const startWeekdayKey = weekdayKeyFromDate(start);
  const selectedDays = normalizeSelectedWeekdays(
    recurrence.daysOfWeek || recurrence.days_of_week || [],
    recurrence.weekday || recurrence.weekdayKey || startWeekdayKey
  );
  const requestedDayOfMonth = Math.max(
    1,
    Math.min(31, Number.parseInt(recurrence.dayOfMonth ?? recurrence.day_of_month ?? start.getDate(), 10) || start.getDate())
  );
  const weekOfMonth = String(recurrence.weekOfMonth || recurrence.week_of_month || 'first').toLowerCase();
  const nthMap = { first: 1, second: 2, third: 3, fourth: 4, last: -1 };
  const nthWeek = nthMap[weekOfMonth] || 1;
  const targetWeekdayIndex = weekdayIndexFromKey(recurrence.weekday || startWeekdayKey);
  const intervalWeeks = Math.max(1, Number.parseInt(recurrence.intervalWeeks || recurrence.interval_weeks || recurrence.interval || 1, 10) || 1);

  const results = [localDateToDateOnly(start)];

  if (frequency === 'daily') {
    let cursor = new Date(start);
    while (results.length < total) {
      cursor = addDays(cursor, 1);
      results.push(localDateToDateOnly(cursor));
    }
    return results;
  }

  if (frequency === 'weekdays') {
    let cursor = new Date(start);
    while (results.length < total) {
      cursor = addDays(cursor, 1);
      const day = cursor.getDay();
      if (day === 0 || day === 6) continue;
      results.push(localDateToDateOnly(cursor));
    }
    return results;
  }

  if (frequency === 'weekly_selected_days') {
    let cursor = new Date(start);
    while (results.length < total) {
      cursor = addDays(cursor, 1);
      const key = weekdayKeyFromDate(cursor);
      if (selectedDays.includes(key)) {
        results.push(localDateToDateOnly(cursor));
      }
    }
    return results;
  }

  if (frequency === 'biweekly') {
    let cursor = new Date(start);
    while (results.length < total) {
      cursor = addDays(cursor, 14);
      results.push(localDateToDateOnly(cursor));
    }
    return results;
  }

  if (frequency === 'monthly_day_of_month' || frequency === 'monthly') {
    let monthOffset = 1;
    while (results.length < total) {
      const baseMonth = new Date(start.getFullYear(), start.getMonth() + monthOffset, 1, 12, 0, 0, 0);
      const day = monthDayFor(baseMonth.getFullYear(), baseMonth.getMonth(), requestedDayOfMonth);
      const dt = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), day, 12, 0, 0, 0);
      results.push(localDateToDateOnly(dt));
      monthOffset += 1;
    }
    return results;
  }

  if (frequency === 'monthly_nth_weekday' || frequency === 'monthly_last_weekday') {
    let monthOffset = 1;
    const nth = frequency === 'monthly_last_weekday' ? -1 : nthWeek;
    while (results.length < total) {
      const year = start.getFullYear();
      const month = start.getMonth() + monthOffset;
      const dt = nthWeekdayOfMonth(year, month, targetWeekdayIndex, nth);
      results.push(localDateToDateOnly(dt));
      monthOffset += 1;
    }
    return results;
  }

  if (frequency === 'weekly') {
    const multiDayWeekly = selectedDays.length > 1;
    if (multiDayWeekly) {
      let cursor = new Date(start);
      while (results.length < total) {
        cursor = addDays(cursor, 1);
        const key = weekdayKeyFromDate(cursor);
        if (selectedDays.includes(key)) {
          results.push(localDateToDateOnly(cursor));
        }
      }
      return results;
    }

    let cursor = new Date(start);
    while (results.length < total) {
      cursor = addDays(cursor, 7 * intervalWeeks);
      results.push(localDateToDateOnly(cursor));
    }
    return results;
  }

  // Fallback for unknown recurrence values.
  let cursor = new Date(start);
  while (results.length < total) {
    cursor = addDays(cursor, 7);
    results.push(localDateToDateOnly(cursor));
  }
  return results;
}

function combineDateAndTime(dateOnly, timeValue = '19:00') {
  const safeTime = String(timeValue || '19:00').slice(0, 5);
  return `${dateOnly}T${safeTime}:00`;
}

function moveIsoToDate(isoValue, dateOnly) {
  if (!isoValue || !dateOnly) return isoValue || '';
  const dt = new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return combineDateAndTime(dateOnly, '19:00');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return combineDateAndTime(dateOnly, `${hh}:${mm}`);
}

function mapDbEvent(e, fallback = {}) {
  const participantIds = Array.isArray(e.participant_profile_ids)
    ? e.participant_profile_ids
    : (fallback.participantProfileIds || []);

  return {
    id: e.id,
    title: e.title || '',
    description: e.description || '',
    genre: e.genre || '',
    date: e.date || fallback.date || '',
    time: e.time || fallback.time || '',
    venue: e.venue_name || '',
    venueStreetNumber: e.venue_street_number || '',
    venueStreetName: e.venue_street_name || '',
    venueSuite: e.venue_suite || '',
    venueCity: e.venue_city || 'San Antonio',
    venueState: e.venue_state || 'TX',
    venueZip: e.venue_zip || '',
    venueAddress: e.venue_address || '',
    venuePhone: e.venue_phone || '',
    venueWebsite: e.venue_website || '',
    ticketLink: e.ticket_link || '',
    ticketPrice: e.ticket_price || '',
    ticketProvider: e.ticket_provider || '',
    ticketProviderEventId: e.ticket_provider_event_id || '',
    brandColors: e.brand_colors || '',
    writingTone: e.writing_tone || '',
    specialInstructions: e.special_instructions || '',
    detectedFonts: e.detected_fonts || '',
    productionDetails: e.production_details || {},
    run_of_show: e.run_of_show || null,
    crew: e.crew || [],
    channels: e.channels || {},
    campaign: e.campaign || false,
    performers: e.performers || '',
    sponsors: e.sponsors || [],
    driveEventFolderId: e.drive_event_folder_id || '',
    performanceZoneId: e.performance_zone_id || '',
    performanceZoneName: e.performance_zone_name || '',
    bookingStartAt: e.booking_start_at || '',
    bookingEndAt: e.booking_end_at || '',
    showConfigurationId: e.show_configuration_id || '',
    showContacts: Array.isArray(e.show_contacts) ? e.show_contacts : [],
    stagePlotDocumentId: e.stage_plot_document_id || '',
    bookingStatus: e.booking_status || 'draft',
    venueProfileId: e.venue_profile_id || fallback.venueProfileId || '',
    participantProfileIds: participantIds,
    seriesId: e.series_id || fallback.seriesId || '',
    seriesName: e.series_name || fallback.seriesName || '',
    recurrenceIndex: e.recurrence_index || fallback.recurrenceIndex || 1,
    recurrenceCount: e.recurrence_count || fallback.recurrenceCount || 1,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}

export function VenueProvider({ children }) {
  const { user } = useAuth();
  const [venue, setVenue] = useState(defaultVenue);
  const [events, setEvents] = useState([]);
  const [crew, setCrew] = useState([]);
  const [participantProfiles, setParticipantProfiles] = useState([]);
  const [venueProfiles, setVenueProfiles] = useState([]);
  const [eventSeries, setEventSeries] = useState([]);
  const [performanceZones, setPerformanceZones] = useState([]);
  const [showConfigurations, setShowConfigurations] = useState([]);
  const [stagePlotDocuments, setStagePlotDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const callProductionAction = useCallback(async (action, payload = {}) => {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || `Production action failed: ${action}`);
    }
    return data;
  }, []);

  // Load profile and related data from Supabase when user changes.
  useEffect(() => {
    if (!user?.id) {
      setVenue(defaultVenue);
      setEvents([]);
      setCrew(readLocalArray(CREW_STORAGE_KEY));
      setParticipantProfiles(readLocalArray(PARTICIPANT_STORAGE_KEY));
      setVenueProfiles(readLocalArray(VENUE_PROFILE_STORAGE_KEY));
      setEventSeries(readLocalArray(SERIES_STORAGE_KEY));
      setPerformanceZones(readLocalArray(ZONES_STORAGE_KEY));
      setShowConfigurations(readLocalArray(SHOW_CONFIGS_STORAGE_KEY));
      setStagePlotDocuments(readLocalArray(STAGE_DOCS_STORAGE_KEY));
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [
          profile,
          userEvents,
          participants,
          savedVenues,
          series,
          productionData,
        ] = await Promise.all([
          getProfile(user.id).catch(() => null),
          getUserEvents(user.id).catch(() => []),
          getParticipantProfiles(user.id).catch(() => []),
          getVenueProfiles(user.id).catch(() => []),
          getEventSeries(user.id).catch(() => []),
          callProductionAction('get-production-data', { userId: user.id }).catch(() => ({
            zones: [],
            showConfigurations: [],
            stagePlotDocuments: [],
          })),
        ]);

        if (cancelled) return;

        if (profile) {
          setVenue({
            name: profile.venue_name || profile.name || '',
            businessName: profile.name || '',

            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            title: profile.title || '',
            workPhone: profile.work_phone || '',
            cellPhone: profile.cell_phone || '',
            email: profile.email || '',
            preferredContact: profile.preferred_contact || 'email',

            dbaName: profile.dba_name || '',
            businessType: profile.business_type || 'venue',
            taxId: profile.tax_id || '',
            yearEstablished: profile.year_established || '',

            streetNumber: profile.street_number || '',
            streetName: profile.street_name || '',
            suiteNumber: profile.suite_number || '',
            city: profile.city || '',
            state: profile.state || '',
            zipCode: profile.zip_code || profile.postal_code || '',
            country: profile.country || 'US',

            address: profile.address || '',
            zip: profile.postal_code || profile.zip_code || '',

            logo: profile.logo || null,
            brandPrimary: profile.brand_primary || '#c8a45e',
            brandSecondary: profile.brand_secondary || '#0d1b2a',

            website: profile.website || '',
            facebook: profile.facebook || profile.facebook_url || '',
            facebookPageId: profile.facebook_page_id || '',
            instagram: profile.instagram || profile.instagram_url || '',
            twitter: profile.twitter || profile.twitter_url || '',
            tiktok: profile.tiktok || profile.tiktok_url || '',
            youtube: profile.youtube || profile.youtube_url || '',
            spotify: profile.spotify || profile.spotify_url || '',
            linkedin: profile.linkedin || profile.linkedin_url || '',
            yelp: profile.yelp_url || '',
            googleBusiness: profile.google_business_url || '',
            onlineMenu: profile.online_menu_url || '',
            squareStore: profile.square_store_url || '',
            shopifyStore: profile.shopify_store_url || '',
            amazonStore: profile.amazon_store_url || '',
            etsyStore: profile.etsy_store_url || '',
            merchStore: profile.merch_store_url || '',
            otherStore: profile.other_store_url || '',

            capacity: profile.capacity || '',
            hasStage: profile.has_stage || false,
            hasSound: profile.has_sound || false,
            hasLighting: profile.has_lighting || false,
            parkingType: profile.parking_type || 'street',
            adaAccessible: profile.ada_accessible || false,
            ageRestriction: profile.age_restriction || 'all_ages',
            liquorLicense: profile.liquor_license || false,

            type: profile.profile_type || profile.type || 'venue',
            stageName: profile.name || '',
            genre: profile.genre || '',
            subgenres: profile.subgenres || [],
            yearsActive: profile.years_active || '',
            recordLabel: profile.record_label || '',
            performingRightsOrg: profile.performing_rights_org || '',
            unionMember: profile.union_member || '',
            politicalScope: profile.political_scope || profile.genre || '',
            officeSought: profile.office_sought || profile.record_label || '',
            district: profile.district || profile.union_member || '',
            partyAffiliation: profile.party_affiliation || profile.performing_rights_org || '',
            candidateStatus: profile.candidate_status || '',
            electionStage: profile.election_stage || '',
            campaignObjective: profile.campaign_objective || '',
            bio: profile.bio || profile.description || '',
            hometown: profile.hometown || '',

            managerName: profile.manager_name || '',
            managerEmail: profile.manager_email || '',
            managerPhone: profile.manager_phone || '',
            bookingName: profile.booking_name || '',
            bookingEmail: profile.booking_email || profile.booking_contact || '',
            bookingPhone: profile.booking_phone || '',

            headshot: profile.headshot || profile.headshot_url || null,
            bandcamp: profile.bandcamp || profile.bandcamp_url || '',
            soundcloud: profile.soundcloud || profile.soundcloud_url || '',
            appleMusic: profile.apple_music || profile.apple_music_url || '',
            amazonMusic: profile.amazon_music || '',
            pressKit: profile.press_kit || '',

            hasOwnSound: profile.has_own_sound || false,
            hasOwnLighting: profile.has_own_lighting || false,
            typicalSetLength: profile.typical_set_length || '1hr',
            riderRequirements: profile.rider_requirements || '',
            techRiderUrl: profile.tech_rider_url || '',

            label: profile.label || profile.record_label || '',
            members: profile.members || profile.band_members || [],

            driveRootFolderId: profile.drive_root_folder_id || '',
            driveBrandFolderId: profile.drive_brand_folder_id || '',
          });
        }

        setEvents((userEvents || []).map(e => mapDbEvent(e)));

        const resolvedParticipants = participants?.length ? participants : readLocalArray(PARTICIPANT_STORAGE_KEY);
        const resolvedVenueProfiles = savedVenues?.length ? savedVenues : readLocalArray(VENUE_PROFILE_STORAGE_KEY);
        const resolvedSeries = series?.length ? series : readLocalArray(SERIES_STORAGE_KEY);
        const zones = productionData?.zones || [];
        const configs = productionData?.showConfigurations || [];
        const stageDocs = productionData?.stagePlotDocuments || [];
        const resolvedZones = zones?.length ? zones : readLocalArray(ZONES_STORAGE_KEY);
        const resolvedConfigs = configs?.length ? configs : readLocalArray(SHOW_CONFIGS_STORAGE_KEY);
        const resolvedStageDocs = stageDocs?.length ? stageDocs : readLocalArray(STAGE_DOCS_STORAGE_KEY);

        setParticipantProfiles(resolvedParticipants);
        setVenueProfiles(resolvedVenueProfiles);
        setEventSeries(resolvedSeries);
        setPerformanceZones(resolvedZones);
        setShowConfigurations(resolvedConfigs);
        setStagePlotDocuments(resolvedStageDocs);

        if (participants?.length) writeLocalArray(PARTICIPANT_STORAGE_KEY, participants);
        if (savedVenues?.length) writeLocalArray(VENUE_PROFILE_STORAGE_KEY, savedVenues);
        if (series?.length) writeLocalArray(SERIES_STORAGE_KEY, series);
        if (zones?.length) writeLocalArray(ZONES_STORAGE_KEY, zones);
        if (configs?.length) writeLocalArray(SHOW_CONFIGS_STORAGE_KEY, configs);
        if (stageDocs?.length) writeLocalArray(STAGE_DOCS_STORAGE_KEY, stageDocs);
      } catch (err) {
        console.error('[VenueContext] Failed to load data:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    const storedCrew = localStorage.getItem(CREW_STORAGE_KEY);
    if (storedCrew) {
      try {
        setCrew(JSON.parse(storedCrew));
      } catch {
        setCrew([]);
      }
    }

    return () => { cancelled = true; };
  }, [callProductionAction, user?.id]);

  useEffect(() => {
    writeLocalArray(PARTICIPANT_STORAGE_KEY, participantProfiles);
  }, [participantProfiles]);

  useEffect(() => {
    writeLocalArray(VENUE_PROFILE_STORAGE_KEY, venueProfiles);
  }, [venueProfiles]);

  useEffect(() => {
    writeLocalArray(SERIES_STORAGE_KEY, eventSeries);
  }, [eventSeries]);

  useEffect(() => {
    writeLocalArray(ZONES_STORAGE_KEY, performanceZones);
  }, [performanceZones]);

  useEffect(() => {
    writeLocalArray(SHOW_CONFIGS_STORAGE_KEY, showConfigurations);
  }, [showConfigurations]);

  useEffect(() => {
    writeLocalArray(STAGE_DOCS_STORAGE_KEY, stagePlotDocuments);
  }, [stagePlotDocuments]);

  const saveVenue = useCallback(async (data) => {
    const updated = { ...venue, ...data };
    setVenue(updated);

    if (!user?.id) return;

    try {
      await upsertProfile({
        user_id: user.id,
        venue_name: updated.businessName || updated.stageName || updated.name || '',
        name: updated.businessName || updated.stageName || updated.name || '',
        profile_type: updated.type || 'venue',

        first_name: updated.firstName || '',
        last_name: updated.lastName || '',
        title: updated.title || '',
        work_phone: updated.workPhone || '',
        cell_phone: updated.cellPhone || '',
        email: updated.email || '',
        preferred_contact: updated.preferredContact || 'email',

        dba_name: updated.dbaName || '',
        business_type: updated.businessType || 'venue',
        tax_id: updated.taxId || '',
        year_established: updated.yearEstablished || null,

        street_number: updated.streetNumber || '',
        street_name: updated.streetName || '',
        suite_number: updated.suiteNumber || '',
        city: updated.city || '',
        state: updated.state || '',
        zip_code: updated.zipCode || '',
        country: updated.country || 'US',

        address: updated.address || '',
        postal_code: updated.zipCode || updated.zip || '',

        logo: updated.logo || null,
        brand_primary: updated.brandPrimary || '#c8a45e',
        brand_secondary: updated.brandSecondary || '#0d1b2a',

        website: updated.website || '',
        facebook: updated.facebook || '',
        facebook_url: updated.facebook || '',
        facebook_page_id: updated.facebookPageId || '',
        instagram: updated.instagram || '',
        instagram_url: updated.instagram || '',
        twitter: updated.twitter || '',
        twitter_url: updated.twitter || '',
        tiktok: updated.tiktok || '',
        tiktok_url: updated.tiktok || '',
        youtube: updated.youtube || '',
        youtube_url: updated.youtube || '',
        spotify: updated.spotify || '',
        spotify_url: updated.spotify || '',
        linkedin: updated.linkedin || '',
        linkedin_url: updated.linkedin || '',
        yelp_url: updated.yelp || '',
        google_business_url: updated.googleBusiness || '',
        online_menu_url: updated.onlineMenu || '',
        square_store_url: updated.squareStore || '',
        shopify_store_url: updated.shopifyStore || '',
        amazon_store_url: updated.amazonStore || '',
        etsy_store_url: updated.etsyStore || '',
        merch_store_url: updated.merchStore || '',
        other_store_url: updated.otherStore || '',

        capacity: updated.capacity || null,
        has_stage: updated.hasStage || false,
        has_sound: updated.hasSound || false,
        has_lighting: updated.hasLighting || false,
        parking_type: updated.parkingType || 'street',
        ada_accessible: updated.adaAccessible || false,
        age_restriction: updated.ageRestriction || 'all_ages',
        liquor_license: updated.liquorLicense || false,

        genre: updated.politicalScope || updated.genre || '',
        subgenres: updated.subgenres || [],
        years_active: updated.yearsActive || null,
        record_label: updated.officeSought || updated.recordLabel || updated.label || '',
        performing_rights_org: updated.partyAffiliation || updated.performingRightsOrg || '',
        union_member: updated.district || updated.unionMember || '',
        political_scope: updated.politicalScope || '',
        office_sought: updated.officeSought || '',
        district: updated.district || '',
        party_affiliation: updated.partyAffiliation || '',
        candidate_status: updated.candidateStatus || '',
        election_stage: updated.electionStage || '',
        campaign_objective: updated.campaignObjective || '',
        bio: updated.bio || '',
        description: updated.bio || '',
        hometown: updated.hometown || '',

        manager_name: updated.managerName || '',
        manager_email: updated.managerEmail || '',
        manager_phone: updated.managerPhone || '',
        booking_name: updated.bookingName || '',
        booking_email: updated.bookingEmail || '',
        booking_phone: updated.bookingPhone || '',
        booking_contact: updated.bookingEmail || '',

        headshot: updated.headshot || null,
        headshot_url: updated.headshot || null,
        bandcamp: updated.bandcamp || '',
        bandcamp_url: updated.bandcamp || '',
        soundcloud: updated.soundcloud || '',
        soundcloud_url: updated.soundcloud || '',
        apple_music: updated.appleMusic || '',
        apple_music_url: updated.appleMusic || '',
        amazon_music: updated.amazonMusic || '',
        press_kit: updated.pressKit || '',

        has_own_sound: updated.hasOwnSound || false,
        has_own_lighting: updated.hasOwnLighting || false,
        typical_set_length: updated.typicalSetLength || '1hr',
        rider_requirements: updated.riderRequirements || '',
        tech_rider_url: updated.techRiderUrl || '',

        members: updated.members || [],
        band_members: updated.members || [],
      });
    } catch (err) {
      console.error('[VenueContext] Failed to save profile:', err);
      setError('Failed to save profile: ' + err.message);
    }
  }, [venue, user?.id]);

  const saveParticipantProfile = useCallback(async (profileData) => {
    const name = String(profileData?.name || '').trim();
    if (!name) throw new Error('Participant name is required');

    const optimistic = {
      id: `tmp-participant-${Date.now()}`,
      user_id: user?.id,
      profile_type: profileData.profile_type || 'participant',
      name,
      role: profileData.role || '',
      genre: profileData.genre || '',
      bio: profileData.bio || '',
      contact_email: profileData.contact_email || '',
      contact_phone: profileData.contact_phone || '',
      website: profileData.website || '',
      metadata: profileData.metadata || {},
      created_at: new Date().toISOString(),
    };

    setParticipantProfiles(prev => [optimistic, ...prev]);

    if (!user?.id) return optimistic;

    try {
      const saved = await createParticipantProfile({ ...optimistic, user_id: user.id });
      setParticipantProfiles(prev => prev.map(item => (item.id === optimistic.id ? saved : item)));
      return saved;
    } catch (err) {
      setParticipantProfiles(prev => prev.filter(item => item.id !== optimistic.id));
      throw err;
    }
  }, [user?.id]);

  const editParticipantProfile = useCallback(async (id, updates) => {
    setParticipantProfiles(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)));
    if (!user?.id || String(id).startsWith('tmp-') || String(id).startsWith('local-')) return;

    try {
      await updateParticipantProfile(id, updates);
    } catch (err) {
      console.error('[VenueContext] Failed to update participant profile:', err);
    }
  }, [user?.id]);

  const removeParticipantProfile = useCallback(async (id) => {
    setParticipantProfiles(prev => prev.filter(item => item.id !== id));
    if (!user?.id || String(id).startsWith('tmp-') || String(id).startsWith('local-')) return;

    try {
      await deleteParticipantProfile(id);
    } catch (err) {
      console.error('[VenueContext] Failed to delete participant profile:', err);
    }
  }, [user?.id]);

  const saveVenueProfile = useCallback(async (profileData) => {
    const name = String(profileData?.name || '').trim();
    if (!name) throw new Error('Venue name is required');

    const optimistic = {
      id: `tmp-venue-${Date.now()}`,
      user_id: user?.id,
      name,
      street_number: profileData.street_number || '',
      street_name: profileData.street_name || '',
      suite: profileData.suite || '',
      city: profileData.city || 'San Antonio',
      state: profileData.state || 'TX',
      postal_code: profileData.postal_code || '',
      phone: profileData.phone || '',
      website: profileData.website || '',
      metadata: profileData.metadata || {},
      created_at: new Date().toISOString(),
    };

    setVenueProfiles(prev => [optimistic, ...prev]);

    if (!user?.id) return optimistic;

    try {
      const saved = await createVenueProfile({ ...optimistic, user_id: user.id });
      setVenueProfiles(prev => prev.map(item => (item.id === optimistic.id ? saved : item)));
      return saved;
    } catch (err) {
      setVenueProfiles(prev => prev.filter(item => item.id !== optimistic.id));
      throw err;
    }
  }, [user?.id]);

  const editVenueProfile = useCallback(async (id, updates) => {
    setVenueProfiles(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)));
    if (!user?.id || String(id).startsWith('tmp-') || String(id).startsWith('local-')) return;

    try {
      await updateVenueProfile(id, updates);
    } catch (err) {
      console.error('[VenueContext] Failed to update venue profile:', err);
    }
  }, [user?.id]);

  const removeVenueProfile = useCallback(async (id) => {
    setVenueProfiles(prev => prev.filter(item => item.id !== id));
    if (!user?.id || String(id).startsWith('tmp-') || String(id).startsWith('local-')) return;

    try {
      await deleteVenueProfile(id);
    } catch (err) {
      console.error('[VenueContext] Failed to delete venue profile:', err);
    }
  }, [user?.id]);

  const savePerformanceZone = useCallback(async (zoneData) => {
    const name = String(zoneData?.name || '').trim();
    if (!name) throw new Error('Zone name is required');

    const optimistic = {
      id: `tmp-zone-${Date.now()}`,
      user_id: user?.id,
      name,
      zone_type: zoneData.zone_type || 'club_stage',
      width_ft: zoneData.width_ft || null,
      depth_ft: zoneData.depth_ft || null,
      ceiling_height_ft: zoneData.ceiling_height_ft || null,
      capacity: zoneData.capacity || null,
      fixed_equipment: zoneData.fixed_equipment || [],
      power_spec: zoneData.power_spec || {},
      restrictions: zoneData.restrictions || '',
      load_in_notes: zoneData.load_in_notes || '',
      default_contacts: zoneData.default_contacts || [],
      is_active: true,
      created_at: new Date().toISOString(),
    };

    setPerformanceZones(prev => [optimistic, ...prev]);
    if (!user?.id) return optimistic;

    try {
      const payload = {
        ...zoneData,
        name,
      };
      const response = await callProductionAction('upsert-performance-zone', {
        userId: user.id,
        zone: payload,
      });
      const saved = response.zone || optimistic;
      setPerformanceZones(prev => prev.map(item => (item.id === optimistic.id ? saved : item)));
      return saved;
    } catch (err) {
      if (isMissingProductionRelation(err)) {
        const fallback = { ...optimistic, id: `local-zone-${Date.now()}` };
        setPerformanceZones(prev => prev.map(item => (item.id === optimistic.id ? fallback : item)));
        return fallback;
      }
      setPerformanceZones(prev => prev.filter(item => item.id !== optimistic.id));
      throw err;
    }
  }, [callProductionAction, user?.id]);

  const editPerformanceZone = useCallback(async (zoneId, updates) => {
    setPerformanceZones(prev => prev.map(item => (item.id === zoneId ? { ...item, ...updates } : item)));
    if (!user?.id || String(zoneId).startsWith('tmp-') || String(zoneId).startsWith('local-')) return;

    try {
      await callProductionAction('upsert-performance-zone', {
        userId: user.id,
        zone: { id: zoneId, ...updates },
      });
    } catch (err) {
      console.error('[VenueContext] Failed to update zone:', err);
    }
  }, [callProductionAction, user?.id]);

  const removePerformanceZone = useCallback(async (zoneId) => {
    setPerformanceZones(prev => prev.filter(item => item.id !== zoneId));
    if (!user?.id || String(zoneId).startsWith('tmp-') || String(zoneId).startsWith('local-')) return;

    try {
      await callProductionAction('delete-performance-zone', {
        userId: user.id,
        zoneId,
      });
    } catch (err) {
      console.error('[VenueContext] Failed to archive zone:', err);
    }
  }, [callProductionAction, user?.id]);

  const saveShowConfiguration = useCallback(async (configData) => {
    const name = String(configData?.name || '').trim();
    if (!name) throw new Error('Show configuration name is required');

    const optimistic = {
      id: `tmp-showcfg-${Date.now()}`,
      user_id: user?.id,
      name,
      show_type: configData.show_type || 'band',
      template_key: configData.template_key || '',
      member_count: configData.member_count || null,
      summary: configData.summary || '',
      equipment: configData.equipment || [],
      input_list: configData.input_list || [],
      patch_list: configData.patch_list || [],
      monitor_plan: configData.monitor_plan || [],
      backline: configData.backline || [],
      lighting_plan: configData.lighting_plan || [],
      video_plan: configData.video_plan || [],
      power_plan: configData.power_plan || [],
      stage_management: configData.stage_management || [],
      stage_plot_layout: configData.stage_plot_layout || {},
      plot_summary: configData.plot_summary || '',
      participant_profile_id: configData.participant_profile_id || null,
      is_template: !!configData.is_template,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    setShowConfigurations(prev => [optimistic, ...prev]);
    if (!user?.id) return optimistic;

    try {
      const response = await callProductionAction('upsert-show-configuration', {
        userId: user.id,
        showConfiguration: {
          ...configData,
          name,
        },
      });
      const saved = response.showConfiguration || optimistic;
      setShowConfigurations(prev => prev.map(item => (item.id === optimistic.id ? saved : item)));
      return saved;
    } catch (err) {
      if (isMissingProductionRelation(err)) {
        const fallback = { ...optimistic, id: `local-showcfg-${Date.now()}` };
        setShowConfigurations(prev => prev.map(item => (item.id === optimistic.id ? fallback : item)));
        return fallback;
      }
      setShowConfigurations(prev => prev.filter(item => item.id !== optimistic.id));
      throw err;
    }
  }, [callProductionAction, user?.id]);

  const editShowConfiguration = useCallback(async (configId, updates) => {
    setShowConfigurations(prev => prev.map(item => (item.id === configId ? { ...item, ...updates } : item)));
    if (!user?.id || String(configId).startsWith('tmp-') || String(configId).startsWith('local-')) return;

    try {
      await callProductionAction('upsert-show-configuration', {
        userId: user.id,
        showConfiguration: { id: configId, ...updates },
      });
    } catch (err) {
      console.error('[VenueContext] Failed to update show configuration:', err);
    }
  }, [callProductionAction, user?.id]);

  const removeShowConfiguration = useCallback(async (configId) => {
    setShowConfigurations(prev => prev.filter(item => item.id !== configId));
    if (!user?.id || String(configId).startsWith('tmp-') || String(configId).startsWith('local-')) return;

    try {
      await callProductionAction('delete-show-configuration', {
        userId: user.id,
        configId,
      });
    } catch (err) {
      console.error('[VenueContext] Failed to delete show configuration:', err);
    }
  }, [callProductionAction, user?.id]);

  const saveStagePlotDocumentData = useCallback(async (docData) => {
    const payload = {
      user_id: user?.id,
      event_id: docData.event_id || null,
      show_configuration_id: docData.show_configuration_id || null,
      title: docData.title || 'Stage Plot',
      content: docData.content || {},
      pdf_base64: docData.pdf_base64 || null,
      pdf_filename: docData.pdf_filename || null,
      share_token: docData.share_token || null,
      updated_at: new Date().toISOString(),
    };

    if (docData.id) {
      setStagePlotDocuments(prev => prev.map(item => (item.id === docData.id ? { ...item, ...payload } : item)));
      if (!user?.id || String(docData.id).startsWith('tmp-') || String(docData.id).startsWith('local-')) {
        return { ...docData, ...payload };
      }
      try {
        const response = await callProductionAction('upsert-stage-plot-document', {
          userId: user.id,
          stagePlotDocument: {
            id: docData.id,
            ...payload,
          },
        });
        const saved = response.stagePlotDocument || { ...docData, ...payload };
        setStagePlotDocuments(prev => prev.map(item => (item.id === docData.id ? saved : item)));
        return saved;
      } catch (err) {
        console.error('[VenueContext] Failed to update stage plot doc:', err);
        throw err;
      }
    }

    const optimistic = {
      id: `tmp-stagedoc-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
    };
    setStagePlotDocuments(prev => [optimistic, ...prev]);
    if (!user?.id) return optimistic;

    try {
      const response = await callProductionAction('upsert-stage-plot-document', {
        userId: user.id,
        stagePlotDocument: payload,
      });
      const saved = response.stagePlotDocument || optimistic;
      setStagePlotDocuments(prev => prev.map(item => (item.id === optimistic.id ? saved : item)));
      return saved;
    } catch (err) {
      if (isMissingProductionRelation(err)) {
        const fallback = { ...optimistic, id: `local-stagedoc-${Date.now()}` };
        setStagePlotDocuments(prev => prev.map(item => (item.id === optimistic.id ? fallback : item)));
        return fallback;
      }
      setStagePlotDocuments(prev => prev.filter(item => item.id !== optimistic.id));
      throw err;
    }
  }, [callProductionAction, user?.id]);

  const addEvent = useCallback(async (eventData) => {
    const dateOnly = normalizeDate(eventData.date);
    const timePart = eventData.time || (eventData.date && eventData.date.includes('T') ? eventData.date.split('T')[1] : '');
    const baseStartAt = eventData.bookingStartAt || (dateOnly ? combineDateAndTime(dateOnly, timePart || '19:00') : '');
    const baseEndAt = eventData.bookingEndAt || (dateOnly ? combineDateAndTime(dateOnly, '23:00') : '');
    const baseStartDate = baseStartAt ? new Date(baseStartAt) : null;
    const baseEndDate = baseEndAt ? new Date(baseEndAt) : null;
    const baseDurationMs = baseStartDate && baseEndDate && baseEndDate > baseStartDate
      ? baseEndDate.getTime() - baseStartDate.getTime()
      : null;

    const recurrence = eventData.recurrence || {};
    const recurrenceEnabled = !!recurrence.enabled && !!dateOnly;
    const requestedCount = Number.parseInt(recurrence.count, 10);
    const recurrenceCount = recurrenceEnabled
      ? Math.min(Math.max(Number.isNaN(requestedCount) ? 1 : requestedCount, 1), 52)
      : 1;
    const recurrenceFrequency = String(recurrence.frequency || 'weekly').trim().toLowerCase();
    const recurrenceSettings = {
      frequency: recurrenceFrequency,
      daysOfWeek: recurrence.daysOfWeek || recurrence.days_of_week || [],
      dayOfMonth: recurrence.dayOfMonth ?? recurrence.day_of_month ?? null,
      weekOfMonth: recurrence.weekOfMonth || recurrence.week_of_month || '',
      weekday: recurrence.weekday || '',
      intervalWeeks: recurrence.intervalWeeks || recurrence.interval_weeks || recurrence.interval || (recurrenceFrequency === 'biweekly' ? 2 : 1),
    };

    const occurrenceDates = recurrenceEnabled
      ? generateOccurrenceDates(dateOnly, recurrenceSettings, recurrenceCount)
      : [dateOnly];

    const tempEvents = occurrenceDates.map((occurrenceDate, index) => ({
      ...eventData,
      id: `temp-${Date.now()}-${index}`,
      date: occurrenceDate,
      time: timePart,
      bookingStartAt: moveIsoToDate(baseStartAt, occurrenceDate),
      bookingEndAt: moveIsoToDate(baseEndAt, occurrenceDate),
      recurrenceIndex: index + 1,
      recurrenceCount,
      createdAt: new Date().toISOString(),
    }));
    const tempIds = new Set(tempEvents.map(e => e.id));
    setEvents(prev => [...prev, ...tempEvents]);

    if (!user?.id) return tempEvents[0];

    try {
      let seriesId = null;
      let seriesName = '';

      if (recurrenceEnabled && recurrenceCount > 1) {
        const createdSeries = await createEventSeries({
          user_id: user.id,
          name: recurrence.seriesName || `${eventData.title || 'Event'} Series`,
          recurrence: {
            enabled: true,
            frequency: recurrenceFrequency,
            count: recurrenceCount,
            startDate: dateOnly,
            daysOfWeek: recurrenceSettings.daysOfWeek,
            dayOfMonth: recurrenceSettings.dayOfMonth,
            weekOfMonth: recurrenceSettings.weekOfMonth,
            weekday: recurrenceSettings.weekday,
            intervalWeeks: recurrenceSettings.intervalWeeks,
          },
          notes: recurrence.notes || '',
          metadata: {
            source: 'event_create',
          },
        });
        seriesId = createdSeries?.id || null;
        seriesName = createdSeries?.name || '';
        setEventSeries(prev => [createdSeries, ...prev.filter(item => item.id !== createdSeries.id)]);
      }

      const participantIds = (eventData.participantProfileIds || []).filter(Boolean);
      const createdEvents = [];

      for (let index = 0; index < occurrenceDates.length; index += 1) {
        const occurrenceDate = occurrenceDates[index];
        const bookingStartForOccurrence = moveIsoToDate(baseStartAt, occurrenceDate);
        let bookingEndForOccurrence = moveIsoToDate(baseEndAt, occurrenceDate);
        if (baseDurationMs && bookingStartForOccurrence) {
          const shiftedStart = new Date(bookingStartForOccurrence);
          bookingEndForOccurrence = new Date(shiftedStart.getTime() + baseDurationMs).toISOString();
        }

        if (eventData.performanceZoneId && bookingStartForOccurrence && bookingEndForOccurrence) {
          const conflicts = findZoneBookingConflicts([...events, ...createdEvents], {
            zoneId: eventData.performanceZoneId,
            startAt: bookingStartForOccurrence,
            endAt: bookingEndForOccurrence,
          });
          if (conflicts.length) {
            throw new Error(`Zone is already booked: ${formatZoneConflictSummary(conflicts)}`);
          }
        }

        const dbEvent = await createSupabaseEvent({
          user_id: user.id,
          title: eventData.title || '',
          description: eventData.description || '',
          genre: eventData.genre || '',
          date: occurrenceDate || null,
          time: timePart || '',
          venue_name: eventData.venue || '',
          venue_street_number: eventData.venueStreetNumber || '',
          venue_street_name: eventData.venueStreetName || '',
          venue_suite: eventData.venueSuite || '',
          venue_city: eventData.venueCity || 'San Antonio',
          venue_state: eventData.venueState || 'TX',
          venue_zip: eventData.venueZip || '',
          venue_address: eventData.venueAddress || '',
          venue_phone: eventData.venuePhone || '',
          venue_website: eventData.venueWebsite || '',
          ticket_link: eventData.ticketLink || '',
          ticket_price: eventData.ticketPrice && !Number.isNaN(parseFloat(eventData.ticketPrice)) ? parseFloat(eventData.ticketPrice) : null,
          ticket_provider: eventData.ticketProvider || null,
          ticket_provider_event_id: eventData.ticketProviderEventId || null,
          is_free: !eventData.ticketPrice || eventData.ticketPrice === '0' || String(eventData.ticketPrice).toLowerCase() === 'free',
          brand_colors: eventData.brandColors || '',
          writing_tone: eventData.writingTone || '',
          special_instructions: eventData.specialInstructions || '',
          detected_fonts: eventData.detectedFonts || '',
          production_details: eventData.productionDetails || {},
          crew: eventData.crew || [],
          channels: eventData.channels || {},
          performers: eventData.performers || '',
          sponsors: eventData.sponsors || [],
          venue_profile_id: eventData.venueProfileId || null,
          participant_profile_ids: participantIds,
          series_id: seriesId,
          series_name: seriesName,
          recurrence_index: index + 1,
          recurrence_count: recurrenceCount,
          performance_zone_id: eventData.performanceZoneId || null,
          performance_zone_name: eventData.performanceZoneName || '',
          booking_start_at: bookingStartForOccurrence || null,
          booking_end_at: bookingEndForOccurrence || null,
          show_configuration_id: eventData.showConfigurationId || null,
          show_contacts: eventData.showContacts || [],
          stage_plot_document_id: eventData.stagePlotDocumentId || null,
          booking_status: eventData.bookingStatus || 'draft',
        });

        if (participantIds.length) {
          await replaceEventParticipants(dbEvent.id, participantIds.map((participantId, participantIndex) => ({
            participant_id: participantId,
            sort_order: participantIndex + 1,
          })));
        }

        const mappedEvent = mapDbEvent(dbEvent, {
          venueProfileId: eventData.venueProfileId || '',
          participantProfileIds: participantIds,
          seriesId,
          seriesName,
          recurrenceIndex: index + 1,
          recurrenceCount,
          date: occurrenceDate,
          time: timePart,
          bookingStartAt: bookingStartForOccurrence || '',
          bookingEndAt: bookingEndForOccurrence || '',
          stagePlotDocumentId: eventData.stagePlotDocumentId || '',
        });

        if (venue.driveRootFolderId && mappedEvent.id) {
          try {
            const driveResp = await fetch('/api/drive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create-event-folder',
                eventId: mappedEvent.id,
                eventTitle: mappedEvent.title,
                eventDate: mappedEvent.date,
                clientFolderId: venue.driveRootFolderId,
                userEmail: user?.email,
              }),
            });
            const driveData = await driveResp.json();
            if (driveData.success) {
              mappedEvent.driveEventFolderId = driveData.driveEventFolderId;
            }
          } catch (driveErr) {
            console.warn('[VenueContext] Drive folder creation failed:', driveErr.message);
          }
        }

        createdEvents.push(mappedEvent);
      }

      setEvents(prev => [...prev.filter(e => !tempIds.has(e.id)), ...createdEvents]);
      return createdEvents[0];
    } catch (err) {
      console.error('[VenueContext] Failed to create event:', err);
      alert('Failed to create event: ' + err.message);
      setError('Failed to create event: ' + err.message);
      setEvents(prev => prev.filter(e => !tempIds.has(e.id)));
      throw err;
    }
  }, [events, user?.id, user?.email, venue.driveRootFolderId]);

  const updateEvent = useCallback(async (id, data) => {
    const previousEvents = events;
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, ...data } : e)));

    if (!user?.id) return;

    try {
      const dbData = {};
      if (data.title !== undefined) dbData.title = data.title;
      if (data.description !== undefined) dbData.description = data.description;
      if (data.genre !== undefined) dbData.genre = data.genre;
      if (data.date !== undefined) dbData.date = data.date;
      if (data.time !== undefined) dbData.time = data.time;
      if (data.venue !== undefined) dbData.venue_name = data.venue;
      if (data.venueStreetNumber !== undefined) dbData.venue_street_number = data.venueStreetNumber;
      if (data.venueStreetName !== undefined) dbData.venue_street_name = data.venueStreetName;
      if (data.venueSuite !== undefined) dbData.venue_suite = data.venueSuite;
      if (data.venueCity !== undefined) dbData.venue_city = data.venueCity;
      if (data.venueState !== undefined) dbData.venue_state = data.venueState;
      if (data.venueZip !== undefined) dbData.venue_zip = data.venueZip;
      if (data.venueAddress !== undefined) dbData.venue_address = data.venueAddress;
      if (data.ticketLink !== undefined) dbData.ticket_link = data.ticketLink;
      if (data.ticketPrice !== undefined) dbData.ticket_price = data.ticketPrice;
      if (data.ticketProvider !== undefined) dbData.ticket_provider = data.ticketProvider;
      if (data.ticketProviderEventId !== undefined) dbData.ticket_provider_event_id = data.ticketProviderEventId;
      if (data.campaign !== undefined) dbData.campaign = data.campaign;
      if (data.crew !== undefined) dbData.crew = data.crew;
      if (data.channels !== undefined) dbData.channels = data.channels;
      if (data.performers !== undefined) dbData.performers = data.performers;
      if (data.brandColors !== undefined) dbData.brand_colors = data.brandColors;
      if (data.writingTone !== undefined) dbData.writing_tone = data.writingTone;
      if (data.specialInstructions !== undefined) dbData.special_instructions = data.specialInstructions;
      if (data.productionDetails !== undefined) dbData.production_details = data.productionDetails;
      if (data.run_of_show !== undefined) dbData.run_of_show = data.run_of_show;
      if (data.venueProfileId !== undefined) dbData.venue_profile_id = data.venueProfileId;
      if (data.participantProfileIds !== undefined) dbData.participant_profile_ids = data.participantProfileIds;
      if (data.seriesId !== undefined) dbData.series_id = data.seriesId;

      const currentEvent = events.find(event => event.id === id);
      const hasProductionUpdate = (
        data.performanceZoneId !== undefined
        || data.performanceZoneName !== undefined
        || data.bookingStartAt !== undefined
        || data.bookingEndAt !== undefined
        || data.showConfigurationId !== undefined
        || data.showContacts !== undefined
        || data.stagePlotDocumentId !== undefined
        || data.bookingStatus !== undefined
      );
      const effectiveZoneId = data.performanceZoneId !== undefined ? data.performanceZoneId : currentEvent?.performanceZoneId;
      const effectiveStart = data.bookingStartAt !== undefined ? data.bookingStartAt : currentEvent?.bookingStartAt;
      const effectiveEnd = data.bookingEndAt !== undefined ? data.bookingEndAt : currentEvent?.bookingEndAt;
      if (hasProductionUpdate && effectiveZoneId && effectiveStart && effectiveEnd) {
        const conflicts = findZoneBookingConflicts(events, {
          zoneId: effectiveZoneId,
          startAt: effectiveStart,
          endAt: effectiveEnd,
          excludeEventId: id,
        });
        if (conflicts.length) {
          throw new Error(`Zone is already booked: ${formatZoneConflictSummary(conflicts)}`);
        }
      }

      if (hasProductionUpdate) {
        await callProductionAction('assign-booking-production', {
          userId: user.id,
          eventId: id,
          performanceZoneId: effectiveZoneId || null,
          performanceZoneName: data.performanceZoneName !== undefined
            ? data.performanceZoneName
            : (currentEvent?.performanceZoneName || ''),
          bookingStartAt: effectiveStart || null,
          bookingEndAt: effectiveEnd || null,
          showConfigurationId: data.showConfigurationId !== undefined
            ? data.showConfigurationId
            : (currentEvent?.showConfigurationId || null),
          showContacts: data.showContacts !== undefined
            ? data.showContacts
            : (currentEvent?.showContacts || []),
          stagePlotDocumentId: data.stagePlotDocumentId !== undefined
            ? data.stagePlotDocumentId
            : (currentEvent?.stagePlotDocumentId || null),
          bookingStatus: data.bookingStatus !== undefined
            ? data.bookingStatus
            : (currentEvent?.bookingStatus || 'draft'),
        });
      }

      if (Object.keys(dbData).length > 0) {
        await updateSupabaseEvent(id, dbData);
      }

      if (Array.isArray(data.participantProfileIds)) {
        await replaceEventParticipants(id, data.participantProfileIds.map((participantId, index) => ({
          participant_id: participantId,
          sort_order: index + 1,
        })));
      }
    } catch (err) {
      console.error('[VenueContext] Failed to update event:', err);
      setEvents(previousEvents);
    }
  }, [callProductionAction, events, user?.id]);

  const assignBookingProduction = useCallback(async (eventId, productionData = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const previousEvents = events;
    setEvents(prev => prev.map(event => (
      event.id === eventId
        ? {
          ...event,
          ...productionData,
          performanceZoneId: productionData.performanceZoneId ?? event.performanceZoneId,
          performanceZoneName: productionData.performanceZoneName ?? event.performanceZoneName,
          bookingStartAt: productionData.bookingStartAt ?? event.bookingStartAt,
          bookingEndAt: productionData.bookingEndAt ?? event.bookingEndAt,
          showConfigurationId: productionData.showConfigurationId ?? event.showConfigurationId,
          showContacts: productionData.showContacts ?? event.showContacts,
          stagePlotDocumentId: productionData.stagePlotDocumentId ?? event.stagePlotDocumentId,
          bookingStatus: productionData.bookingStatus ?? event.bookingStatus,
        }
        : event
    )));

    if (!user?.id) return;

    try {
      const response = await callProductionAction('assign-booking-production', {
        userId: user.id,
        eventId,
        ...productionData,
      });
      const updated = response.event;
      if (updated?.id) {
        setEvents(prev => prev.map(event => (
          event.id === eventId
            ? mapDbEvent(updated, {
              venueProfileId: event.venueProfileId || '',
              participantProfileIds: event.participantProfileIds || [],
              seriesId: event.seriesId || '',
              seriesName: event.seriesName || '',
              recurrenceIndex: event.recurrenceIndex || 1,
              recurrenceCount: event.recurrenceCount || 1,
            })
            : event
        )));
      }
      return updated;
    } catch (err) {
      setEvents(previousEvents);
      throw err;
    }
  }, [callProductionAction, events, user?.id]);

  const searchVenueSuggestions = useCallback(async (query, options = {}) => {
    const input = String(query || '').trim();
    if (input.length < 2) return [];
    const response = await callProductionAction('search-venues', {
      userId: user?.id,
      query: input,
      sessionToken: options.sessionToken,
      maxResults: options.maxResults,
    });
    return response?.suggestions || [];
  }, [callProductionAction, user?.id]);

  const getVenuePlaceDetails = useCallback(async (placeId, options = {}) => {
    if (!placeId && !options.localVenueProfileId) {
      throw new Error('placeId or localVenueProfileId is required');
    }
    const response = await callProductionAction('get-venue-details', {
      userId: user?.id,
      placeId: placeId || undefined,
      localVenueProfileId: options.localVenueProfileId,
      sessionToken: options.sessionToken,
      query: options.query,
      fetchSocials: options.fetchSocials !== false,
    });
    return response?.venue || null;
  }, [callProductionAction, user?.id]);

  const listStaffingRequests = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-staffing-requests', {
      userId: user?.id,
      eventId,
    });
    return response?.requests || [];
  }, [callProductionAction, user?.id]);

  const createStaffingRequestRecord = useCallback(async (eventId, request = {}, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('create-staffing-request', {
      userId: user?.id,
      eventId,
      request,
      sendNow: !!options.sendNow,
      event: options.event,
    });
    return response?.request || null;
  }, [callProductionAction, user?.id]);

  const updateStaffingRequestRecord = useCallback(async (requestId, updates = {}, options = {}) => {
    if (!requestId) throw new Error('requestId is required');
    const response = await callProductionAction('update-staffing-request', {
      requestId,
      updates,
      sendNow: !!options.sendNow,
      event: options.event,
    });
    return response?.request || null;
  }, [callProductionAction]);

  const listJobTitles = useCallback(async () => {
    const response = await callProductionAction('get-job-titles', {
      userId: user?.id,
      activeOnly: true,
    });
    return response?.jobTitles || [];
  }, [callProductionAction, user?.id]);

  const seedJobTitleLibrary = useCallback(async () => {
    const response = await callProductionAction('seed-job-titles', {
      userId: user?.id,
    });
    return response?.jobTitles || [];
  }, [callProductionAction, user?.id]);

  const saveJobTitle = useCallback(async (jobTitle = {}) => {
    const response = await callProductionAction('upsert-job-title', {
      userId: user?.id,
      jobTitle,
    });
    return response?.jobTitle || null;
  }, [callProductionAction, user?.id]);

  const removeJobTitle = useCallback(async (jobTitleId) => {
    if (!jobTitleId) throw new Error('jobTitleId is required');
    const response = await callProductionAction('delete-job-title', {
      userId: user?.id,
      jobTitleId,
    });
    return response?.removed === true;
  }, [callProductionAction, user?.id]);

  const listStaffProfiles = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-staff-profiles', {
      userId: user?.id,
      activeOnly: options.activeOnly !== false,
    });
    return response?.staffProfiles || [];
  }, [callProductionAction, user?.id]);

  const parseStaffVoiceProfile = useCallback(async (transcript) => {
    if (!transcript || !String(transcript).trim()) return {};
    const response = await callProductionAction('parse-staff-voice', {
      userId: user?.id,
      transcript,
    });
    return response?.parsed || {};
  }, [callProductionAction, user?.id]);

  const saveStaffProfile = useCallback(async (profile = {}) => {
    const response = await callProductionAction('upsert-staff-profile', {
      userId: user?.id,
      profile,
    });
    return response?.staffProfile || null;
  }, [callProductionAction, user?.id]);

  const removeStaffProfile = useCallback(async (profileId) => {
    if (!profileId) throw new Error('profileId is required');
    const response = await callProductionAction('delete-staff-profile', {
      userId: user?.id,
      profileId,
    });
    return response?.removed === true;
  }, [callProductionAction, user?.id]);

  const listStaffAssignments = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-staff-assignments', {
      userId: user?.id,
      bookingId: eventId,
    });
    return response?.assignments || [];
  }, [callProductionAction, user?.id]);

  const saveStaffAssignment = useCallback(async (eventId, assignment = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-staff-assignment', {
      userId: user?.id,
      bookingId: eventId,
      assignment,
    });
    return response?.assignment || null;
  }, [callProductionAction, user?.id]);

  const removeStaffAssignment = useCallback(async (assignmentId) => {
    if (!assignmentId) throw new Error('assignmentId is required');
    const response = await callProductionAction('delete-staff-assignment', {
      userId: user?.id,
      assignmentId,
    });
    return response?.removed === true;
  }, [callProductionAction, user?.id]);

  const bulkAssignStaffShift = useCallback(async (eventId, payload = {}) => {
    if (!eventId) throw new Error('eventId is required');
    return callProductionAction('bulk-assign-staff-shift', {
      userId: user?.id,
      bookingId: eventId,
      ...payload,
    });
  }, [callProductionAction, user?.id]);

  const publishStaffingSchedule = useCallback(async (eventId, payload = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const event = events.find(item => item.id === eventId);
    return callProductionAction('publish-staffing-schedule', {
      userId: user?.id,
      bookingId: eventId,
      event,
      ...payload,
    });
  }, [callProductionAction, events, user?.id]);

  const getStaffingDashboard = useCallback(async (eventId, options = {}) => {
    if (!eventId) return { coverage: {}, assignments: [] };
    return callProductionAction('get-staffing-dashboard', {
      userId: user?.id,
      bookingId: eventId,
      roleRequirements: options.roleRequirements || [],
    });
  }, [callProductionAction, user?.id]);

  const exportStaffSheet = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    return callProductionAction('export-staff-sheet', {
      userId: user?.id,
      bookingId: eventId,
      mode: options.mode || 'full',
      roleRequirements: options.roleRequirements || [],
    });
  }, [callProductionAction, user?.id]);

  const listEventMessages = useCallback(async (eventId, options = {}) => {
    if (!eventId) return { messages: [], conversation: null };
    return callProductionAction('get-event-messages', {
      userId: user?.id,
      eventId,
      limit: options.limit,
      before: options.before,
    });
  }, [callProductionAction, user?.id]);

  const sendEventMessageRecord = useCallback(async (eventId, message = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('send-event-message', {
      userId: user?.id,
      eventId,
      message,
    });
    return response?.message || null;
  }, [callProductionAction, user?.id]);

  const toggleEventMessageReaction = useCallback(async (messageId, emoji) => {
    if (!messageId) throw new Error('messageId is required');
    if (!emoji) throw new Error('emoji is required');
    return callProductionAction('toggle-message-reaction', {
      userId: user?.id,
      messageId,
      emoji,
    });
  }, [callProductionAction, user?.id]);

  const translateEventMessage = useCallback(async (messageId, targetLanguage = 'es') => {
    if (!messageId) throw new Error('messageId is required');
    return callProductionAction('translate-event-message', {
      userId: user?.id,
      messageId,
      targetLanguage,
    });
  }, [callProductionAction, user?.id]);

  const getEventConversationState = useCallback(async (eventId) => {
    if (!eventId) return null;
    const response = await callProductionAction('get-event-conversation', {
      userId: user?.id,
      eventId,
    });
    return response?.conversation || null;
  }, [callProductionAction, user?.id]);

  const saveEventConversationState = useCallback(async (eventId, conversation = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-event-conversation', {
      userId: user?.id,
      eventId,
      conversation,
    });
    return response?.conversation || null;
  }, [callProductionAction, user?.id]);

  const getVenueStaffingPolicy = useCallback(async (venueProfileId) => {
    if (!venueProfileId) return null;
    const response = await callProductionAction('get-venue-staffing-policy', {
      userId: user?.id,
      venueProfileId,
    });
    return response?.policy || null;
  }, [callProductionAction, user?.id]);

  const saveVenueStaffingPolicy = useCallback(async (venueProfileId, policy = {}) => {
    if (!venueProfileId) throw new Error('venueProfileId is required');
    const response = await callProductionAction('upsert-venue-staffing-policy', {
      userId: user?.id,
      venueProfileId,
      policy,
    });
    return response?.policy || null;
  }, [callProductionAction, user?.id]);

  const listEmergencyContacts = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-emergency-contacts', {
      userId: user?.id,
      staffProfileId: options.staffProfileId || undefined,
      staffProfileIds: Array.isArray(options.staffProfileIds) ? options.staffProfileIds : undefined,
    });
    return response?.contacts || [];
  }, [callProductionAction, user?.id]);

  const saveEmergencyContact = useCallback(async (staffProfileId, contact = {}) => {
    if (!staffProfileId) throw new Error('staffProfileId is required');
    const response = await callProductionAction('upsert-emergency-contact', {
      userId: user?.id,
      staffProfileId,
      contact,
    });
    return response?.contact || null;
  }, [callProductionAction, user?.id]);

  const removeEmergencyContact = useCallback(async (contactId, options = {}) => {
    if (!contactId && !options.staffProfileId) throw new Error('contactId or staffProfileId is required');
    const response = await callProductionAction('delete-emergency-contact', {
      contactId: contactId || undefined,
      staffProfileId: options.staffProfileId || undefined,
    });
    return response?.removed === true;
  }, [callProductionAction]);

  const listTrainingCourses = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-training-courses', {
      userId: user?.id,
      venueProfileId: options.venueProfileId || undefined,
      activeOnly: options.activeOnly !== false,
    });
    return response?.courses || [];
  }, [callProductionAction, user?.id]);

  const saveTrainingCourse = useCallback(async (course = {}, options = {}) => {
    const response = await callProductionAction('upsert-training-course', {
      userId: user?.id,
      venueProfileId: options.venueProfileId || course.venueId || undefined,
      course,
    });
    return response?.course || null;
  }, [callProductionAction, user?.id]);

  const removeTrainingCourse = useCallback(async (courseId) => {
    if (!courseId) throw new Error('courseId is required');
    const response = await callProductionAction('delete-training-course', {
      userId: user?.id,
      courseId,
    });
    return response?.removed === true;
  }, [callProductionAction, user?.id]);

  const listTrainingSessions = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-training-sessions', {
      userId: user?.id,
      courseId: options.courseId || undefined,
      venueId: options.venueId || undefined,
      startFrom: options.startFrom || undefined,
      startTo: options.startTo || undefined,
    });
    return response?.sessions || [];
  }, [callProductionAction, user?.id]);

  const saveTrainingSession = useCallback(async (session = {}, options = {}) => {
    const response = await callProductionAction('upsert-training-session', {
      userId: user?.id,
      courseId: options.courseId || session.trainingCourseId || undefined,
      session,
    });
    return response?.session || null;
  }, [callProductionAction, user?.id]);

  const removeTrainingSession = useCallback(async (sessionId) => {
    if (!sessionId) throw new Error('sessionId is required');
    const response = await callProductionAction('delete-training-session', {
      userId: user?.id,
      sessionId,
    });
    return response?.removed === true;
  }, [callProductionAction, user?.id]);

  const listTrainingEnrollments = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-training-enrollments', {
      userId: user?.id,
      sessionId: options.sessionId || undefined,
      staffProfileId: options.staffProfileId || undefined,
    });
    return response?.enrollments || [];
  }, [callProductionAction, user?.id]);

  const saveTrainingEnrollment = useCallback(async (enrollment = {}, options = {}) => {
    const response = await callProductionAction('upsert-training-enrollment', {
      userId: user?.id,
      sessionId: options.sessionId || enrollment.trainingSessionId || undefined,
      staffProfileId: options.staffProfileId || enrollment.staffProfileId || undefined,
      enrollment,
    });
    return response?.enrollment || null;
  }, [callProductionAction, user?.id]);

  const removeTrainingEnrollment = useCallback(async (enrollmentId) => {
    if (!enrollmentId) throw new Error('enrollmentId is required');
    const response = await callProductionAction('delete-training-enrollment', {
      userId: user?.id,
      enrollmentId,
    });
    return response?.removed === true;
  }, [callProductionAction, user?.id]);

  const sendTrainingReminderBatch = useCallback(async (options = {}) => (
    callProductionAction('send-training-reminders', {
      userId: user?.id,
      withinHours: options.withinHours || undefined,
    })
  ), [callProductionAction, user?.id]);

  const listCertificationTypes = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-certification-types', {
      userId: user?.id,
      activeOnly: options.activeOnly !== false,
    });
    return response?.types || [];
  }, [callProductionAction, user?.id]);

  const seedCertificationLibrary = useCallback(async () => (
    callProductionAction('seed-certification-types', { userId: user?.id })
  ), [callProductionAction, user?.id]);

  const saveCertificationType = useCallback(async (type = {}) => {
    const response = await callProductionAction('upsert-certification-type', {
      userId: user?.id,
      type,
    });
    return response?.type || null;
  }, [callProductionAction, user?.id]);

  const removeCertificationType = useCallback(async (typeId) => {
    if (!typeId) throw new Error('typeId is required');
    const response = await callProductionAction('delete-certification-type', { typeId });
    return response?.removed === true;
  }, [callProductionAction]);

  const listStaffCertifications = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-staff-certifications', {
      userId: user?.id,
      staffProfileId: options.staffProfileId || undefined,
      thresholdDays: options.thresholdDays || undefined,
    });
    return response?.certifications || [];
  }, [callProductionAction, user?.id]);

  const saveStaffCertification = useCallback(async (certification = {}, options = {}) => {
    const response = await callProductionAction('upsert-staff-certification', {
      userId: user?.id,
      staffProfileId: options.staffProfileId || certification.staffProfileId || undefined,
      certificationTypeId: options.certificationTypeId || certification.certificationTypeId || undefined,
      certification,
    });
    return response?.certification || null;
  }, [callProductionAction, user?.id]);

  const removeStaffCertification = useCallback(async (certificationId) => {
    if (!certificationId) throw new Error('certificationId is required');
    const response = await callProductionAction('delete-staff-certification', {
      userId: user?.id,
      certificationId,
    });
    return response?.removed === true;
  }, [callProductionAction, user?.id]);

  const sendCertificationReminderBatch = useCallback(async (options = {}) => (
    callProductionAction('send-certification-reminders', {
      userId: user?.id,
      thresholdDays: options.thresholdDays || undefined,
    })
  ), [callProductionAction, user?.id]);

  const generateTimeClockQrCode = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    return callProductionAction('generate-time-clock-qr', {
      userId: user?.id,
      bookingId: eventId,
      zoneId: options.zoneId || undefined,
      expiresMinutes: options.expiresMinutes || undefined,
      scanBaseUrl: options.scanBaseUrl || undefined,
    });
  }, [callProductionAction, user?.id]);

  const scanTimeClockQr = useCallback(async (payload = {}) => (
    callProductionAction('time-clock-scan', payload)
  ), [callProductionAction]);

  const overrideTimeClockShift = useCallback(async (shiftId, updates = {}) => {
    if (!shiftId) throw new Error('shiftId is required');
    return callProductionAction('override-time-clock-shift', {
      userId: user?.id,
      shiftId,
      ...updates,
    });
  }, [callProductionAction, user?.id]);

  const listTimeClockShifts = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-time-clock-shifts', {
      userId: user?.id,
      bookingId: options.eventId || options.bookingId || undefined,
      staffProfileId: options.staffProfileId || undefined,
      assignmentId: options.assignmentId || undefined,
      startFrom: options.startFrom || undefined,
      startTo: options.startTo || undefined,
    });
    return response?.shifts || [];
  }, [callProductionAction, user?.id]);

  const getPayrollExport = useCallback(async (options = {}) => (
    callProductionAction('get-payroll-export', {
      userId: user?.id,
      bookingId: options.eventId || options.bookingId || undefined,
      startFrom: options.startFrom || undefined,
      startTo: options.startTo || undefined,
      groupBy: options.groupBy || undefined,
    })
  ), [callProductionAction, user?.id]);

  const exportPayrollCsv = useCallback(async (options = {}) => (
    callProductionAction('export-payroll-csv', {
      userId: user?.id,
      bookingId: options.eventId || options.bookingId || undefined,
      startFrom: options.startFrom || undefined,
      startTo: options.startTo || undefined,
    })
  ), [callProductionAction, user?.id]);

  const getVolunteerHoursReport = useCallback(async (options = {}) => (
    callProductionAction('get-volunteer-hours-report', {
      userId: user?.id,
      bookingId: options.eventId || options.bookingId || undefined,
      startFrom: options.startFrom || undefined,
      startTo: options.startTo || undefined,
    })
  ), [callProductionAction, user?.id]);

  const listCompletionTasks = useCallback(async (options = {}) => {
    const response = await callProductionAction('list-completion-tasks', {
      userId: user?.id,
      status: options.status || undefined,
      includeCompleted: options.includeCompleted === true,
      entityType: options.entityType || undefined,
    });
    return response?.tasks || [];
  }, [callProductionAction, user?.id]);

  const createCompletionTask = useCallback(async (task = {}) => {
    const response = await callProductionAction('create-completion-task', {
      userId: user?.id,
      task,
    });
    return response?.task || null;
  }, [callProductionAction, user?.id]);

  const updateCompletionTask = useCallback(async (taskId, updates = {}) => {
    if (!taskId) throw new Error('taskId is required');
    const response = await callProductionAction('update-completion-task', {
      userId: user?.id,
      taskId,
      updates,
    });
    return response?.task || null;
  }, [callProductionAction, user?.id]);

  const sendCompletionReminderBatch = useCallback(async () => (
    callProductionAction('send-completion-reminders', { userId: user?.id })
  ), [callProductionAction, user?.id]);

  const logAiAssistRun = useCallback(async (payload = {}) => (
    callProductionAction('log-ai-assist-run', {
      userId: user?.id,
      ...payload,
    })
  ), [callProductionAction, user?.id]);

  const getTicketingSnapshots = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-ticketing-snapshots', {
      userId: user?.id,
      eventId,
    });
    return response?.snapshots || [];
  }, [callProductionAction, user?.id]);

  const syncEventTicketing = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const event = events.find(item => item.id === eventId);
    const response = await callProductionAction('sync-ticketing', {
      userId: user?.id,
      eventId,
      provider: options.provider,
      providerEventId: options.providerEventId,
      event,
    });
    const updated = response?.event;
    if (updated?.id) {
      setEvents(prev => prev.map(item => (
        item.id === updated.id ? mapDbEvent(updated, {
          venueProfileId: item.venueProfileId || '',
          participantProfileIds: item.participantProfileIds || [],
          seriesId: item.seriesId || '',
          seriesName: item.seriesName || '',
          recurrenceIndex: item.recurrenceIndex || 1,
          recurrenceCount: item.recurrenceCount || 1,
        }) : item
      )));
    }
    return response;
  }, [callProductionAction, events, user?.id]);

  const getTicketingProviders = useCallback(async () => {
    const response = await callProductionAction('get-ticketing-providers', {
      userId: user?.id,
    });
    return response?.providers || [];
  }, [callProductionAction, user?.id]);

  const listVenueTicketingConnections = useCallback(async (venueProfileId) => {
    if (!venueProfileId) return [];
    const response = await callProductionAction('get-venue-ticketing-connections', {
      userId: user?.id,
      venueProfileId,
    });
    return response?.connections || [];
  }, [callProductionAction, user?.id]);

  const saveVenueTicketingConnection = useCallback(async (venueProfileId, connection = {}) => {
    if (!venueProfileId) throw new Error('venueProfileId is required');
    const response = await callProductionAction('upsert-venue-ticketing-connection', {
      userId: user?.id,
      venueProfileId,
      connection,
    });
    return response?.connection || null;
  }, [callProductionAction, user?.id]);

  const removeVenueTicketingConnection = useCallback(async (connectionId) => {
    if (!connectionId) throw new Error('connectionId is required');
    const response = await callProductionAction('remove-venue-ticketing-connection', { connectionId });
    return response?.removed === true;
  }, [callProductionAction]);

  const listBookingTicketingRecords = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-booking-ticketing-records', {
      userId: user?.id,
      bookingId: eventId,
    });
    return response?.records || [];
  }, [callProductionAction, user?.id]);

  const createBookingTicketingEventRecord = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const event = events.find(item => item.id === eventId);
    const response = await callProductionAction('create-booking-ticketing-event', {
      userId: user?.id,
      bookingId: eventId,
      event,
      ...options,
    });
    const updated = response?.event;
    if (updated?.id) {
      setEvents(prev => prev.map(item => (
        item.id === updated.id ? mapDbEvent(updated, {
          venueProfileId: item.venueProfileId || '',
          participantProfileIds: item.participantProfileIds || [],
          seriesId: item.seriesId || '',
          seriesName: item.seriesName || '',
          recurrenceIndex: item.recurrenceIndex || 1,
          recurrenceCount: item.recurrenceCount || 1,
        }) : item
      )));
    }
    return response;
  }, [callProductionAction, events, user?.id]);

  const linkBookingTicketingEventRecord = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const event = events.find(item => item.id === eventId);
    const response = await callProductionAction('link-booking-ticketing-event', {
      userId: user?.id,
      bookingId: eventId,
      event,
      ...options,
    });
    const updated = response?.event;
    if (updated?.id) {
      setEvents(prev => prev.map(item => (
        item.id === updated.id ? mapDbEvent(updated, {
          venueProfileId: item.venueProfileId || '',
          participantProfileIds: item.participantProfileIds || [],
          seriesId: item.seriesId || '',
          seriesName: item.seriesName || '',
          recurrenceIndex: item.recurrenceIndex || 1,
          recurrenceCount: item.recurrenceCount || 1,
        }) : item
      )));
    }
    return response;
  }, [callProductionAction, events, user?.id]);

  const syncBookingTicketingRecordData = useCallback(async (recordId, options = {}) => {
    if (!recordId) throw new Error('recordId is required');
    const response = await callProductionAction('sync-booking-ticketing-record', {
      userId: user?.id,
      recordId,
      ...options,
    });
    const updated = response?.event;
    if (updated?.id) {
      setEvents(prev => prev.map(item => (
        item.id === updated.id ? mapDbEvent(updated, {
          venueProfileId: item.venueProfileId || '',
          participantProfileIds: item.participantProfileIds || [],
          seriesId: item.seriesId || '',
          seriesName: item.seriesName || '',
          recurrenceIndex: item.recurrenceIndex || 1,
          recurrenceCount: item.recurrenceCount || 1,
        }) : item
      )));
    }
    return response;
  }, [callProductionAction, user?.id]);

  const listProductionChecklists = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-production-checklists', {
      userId: user?.id,
      eventId,
    });
    return response?.checklists || [];
  }, [callProductionAction, user?.id]);

  const saveProductionChecklist = useCallback(async (eventId, checklist = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-production-checklist', {
      userId: user?.id,
      eventId,
      checklist,
    });
    return response?.checklist || null;
  }, [callProductionAction, user?.id]);

  const saveProductionChecklistItem = useCallback(async (checklistId, item = {}) => {
    if (!checklistId) throw new Error('checklistId is required');
    const response = await callProductionAction('upsert-production-checklist-item', {
      checklistId,
      item,
    });
    return response?.item || null;
  }, [callProductionAction]);

  const removeProductionChecklistItem = useCallback(async (itemId) => {
    if (!itemId) throw new Error('itemId is required');
    const response = await callProductionAction('delete-production-checklist-item', { itemId });
    return response?.removed === true;
  }, [callProductionAction]);

  const listVenueInventory = useCallback(async (venueProfileId) => {
    if (!venueProfileId) return [];
    const response = await callProductionAction('get-venue-inventory', {
      userId: user?.id,
      venueProfileId,
    });
    return response?.inventory || [];
  }, [callProductionAction, user?.id]);

  const saveVenueInventoryItem = useCallback(async (venueProfileId, item = {}) => {
    if (!venueProfileId) throw new Error('venueProfileId is required');
    const response = await callProductionAction('upsert-venue-inventory-item', {
      userId: user?.id,
      venueProfileId,
      item,
    });
    return response?.item || null;
  }, [callProductionAction, user?.id]);

  const searchSupplierSuggestions = useCallback(async (query, options = {}) => {
    const input = String(query || '').trim();
    if (input.length < 2) return [];
    const response = await callProductionAction('search-suppliers', {
      userId: user?.id,
      query: input,
      venueProfileId: options.venueProfileId || options.venue_profile_id || undefined,
      sessionToken: options.sessionToken,
      maxResults: options.maxResults,
    });
    return response?.suggestions || [];
  }, [callProductionAction, user?.id]);

  const getSupplierPlaceDetails = useCallback(async (placeId, options = {}) => {
    if (!placeId) throw new Error('placeId is required');
    const response = await callProductionAction('get-supplier-details', {
      userId: user?.id,
      placeId,
      sessionToken: options.sessionToken,
    });
    return response?.supplier || null;
  }, [callProductionAction, user?.id]);

  const listVenueSuppliers = useCallback(async (venueProfileId, options = {}) => {
    if (!venueProfileId) return [];
    const response = await callProductionAction('get-venue-suppliers', {
      userId: user?.id,
      venueProfileId,
      supplierType: options.supplierType || undefined,
      activeOnly: options.activeOnly === true,
    });
    return response?.suppliers || [];
  }, [callProductionAction, user?.id]);

  const saveVenueSupplier = useCallback(async (venueProfileId, supplier = {}) => {
    if (!venueProfileId) throw new Error('venueProfileId is required');
    const response = await callProductionAction('upsert-venue-supplier', {
      userId: user?.id,
      venueProfileId,
      supplier,
    });
    return response?.supplier || null;
  }, [callProductionAction, user?.id]);

  const removeVenueSupplier = useCallback(async (supplierId) => {
    if (!supplierId) throw new Error('supplierId is required');
    const response = await callProductionAction('delete-venue-supplier', { supplierId });
    return response?.removed === true;
  }, [callProductionAction]);

  const listSupplierContacts = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-supplier-contacts', {
      supplierId: options.supplierId || undefined,
      venueProfileId: options.venueProfileId || undefined,
    });
    return response?.contacts || [];
  }, [callProductionAction]);

  const saveSupplierContact = useCallback(async (supplierId, contact = {}) => {
    if (!supplierId) throw new Error('supplierId is required');
    const response = await callProductionAction('upsert-supplier-contact', {
      supplierId,
      contact,
    });
    return response?.contact || null;
  }, [callProductionAction]);

  const removeSupplierContact = useCallback(async (contactId) => {
    if (!contactId) throw new Error('contactId is required');
    const response = await callProductionAction('delete-supplier-contact', { contactId });
    return response?.removed === true;
  }, [callProductionAction]);

  const listInventorySupplierLinks = useCallback(async (options = {}) => {
    const response = await callProductionAction('get-inventory-supplier-links', {
      userId: user?.id,
      venueProfileId: options.venueProfileId || undefined,
      inventoryItemId: options.inventoryItemId || undefined,
    });
    return response?.links || [];
  }, [callProductionAction, user?.id]);

  const saveInventorySupplierLink = useCallback(async (link = {}) => {
    const response = await callProductionAction('upsert-inventory-supplier-link', {
      userId: user?.id,
      link,
    });
    return response?.link || null;
  }, [callProductionAction, user?.id]);

  const removeInventorySupplierLink = useCallback(async (linkId) => {
    if (!linkId) throw new Error('linkId is required');
    const response = await callProductionAction('delete-inventory-supplier-link', { linkId });
    return response?.removed === true;
  }, [callProductionAction]);

  const listBookingPurchaseOrders = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-booking-purchase-orders', {
      userId: user?.id,
      bookingId: eventId,
    });
    return response?.purchaseOrders || [];
  }, [callProductionAction, user?.id]);

  const saveBookingPurchaseOrder = useCallback(async (eventId, purchaseOrder = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-booking-purchase-order', {
      userId: user?.id,
      bookingId: eventId,
      purchaseOrder,
    });
    return response?.purchaseOrder || null;
  }, [callProductionAction, user?.id]);

  const splitBookingPurchaseOrdersBySupplier = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    return callProductionAction('split-booking-purchase-orders', {
      userId: user?.id,
      bookingId: eventId,
      ...options,
    });
  }, [callProductionAction, user?.id]);

  const generatePurchaseOrderEmails = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    return callProductionAction('generate-po-supplier-emails', {
      userId: user?.id,
      bookingId: eventId,
      ...options,
    });
  }, [callProductionAction, user?.id]);

  const listVenueMaintenance = useCallback(async (venueProfileId) => {
    if (!venueProfileId) return { contacts: [], tasks: [] };
    const response = await callProductionAction('get-venue-maintenance', {
      userId: user?.id,
      venueProfileId,
    });
    return {
      contacts: response?.contacts || [],
      tasks: response?.tasks || [],
    };
  }, [callProductionAction, user?.id]);

  const saveVenueMaintenanceContact = useCallback(async (venueProfileId, contact = {}) => {
    if (!venueProfileId) throw new Error('venueProfileId is required');
    const response = await callProductionAction('upsert-venue-maintenance-contact', {
      userId: user?.id,
      venueProfileId,
      contact,
    });
    return response?.contact || null;
  }, [callProductionAction, user?.id]);

  const saveVenueMaintenanceTask = useCallback(async (venueProfileId, task = {}) => {
    if (!venueProfileId) throw new Error('venueProfileId is required');
    const response = await callProductionAction('upsert-venue-maintenance-task', {
      userId: user?.id,
      venueProfileId,
      task,
    });
    return response?.task || null;
  }, [callProductionAction, user?.id]);

  const listBookingDocuments = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-booking-documents', {
      userId: user?.id,
      eventId,
    });
    return response?.documents || [];
  }, [callProductionAction, user?.id]);

  const saveBookingDocument = useCallback(async (eventId, document = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-booking-document', {
      userId: user?.id,
      eventId,
      document,
    });
    return response?.document || null;
  }, [callProductionAction, user?.id]);

  const autofillBookingDocumentTemplate = useCallback(async (eventId, templateId, autofill = {}) => {
    if (!eventId) throw new Error('eventId is required');
    if (!templateId) throw new Error('templateId is required');
    return callProductionAction('autofill-booking-document', {
      userId: user?.id,
      eventId,
      templateId,
      autofill,
    });
  }, [callProductionAction, user?.id]);

  const listBookingBudgets = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-booking-budgets', {
      userId: user?.id,
      eventId,
    });
    return response?.budgets || [];
  }, [callProductionAction, user?.id]);

  const saveBookingBudget = useCallback(async (eventId, budget = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-booking-budget', {
      userId: user?.id,
      eventId,
      budget,
    });
    return response?.budget || null;
  }, [callProductionAction, user?.id]);

  const saveBookingBudgetLine = useCallback(async (budgetId, line = {}) => {
    if (!budgetId) throw new Error('budgetId is required');
    const response = await callProductionAction('upsert-booking-budget-line', {
      budgetId,
      line,
    });
    return response?.line || null;
  }, [callProductionAction]);

  const listBookingRiders = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-booking-riders', {
      userId: user?.id,
      eventId,
    });
    return response?.riders || [];
  }, [callProductionAction, user?.id]);

  const saveBookingRider = useCallback(async (eventId, rider = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-booking-rider', {
      userId: user?.id,
      eventId,
      rider,
    });
    return response?.rider || null;
  }, [callProductionAction, user?.id]);

  const saveBookingRiderItem = useCallback(async (riderId, item = {}) => {
    if (!riderId) throw new Error('riderId is required');
    const response = await callProductionAction('upsert-booking-rider-item', {
      riderId,
      item,
    });
    return response?.item || null;
  }, [callProductionAction]);

  const getMediaCapturePlan = useCallback(async (eventId) => {
    if (!eventId) return null;
    const response = await callProductionAction('get-media-capture-plan', {
      userId: user?.id,
      eventId,
    });
    return response?.plan || null;
  }, [callProductionAction, user?.id]);

  const saveMediaCapturePlan = useCallback(async (eventId, plan = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-media-capture-plan', {
      userId: user?.id,
      eventId,
      plan,
    });
    return response?.plan || null;
  }, [callProductionAction, user?.id]);

  const listCaptureSources = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-capture-sources', {
      userId: user?.id,
      eventId,
    });
    return response?.sources || [];
  }, [callProductionAction, user?.id]);

  const saveCaptureSource = useCallback(async (eventId, source = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-capture-source', {
      userId: user?.id,
      eventId,
      source,
    });
    return response?.source || null;
  }, [callProductionAction, user?.id]);

  const removeCaptureSource = useCallback(async (sourceId) => {
    if (!sourceId) throw new Error('sourceId is required');
    const response = await callProductionAction('delete-capture-source', { sourceId });
    return response?.removed === true;
  }, [callProductionAction]);

  const getZoomMeetingConfig = useCallback(async (eventId) => {
    if (!eventId) return null;
    const response = await callProductionAction('get-zoom-meeting-config', {
      userId: user?.id,
      eventId,
    });
    return response?.config || null;
  }, [callProductionAction, user?.id]);

  const saveZoomMeetingConfig = useCallback(async (eventId, config = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-zoom-meeting-config', {
      userId: user?.id,
      eventId,
      config,
    });
    return response?.config || null;
  }, [callProductionAction, user?.id]);

  const createZoomMeeting = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const event = events.find(item => item.id === eventId);
    return callProductionAction('create-zoom-meeting', {
      userId: user?.id,
      eventId,
      event,
      ...options,
    });
  }, [callProductionAction, events, user?.id]);

  const linkZoomMeeting = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('link-zoom-meeting', {
      userId: user?.id,
      eventId,
      ...options,
    });
    return response?.config || null;
  }, [callProductionAction, user?.id]);

  const listZoomAssets = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-zoom-assets', {
      userId: user?.id,
      eventId,
    });
    return response?.assets || [];
  }, [callProductionAction, user?.id]);

  const saveZoomAsset = useCallback(async (eventId, asset = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-zoom-asset', {
      userId: user?.id,
      eventId,
      asset,
    });
    return response?.asset || null;
  }, [callProductionAction, user?.id]);

  const getYouTubeDistribution = useCallback(async (eventId) => {
    if (!eventId) return null;
    const response = await callProductionAction('get-youtube-distribution', {
      userId: user?.id,
      eventId,
    });
    return response?.distribution || null;
  }, [callProductionAction, user?.id]);

  const saveYouTubeDistribution = useCallback(async (eventId, distribution = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-youtube-distribution', {
      userId: user?.id,
      eventId,
      distribution,
    });
    return response?.distribution || null;
  }, [callProductionAction, user?.id]);

  const publishZoomRecordingToYouTube = useCallback(async (eventId, distribution = {}) => {
    if (!eventId) throw new Error('eventId is required');
    return callProductionAction('publish-zoom-recording-to-youtube', {
      userId: user?.id,
      eventId,
      distribution,
    });
  }, [callProductionAction, user?.id]);

  const getConcessionsPlan = useCallback(async (eventId) => {
    if (!eventId) return null;
    const response = await callProductionAction('get-concessions-plan', {
      userId: user?.id,
      eventId,
    });
    return response?.plan || null;
  }, [callProductionAction, user?.id]);

  const saveConcessionsPlan = useCallback(async (eventId, plan = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-concessions-plan', {
      userId: user?.id,
      eventId,
      plan,
    });
    return response?.plan || null;
  }, [callProductionAction, user?.id]);

  const listConcessionsMenuItems = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-concessions-menu-items', {
      userId: user?.id,
      eventId,
    });
    return response?.items || [];
  }, [callProductionAction, user?.id]);

  const saveConcessionsMenuItem = useCallback(async (eventId, item = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-concessions-menu-item', {
      userId: user?.id,
      eventId,
      item,
    });
    return response?.item || null;
  }, [callProductionAction, user?.id]);

  const removeConcessionsMenuItem = useCallback(async (itemId) => {
    if (!itemId) throw new Error('itemId is required');
    const response = await callProductionAction('delete-concessions-menu-item', { itemId });
    return response?.removed === true;
  }, [callProductionAction]);

  const getMerchPlan = useCallback(async (eventId) => {
    if (!eventId) return null;
    const response = await callProductionAction('get-merch-plan', {
      userId: user?.id,
      eventId,
    });
    return response?.plan || null;
  }, [callProductionAction, user?.id]);

  const saveMerchPlan = useCallback(async (eventId, plan = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-merch-plan', {
      userId: user?.id,
      eventId,
      plan,
    });
    return response?.plan || null;
  }, [callProductionAction, user?.id]);

  const listMerchParticipants = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-merch-participants', {
      userId: user?.id,
      eventId,
    });
    return response?.participants || [];
  }, [callProductionAction, user?.id]);

  const saveMerchParticipant = useCallback(async (eventId, participant = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-merch-participant', {
      userId: user?.id,
      eventId,
      participant,
    });
    return response?.participant || null;
  }, [callProductionAction, user?.id]);

  const removeMerchParticipant = useCallback(async (participantId) => {
    if (!participantId) throw new Error('participantId is required');
    const response = await callProductionAction('delete-merch-participant', { participantId });
    return response?.removed === true;
  }, [callProductionAction]);

  const listMerchRevenueSplits = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-merch-revenue-split', {
      userId: user?.id,
      eventId,
    });
    return response?.splits || [];
  }, [callProductionAction, user?.id]);

  const saveMerchRevenueSplit = useCallback(async (eventId, split = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-merch-revenue-split', {
      userId: user?.id,
      eventId,
      split,
    });
    return response?.split || null;
  }, [callProductionAction, user?.id]);

  const getCostumePlan = useCallback(async (eventId) => {
    if (!eventId) return { plan: null, characters: [] };
    return callProductionAction('get-costume-plan', {
      userId: user?.id,
      eventId,
    });
  }, [callProductionAction, user?.id]);

  const saveCostumePlan = useCallback(async (eventId, plan = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-costume-plan', {
      userId: user?.id,
      eventId,
      plan,
    });
    return response?.plan || null;
  }, [callProductionAction, user?.id]);

  const saveCostumeCharacter = useCallback(async (eventId, character = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-costume-character', {
      userId: user?.id,
      eventId,
      character,
    });
    return response?.character || null;
  }, [callProductionAction, user?.id]);

  const removeCostumeCharacter = useCallback(async (characterId) => {
    if (!characterId) throw new Error('characterId is required');
    const response = await callProductionAction('delete-costume-character', { characterId });
    return response?.removed === true;
  }, [callProductionAction]);

  const getSetPlan = useCallback(async (eventId) => {
    if (!eventId) return { plan: null, elements: [] };
    return callProductionAction('get-set-plan', {
      userId: user?.id,
      eventId,
    });
  }, [callProductionAction, user?.id]);

  const saveSetPlan = useCallback(async (eventId, plan = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-set-plan', {
      userId: user?.id,
      eventId,
      plan,
    });
    return response?.plan || null;
  }, [callProductionAction, user?.id]);

  const saveSetElement = useCallback(async (eventId, element = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-set-element', {
      userId: user?.id,
      eventId,
      element,
    });
    return response?.element || null;
  }, [callProductionAction, user?.id]);

  const removeSetElement = useCallback(async (elementId) => {
    if (!elementId) throw new Error('elementId is required');
    const response = await callProductionAction('delete-set-element', { elementId });
    return response?.removed === true;
  }, [callProductionAction]);

  const getParkingPlan = useCallback(async (eventId) => {
    if (!eventId) return { plan: null, assets: [], assignments: [] };
    return callProductionAction('get-parking-plan', {
      userId: user?.id,
      eventId,
    });
  }, [callProductionAction, user?.id]);

  const saveParkingPlan = useCallback(async (eventId, plan = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-parking-plan', {
      userId: user?.id,
      eventId,
      plan,
    });
    return response?.plan || null;
  }, [callProductionAction, user?.id]);

  const saveParkingAsset = useCallback(async (eventId, asset = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-parking-asset', {
      userId: user?.id,
      eventId,
      asset,
    });
    return response?.asset || null;
  }, [callProductionAction, user?.id]);

  const removeParkingAsset = useCallback(async (assetId) => {
    if (!assetId) throw new Error('assetId is required');
    const response = await callProductionAction('delete-parking-asset', { assetId });
    return response?.removed === true;
  }, [callProductionAction]);

  const saveParkingAssignment = useCallback(async (eventId, assignment = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('upsert-parking-assignment', {
      userId: user?.id,
      eventId,
      assignment,
    });
    return response?.assignment || null;
  }, [callProductionAction, user?.id]);

  const removeParkingAssignment = useCallback(async (assignmentId) => {
    if (!assignmentId) throw new Error('assignmentId is required');
    const response = await callProductionAction('delete-parking-assignment', { assignmentId });
    return response?.removed === true;
  }, [callProductionAction]);

  const listDressingRooms = useCallback(async (venueProfileId, options = {}) => {
    if (!venueProfileId) return [];
    const response = await callProductionAction('get-dressing-rooms', {
      userId: options.userId || user?.id,
      venueProfileId,
      zoneId: options.zoneId || undefined,
    });
    return response?.dressingRooms || [];
  }, [callProductionAction, user?.id]);

  const saveDressingRoom = useCallback(async (venueProfileId, room = {}) => {
    if (!venueProfileId) throw new Error('venueProfileId is required');
    const response = await callProductionAction('upsert-dressing-room', {
      userId: user?.id,
      venueProfileId,
      room,
    });
    return response?.room || null;
  }, [callProductionAction, user?.id]);

  const removeDressingRoom = useCallback(async (roomId) => {
    if (!roomId) throw new Error('roomId is required');
    const response = await callProductionAction('delete-dressing-room', { roomId });
    return response?.removed === true;
  }, [callProductionAction]);

  const listDressingRoomAssignments = useCallback(async (bookingId) => {
    if (!bookingId) return [];
    const response = await callProductionAction('get-dressing-room-assignments', {
      bookingId,
    });
    return response?.assignments || [];
  }, [callProductionAction]);

  const saveDressingRoomAssignment = useCallback(async (bookingId, assignment = {}) => {
    if (!bookingId) throw new Error('bookingId is required');
    const response = await callProductionAction('upsert-dressing-room-assignment', {
      userId: user?.id,
      bookingId,
      assignment,
    });
    return response?.assignment || null;
  }, [callProductionAction, user?.id]);

  const removeDressingRoomAssignment = useCallback(async (assignmentId) => {
    if (!assignmentId) throw new Error('assignmentId is required');
    const response = await callProductionAction('delete-dressing-room-assignment', { assignmentId });
    return response?.removed === true;
  }, [callProductionAction]);

  const exportOperationsPacket = useCallback(async (eventId, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    return callProductionAction('export-operations-packet', {
      userId: user?.id,
      eventId,
      ...options,
    });
  }, [callProductionAction, user?.id]);

  const listShowCheckins = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-show-checkins', {
      userId: user?.id,
      eventId,
    });
    return response?.checkins || [];
  }, [callProductionAction, user?.id]);

  const createShowCheckinRecord = useCallback(async (eventId, checkin = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('create-show-checkin', {
      userId: user?.id,
      eventId,
      checkin,
    });
    return response?.checkin || null;
  }, [callProductionAction, user?.id]);

  const updateShowCheckinRecord = useCallback(async (checkinId, updates = {}, options = {}) => {
    if (!checkinId) throw new Error('checkinId is required');
    const response = await callProductionAction('update-show-checkin', {
      checkinId,
      updates,
      markCheckedIn: !!options.markCheckedIn,
    });
    return response?.checkin || null;
  }, [callProductionAction]);

  const listDealMemos = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-deal-memos', {
      userId: user?.id,
      eventId,
    });
    return response?.dealMemos || [];
  }, [callProductionAction, user?.id]);

  const createDealMemoRecord = useCallback(async (eventId, memo = {}, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('create-deal-memo', {
      userId: user?.id,
      eventId,
      memo,
      sendNow: !!options.sendNow,
    });
    return response;
  }, [callProductionAction, user?.id]);

  const updateDealMemoRecord = useCallback(async (memoId, updates = {}, options = {}) => {
    if (!memoId) throw new Error('memoId is required');
    const response = await callProductionAction('update-deal-memo', {
      memoId,
      updates,
      sendNow: !!options.sendNow,
      bumpVersion: !!options.bumpVersion,
    });
    return response;
  }, [callProductionAction]);

  const exportDealMemoPDF = useCallback(async (memoId, options = {}) => {
    if (!memoId) throw new Error('memoId is required');
    const response = await callProductionAction('export-deal-memo-pdf', {
      memoId,
      persist: options.persist !== false,
    });
    return response;
  }, [callProductionAction]);

  const listSettlementReports = useCallback(async (eventId) => {
    if (!eventId) return [];
    const response = await callProductionAction('get-settlement-reports', {
      userId: user?.id,
      eventId,
    });
    return response?.settlementReports || [];
  }, [callProductionAction, user?.id]);

  const createSettlementReportRecord = useCallback(async (eventId, report = {}, options = {}) => {
    if (!eventId) throw new Error('eventId is required');
    const response = await callProductionAction('create-settlement-report', {
      userId: user?.id,
      eventId,
      report,
      markSubmitted: !!options.markSubmitted,
      markApproved: !!options.markApproved,
    });
    return response?.settlementReport || null;
  }, [callProductionAction, user?.id]);

  const updateSettlementReportRecord = useCallback(async (reportId, updates = {}, options = {}) => {
    if (!reportId) throw new Error('reportId is required');
    const response = await callProductionAction('update-settlement-report', {
      reportId,
      updates,
      markSubmitted: !!options.markSubmitted,
      markApproved: !!options.markApproved,
    });
    return response?.settlementReport || null;
  }, [callProductionAction]);

  const exportSettlementReportFile = useCallback(async (reportId, options = {}) => {
    if (!reportId) throw new Error('reportId is required');
    const response = await callProductionAction('export-settlement-report', {
      reportId,
      persist: options.persist !== false,
    });
    return response;
  }, [callProductionAction]);

  const addCrewMember = (member) => {
    const newMember = { ...member, id: Date.now().toString(), status: 'invited' };
    const updated = [...crew, newMember];
    setCrew(updated);
    localStorage.setItem(CREW_STORAGE_KEY, JSON.stringify(updated));
    return newMember;
  };

  const updateCrewMember = (id, data) => {
    const updated = crew.map(c => (c.id === id ? { ...c, ...data } : c));
    setCrew(updated);
    localStorage.setItem(CREW_STORAGE_KEY, JSON.stringify(updated));
  };

  const removeCrewMember = (id) => {
    const updated = crew.filter(c => c.id !== id);
    setCrew(updated);
    localStorage.setItem(CREW_STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <VenueContext.Provider value={{
      venue,
      saveVenue,
      events,
      addEvent,
      updateEvent,
      assignBookingProduction,
      searchVenueSuggestions,
      getVenuePlaceDetails,
      listStaffingRequests,
      createStaffingRequestRecord,
      updateStaffingRequestRecord,
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
      listEventMessages,
      sendEventMessageRecord,
      toggleEventMessageReaction,
      translateEventMessage,
      getEventConversationState,
      saveEventConversationState,
      getVenueStaffingPolicy,
      saveVenueStaffingPolicy,
      listEmergencyContacts,
      saveEmergencyContact,
      removeEmergencyContact,
      listTrainingCourses,
      saveTrainingCourse,
      removeTrainingCourse,
      listTrainingSessions,
      saveTrainingSession,
      removeTrainingSession,
      listTrainingEnrollments,
      saveTrainingEnrollment,
      removeTrainingEnrollment,
      sendTrainingReminderBatch,
      listCertificationTypes,
      seedCertificationLibrary,
      saveCertificationType,
      removeCertificationType,
      listStaffCertifications,
      saveStaffCertification,
      removeStaffCertification,
      sendCertificationReminderBatch,
      generateTimeClockQrCode,
      scanTimeClockQr,
      overrideTimeClockShift,
      listTimeClockShifts,
      getPayrollExport,
      exportPayrollCsv,
      getVolunteerHoursReport,
      listCompletionTasks,
      createCompletionTask,
      updateCompletionTask,
      sendCompletionReminderBatch,
      logAiAssistRun,
      getTicketingProviders,
      listVenueTicketingConnections,
      saveVenueTicketingConnection,
      removeVenueTicketingConnection,
      listBookingTicketingRecords,
      createBookingTicketingEventRecord,
      linkBookingTicketingEventRecord,
      syncBookingTicketingRecordData,
      getTicketingSnapshots,
      syncEventTicketing,
      listProductionChecklists,
      saveProductionChecklist,
      saveProductionChecklistItem,
      removeProductionChecklistItem,
      listVenueInventory,
      saveVenueInventoryItem,
      searchSupplierSuggestions,
      getSupplierPlaceDetails,
      listVenueSuppliers,
      saveVenueSupplier,
      removeVenueSupplier,
      listSupplierContacts,
      saveSupplierContact,
      removeSupplierContact,
      listInventorySupplierLinks,
      saveInventorySupplierLink,
      removeInventorySupplierLink,
      listBookingPurchaseOrders,
      saveBookingPurchaseOrder,
      splitBookingPurchaseOrdersBySupplier,
      generatePurchaseOrderEmails,
      listVenueMaintenance,
      saveVenueMaintenanceContact,
      saveVenueMaintenanceTask,
      listBookingDocuments,
      saveBookingDocument,
      autofillBookingDocumentTemplate,
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
      saveParkingAsset,
      removeParkingAsset,
      saveParkingAssignment,
      removeParkingAssignment,
      listDressingRooms,
      saveDressingRoom,
      removeDressingRoom,
      listDressingRoomAssignments,
      saveDressingRoomAssignment,
      removeDressingRoomAssignment,
      exportOperationsPacket,
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
      crew,
      addCrewMember,
      updateCrewMember,
      removeCrewMember,
      participantProfiles,
      saveParticipantProfile,
      editParticipantProfile,
      removeParticipantProfile,
      venueProfiles,
      saveVenueProfile,
      editVenueProfile,
      removeVenueProfile,
      performanceZones,
      savePerformanceZone,
      editPerformanceZone,
      removePerformanceZone,
      showConfigurations,
      saveShowConfiguration,
      editShowConfiguration,
      removeShowConfiguration,
      stagePlotDocuments,
      saveStagePlotDocumentData,
      currentUserId: user?.id || null,
      eventSeries,
      loading,
      error,
    }}>
      {children}
    </VenueContext.Provider>
  );
}

export const useVenue = () => useContext(VenueContext);
