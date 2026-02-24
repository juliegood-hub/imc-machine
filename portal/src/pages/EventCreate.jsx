import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import CompletionBar from '../components/CompletionBar';
import SponsorEditor from '../components/SponsorEditor';
import { extractFromImages, extractionToEventForm, openCamera, openFileUpload } from '../services/photo-to-form';

const GENRES = [
  { key: 'Theater | Plays | Musicals', icon: '🎭', color: '#8B5CF6', desc: 'Plays, musicals, theatrical performances' },
  { key: 'Live Music | Contemporary | Jazz | Electronic | Indie', icon: '🎵', color: '#EC4899', desc: 'Concerts, bands, DJs, live music' },
  { key: 'Orchestral | Classical | Choral', icon: '🎻', color: '#3B82F6', desc: 'Orchestra, symphony, choir' },
  { key: 'Literary | Poetry | Book Signings', icon: '📚', color: '#7C3AED', desc: 'Book signings, poetry readings, author talks, literary events' },
  { key: 'Comedy | Speaking | Lectures | Workshops', icon: '🎤', color: '#F59E0B', desc: 'Comedy, talks, workshops, panels' },
  { key: 'Dance | Performance Art | Experimental', icon: '💃', color: '#10B981', desc: 'Dance, performance art, installations' },
];

const GENRE_ROLES = {
  'Theater | Plays | Musicals': ['Director', 'Playwright', 'Lead Actor', 'Supporting Actor', 'Understudy', 'Choreographer', 'Musical Director', 'Costume Designer', 'Set Designer', 'Props Master', 'Hair & Makeup Artist', 'Dramaturg'],
  'Live Music | Contemporary | Jazz | Electronic | Indie': ['Lead Vocalist', 'Guitarist', 'Bassist', 'Drummer', 'Keyboardist', 'Saxophonist', 'DJ', 'Music Producer', 'Tour Manager', 'Backing Vocalist'],
  'Orchestral | Classical | Choral': ['Conductor', 'Concertmaster', 'Choir Director', 'Music Director', 'Guest Soloist', 'Soprano', 'Alto', 'Tenor', 'Baritone'],
  'Literary | Poetry | Book Signings': ['Author', 'Poet', 'Spoken Word Artist', 'Moderator', 'Interviewer', 'Editor', 'Publisher', 'Bookseller', 'Host/Emcee'],
  'Comedy | Speaking | Lectures | Workshops': ['Comedian/Comic', 'Host/Emcee', 'Keynote Speaker', 'Panelist', 'Moderator', 'Workshop Facilitator', 'Opening Act', 'Headliner'],
  'Dance | Performance Art | Experimental': ['Choreographer', 'Lead Dancer', 'Performance Artist', 'Movement Director', 'Aerialist', 'Puppeteer'],
};

const UNIVERSAL_ROLES = [
  'Producer', 'Stage Manager', 'Technical Director', 'Sound Engineer', 'Lighting Designer', 'Photographer', 'Videographer',
  // Client type roles
  'Venue Owner', 'Venue Manager', 'Venue Marketing', 'Venue Staff',
  'Artist', 'Promoter', 'Artist Manager', 'Booking Agent', 'DJ',
  'Media/Press', 'Sponsor/Partner'
];

const CHANNELS = [
  { key: 'press', label: 'Press Releases', icon: '📰', desc: '16+ SA media contacts' },
  { key: 'social', label: 'Social Media', icon: '📱', desc: 'Facebook, Instagram, Twitter/X' },
  { key: 'calendar', label: 'Calendar Listings', icon: '📅', desc: 'Do210, SA Current, Evvnt' },
  { key: 'eventbrite', label: 'Eventbrite', icon: '🎟️', desc: 'Event page & ticketing' },
  { key: 'facebook', label: 'Facebook Events', icon: '👤', desc: 'Auto-create FB event' },
  { key: 'email', label: 'Email Newsletter', icon: '✉️', desc: 'Campaign email blast' },
  { key: 'sms', label: 'SMS Blast', icon: '💬', desc: 'Text message campaign' },
  { key: 'podcast', label: 'Podcast', icon: '🎙️', desc: 'AI-generated 2-voice show' },
  { key: 'bilingual', label: 'Bilingual (Spanish)', icon: '🌎', desc: 'Spanish translations' },
];

