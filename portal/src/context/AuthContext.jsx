import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, createUser, logActivity, getInviteByCode, markInviteUsed } from '../lib/supabase';

const AuthContext = createContext(null);

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'juliegood@goodcreativemedia.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        hydrateUser(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        hydrateUser(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function hydrateUser(authUser) {
    try {
      // Fetch user row from our users table.
      // Prefer auth_user_id if present in schema, fall back to email.
      let dbUser = null;
      let error = null;
      const { data: byAuthUserId, error: byAuthUserIdError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (byAuthUserIdError && byAuthUserIdError.code !== 'PGRST116' && byAuthUserIdError.code !== '42703') {
        error = byAuthUserIdError;
      } else if (byAuthUserId) {
        dbUser = byAuthUserId;
      }

      if (!dbUser) {
        const { data: byEmail, error: byEmailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email.toLowerCase())
          .maybeSingle();
        if (byEmailError && byEmailError.code !== 'PGRST116') {
          error = byEmailError;
        } else {
          dbUser = byEmail || null;
        }
      }

      if (error && error.code !== 'PGRST116') {
        console.error('[Auth] Error fetching user row:', error);
      }

      if (dbUser) {
        if (!dbUser.auth_user_id) {
          await supabase.from('users').update({ auth_user_id: authUser.id }).eq('id', dbUser.id);
        }
        setUser(mapDbUser(dbUser));
      } else {
        // Auth user exists but no users row yet — create minimal one
        // (shouldn't normally happen since signup creates both)
        setUser({
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.name || authUser.email.split('@')[0],
          isAdmin: authUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
          clientType: 'venue',
          venueName: '',
          disabled: false,
        });
      }
    } catch (err) {
      console.warn('[Auth] Hydrate failed:', err.message);
      setUser({
        id: authUser.id,
        email: authUser.email,
        name: authUser.email.split('@')[0],
        isAdmin: authUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
        clientType: 'venue',
        venueName: '',
        disabled: false,
      });
    }
    setLoading(false);
  }

  function mapDbUser(dbUser) {
    return {
      id: dbUser.id,
      authUserId: dbUser.auth_user_id || null,
      email: dbUser.email,
      name: dbUser.name,
      isAdmin: dbUser.is_admin || dbUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
      clientType: dbUser.client_type || 'venue',
      venueName: dbUser.venue_name || '',
      disabled: dbUser.disabled,
      createdAt: dbUser.created_at,
      lastLogin: dbUser.last_login,
    };
  }

  const login = async (email, password) => {
    const emailLower = email.toLowerCase().trim();

    // Authenticate with Supabase Auth — real password validation
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password,
    });

    if (error) {
      throw new Error(error.message === 'Invalid login credentials'
        ? 'Invalid email or password.'
        : error.message);
    }

    // Update last login in users table
    let dbUser = null;
    const { data: byAuthUserId, error: byAuthUserIdError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();
    if (!byAuthUserIdError && byAuthUserId) {
      dbUser = byAuthUserId;
    } else {
      const { data: byEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailLower)
        .maybeSingle();
      dbUser = byEmail || null;
    }

    if (dbUser) {
      if (dbUser.disabled) {
        await supabase.auth.signOut();
        throw new Error('Account is disabled. Contact admin.');
      }
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', dbUser.id);

      logActivity(dbUser.id, 'login', { method: 'email' });
      const userData = mapDbUser({ ...dbUser, last_login: new Date().toISOString() });
      setUser(userData);
      return userData;
    }

    // Edge case: auth user exists but no users row (shouldn't happen with proper signup)
    const authUser = data.user;
    const userData = {
      id: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.name || authUser.email.split('@')[0],
      isAdmin: authUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
      clientType: 'venue',
      venueName: '',
      disabled: false,
    };
    setUser(userData);
    return userData;
  };

  const signup = async (email, password, name, venueName, inviteCode, clientType) => {
    const emailLower = email.toLowerCase().trim();

    // Step 1: Validate invite code FIRST (REQUIRED)
    if (!inviteCode || !inviteCode.trim()) {
      throw new Error('An invite code is required to create an account.');
    }

    const invite = await getInviteByCode(inviteCode.trim());
    if (!invite) {
      throw new Error('Invalid or expired invite code.');
    }

    // Step 2: Create Supabase Auth account (real password-based auth)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailLower,
      password,
      options: {
        data: {
          name: name || emailLower.split('@')[0],
          client_type: clientType || 'venue',
        },
        // Skip email confirmation for now (can enable later in Supabase dashboard)
        emailRedirectTo: undefined,
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    // Step 3: Create user row in our users table
    const dbUser = await createUser({
      email: emailLower,
      name: name || emailLower.split('@')[0],
      clientType: clientType || 'venue',
      venueName: venueName || '',
      authUserId: authData?.user?.id,
    });

    // Step 4: Mark invite as used
    await markInviteUsed(invite.id, dbUser.id);

    const userData = mapDbUser(dbUser);

    logActivity(dbUser.id, 'signup', { clientType: clientType || 'venue', venueName });

    setUser(userData);
    return userData;
  };

  const logout = async () => {
    if (user?.id) {
      logActivity(user.id, 'logout', {});
    }
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isAdmin: user?.isAdmin || false }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
