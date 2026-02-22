import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#c8a45e] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-[#0d1b2a] font-bold text-xl">IMC</span>
          </div>
          <h1 className="text-white text-3xl mb-1">Good Creative Media</h1>
          <div className="text-[#c8a45e] text-lg font-bold tracking-widest leading-relaxed uppercase">
            <p className="m-0">The</p>
            <p className="m-0">IMC</p>
            <p className="m-0">Machine</p>
            <p className="m-0 text-sm mt-2 tracking-wide font-light normal-case opacity-80">Integrated Marketing Communications</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-8">
          <h2 className="text-2xl mb-6 text-center">Good to See You Again</h2>
          <p className="text-xs text-gray-400 text-center mb-4">* Required fields</p>

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
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Don't have an account? <Link to="/signup" className="text-[#c8a45e] font-semibold no-underline">Sign Up</Link>
          </p>
        </form>

        <div className="text-center mt-8">
          <p className="text-xs text-gray-500 leading-relaxed">
            The IMC Machine™ · Good to Go. © {new Date().getFullYear()} Julie Good. All Rights Reserved.
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            Made with love in San Antonio by Julie Good · Good Creative Media
          </p>
        </div>
      </div>
    </div>
  );
}
