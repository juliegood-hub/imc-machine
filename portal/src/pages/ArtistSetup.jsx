import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import CompletionBar from '../components/CompletionBar';
import { extractFromImages, openCamera, openFileUpload } from '../services/photo-to-form';
import { isArtistRole } from '../constants/clientTypes';

const GENRES = [
  'Theater | Plays | Musicals',
  'Live Music | Contemporary | Jazz | Electronic | Indie',
  'Orchestral | Classical | Choral',
  'Comedy | Speaking | Lectures | Workshops',
  'Dance | Performance Art | Experimental',
];

const REQUIRED_FIELDS = ['firstName', 'lastName', 'stageName', 'email', 'city', 'state'];
const ARTIST_FIELDS = ['firstName', 'lastName', 'stageName', 'genre', 'bio', 'website', 'headshot'];
const SOCIAL_FIELDS = ['website', 'facebook', 'instagram', 'tiktok', 'youtube', 'spotify', 'linkedin', 'bandcamp', 'soundcloud', 'appleMusic'];

export default function ArtistSetup() {
  const { venue, saveVenue } = useVenue();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isArtistUser = isArtistRole(user?.clientType || 'artist');
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
    
    type: 'artist',
    members: venue.members || [],
  });
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState(false);
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
      alert(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }
    
    setSaving(true);
    try {
      await saveVenue({ ...form, type: 'artist' });
      setSaved(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      alert('Error saving artist profile: ' + err.message);
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

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-3xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Artist / Band Setup</h1>
      <p className="text-gray-500 mb-6">Tell us about you so we can personalize your press and promo.</p>

      {/* Photo-to-Form */}
      <div className="card mb-6 border-2 border-dashed border-[#c8a45e] bg-[#faf8f3]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg">📸 Snap & Auto-Fill</h3>
            <p className="text-xs text-gray-500 m-0">Photo a press kit, one-sheet, business card, or album cover : AI extracts your info</p>
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

      <CompletionBar completed={completed} total={total} label="Artist Profile" />

      {saved && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 font-medium">✓ Artist profile saved! Redirecting to dashboard...</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-xs text-gray-400">* Required fields</p>

        {/* Contact Information */}
        <div>
          <SectionHeader title="Contact Information" section="contact" count={10} />
          {expandedSections.contact && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("First Name", "firstName", "text", "Julie", true)}
                {fieldInput("Last Name", "lastName", "text", "Good", true)}
                <div className="md:col-span-2">
                  {fieldInput("Stage Name / Band Name", "stageName", "text", "Julie Good and A Dog Named Mike", true)}
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
          <SectionHeader title="Professional Details" section="professional" count={7} />
          {expandedSections.professional && (
            <div className="card">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                  <select value={form.genre} onChange={update('genre')}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
                    <option value="">Select genre...</option>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subgenres</label>
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      value={subgenreInput} 
                      onChange={e => setSubgenreInput(e.target.value)}
                      placeholder="Add subgenre tag"
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
                  {fieldInput("Years Active", "yearsActive", "number", "2015")}
                  {fieldInput("Record Label", "recordLabel", "text", "Independent / Label name")}
                  {selectInput("ASCAP/BMI/SESAC Member", "performingRightsOrg", [
                    { value: '', label: 'None' },
                    { value: 'ASCAP', label: 'ASCAP' },
                    { value: 'BMI', label: 'BMI' },
                    { value: 'SESAC', label: 'SESAC' }
                  ])}
                  {fieldInput("Union Member", "unionMember", "text", "SAG-AFTRA, AFM, etc.")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea value={form.bio} onChange={update('bio')} rows={4}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                    placeholder="Tell us about yourself or your band... This will be used in press releases and bios." />
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
        {isArtistUser && (
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
          <SectionHeader title="Band Members / Collaborators" section="band" count="variable" />
          {expandedSections.band && (
            <div className="card">
              <p className="text-xs text-gray-500 mb-4">Add your band members, frequent collaborators, or touring musicians.</p>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <input type="text" value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Name"
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                <input type="text" value={memberRole} onChange={e => setMemberRole(e.target.value)} placeholder="Instrument / Role"
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
                <p className="text-gray-400 text-center py-4 text-sm">No members added. Solo artists can skip this.</p>
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
          {saving ? '⟳ Saving...' : 'Save & Continue →'}
        </button>
      </form>
    </div>
  );
}