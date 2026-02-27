import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isVenueRole } from '../constants/clientTypes';

export default function Sidebar() {
  const { user, isAdmin } = useAuth();
  const clientType = user?.clientType || 'venue';
  const isNonVenueProfile = !isVenueRole(clientType);

  const linkGroups = [
    {
      title: 'Core',
      links: [
        { to: '/', label: 'Dashboard', icon: '📊' },
        { to: '/workflow', label: 'How It Works', icon: '📖' },
        { to: '/events/create', label: 'Start Event', icon: '🎪' },
        { to: '/events/create?ai=intake&input=email', label: 'AI Intake (Voice + Email)', icon: '📥' },
        { to: '/imc-composer', label: 'IMC Composer', icon: '✨' },
        { to: '/campaigns', label: 'Campaign Tracker', icon: '📈' },
        { to: '/chat', label: 'Chat Hub', icon: '💬' },
      ],
    },
    {
      title: 'Production',
      links: [
        { to: '/production-ops', label: 'Production Ops Hub', icon: '🎬' },
        { to: '/production-ops/event-ops?focus=event_ops', label: 'Event Ops Modules', icon: '🧵' },
        { to: '/production-ops?focus=role_map', label: 'Role Responsibility Map', icon: '🧭' },
        { to: '/production-ops/event-ops?focus=event_ops&opsTab=concessions', label: 'Menus + Bev Specials', icon: '🍔' },
        { to: '/production-ops/event-ops?focus=event_ops&opsTab=merch', label: 'Merch + Vendors', icon: '🛍️' },
        { to: '/production-ops/staffing?focus=staffing', label: 'Staff Scheduler', icon: '🧑‍💼' },
        { to: '/production-ops/training?focus=training', label: 'Training + Certs', icon: '🎓' },
        { to: '/production-ops/inventory?focus=inventory', label: 'Inventory + Ordering', icon: '📦' },
        { to: '/podcast', label: 'Capture + Podcast', icon: '🎥' },
        { to: '/production-calendar', label: 'Production Calendar', icon: '🗓️' },
        { to: '/run-of-show', label: 'Run of Show', icon: '📋' },
      ],
    },
    {
      title: 'Libraries',
      links: [
        isNonVenueProfile
          ? { to: '/artist-setup', label: 'Artist Profile', icon: '🎵' }
          : { to: '/venue-setup', label: 'Venue Setup', icon: '🏛️' },
        { to: '/crew', label: 'Crew Portal', icon: '👥' },
        { to: '/media', label: 'Media Gallery', icon: '📸' },
        { to: '/press-page/new', label: 'Press Page', icon: '🌐' },
      ],
    },
    {
      title: 'System',
      links: [
        { to: '/setup', label: 'Setup', icon: '🔧' },
        { to: '/settings', label: 'Settings', icon: '⚙️' },
      ],
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-200 fixed left-0 top-[52px] h-[calc(100vh-52px)] overflow-y-auto py-4 z-30">
      {linkGroups.map((group) => (
        <div key={group.title} className="mb-2">
          <p className="px-5 pt-2 pb-1 m-0 text-[10px] uppercase tracking-wide text-gray-400">{group.title}</p>
          {group.links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/' || link.to === '/production-ops'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2 text-sm no-underline transition-colors ${
                  isActive ? 'text-[#0d1b2a] bg-[#f5f5f5] font-semibold border-r-3 border-[#c8a45e]' : 'text-gray-500 hover:text-[#0d1b2a] hover:bg-gray-50'
                }`
              }
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>
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
