import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import CompletionBar from '../components/CompletionBar';
import FormAIAssist from '../components/FormAIAssist';
import DeepResearchPromptBox from '../components/DeepResearchPromptBox';
import ShowConfigurationManager from '../components/ShowConfigurationManager';
import { extractFromImages, openCamera, openFileUpload } from '../services/photo-to-form';
import { deepResearchDraft } from '../services/research';
import { isArtistRole, normalizeClientType } from '../constants/clientTypes';

const PERFORMANCE_GENRES = [
  'Theater | Plays | Musicals',
  'Acting Gigs | Character Performance | Seasonal',
  'Live Music | Contemporary | Jazz | Electronic | Indie',
  'Orchestral | Classical | Choral',
  'Visual Art | Artisan | Gallery | Craft Shows',
  'Comedy | Speaking | Lectures | Workshops',
  'Legal CLE | Law Panels | Bar Association Events',
  'Dance | Performance Art | Experimental',
];

const ARTISAN_MEDIA = [
  'Painting: Oil',
  'Painting: Acrylic',
  'Painting: Watercolor',
  'Painting: Gouache',
  'Drawing: Graphite',
  'Drawing: Charcoal',
  'Drawing: Ink',
  'Pastel',
  'Printmaking: Relief',
  'Printmaking: Intaglio',
  'Printmaking: Lithography',
  'Printmaking: Screenprint',
  'Printmaking: Monotype',
  'Ceramics: Wheel-thrown',
  'Ceramics: Handbuilt',
  'Sculpture: Stone',
  'Sculpture: Wood',
  'Sculpture: Metal',
  'Sculpture: Mixed Media',
  'Welding / Metal Fabrication',
  'Woodworking',
  'Furniture Design',
  'Jewelry / Metalsmithing',
  'Glass: Blown',
  'Glass: Fused / Kiln-formed',
  'Textiles / Fiber Art',
  'Weaving',
  'Embroidery',
  'Fashion / Wearable Art',
  'Leatherwork',
  'Book Arts',
  'Calligraphy / Lettering',
  'Illustration',
  'Mural Art',
  'Street Art',
  'Digital Art',
  'Graphic Design',
  'Photography',
  'Film / Video Art',
  'Installation Art',
  'Performance Art',
  'Collage',
  'Assemblage',
  'Mosaic',
  'Resin Art',
  'Culinary Arts',
  'Floral Design',
  'Paper Art',
  '3D Printing / Digital Fabrication',
  'Other',
];

const ARTISAN_ASSOCIATIONS = [
  { value: '', label: 'None' },
  { value: 'AIGA', label: 'AIGA' },
  { value: 'NCECA', label: 'NCECA' },
  { value: 'SNAG', label: 'SNAG' },
  { value: 'SculptorsGuild', label: 'Sculptors Guild' },
  { value: 'WoodworkersGuild', label: 'Woodworkers Guild' },
  { value: 'ArtLeague', label: 'Art League / Collective' },
  { value: 'Other', label: 'Other' },
];

const KNOWLEDGE_CREATOR_TOPICS = [
  'Continuing Legal Education (CLE)',
  'Legal Ethics and Professional Responsibility',
  'Trial Advocacy',
  'Criminal Law and Justice',
  'Family Law',
  'Business and Corporate Law',
  'Estate Planning and Probate',
  'Civil Rights and Constitutional Law',
  'Books and Publishing',
  'Book Signings and Author Talks',
  'Poetry Readings and Literary Performance',
  'Journalism and News',
  'Arts and Culture Criticism',
  'Creative Writing',
  'Poetry and Spoken Word',
  'Playwriting and Theater Writing',
  'Education: K-12',
  'Education: Higher Education',
  'Research and Academia',
  'Public Policy and Government',
  'Community Organizing',
  'Legal Education',
  'Health and Medicine',
  'Business and Entrepreneurship',
  'Leadership and Management',
  'Marketing and Communications',
  'Technology and AI',
  'Science and Environment',
  'History and Humanities',
  'Career Development',
  'Personal Development',
  'Food and Culinary',
  'Comedy and Storytelling',
  'Podcasting and Media Hosting',
  'Interviewing and Moderation',
  'Workshop Facilitation',
  'Social Impact',
  'Local San Antonio Culture',
  'Other',
];

