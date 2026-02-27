import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVenue } from '../context/VenueContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { venue } = useVenue();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const brandHref = user ? '/' : '/login';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <nav className="bg-[#0d1b2a] text-white px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link to={brandHref} className="flex items-center gap-3 no-underline">
        <div className="w-8 h-8 bg-[#c8a45e] rounded-lg flex items-center justify-center font-bold text-[#0d1b2a] text-sm">IMC</div>
        <div>
          <div className="text-[10px] font-semibold text-[#c8a45e] uppercase tracking-[0.1em] leading-tight">IMC</div>
          <div className="text-[10px] font-semibold text-[#c8a45e] uppercase tracking-[0.1em] leading-tight">GOOD CREATIVE MEDIA</div>
          <div className="text-sm font-semibold text-white leading-tight mt-1">THE IMC MACHINE</div>
          <div className="text-[9px] sm:text-[10px] text-gray-300 uppercase tracking-[0.06em] leading-tight">YOUR LIVE EVENT INTEGRATED MARKETING COMMUNICATIONS MEDIA MANAGEMENT MONSTER</div>
        </div>
      </Link>

      {user && (
        <>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">📊 Dashboard</Link>
            <Link to="/events/create" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">🎪 Events</Link>
            <Link to="/imc-composer" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">IMC Composer</Link>
            <Link to="/format-images" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">🖼️ Format</Link>
            <Link to="/chat" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">💬 Chat</Link>
            <Link to="/crew" className="text-sm text-gray-300 hover:text-[#c8a45e] no-underline">👥 Crew</Link>
            {user.isAdmin && <Link to="/admin" className="text-sm text-[#c8a45e] hover:text-white no-underline">👑 Admin</Link>}
            <div className="flex items-center gap-3 ml-4">
              <span className="text-xs text-gray-400">{venue.name || user.email}</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-white cursor-pointer bg-transparent border-none">Logout</button>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden bg-transparent border-none text-white text-xl cursor-pointer">☰</button>

          {menuOpen && (
            <div className="absolute top-full left-0 right-0 bg-[#0d1b2a] border-t border-gray-700 md:hidden flex flex-col p-4 gap-3">
              <Link to="/" onClick={() => setMenuOpen(false)} className="text-gray-300 no-underline text-sm">📊 Dashboard</Link>
              <Link to="/events/create" onClick={() => setMenuOpen(false)} className="text-gray-300 no-underline text-sm">🎪 Events</Link>
              <Link to="/imc-composer" onClick={() => setMenuOpen(false)} className="text-gray-300 no-underline text-sm">IMC Composer</Link>
              <Link to="/chat" onClick={() => setMenuOpen(false)} className="text-gray-300 no-underline text-sm">💬 Chat</Link>
              <Link to="/podcast" onClick={() => setMenuOpen(false)} className="text-gray-300 no-underline text-sm">🎙️ Podcast</Link>
              <Link to="/format-images" onClick={() => setMenuOpen(false)} className="text-gray-300 no-underline text-sm">🖼️ Format</Link>
              <Link to="/crew" onClick={() => setMenuOpen(false)} className="text-gray-300 no-underline text-sm">👥 Crew</Link>
              <Link to="/pricing" onClick={() => setMenuOpen(false)} className="text-gray-300 no-underline text-sm">💳 Pricing</Link>
              <Link to="/settings" onClick={() => setMenuOpen(false)} className="text-gray-300 no-underline text-sm">Settings</Link>
              {user.isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)} className="text-[#c8a45e] no-underline text-sm font-semibold">👑 Admin Dashboard</Link>}
              <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="text-left text-gray-400 text-sm bg-transparent border-none cursor-pointer">Logout</button>
            </div>
          )}
        </>
      )}
    </nav>
  );
}
