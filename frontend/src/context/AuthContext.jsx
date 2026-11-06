import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './useAuth';
import { SESSION_EXPIRED_EVENT } from '../services/api';

function readSession() {
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    return token && user ? { token, user } : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  const login = useCallback((token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setSession({ token, user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession({ token: null, user: null });
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  }, [logout]);

  const value = useMemo(() => ({ ...session, loading: false, login, logout }), [session, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
