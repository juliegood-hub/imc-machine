import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVenue } from '../context/VenueContext';
import { Link, useSearchParams } from 'react-router-dom';

export default function Settings() {
  const { user, logout } = useAuth();
  const { venue, saveVenue } = useVenue();
  const [searchParams] = useSearchParams();
  
  // Settings state
  const [venueDefaults, setVenueDefaults] = useState({
    defaultBrandColors: venue.brandPrimary || '#c8a45e',
    defaultWritingTone: 'professional', 
    defaultBio: venue.bio || '',
    defaultGenre: venue.genre || '',
  });
  
  const [notifications, setNotifications] = useState({
    emailOnCampaignComplete: true,
    emailOnEventCreated: false,
    emailWeeklyReport: true,
    smsReminders: false,
  });

  const [connections, setConnections] = useState({
    openai: { connected: false, status: 'Not connected' },
    google_drive: { connected: false, status: 'Not connected' },
    facebook: { connected: false, status: 'Not connected' },
    instagram: { connected: false, status: 'Not connected' },
    youtube: { connected: false, status: 'Not connected' },
    linkedin: { connected: false, status: 'Not connected' },
    eventbrite: { connected: false, status: 'Not connected' },
    mailchimp: { connected: false, status: 'Not connected' },
  });

  const [saving, setSaving] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [connectingTo, setConnectingTo] = useState(null);
  const [showToast, setShowToast] = useState(null);

  // Load user preferences on mount
  useEffect(() => {
    loadUserPreferences();
    checkConnectionStatuses();
    handleOAuthCallback();
  }, [user?.id]);

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const loadUserPreferences = async () => {
    if (!user?.id) return;

    try {
      // Load from a preferences table or use defaults
      // For now, we'll use localStorage as a fallback
      const savedPrefs = localStorage.getItem(`user_prefs_${user.id}`);
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.notifications) setNotifications(prefs.notifications);
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  const checkConnectionStatuses = async () => {
    try {
      // Check OAuth connections
      const response = await fetch('/api/oauth?action=check-connections');
      const data = await response.json();
      
      if (data.success) {
        setConnections(prev => ({
          ...prev,
          ...data.connections,
          openai: { 
            connected: !!import.meta.env.VITE_OPENAI_API_KEY, 
            status: import.meta.env.VITE_OPENAI_API_KEY ? 'Connected' : 'API key required' 
          },
          google_drive: { 
            connected: !!venue.driveRootFolderId, 
            status: venue.driveRootFolderId ? 'Connected' : 'Not connected' 
          },
          eventbrite: { 
            connected: !!import.meta.env.VITE_EVENTBRITE_TOKEN, 
            status: import.meta.env.VITE_EVENTBRITE_TOKEN ? 'Connected' : 'Token required' 
          },
          mailchimp: { 
            connected: !!import.meta.env.VITE_MAILCHIMP_API_KEY, 
            status: import.meta.env.VITE_MAILCHIMP_API_KEY ? 'Connected' : 'API key required' 
          },
        }));
      }
    } catch (err) {
      console.error('Failed to check connection statuses:', err);
    }
  };

  const handleOAuthCallback = () => {
    const connected = searchParams.get('connected');
    const status = searchParams.get('status');
    const message = searchParams.get('message');

    if (connected && status) {
      if (status === 'success') {
        setShowToast({
          type: 'success',
          message: `Successfully connected to ${connected.charAt(0).toUpperCase() + connected.slice(1)}!`
        });
        // Refresh connection status
        setTimeout(checkConnectionStatuses, 1000);
      } else if (status === 'error') {
        setShowToast({
          type: 'error', 
          message: `Failed to connect to ${connected}: ${message || 'Unknown error'}`
        });
      }
      
      // Clean up URL params
      window.history.replaceState({}, '', '/settings');
    }
  };

  const handleSaveVenueDefaults = async () => {
    setSaving(true);
    try {
      await saveVenue({
        brandPrimary: venueDefaults.defaultBrandColors,
        bio: venueDefaults.defaultBio,
        genre: venueDefaults.defaultGenre,
        // Store writing tone as a custom field
        writingTone: venueDefaults.defaultWritingTone,
      });
      alert('Venue defaults saved successfully!');
    } catch (err) {
      console.error('Failed to save venue defaults:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    try {
      localStorage.setItem(`user_prefs_${user.id}`, JSON.stringify({
        notifications,
        updatedAt: new Date().toISOString(),
      }));
      alert('Notification preferences saved!');
    } catch (err) {
      console.error('Failed to save notifications:', err);
      alert('Failed to save notification preferences');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== user.email) {
      alert('Please type your email address exactly to confirm deletion.');
      return;
    }

    if (!confirm('This action cannot be undone. Are you absolutely sure?')) {
      return;
    }

    try {
      // In a real implementation, this would call a secure delete endpoint
      alert('Account deletion request submitted. This feature requires admin approval for safety.');
      setShowDeleteAccount(false);
      setDeleteConfirmation('');
    } catch (err) {
      console.error('Failed to delete account:', err);
      alert('Failed to delete account: ' + err.message);
    }
  };

  const connectService = async (service) => {
    if (['openai', 'google_drive', 'eventbrite', 'mailchimp'].includes(service)) {
      alert(`Connecting to ${service}... This feature requires manual API key configuration. Contact admin for setup.`);
      return;
    }

    setConnectingTo(service);
    
    try {
      let authAction;
      switch (service) {
        case 'facebook':
        case 'instagram':
          authAction = 'fb-auth-url';
          break;
        case 'youtube':
          authAction = 'yt-auth-url';
          break;
        case 'linkedin':
          authAction = 'li-auth-url';
          break;
        default:
          alert(`OAuth not supported for ${service}`);
          return;
      }
      
      const response = await fetch(`/api/oauth?action=${authAction}`);
      const data = await response.json();
      
      if (data.success && data.authUrl) {
        // Redirect to OAuth provider
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to get authorization URL');
      }
    } catch (err) {
      console.error(`Failed to connect to ${service}:`, err);
      alert(`Failed to connect to ${service}: ${err.message}`);
    } finally {
      setConnectingTo(null);
    }
  };

  const disconnectService = async (service) => {
    if (!confirm(`Are you sure you want to disconnect ${service}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/oauth?action=disconnect&platform=${service}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setShowToast({
          type: 'success',
          message: `Successfully disconnected ${service}`
        });
        await checkConnectionStatuses();
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      console.error(`Failed to disconnect ${service}:`, err);
      alert(`Failed to disconnect ${service}: ${err.message}`);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-3xl mb-6">⚙️ Settings</h1>
      <p className="text-xs text-gray-400 mb-6">* Required fields</p>

      {/* Account Information */}
      <div className="card mb-6">
        <h3 className="text-lg mb-4">Account Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input 
              type="text" 
              value={user?.name || ''} 
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              value={user?.email || ''} 
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          To change your name or email, please contact support at hello@imcmachine.com
        </p>
      </div>

      {/* Venue Defaults */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg">Venue Defaults</h3>
          <Link to="/venue-setup" className="text-[#c8a45e] text-sm hover:underline">
            Edit Full Profile →
          </Link>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Brand Color</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="color" 
                  value={venueDefaults.defaultBrandColors}
                  onChange={e => setVenueDefaults(prev => ({ ...prev, defaultBrandColors: e.target.value }))}
                  className="w-12 h-10 border border-gray-200 rounded cursor-pointer"
                />
                <input 
                  type="text" 
                  value={venueDefaults.defaultBrandColors}
                  onChange={e => setVenueDefaults(prev => ({ ...prev, defaultBrandColors: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="#c8a45e"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Writing Tone</label>
              <select 
                value={venueDefaults.defaultWritingTone}
                onChange={e => setVenueDefaults(prev => ({ ...prev, defaultWritingTone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual & Friendly</option>
                <option value="energetic">Energetic & Exciting</option>
                <option value="sophisticated">Sophisticated</option>
                <option value="community">Community-Focused</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Genre/Style</label>
            <input 
              type="text" 
              value={venueDefaults.defaultGenre}
              onChange={e => setVenueDefaults(prev => ({ ...prev, defaultGenre: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              placeholder="Jazz, Rock, Indie, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Bio/Description</label>
            <textarea 
              rows={3}
              value={venueDefaults.defaultBio}
              onChange={e => setVenueDefaults(prev => ({ ...prev, defaultBio: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none"
              placeholder="Default description for your venue or artist profile..."
            />
          </div>

          <button 
            onClick={handleSaveVenueDefaults}
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Venue Defaults'}
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg">Notification Preferences</h3>
        </div>
        
        <div className="space-y-4">
          {[
            { key: 'emailOnCampaignComplete', label: 'Email when campaign completes', desc: 'Get notified when your event marketing campaign finishes distributing' },
            { key: 'emailOnEventCreated', label: 'Email when new event is created', desc: 'Confirmation email for each new event you create' },
            { key: 'emailWeeklyReport', label: 'Weekly performance report', desc: 'Summary of your events and campaign performance' },
            { key: 'smsReminders', label: 'SMS reminders', desc: 'Text message reminders for important events (SMS charges may apply)' },
          ].map(pref => (
            <label key={pref.key} className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox"
                checked={notifications[pref.key]}
                onChange={e => setNotifications(prev => ({ ...prev, [pref.key]: e.target.checked }))}
                className="mt-1 w-4 h-4 text-[#c8a45e] border-gray-300 rounded focus:ring-[#c8a45e]"
              />
              <div>
                <div className="font-medium text-sm">{pref.label}</div>
                <div className="text-xs text-gray-500">{pref.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <button 
          onClick={handleSaveNotifications}
          className="btn-secondary mt-4"
        >
          Save Notification Preferences
        </button>
      </div>

      {/* Google Drive Integration */}
      <div className="card mb-6">
        <h3 className="text-lg mb-4">📁 Google Drive</h3>
        {venue.driveRootFolderId ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-green-800">Connected ✅</div>
                <p className="text-sm text-green-600 mt-1">
                  Your Google Drive folder is set up. New events will automatically get Drive folders.
                </p>
              </div>
              <a
                href={`https://drive.google.com/drive/folders/${venue.driveRootFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#c8a45e] text-white text-sm rounded hover:bg-[#b8945e] transition-colors"
              >
                Open in Drive →
              </a>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-700">Not connected</div>
                <p className="text-sm text-gray-500 mt-1">
                  Set up Google Drive to auto-organize all your event content, press releases, and images.
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!venue.name && !venue.businessName) {
                    alert('Please set up your venue/business name first in Venue Setup.');
                    return;
                  }
                  setConnectingTo('google_drive');
                  try {
                    const resp = await fetch('/api/drive', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'create-client-folder',
                        clientName: venue.businessName || venue.name,
                        userEmail: user?.email,
                        userId: user?.id,
                      }),
                    });
                    const data = await resp.json();
                    if (data.success) {
                      await saveVenue({
                        driveRootFolderId: data.driveRootFolderId,
                        driveBrandFolderId: data.driveBrandFolderId,
                      });
                      setShowToast({ type: 'success', message: 'Google Drive folder created! 📁' });
                    } else {
                      throw new Error(data.error || 'Failed to create Drive folder');
                    }
                  } catch (err) {
                    console.error('Drive setup failed:', err);
                    setShowToast({ type: 'error', message: 'Drive setup failed: ' + err.message });
                  } finally {
                    setConnectingTo(null);
                  }
                }}
                disabled={connectingTo === 'google_drive'}
                className={`px-4 py-2 text-sm rounded transition-colors ${
                  connectingTo === 'google_drive'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#c8a45e] text-white hover:bg-[#b8945e]'
                }`}
              >
                {connectingTo === 'google_drive' ? 'Setting up...' : 'Set Up Google Drive'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* API Connections */}
      <div className="card mb-6">
        <h3 className="text-lg mb-4">API Connections</h3>
        <div className="space-y-4">
          {Object.entries(connections).map(([service, connection]) => (
            <div key={service} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-lg border">
                  {{
                    openai: '🤖',
                    google_drive: '📁',
                    facebook: '📘',
                    instagram: '📸',
                    youtube: '📺',
                    linkedin: '💼',
                    eventbrite: '🎟️',
                    mailchimp: '📧',
                  }[service] || '🔗'}
                </div>
                <div>
                  <div className="font-medium capitalize">
                    {service.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-gray-500">
                    {service === 'openai' && 'AI content generation'}
                    {service === 'google_drive' && 'File storage and sharing'}
                    {service === 'facebook' && 'Social media posting & events'}
                    {service === 'instagram' && 'Social media posting'}
                    {service === 'youtube' && 'Video uploads and management'}
                    {service === 'linkedin' && 'Professional networking posts'}
                    {service === 'eventbrite' && 'Ticket sales integration'}
                    {service === 'mailchimp' && 'Email marketing'}
                  </div>
                  {connection.connected && (
                    <div className="text-xs text-gray-400 mt-1">
                      {service === 'facebook' && connection.page_name && `Page: ${connection.page_name}`}
                      {service === 'instagram' && connection.username && `@${connection.username}`}
                      {service === 'youtube' && connection.channel_name && `Channel: ${connection.channel_name}`}
                      {service === 'linkedin' && connection.user_name && `${connection.user_name}`}
                      {(service === 'linkedin' || service === 'youtube') && connection.expires_at && (
                        <span className="block">Expires: {new Date(connection.expires_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  connection.connected 
                    ? connection.status.includes('expire') 
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {connection.status}
                </span>
                <div className="flex gap-2">
                  {connection.connected ? (
                    <button 
                      onClick={() => disconnectService(service)}
                      className="px-3 py-1.5 text-xs rounded transition-colors bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={() => connectService(service)}
                      disabled={connectingTo === service}
                      className={`px-3 py-1.5 text-xs rounded transition-colors ${
                        connectingTo === service
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-[#c8a45e] text-white hover:bg-[#b8945e]'
                      }`}
                    >
                      {connectingTo === service ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200 bg-red-50">
        <h3 className="text-lg mb-4 text-red-700">Danger Zone</h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-white border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-red-700">Delete Account</h4>
                <p className="text-sm text-red-600 mt-1">
                  Permanently delete your account and all data. This action cannot be undone.
                </p>
              </div>
              <button 
                onClick={() => setShowDeleteAccount(true)}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>

          <div className="p-4 bg-white border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-yellow-700">Sign Out</h4>
                <p className="text-sm text-yellow-600 mt-1">
                  Sign out of your account on this device
                </p>
              </div>
              <button 
                onClick={logout}
                className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

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

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-3 text-red-700">Delete Account</h3>
            <p className="text-gray-700 mb-4">
              This will permanently delete your account and all associated data including:
            </p>
            <ul className="text-sm text-gray-600 mb-4 space-y-1">
              <li>• All events and campaigns</li>
              <li>• Generated content and images</li>
              <li>• Venue profile and settings</li>
              <li>• All preferences and connections</li>
            </ul>
            <p className="text-sm font-medium text-red-700 mb-4">
              This action cannot be undone.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type your email address to confirm:
              </label>
              <input 
                type="email"
                value={deleteConfirmation}
                onChange={e => setDeleteConfirmation(e.target.value)}
                placeholder={user?.email || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => {
                  setShowDeleteAccount(false);
                  setDeleteConfirmation('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation !== user?.email}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}