import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  getProfile,
  upsertProfile,
  getUserEvents,
  createEvent as createSupabaseEvent,
  updateEvent as updateSupabaseEvent,
} from '../lib/supabase';

const VenueContext = createContext(null);

const defaultVenue = {
  name: '', logo: null, address: '', city: '', state: '', zip: '',
  brandPrimary: '#c8a45e', brandSecondary: '#0d1b2a',
  website: '', facebook: '', instagram: '', twitter: '',
  tiktok: '', youtube: '', spotify: '', linkedin: '',
  onlineMenu: '', squareStore: '', shopifyStore: '', amazonStore: '',
  etsyStore: '', merchStore: '', otherStore: '',
};

export function VenueProvider({ children }) {
  const { user } = useAuth();
  const [venue, setVenue] = useState(defaultVenue);
  const [events, setEvents] = useState([]);
  const [crew, setCrew] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load profile and events from Supabase when user changes
  useEffect(() => {
    if (!user?.id) {
      setVenue(defaultVenue);
      setEvents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch profile and events in parallel
        const [profile, userEvents] = await Promise.all([
          getProfile(user.id).catch(() => null),
          getUserEvents(user.id).catch(() => []),
        ]);

        if (cancelled) return;

        // Map profile to venue state
        if (profile) {
          setVenue({
            // Basic info
            name: profile.venue_name || profile.name || '',
            businessName: profile.name || '',
            
            // Contact info
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            title: profile.title || '',
            workPhone: profile.work_phone || '',
            cellPhone: profile.cell_phone || '',
            email: profile.email || '',
            preferredContact: profile.preferred_contact || 'email',
            
            // Business info  
            dbaName: profile.dba_name || '',
            businessType: profile.business_type || 'venue',
            taxId: profile.tax_id || '',
            yearEstablished: profile.year_established || '',
            
            // Address
            streetNumber: profile.street_number || '',
            streetName: profile.street_name || '',
            suiteNumber: profile.suite_number || '',
            city: profile.city || '',
            state: profile.state || '',
            zipCode: profile.zip_code || profile.postal_code || '',
            country: profile.country || 'US',
            
            // Legacy fields
            address: profile.address || '',
            zip: profile.postal_code || profile.zip_code || '',
            
            // Brand
            logo: profile.logo || null,
            brandPrimary: profile.brand_primary || '#c8a45e',
            brandSecondary: profile.brand_secondary || '#0d1b2a',
            
            // Social links
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
            
            // Venue-specific
            capacity: profile.capacity || '',
            hasStage: profile.has_stage || false,
            hasSound: profile.has_sound || false,
            hasLighting: profile.has_lighting || false,
            parkingType: profile.parking_type || 'street',
            adaAccessible: profile.ada_accessible || false,
            ageRestriction: profile.age_restriction || 'all_ages',
            liquorLicense: profile.liquor_license || false,
            
            // Artist-specific fields
            type: profile.profile_type || profile.type || 'venue',
            stageName: profile.name || '',
            genre: profile.genre || '',
            subgenres: profile.subgenres || [],
            yearsActive: profile.years_active || '',
            recordLabel: profile.record_label || '',
            performingRightsOrg: profile.performing_rights_org || '',
            unionMember: profile.union_member || '',
            bio: profile.bio || profile.description || '',
            hometown: profile.hometown || '',
            
            // Artist management
            managerName: profile.manager_name || '',
            managerEmail: profile.manager_email || '',
            managerPhone: profile.manager_phone || '',
            bookingName: profile.booking_name || '',
            bookingEmail: profile.booking_email || profile.booking_contact || '',
            bookingPhone: profile.booking_phone || '',
            
            // Artist streaming
            headshot: profile.headshot || profile.headshot_url || null,
            bandcamp: profile.bandcamp || profile.bandcamp_url || '',
            soundcloud: profile.soundcloud || profile.soundcloud_url || '',
            appleMusic: profile.apple_music || profile.apple_music_url || '',
            amazonMusic: profile.amazon_music || '',
            pressKit: profile.press_kit || '',
            
            // Artist technical
            hasOwnSound: profile.has_own_sound || false,
            hasOwnLighting: profile.has_own_lighting || false,
            typicalSetLength: profile.typical_set_length || '1hr',
            riderRequirements: profile.rider_requirements || '',
            techRiderUrl: profile.tech_rider_url || '',
            
            // Band members
            label: profile.label || profile.record_label || '',
            members: profile.members || profile.band_members || [],
            
            // Google Drive
            driveRootFolderId: profile.drive_root_folder_id || '',
            driveBrandFolderId: profile.drive_brand_folder_id || '',
          });
        }

        // Map events — normalize field names from snake_case to camelCase
        const mappedEvents = (userEvents || []).map(e => ({
          id: e.id,
          title: e.title || '',
          description: e.description || '',
          genre: e.genre || '',
          date: e.date || '',
          time: e.time || '',
          venue: e.venue_name || '',
          venueStreetNumber: e.venue_street_number || '',
          venueStreetName: e.venue_street_name || '',
          venueSuite: e.venue_suite || '',
          venueCity: e.venue_city || 'San Antonio',
          venueState: e.venue_state || 'TX',
          venueZip: e.venue_zip || '',
          venueAddress: e.venue_address || '', // legacy field
          venuePhone: e.venue_phone || '',
          venueWebsite: e.venue_website || '',
          ticketLink: e.ticket_link || '',
          ticketPrice: e.ticket_price || '',
          brandColors: e.brand_colors || '',
          writingTone: e.writing_tone || '',
          specialInstructions: e.special_instructions || '',
          detectedFonts: e.detected_fonts || '',
          crew: e.crew || [],
          channels: e.channels || {},
          campaign: e.campaign || false,
          performers: e.performers || '',
          driveEventFolderId: e.drive_event_folder_id || '',
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        }));
        setEvents(mappedEvents);
      } catch (err) {
        console.error('[VenueContext] Failed to load data:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    // Load crew from localStorage (no crew table yet)
    const storedCrew = localStorage.getItem('imc_crew');
    if (storedCrew) try { setCrew(JSON.parse(storedCrew)); } catch {}

    return () => { cancelled = true; };
  }, [user?.id]);

  const saveVenue = useCallback(async (data) => {
    const updated = { ...venue, ...data };
    setVenue(updated);

    if (!user?.id) return;

    try {
      await upsertProfile({
        user_id: user.id,
        // Basic info
        venue_name: updated.businessName || updated.stageName || updated.name || '',
        name: updated.businessName || updated.stageName || updated.name || '',
        profile_type: updated.type || 'venue',
        
        // Contact info
        first_name: updated.firstName || '',
        last_name: updated.lastName || '',
        title: updated.title || '',
        work_phone: updated.workPhone || '',
        cell_phone: updated.cellPhone || '',
        email: updated.email || '',
        preferred_contact: updated.preferredContact || 'email',
        
        // Business info
        dba_name: updated.dbaName || '',
        business_type: updated.businessType || 'venue',
        tax_id: updated.taxId || '',
        year_established: updated.yearEstablished || null,
        
        // Address - granular fields
        street_number: updated.streetNumber || '',
        street_name: updated.streetName || '',
        suite_number: updated.suiteNumber || '',
        city: updated.city || '',
        state: updated.state || '',
        zip_code: updated.zipCode || '',
        country: updated.country || 'US',
        
        // Legacy address fields for backward compatibility
        address: updated.address || '',
        postal_code: updated.zipCode || updated.zip || '',
        
        // Brand
        logo: updated.logo || null,
        brand_primary: updated.brandPrimary || '#c8a45e',
        brand_secondary: updated.brandSecondary || '#0d1b2a',
        
        // Social links
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
        
        // Venue-specific
        capacity: updated.capacity || null,
        has_stage: updated.hasStage || false,
        has_sound: updated.hasSound || false,
        has_lighting: updated.hasLighting || false,
        parking_type: updated.parkingType || 'street',
        ada_accessible: updated.adaAccessible || false,
        age_restriction: updated.ageRestriction || 'all_ages',
        liquor_license: updated.liquorLicense || false,
        
        // Artist-specific
        genre: updated.genre || '',
        subgenres: updated.subgenres || [],
        years_active: updated.yearsActive || null,
        record_label: updated.recordLabel || updated.label || '',
        performing_rights_org: updated.performingRightsOrg || '',
        union_member: updated.unionMember || '',
        bio: updated.bio || '',
        description: updated.bio || '',
        hometown: updated.hometown || '',
        
        // Artist management
        manager_name: updated.managerName || '',
        manager_email: updated.managerEmail || '',
        manager_phone: updated.managerPhone || '',
        booking_name: updated.bookingName || '',
        booking_email: updated.bookingEmail || '',
        booking_phone: updated.bookingPhone || '',
        booking_contact: updated.bookingEmail || '',
        
        // Artist streaming  
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
        
        // Artist technical
        has_own_sound: updated.hasOwnSound || false,
        has_own_lighting: updated.hasOwnLighting || false,
        typical_set_length: updated.typicalSetLength || '1hr',
        rider_requirements: updated.riderRequirements || '',
        tech_rider_url: updated.techRiderUrl || '',
        
        // Band members
        members: updated.members || [],
        band_members: updated.members || [],
      });
    } catch (err) {
      console.error('[VenueContext] Failed to save profile:', err);
      setError('Failed to save profile: ' + err.message);
    }
  }, [venue, user?.id]);

  const addEvent = useCallback(async (eventData) => {
    // Create optimistic local event
    const tempId = Date.now().toString();
    const localEvent = { ...eventData, id: tempId, createdAt: new Date().toISOString() };
    setEvents(prev => [...prev, localEvent]);

    if (!user?.id) return localEvent;

    try {
      const dbEvent = await createSupabaseEvent({
        user_id: user.id,
        title: eventData.title || '',
        description: eventData.description || '',
        genre: eventData.genre || '',
        date: eventData.date ? eventData.date.split('T')[0] : null,
        time: eventData.time || (eventData.date && eventData.date.includes('T') ? eventData.date.split('T')[1] : ''),
        venue_name: eventData.venue || '',
        venue_street_number: eventData.venueStreetNumber || '',
        venue_street_name: eventData.venueStreetName || '',
        venue_suite: eventData.venueSuite || '',
        venue_city: eventData.venueCity || 'San Antonio',
        venue_state: eventData.venueState || 'TX',  
        venue_zip: eventData.venueZip || '',
        venue_address: eventData.venueAddress || '', // legacy field
        venue_phone: eventData.venuePhone || '',
        venue_website: eventData.venueWebsite || '',
        ticket_link: eventData.ticketLink || '',
        ticket_price: eventData.ticketPrice && !isNaN(parseFloat(eventData.ticketPrice)) ? parseFloat(eventData.ticketPrice) : null,
        is_free: !eventData.ticketPrice || eventData.ticketPrice === '0' || eventData.ticketPrice.toString().toLowerCase() === 'free',
        brand_colors: eventData.brandColors || '',
        writing_tone: eventData.writingTone || '',
        special_instructions: eventData.specialInstructions || '',
        detected_fonts: eventData.detectedFonts || '',
        crew: eventData.crew || [],
        channels: eventData.channels || {},
        performers: eventData.performers || '',
        sponsors: eventData.sponsors || [],
      });

      // Replace temp event with real one
      const mappedEvent = {
        id: dbEvent.id,
        title: dbEvent.title || '',
        description: dbEvent.description || '',
        genre: dbEvent.genre || '',
        date: dbEvent.date || '',
        time: dbEvent.time || '',
        venue: dbEvent.venue_name || '',
        venueStreetNumber: dbEvent.venue_street_number || '',
        venueStreetName: dbEvent.venue_street_name || '',
        venueSuite: dbEvent.venue_suite || '',
        venueCity: dbEvent.venue_city || 'San Antonio',
        venueState: dbEvent.venue_state || 'TX',
        venueZip: dbEvent.venue_zip || '',
        venueAddress: dbEvent.venue_address || '', // legacy
        venuePhone: dbEvent.venue_phone || '',
        venueWebsite: dbEvent.venue_website || '',
        ticketLink: dbEvent.ticket_link || '',
        ticketPrice: dbEvent.ticket_price || '',
        brandColors: dbEvent.brand_colors || '',
        writingTone: dbEvent.writing_tone || '',
        specialInstructions: dbEvent.special_instructions || '',
        detectedFonts: dbEvent.detected_fonts || '',
        crew: dbEvent.crew || [],
        channels: dbEvent.channels || {},
        campaign: dbEvent.campaign || false,
        performers: dbEvent.performers || '',
        sponsors: dbEvent.sponsors || [],
        driveEventFolderId: dbEvent.drive_event_folder_id || '',
        createdAt: dbEvent.created_at,
      };

      // Auto-create Google Drive event folder if client has Drive set up
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

      setEvents(prev => prev.map(e => e.id === tempId ? mappedEvent : e));
      return mappedEvent;
    } catch (err) {
      console.error('[VenueContext] Failed to create event:', err);
      alert('Failed to create event: ' + err.message);
      setError('Failed to create event: ' + err.message);
      // Remove optimistic event on failure
      setEvents(prev => prev.filter(e => e.id !== tempId));
      throw err;
    }
  }, [user?.id]);

  const updateEvent = useCallback(async (id, data) => {
    // Optimistic update
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));

    if (!user?.id) return;

    try {
      // Convert camelCase to snake_case for DB
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
      if (data.venueAddress !== undefined) dbData.venue_address = data.venueAddress; // legacy
      if (data.ticketLink !== undefined) dbData.ticket_link = data.ticketLink;
      if (data.ticketPrice !== undefined) dbData.ticket_price = data.ticketPrice;
      if (data.campaign !== undefined) dbData.campaign = data.campaign;
      if (data.crew !== undefined) dbData.crew = data.crew;
      if (data.channels !== undefined) dbData.channels = data.channels;
      if (data.performers !== undefined) dbData.performers = data.performers;
      if (data.brandColors !== undefined) dbData.brand_colors = data.brandColors;
      if (data.writingTone !== undefined) dbData.writing_tone = data.writingTone;
      if (data.specialInstructions !== undefined) dbData.special_instructions = data.specialInstructions;

      if (Object.keys(dbData).length > 0) {
        await updateSupabaseEvent(id, dbData);
      }
    } catch (err) {
      console.error('[VenueContext] Failed to update event:', err);
    }
  }, [user?.id]);

  const addCrewMember = (member) => {
    const newMember = { ...member, id: Date.now().toString(), status: 'invited' };
    const updated = [...crew, newMember];
    setCrew(updated);
    localStorage.setItem('imc_crew', JSON.stringify(updated));
    return newMember;
  };

  const updateCrewMember = (id, data) => {
    const updated = crew.map(c => c.id === id ? { ...c, ...data } : c);
    setCrew(updated);
    localStorage.setItem('imc_crew', JSON.stringify(updated));
  };

  const removeCrewMember = (id) => {
    const updated = crew.filter(c => c.id !== id);
    setCrew(updated);
    localStorage.setItem('imc_crew', JSON.stringify(updated));
  };

  return (
    <VenueContext.Provider value={{
      venue, saveVenue, events, addEvent, updateEvent,
      crew, addCrewMember, updateCrewMember, removeCrewMember,
      loading, error,
    }}>
      {children}
    </VenueContext.Provider>
  );
}

export const useVenue = () => useContext(VenueContext);
