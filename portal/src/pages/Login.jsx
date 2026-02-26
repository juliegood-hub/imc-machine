import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthBrandHeader from '../components/AuthBrandHeader';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stepNote, setStepNote] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Give me your email and password, and we are in.'); return; }
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Hmm. Sign in did not go through yet. Try once more.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AuthBrandHeader />

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-8">
          <h2 className="text-2xl mb-6 text-center">Good to See You Again</h2>
          <p className="text-xs text-gray-400 text-center mb-4">* A few fields are required so I can open your dashboard.</p>

          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
              placeholder="you@venue.com" />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
              placeholder="••••••••" />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full text-center disabled:opacity-50">
            {submitting ? 'Signing you in...' : 'Let Me In'}
          </button>

          <div className="mt-4 border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-semibold m-0">Step Actions</p>
            <p className="text-xs text-gray-500 m-0 mt-1">Choose what you want to do with this step.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setStepNote('Beautiful. Login step marked complete.')}>✓ Mark Complete</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => setStepNote('Saved for later. Come back anytime.')}>Save for Later</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => navigate('/signup')}>Skip to Sign Up</button>
              <button type="submit" className="btn-secondary text-xs">Next Step → Dashboard</button>
            </div>
            {stepNote && <p className="text-xs text-emerald-700 mt-2 mb-0">{stepNote}</p>}
            <p className="text-xs text-gray-500 mt-2 mb-0">
              Next up: <span className="font-semibold text-gray-700">Dashboard</span> — after sign in, I will open your command center.
            </p>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            Don't have an account? <Link to="/signup" className="text-[#c8a45e] font-semibold no-underline">Sign Up</Link>
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
