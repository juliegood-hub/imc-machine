import { useState, useMemo } from 'react';
import { useVenue } from '../context/VenueContext';

const GENRES = [
  'Theater | Plays | Musicals',
  'Live Music | Contemporary | Jazz | Electronic | Indie',
  'Orchestral | Classical | Choral',
  'Comedy | Speaking | Lectures | Workshops',
  'Dance | Performance Art | Experimental',
];

const UNIVERSAL_ROLES = [
  'Producer', 'Stage Manager', 'Technical Director', 'Sound Engineer',
  'Lighting Designer', 'Front of House Manager', 'Box Office Manager',
  'Marketing/PR', 'Volunteer Coordinator', 'Photographer', 'Videographer',
  'Social Media Manager', 'House Manager', 'Security',
];

const GENRE_ROLES = {
  'Theater | Plays | Musicals': [
    'Director', 'Playwright', 'Lead Actor', 'Supporting Actor', 'Understudy',
    'Choreographer', 'Musical Director', 'Costume Designer', 'Set Designer',
    'Props Master', 'Hair & Makeup Artist', 'Dramaturg', 'Assistant Stage Manager',
    'Run Crew', 'Dresser', 'Dialect Coach', 'Fight Choreographer',
    'Intimacy Coordinator', 'Pit Orchestra Member', 'Scenic Painter',
  ],
  'Live Music | Contemporary | Jazz | Electronic | Indie': [
    'Lead Vocalist', 'Guitarist', 'Lead Guitar', 'Rhythm Guitar', 'Bassist',
    'Drummer', 'Keyboardist', 'Saxophonist', 'Trumpeter', 'Trombonist', 'DJ',
    'Music Producer', 'Tour Manager', 'Merch Manager', 'Roadie', 'Backing Vocalist',
    'Violinist/Fiddler', 'Cellist', 'Percussionist', 'Harmonica Player',
    'Pedal Steel Guitar', 'Banjo Player', 'Mandolin Player', 'Accordion Player',
    'Turntablist', 'Hype Person',
  ],
  'Orchestral | Classical | Choral': [
    'Conductor', 'Concertmaster', 'First Violin', 'Second Violin', 'Viola',
    'Cello', 'Double Bass', 'Flute', 'Oboe', 'Clarinet', 'Bassoon',
    'French Horn', 'Trumpet', 'Trombone', 'Tuba', 'Timpani', 'Percussion',
    'Harp', 'Piano', 'Choir Director', 'Soprano', 'Alto', 'Tenor', 'Baritone',
    'Bass (Voice)', 'Accompanist', 'Librarian', 'Orchestra Manager',
    'Music Director', 'Guest Soloist',
  ],
  'Comedy | Speaking | Lectures | Workshops': [
    'Comedian/Comic', 'Host/Emcee', 'Keynote Speaker', 'Panelist', 'Moderator',
    'Workshop Facilitator', 'Improv Player', 'Sketch Writer', 'Opening Act',
    'Headliner', 'Guest Lecturer', 'Q&A Moderator', 'Sign Language Interpreter',
    'AV Technician',
  ],
  'Dance | Performance Art | Experimental': [
    'Choreographer', 'Lead Dancer', 'Corps de Ballet', 'Dance Captain',
    'Performance Artist', 'Installation Artist', 'Visual Artist',
    'Multimedia Designer', 'Video Artist', 'Composer', 'Movement Director',
    'Aerialist', 'Acrobat', 'Puppeteer', 'Projection Designer', 'Interactive Designer',
  ],
};

export default function CrewPortal() {
  const { crew, addCrewMember, updateCrewMember, removeCrewMember } = useVenue();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);

  const availableRoles = useMemo(() => {
    return [...UNIVERSAL_ROLES, ...(GENRE_ROLES[selectedGenre] || [])];
  }, [selectedGenre]);

  const [role, setRole] = useState(availableRoles[0]);

  const handleGenreChange = (e) => {
    const g = e.target.value;
    setSelectedGenre(g);
    const newRoles = [...UNIVERSAL_ROLES, ...(GENRE_ROLES[g] || [])];
    if (!newRoles.includes(role)) setRole(newRoles[0]);
  };

  const handleInvite = (e) => {
    e.preventDefault();
    if (!name || !email) return;
    addCrewMember({ name, email, role });
    setName(''); setEmail(''); setRole(availableRoles[0]);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-3xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Crew Portal</h1>
      <p className="text-gray-500 mb-6">Manage your event crew and assign roles.</p>

      {/* Genre Selector */}
      <div className="card mb-6">
        <h3 className="text-lg mb-3">🎭 Select Genre</h3>
        <p className="text-xs text-gray-500 mb-3">Choose a genre to see relevant crew roles</p>
        <select value={selectedGenre} onChange={handleGenreChange}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
          {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400">{availableRoles.length} roles available</span>
        </div>
      </div>

      {/* Invite Form */}
      <div className="card mb-6">
        <h3 className="text-lg mb-4">Invite Crew Member</h3>
        <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-3">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" required
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
          <select value={role} onChange={e => setRole(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white min-w-[200px]">
            <optgroup label="Universal Roles">
              {UNIVERSAL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </optgroup>
            <optgroup label={selectedGenre}>
              {(GENRE_ROLES[selectedGenre] || []).map(r => <option key={r} value={r}>{r}</option>)}
            </optgroup>
          </select>
          <button type="submit" className="btn-primary whitespace-nowrap">+ Invite</button>
        </form>
      </div>

      {/* Crew List */}
      <div className="card">
        <h3 className="text-lg mb-4">Crew ({crew.length})</h3>
        {crew.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No crew members yet. Invite someone above!</p>
        ) : (
          <div className="space-y-3">
            {crew.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-[#f5f5f5] rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#0d1b2a] text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select value={member.role} onChange={e => updateCrewMember(member.id, { role: e.target.value })}
                    className="px-3 py-1.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:border-[#c8a45e]">
                    <optgroup label="Universal">
                      {UNIVERSAL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </optgroup>
                    <optgroup label={selectedGenre}>
                      {(GENRE_ROLES[selectedGenre] || []).map(r => <option key={r} value={r}>{r}</option>)}
                    </optgroup>
                  </select>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    member.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {member.status}
                  </span>
                  <button onClick={() => removeCrewMember(member.id)}
                    className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