const PROFESSIONAL_ASSOCIATIONS = [
  { value: '', label: 'None' },
  { value: 'StateBarTexas', label: 'State Bar of Texas' },
  { value: 'SanAntonioBarAssociation', label: 'San Antonio Bar Association' },
  { value: 'TexasBarCLE', label: 'State Bar of Texas CLE' },
  { value: 'TCDLA', label: 'Texas Criminal Defense Lawyers Association (TCDLA)' },
  { value: 'TexasDistrictCountyAttorneysAssociation', label: 'Texas District & County Attorneys Association (TDCAA)' },
  { value: 'GeminiInk', label: 'Gemini Ink (San Antonio)' },
  { value: 'TrinityUniversityPress', label: 'Trinity University Press' },
  { value: 'SanAntonioBookFestival', label: 'San Antonio Book Festival' },
  { value: 'TexasBookFestival', label: 'Texas Book Festival' },
  { value: 'SPJ', label: 'Society of Professional Journalists (SPJ)' },
  { value: 'NABJ', label: 'National Association of Black Journalists (NABJ)' },
  { value: 'NAHJ', label: 'National Association of Hispanic Journalists (NAHJ)' },
  { value: 'AAJA', label: 'Asian American Journalists Association (AAJA)' },
  { value: 'AuthorsGuild', label: 'The Authors Guild' },
  { value: 'PEN', label: 'PEN America' },
  { value: 'NCTE', label: 'National Council of Teachers of English (NCTE)' },
  { value: 'TESOL', label: 'TESOL' },
  { value: 'APA', label: 'American Psychological Association (APA)' },
  { value: 'AMA', label: 'American Marketing Association (AMA)' },
  { value: 'SHRM', label: 'SHRM' },
  { value: 'PMI', label: 'PMI' },
  { value: 'Other', label: 'Other' },
];

const KNOWLEDGE_CREATOR_ROLES = [
  'attorney',
  'lawyer',
  'author',
  'writer',
  'journalist',
  'editor',
  'poet',
  'playwright',
  'podcaster',
  'speaker',
  'moderator',
  'educator',
  'professor',
  'coach',
  'consultant',
  'media',
  'politician',
];

const POLITICAL_SCOPES = [
  'City of San Antonio',
  'Bexar County',
  'State of Texas',
  'Federal (U.S.)',
  'Judicial',
  'School District / Board',
  'Special District',
  'Multi-Jurisdiction',
];

const POLITICAL_OFFICES = [
  'Mayor of San Antonio',
  'San Antonio City Council District 1',
  'San Antonio City Council District 2',
  'San Antonio City Council District 3',
  'San Antonio City Council District 4',
  'San Antonio City Council District 5',
  'San Antonio City Council District 6',
  'San Antonio City Council District 7',
  'San Antonio City Council District 8',
  'San Antonio City Council District 9',
  'San Antonio City Council District 10',
  'Bexar County Judge',
  'Bexar County Commissioner Precinct 1',
  'Bexar County Commissioner Precinct 2',
  'Bexar County Commissioner Precinct 3',
  'Bexar County Commissioner Precinct 4',
  'Bexar County Clerk',
  'Bexar County District Clerk',
  'Bexar County Sheriff',
  'Bexar County Tax Assessor-Collector',
  'Bexar County District Attorney (Criminal District Attorney)',
  'Texas Governor',
  'Texas Lieutenant Governor',
  'Texas Attorney General',
  'Texas Comptroller',
  'Texas Land Commissioner',
  'Texas Agriculture Commissioner',
  'Texas State Senate',
  'Texas House of Representatives',
  'U.S. House of Representatives',
  'U.S. Senate',
  'President / Vice President',
  'Texas Supreme Court Justice',
  'Texas Court of Criminal Appeals Judge',
  'Court of Appeals Justice',
  'District Judge',
  'County Court-at-Law Judge',
  'Justice of the Peace',
  'Constable',
  'Municipal Judge',
  'School Board Trustee',
  'Other Office',
];

const PARTY_AFFILIATIONS = [
  { value: '', label: 'Select party / alignment' },
  { value: 'Democratic', label: 'Democratic' },
  { value: 'Republican', label: 'Republican' },
  { value: 'Independent', label: 'Independent' },
  { value: 'Libertarian', label: 'Libertarian' },
  { value: 'Green', label: 'Green' },
  { value: 'Nonpartisan', label: 'Nonpartisan' },
  { value: 'Other', label: 'Other / Decline to state' },
];

const CANDIDATE_STATUS_OPTIONS = [
  'Incumbent',
  'Challenger',
  'Nomination Candidate',
  'Open Seat Candidate',
  'Appointed Officeholder',
  'Former Officeholder',
  'Campaign Team',
];

const ELECTION_STAGE_OPTIONS = [
  'Exploratory',
  'Filed / Declared',
  'Primary Nomination',
  'Primary',
  'Primary Runoff',
  'General Election',
  'Special Election',
  'Recall / Referendum',
  'Post-Election Transition',
];

