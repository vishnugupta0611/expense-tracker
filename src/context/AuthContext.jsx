import { createContext, useState, useEffect, useContext } from 'react';
import { useAuth as useClerkAuth } from '@clerk/react';
import api from '@services/api.js';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useClerkAuth();

  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for Clerk to finish loading
    if (!isLoaded) return;

    let cancelled = false;

    const run = async () => {
      if (!isSignedIn) {
        // Not signed in — clear everything
        localStorage.removeItem('token');
        if (!cancelled) { setUser(null); setLoading(false); }
        return;
      }

      // Signed in via Clerk — check if we already have a valid token
      const stored = localStorage.getItem('token');
      if (stored) {
        try {
          const r = await api.get('/auth/me');
          if (!cancelled) { setUser(r.data.user); setLoading(false); }
          return;
        } catch {
          localStorage.removeItem('token');
        }
      }

      // No valid token — exchange Clerk session for our JWT
      try {
        const clerkToken = await getToken();
        const res = await api.post('/auth/clerk', { sessionToken: clerkToken });
        localStorage.setItem('token', res.data.token);
        if (!cancelled) { setUser(res.data.user); setLoading(false); }
      } catch (err) {
        console.error('Auth exchange failed:', err);
        if (!cancelled) { setUser(null); setLoading(false); }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = async () => {
    localStorage.removeItem('token');
    setUser(null);
    try { await clerkSignOut(); } catch { /* ignore */ }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
