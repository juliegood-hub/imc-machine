import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import CompletionBar from '../components/CompletionBar';
import FormAIAssist from '../components/FormAIAssist';
import DeepResearchPromptBox from '../components/DeepResearchPromptBox';
import PerformanceZonesManager from '../components/PerformanceZonesManager';
import VenueOperationsManager from '../components/VenueOperationsManager';
import { extractFromImages, extractionToVenueForm, openCamera, openFileUpload } from '../services/photo-to-form';
import { deepResearchDraft } from '../services/research';
import { isVenueRole } from '../constants/clientTypes';

const REQUIRED_FIELDS = ['firstName', 'lastName', 'businessName', 'email', 'city', 'state'];
const VENUE_FIELDS = ['firstName', 'lastName', 'businessName', 'dbaName', 'email', 'city', 'state', 'streetNumber', 'streetName'];
const SOCIAL_FIELDS = ['website', 'facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'spotify', 'linkedin', 'yelp', 'googleBusiness'];
const VENUE_SETUP_TABS = ['profile', 'zones', 'operations'];
const DEEP_STYLE_OPTIONS = [
  { value: 'clean', label: 'Clean' },
  { value: 'feature', label: 'Feature' },
  { value: 'punchy', label: 'Punchy' },
];
const DEEP_STYLE_HELP = {
  clean: 'Clean keeps the venue description direct and factual.',
  feature: 'Feature adds neighborhood vibe and context while staying accurate.',
  punchy: 'Punchy keeps the same facts in tighter, high-energy phrasing.',
};
const VENUE_FOOTPRINT_TRACKS = [
  {
    value: 'small_single_room',
    label: 'Single-Room Venue',
    description: 'One active room or stage. Fast setup with lean crew defaults.',
    nextStep: 'Build one primary zone, then move into event creation.',
  },
  {
    value: 'multi_zone',
    label: 'Multi-Zone Venue',
    description: 'Two to four active rooms/stages with overlapping schedules.',
    nextStep: 'Add each room in Performance Zones so booking conflicts stay accurate.',
  },
  {
    value: 'festival_campus',
    label: 'Festival / Campus',
    description: 'Five or more zones or frequent simultaneous programming.',
    nextStep: 'Map every zone first, then configure operations and staffing by zone.',
  },
];
const VENUE_ZONE_COUNT_OPTIONS = [
  { value: '1', label: '1 active room/stage' },
  { value: '2', label: '2 active rooms/stages' },
  { value: '3', label: '3 active rooms/stages' },
  { value: '4', label: '4 active rooms/stages' },
  { value: '5', label: '5+ active rooms/stages' },
];
const VENUE_AUDIENCE_OPTIONS = [
  { value: 'up_to_250', label: 'Usually up to 250 attendees' },
  { value: '251_to_1500', label: 'Usually 251-1,500 attendees' },
  { value: 'over_1500', label: 'Usually over 1,500 attendees' },
];
const VENUE_SIMULTANEOUS_OPTIONS = [
  { value: 'rare', label: 'Rarely run simultaneous shows' },
  { value: 'sometimes', label: 'Sometimes run simultaneous shows' },
  { value: 'frequent', label: 'Frequently run simultaneous shows' },
];
const VENUE_CREW_OPTIONS = [
  { value: 'up_to_8', label: 'Typical day-of-show crew is up to 8 people' },
  { value: 'nine_to_twenty', label: 'Typical day-of-show crew is 9-20 people' },
  { value: 'over_20', label: 'Typical day-of-show crew is over 20 people' },
];

function recommendVenueFootprint(answers = {}) {
  const zones = Number(answers.zoneCount || '1');
  const audienceBand = String(answers.audienceBand || 'up_to_250');
  const simultaneous = String(answers.simultaneousShows || 'rare');
  const crewBand = String(answers.crewBand || 'up_to_8');

  if (zones >= 5 || audienceBand === 'over_1500' || simultaneous === 'frequent' || crewBand === 'over_20') {
    return 'festival_campus';
  }
  if (zones >= 2 || audienceBand === '251_to_1500' || simultaneous === 'sometimes' || crewBand === 'nine_to_twenty') {
    return 'multi_zone';
  }
  return 'small_single_room';
}

function defaultCapacityForAudienceBand(audienceBand = 'up_to_250') {
  if (audienceBand === '251_to_1500') return '600';
  if (audienceBand === 'over_1500') return '2500';
  return '200';
}

export default function VenueSetup() {
  const { venue, saveVenue } = useVenue();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isVenueUser = isVenueRole(user?.clientType || 'venue_owner');
  const [form, setForm] = useState({
    // Contact Info
    firstName: venue.firstName || '',
    lastName: venue.lastName || '',
    title: venue.title || '',
    workPhone: venue.workPhone || '',
    cellPhone: venue.cellPhone || '',
    email: venue.email || '',
    preferredContact: venue.preferredContact || 'email',
    
    // Business Info
    businessName: venue.businessName || venue.name || '',
    dbaName: venue.dbaName || '',
    businessType: venue.businessType || 'venue',
    taxId: venue.taxId || '',
    yearEstablished: venue.yearEstablished || '',
    bio: venue.bio || venue.description || '',
    
    // Address
    streetNumber: venue.streetNumber || '',
    streetName: venue.streetName || '',
    suiteNumber: venue.suiteNumber || '',
    city: venue.city || 'San Antonio',
    state: venue.state || 'TX',
    zipCode: venue.zipCode || '',
    country: venue.country || 'US',
    
    // Social & Web
    website: venue.website || '',
    facebook: venue.facebook || '',
    facebookPageId: venue.facebookPageId || '',
    instagram: venue.instagram || '',
    linkedin: venue.linkedin || '',
    twitter: venue.twitter || '',
    tiktok: venue.tiktok || '',
    spotify: venue.spotify || '',
    youtube: venue.youtube || '',
    yelp: venue.yelp || '',
    googleBusiness: venue.googleBusiness || '',
    
    // Venue-Specific
    capacity: venue.capacity || '',
    hasStage: venue.hasStage || false,
    hasSound: venue.hasSound || false,
    hasLighting: venue.hasLighting || false,
    parkingType: venue.parkingType || 'street',
    adaAccessible: venue.adaAccessible || false,
    ageRestriction: venue.ageRestriction || 'all_ages',
    liquorLicense: venue.liquorLicense || false,
    
    // Brand
    logo: venue.logo || null,
    brandPrimary: venue.brandPrimary || '#c8a45e',
    brandSecondary: venue.brandSecondary || '#0d1b2a',
  });
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(VENUE_SETUP_TABS.includes(requestedTab) ? requestedTab : 'profile');
  const [expandedSections, setExpandedSections] = useState({
    contact: true,
    business: true,
    address: true,
    social: false,
    commerce: false,
    venue: false,
    brand: false,
  });
  const [venueResearching, setVenueResearching] = useState(false);
  const [venueResearchStatus, setVenueResearchStatus] = useState('');
  const [venueStyleIntensity, setVenueStyleIntensity] = useState('feature');
  const [venueResearchCorrections, setVenueResearchCorrections] = useState('');
  const [venueResearchIncludeTerms, setVenueResearchIncludeTerms] = useState('');
  const [venueResearchAvoidTerms, setVenueResearchAvoidTerms] = useState('');
  const [footprintAnswers, setFootprintAnswers] = useState({
    zoneCount: String(venue?.metadata?.venueFootprint?.qna?.zoneCount || '1'),
    audienceBand: String(venue?.metadata?.venueFootprint?.qna?.audienceBand || 'up_to_250'),
    simultaneousShows: String(venue?.metadata?.venueFootprint?.qna?.simultaneousShows || 'rare'),
    crewBand: String(venue?.metadata?.venueFootprint?.qna?.crewBand || 'up_to_8'),
  });
  const [footprintTrackOverride, setFootprintTrackOverride] = useState(
    String(venue?.metadata?.venueFootprint?.track || '')
  );
  const [footprintStatus, setFootprintStatus] = useState('');

  useEffect(() => {
    if (VENUE_SETUP_TABS.includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const updateCheckbox = (field) => (e) => setForm({ ...form, [field]: e.target.checked });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePhotoExtract = async (files) => {
    if (!files?.length) return;
    setExtracting(true);
    setUploadedImages(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    try {
      const result = await extractFromImages(files);
      if (result.success) {
        const venueData = extractionToVenueForm(result);
        setForm(prev => {
          const updated = { ...prev };
          // Map extracted fields to granular form fields
          if (venueData.name && !prev.businessName) updated.businessName = venueData.name;
          if (venueData.address && !prev.streetName) {
            // Try to parse address into components
            const addressParts = venueData.address.split(' ');
            if (addressParts.length > 1 && /^\d+$/.test(addressParts[0])) {
              updated.streetNumber = addressParts[0];
              updated.streetName = addressParts.slice(1).join(' ');
            } else {
              updated.streetName = venueData.address;
            }
          }
          if (venueData.city && !prev.city) updated.city = venueData.city;
          if (venueData.state && !prev.state) updated.state = venueData.state;
          if (venueData.postalCode && !prev.zipCode) updated.zipCode = venueData.postalCode;
          if (venueData.phone && !prev.workPhone) updated.workPhone = venueData.phone;
          if (venueData.email && !prev.email) updated.email = venueData.email;
          if (venueData.website && !prev.website) updated.website = venueData.website;
          if (venueData.description && !prev.bio) updated.bio = venueData.description;
          if (venueData.instagram && !prev.instagram) updated.instagram = venueData.instagram;
          if (venueData.facebook && !prev.facebook) updated.facebook = venueData.facebook;
          if (venueData.brandColors?.[0] && !prev.brandPrimary) updated.brandPrimary = venueData.brandColors[0];
          if (venueData.brandColors?.[1] && !prev.brandSecondary) updated.brandSecondary = venueData.brandColors[1];
          return updated;
        });
      } else {
        alert('I hit a snag extracting details from those images: ' + result.error);
      }
    } catch (err) {
      alert('Hmm. Something pushed back: ' + err.message);
    } finally {
      setExtracting(false);
    }
  };

  const runVenueDeepResearch = async ({
    correctionPrompt = '',
    includeTerms = '',
    avoidTerms = '',
  } = {}) => {
    const venueName = String(form.businessName || '').trim();
    if (!venueName) {
      setVenueResearchStatus('Add venue name first, then I can run deep research.');
      return;
    }
    setVenueResearching(true);
    setVenueResearchStatus('Researching venue context and drafting profile copy...');
    try {
      const result = await deepResearchDraft({
        target: 'venue_profile',
        styleIntensity: venueStyleIntensity,
        correctionPrompt: String(correctionPrompt || '').trim(),
        includeTerms: String(includeTerms || venueResearchIncludeTerms || '').trim(),
        avoidTerms: String(avoidTerms || venueResearchAvoidTerms || '').trim(),
        venue: {
          businessName: venueName,
          dbaName: form.dbaName,
          businessType: form.businessType,
          city: form.city,
          state: form.state,
          zipCode: form.zipCode,
          website: form.website,
          instagram: form.instagram,
          facebook: form.facebook,
          capacity: form.capacity,
          hasStage: form.hasStage,
          hasSound: form.hasSound,
          hasLighting: form.hasLighting,
          bio: form.bio,
        },
      });
      const draft = String(result?.draft || '').trim();
      if (!draft) {
        setVenueResearchStatus('I could not draft venue copy yet. Add one more detail and run it again.');
        return;
      }
      setForm(prev => ({ ...prev, bio: draft }));
      if (String(correctionPrompt || '').trim()
        || String(includeTerms || venueResearchIncludeTerms || '').trim()
        || String(avoidTerms || venueResearchAvoidTerms || '').trim()) {
        setVenueResearchStatus('Updated venue description is ready with your guidance terms.');
      } else {
        setVenueResearchStatus('Venue description draft is ready. Review and edit before you save.');
      }
    } catch (err) {
      setVenueResearchStatus(`I hit a snag researching this venue: ${err.message}`);
    } finally {
      setVenueResearching(false);
    }
  };

  const { completed, total } = useMemo(() => {
    const t = VENUE_FIELDS.length + 1; // +1 for "at least one social"
    let c = VENUE_FIELDS.filter(f => (form[f] || '').toString().trim()).length;
    if (SOCIAL_FIELDS.some(f => (form[f] || '').trim())) c++;
    return { completed: c, total: t };
  }, [form]);
  const recommendedFootprintTrack = useMemo(
    () => recommendVenueFootprint(footprintAnswers),
    [footprintAnswers]
  );
  const selectedFootprintTrack = footprintTrackOverride || recommendedFootprintTrack;
  const selectedFootprintMeta = useMemo(
    () => VENUE_FOOTPRINT_TRACKS.find((track) => track.value === selectedFootprintTrack) || VENUE_FOOTPRINT_TRACKS[0],
    [selectedFootprintTrack]
  );

  const [saving, setSaving] = useState(false);

  const applyFootprintDefaults = (trackValue = selectedFootprintTrack) => {
    const track = VENUE_FOOTPRINT_TRACKS.find((item) => item.value === trackValue)?.value || selectedFootprintTrack;
    const capacityDefault = defaultCapacityForAudienceBand(footprintAnswers.audienceBand);
    setFootprintTrackOverride(track);
    setForm(prev => {
      const next = { ...prev };
      if (!String(next.capacity || '').trim()) next.capacity = capacityDefault;

      if (track === 'small_single_room') {
        next.hasStage = true;
        next.hasSound = true;
        if (!next.parkingType) next.parkingType = 'street';
      } else if (track === 'multi_zone') {
        next.hasStage = true;
        next.hasSound = true;
        next.hasLighting = true;
        if (!next.parkingType) next.parkingType = 'lot';
      } else if (track === 'festival_campus') {
        next.hasStage = true;
        next.hasSound = true;
        next.hasLighting = true;
        next.adaAccessible = true;
        if (!next.parkingType) next.parkingType = 'lot';
      }
      return next;
    });

    if (track === 'small_single_room') {
      setFootprintStatus('Single-room defaults are set. Next, add your primary stage in Performance Zones.');
      return;
    }
    if (track === 'multi_zone') {
      setFootprintStatus('Multi-zone defaults are set. Add each room/stage in Performance Zones (example: Carver = 2 zones).');
      return;
    }
    setFootprintStatus('Festival/campus defaults are set. Add every active zone before you schedule bookings.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check required fields
    const missingFields = REQUIRED_FIELDS.filter(f => !(form[f] || '').toString().trim());
    if (missingFields.length > 0) {
      alert(`I still need these required fields before we continue: ${missingFields.join(', ')}`);
      return;
    }
    
    setSaving(true);
    try {
      const existingMetadata = (venue?.metadata && typeof venue.metadata === 'object') ? venue.metadata : {};
      await saveVenue({
        ...form,
        metadata: {
          ...existingMetadata,
          venueFootprint: {
            track: selectedFootprintTrack,
            recommendedTrack: recommendedFootprintTrack,
            qna: footprintAnswers,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      setSaved(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      alert('I hit a snag saving this venue profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldInput = (label, field, type = 'text', placeholder = '', required = false) => (
    <div key={field}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type} 
        value={form[field] || ''} 
        onChange={update(field)} 
        placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" 
      />
    </div>
  );

  const selectInput = (label, field, options, required = false) => (
    <div key={field}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select 
        value={form[field] || ''} 
        onChange={update(field)}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  const checkboxInput = (label, field) => (
    <div key={field} className="flex items-center">
      <input 
        type="checkbox" 
        checked={form[field] || false} 
        onChange={updateCheckbox(field)}
        className="mr-3 w-4 h-4 text-[#c8a45e] border-gray-300 rounded focus:ring-[#c8a45e]"
      />
      <label className="text-sm font-medium text-gray-700">{label}</label>
    </div>
  );

  const SectionHeader = ({ title, section, count }) => (
    <button 
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg mb-4 transition-colors"
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="flex items-center gap-2">
        {count && <span className="text-xs bg-[#c8a45e] text-white px-2 py-1 rounded-full">{count} fields</span>}
        <span className={`transform transition-transform ${expandedSections[section] ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
    </button>
  );

  const applyVenuePatch = (fields) => {
    setForm(prev => ({ ...prev, ...fields }));
  };

  return (
    <div className={`p-4 md:p-8 ${activeTab === 'profile' ? 'max-w-3xl' : 'max-w-6xl'}`}>
      <h1 className="text-3xl mb-2">Venue Setup</h1>
      <p className="text-gray-500 mb-6">Tell me about your venue once, and I will carry it across your events, production, and distribution flow.</p>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-3 py-1.5 rounded border text-sm ${
            activeTab === 'profile'
              ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          Venue Profile
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('zones')}
          className={`px-3 py-1.5 rounded border text-sm ${
            activeTab === 'zones'
              ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          Performance Zones
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={`px-3 py-1.5 rounded border text-sm ${
            activeTab === 'operations'
              ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          Operations
        </button>
      </div>

      {activeTab === 'profile' && (
        <>
          <FormAIAssist
            formType="venue"
            currentForm={form}
            onApply={applyVenuePatch}
            title="Venue AI Assistant"
            description="Say it once by voice or text, and I will place venue details into the right fields."
            sourceContext="venue_setup_profile"
            entityType="venue_profile"
            entityId={user?.id || ''}
          />

          <div className="card mb-6 border border-blue-200 bg-blue-50">
            <h3 className="text-base mb-2">🏛 Venue Size and Workflow Setup</h3>
            <p className="text-xs text-blue-900 mb-3">
              Answer these four questions and I will apply the same setup pattern most venues use.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-blue-900 mb-1">How many active rooms or stages do you schedule?</label>
                <select
                  value={footprintAnswers.zoneCount}
                  onChange={(e) => setFootprintAnswers(prev => ({ ...prev, zoneCount: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:border-[#0d1b2a]"
                >
                  {VENUE_ZONE_COUNT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-900 mb-1">Typical attendance at your live events?</label>
                <select
                  value={footprintAnswers.audienceBand}
                  onChange={(e) => setFootprintAnswers(prev => ({ ...prev, audienceBand: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:border-[#0d1b2a]"
                >
                  {VENUE_AUDIENCE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-900 mb-1">How often do you run simultaneous shows?</label>
                <select
                  value={footprintAnswers.simultaneousShows}
                  onChange={(e) => setFootprintAnswers(prev => ({ ...prev, simultaneousShows: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:border-[#0d1b2a]"
                >
                  {VENUE_SIMULTANEOUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-900 mb-1">Typical day-of-show crew size?</label>
                <select
                  value={footprintAnswers.crewBand}
                  onChange={(e) => setFootprintAnswers(prev => ({ ...prev, crewBand: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:border-[#0d1b2a]"
                >
                  {VENUE_CREW_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-3 border border-blue-200 bg-white rounded-lg px-3 py-2">
              <p className="text-xs text-blue-900 m-0">Recommended setup: <span className="font-semibold">{selectedFootprintMeta.label}</span></p>
              <p className="text-xs text-blue-800 mt-1 mb-0">{selectedFootprintMeta.description}</p>
              <p className="text-xs text-blue-700 mt-1 mb-0">Next step: {selectedFootprintMeta.nextStep}</p>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {VENUE_FOOTPRINT_TRACKS.map((track) => {
                const active = selectedFootprintTrack === track.value;
                return (
                  <button
                    key={track.value}
                    type="button"
                    onClick={() => setFootprintTrackOverride(track.value)}
                    className={`px-3 py-1.5 rounded border text-xs ${active ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]' : 'bg-white text-blue-900 border-blue-300'}`}
                  >
                    {track.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => applyFootprintDefaults()}
                className="px-3 py-1.5 rounded border border-[#0d1b2a] bg-[#0d1b2a] text-white text-xs"
              >
                Apply Setup Defaults
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('zones')}
                className="px-3 py-1.5 rounded border border-blue-300 bg-white text-blue-900 text-xs"
              >
                Open Performance Zones
              </button>
            </div>
            {footprintStatus && <p className="text-xs text-blue-900 mt-2 mb-0">{footprintStatus}</p>}
          </div>

          {/* Photo-to-Form: AI Data Extraction for Venue */}
          <div className="card mb-6 border-2 border-dashed border-[#c8a45e] bg-[#faf8f3]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg">📸 Snap & Auto-Fill Venue Info</h3>
                <p className="text-xs text-gray-500 m-0">Snap a card, menu, storefront sign, or flyer. I will read it and fill what I can.</p>
              </div>
              {extracting && <span className="text-sm text-[#c8a45e] animate-pulse">🔍 Extracting...</span>}
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={async () => { try { const f = await openCamera(); handlePhotoExtract([f]); } catch {} }}
                className="btn-primary text-sm" disabled={extracting}>
                📷 Take Photo
              </button>
              <button type="button" onClick={async () => { try { const files = await openFileUpload(true); handlePhotoExtract(files); } catch {} }}
                className="btn-secondary text-sm" disabled={extracting}>
                📁 Upload Images
              </button>
            </div>
            {uploadedImages.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {uploadedImages.map((url, i) => (
                  <img key={i} src={url} alt={`Upload ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                ))}
              </div>
            )}
          </div>

          <CompletionBar completed={completed} total={total} label="Venue Profile" />

          {saved && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 font-medium">✓ Beautiful. Venue saved. Taking you to your dashboard...</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-xs text-gray-400">* Fill the required fields first so downstream distribution stays clean.</p>

        {/* Contact Information */}
        <div>
          <SectionHeader title="Contact Information" section="contact" count={7} />
          {expandedSections.contact && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("First Name", "firstName", "text", "Julie", true)}
                {fieldInput("Last Name", "lastName", "text", "Good", true)}
                <div className="md:col-span-2">
                  {fieldInput("Title/Role", "title", "text", "Owner, Booking Agent, Staff Scheduler")}
                </div>
                {fieldInput("Work Phone", "workPhone", "tel", "(210) 555-1234")}
                {fieldInput("Cell Phone", "cellPhone", "tel", "(210) 555-5678")}
                <div className="md:col-span-2">
                  {fieldInput("Email", "email", "email", "you@venue.com", true)}
                </div>
                <div className="md:col-span-2">
                  {selectInput("Preferred Contact Method", "preferredContact", [
                    { value: 'email', label: 'Email' },
                    { value: 'phone', label: 'Phone' },
                    { value: 'text', label: 'Text Message' }
                  ])}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Business Information */}
        <div>
          <SectionHeader title="Business Information" section="business" count={5} />
          {expandedSections.business && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  {fieldInput("Business/Organization Name", "businessName", "text", "The Rialto Theater", true)}
                </div>
                <div className="md:col-span-2">
                  {fieldInput("DBA / Display Name", "dbaName", "text", "How you want to appear publicly")}
                </div>
                <div className="md:col-span-2">
                  {selectInput("Business Type", "businessType", [
                    { value: 'venue', label: 'Venue' },
                    { value: 'bar_restaurant', label: 'Bar/Restaurant' },
                    { value: 'theater', label: 'Theater' },
                    { value: 'gallery', label: 'Gallery' },
                    { value: 'church', label: 'Church' },
                    { value: 'outdoor', label: 'Outdoor' },
                    { value: 'other', label: 'Other' }
                  ])}
                </div>
                {fieldInput("Tax ID / EIN", "taxId", "text", "Optional, for contracts")}
                {fieldInput("Year Established", "yearEstablished", "number", "2010")}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue Description</label>
                  <DeepResearchPromptBox
                    title="OpenAI Deep Research Venue Draft"
                    subtitle="I will research your venue and draft profile copy you can edit before saving."
                    styleValue={venueStyleIntensity}
                    onStyleChange={setVenueStyleIntensity}
                    styleOptions={DEEP_STYLE_OPTIONS}
                    styleHelp={DEEP_STYLE_HELP}
                    correctionValue={venueResearchCorrections}
                    onCorrectionChange={setVenueResearchCorrections}
                    correctionLabel="Corrections or specific terms for regenerate"
                    correctionPlaceholder="Example: Mention rooftop stage, neighborhood name, and parking instructions."
                    includeTermsValue={venueResearchIncludeTerms}
                    onIncludeTermsChange={setVenueResearchIncludeTerms}
                    includeTermsLabel="Use these words or phrases"
                    includeTermsPlaceholder="Example: intimate, neighborhood favorite, artist-friendly, SATX"
                    avoidTermsValue={venueResearchAvoidTerms}
                    onAvoidTermsChange={setVenueResearchAvoidTerms}
                    avoidTermsLabel="Avoid these words or phrases"
                    avoidTermsPlaceholder="Example: underground, rave, explicit"
                    onGenerate={(payload) => runVenueDeepResearch(payload)}
                    onRegenerate={(payload) => runVenueDeepResearch(payload)}
                    generating={venueResearching}
                    canGenerate={!!String(form.businessName || '').trim()}
                    statusText={venueResearchStatus}
                  />
                  <textarea
                    value={form.bio || ''}
                    onChange={update('bio')}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                    placeholder="Describe your venue vibe, layout, and what makes it special."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Address */}
        <div>
          <SectionHeader title="Address" section="address" count={7} />
          {expandedSections.address && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("Street Number", "streetNumber", "text", "123")}
                {fieldInput("Street Name", "streetName", "text", "Main St")}
                <div className="md:col-span-2">
                  {fieldInput("Suite/Unit/Apt Number", "suiteNumber", "text", "Suite 100")}
                </div>
                {fieldInput("City", "city", "text", "San Antonio", true)}
                <div className="grid grid-cols-2 gap-4">
                  {fieldInput("State", "state", "text", "TX", true)}
                  {fieldInput("ZIP Code", "zipCode", "text", "78205")}
                </div>
                <div className="md:col-span-2">
                  {selectInput("Country", "country", [
                    { value: 'US', label: 'United States' },
                    { value: 'CA', label: 'Canada' },
                    { value: 'MX', label: 'Mexico' }
                  ])}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Social & Web */}
        <div>
          <SectionHeader title="Social & Web" section="social" count={11} />
          {expandedSections.social && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  {fieldInput("Website", "website", "url", "https://yourvenue.com")}
                </div>
                {fieldInput("Facebook URL", "facebook", "url", "https://facebook.com/yourvenue")}
                {fieldInput("Facebook Page ID", "facebookPageId", "text", "For API integrations")}
                {fieldInput("Instagram URL / Handle", "instagram", "text", "@yourvenue or full URL")}
                {fieldInput("LinkedIn URL", "linkedin", "url", "linkedin.com/company/yourvenue")}
                {fieldInput("Twitter/X Handle", "twitter", "text", "@yourvenue")}
                {fieldInput("TikTok Handle", "tiktok", "text", "@yourvenue")}
                {fieldInput("Spotify URL", "spotify", "url", "Spotify artist/venue link")}
                {fieldInput("YouTube Channel URL", "youtube", "url", "youtube.com/yourvenue")}
                {fieldInput("Yelp URL", "yelp", "url", "yelp.com/biz/yourvenue")}
                {fieldInput("Google Business Profile URL", "googleBusiness", "url", "Google My Business link")}
              </div>
            </div>
          )}
        </div>

        {/* Online Shops & Menus */}
        <div>
          <SectionHeader title="Online Shops and Menus" section="commerce" count={7} />
          {expandedSections.commerce && (
            <div className="card">
              <p className="text-sm text-gray-500 mb-4">Where people buy from you online. Add any that apply.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("Online Menu URL", "onlineMenu", "url", "Your menu on your site, Toast, DoorDash, etc.")}
                {fieldInput("Square Online Store", "squareStore", "url", "squareup.com/store/yourvenue")}
                {fieldInput("Shopify Store", "shopifyStore", "url", "yourshop.myshopify.com")}
                {fieldInput("Amazon Store / Storefront", "amazonStore", "url", "amazon.com/shops/yourbrand")}
                {fieldInput("Etsy Shop", "etsyStore", "url", "etsy.com/shop/yourshop")}
                {fieldInput("Merch Store", "merchStore", "url", "MerchBar, Bandcamp merch, Big Cartel, etc.")}
                {fieldInput("Other Online Store", "otherStore", "url", "Any other place you sell online")}
              </div>
            </div>
          )}
        </div>

        {/* Venue-Specific */}
        {isVenueUser && (
        <div>
          <SectionHeader title="Venue-Specific Details" section="venue" count={8} />
          {expandedSections.venue && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("Capacity", "capacity", "number", "200")}
                <div className="md:col-span-2">
                  {selectInput("Parking", "parkingType", [
                    { value: 'street', label: 'Street Parking' },
                    { value: 'lot', label: 'Parking Lot' },
                    { value: 'valet', label: 'Valet Service' },
                    { value: 'none', label: 'No Parking' }
                  ])}
                </div>
                <div className="md:col-span-2">
                  {selectInput("Age Restriction", "ageRestriction", [
                    { value: 'all_ages', label: 'All Ages' },
                    { value: '18_plus', label: '18+' },
                    { value: '21_plus', label: '21+' }
                  ])}
                </div>
                <div className="md:col-span-2 space-y-3">
                  {checkboxInput("Has Stage", "hasStage")}
                  {checkboxInput("Has Sound System", "hasSound")}
                  {checkboxInput("Has Lighting Rig", "hasLighting")}
                  {checkboxInput("ADA Accessible", "adaAccessible")}
                  {checkboxInput("Has Liquor License", "liquorLicense")}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Brand Colors */}
        <div>
          <SectionHeader title="Brand & Visual Identity" section="brand" count={3} />
          {expandedSections.brand && (
            <div className="card">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400 cursor-pointer hover:border-[#c8a45e]"
                    onClick={() => alert('Logo upload from cloud storage is almost ready. For now, keep going and I will save the rest.')}>
                    {form.logo ? '✓ Logo uploaded' : 'Click to upload logo (PNG, JPG)'}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={form.brandPrimary} onChange={update('brandPrimary')} className="w-10 h-10 rounded cursor-pointer border-none" />
                      <input type="text" value={form.brandPrimary} onChange={update('brandPrimary')}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={form.brandSecondary} onChange={update('brandSecondary')} className="w-10 h-10 rounded cursor-pointer border-none" />
                      <input type="text" value={form.brandSecondary} onChange={update('brandSecondary')}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="btn-primary text-lg px-8" disabled={saving}>
          {saving ? '⟳ Saving...' : 'Save This & Continue →'}
        </button>
          </form>
        </>
      )}

      {activeTab === 'zones' && (
        <PerformanceZonesManager />
      )}

      {activeTab === 'operations' && (
        <VenueOperationsManager />
      )}
    </div>
  );
}