const CAMPAIGN_OBJECTIVE_OPTIONS = [
  'Brand awareness / name recognition',
  'Fundraising',
  'Volunteer recruitment',
  'Voter registration',
  'Voter turnout (GOTV)',
  'Issue education',
  'Town hall attendance',
  'Media coverage',
  'Debate preparation / amplification',
  'Coalition building',
];

const POLICY_PRIORITY_OPTIONS = [
  'Public safety',
  'Education',
  'Property taxes',
  'Housing affordability',
  'Transportation',
  'Infrastructure',
  'Economic development',
  'Small business support',
  'Healthcare access',
  'Mental health',
  'Environmental sustainability',
  'Criminal justice reform',
  'Immigration',
  'Veterans services',
  'Arts and culture',
  'Government transparency',
  'Ethics and accountability',
];

const REQUIRED_FIELDS = ['firstName', 'lastName', 'stageName', 'email', 'city', 'state'];
const ARTIST_FIELDS = ['firstName', 'lastName', 'stageName', 'genre', 'bio', 'website', 'headshot'];
const SOCIAL_FIELDS = ['website', 'facebook', 'instagram', 'tiktok', 'youtube', 'spotify', 'linkedin', 'bandcamp', 'soundcloud', 'appleMusic'];
const DEEP_STYLE_OPTIONS = [
  { value: 'clean', label: 'Clean' },
  { value: 'feature', label: 'Feature' },
  { value: 'punchy', label: 'Punchy' },
];
const DEEP_STYLE_HELP = {
  clean: 'Clean keeps your bio tight and factual.',
  feature: 'Feature adds voice and richer scene context while staying grounded.',
  punchy: 'Punchy sharpens the same facts with faster, high-energy phrasing.',
};

