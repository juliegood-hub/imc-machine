import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthBrandHeader() {
  const { user } = useAuth();
  const brandHref = user ? '/' : '/login';

  return (
    <div className="text-center mb-8">
      <Link to={brandHref} className="inline-flex items-center justify-center no-underline">
        <div className="w-16 h-16 bg-[#c8a45e] rounded-2xl flex items-center justify-center mb-4">
          <span className="text-[#0d1b2a] font-bold text-xl tracking-wide">IMC</span>
        </div>
      </Link>
      <p className="text-[#c8a45e] text-sm font-semibold uppercase tracking-[0.12em] m-0">GOOD CREATIVE MEDIA</p>
      <h1 className="text-white text-2xl sm:text-3xl font-bold leading-tight m-0 mt-1">THE IMC MACHINE</h1>
      <p className="text-gray-300 text-[11px] sm:text-xs uppercase tracking-[0.08em] m-0 mt-1">
        YOUR LIVE EVENT INTEGRATED MARKETING COMMUNICATIONS MEDIA MANAGEMENT MONSTER
      </p>
    </div>
  );
}
