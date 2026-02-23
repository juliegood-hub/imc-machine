import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  getAllUsers, 
  getAllEvents, 
  getAllInvites, 
  getAllCampaigns,
  getActivityLog,
  createInvite,
  deleteInvite,
  deleteUser,
  toggleUserDisabled,
  updateUser,
  createUser,
  getProfileByUserId,
  updateProfile,
  createProfile
} from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { CLIENT_TYPES, getClientTypeColors } from '../constants/clientTypes';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'juliegood@goodcreativemedia.com';

function generateInviteCode(name) {
  const now = new Date();
  const mmdd = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const cleanName = (name || 'GUEST').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 10);
  return `IMC-${cleanName}-${mmdd}`;
}

function getSmsTemplate(name, code) {
  return `Hey ${name}! It's Julie. I built something I think you're going to love. The IMC Machine takes all that event marketing work (press releases, social posts, calendar listings) and handles it from one place. I want you to be one of the first people on it. Sign up at imc.goodcreativemedia.com with code ${code}. Tell me what you think! 🎶`;
}

function getEmailTemplate(name, code) {
  const signupUrl = `https://imc.goodcreativemedia.com/signup?code=${code}`;
  return `Subject: I made something for you — Julie Good

Hey ${name},

I've been building something and you're one of the first people I want to share it with.

It's called The IMC Machine. You know all that marketing work that eats up your week? Press releases, social posts for Facebook and Instagram and LinkedIn, calendar submissions, email campaigns, event images? This handles it. From one dashboard. In minutes instead of hours.

I built it specifically for people like you in the San Antonio scene. I know how hard you work, and I know marketing shouldn't be the thing that slows you down.

Here's how to get started:
1. Go to ${signupUrl}
2. Use your invite code: ${code}
3. Set up your profile and create your first event

I'm only opening this up to a small group of people I trust and respect right now. Your honest feedback will shape where this goes next, and that matters to me.

Looking forward to hearing what you think.

Julie Good
Good Creative Media
San Antonio, TX`;
}

// Activity log is now handled by Supabase - see lib/supabase.js

// ═══════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview', label: '📊 Overview', icon: '📊' },
  { id: 'users', label: '👥 Users', icon: '👥' },
  { id: 'campaigns', label: '📣 Campaigns', icon: '📣' },
  { id: 'activity', label: '📋 Activity Log', icon: '📋' },
  { id: 'invites', label: '🎟️ Invites', icon: '🎟️' },
  { id: 'distribution', label: '📡 Distribution', icon: '📡' },
  { id: 'broadcast', label: '📧 Broadcast', icon: '📧' },
  { id: 'calendar', label: '📅 Event Calendar', icon: '📅' },
];