export default function ArtistSetup() {
  const { venue, saveVenue } = useVenue();
  const { user } = useAuth();
  const navigate = useNavigate();
  const normalizedClientType = normalizeClientType(user?.clientType || 'artist');
  const isArtistUser = isArtistRole(normalizedClientType);
  const isArtisanUser = normalizedClientType === 'artisan';
  const isPoliticianUser = normalizedClientType === 'politician';
  const isKnowledgeCreatorUser = KNOWLEDGE_CREATOR_ROLES.includes(normalizedClientType);
  const showTechnicalSection = isArtistUser && !isArtisanUser;
  const [form, setForm] = useState({
    // Contact Info
    firstName: venue.firstName || '',
    lastName: venue.lastName || '',
    stageName: venue.stageName || user?.venueName || venue.name || '',
    managerName: venue.managerName || '',
    managerEmail: venue.managerEmail || '',
    managerPhone: venue.managerPhone || '',
    bookingName: venue.bookingName || '',
    bookingEmail: venue.bookingEmail || user?.email || '',
    bookingPhone: venue.bookingPhone || '',
    cellPhone: venue.cellPhone || '',
    preferredContact: venue.preferredContact || 'email',
    
    // Address
    streetNumber: venue.streetNumber || '',
    streetName: venue.streetName || '',
    suiteNumber: venue.suiteNumber || '',
    city: venue.city || 'San Antonio',
    state: venue.state || 'TX',
    zipCode: venue.zipCode || '',
    country: venue.country || 'US',
    hometown: venue.hometown || 'San Antonio, TX',
    
    // Professional
    genre: venue.genre || '',
    subgenres: venue.subgenres || [],
    yearsActive: venue.yearsActive || '',
    recordLabel: venue.recordLabel || '',
    performingRightsOrg: venue.performingRightsOrg || '',
    unionMember: venue.unionMember || '',
    politicalScope: venue.politicalScope || venue.genre || '',
    officeSought: venue.officeSought || venue.recordLabel || '',
    district: venue.district || venue.unionMember || '',
    partyAffiliation: venue.partyAffiliation || venue.performingRightsOrg || '',
    candidateStatus: venue.candidateStatus || '',
    electionStage: venue.electionStage || '',
    campaignObjective: venue.campaignObjective || '',
    bio: venue.bio || '',
    
    // Social & Streaming
    website: venue.website || '',
    facebook: venue.facebook || '',
    instagram: venue.instagram || '',
    tiktok: venue.tiktok || '',
    youtube: venue.youtube || '',
    spotify: venue.spotify || '',
    appleMusic: venue.appleMusic || '',
    soundcloud: venue.soundcloud || '',
    bandcamp: venue.bandcamp || '',
    linkedin: venue.linkedin || '',
    
    // Technical
    hasOwnSound: venue.hasOwnSound || false,
    hasOwnLighting: venue.hasOwnLighting || false,
    typicalSetLength: venue.typicalSetLength || '1hr',
    riderRequirements: venue.riderRequirements || '',
    techRiderUrl: venue.techRiderUrl || '',
    
    // Visual
    headshot: venue.headshot || null,
    brandPrimary: venue.brandPrimary || '#c8a45e',
    brandSecondary: venue.brandSecondary || '#0d1b2a',
    defaultOfficialAssetsOnly: !!venue.defaultOfficialAssetsOnly,
    
    type: venue.type || normalizedClientType || 'artist',
    members: venue.members || [],
  });
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [subgenreInput, setSubgenreInput] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    contact: true,
    address: true,
    professional: true,
    social: false,
    technical: false,
    band: false,
    brand: false,
  });
  const [bioResearching, setBioResearching] = useState(false);
  const [bioResearchStatus, setBioResearchStatus] = useState('');
  const [bioStyleIntensity, setBioStyleIntensity] = useState('feature');
  const [bioResearchCorrections, setBioResearchCorrections] = useState('');
  const [bioResearchIncludeTerms, setBioResearchIncludeTerms] = useState('');
  const [bioResearchAvoidTerms, setBioResearchAvoidTerms] = useState('');

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const updateCheckbox = (field) => (e) => setForm({ ...form, [field]: e.target.checked });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addMember = () => {
    if (!memberName) return;
    setForm(prev => ({
      ...prev,
      members: [...prev.members, { id: Date.now(), name: memberName, role: memberRole }]
    }));
    setMemberName(''); setMemberRole('');
  };

  const removeMember = (id) => {
    setForm(prev => ({ ...prev, members: prev.members.filter(m => m.id !== id) }));
  };

  const addSubgenre = () => {
    if (!subgenreInput || form.subgenres.includes(subgenreInput)) return;
    setForm(prev => ({
      ...prev,
      subgenres: [...prev.subgenres, subgenreInput]
    }));
    setSubgenreInput('');
  };

  const removeSubgenre = (genre) => {
    setForm(prev => ({ ...prev, subgenres: prev.subgenres.filter(g => g !== genre) }));
  };

  const handlePhotoExtract = async (files) => {
    if (!files?.length) return;
    setExtracting(true);
    try {
      const result = await extractFromImages(files);
      if (result.success) {
        const d = result.data;
        const v = d?.venue || {};
        const contacts = d?.contacts || [];
        setForm(prev => ({
          ...prev,
          stageName: prev.stageName || v.name || '',
          website: prev.website || v.website || '',
          bio: prev.bio || v.description || '',
          instagram: prev.instagram || v.socialMedia?.instagram || '',
          facebook: prev.facebook || v.socialMedia?.facebook || '',
          bookingEmail: prev.bookingEmail || contacts[0]?.email || '',
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExtracting(false);
    }
  };

  const runBioDeepResearch = async ({
    correctionPrompt = '',
    includeTerms = '',
    avoidTerms = '',
  } = {}) => {
    const artistName = String(form.stageName || '').trim();
    if (!artistName) {
      setBioResearchStatus('Add artist or act name first, then I can run deep research.');
      return;
    }
    setBioResearching(true);
    setBioResearchStatus('Researching artist context and drafting bio...');
    try {
      const result = await deepResearchDraft({
        target: 'artist_bio',
        styleIntensity: bioStyleIntensity,
        correctionPrompt: String(correctionPrompt || bioResearchCorrections || '').trim(),
        includeTerms: String(includeTerms || bioResearchIncludeTerms || '').trim(),
        avoidTerms: String(avoidTerms || bioResearchAvoidTerms || '').trim(),
        artist: {
          stageName: artistName,
          genre: form.genre,
          city: form.city,
          state: form.state,
          subgenres: form.subgenres,
          website: form.website,
          instagram: form.instagram,
          youtube: form.youtube,
          bio: form.bio,
        },
      });
      const draft = String(result?.draft || '').trim();
      if (!draft) {
        setBioResearchStatus('I could not draft a bio yet. Add one more detail and run it again.');
        return;
      }
      setForm(prev => ({ ...prev, bio: draft }));
      if (String(correctionPrompt || bioResearchCorrections || '').trim()
        || String(includeTerms || bioResearchIncludeTerms || '').trim()
        || String(avoidTerms || bioResearchAvoidTerms || '').trim()) {
        setBioResearchStatus('Updated bio draft is ready with your guidance terms.');
      } else {
        setBioResearchStatus('Bio draft is ready. Review and edit as needed before you save.');
      }
    } catch (err) {
      setBioResearchStatus(`I hit a snag researching this artist: ${err.message}`);
    } finally {
      setBioResearching(false);
    }
  };

  const { completed, total } = useMemo(() => {
    const t = ARTIST_FIELDS.length + 1;
    let c = ARTIST_FIELDS.filter(f => (form[f] || '').toString().trim()).length;
    if (SOCIAL_FIELDS.some(f => (form[f] || '').trim())) c++;
    return { completed: c, total: t };
  }, [form]);

  const [saving, setSaving] = useState(false);

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
      await saveVenue({ ...form, type: normalizedClientType || form.type || 'artist' });
      setSaved(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      alert('I hit a snag saving your profile: ' + err.message);
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
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
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

  const applyArtistPatch = (fields) => {
    setForm(prev => ({ ...prev, ...fields }));
  };

  return (
    <div className={`p-4 md:p-8 ${activeTab === 'stageTech' ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <h1 className="text-3xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
        {isArtisanUser ? 'Artisan Setup' : isPoliticianUser ? 'Political Campaign Setup' : isKnowledgeCreatorUser ? 'Professional / Speaker Setup' : 'Artist / Band Setup'}
      </h1>
      <p className="text-gray-500 mb-6">
        {isArtisanUser
          ? 'Tell me about your art practice, and I will shape your profile, press, and event promos around it.'
          : isPoliticianUser
            ? 'Tell me about your race, office, and priorities so I can keep campaign messaging accurate and sharp.'
          : isKnowledgeCreatorUser
            ? 'Tell me your voice, your topics, and your lane, and I will tailor your profile and campaigns.'
            : 'Tell me about you, and I will personalize your press and promo.'}
      </p>

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
          Profile
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stageTech')}
          className={`px-3 py-1.5 rounded border text-sm ${
            activeTab === 'stageTech'
              ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          Stage Plot & Tech
        </button>
      </div>

      {activeTab === 'profile' && (
        <>
          <FormAIAssist
            formType="artist"
            currentForm={form}
            onApply={applyArtistPatch}
            title={isArtisanUser ? 'Artisan AI Assistant' : isPoliticianUser ? 'Campaign AI Assistant' : isKnowledgeCreatorUser ? 'Professional AI Assistant' : 'Artist AI Assistant'}
            description="Say it once by voice or text, and I will map it into contact, address, profile, and social fields."
            sourceContext="artist_setup_profile"
            entityType="artist_profile"
            entityId={user?.id || ''}
          />

          {/* Photo-to-Form */}
          <div className="card mb-6 border-2 border-dashed border-[#c8a45e] bg-[#faf8f3]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg">📸 Snap & Auto-Fill</h3>
                <p className="text-xs text-gray-500 m-0">Snap a one-sheet, business card, portfolio page, or press kit. I will extract what matters.</p>
              </div>
              {extracting && <span className="text-sm text-[#c8a45e] animate-pulse">🔍 Extracting...</span>}
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={async () => { try { const f = await openCamera(); handlePhotoExtract([f]); } catch {} }}
                className="btn-primary text-sm" disabled={extracting}>📷 Take Photo</button>
              <button type="button" onClick={async () => { try { const files = await openFileUpload(true); handlePhotoExtract(files); } catch {} }}
                className="btn-secondary text-sm" disabled={extracting}>📁 Upload</button>
            </div>
          </div>

          <CompletionBar completed={completed} total={total} label={isArtisanUser ? 'Artisan Profile' : isKnowledgeCreatorUser ? 'Professional Profile' : 'Artist Profile'} />

          {saved && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 font-medium">✓ Beautiful. {isKnowledgeCreatorUser ? 'Professional' : 'Artist'} profile saved. Taking you to the dashboard...</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-xs text-gray-400">* Fill the required fields first so every campaign stays accurate across every channel.</p>

        {/* Contact Information */}
        <div>
          <SectionHeader title="Contact Information" section="contact" count={10} />
          {expandedSections.contact && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("First Name", "firstName", "text", "Julie", true)}
                {fieldInput("Last Name", "lastName", "text", "Good", true)}
                <div className="md:col-span-2">
                  {fieldInput(
                    isArtisanUser ? "Artist / Studio Name" : isKnowledgeCreatorUser ? "Professional Name / Brand Name" : "Stage Name / Band Name",
                    "stageName",
                    "text",
                    isArtisanUser ? "Blue Heron Ceramics Studio" : isKnowledgeCreatorUser ? "Julie Good Media" : "Julie Good and A Dog Named Mike",
                    true
                  )}
                </div>
                {fieldInput("Manager Name", "managerName", "text", "Jane Smith")}
                {fieldInput("Manager Email", "managerEmail", "email", "manager@email.com")}
                {fieldInput("Manager Phone", "managerPhone", "tel", "(210) 555-1234")}
                {fieldInput("Booking Contact Name", "bookingName", "text", "Booking Agent")}
                {fieldInput("Booking Email", "bookingEmail", "email", "booking@yourband.com")}
                {fieldInput("Booking Phone", "bookingPhone", "tel", "(210) 555-5678")}
                {fieldInput("Cell Phone", "cellPhone", "tel", "(210) 555-9999")}
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

        {/* Address */}
        <div>
          <SectionHeader title="Address" section="address" count={8} />
          {expandedSections.address && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("Street Number", "streetNumber", "text", "123")}
                {fieldInput("Street Name", "streetName", "text", "Main St")}
                <div className="md:col-span-2">
                  {fieldInput("Suite/Unit/Apt Number", "suiteNumber", "text", "Apt 4B")}
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
                <div className="md:col-span-2">
                  {fieldInput("Hometown", "hometown", "text", "San Antonio, TX")}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Professional */}
        <div>
          <SectionHeader title={isArtisanUser ? 'Professional Art Details' : isPoliticianUser ? 'Campaign Details' : 'Professional Details'} section="professional" count={isPoliticianUser ? 12 : 7} />
          {expandedSections.professional && (
            <div className="card">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isArtisanUser ? 'Primary Medium' : isPoliticianUser ? 'Office Level / Jurisdiction' : isKnowledgeCreatorUser ? 'Primary Topic / Focus' : 'Genre'}
                  </label>
                  <select value={isPoliticianUser ? form.politicalScope : form.genre} onChange={update(isPoliticianUser ? 'politicalScope' : 'genre')}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
                    <option value="">{isArtisanUser ? 'Select primary medium...' : isPoliticianUser ? 'Select campaign jurisdiction...' : isKnowledgeCreatorUser ? 'Select primary topic...' : 'Select genre...'}</option>
                    {(isArtisanUser ? ARTISAN_MEDIA : isPoliticianUser ? POLITICAL_SCOPES : isKnowledgeCreatorUser ? KNOWLEDGE_CREATOR_TOPICS : PERFORMANCE_GENRES).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isArtisanUser ? 'Additional Media / Techniques' : isPoliticianUser ? 'Policy Priorities' : isKnowledgeCreatorUser ? 'Topics / Niches' : 'Subgenres'}</label>
                  {isPoliticianUser && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {POLICY_PRIORITY_OPTIONS.map(priority => (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => {
                            if (form.subgenres.includes(priority)) return;
                            setForm(prev => ({ ...prev, subgenres: [...prev.subgenres, priority] }));
                          }}
                          className="text-xs px-2 py-1 rounded border border-gray-200 bg-white hover:border-[#c8a45e] hover:text-[#8c6d2f]"
                        >
                          + {priority}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      value={subgenreInput} 
                      onChange={e => setSubgenreInput(e.target.value)}
                      placeholder={isArtisanUser ? 'Add medium, style, or technique' : isPoliticianUser ? 'Add issue area (ex: criminal justice reform)' : isKnowledgeCreatorUser ? 'Add topic, beat, or niche' : 'Add subgenre tag'}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                      onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSubgenre())}
                    />
                    <button type="button" onClick={addSubgenre} className="btn-primary whitespace-nowrap">+ Add</button>
                  </div>
                  {form.subgenres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.subgenres.map(genre => (
                        <span key={genre} className="text-xs bg-[#f5f5f5] px-2 py-1 rounded flex items-center gap-1">
                          {genre}
                          <button type="button" onClick={() => removeSubgenre(genre)} className="text-red-400 hover:text-red-600">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fieldInput(isPoliticianUser ? "Years in Public Service" : "Years Active", "yearsActive", "number", isPoliticianUser ? "8" : "2015")}
                  {isPoliticianUser ? (
                    selectInput("Office Sought", "officeSought", POLITICAL_OFFICES)
                  ) : fieldInput(
                    isArtisanUser ? "Studio / Collective Name" : isKnowledgeCreatorUser ? "Publication / Organization" : "Record Label",
                    "recordLabel",
                    "text",
                    isArtisanUser ? "Studio name or collective" : isKnowledgeCreatorUser ? "Publisher, outlet, school, or brand" : "Independent / Label name"
                  )}
                  {isPoliticianUser ? (
                    fieldInput("District / Precinct / Place", "district", "text", "Example: Precinct 1, District 2, Place 3")
                  ) : selectInput(isArtisanUser ? "Association / Guild Membership" : isKnowledgeCreatorUser ? "Professional Association" : "ASCAP/BMI/SESAC Member", "performingRightsOrg", isArtisanUser ? ARTISAN_ASSOCIATIONS : isKnowledgeCreatorUser ? PROFESSIONAL_ASSOCIATIONS : [
                    { value: '', label: 'None' },
                    { value: 'ASCAP', label: 'ASCAP' },
                    { value: 'BMI', label: 'BMI' },
                    { value: 'SESAC', label: 'SESAC' }
                  ])}
                  {isPoliticianUser ? (
                    selectInput("Party / Alignment", "partyAffiliation", PARTY_AFFILIATIONS)
                  ) : fieldInput(isArtisanUser ? "League / Guild / Chapter" : isKnowledgeCreatorUser ? "Affiliations / Credentials" : "Union Member", "unionMember", "text", isArtisanUser ? "Guild name, league, chapter, or collective" : isKnowledgeCreatorUser ? "Degrees, certifications, fellowships, memberships" : "SAG-AFTRA, AFM, etc.")}
                  {isPoliticianUser && selectInput("Candidate Status", "candidateStatus", CANDIDATE_STATUS_OPTIONS)}
                  {isPoliticianUser && selectInput("Election Stage", "electionStage", ELECTION_STAGE_OPTIONS)}
                  {isPoliticianUser && selectInput("Campaign Objective", "campaignObjective", CAMPAIGN_OBJECTIVE_OPTIONS)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isArtisanUser ? 'Artist Statement / Bio' : isPoliticianUser ? 'Candidate Bio / Platform Summary' : isKnowledgeCreatorUser ? 'Professional Bio' : 'Bio'}</label>
                  <DeepResearchPromptBox
                    title="OpenAI Deep Research Bio"
                    subtitle="I will research this act and draft a first-pass bio. Add corrections and regenerate until it feels right."
                    styleValue={bioStyleIntensity}
                    onStyleChange={setBioStyleIntensity}
                    styleOptions={DEEP_STYLE_OPTIONS}
                    styleHelp={DEEP_STYLE_HELP}
                    correctionValue={bioResearchCorrections}
                    onCorrectionChange={setBioResearchCorrections}
                    includeTermsValue={bioResearchIncludeTerms}
                    onIncludeTermsChange={setBioResearchIncludeTerms}
                    includeTermsLabel="Use these words or phrases"
                    includeTermsPlaceholder="Example: celebrated, juried, gallery-ready, community-centered"
                    avoidTermsValue={bioResearchAvoidTerms}
                    onAvoidTermsChange={setBioResearchAvoidTerms}
                    avoidTermsLabel="Avoid these words or phrases"
                    avoidTermsPlaceholder="Example: amateur, hobbyist, underground"
                    correctionLabel="Corrections or specific terms for regenerate"
                    correctionPlaceholder="Example: Include Bexar County DA nomination context, correct spelling, and keep language community-focused."
                    onGenerate={(payload = {}) => runBioDeepResearch(payload)}
                    onRegenerate={(payload = {}) => runBioDeepResearch(payload)}
                    generating={bioResearching}
                    canGenerate={!!String(form.stageName || '').trim()}
                    statusText={bioResearchStatus}
                  />
                  <textarea value={form.bio} onChange={update('bio')} rows={4}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                    placeholder={isArtisanUser ? 'Tell us about your artistic practice, materials, and themes. This will be used in press releases and bios.' : isPoliticianUser ? 'Share campaign mission, core issues, public service background, and key priorities. This will be used in bios and campaign copy.' : isKnowledgeCreatorUser ? 'Tell us about your work, expertise, and audience. This will be used in bios and media copy.' : 'Tell us about yourself or your band... This will be used in press releases and bios.'} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Social & Streaming */}
        <div>
          <SectionHeader title="Social & Streaming" section="social" count={10} />
          {expandedSections.social && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  {fieldInput("Website", "website", "url", "https://yourband.com")}
                </div>
                {fieldInput("Facebook", "facebook", "url", "https://facebook.com/yourband")}
                {fieldInput("Instagram", "instagram", "text", "@yourband")}
                {fieldInput("TikTok", "tiktok", "text", "@yourband")}
                {fieldInput("LinkedIn", "linkedin", "url", "linkedin.com/in/yourname")}
                {fieldInput("Spotify", "spotify", "url", "https://open.spotify.com/artist/...")}
                {fieldInput("Apple Music", "appleMusic", "url", "https://music.apple.com/artist/...")}
                {fieldInput("YouTube", "youtube", "url", "youtube.com/@yourbandname")}
                {fieldInput("SoundCloud", "soundcloud", "url", "soundcloud.com/yourbandname")}
                {fieldInput("Bandcamp", "bandcamp", "url", "yourbandname.bandcamp.com")}
              </div>
            </div>
          )}
        </div>

        {/* Online Shops & Merch */}
        <div>
          <SectionHeader title="Online Shops and Merch" section="commerce" count={7} />
          {expandedSections.commerce && (
            <div className="card">
              <p className="text-sm text-gray-500 mb-4">Where fans and customers can buy from you. Add any that apply.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("Online Menu URL", "onlineMenu", "url", "Your menu on your site, Toast, DoorDash, etc.")}
                {fieldInput("Square Online Store", "squareStore", "url", "squareup.com/store/yourshop")}
                {fieldInput("Shopify Store", "shopifyStore", "url", "yourshop.myshopify.com")}
                {fieldInput("Amazon Store / Storefront", "amazonStore", "url", "amazon.com/shops/yourbrand")}
                {fieldInput("Etsy Shop", "etsyStore", "url", "etsy.com/shop/yourshop")}
                {fieldInput("Merch Store", "merchStore", "url", "MerchBar, Bandcamp merch, Big Cartel, etc.")}
                {fieldInput("Other Online Store", "otherStore", "url", "Any other place you sell online")}
              </div>
            </div>
          )}
        </div>

        {/* Technical */}
        {showTechnicalSection && (
        <div>
          <SectionHeader title="Technical Requirements" section="technical" count={5} />
          {expandedSections.technical && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {checkboxInput("Has Own Sound Equipment", "hasOwnSound")}
                  {checkboxInput("Has Own Lighting", "hasOwnLighting")}
                </div>
                <div className="md:col-span-2">
                  {selectInput("Typical Set Length", "typicalSetLength", [
                    { value: '30min', label: '30 minutes' },
                    { value: '45min', label: '45 minutes' },
                    { value: '1hr', label: '1 hour' },
                    { value: '1_5hr', label: '1.5 hours' },
                    { value: '2hr', label: '2 hours' },
                    { value: '2_5hr', label: '2.5 hours' },
                    { value: '3hr', label: '3 hours' }
                  ])}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rider Requirements</label>
                  <textarea value={form.riderRequirements} onChange={update('riderRequirements')} rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                    placeholder="Sound requirements, hospitality needs, etc." />
                </div>
                <div className="md:col-span-2">
                  {fieldInput("Tech Rider URL", "techRiderUrl", "url", "Link to technical rider document")}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Band Members */}
        <div>
          <SectionHeader title={isArtisanUser ? "Team Members / Collaborators" : "Band Members / Collaborators"} section="band" count="variable" />
          {expandedSections.band && (
            <div className="card">
              <p className="text-xs text-gray-500 mb-4">
                {isArtisanUser ? 'Add studio assistants, collaborators, curators, fabricators, or other contributors.' : 'Add your band members, frequent collaborators, or touring musicians.'}
              </p>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <input type="text" value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Name"
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                <input type="text" value={memberRole} onChange={e => setMemberRole(e.target.value)} placeholder={isArtisanUser ? 'Role (Assistant, Curator, Fabricator)' : 'Instrument / Role'}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                <button type="button" onClick={addMember} className="btn-primary whitespace-nowrap">+ Add</button>
              </div>
              {form.members.length > 0 ? (
                <div className="space-y-2">
                  {form.members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-[#f5f5f5] rounded-lg">
                      <div>
                        <span className="font-medium text-sm">{m.name}</span>
                        {m.role && <span className="text-xs text-gray-500 ml-2">({m.role})</span>}
                      </div>
                      <button onClick={() => removeMember(m.id)} className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer">✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4 text-sm">{isArtisanUser ? 'No team members added yet. Solo studio artists can skip this.' : 'No members added. Solo artists can skip this.'}</p>
              )}
            </div>
          )}
        </div>

        {/* Brand Colors */}
        <div>
          <SectionHeader title="Brand & Visual Identity" section="brand" count={3} />
          {expandedSections.brand && (
            <div className="card">
              <p className="text-xs text-gray-500 mb-4">Used in generated graphics and press materials.</p>
              <div className="space-y-4">
                <div className="p-3 border border-gray-200 rounded-lg bg-[#faf8f3]">
                  <label className="inline-flex items-start gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!form.defaultOfficialAssetsOnly}
                      onChange={updateCheckbox('defaultOfficialAssetsOnly')}
                      className="mt-0.5 w-4 h-4 text-[#c8a45e] border-gray-300 rounded focus:ring-[#c8a45e]"
                    />
                    <span>
                      Default new events to official uploaded artwork only
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-2 mb-0">
                    When this is on, new events you create start in official-assets mode and skip AI graphics unless you turn it off per event.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Headshot / Press Photo</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400 cursor-pointer hover:border-[#c8a45e]"
                    onClick={async () => { try { const files = await openFileUpload(false); handlePhotoExtract(files); } catch {} }}>
                    {form.headshot ? '✓ Photo uploaded' : 'Click to upload headshot / press photo (PNG, JPG)'}
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

      {activeTab === 'stageTech' && (
        <ShowConfigurationManager />
      )}
    </div>
  );
}
