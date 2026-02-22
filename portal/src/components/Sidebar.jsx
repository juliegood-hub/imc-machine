import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, isAdmin } = useAuth();
  const clientType = user?.clientType || 'venue';
  const isArtist = ['artist', 'performer'].includes(clientType);

  const links = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    isArtist
      ? { to: '/artist-setup', label: 'Artist Profile', icon: '🎵' }
      : { to: '/venue-setup', label: 'Venue Setup', icon: '🏛️' },
    { to: '/events/create', label: 'Create Event', icon: '🎪' },
    { to: '/imc-composer', label: 'IMC Composer', icon: '✨' },
    { to: '/podcast', label: 'Podcast', icon: '🎙️' },
    { to: '/campaigns', label: 'Campaign Tracker', icon: '📊' },
    { to: '/media', label: 'Media Gallery', icon: '📸' },
    { to: '/press-page/new', label: 'Press Page', icon: '🌐' },
    { to: '/run-of-show', label: 'Run of Show', icon: '📋' },
    { to: '/crew', label: 'Crew Portal', icon: '👥' },
    { to: '/workflow', label: 'How It Works', icon: '📖' },
    { to: '/setup', label: 'Setup', icon: '🔧' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-52px)] py-4">
      {links.map(l => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-5 py-2.5 text-sm no-underline transition-colors ${
              isActive ? 'text-[#0d1b2a] bg-[#f5f5f5] font-semibold border-r-3 border-[#c8a45e]' : 'text-gray-500 hover:text-[#0d1b2a] hover:bg-gray-50'
            }`
          }
        >
          <span>{l.icon}</span>
          <span>{l.label}</span>
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `flex items-center gap-3 px-5 py-2.5 text-sm no-underline transition-colors mt-2 border-t border-gray-100 pt-4 ${
              isActive ? 'text-[#0d1b2a] bg-[#f5f5f5] font-semibold border-r-3 border-[#c8a45e]' : 'text-gray-500 hover:text-[#0d1b2a] hover:bg-gray-50'
            }`
          }
        >
          <span>🔐</span>
          <span>Admin</span>
        </NavLink>
      )}
    </aside>
  );
}
