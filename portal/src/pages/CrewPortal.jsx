import { useState, useMemo } from 'react';
import { useVenue } from '../context/VenueContext';
import {
  THEATER_GENRE_KEY,
  THEATER_DEPARTMENTS,
  THEATER_ROLES_BY_DEPARTMENT,
  THEATER_ROLE_OPTIONS,
  getTheaterDepartmentForRole,
} from '../constants/theaterRoles';

const GENRES = [
  THEATER_GENRE_KEY,
  'Live Music | Contemporary | Jazz | Electronic | Indie',
  'Orchestral | Classical | Choral',
  'Comedy | Speaking | Lectures | Workshops',
  'Dance | Performance Art | Experimental',
  'Literary | Poetry | Book Signings',
  'Politics | Civic | Campaign Events',
];

const UNIVERSAL_ROLES = [
  'Producer', 'Stage Manager', 'Technical Director', 'Sound Engineer',
  'Lighting Designer', 'Front of House Manager', 'Box Office Manager',
  'Marketing/PR', 'Volunteer Coordinator', 'Photographer', 'Videographer',
  'Social Media Manager', 'House Manager', 'Security',
];

const GENRE_ROLES = {
  [THEATER_GENRE_KEY]: THEATER_ROLE_OPTIONS,
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
  'Literary | Poetry | Book Signings': [
    'Author', 'Poet', 'Moderator', 'Interviewer', 'Editor', 'Publisher',
    'Bookseller', 'Host/Emcee', 'Publicist', 'Reader',
  ],
  'Politics | Civic | Campaign Events': [
    'Candidate', 'Campaign Manager', 'Field Director', 'Policy Director',
    'Press Secretary', 'Volunteer Coordinator', 'Fundraising Chair',
    'Moderator', 'Host/Emcee',
  ],
};

function getRoleGroups(genre) {
  if (genre === THEATER_GENRE_KEY) {
    return [
      { label: 'Universal Roles', roles: UNIVERSAL_ROLES },
      ...THEATER_DEPARTMENTS.map(dept => ({
        label: dept.label,
        roles: THEATER_ROLES_BY_DEPARTMENT[dept.key] || [],
      })),
    ];
  }
  return [
    { label: 'Universal Roles', roles: UNIVERSAL_ROLES },
    { label: genre, roles: GENRE_ROLES[genre] || [] },
  ];
}

export default function CrewPortal() {
  const { crew, addCrewMember, updateCrewMember, removeCrewMember } = useVenue();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [roleSearch, setRoleSearch] = useState('');

  const roleGroups = useMemo(() => getRoleGroups(selectedGenre), [selectedGenre]);

  const filteredRoleGroups = useMemo(() => {
    if (!roleSearch.trim()) return roleGroups;
    const q = roleSearch.trim().toLowerCase();
    return roleGroups
      .map(group => ({
        ...group,
        roles: (group.roles || []).filter(role => role.toLowerCase().includes(q)),
      }))
      .filter(group => group.roles.length > 0);
  }, [roleGroups, roleSearch]);

  const availableRoles = useMemo(() => roleGroups.flatMap(g => g.roles || []), [roleGroups]);
  const [role, setRole] = useState(availableRoles[0] || '');

  const handleGenreChange = (e) => {
    const g = e.target.value;
    setSelectedGenre(g);
    const nextRoles = getRoleGroups(g).flatMap(group => group.roles || []);
    if (!nextRoles.includes(role)) setRole(nextRoles[0] || '');
  };

  const handleInvite = (e) => {
    e.preventDefault();
    if (!name || !email || !role) return;
    addCrewMember({
      name,
      email,
      role,
      department: selectedGenre === THEATER_GENRE_KEY ? getTheaterDepartmentForRole(role) : '',
    });
    setName('');
    setEmail('');
    setRole((availableRoles && availableRoles[0]) || '');
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-3xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Crew Portal</h1>
      <p className="text-gray-500 mb-6">Manage your event crew and assign roles.</p>

      <div className="card mb-6">
        <h3 className="text-lg mb-3">🎭 Select Genre</h3>
        <p className="text-xs text-gray-500 mb-3">Choose a genre to see relevant crew roles</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={selectedGenre} onChange={handleGenreChange}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white">
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {selectedGenre === THEATER_GENRE_KEY && (
            <input
              type="text"
              value={roleSearch}
              onChange={e => setRoleSearch(e.target.value)}
              placeholder="Filter theater roles (ex: fly, spotlight, wardrobe)"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
            />
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400">{availableRoles.length} roles available</span>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="text-lg mb-4">Invite Crew Member</h3>
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" required
              className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
              className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
            <select value={role} onChange={e => setRole(e.target.value)} required
              className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white min-w-[200px]">
              <option value="">Select role...</option>
              {filteredRoleGroups.length === 0 && (
                <option value="" disabled>No roles match that filter</option>
              )}
              {filteredRoleGroups.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.roles.map(r => <option key={r} value={r}>{r}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap">+ Invite</button>
        </form>
      </div>

      <div className="card">
        <h3 className="text-lg mb-4">Crew ({crew.length})</h3>
        {crew.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No crew members yet. Invite your first person above and I will track the team.</p>
        ) : (
          <div className="space-y-3">
            {crew.map(member => {
              const department = member.department || getTheaterDepartmentForRole(member.role || '');
              const memberRoleGroups = getRoleGroups(selectedGenre);
              return (
                <div key={member.id} className="flex items-center justify-between p-3 bg-[#f5f5f5] rounded-lg gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 bg-[#0d1b2a] text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      {(member.name || 'Crew').split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{member.name || 'Crew Member'}</div>
                      <div className="text-xs text-gray-500 truncate">{member.email}</div>
                      {department && <div className="text-[10px] text-gray-500">{department}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select value={member.role} onChange={e => updateCrewMember(member.id, { role: e.target.value, department: getTheaterDepartmentForRole(e.target.value) || member.department || '' })}
                      className="px-3 py-1.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:border-[#c8a45e]">
                      {memberRoleGroups.map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      member.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {member.status || 'invited'}
                    </span>
                    <button onClick={() => removeCrewMember(member.id)}
                      className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
