import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SetupWizard() {
  const { user, isAdmin } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [showToast, setShowToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState({
    meta: { connected: false, status: 'Not configured', page_name: null },
    youtube: { connected: false, status: 'Not configured', channel_name: null },
    linkedin: { connected: false, status: 'Not configured', user_name: null }
  });

  // Form states
  const [metaSecret, setMetaSecret] = useState('');
  const [metaRedirectAdded, setMetaRedirectAdded] = useState(false);
  const [youtubeSecret, setYoutubeSecret] = useState('');
  const [youtubeRedirectAdded, setYoutubeRedirectAdded] = useState(false);
  const [linkedinClientId, setLinkedinClientId] = useState('');
  const [linkedinSecret, setLinkedinSecret] = useState('');
  const [linkedinRedirectAdded, setLinkedinRedirectAdded] = useState(false);

  // Load connection status on mount
  useEffect(() => {
    checkAllConnections();
  }, []);

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const checkAllConnections = async () => {
    try {
      const response = await fetch('/api/setup?action=check-connections');
      const data = await response.json();
      if (data.success) {
        setConnections(data.connections);
      }
    } catch (err) {
      console.error('Failed to check connections:', err);
    }
  };

  const showToastMessage = (type, message) => {
    setShowToast({ type, message });
  };

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showToastMessage('success', `${label} copied to clipboard!`);
    } catch (err) {
      console.error('Failed to copy:', err);
      showToastMessage('error', 'Failed to copy to clipboard');
    }
  };

  const saveSecret = async (platform, key, value) => {
    if (!value.trim()) {
      showToastMessage('error', 'Please enter a value');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-secret',
          platform,
          key,
          value
        })
      });

      const data = await response.json();
      if (data.success) {
        showToastMessage('success', `${platform} configuration saved!`);
        await checkAllConnections();
      } else {
        throw new Error(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      console.error('Failed to save secret:', err);
      showToastMessage('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const connectPlatform = async (platform) => {
    setLoading(true);
    try {
      let authAction;
      switch (platform) {
        case 'meta':
          authAction = 'fb-auth-url';
          break;
        case 'youtube':
          authAction = 'yt-auth-url';
          break;
        case 'linkedin':
          authAction = 'li-auth-url';
          break;
        default:
          throw new Error(`Unknown platform: ${platform}`);
      }

      const response = await fetch(`/api/oauth?action=${authAction}`);
      const data = await response.json();

      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to get authorization URL');
      }
    } catch (err) {
      console.error(`Failed to connect ${platform}:`, err);
      showToastMessage('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const testAllConnections = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/setup?action=test-connections');
      const data = await response.json();
      
      if (data.success) {
        showToastMessage('success', 'All connections tested successfully!');
        await checkAllConnections();
      } else {
        showToastMessage('error', data.error || 'Some connections failed');
      }
    } catch (err) {
      console.error('Failed to test connections:', err);
      showToastMessage('error', 'Failed to test connections');
    } finally {
      setLoading(false);
    }
  };

  const progress = () => {
    const connectedCount = Object.values(connections).filter(c => c.connected).length;
    return Math.round((connectedCount / 3) * 100);
  };

  const isStepComplete = (step) => {
    switch (step) {
      case 1:
        return connections.meta.connected;
      case 2:
        return connections.youtube.connected;
      case 3:
        return connections.linkedin.connected;
      case 4:
        return progress() === 100;
      default:
        return false;
    }
  };

  const allConnectionsComplete = progress() === 100;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl mb-4 flex items-center gap-3">
          <span>🔧</span>
          <span>Setup Wizard</span>
        </h1>
        <p className="text-gray-600 mb-6">
          Let's connect your social platforms. I'll walk you through each one, 
          handle the heavy lifting, and keep it as painless as possible.
        </p>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Setup Progress</span>
            <span className="text-sm text-gray-600">{progress()}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-[#c8a45e] to-[#d4b76e] h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress()}%` }}
            />
          </div>
        </div>

        {/* Step Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { num: 1, label: 'Meta (FB + IG)', icon: '📘' },
            { num: 2, label: 'YouTube', icon: '📺' },
            { num: 3, label: 'LinkedIn', icon: '💼' },
            { num: 4, label: 'Verify All', icon: '✅' }
          ].map(step => (
            <button
              key={step.num}
              onClick={() => setCurrentStep(step.num)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                currentStep === step.num
                  ? 'bg-[#c8a45e] text-[#0d1b2a]'
                  : isStepComplete(step.num)
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{isStepComplete(step.num) ? '✅' : step.icon}</span>
              <span>{step.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 1: Meta (Facebook + Instagram) */}
      {currentStep === 1 && (
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">📘</span>
            <div>
              <h2 className="text-2xl">Step 1: Meta (Facebook + Instagram)</h2>
              <p className="text-gray-600">Let's hook up your Facebook page and Instagram so we can post for you</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Status */}
            {connections.meta.connected && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-medium mb-1">
                  <span>✅</span>
                  <span>Meta Connected Successfully!</span>
                </div>
                <p className="text-sm text-green-700">
                  Facebook Page: <strong>{connections.meta.page_name}</strong>
                  {connections.meta.instagram_username && (
                    <span> • Instagram: <strong>@{connections.meta.instagram_username}</strong></span>
                  )}
                </p>
              </div>
            )}

            {/* Step 1: Open Meta Dashboard */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-3">1. Open Meta App Dashboard</h3>
              <button
                onClick={() => window.open('https://developers.facebook.com/apps/', '_blank')}
                className="btn-primary mb-3"
              >
                <span className="mr-2">🔗</span>
                Open Meta App Dashboard
              </button>
              <ol className="text-sm text-blue-800 space-y-1 pl-4">
                <li>1. Click on your app</li>
                <li>2. Go to Settings → Basic</li>
                <li>3. Copy the App Secret (click "Show")</li>
              </ol>
            </div>

            {/* Step 2: App Secret Input */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-semibold mb-3">2. Paste App Secret</h3>
              <div className="flex gap-3 mb-3">
                <input
                  type="password"
                  value={metaSecret}
                  onChange={(e) => setMetaSecret(e.target.value)}
                  placeholder="Paste your Meta App Secret here..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={() => saveSecret('meta', 'META_APP_SECRET', metaSecret)}
                  disabled={loading || !metaSecret.trim()}
                  className="btn-secondary disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Step 3: Add Redirect URI */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-3">3. Add Redirect URI</h3>
              <p className="text-sm text-yellow-800 mb-3">
                Go to Facebook Login → Settings → Valid OAuth Redirect URIs
              </p>
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  value="https://imc.goodcreativemedia.com/api/oauth?action=fb-callback"
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-yellow-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => copyToClipboard('https://imc.goodcreativemedia.com/api/oauth?action=fb-callback', 'Redirect URI')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Copy
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={metaRedirectAdded}
                  onChange={(e) => setMetaRedirectAdded(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>I've added the redirect URI to my Facebook app</span>
              </label>
            </div>

            {/* Step 4: Connect */}
            {metaRedirectAdded && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">4. Connect Facebook + Instagram</h3>
                <button
                  onClick={() => connectPlatform('meta')}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Connecting...' : '🔗 Connect Facebook + Instagram'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: YouTube */}
      {currentStep === 2 && (
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">📺</span>
            <div>
              <h2 className="text-2xl">Step 2: YouTube</h2>
              <p className="text-gray-600">Connect your YouTube channel so we can publish podcasts and video for you</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Status */}
            {connections.youtube.connected && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-medium mb-1">
                  <span>✅</span>
                  <span>YouTube Connected Successfully!</span>
                </div>
                <p className="text-sm text-green-700">
                  Channel: <strong>{connections.youtube.channel_name}</strong>
                </p>
              </div>
            )}

            {/* Step 1: Open Google Cloud Console */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-3">1. Create a Web OAuth Client in Google Cloud</h3>
              <button
                onClick={() => window.open('https://console.cloud.google.com/apis/credentials?project=imc-machine-portal', '_blank')}
                className="btn-primary mb-3"
              >
                <span className="mr-2">🔗</span>
                Open Google Cloud Credentials
              </button>
              <div className="text-sm text-red-800 space-y-2 mt-3">
                <p className="font-medium">If you already have a Web Application OAuth client:</p>
                <ol className="space-y-1 pl-4">
                  <li>1. Click on the OAuth 2.0 Client ID (Web application type)</li>
                  <li>2. Copy the <strong>Client Secret</strong></li>
                </ol>
                <hr className="border-red-200 my-3" />
                <p className="font-medium">If you only see an iOS client (or no clients):</p>
                <ol className="space-y-1 pl-4">
                  <li>1. Click <strong>+ CREATE CREDENTIALS</strong> at the top → <strong>OAuth client ID</strong></li>
                  <li>2. Application type: <strong>Web application</strong></li>
                  <li>3. Name: <strong>IMC Machine Web</strong></li>
                  <li>4. Under <strong>Authorized redirect URIs</strong>, click <strong>+ ADD URI</strong> and paste:</li>
                </ol>
                <div className="flex gap-2 mt-2 ml-4">
                  <input
                    type="text"
                    value="https://imc.goodcreativemedia.com/api/oauth?action=yt-callback"
                    readOnly
                    className="flex-1 px-2 py-1 bg-white border border-red-300 rounded text-xs"
                  />
                  <button
                    onClick={() => copyToClipboard('https://imc.goodcreativemedia.com/api/oauth?action=yt-callback', 'YouTube Redirect URI')}
                    className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                  >
                    Copy
                  </button>
                </div>
                <ol start="5" className="space-y-1 pl-4 mt-2">
                  <li>5. Click <strong>Create</strong></li>
                  <li>6. Copy the <strong>Client Secret</strong> from the popup (or click the client to see it)</li>
                </ol>
              </div>
              <div className="mt-3 p-3 bg-red-100 rounded text-sm text-red-900">
                <strong>Also verify:</strong> YouTube Data API v3 is enabled → 
                <button
                  onClick={() => window.open('https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=imc-machine-portal', '_blank')}
                  className="underline font-medium ml-1"
                >
                  Check here
                </button>
              </div>
            </div>

            {/* Step 2: Client Secret Input */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-semibold mb-3">2. Paste Client Secret</h3>
              <p className="text-sm text-gray-600 mb-3">The Client Secret from the Web Application OAuth client you just created or found.</p>
              <div className="flex gap-3 mb-3">
                <input
                  type="password"
                  value={youtubeSecret}
                  onChange={(e) => setYoutubeSecret(e.target.value)}
                  placeholder="Paste your YouTube Client Secret here..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={() => saveSecret('youtube', 'YOUTUBE_CLIENT_SECRET', youtubeSecret)}
                  disabled={loading || !youtubeSecret.trim()}
                  className="btn-secondary disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Step 3: Add Redirect URI */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-3">3. Add Redirect URI</h3>
              <p className="text-sm text-yellow-800 mb-3">
                In your OAuth client, add this to Authorized redirect URIs
              </p>
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  value="https://imc.goodcreativemedia.com/api/oauth?action=yt-callback"
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-yellow-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => copyToClipboard('https://imc.goodcreativemedia.com/api/oauth?action=yt-callback', 'YouTube Redirect URI')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Copy
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={youtubeRedirectAdded}
                  onChange={(e) => setYoutubeRedirectAdded(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>I've added the redirect URI to my Google OAuth client</span>
              </label>
            </div>

            {/* Step 4: Connect */}
            {youtubeRedirectAdded && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">4. Connect YouTube</h3>
                <button
                  onClick={() => connectPlatform('youtube')}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Connecting...' : '🔗 Connect YouTube Channel'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: LinkedIn */}
      {currentStep === 3 && (
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">💼</span>
            <div>
              <h2 className="text-2xl">Step 3: LinkedIn</h2>
              <p className="text-gray-600">Connect LinkedIn so your events reach the professional crowd too</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Status */}
            {connections.linkedin.connected && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-medium mb-1">
                  <span>✅</span>
                  <span>LinkedIn Connected Successfully!</span>
                </div>
                <p className="text-sm text-green-700">
                  User: <strong>{connections.linkedin.user_name}</strong>
                </p>
              </div>
            )}

            {/* Step 1: LinkedIn App */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-3">1. Create or Open LinkedIn App</h3>
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => window.open('https://www.linkedin.com/developers/apps/new', '_blank')}
                  className="btn-primary"
                >
                  <span className="mr-2">🆕</span>
                  Create New LinkedIn App
                </button>
                <button
                  onClick={() => window.open('https://www.linkedin.com/developers/apps/', '_blank')}
                  className="btn-secondary"
                >
                  <span className="mr-2">📱</span>
                  Open Existing Apps
                </button>
              </div>
              <div className="text-sm text-blue-800 space-y-2">
                <p className="font-medium">If creating a new app:</p>
                <ol className="space-y-1 pl-4">
                  <li>1. App name: <strong>IMC Machine</strong> (or your business name)</li>
                  <li>2. LinkedIn Page: select <strong>Good Creative Media</strong> (or your company page)</li>
                  <li>3. App logo: upload any square image</li>
                  <li>4. Check the legal agreement box → <strong>Create app</strong></li>
                </ol>
                <hr className="border-blue-200 my-3" />
                <p className="font-medium">Then get your credentials:</p>
                <ol className="space-y-1 pl-4">
                  <li>1. Go to the <strong>Auth</strong> tab</li>
                  <li>2. Copy <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                </ol>
                <hr className="border-blue-200 my-3" />
                <p className="font-medium">Enable required products (Products tab):</p>
                <ol className="space-y-1 pl-4">
                  <li>• <strong>Share on LinkedIn</strong> — for posting content</li>
                  <li>• <strong>Sign In with LinkedIn using OpenID Connect</strong> — for authentication</li>
                  <li>• <strong>Community Management API</strong> — for 365-day tokens (optional but recommended)</li>
                </ol>
              </div>
            </div>

            {/* Step 2: Credentials Input */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-semibold mb-3">2. Paste LinkedIn Credentials</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={linkedinClientId}
                    onChange={(e) => setLinkedinClientId(e.target.value)}
                    placeholder="Paste LinkedIn Client ID here..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex gap-3">
                  <input
                    type="password"
                    value={linkedinSecret}
                    onChange={(e) => setLinkedinSecret(e.target.value)}
                    placeholder="Paste LinkedIn Client Secret here..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (linkedinClientId.trim()) {
                      await saveSecret('linkedin', 'LINKEDIN_CLIENT_ID', linkedinClientId);
                    }
                    if (linkedinSecret.trim()) {
                      await saveSecret('linkedin', 'LINKEDIN_CLIENT_SECRET', linkedinSecret);
                    }
                  }}
                  disabled={loading || (!linkedinClientId.trim() && !linkedinSecret.trim())}
                  className="btn-secondary disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save LinkedIn Credentials'}
                </button>
              </div>
            </div>

            {/* Step 3: Add Redirect URI */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-3">3. Add Redirect URI</h3>
              <p className="text-sm text-yellow-800 mb-3">
                In your LinkedIn app Auth settings, add this to Authorized redirect URLs
              </p>
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  value="https://imc.goodcreativemedia.com/api/oauth?action=li-callback"
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-yellow-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => copyToClipboard('https://imc.goodcreativemedia.com/api/oauth?action=li-callback', 'LinkedIn Redirect URI')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Copy
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={linkedinRedirectAdded}
                  onChange={(e) => setLinkedinRedirectAdded(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>I've added the redirect URI to my LinkedIn app</span>
              </label>
            </div>

            {/* Step 4: Connect */}
            {linkedinRedirectAdded && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">4. Connect LinkedIn</h3>
                <button
                  onClick={() => connectPlatform('linkedin')}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Connecting...' : '🔗 Connect LinkedIn Account'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Verify All */}
      {currentStep === 4 && (
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">✅</span>
            <div>
              <h2 className="text-2xl">Step 4: Verify All Connections</h2>
              <p className="text-gray-600">Let's make sure everything is talking to each other properly</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Connection Summary */}
            <div className="grid gap-4">
              {[
                { key: 'meta', name: 'Meta (Facebook + Instagram)', icon: '📘' },
                { key: 'youtube', name: 'YouTube', icon: '📺' },
                { key: 'linkedin', name: 'LinkedIn', icon: '💼' }
              ].map(platform => (
                <div key={platform.key} className={`p-4 rounded-lg border-2 ${
                  connections[platform.key].connected 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{platform.icon}</span>
                      <div>
                        <h3 className="font-medium">{platform.name}</h3>
                        <p className={`text-sm ${
                          connections[platform.key].connected ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {connections[platform.key].status}
                        </p>
                        {connections[platform.key].connected && (
                          <p className="text-xs text-gray-600 mt-1">
                            {platform.key === 'meta' && connections.meta.page_name && `Page: ${connections.meta.page_name}`}
                            {platform.key === 'youtube' && connections.youtube.channel_name && `Channel: ${connections.youtube.channel_name}`}
                            {platform.key === 'linkedin' && connections.linkedin.user_name && `User: ${connections.linkedin.user_name}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-2xl">
                      {connections[platform.key].connected ? '✅' : '❌'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Test Connections Button */}
            <div className="text-center">
              <button
                onClick={testAllConnections}
                disabled={loading}
                className="btn-primary text-lg px-8 py-3"
              >
                {loading ? 'Testing...' : '🔍 Test All Connections'}
              </button>
            </div>

            {/* Success State */}
            {allConnectionsComplete && (
              <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-green-800 mb-2">You're All Connected!</h3>
                <p className="text-green-700 mb-4">
                  Everything is wired up and ready to go. 
                  From here, you can push content to every platform with a single click. Let's put it to work.
                </p>
                <button
                  onClick={() => window.location.href = '/campaigns'}
                  className="btn-primary text-lg"
                >
                  🚀 Start Creating Campaigns
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md ${
          showToast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{showToast.message}</span>
            <button 
              onClick={() => setShowToast(null)}
              className="ml-3 text-lg font-bold opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}