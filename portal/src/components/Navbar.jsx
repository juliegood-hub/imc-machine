import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVenue } from '../context/VenueContext';
import { useEffect, useRef, useState } from 'react';
import CircleAvatar from './CircleAvatar';
import GlobalSearchBar from './GlobalSearchBar';
import { isVenueRole } from '../constants/clientTypes';
import { HELP_MENU_LINKS } from '../constants/helpCenterContent';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { venue, events } = useVenue();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const navRef = useRef(null);
  const brandHref = user ? '/' : '/login';
  const clientType = user?.clientType || 'venue';
  const isNonVenueProfile = !isVenueRole(clientType);
  const latestPosterEvent = (events || []).find((event) => event?.mainPosterUrl || event?.productionDetails?.mainPosterUrl);
  const profileAvatarEntity = {
    name: venue.name || user?.name || user?.email || '',
    avatarUrl: venue.avatarUrl || '',
    logo: venue.logo || '',
    headshot: venue.headshot || '',
    mainPosterUrl: latestPosterEvent?.mainPosterUrl || latestPosterEvent?.productionDetails?.mainPosterUrl || '',
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const mobileLinkGroups = [
    {
      title: 'Core',
      links: [
        { to: '/', label: 'Dashboard', icon: '📊' },
        { to: '/workflow', label: 'How It Works', icon: '📖' },
        { to: '/white-papers', label: 'White Papers', icon: '📄' },
        { to: '/user-guide', label: 'User Guide', icon: '🧭' },
        { to: '/events/create', label: 'Start Event', icon: '🎪' },
        { to: '/search', label: 'Global Search', icon: '🔎' },
        { to: '/events/create?ai=intake&input=email', label: 'AI Intake (Voice + Email)', icon: '📥' },
        { to: '/imc-composer', label: 'IMC Composer', icon: '✨' },
        { to: '/campaigns', label: 'Campaign Tracker', icon: '📈' },
        { to: '/chat', label: 'Chat Dashboard', icon: '💬' },
        { to: '/buddy', label: 'CatBot Buddy', icon: '🐈‍⬛' },
      ],
    },
    {
      title: 'Production',
      links: [
        { to: '/production-ops', label: 'Production Ops Hub', icon: '🎬' },
        { to: '/production-ops/event-ops?focus=event_ops', label: 'Event Ops Modules', icon: '🧵' },
        { to: '/production-ops/event-ops?focus=event_ops', label: 'Plots + Layouts', icon: '🗺️' },
        { to: '/safety-risk', label: 'Safety + Risk', icon: '🛡️' },
        { to: '/production-ops?focus=role_map', label: 'Role Responsibility Map', icon: '🧭' },
        { to: '/production-ops/event-ops?focus=event_ops&opsTab=concessions', label: 'Menus + Bev Specials', icon: '🍔' },
        { to: '/production-ops/event-ops?focus=event_ops&opsTab=merch', label: 'Merch + Vendors', icon: '🛍️' },
        { to: '/production-ops/staffing?focus=staffing', label: 'Staff Scheduler', icon: '🧑‍💼' },
        { to: '/production-ops/training?focus=training', label: 'Training + Certs', icon: '🎓' },
        { to: '/production-ops/inventory?focus=inventory', label: 'Inventory + Ordering', icon: '📦' },
      ],
    },
    {
      title: 'Capture',
      links: [
        { to: '/podcast', label: 'Capture Hub', icon: '🎥' },
        { to: '/format-images', label: 'Image + Video Format', icon: '🖼️' },
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
        { to: '/pricing', label: 'Pricing', icon: '💳' },
        { to: '/setup', label: 'Setup', icon: '🔧' },
        { to: '/settings', label: 'Settings', icon: '⚙️' },
      ],
    },
  ];

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !navRef.current) return undefined;
    const updateNavHeight = () => {
      const navHeight = Math.ceil(navRef.current?.getBoundingClientRect()?.height || 52);
      document.documentElement.style.setProperty('--imc-nav-height', `${navHeight}px`);
    };

    updateNavHeight();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateNavHeight) : null;
    if (observer && navRef.current) observer.observe(navRef.current);
    window.addEventListener('resize', updateNavHeight);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateNavHeight);
    };
  }, []);

  useEffect(() => {
    setHelpOpen(false);
  }, [menuOpen, location.pathname]);

  useEffect(() => {
    if (!helpOpen) return undefined;
    const onPointerDown = (event) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(event.target)) {
        setHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [helpOpen]);

  return (
    <nav ref={navRef} className="relative bg-[#0d1b2a] text-white px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link to={brandHref} className="flex items-center gap-3 no-underline min-w-0 flex-1 xl:flex-none xl:max-w-[32rem] pr-2 md:pr-4">
        <img
          src="/imc-catbot-icon.svg"
          alt="The IMC Machine"
          className="rounded-lg shrink-0 object-cover"
          style={{
            width: 'clamp(2.25rem, 4.5vw, 2.75rem)',
            height: 'clamp(2.25rem, 4.5vw, 2.75rem)',
          }}
        />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-[#c8a45e] uppercase tracking-[0.1em] leading-tight whitespace-nowrap">GOOD CREATIVE MEDIA</div>
          <div className="text-sm font-semibold text-white leading-tight mt-1">THE IMC MACHINE</div>
          <div
            className="mt-0.5 text-[8px] sm:text-[9px] text-gray-300 uppercase tracking-[0.05em] leading-tight max-w-[11rem] sm:max-w-[17rem]"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            YOUR LIVE EVENT INTEGRATED MARKETING COMMUNICATIONS MEDIA MANAGEMENT MONSTER
          </div>
        </div>
      </Link>

      {user && (
        <>
          {/* Desktop nav */}
          <div className="hidden xl:flex items-center gap-4 ml-auto min-w-0">
            <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">📊 Dashboard</Link>
            <Link to="/workflow" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">📖 How It Works</Link>
            <Link to="/white-papers" className="hidden 2xl:inline text-sm text-gray-300 hover:text-[#c8a45e] no-underline">📄 White Papers</Link>
            <Link to="/user-guide" className="hidden 2xl:inline text-sm text-gray-300 hover:text-[#c8a45e] no-underline">🧭 User Guide</Link>
            <Link to="/events/create" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">🎪 Events</Link>
            <Link to="/imc-composer" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">IMC Composer</Link>
            <Link to="/podcast" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">🎥 Capture</Link>
            <Link to="/safety-risk" className="hidden 2xl:inline text-sm text-gray-300 hover:text-[#c8a45e] no-underline">🛡️ Safety</Link>
            <Link to="/chat" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">💬 Chat Dashboard</Link>
            <Link to="/buddy" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">🐈‍⬛ CatBot Buddy</Link>
            <Link to="/crew" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">👥 Crew</Link>
            <div className="relative">
              <button
                type="button"
                onClick={() => setHelpOpen((prev) => !prev)}
                className="text-sm text-gray-300 hover:text-[#c8a45e] bg-transparent border-none cursor-pointer"
              >
                ❓ Help
              </button>
              {helpOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded border border-gray-700 bg-[#0d1b2a] shadow-lg p-2 z-[80]">
                  {HELP_MENU_LINKS.map((link) => (
                    <Link
                      key={`help-${link.key}`}
                      to={link.path}
                      onClick={() => setHelpOpen(false)}
                      className="block text-xs text-gray-300 hover:text-[#c8a45e] no-underline px-2 py-1 rounded hover:bg-[#112a44]"
                    >
                      {link.icon} {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {user.isAdmin && <Link to="/admin" className="text-sm text-[#c8a45e] hover:text-white no-underline">👑 Admin</Link>}
            <div className="flex items-center gap-3 ml-4">
              <CircleAvatar
                entity={profileAvatarEntity}
                type="user"
                name={venue.name || user?.name || user?.email}
                size="w-7 h-7"
                textSize="text-[9px]"
              />
              <span className="text-xs text-gray-400">{venue.name || user.email}</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-white cursor-pointer bg-transparent border-none">Logout</button>
            </div>
          </div>
          </div>

          <div className="xl:hidden flex items-center gap-1">
            <GlobalSearchBar
              mode="compact"
              className="mr-1"
              placeholder="Search pages, events, venues, people…"
            />
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="relative z-[70] bg-transparent border-none text-white text-2xl leading-none cursor-pointer p-2 -mr-2"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>

          {menuOpen && (
            <div className="absolute top-full left-0 right-0 z-[65] bg-[#0d1b2a] border-t border-gray-700 xl:hidden flex flex-col p-4 gap-3 max-h-[70vh] overflow-y-auto">
              {mobileLinkGroups.map((group) => (
                <div key={group.title} className="pb-2 border-b border-gray-800 last:border-b-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 m-0 mb-2">{group.title}</p>
                  <div className="flex flex-col gap-2">
                    {group.links.map((link) => (
                      <Link
                        key={`${group.title}-${link.to}`}
                        to={link.to}
                        onClick={() => setMenuOpen(false)}
                        className="text-gray-300 no-underline text-sm"
                      >
                        {link.icon} {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {user.isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)} className="text-[#c8a45e] no-underline text-sm font-semibold">👑 Admin Dashboard</Link>}
              <div className="flex items-center gap-2 mt-1">
                <CircleAvatar
                  entity={profileAvatarEntity}
                  type="user"
                  name={venue.name || user?.name || user?.email}
                  size="w-7 h-7"
                  textSize="text-[9px]"
                />
                <span className="text-xs text-gray-400">{venue.name || user.email}</span>
              </div>
              <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="text-left text-gray-400 text-sm bg-transparent border-none cursor-pointer">Logout</button>
            </div>
          )}
        </>
      )}
    </nav>
  );
}