// ═══════════════════════════════════════════════════════════════
// MAIN ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [activities, setActivities] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [events, setEvents] = useState([]);

  // Filters
  const [userFilter, setUserFilter] = useState('all'); // all, expanded client types
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, disabled
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all'); // all, today, 7d, 30d
  const [activityUserFilter, setActivityUserFilter] = useState('all');
  const [activityActionFilter, setActivityActionFilter] = useState('all');

  const isAdmin = user?.isAdmin || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    reload();
  }, [isAdmin, navigate]);

  const reload = async () => {
    try {
      const [usersData, invitesData, activitiesData, campaignsData, eventsData] = await Promise.all([
        getAllUsers(),
        getAllInvites(),
        getActivityLog({ limit: 1000 }),
        getAllCampaigns(),
        getAllEvents()
      ]);
      
      setUsers(usersData || []);
      setInvites(invitesData || []);
      setActivities(activitiesData || []);
      setCampaigns(campaignsData || []);
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  // ─── Computed Stats ───
  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now - 7 * 86400000).toISOString();
    const monthAgo = new Date(now - 30 * 86400000).toISOString();

    const uniqueEvents = new Set(campaigns.map(c => c.event_id));
    const totalEvents = uniqueEvents.size;
    const totalChannelsSent = campaigns.filter(c => 
      ['sent', 'published', 'created'].includes(c.status)
    ).length;

    const activeUsers = users.filter(u => !u.disabled).length;
    const newUsersThisWeek = users.filter(u => u.created_at >= weekAgo).length;
    const loginsToday = users.filter(u => u.last_login && u.last_login.startsWith(today)).length;

    const recentActivities = activities.filter(a => a.created_at >= weekAgo).length;

    const byClientType = {
      venue: users.filter(u => u.client_type === 'venue').length,
      artist: users.filter(u => u.client_type === 'artist').length,
      performer: users.filter(u => u.client_type === 'performer').length,
      producer: users.filter(u => u.client_type === 'producer').length,
    };

    const invitesPending = invites.filter(i => !i.used).length;
    const invitesUsed = invites.filter(i => i.used).length;

    return {
      totalUsers: users.length,
      activeUsers,
      newUsersThisWeek,
      loginsToday,
      totalEvents,
      totalChannelsSent,
      recentActivities,
      byClientType,
      invitesPending,
      invitesUsed,
    };
  }, [users, campaigns, activities, invites]);

  // ─── Filtered Users ───
  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (userFilter !== 'all') {
      result = result.filter(u => u.client_type === userFilter);
    }
    if (statusFilter === 'active') {
      result = result.filter(u => !u.disabled);
    } else if (statusFilter === 'disabled') {
      result = result.filter(u => u.disabled);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.venue_name?.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => (b.last_login || b.created_at || '').localeCompare(a.last_login || a.created_at || ''));
  }, [users, userFilter, statusFilter, searchQuery]);

  // ─── Filtered Activities ───
  const filteredActivities = useMemo(() => {
    let result = [...activities]; // already sorted by created_at desc from query

    if (dateRange === 'today') {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(a => a.created_at?.startsWith(today));
    } else if (dateRange === '7d') {
      const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
      result = result.filter(a => a.timestamp >= cutoff);
    } else if (dateRange === '30d') {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      result = result.filter(a => a.timestamp >= cutoff);
    }

    if (activityUserFilter !== 'all') {
      result = result.filter(a => a.userId === activityUserFilter);
    }
    if (activityActionFilter !== 'all') {
      result = result.filter(a => a.action === activityActionFilter);
    }

    return result;
  }, [activities, dateRange, activityUserFilter, activityActionFilter]);

  // ─── Unique action types for filter ───
  const actionTypes = useMemo(() => {
    const set = new Set(activities.map(a => a.action));
    return [...set].sort();
  }, [activities]);

  // ─── Campaign list ───
  const campaignList = useMemo(() => {
    return Object.entries(campaigns)
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [campaigns]);

  // ─── Handlers ───
  const toggleUserStatus = (userId) => {
    const updated = users.map(u => u.id === userId ? { ...u, disabled: !u.disabled } : u);
    setUsers(updated);
    localStorage.setItem('imc_all_users', JSON.stringify(updated));
  };

  const removeUser = (userId) => {
    if (!confirm('Remove this user? This cannot be undone.')) return;
    const updated = users.filter(u => u.id !== userId);
    setUsers(updated);
    localStorage.setItem('imc_all_users', JSON.stringify(updated));
  };

  const [newInviteName, setNewInviteName] = useState('');
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteType, setNewInviteType] = useState('venue_owner');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [expandedInvite, setExpandedInvite] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  // User editing handlers
  const handleEditUser = async (user) => {
    setEditingUser({ ...user });
    try {
      const profile = await getProfileByUserId(user.id);
      setEditingProfile(profile || {});
    } catch (error) {
      console.error('Error loading profile:', error);
      setEditingProfile({});
    }
    setShowEditUser(true);
  };

  const handleSaveUser = async () => {
    try {
      // Update users table
      // Save user - only original schema columns to avoid cache issues
      const userUpdate = {
        name: editingUser.name,
        client_type: editingUser.client_type,
        venue_name: editingUser.venue_name,
        is_admin: editingUser.is_admin,
        disabled: editingUser.disabled
      };
      const updatedUser = await updateUser(editingUser.id, userUpdate);

      // Update or create profiles table - only send columns known to exist
      const SAFE_PROFILE_COLS = [
        'user_id','profile_type','name','description','address','city','state',
        'postal_code','phone','email','website','genre','capacity',
        'facebook_url','facebook_page_id','instagram_url','linkedin_url',
        'spotify_url','youtube_url','brand_colors','brand_voice','logo_url',
        'headshot_url','hometown','band_members','streaming_links',
        'booking_contact','manager_contact','drive_folder_id','drive_folder_url',
        'notification_preferences','cell_phone','work_phone','first_name',
        'last_name','title','dba_name','bio','venue_name','preferred_contact',
        'business_phone','business_email','brand_primary','brand_secondary','tax_id',
        'zip_code','country','street_number','street_name','suite_number',
        'parking_type','ada_accessible','age_restriction','liquor_license',
        'has_stage','has_sound','has_lighting',
        'twitter_url','tiktok_url','yelp_url','google_business_url',
        'online_menu_url','square_store_url','shopify_store_url','amazon_store_url',
        'etsy_store_url','merch_store_url','other_store_url',
        'logo','headshot','facebook','instagram','twitter','tiktok',
        'youtube','spotify','linkedin','bandcamp','soundcloud','apple_music',
        'amazon_music','press_kit','label','members','subgenres',
        'years_active','record_label','performing_rights_org','union_member',
        'manager_name','manager_email','manager_phone',
        'booking_name','booking_email','booking_phone',
        'has_own_sound','has_own_lighting','typical_set_length',
        'rider_requirements','tech_rider_url','business_type','year_established'
      ];
      const safeProfile = {};
      for (const k of SAFE_PROFILE_COLS) {
        if (editingProfile && editingProfile[k] !== undefined) safeProfile[k] = editingProfile[k];
      }
      safeProfile.user_id = editingUser.id;
      safeProfile.name = safeProfile.name || safeProfile.venue_name || editingUser.venue_name || editingUser.name || '';
      
      if (Object.keys(safeProfile).length > 1) {
        try {
          await updateProfile(editingUser.id, safeProfile);
        } catch (profileErr) {
          // If profile doesn't exist yet, create it
          if (profileErr.code === 'PGRST116') {
            await createProfile(safeProfile);
          } else {
            throw profileErr;
          }
        }
      }

      // Update local state
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      setShowEditUser(false);
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user: ' + error.message);
    }
  };

  // Create user handlers
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    client_type: 'venue_owner',
    venue_name: '',
    cell_phone: ''
  });

  const handleCreateUser = async () => {
    try {
      const { data: createdUser, error } = await supabase
        .from('users')
        .insert({
          email: newUser.email.toLowerCase().trim(),
          name: `${newUser.first_name} ${newUser.last_name}`.trim(),
          client_type: newUser.client_type || 'venue_owner',
          venue_name: newUser.venue_name || '',
          is_admin: false,
          disabled: false,
          last_login: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      setUsers(prev => [createdUser, ...prev]);
      setNewUser({
        first_name: '',
        last_name: '',
        email: '',
        client_type: 'venue_owner',
        venue_name: '',
        cell_phone: ''
      });
      setShowCreateUser(false);
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user: ' + error.message);
    }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!newInviteName) return;
    setInviteLoading(true);
    try {
      const resp = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-invite', name: newInviteName, email: newInviteEmail || null, role: newInviteType }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
      setInvites(prev => [data.invite, ...prev]);
      setNewInviteName('');
      setNewInviteEmail('');
    } catch (err) {
      alert('Error creating invite: ' + err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const handleRevokeInvite = async (inviteId) => {
    if (!confirm('Revoke this invite?')) return;
    try {
      const resp = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke-invite', id: inviteId }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err) {
      alert('Error revoking invite: ' + err.message);
    }
  };

  const handleSendInviteEmail = async (invite) => {
    if (!invite.email) { alert('No email address for this invite'); return; }
    try {
      const emailBody = getEmailTemplate(invite.venue_name || 'Friend', invite.code);
      const resp = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-email',
          to: invite.email,
          subject: "You're invited to The IMC Machine — Julie Good",
          body: emailBody,
        }),
      });
      const data = await resp.json();
      if (data.success) alert('Email sent!');
      else alert('Email send failed: ' + (data.error || 'Unknown error'));
    } catch (err) {
      alert('Error sending email: ' + err.message);
    }
  };

  const exportAllCSV = () => {
    const rows = [['Name', 'Email', 'Type', 'Venue/Artist', 'Status', 'Created', 'Last Login', 'Events', 'Channels Sent']];
    for (const u of users) {
      const userCampaigns = Object.values(campaigns).filter(c => c.userId === u.id);
      const channelsSent = userCampaigns.reduce((sum, c) =>
        sum + Object.values(c.channels || {}).filter(ch => ch.status === 'sent' || ch.status === 'published').length, 0
      );
      rows.push([
        u.name, u.email, u.clientType || 'venue', u.venueName || '',
        u.disabled ? 'Disabled' : 'Active',
        u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
        u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '',
        userCampaigns.length, channelsSent,
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `imc-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (!isAdmin) return null;

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const timeAgo = (iso) => {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return formatDate(iso);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>🔐 Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">The IMC Machine · System Administration</p>
        </div>
        <div className="flex gap-2 mt-3 md:mt-0">
          <button onClick={reload} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">🔄 Refresh</button>
          <button onClick={exportAllCSV} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">📥 Export CSV</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-[#0d1b2a] text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
            style={{ border: 'none', cursor: 'pointer' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
        <div>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Users" value={stats.totalUsers} sub={`${stats.activeUsers} active`} color="#0d1b2a" />
            <StatCard label="New This Week" value={stats.newUsersThisWeek} sub={`${stats.loginsToday} logged in today`} color="#c8a45e" />
            <StatCard label="Total Events" value={stats.totalEvents} sub={`${stats.totalChannelsSent} channels sent`} color="#2d6a4f" />
            <StatCard label="Activity (7d)" value={stats.recentActivities} sub={`${stats.invitesPending} invites pending`} color="#7b2cbf" />
          </div>

          {/* Client Type Breakdown */}
          <div className="card mb-6">
            <h3 className="text-lg mb-4">Users by Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(stats.byClientType).map(([type, count]) => {
                const c = getClientTypeColors(type);
                return (
                  <div key={type} className={`${c.bg} rounded-lg p-4 text-center`}>
                    <div className="text-2xl mb-1">{c.icon}</div>
                    <div className={`text-2xl font-bold ${c.text}`}>{count}</div>
                    <div className="text-xs text-gray-600 capitalize">{type}s</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Preview */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg">Recent Activity</h3>
              <button onClick={() => setActiveTab('activity')} className="text-xs text-[#c8a45e] hover:underline bg-transparent border-none cursor-pointer">View All →</button>
            </div>
            {activities.length === 0 ? (
              <p className="text-gray-400 text-center py-6">No activity recorded yet. Activity tracking starts when users create events, generate content, or distribute campaigns.</p>
            ) : (
              <div className="space-y-2">
                {[...activities].reverse().slice(0, 8).map(a => (
                  <ActivityRow key={a.id} activity={a} users={users} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ USERS TAB ═══ */}
      {activeTab === 'users' && (
        <div>
          {/* Filters */}
          <div className="card mb-4">
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text" placeholder="Search by name, email, or venue..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]"
              />
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]">
                <option value="all">All Types</option>
                {CLIENT_TYPES.map(ct => (
                  <option key={ct.key} value={ct.key}>
                    {ct.icon} {ct.label}
                  </option>
                ))}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]">
                <option value="all">All Status</option>
                <option value="active">✅ Active</option>
                <option value="disabled">🚫 Disabled</option>
              </select>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-gray-400">{filteredUsers.length} of {users.length} users</div>
              <button 
                onClick={() => setShowCreateUser(true)}
                className="text-xs px-3 py-1.5 bg-[#c8a45e] text-white rounded-lg hover:bg-[#b8944e] flex items-center gap-1"
              >
                ➕ Create New User
              </button>
            </div>
          </div>

          {/* User Cards or Table */}
          {selectedUser ? (
            <UserDetail
              user={selectedUser}
              campaigns={campaigns}
              activities={activities}
              onBack={() => setSelectedUser(null)}
              onEdit={() => handleEditUser(selectedUser)}
              onToggle={() => { toggleUserStatus(selectedUser.id); setSelectedUser({ ...selectedUser, disabled: !selectedUser.disabled }); }}
              onRemove={() => { removeUser(selectedUser.id); setSelectedUser(null); }}
            />
          ) : (
            <div className="space-y-2">
              {filteredUsers.length === 0 ? (
                <div className="card text-center py-12">
                  <p className="text-gray-400 text-lg mb-2">No users match your filters</p>
                  <p className="text-gray-300 text-sm">Try adjusting the search or filter criteria</p>
                </div>
              ) : filteredUsers.map(u => {
                const ct = getClientTypeColors(u.client_type || u.clientType);
                const userCampaigns = Object.values(campaigns).filter(c => c.userId === u.id);
                return (
                  <div key={u.id} className="card flex flex-col md:flex-row md:items-center gap-3 cursor-pointer hover:border-[#c8a45e] transition-colors"
                    onClick={() => setSelectedUser(u)} style={{ borderLeft: `4px solid ${u.disabled ? '#ef4444' : '#22c55e'}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{u.name || 'Unnamed'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${ct.bg} ${ct.text}`}>{ct.icon} {u.client_type || 'venue'}</span>
                        {u.isAdmin && <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">👑 Admin</span>}
                      </div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                      {u.venue_name && <div className="text-xs text-gray-400 mt-0.5">{ct.icon} {u.venue_name}</div>}
                    </div>
                    <div className="flex gap-6 text-xs text-gray-400">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-700">{userCampaigns.length}</div>
                        <div>events</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm">{formatDate(u.createdAt)}</div>
                        <div>joined</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm">{timeAgo(u.lastLogin)}</div>
                        <div>last login</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleEditUser(u); }}
                        className="text-xs px-3 py-1.5 rounded border border-[#c8a45e] text-[#c8a45e] hover:bg-[#faf8f3] cursor-pointer">
                        Edit
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleUserStatus(u.id); }}
                        className={`text-xs px-3 py-1.5 rounded border-none cursor-pointer ${u.disabled ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                        {u.disabled ? 'Enable' : 'Disable'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ CAMPAIGNS TAB ═══ */}
      {activeTab === 'campaigns' && (
        <div>
          {campaignList.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-lg mb-2">No campaigns yet</p>
              <p className="text-gray-300 text-sm">Campaigns appear here when users create events and run the IMC Composer</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaignList.map(c => {
                const s = c.summary;
                const pct = s?.completionPct || 0;
                return (
                  <div key={c.id} className="card">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-lg">{c.eventTitle || 'Untitled Event'}</div>
                        <div className="text-sm text-gray-500">{c.venueName} · {formatDate(c.eventDate)}</div>
                      </div>
                      <div className="flex gap-4 text-center text-xs">
                        <div><span className="text-lg font-bold text-green-600">{s?.completed || 0}</span><br />sent</div>
                        <div><span className="text-lg font-bold text-yellow-600">{s?.pending || 0}</span><br />pending</div>
                        <div><span className="text-lg font-bold text-red-500">{s?.failed || 0}</span><br />failed</div>
                        <div><span className="text-lg font-bold text-gray-400">{s?.notStarted || 0}</span><br />not started</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#22c55e' : '#c8a45e' }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-400">{pct}% complete</span>
                      <button onClick={() => {
                        const csv = exportCampaignCSV(c.id);
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `campaign-${c.id}.csv`; a.click();
                      }} className="text-xs text-[#c8a45e] hover:underline bg-transparent border-none cursor-pointer">Export CSV</button>
                    </div>
                    {/* Channel pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {Object.entries(s?.channels || {}).map(([key, ch]) => (
                        <ChannelPill key={key} channel={key} data={ch} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ ACTIVITY LOG TAB ═══ */}
      {activeTab === 'activity' && (
        <div>
          {/* Filters */}
          <div className="card mb-4">
            <div className="flex flex-col md:flex-row gap-3">
              <select value={dateRange} onChange={e => setDateRange(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <select value={activityUserFilter} onChange={e => setActivityUserFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]">
                <option value="all">All Users</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
              <select value={activityActionFilter} onChange={e => setActivityActionFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]">
                <option value="all">All Actions</option>
                {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <div className="text-xs text-gray-400 self-center">{filteredActivities.length} entries</div>
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-lg mb-2">No activity recorded</p>
              <p className="text-gray-300 text-sm">Activity is logged when users create events, generate content, distribute campaigns, and more</p>
            </div>
          ) : (
            <div className="card">
              <div className="space-y-1">
                {filteredActivities.slice(0, 100).map(a => (
                  <ActivityRow key={a.id} activity={a} users={users} detailed />
                ))}
                {filteredActivities.length > 100 && (
                  <p className="text-xs text-gray-400 text-center pt-2">Showing first 100 of {filteredActivities.length} entries</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ INVITES TAB ═══ */}
      {activeTab === 'invites' && (
        <div>
          {/* Copy feedback toast */}
          {copyFeedback && (
            <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm animate-pulse">
              ✅ {copyFeedback} copied!
            </div>
          )}

          {/* Generate Invite */}
          <div className="card mb-6">
            <h3 className="text-lg mb-4">🎟️ Generate Invite</h3>
            <form onSubmit={handleCreateInvite} className="flex flex-col md:flex-row gap-3">
              <input type="text" value={newInviteName} onChange={e => setNewInviteName(e.target.value)}
                placeholder="Name (e.g. Jerry, Dakota)" required
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
              <input type="email" value={newInviteEmail} onChange={e => setNewInviteEmail(e.target.value)}
                placeholder="Email (optional)"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
              <select value={newInviteType} onChange={e => setNewInviteType(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]">
                <option value="venue_owner">🏛️ Venue Owner</option>
                <option value="artist">🎸 Artist</option>
                <option value="promoter">📣 Promoter</option>
                <option value="media">📰 Media</option>
                {CLIENT_TYPES.filter(ct => !['venue_owner','artist','promoter','media'].includes(ct.key)).map(ct => (
                  <option key={ct.key} value={ct.key}>{ct.icon} {ct.label}</option>
                ))}
              </select>
              <button type="submit" disabled={inviteLoading} className="btn-primary whitespace-nowrap disabled:opacity-50">
                {inviteLoading ? 'Generating...' : 'Generate Invite'}
              </button>
            </form>
            {newInviteName && (
              <p className="text-xs text-gray-400 mt-2">
                Preview code: <span className="font-mono text-[#c8a45e]">{generateInviteCode(newInviteName)}</span>
              </p>
            )}
          </div>

          {/* Invite List */}
          <div className="card">
            <h3 className="text-lg mb-4">Invites ({invites.length})</h3>
            {invites.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No invites yet. Generate one above.</p>
            ) : (
              <div className="space-y-3">
                {invites.map(inv => {
                  const ct = getClientTypeColors(inv.client_type || 'venue_owner');
                  const isExpanded = expandedInvite === inv.id;
                  const invName = inv.venue_name || 'Friend';
                  return (
                    <div key={inv.id} className="border border-gray-100 rounded-lg overflow-hidden">
                      {/* Row */}
                      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedInvite(isExpanded ? null : inv.id)}>
                        <span className="font-mono text-sm text-[#c8a45e] font-bold min-w-[160px]">{inv.code}</span>
                        <span className="text-sm flex-1">{invName}</span>
                        <span className="text-sm text-gray-400">{inv.email || '—'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${ct.bg} ${ct.text}`}>{ct.icon} {inv.client_type || 'venue_owner'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${inv.used ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {inv.used ? '✅ Used' : '⏳ Pending'}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(inv.created_at)}</span>
                        <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {/* Expanded: Templates */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 p-4 bg-[#faf8f3] space-y-4">
                          {/* SMS */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-600">📱 SMS Template</span>
                              <button onClick={() => copyToClipboard(getSmsTemplate(invName, inv.code), 'SMS')}
                                className="text-xs text-[#c8a45e] hover:underline bg-transparent border-none cursor-pointer">📋 Copy SMS</button>
                            </div>
                            <div className="bg-white border border-gray-200 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">{getSmsTemplate(invName, inv.code)}</div>
                          </div>

                          {/* Email */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-600">📧 Email Template</span>
                              <button onClick={() => copyToClipboard(getEmailTemplate(invName, inv.code), 'Email')}
                                className="text-xs text-[#c8a45e] hover:underline bg-transparent border-none cursor-pointer">📋 Copy Email</button>
                            </div>
                            <div className="bg-white border border-gray-200 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">{getEmailTemplate(invName, inv.code)}</div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-3 pt-2">
                            <button onClick={() => copyToClipboard(`https://imc.goodcreativemedia.com/signup?code=${inv.code}`, 'Signup link')}
                              className="text-xs bg-[#c8a45e] text-white px-3 py-1.5 rounded cursor-pointer border-none hover:opacity-90">🔗 Copy Signup Link</button>
                            {inv.email && (
                              <button onClick={() => handleSendInviteEmail(inv)}
                                className="text-xs bg-[#0d1b2a] text-white px-3 py-1.5 rounded cursor-pointer border-none hover:opacity-90">📧 Send Email</button>
                            )}
                            {!inv.used && (
                              <button onClick={() => handleRevokeInvite(inv.id)}
                                className="text-xs bg-red-500 text-white px-3 py-1.5 rounded cursor-pointer border-none hover:opacity-90">🗑️ Revoke</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ DISTRIBUTION TAB ═══ */}
      {activeTab === 'distribution' && (
        <div>
          <div className="card mb-6">
            <h3 className="text-lg mb-4">Distribution Channel Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <ChannelStatusCard name="Facebook Events" icon="📘" status="ready" detail="Page: Good Creative Media (522058047815423)" />
              <ChannelStatusCard name="Facebook Feed" icon="📱" status="ready" detail="Same token as Events" />
              <ChannelStatusCard name="Instagram" icon="📸" status="setup" detail="IG scopes needed on token" />
              <ChannelStatusCard name="LinkedIn" icon="💼" status="setup" detail="App creation needed at linkedin.com/developers" />
              <ChannelStatusCard name="Eventbrite" icon="🎟️" status="ready" detail="Org: The Dakota (276674179461)" />
              <ChannelStatusCard name="Email (Resend)" icon="📧" status="ready" detail="Sender: events@goodcreativemedia.com" />
              <ChannelStatusCard name="Do210" icon="📅" status="ready" detail="Puppeteer automation ready" />
              <ChannelStatusCard name="SA Current" icon="📰" status="blocked" detail="Cloudflare blocks automation" />
              <ChannelStatusCard name="Evvnt" icon="🌐" status="setup" detail="API key needed from dashboard" />
              <ChannelStatusCard name="YouTube Podcasts" icon="🎙️" status="ready" detail="OAuth configured, uploads private" />
              <ChannelStatusCard name="Google Drive" icon="📁" status="ready" detail="3 venue folders created" />
              <ChannelStatusCard name="Bilingual (Spanish)" icon="🇲🇽" status="ready" detail="La Prensa Texas distribution" />
            </div>
          </div>
        </div>
      )}

      {/* ═══ BROADCAST TAB ═══ */}
      {activeTab === 'broadcast' && (
        <BroadcastTab users={users} />
      )}

      {/* ═══ EVENT CALENDAR TAB ═══ */}
      {activeTab === 'calendar' && (
        <EventCalendarTab events={events} users={users} campaigns={campaigns} />
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="bg-white rounded-xl max-w-md w-full overflow-y-auto my-4" style={{ maxHeight: '85vh' }}>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Create New User</h3>
              <p className="text-xs text-gray-400 mb-4">* Required fields</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      placeholder="First Name" 
                      value={newUser.first_name}
                      onChange={e => setNewUser({ ...newUser, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      placeholder="Last Name" 
                      value={newUser.last_name}
                      onChange={e => setNewUser({ ...newUser, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input 
                    type="email" 
                    placeholder="Email" 
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Type <span className="text-red-500">*</span></label>
                  <select 
                    value={newUser.client_type}
                    onChange={e => setNewUser({ ...newUser, client_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {CLIENT_TYPES.map(ct => (
                      <option key={ct.key} value={ct.key}>
                        {ct.icon} {ct.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue/Organization Name</label>
                  <input 
                    type="text" 
                    placeholder="Venue/Organization Name" 
                    value={newUser.venue_name}
                    onChange={e => setNewUser({ ...newUser, venue_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cell Phone</label>
                  <input 
                    type="tel" 
                    placeholder="(210) 555-1234" 
                    value={newUser.cell_phone}
                    onChange={e => setNewUser({ ...newUser, cell_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">Format: (210) 555-1234</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreateUser(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm">
                  Cancel
                </button>
                <button onClick={handleCreateUser} className="flex-1 px-4 py-2 bg-[#c8a45e] text-white rounded-lg text-sm hover:bg-[#b8944e]">
                  Create User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUser && editingUser && (
        <UserEditModal 
          user={editingUser}
          profile={editingProfile}
          events={events.filter(e => e.user_id === editingUser.id)}
          onSave={handleSaveUser}
          onClose={() => setShowEditUser(false)}
          onUpdateUser={setEditingUser}
          onUpdateProfile={setEditingProfile}
        />
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-300 mt-8 pt-4 border-t border-gray-100">
        The IMC Machine™ · © 2026 Julie Good. All Rights Reserved.<br />
        Created by Julie Good · Good Creative Media · San Antonio, TX
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// EVENT CALENDAR TAB — All events across all venues/users
// ═══════════════════════════════════════════════════════════════

function EventCalendarTab({ events, users, campaigns }) {
  const [viewMode, setViewMode] = useState('month'); // month, week, list
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  // Parse events into a date map
  const eventsByDate = useMemo(() => {
    const map = {};
    (events || []).forEach(e => {
      if (!e.date) return;
      const dateKey = e.date.split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      const owner = e.users || users?.find(u => u.id === e.user_id);
      map[dateKey].push({ ...e, ownerName: owner?.name || owner?.email || 'Unknown', ownerType: owner?.client_type || 'venue' });
    });
    return map;
  }, [events, users]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisWeekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const allDates = Object.keys(eventsByDate);
    const upcoming = allDates.filter(d => d >= today);
    const thisWeek = upcoming.filter(d => d <= thisWeekEnd);
    const thisMonth = upcoming.filter(d => d <= thisMonthEnd);

    const totalUpcoming = upcoming.reduce((sum, d) => sum + eventsByDate[d].length, 0);
    const totalThisWeek = thisWeek.reduce((sum, d) => sum + eventsByDate[d].length, 0);
    const totalThisMonth = thisMonth.reduce((sum, d) => sum + eventsByDate[d].length, 0);

    // Unique venues
    const venues = new Set();
    Object.values(eventsByDate).flat().forEach(e => { if (e.venue_name || e.ownerName) venues.add(e.venue_name || e.ownerName); });

    // Campaigns distributed
    const distributed = (campaigns || []).filter(c => c.status === 'sent' || c.status === 'published' || c.status === 'created').length;

    return { totalUpcoming, totalThisWeek, totalThisMonth, uniqueVenues: venues.size, distributed };
  }, [eventsByDate, campaigns]);

  // Calendar grid helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const today = new Date().toISOString().split('T')[0];

  // Week view
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [weekStart]);

  const prevWeek = () => setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
  const nextWeek = () => setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));

  // Genre color
  const genreColor = (genre) => {
    if (!genre) return '#6b7280';
    const g = genre.toLowerCase();
    if (g.includes('music') || g.includes('jazz') || g.includes('indie')) return '#2d6a4f';
    if (g.includes('comedy') || g.includes('speaking')) return '#c8a45e';
    if (g.includes('theater') || g.includes('play') || g.includes('musical')) return '#7b2cbf';
    if (g.includes('dance') || g.includes('performance') || g.includes('experimental')) return '#e63946';
    if (g.includes('orchestra') || g.includes('classical') || g.includes('choral')) return '#457b9d';
    return '#6b7280';
  };

  // List view: upcoming events sorted
  const upcomingList = useMemo(() => {
    return Object.entries(eventsByDate)
      .filter(([date]) => date >= today)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 50);
  }, [eventsByDate, today]);

  return (
    <div>
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="card text-center" style={{ borderTop: '3px solid #2d6a4f' }}>
          <div className="text-2xl font-bold" style={{ color: '#2d6a4f' }}>{stats.totalUpcoming}</div>
          <div className="text-xs text-gray-600">Upcoming Events</div>
        </div>
        <div className="card text-center" style={{ borderTop: '3px solid #c8a45e' }}>
          <div className="text-2xl font-bold" style={{ color: '#c8a45e' }}>{stats.totalThisWeek}</div>
          <div className="text-xs text-gray-600">This Week</div>
        </div>
        <div className="card text-center" style={{ borderTop: '3px solid #7b2cbf' }}>
          <div className="text-2xl font-bold" style={{ color: '#7b2cbf' }}>{stats.totalThisMonth}</div>
          <div className="text-xs text-gray-600">This Month</div>
        </div>
        <div className="card text-center" style={{ borderTop: '3px solid #0d1b2a' }}>
          <div className="text-2xl font-bold" style={{ color: '#0d1b2a' }}>{stats.uniqueVenues}</div>
          <div className="text-xs text-gray-600">Active Venues</div>
        </div>
        <div className="card text-center" style={{ borderTop: '3px solid #e63946' }}>
          <div className="text-2xl font-bold" style={{ color: '#e63946' }}>{stats.distributed}</div>
          <div className="text-xs text-gray-600">Campaigns Sent</div>
        </div>
      </div>

      {/* View Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          {['month', 'week', 'list'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-none cursor-pointer ${viewMode === mode ? 'bg-[#0d1b2a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {mode === 'month' ? '📅 Month' : mode === 'week' ? '📆 Week' : '📋 List'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={viewMode === 'week' ? prevWeek : prevMonth} className="bg-transparent border-none cursor-pointer text-gray-500 hover:text-[#0d1b2a] text-lg">←</button>
          <span className="font-medium text-sm min-w-[160px] text-center">{monthName}</span>
          <button onClick={viewMode === 'week' ? nextWeek : nextMonth} className="bg-transparent border-none cursor-pointer text-gray-500 hover:text-[#0d1b2a] text-lg">→</button>
          <button onClick={goToday} className="px-3 py-1 rounded-lg text-xs bg-[#c8a45e] text-[#0d1b2a] border-none cursor-pointer font-medium">Today</button>
        </div>
      </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="card p-0 overflow-hidden">
          <div className="grid grid-cols-7 bg-[#0d1b2a] text-white text-xs text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2 font-medium">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[90px] border border-gray-100 bg-gray-50" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDate[dateKey] || [];
              const isToday = dateKey === today;
              const isSelected = selectedDay === dateKey;

              return (
                <div key={day}
                  onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                  className={`min-h-[90px] border border-gray-100 p-1 cursor-pointer transition-colors ${isToday ? 'bg-[#faf8f3]' : 'hover:bg-gray-50'} ${isSelected ? 'ring-2 ring-[#c8a45e] ring-inset' : ''}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'bg-[#c8a45e] text-[#0d1b2a] w-5 h-5 rounded-full flex items-center justify-center' : 'text-gray-500'}`}>{day}</div>
                  {dayEvents.slice(0, 3).map((e, ei) => (
                    <div key={ei} className="text-[10px] leading-tight mb-0.5 px-1 py-0.5 rounded truncate" style={{ backgroundColor: genreColor(e.genre) + '15', color: genreColor(e.genre), borderLeft: `2px solid ${genreColor(e.genre)}` }}>
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="card p-0 overflow-hidden">
          <div className="grid grid-cols-7 bg-[#0d1b2a] text-white text-xs text-center">
            {weekDays.map(d => {
              const date = new Date(d + 'T00:00:00');
              return (
                <div key={d} className={`py-2 font-medium ${d === today ? 'bg-[#c8a45e] text-[#0d1b2a]' : ''}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7">
            {weekDays.map(dateKey => {
              const dayEvents = eventsByDate[dateKey] || [];
              return (
                <div key={dateKey} className={`min-h-[200px] border border-gray-100 p-2 ${dateKey === today ? 'bg-[#faf8f3]' : ''}`}>
                  {dayEvents.length === 0 && <p className="text-xs text-gray-300 text-center mt-8">No events</p>}
                  {dayEvents.map((e, ei) => (
                    <div key={ei} className="mb-2 p-2 rounded-lg text-xs" style={{ backgroundColor: genreColor(e.genre) + '10', borderLeft: `3px solid ${genreColor(e.genre)}` }}>
                      <div className="font-semibold truncate" style={{ color: genreColor(e.genre) }}>{e.title}</div>
                      <div className="text-gray-500 mt-0.5">{e.time || ''}</div>
                      <div className="text-gray-400 mt-0.5 truncate">{e.venue_name || e.ownerName}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="card">
          {upcomingList.length === 0 && <p className="text-gray-400 text-center py-8">No upcoming events.</p>}
          {upcomingList.map(([dateKey, dayEvents]) => (
            <div key={dateKey} className="mb-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 pb-1 border-b border-gray-100">
                {new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                <span className="ml-2 text-[#c8a45e]">({dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''})</span>
              </div>
              {dayEvents.map((e, ei) => (
                <div key={ei} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 mb-1">
                  <div className="w-1 h-10 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: genreColor(e.genre) }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{e.title}</div>
                    <div className="text-xs text-gray-500">{e.time || 'Time TBD'} · {e.venue_name || e.ownerName} · {e.genre || 'General'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: e.campaign ? '#2d6a4f15' : '#e6394615', color: e.campaign ? '#2d6a4f' : '#e63946' }}>
                      {e.campaign ? '✅ Distributed' : '⏳ Pending'}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">{e.ownerName}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Selected Day Detail */}
      {selectedDay && eventsByDate[selectedDay] && (
        <div className="card mt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg m-0">
              {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              <span className="text-sm text-gray-400 ml-2">({eventsByDate[selectedDay].length} event{eventsByDate[selectedDay].length !== 1 ? 's' : ''})</span>
            </h3>
            <button onClick={() => setSelectedDay(null)} className="bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-600">✕</button>
          </div>
          {eventsByDate[selectedDay].map((e, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg mb-2" style={{ backgroundColor: genreColor(e.genre) + '08', borderLeft: `3px solid ${genreColor(e.genre)}` }}>
              <div className="flex-1">
                <div className="font-semibold">{e.title}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {e.time || 'Time TBD'} · {e.venue_name || e.ownerName}
                </div>
                <div className="text-xs text-gray-400 mt-1">{e.genre || 'General'} · {e.ownerName} ({e.ownerType})</div>
                {e.description && <div className="text-xs text-gray-500 mt-2 line-clamp-2">{e.description}</div>}
              </div>
              <div className="text-right">
                <div className={`text-xs px-2 py-1 rounded-full ${e.campaign ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  {e.campaign ? '✅ Distributed' : '⏳ Not yet'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card text-center" style={{ borderTop: `3px solid ${color}` }}>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm font-medium text-gray-700 mt-1">{label}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

function ActivityRow({ activity, users, detailed }) {
  const user = users.find(u => u.id === activity.userId);
  const actionIcons = {
    login: '🔑', signup: '🆕', event_create: '📅', content_generate: '✍️',
    distribution_send: '📡', image_generate: '🎨', podcast_generate: '🎙️',
    press_page_create: '🌐', bilingual_translate: '🇲🇽', venue_setup: '🏛️',
    artist_setup: '🎵', export_csv: '📥', invite_create: '🎟️',
  };
  const icon = actionIcons[activity.action] || '📌';

  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-medium">{user?.name || activity.userId || 'Unknown'}</span>
          {' '}
          <span className="text-gray-500">{activity.action?.replace(/_/g, ' ')}</span>
        </div>
        {detailed && activity.details && Object.keys(activity.details).length > 0 && (
          <div className="text-xs text-gray-400 mt-0.5">
            {Object.entries(activity.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap">
        {new Date(activity.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </span>
    </div>
  );
}

function ChannelPill({ channel, data }) {
  const colors = {
    sent: 'bg-green-100 text-green-700',
    published: 'bg-green-100 text-green-700',
    created: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    queued: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
    error: 'bg-red-100 text-red-700',
  };
  const colorClass = colors[data?.status] || 'bg-gray-100 text-gray-500';
  const label = channel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className={`text-xs px-2 py-1 rounded ${colorClass}`}>
      {label}: {data?.status || 'not started'}
    </span>
  );
}

function ChannelStatusCard({ name, icon, status, detail }) {
  const statusMap = {
    ready: { label: '✅ Ready', bg: 'bg-green-50', border: 'border-green-200' },
    setup: { label: '⚙️ Needs Setup', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    blocked: { label: '🚫 Blocked', bg: 'bg-red-50', border: 'border-red-200' },
  };
  const s = statusMap[status] || statusMap.setup;

  return (
    <div className={`${s.bg} border ${s.border} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-sm">{name}</span>
      </div>
      <div className="text-xs mb-1">{s.label}</div>
      <div className="text-xs text-gray-500">{detail}</div>
    </div>
  );
}

function UserDetail({ user, campaigns, activities, onBack, onEdit, onToggle, onRemove }) {
  const userCampaigns = Object.entries(campaigns)
    .filter(([, c]) => c.userId === user.id)
    .map(([id, c]) => ({ id, ...c }));
  const userActivities = activities.filter(a => a.userId === user.id).reverse().slice(0, 50);
  const ct = {
    venue: { icon: '🏛️', label: 'Venue' },
    artist: { icon: '🎵', label: 'Artist/Band' },
    performer: { icon: '🎭', label: 'Performer' },
    producer: { icon: '🎪', label: 'Producer' },
  }[user.clientType] || { icon: '🏛️', label: 'Venue' };

  return (
    <div>
      <button onClick={onBack} className="text-sm text-[#c8a45e] hover:underline bg-transparent border-none cursor-pointer mb-4">← Back to Users</button>

      <div className="card mb-4" style={{ borderLeft: `4px solid ${user.disabled ? '#ef4444' : '#22c55e'}` }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">{ct.icon} {user.name || 'Unnamed'}</h2>
            <p className="text-gray-500">{user.email}</p>
            {user.venueName && <p className="text-sm text-gray-400">{user.venueName}</p>}
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{ct.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${user.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {user.disabled ? 'Disabled' : 'Active'}
              </span>
              {user.isAdmin && <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Admin</span>}
            </div>
          </div>
          <div className="flex gap-2 mt-3 md:mt-0">
            <button onClick={onEdit}
              className="text-xs px-4 py-2 rounded bg-[#c8a45e] text-white border-none cursor-pointer hover:bg-[#b8944e]">
              ✏️ Edit Profile
            </button>
            <button onClick={onToggle}
              className={`text-xs px-4 py-2 rounded border-none cursor-pointer ${user.disabled ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {user.disabled ? 'Enable Account' : 'Disable Account'}
            </button>
            <button onClick={onRemove}
              className="text-xs px-4 py-2 rounded bg-gray-100 text-red-500 border-none cursor-pointer hover:bg-red-50">
              Remove
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-700">{userCampaigns.length}</div>
            <div className="text-xs text-gray-400">events</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</div>
            <div className="text-xs text-gray-400">joined</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</div>
            <div className="text-xs text-gray-400">last login</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-700">{userActivities.length}</div>
            <div className="text-xs text-gray-400">actions</div>
          </div>
        </div>
      </div>

      {/* User's Campaigns */}
      {userCampaigns.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-lg mb-3">Campaigns ({userCampaigns.length})</h3>
          {userCampaigns.map(c => (
            <div key={c.id} className="py-2 border-b border-gray-50 last:border-0">
              <div className="font-medium">{c.eventTitle}</div>
              <div className="text-xs text-gray-400">{c.venueName} · {c.eventDate}</div>
            </div>
          ))}
        </div>
      )}

      {/* User's Activity */}
      <div className="card">
        <h3 className="text-lg mb-3">Activity ({userActivities.length})</h3>
        {userActivities.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No activity recorded for this user</p>
        ) : (
          <div className="space-y-1">
            {userActivities.map(a => (
              <ActivityRow key={a.id} activity={a} users={[user]} detailed />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// USER EDIT MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════

function UserEditModal({ user, profile, events, onSave, onClose, onUpdateUser, onUpdateProfile }) {
  const [activeTab, setActiveTab] = useState("contact");
  const [saving, setSaving] = useState(false);

  const tabs = [
    { id: "contact", label: "Contact", icon: "👤" },
    { id: "business", label: "Business", icon: "🏢" },
    { id: "address", label: "Address", icon: "📍" },
    { id: "social", label: "Social", icon: "🌐" },
    { id: "venue", label: "Venue", icon: "🏛️" },
    { id: "artist", label: "Artist", icon: "🎵" },
    { id: "brand", label: "Brand", icon: "🎨" },
    { id: "events", label: `Events (${events.length})`, icon: "📅" }
  ];

  const handleSave = async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
  };

  const updateUser = (field, value) => {
    onUpdateUser({ ...user, [field]: value });
  };

  const updateProfile = (field, value) => {
    onUpdateProfile({ ...profile, [field]: value });
  };

  const clientTypeInfo = getClientTypeColors(user.client_type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="bg-white rounded-xl max-w-4xl w-full overflow-hidden flex flex-col my-4" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                {clientTypeInfo.icon} Edit User: {user.name}
              </h3>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 p-4 border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderRadius: '8px',
                border: activeTab === tab.id ? '2px solid #c8a45e' : '1px solid #e5e7eb',
                background: activeTab === tab.id ? '#faf8f3' : '#f9fafb',
                color: activeTab === tab.id ? '#0d1b2a' : '#6b7280',
                fontWeight: activeTab === tab.id ? '600' : '400',
                cursor: 'pointer',
                lineHeight: '1.2',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-xs text-gray-400 mb-4">* Required fields</p>
          {activeTab === "contact" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo URL</label>
                  <div className="flex gap-3 items-start">
                    {profile?.avatar_url && <img src={profile.avatar_url} alt="Avatar" className="w-12 h-12 rounded-full object-cover border border-gray-200" />}
                    <input type="url" value={profile?.avatar_url || ""} onChange={e => updateProfile("avatar_url", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://... or upload to your hosting" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input type="text" value={user.first_name || profile?.first_name || ""} onChange={e => { updateUser("first_name", e.target.value); updateProfile("first_name", e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <input type="text" value={user.last_name || profile?.last_name || ""} onChange={e => { updateUser("last_name", e.target.value); updateProfile("last_name", e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name <span className="text-red-500">*</span></label>
                  <input type="text" value={user.name || ""} onChange={e => updateUser("name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={user.email || ""} readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cell Phone</label>
                  <input type="tel" value={profile?.cell_phone || user.cell_phone || ""} onChange={e => { updateUser("cell_phone", e.target.value); updateProfile("cell_phone", e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Phone</label>
                  <input type="tel" value={profile?.work_phone || user.work_phone || ""} onChange={e => { updateUser("work_phone", e.target.value); updateProfile("work_phone", e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title / Role</label>
                  <input type="text" value={profile?.title || user.title || ""} onChange={e => { updateUser("title", e.target.value); updateProfile("title", e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Owner, Manager, Booking Agent..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Contact</label>
                  <select value={profile?.preferred_contact || ""} onChange={e => updateProfile("preferred_contact", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option value="">Select...</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Type <span className="text-red-500">*</span></label>
                  <select value={user.client_type || ""} onChange={e => updateUser("client_type", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    {CLIENT_TYPES.map(ct => (
                      <option key={ct.key} value={ct.key}>{ct.icon} {ct.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                  <input type="text" value={user.venue_name || ""} onChange={e => updateUser("venue_name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div className="flex items-center gap-6 md:col-span-2">
                  <label className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={user.is_admin || false} onChange={e => updateUser("is_admin", e.target.checked)}
                      className="mr-2" />
                    Admin Access
                  </label>
                  <label className="flex items-center text-sm font-medium text-red-600 cursor-pointer">
                    <input type="checkbox" checked={user.disabled || false} onChange={e => updateUser("disabled", e.target.checked)}
                      className="mr-2" />
                    Disabled
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "business" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DBA / Business Name</label>
                  <input type="text" value={profile?.dba_name || ""} onChange={e => updateProfile("dba_name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Good Creative Media" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EIN / Tax ID</label>
                  <input type="text" value={profile?.ein || ""} onChange={e => updateProfile("ein", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="XX-XXXXXXX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Phone</label>
                  <input type="tel" value={profile?.business_phone || ""} onChange={e => updateProfile("business_phone", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
                  <input type="email" value={profile?.business_email || ""} onChange={e => updateProfile("business_email", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio / Description</label>
                  <textarea value={profile?.bio || ""} onChange={e => updateProfile("bio", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={3} placeholder="Brief description of the business or artist..." />
                </div>
              </div>
            </div>
          )}

          {activeTab === "address" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input type="text" value={profile?.address || ""} onChange={e => updateProfile("address", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="123 Main St" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input type="text" value={profile?.suite_number || ""} onChange={e => updateProfile("suite_number", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Suite, Unit, Floor..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input type="text" value={profile?.city || ""} onChange={e => updateProfile("city", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="San Antonio" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input type="text" value={profile?.state || ""} onChange={e => updateProfile("state", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="TX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input type="text" value={profile?.zip_code || ""} onChange={e => updateProfile("zip_code", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="78204" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input type="text" value={profile?.country || "US"} onChange={e => updateProfile("country", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "social" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input type="url" value={profile?.website || ""} onChange={e => updateProfile("website", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                  <input type="url" value={profile?.facebook || profile?.facebook_url || ""} onChange={e => updateProfile("facebook_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://facebook.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                  <input type="text" value={profile?.instagram || profile?.instagram_url || ""} onChange={e => updateProfile("instagram_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="@handle or URL" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twitter / X</label>
                  <input type="text" value={profile?.twitter || profile?.twitter_url || ""} onChange={e => updateProfile("twitter_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="@handle or URL" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">TikTok</label>
                  <input type="text" value={profile?.tiktok || profile?.tiktok_url || ""} onChange={e => updateProfile("tiktok_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="@handle or URL" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube</label>
                  <input type="url" value={profile?.youtube || profile?.youtube_url || ""} onChange={e => updateProfile("youtube_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://youtube.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                  <input type="url" value={profile?.linkedin || profile?.linkedin_url || ""} onChange={e => updateProfile("linkedin_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://linkedin.com/in/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spotify</label>
                  <input type="url" value={profile?.spotify || profile?.spotify_url || ""} onChange={e => updateProfile("spotify_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://open.spotify.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yelp</label>
                  <input type="url" value={profile?.yelp_url || ""} onChange={e => updateProfile("yelp_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://yelp.com/biz/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Google Business</label>
                  <input type="url" value={profile?.google_business_url || ""} onChange={e => updateProfile("google_business_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Google My Business URL" />
                </div>
              </div>
              <h4 className="font-semibold text-gray-700 border-b pb-2 mt-4">Online Shops and Menus</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Online Menu</label>
                  <input type="url" value={profile?.online_menu_url || ""} onChange={e => updateProfile("online_menu_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="DoorDash, Toast, your site..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Square Store</label>
                  <input type="url" value={profile?.square_store_url || ""} onChange={e => updateProfile("square_store_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shopify Store</label>
                  <input type="url" value={profile?.shopify_store_url || ""} onChange={e => updateProfile("shopify_store_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amazon Store</label>
                  <input type="url" value={profile?.amazon_store_url || ""} onChange={e => updateProfile("amazon_store_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Etsy Shop</label>
                  <input type="url" value={profile?.etsy_store_url || ""} onChange={e => updateProfile("etsy_store_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Merch Store</label>
                  <input type="url" value={profile?.merch_store_url || ""} onChange={e => updateProfile("merch_store_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Other Store</label>
                  <input type="url" value={profile?.other_store_url || ""} onChange={e => updateProfile("other_store_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "venue" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Venue details for this user's space. A user can manage multiple venues from their account.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue Photo URL</label>
                  <div className="flex gap-3 items-start">
                    {profile?.venue_photo_url && <img src={profile.venue_photo_url} alt="Venue" className="w-20 h-14 rounded-lg object-cover border border-gray-200" />}
                    <input type="url" value={profile?.venue_photo_url || ""} onChange={e => updateProfile("venue_photo_url", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://... main venue photo" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
                  <input type="text" value={profile?.venue_name || user.venue_name || ""} onChange={e => { updateUser("venue_name", e.target.value); updateProfile("venue_name", e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="The Dakota East Side Ice House" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue Type</label>
                  <select value={profile?.venue_type || ""} onChange={e => updateProfile("venue_type", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option value="">Select...</option>
                    <option value="bar">Bar / Pub</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="theater">Theater</option>
                    <option value="gallery">Gallery</option>
                    <option value="club">Club / Nightclub</option>
                    <option value="outdoor">Outdoor / Amphitheater</option>
                    <option value="hotel">Hotel / Conference</option>
                    <option value="church">Church / Worship</option>
                    <option value="school">School / University</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input type="number" value={profile?.capacity || ""} onChange={e => updateProfile("capacity", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parking</label>
                  <select value={profile?.parking_type || ""} onChange={e => updateProfile("parking_type", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option value="">Select...</option>
                    <option value="street">Street</option>
                    <option value="lot">Parking Lot</option>
                    <option value="garage">Garage</option>
                    <option value="valet">Valet</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age Restriction</label>
                  <select value={profile?.age_restriction || "all_ages"} onChange={e => updateProfile("age_restriction", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option value="all_ages">All Ages</option>
                    <option value="18_plus">18+</option>
                    <option value="21_plus">21+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Neighborhood</label>
                  <input type="text" value={profile?.neighborhood || ""} onChange={e => updateProfile("neighborhood", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Southtown, Pearl, St. Mary's Strip..." />
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-4">
                  <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={profile?.has_stage || false} onChange={e => updateProfile("has_stage", e.target.checked)} className="mr-2" /> Stage
                  </label>
                  <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={profile?.has_sound || false} onChange={e => updateProfile("has_sound", e.target.checked)} className="mr-2" /> Sound System
                  </label>
                  <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={profile?.has_lighting || false} onChange={e => updateProfile("has_lighting", e.target.checked)} className="mr-2" /> Lighting
                  </label>
                  <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={profile?.ada_accessible || false} onChange={e => updateProfile("ada_accessible", e.target.checked)} className="mr-2" /> ADA
                  </label>
                  <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={profile?.liquor_license || false} onChange={e => updateProfile("liquor_license", e.target.checked)} className="mr-2" /> Liquor License
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "artist" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Artist and performer details. A user can represent multiple acts.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Headshot / Press Photo URL</label>
                  <div className="flex gap-3 items-start">
                    {profile?.headshot_url && <img src={profile.headshot_url} alt="Headshot" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />}
                    <input type="url" value={profile?.headshot_url || ""} onChange={e => updateProfile("headshot_url", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="High-res press photo URL" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Headshot / Press Photo URL</label>
                  <div className="flex gap-3 items-start">
                    {profile?.headshot_url && <img src={profile.headshot_url} alt="Headshot" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />}
                    <input type="url" value={profile?.headshot_url || ""} onChange={e => updateProfile("headshot_url", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://... press photo for marketing materials" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage Name / Act Name</label>
                  <input type="text" value={profile?.stage_name || ""} onChange={e => updateProfile("stage_name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Julie Good and A Dog Named Mike" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                  <input type="text" value={profile?.genre || ""} onChange={e => updateProfile("genre", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Jazz, Rock, Electronic, Comedy..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Members / Ensemble Size</label>
                  <input type="text" value={profile?.member_count || ""} onChange={e => updateProfile("member_count", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Solo, Duo, 4-piece, etc." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Booking Contact</label>
                  <input type="text" value={profile?.booking_contact || ""} onChange={e => updateProfile("booking_contact", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Email or phone for bookings" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Set Length (typical)</label>
                  <input type="text" value={profile?.set_length || ""} onChange={e => updateProfile("set_length", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="45 min, 1 hour, 2 sets..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tech Rider URL</label>
                  <input type="url" value={profile?.tech_rider_url || ""} onChange={e => updateProfile("tech_rider_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Link to technical rider" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Artist Bio</label>
                  <textarea value={profile?.artist_bio || profile?.bio || ""} onChange={e => updateProfile("artist_bio", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={3} placeholder="Short bio for press materials..." />
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-4">
                  <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={profile?.needs_backline || false} onChange={e => updateProfile("needs_backline", e.target.checked)} className="mr-2" /> Needs Backline
                  </label>
                  <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={profile?.needs_sound || false} onChange={e => updateProfile("needs_sound", e.target.checked)} className="mr-2" /> Needs Sound
                  </label>
                  <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={profile?.has_own_pa || false} onChange={e => updateProfile("has_own_pa", e.target.checked)} className="mr-2" /> Has Own PA
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "brand" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Brand identity used in all generated marketing materials.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Brand Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={profile?.brand_primary_color || "#c8a45e"} onChange={e => updateProfile("brand_primary_color", e.target.value)}
                      className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
                    <input type="text" value={profile?.brand_primary_color || "#c8a45e"} onChange={e => updateProfile("brand_primary_color", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="#c8a45e" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Brand Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={profile?.brand_secondary_color || "#0d1b2a"} onChange={e => updateProfile("brand_secondary_color", e.target.value)}
                      className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
                    <input type="text" value={profile?.brand_secondary_color || "#0d1b2a"} onChange={e => updateProfile("brand_secondary_color", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="#0d1b2a" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Font</label>
                  <input type="text" value={profile?.brand_font || ""} onChange={e => updateProfile("brand_font", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Playfair Display, Inter, etc." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input type="url" value={profile?.logo_url || ""} onChange={e => updateProfile("logo_url", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://..." />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Voice / Tone Notes</label>
                  <textarea value={profile?.brand_voice || ""} onChange={e => updateProfile("brand_voice", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={3} placeholder="How should AI-generated content sound? Casual and fun? Professional? Edgy?" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tagline / Motto</label>
                  <input type="text" value={profile?.tagline || ""} onChange={e => updateProfile("tagline", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Your signature line" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Boilerplate (About paragraph for press)</label>
                  <textarea value={profile?.boilerplate || ""} onChange={e => updateProfile("boilerplate", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={3} placeholder="Standard 'About' paragraph used at the bottom of press releases..." />
                </div>
              </div>
            </div>
          )}

          {activeTab === "events" && (
            <div className="space-y-4">
              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map(evt => (
                    <div key={evt.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        {evt.image_url ? (
                          <img src={evt.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-2xl">📅</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-sm">{evt.title || 'Untitled Event'}</h4>
                              <p className="text-xs text-gray-500 mt-1">
                                📅 {evt.date || 'No date'} {evt.time ? `at ${evt.time}` : ''} · {evt.genre || 'No genre'}
                              </p>
                              {evt.description && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{evt.description}</p>}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${evt.status === 'published' ? 'bg-green-100 text-green-700' : evt.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                              {evt.status || 'draft'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📅</div>
                  <div className="border border-dashed border-gray-300 rounded-lg p-6 max-w-sm mx-auto">
                    <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-400">📅</span>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-400">🎵</span>
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                      </div>
                      <div className="h-3 bg-gray-200 rounded w-full mt-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                    <p className="text-sm text-gray-400 mt-4">No events yet</p>
                    <p className="text-xs text-gray-400">Events will appear here once created from the Dashboard.</p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-[#c8a45e] text-white rounded-lg text-sm hover:bg-[#b8944e] disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BROADCAST TAB
// ═══════════════════════════════════════════════════════════════

function BroadcastTab({ users }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [filter, setFilter] = useState('all'); // all, venue, artist, active
  const [preview, setPreview] = useState(false);
  const [results, setResults] = useState(null);

  const activeUsers = users.filter(u => !u.disabled);
  const filteredUsers = filter === 'all' ? activeUsers :
    filter === 'venue' ? activeUsers.filter(u => ['venue_owner','venue_manager','venue_marketing','venue_staff','restaurant','festival_organizer'].includes(u.client_type)) :
    filter === 'artist' ? activeUsers.filter(u => ['artist','dj','vendor','promoter','manager','booking_agent','producer'].includes(u.client_type)) :
    activeUsers;

  const TEMPLATES = [
    {
      name: '📅 Weekly Event Reminder',
      subject: 'Got an event coming up? Let the IMC Machine handle the marketing.',
      body: `Hey there,\n\nQuick reminder: if you have any upcoming events, now's the time to get them into the IMC Machine so we can start building your press, social posts, and calendar listings.\n\nJust log in, hit "Create Event," and the system handles the rest. Press releases, social media for every platform, email campaigns, calendar submissions. All from one dashboard.\n\nThe sooner your event is in, the more lead time we have to get the word out.\n\nLet's make some noise.\n\nJulie Good\nGood Creative Media\nSan Antonio, TX`,
    },
    {
      name: '🎉 New Feature Announcement',
      subject: 'New in the IMC Machine: [Feature Name]',
      body: `Hey there,\n\nI just added something new to the IMC Machine that I think you're going to love.\n\n[Describe the feature and why it matters to them.]\n\nLog in and check it out: https://imc.goodcreativemedia.com\n\nAs always, if you have questions or feedback, just reply to this email. I read everything.\n\nJulie Good\nGood Creative Media`,
    },
    {
      name: '🤝 Welcome / Onboarding',
      subject: 'Welcome to the IMC Machine. Here\'s how to get started.',
      body: `Hey there,\n\nWelcome aboard. I'm glad you're here.\n\nHere's the quick start:\n\n1. Log in at https://imc.goodcreativemedia.com\n2. Set up your profile (venue details, social links, brand colors)\n3. Create your first event\n4. Let the IMC Machine generate your marketing materials\n\nThe whole thing is designed to save you hours of marketing work. Press releases, social posts, calendar listings, email campaigns. One dashboard, done.\n\nIf you get stuck, just reply to this email. I'm here.\n\nJulie Good\nGood Creative Media\nSan Antonio, TX`,
    },
  ];

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      alert('Subject and body are required.');
      return;
    }
    if (!confirm(`Send this email to ${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''}?`)) return;

    setSending(true);
    setSent(false);
    setResults(null);

    const successes = [];
    const failures = [];

    for (const user of filteredUsers) {
      try {
        const r = await fetch('/api/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-email',
            to: user.email,
            subject: subject,
            html: body.replace(/\n/g, '<br>'),
            text: body,
          }),
        });
        const data = await r.json();
        if (data.success || data.id) {
          successes.push(user.email);
        } else {
          failures.push({ email: user.email, error: data.error || 'Unknown error' });
        }
      } catch (err) {
        failures.push({ email: user.email, error: err.message });
      }
    }

    setResults({ successes, failures });
    setSending(false);
    setSent(true);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg mb-4">📧 Broadcast Email to Users</h3>
        <p className="text-sm text-gray-500 mb-4">
          Send an email to all your users (or a filtered group). Great for weekly event reminders, feature announcements, or just checking in.
        </p>

        {/* Templates */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Quick Templates</label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t, i) => (
              <button key={i} onClick={() => { setSubject(t.subject); setBody(t.body); }}
                style={{
                  padding: '4px 10px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
                  border: '1px solid #e5e7eb', background: '#f9fafb',
                }}>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Audience Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Send to: <span className="text-[#c8a45e] font-bold">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: `All (${activeUsers.length})` },
              { key: 'venue', label: 'Venues Only' },
              { key: 'artist', label: 'Artists Only' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding: '4px 12px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
                  border: filter === f.key ? '2px solid #c8a45e' : '1px solid #e5e7eb',
                  background: filter === f.key ? '#faf8f3' : '#f9fafb',
                  fontWeight: filter === f.key ? '600' : '400',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Your subject line" />
        </div>

        {/* Body */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={12}
            style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}
            placeholder="Write your message here. Use templates above for a head start." />
        </div>

        {/* Preview */}
        {body && (
          <div className="mb-4">
            <button onClick={() => setPreview(!preview)}
              className="text-xs text-[#c8a45e] font-semibold bg-transparent border-none cursor-pointer">
              {preview ? '▼ Hide Preview' : '▶ Show Preview'}
            </button>
            {preview && (
              <div className="mt-2 border border-gray-200 rounded-lg p-4 bg-white">
                <p className="text-xs text-gray-400 mb-1">From: events@goodcreativemedia.com</p>
                <p className="text-sm font-semibold mb-2">{subject || '(no subject)'}</p>
                <div className="text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, '<br>') }} />
              </div>
            )}
          </div>
        )}

        {/* Send */}
        <div className="flex items-center gap-3">
          <button onClick={handleSend} disabled={sending || !subject || !body}
            className="px-6 py-2.5 bg-[#c8a45e] text-[#0d1b2a] rounded-lg font-semibold text-sm border-none cursor-pointer disabled:opacity-50">
            {sending ? `⏳ Sending to ${filteredUsers.length} users...` : `📧 Send to ${filteredUsers.length} User${filteredUsers.length !== 1 ? 's' : ''}`}
          </button>
          {sent && <span className="text-sm text-green-600 font-semibold">✅ Sent!</span>}
        </div>

        {/* Results */}
        {results && (
          <div className="mt-4 space-y-2">
            {results.successes.length > 0 && (
              <p className="text-sm text-green-600">✅ Successfully sent to {results.successes.length} user{results.successes.length !== 1 ? 's' : ''}</p>
            )}
            {results.failures.length > 0 && (
              <div>
                <p className="text-sm text-red-500">❌ Failed for {results.failures.length}:</p>
                {results.failures.map((f, i) => (
                  <p key={i} className="text-xs text-red-400 ml-4">{f.email}: {f.error}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recipient List */}
      <div className="card">
        <h4 className="text-sm font-semibold mb-3">Recipients ({filteredUsers.length})</h4>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {filteredUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between text-xs py-1">
              <span className="text-gray-700">{u.name || u.email}</span>
              <span className="text-gray-400">{u.email}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
