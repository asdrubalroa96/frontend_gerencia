import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import client from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await client.get('/api/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await client.post('/api/auth/login', { email, password });
    setUser(data.user);
    try {
      const { data: me } = await client.get('/api/auth/me');
      setUser(me);
    } catch {
      /* se mantiene el usuario devuelto por login */
    }
    return data.user;
  };

  const logout = async () => {
    await client.post('/api/auth/logout');
    setUser(null);
  };

  const can = useCallback(
    (code) => {
      if (!code) return true;
      if (user?.role === 'admin') return true;
      const list = user?.permissions || [];
      return list.includes(code);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
      can,
      isAdmin: user?.role === 'admin',
    }),
    [user, loading, refresh, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