const STEP_LABELS = ['Genre', 'Basics', 'Cast & Crew', 'Venue & Tickets', 'Sponsors', 'Media', 'Brand & Voice', 'Channels', 'Review'];

// Reusable Snap & Auto-Fill component
function SnapAutoFill({ label, hint, extracting: ext, onExtract }) {
  return (
    <div className="mb-5 p-4 rounded-xl border-2 border-dashed border-[#c8a45e] bg-[#faf8f3]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold m-0">📸 Snap & Auto-Fill</h4>
          <p className="text-xs text-gray-500 m-0">{hint}</p>
        </div>
        {ext && <span className="text-xs text-[#c8a45e] animate-pulse">🔍 Extracting...</span>}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={async () => { try { const f = await openCamera(); onExtract([f]); } catch {} }}
          className="btn-primary text-xs py-1.5 px-3" disabled={ext}>📷 Photo</button>
        <button type="button" onClick={async () => { try { const files = await openFileUpload(true); onExtract(files); } catch {} }}
          className="btn-secondary text-xs py-1.5 px-3" disabled={ext}>📁 Upload</button>
      </div>
    </div>
  );
}

export default function EventCreate() {
  const { venue, addEvent } = useVenue();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    title: '', description: '', genre: '',
    date: '', time: '19:00', ticketLink: '', ticketPrice: '', venue: venue?.name || '',
    venueStreetNumber: '', venueStreetName: '', venueSuite: '',
    venueCity: 'San Antonio', venueState: 'TX', venueZip: '',
    venuePhone: '', venueWebsite: '',
    brandColors: venue?.brandColors || '#0d1b2a, #c8a45e',
    writingTone: venue?.writingTone || 'Professional yet approachable',
    specialInstructions: '',
    detectedFonts: '',
    sponsors: [],
  });

  const [crew, setCrew] = useState([]);
  const [crewName, setCrewName] = useState('');
  const [crewRole, setCrewRole] = useState('');
  const [channels, setChannels] = useState(CHANNELS.reduce((a, c) => ({ ...a, [c.key]: true }), {}));
  const [uploadedImages, setUploadedImages] = useState([]);
  const [extracting, setExtracting] = useState({});

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const availableRoles = useMemo(() => {
    if (!form.genre) return UNIVERSAL_ROLES;
    return [...UNIVERSAL_ROLES, ...(GENRE_ROLES[form.genre] || [])];
  }, [form.genre]);

  const addCrew = () => {
    if (!crewName || !crewRole) return;
    setCrew(prev => [...prev, { id: Date.now(), name: crewName, role: crewRole }]);
    setCrewName(''); setCrewRole('');
  };

  const removeCrew = (id) => setCrew(prev => prev.filter(c => c.id !== id));

  // Generic extraction handler with context key
  const handleExtract = useCallback(async (files, context) => {
    if (!files?.length) return;
    setExtracting(prev => ({ ...prev, [context]: true }));
    setUploadedImages(prev => [...prev, ...files.map(f => ({ url: URL.createObjectURL(f), name: f.name, context }))]);
    try {
      const result = await extractFromImages(files);
      if (!result.success) return;
      const d = result.data || {};

      if (context === 'basics') {
        const formData = extractionToEventForm(result);
        setForm(prev => {
          const updated = { ...prev };
          for (const [key, val] of Object.entries(formData)) {
            if (val && !prev[key]) updated[key] = val;
          }
          return updated;
        });
      }

      if (context === 'crew') {
        // Extract performers/contacts as crew
        const performers = d.event?.performers || [];
        const contacts = d.contacts || [];
        const newCrew = [];
        performers.forEach(name => {
          if (typeof name === 'string' && name.trim()) {
            newCrew.push({ id: Date.now() + Math.random(), name: name.trim(), role: 'Performer' });
          }
        });
        contacts.forEach(c => {
          if (c.name) {
            newCrew.push({ id: Date.now() + Math.random(), name: c.name, role: c.role || c.title || 'Crew' });
          }
        });
        if (newCrew.length > 0) setCrew(prev => [...prev, ...newCrew]);
      }

      if (context === 'venue') {
        const v = d.venue || {};
        const contacts = d.contacts || [];
        const address = v.address || '';
        
        // Parse address into components
        let streetNumber = '', streetName = '';
        if (address) {
          const addressParts = address.split(' ');
          if (addressParts.length > 1 && /^\d+$/.test(addressParts[0])) {
            streetNumber = addressParts[0];
            streetName = addressParts.slice(1).join(' ');
          } else {
            streetName = address;
          }
        }
        
        setForm(prev => ({
          ...prev,
          venue: prev.venue || v.name || '',
          venueStreetNumber: prev.venueStreetNumber || streetNumber,
          venueStreetName: prev.venueStreetName || streetName,
          venueCity: prev.venueCity || v.city || 'San Antonio',
          venueState: prev.venueState || v.state || 'TX',
          venueZip: prev.venueZip || v.zip || v.postalCode || '',
          venuePhone: prev.venuePhone || v.phone || (contacts[0]?.phone || ''),
          venueWebsite: prev.venueWebsite || v.website || '',
          ticketPrice: prev.ticketPrice || d.event?.ticketPrice || '',
          ticketLink: prev.ticketLink || d.event?.ticketLink || '',
        }));
      }

      if (context === 'brand') {
        const v = d.venue || {};
        const colors = v.brandColors || [];
        const vibe = v.vibe || '';
        setForm(prev => ({
          ...prev,
          brandColors: colors.length > 0 ? colors.join(', ') : prev.brandColors,
          writingTone: vibe || prev.writingTone,
          detectedFonts: v.fonts || prev.detectedFonts || '',
          specialInstructions: prev.specialInstructions || (vibe ? `Detected vibe: ${vibe}` : ''),
        }));
      }

      if (context === 'media') {
        // Images already added to uploadedImages above
      }

    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setExtracting(prev => ({ ...prev, [context]: false }));
    }
  }, []);

  const completedFields = useMemo(() => {
    let c = 0;
    if (form.genre) c++;
    if (form.title) c++;
    if (form.date) c++;
    if (form.description) c++;
    if (form.venue) c++;
    if (crew.length > 0) c++;
    if (uploadedImages.length > 0) c++;
    if (form.brandColors) c++;
    return c;
  }, [form, crew, uploadedImages]);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.title || !form.date || !form.genre) return;
    setSubmitting(true);
    try {
      const event = await addEvent({
        ...form,
        date: `${form.date}T${form.time}`,
        crew,
        channels,
      });
      // Only navigate if we got a real UUID back (not a temp ID)
      if (event?.id && event.id.includes('-')) {
        navigate(`/events/${event.id}`);
      } else {
        alert('Event may not have saved properly. Check the dashboard or try again.');
      }
    } catch (err) {
      alert('Error creating event: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!form.genre;
    if (step === 1) return !!form.title && !!form.date;
    return true;
  };

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>What type of event?</h2>
          <p className="text-gray-500 mb-6">Choose a genre to customize your crew roles and content</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GENRES.map(g => (
              <button key={g.key} onClick={() => setForm({ ...form, genre: g.key })}
                className={`p-6 rounded-xl border-2 text-left transition-all cursor-pointer bg-white ${
                  form.genre === g.key ? 'border-[#c8a45e] shadow-lg' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="text-4xl block mb-3">{g.icon}</span>
                <h3 className="font-semibold text-sm mb-1">{g.key.split(' | ')[0]}</h3>
                <p className="text-xs text-gray-500 m-0">{g.desc}</p>
                {form.genre === g.key && (
                  <div className="mt-3 text-xs font-semibold text-[#c8a45e]">✓ Selected</div>
                )}
              </button>
            ))}
          </div>
        </div>
      );

      case 1: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Event Basics</h2>
          <p className="text-gray-500 mb-4">Title, description, date and time</p>
          <p className="text-xs text-gray-400 mb-4">* Required fields</p>

          <SnapAutoFill
            context="basics"
            hint="Snap a poster, flyer, handbill, or screenshot : AI extracts event title, date, time, description"
            extracting={extracting.basics}
            onExtract={(files) => handleExtract(files, 'basics')}
          />

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Title <span className="text-red-500">*</span></label>
              <input type="text" value={form.title} onChange={update('title')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="Friday Night Jazz" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={update('description')} rows={4}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                placeholder="Describe your event..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={update('date')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input type="time" value={form.time} onChange={update('time')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
              </div>
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Cast & Crew</h2>
          <p className="text-gray-500 mb-4">Add performers and team members for your {form.genre?.split(' | ')[0] || 'event'}</p>

          <SnapAutoFill
            context="crew"
            hint="Snap a playbill, show program, band lineup poster, or press kit : AI extracts names and roles"
            extracting={extracting.crew}
            onExtract={(files) => handleExtract(files, 'crew')}
          />

          <div className="card mb-4">
            <div className="flex flex-col md:flex-row gap-3">
              <input type="text" value={crewName} onChange={e => setCrewName(e.target.value)} placeholder="Name"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
              <select value={crewRole} onChange={e => setCrewRole(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white min-w-[200px]">
                <option value="">Select role...</option>
                <optgroup label="Universal">
                  {UNIVERSAL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </optgroup>
                {form.genre && (
                  <optgroup label={form.genre.split(' | ')[0]}>
                    {(GENRE_ROLES[form.genre] || []).map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                )}
              </select>
              <button type="button" onClick={addCrew} className="btn-primary whitespace-nowrap">+ Add</button>
            </div>
          </div>

          {crew.length > 0 ? (
            <div className="space-y-2">
              {crew.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-[#f5f5f5] rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{c.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({c.role})</span>
                  </div>
                  <button onClick={() => removeCrew(c.id)} className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer">✕</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-6">No crew added yet. Snap a playbill or add manually above.</p>
          )}
        </div>
      );

      case 3: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Venue & Tickets</h2>
          <p className="text-gray-500 mb-4">Confirm venue and add ticket information</p>

          <SnapAutoFill
            context="venue"
            hint="Snap a business card, venue sign, or storefront : AI extracts name, address, phone, website"
            extracting={extracting.venue}
            onExtract={(files) => handleExtract(files, 'venue')}
          />

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
              <input type="text" value={form.venue} onChange={update('venue')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="The Aztec Theatre" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Number</label>
                <input type="text" value={form.venueStreetNumber} onChange={update('venueStreetNumber')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="104" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Name</label>
                <input type="text" value={form.venueStreetName} onChange={update('venueStreetName')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="N St Mary's St" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suite/Unit</label>
              <input type="text" value={form.venueSuite} onChange={update('venueSuite')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="Suite 100 (optional)" />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={form.venueCity} onChange={update('venueCity')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="San Antonio" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={form.venueState} onChange={update('venueState')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="TX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input type="text" value={form.venueZip} onChange={update('venueZip')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="78205" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.venuePhone} onChange={update('venuePhone')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="(210) 555-1234" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input type="url" value={form.venueWebsite} onChange={update('venueWebsite')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="https://theaztectheatre.com" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Link</label>
                <input type="url" value={form.ticketLink} onChange={update('ticketLink')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="https://eventbrite.com/..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Price</label>
                <input type="text" value={form.ticketPrice} onChange={e => {
                  const val = e.target.value;
                  setForm({ ...form, ticketPrice: val });
                }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                  placeholder="$25 / Free / $15-$50" />
              </div>
            </div>
          </div>
        </div>
      );

      case 4: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Event Sponsors</h2>
          <p className="text-gray-500 mb-6">Add sponsors, partners, and supporters. Their logos and names will appear in your press materials, social posts, and event graphics.</p>
          <SponsorEditor sponsors={form.sponsors} onChange={(sponsors) => setForm({ ...form, sponsors })} />
        </div>
      );

      case 5: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Media Upload</h2>
          <p className="text-gray-500 mb-4">Upload photos, flyers, artist headshots</p>

          <div className="card border-2 border-dashed border-[#c8a45e] bg-[#faf8f3] text-center py-12">
            {extracting.media && <p className="text-sm text-[#c8a45e] animate-pulse mb-3">🔍 Processing...</p>}
            <p className="text-4xl mb-3">📁</p>
            <p className="text-gray-500 mb-1">Upload event photos, flyers, headshots, and graphics</p>
            <p className="text-xs text-gray-400 mb-4">These will be stored to Google Drive and used for campaign visuals</p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={async () => { try { const f = await openCamera(); handleExtract([f], 'media'); } catch {} }}
                className="btn-primary text-sm" disabled={extracting.media}>📷 Take Photo</button>
              <button type="button" onClick={async () => { try { const files = await openFileUpload(true); handleExtract(files, 'media'); } catch {} }}
                className="btn-secondary text-sm" disabled={extracting.media}>📁 Upload Files</button>
            </div>
          </div>
          {uploadedImages.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">{uploadedImages.length} file{uploadedImages.length !== 1 ? 's' : ''} uploaded</p>
              <div className="grid grid-cols-4 gap-3">
                {uploadedImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img.url} alt={img.name} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                    <p className="text-xs text-gray-500 mt-1 truncate">{img.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

      case 6: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Brand & Voice</h2>
          <p className="text-gray-500 mb-4">Confirm your brand settings for this campaign</p>

          <SnapAutoFill
            context="brand"
            hint="Snap existing marketing materials, merch, signage, or social posts : AI detects brand colors, fonts, and tone"
            extracting={extracting.brand}
            onExtract={(files) => handleExtract(files, 'brand')}
          />

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand Colors</label>
              <input type="text" value={form.brandColors} onChange={update('brandColors')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="#0d1b2a, #c8a45e" />
              {form.brandColors && (
                <div className="flex gap-2 mt-2">
                  {form.brandColors.split(',').map((c, i) => {
                    const hex = c.trim();
                    return hex.startsWith('#') ? (
                      <div key={i} className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: hex }} />
                        <span className="text-xs text-gray-500 font-mono">{hex}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Detected Fonts</label>
              <input type="text" value={form.detectedFonts} onChange={update('detectedFonts')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-gray-50"
                placeholder="Auto-detected from scanned materials" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Writing Tone</label>
              <select value={form.writingTone} onChange={update('writingTone')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
                <option>Professional yet approachable</option>
                <option>Casual and fun</option>
                <option>Formal and elegant</option>
                <option>Edgy and bold</option>
                <option>Warm and community-focused</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
              <textarea value={form.specialInstructions} onChange={update('specialInstructions')} rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y"
                placeholder="Any specific notes for content generation..." />
            </div>
          </div>
        </div>
      );

      case 7: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Distribution Channels</h2>
          <p className="text-gray-500 mb-6">Toggle which channels to include in your IMC campaign</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CHANNELS.map(ch => (
              <button key={ch.key}
                onClick={() => setChannels(prev => ({ ...prev, [ch.key]: !prev[ch.key] }))}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer bg-white ${
                  channels[ch.key] ? 'border-[#c8a45e] bg-[#faf8f3]' : 'border-gray-200'
                }`}>
                <span className="text-2xl">{ch.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{ch.label}</div>
                  <div className="text-xs text-gray-500">{ch.desc}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  channels[ch.key] ? 'border-[#c8a45e] bg-[#c8a45e]' : 'border-gray-300'
                }`}>
                  {channels[ch.key] && <span className="text-white text-xs">✓</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      );

      case 8: return (
        <div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Review & Launch</h2>
          <p className="text-gray-500 mb-6">Review everything before generating your IMC campaign</p>

          <div className="space-y-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Genre</h3>
              <p className="text-lg">{GENRES.find(g => g.key === form.genre)?.icon} {form.genre}</p>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Event</h3>
              <p className="text-lg font-semibold">{form.title || 'Untitled'}</p>
              <p className="text-sm text-gray-500">{form.date} at {form.time} · {form.venue}</p>
              {form.venueAddress && <p className="text-xs text-gray-400">{form.venueAddress}</p>}
              {form.description && <p className="text-sm mt-2">{form.description}</p>}
              {form.ticketPrice && <p className="text-sm text-[#c8a45e] mt-1">🎟️ {form.ticketPrice}</p>}
            </div>
            {crew.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Cast & Crew ({crew.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {crew.map(c => (
                    <span key={c.id} className="text-xs bg-[#f5f5f5] px-2 py-1 rounded">{c.name} ({c.role})</span>
                  ))}
                </div>
              </div>
            )}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Brand</h3>
              <div className="flex gap-2 items-center">
                {form.brandColors.split(',').map((c, i) => {
                  const hex = c.trim();
                  return hex.startsWith('#') ? (
                    <div key={i} className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: hex }} />
                  ) : null;
                })}
                <span className="text-sm text-gray-500 ml-2">{form.writingTone}</span>
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Channels ({Object.values(channels).filter(Boolean).length})</h3>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.filter(c => channels[c.key]).map(c => (
                  <span key={c.key} className="text-xs bg-[#faf8f3] border border-[#c8a45e] px-2 py-1 rounded">{c.icon} {c.label}</span>
                ))}
              </div>
            </div>
            {uploadedImages.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Media ({uploadedImages.length})</h3>
                <div className="flex gap-2">
                  {uploadedImages.slice(0, 8).map((img, i) => (
                    <img key={i} src={img.url} alt="" className="w-12 h-12 object-cover rounded" />
                  ))}
                  {uploadedImages.length > 8 && <span className="text-xs text-gray-400 self-center">+{uploadedImages.length - 8} more</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-3xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Create Event</h1>

      <CompletionBar completed={step + 1} total={STEP_LABELS.length} label={`Step ${step + 1}: ${STEP_LABELS[step]}`} />

      {/* Step indicators */}
      <div className="flex gap-1 mb-8">
        {STEP_LABELS.map((label, i) => (
          <button key={i} onClick={() => i <= step && setStep(i)}
            className={`flex-1 h-1.5 rounded-full transition-colors cursor-pointer border-none ${
              i <= step ? 'bg-[#c8a45e]' : 'bg-gray-200'
            }`}
            title={label}
          />
        ))}
      </div>

      {renderStep()}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
            step === 0 ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-gray-700 border-gray-200 hover:border-[#c8a45e]'
          }`}>
          ← Back
        </button>

        {step < STEP_LABELS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            className={`btn-primary px-8 ${!canNext() ? 'opacity-50 cursor-not-allowed' : ''}`}>
            Next →
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!form.title || !form.date || !form.genre || submitting}
            className={`px-8 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer border-none text-white ${
              !form.title || !form.date || !form.genre || submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#c8a45e] hover:bg-[#b8943e]'
            }`}>
            {submitting ? '⟳ Saving...' : '🚀 Generate IMC Campaign'}
          </button>
        )}
      </div>
    </div>
  );
}
