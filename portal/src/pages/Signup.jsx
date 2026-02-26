import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CLIENT_TYPES, isVenueRole, normalizeClientType } from '../constants/clientTypes';
import FormAIAssist from '../components/FormAIAssist';
import AuthBrandHeader from '../components/AuthBrandHeader';

export default function Signup() {
  const [searchParams] = useSearchParams();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [cellPhone, setCellPhone] = useState('');
  const [password, setPassword] = useState('');
  const [clientType, setClientType] = useState('');
  const [clientName, setClientName] = useState('');
  const [inviteCode, setInviteCode] = useState(searchParams.get('code') || searchParams.get('invite') || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stepNote, setStepNote] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();
  const normalizedClientType = normalizeClientType(clientType);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) { setError('I need the required fields first, then we can create your account.'); return; }
    if (!clientType) { setError('Choose your user type so I can tailor your workspace.'); return; }
    if (!clientName) { setError('Add your organization, venue, artist, or campaign name so I can personalize everything.'); return; }
    if (password.length < 6) { setError('Use at least 6 characters for your password.'); return; }
    if (!inviteCode.trim()) { setError('Drop in your invite code and I will unlock signup.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await signup(email, password, fullName, clientName, inviteCode, normalizedClientType, {
        firstName,
        lastName,
        cellPhone
      });
      navigate(isVenueRole(normalizedClientType) ? '/venue-setup' : '/artist-setup');
    } catch (err) {
      setError(err.message || 'Hmm. Signup did not go through yet. Try once more.');
    } finally {
      setSubmitting(false);
    }
  };

  const nameLabel = {
    venue_owner: 'Venue Name',
    venue_manager: 'Venue Name',
    venue_marketing: 'Venue Name',
    venue_staff: 'Venue Name',
    artist: 'Artist / Band Name',
    promoter: 'Company / Event Name',
    manager: 'Management Company Name',
    booking_agent: 'Agency Name',
    producer: 'Production Company Name',
    dj: 'DJ Name / Stage Name',
    artisan: 'Artist / Studio / Collective Name',
    media: 'Media Outlet / Publication',
    sponsor: 'Company / Brand Name',
    admin: 'Organization Name',
    attorney: 'Firm / Practice Name',
    lawyer: 'Firm / Practice Name',
    educator: 'School / Institution Name',
    professor: 'University / Research Group',
    doctor: 'Practice / Clinic Name',
    speaker: 'Speaker Name / Brand',
    author: 'Author Name / Pen Name',
    writer: 'Writer Brand / Publication Name',
    journalist: 'Newsroom / Publication Name',
    editor: 'Publication / Imprint Name',
    poet: 'Poet Name / Collective',
    playwright: 'Playwright Name / Theater Co.',
    podcaster: 'Podcast / Show Name',
    moderator: 'Host / Event Brand',
    coach: 'Coaching Brand / Practice',
    consultant: 'Consulting Brand / Firm',
    comedian: 'Stage Name',
    activist: 'Organization / Cause Name',
    politician: 'Campaign / Office Name',
    chef: 'Restaurant / Brand Name',
    restaurant: 'Restaurant / Venue Name',
    festival_organizer: 'Festival Name',
    vendor: 'Business / Brand Name',
    k12_school: 'School Name',
    conservatory: 'Conservatory / Academy Name',
    childrens_theater: 'Theater / Company Name',
    youth_program: 'Program Name',
    // Legacy support
    venue: 'Venue Name',
    performer: 'Performer / Stage Name',
  }[clientType] || 'Organization Name';

  const namePlaceholder = {
    venue_owner: 'The Dakota East Side Ice House',
    venue_manager: 'The Dakota East Side Ice House',
    venue_marketing: 'The Dakota East Side Ice House',
    venue_staff: 'The Dakota East Side Ice House',
    artist: 'Julie Good and A Dog Named Mike',
    promoter: 'Good Creative Media Events',
    manager: 'Good Artist Management',
    booking_agent: 'SA Talent Agency',
    producer: 'Good Creative Media',
    dj: 'DJ Julie Good',
    artisan: 'Blue Heron Ceramics Studio',
    media: 'San Antonio Current',
    sponsor: 'Good Creative Media',
    admin: 'System Administration',
    attorney: 'Good Law Group',
    lawyer: 'Good Law Group',
    educator: 'UTSA Department of Music',
    professor: 'UTSA Cultural Studies Lab',
    doctor: 'SA Wellness Center',
    speaker: 'Julie Good Speaks',
    author: 'Julie Good Books',
    writer: 'Julie Good Writing Studio',
    journalist: 'San Antonio Arts Desk',
    editor: 'Good Creative Journal',
    poet: 'Julie Good Poetry',
    playwright: 'Julie Good Theater Works',
    podcaster: 'Good Creative Podcast',
    moderator: 'Julie Good Live Conversations',
    coach: 'Good Creative Coaching',
    consultant: 'Good Creative Advisory',
    comedian: 'Funny Julie',
    activist: 'SA Community Alliance',
    politician: 'Good for San Antonio',
    chef: 'Chef Julie at The Pearl',
    restaurant: 'The Pearl Brewery',
    festival_organizer: 'Taste of the Southside',
    vendor: 'SA Artisan Collective',
    k12_school: 'Judson ISD Fine Arts',
    conservatory: 'Musical Bridges Around the World',
    childrens_theater: 'Magik Theatre',
    youth_program: 'SAY Sí',
    // Legacy support
    venue: 'The Dakota East Side Ice House',
    performer: 'Sarah Chen (Broadway)',
  }[clientType] || 'Your organization';

  const applySignupPatch = (fields) => {
    if (fields.firstName !== undefined) setFirstName(fields.firstName);
    if (fields.lastName !== undefined) setLastName(fields.lastName);
    if (fields.email !== undefined) setEmail(fields.email);
    if (fields.cellPhone !== undefined) setCellPhone(fields.cellPhone);
    if (fields.clientType !== undefined) setClientType(normalizeClientType(fields.clientType));
    if (fields.clientName !== undefined) setClientName(fields.clientName);
    if (fields.inviteCode !== undefined) setInviteCode(fields.inviteCode);
  };

  return (
    <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AuthBrandHeader />

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-8">
          <h2 className="text-2xl mb-6 text-center" style={{ fontFamily: "'Playfair Display', serif" }}>Let's Get You Set Up</h2>
          <p className="text-xs text-gray-400 text-center mb-4">* Fill the required fields and I will set up your profile.</p>

          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

          <FormAIAssist
            formType="signup"
            currentForm={{ firstName, lastName, email, cellPhone, clientType, clientName, inviteCode }}
            onApply={applySignupPatch}
            title="Signup AI Assistant"
            description="Tell me your details once by voice or text, and I will map them into this form."
            sourceContext="signup_form"
            entityType="signup"
          />

          {/* Client Type Selection */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Tell me what you do... <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {CLIENT_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => setClientType(t.key)}
                  className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer bg-white ${
                    normalizedClientType === t.key ? 'border-[#c8a45e] bg-[#faf8f3]' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="text-lg block">{t.icon}</span>
                  <span className="text-xs font-semibold block mt-1">{t.label}</span>
                  <span className="text-[10px] text-gray-500 block leading-tight">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="Julie" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder="Good" required />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
              placeholder="you@email.com" required />
          </div>

          {clientType && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{nameLabel} <span className="text-red-500">*</span></label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
                placeholder={namePlaceholder} required />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cell Phone</label>
            <input type="tel" value={cellPhone} onChange={e => setCellPhone(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
              placeholder="(210) 555-1234" />
            <p className="text-xs text-gray-400 mt-1">Format: (210) 555-1234</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
              placeholder="••••••••" />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code <span className="text-red-500">*</span></label>
            <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
              placeholder="IMC-XXXXXX" required />
            <p className="text-xs text-gray-400 mt-1">Need a code? Reach out to Julie directly. She'll get you in.</p>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full text-center disabled:opacity-50">
            {submitting ? 'Setting up your account...' : 'Set Up My Account'}
          </button>

          <div className="mt-4 border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-semibold m-0">Step Actions</p>
            <p className="text-xs text-gray-500 m-0 mt-1">Choose what you want to do with this step.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setStepNote('Beautiful. Signup step marked complete once you submit.')}>✓ Mark Complete</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => setStepNote('Saved for later. Your details stay here while this page is open.')}>Save for Later</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => navigate('/login')}>Skip to Sign In</button>
              <button type="submit" className="btn-secondary text-xs">Next Step → Profile Setup</button>
            </div>
            {stepNote && <p className="text-xs text-emerald-700 mt-2 mb-0">{stepNote}</p>}
            <p className="text-xs text-gray-500 mt-2 mb-0">
              Next up: <span className="font-semibold text-gray-700">Profile Setup</span> — I will route you to venue or artist setup right after signup.
            </p>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account? <Link to="/login" className="text-[#c8a45e] font-semibold no-underline">Sign In</Link>
          </p>
        </form>

        <div className="text-center mt-8">
          <p className="text-xs text-gray-500 leading-relaxed">
            The IMC Machine™ · © {new Date().getFullYear()} Julie Good. All Rights Reserved.
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            Made with love in San Antonio by Julie Good · Good Creative Media
          </p>
        </div>
      </div>
    </div>
  );
}
