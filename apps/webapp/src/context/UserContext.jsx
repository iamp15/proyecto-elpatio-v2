import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { WebApp } from '@twa-dev/sdk';
import { request } from '../api/client.js';

const MOCK_USER_ID = Number(import.meta.env.VITE_MOCK_USER_ID) || 12345678;

function isTelegramEnv() {
  return typeof WebApp !== 'undefined' && WebApp.initData && String(WebApp.initData).length > 0;
}

function isDevEnv() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const loginAttempted = useRef(false);

  const login = useCallback(async () => {
    if (isTelegramEnv()) {
      const body = { initData: WebApp.initData };
      const data = await request('POST', '/auth/login', { body });
      const userData = data.user ? { id: data.user.id, username: data.user.username ?? null } : null;
      setToken(data.token);
      setUser(userData);
      return;
    }
    if (isDevEnv()) {
      const data = await request('POST', '/auth/login', {
        body: { isMock: true, userId: MOCK_USER_ID },
      });
      const userData = data.user ? { id: data.user.id, username: data.user.username ?? null } : null;
      setToken(data.token);
      setUser(userData);
      return;
    }
    // Fuera de Telegram y no en desarrollo: no llamar al backend
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (token != null || loginAttempted.current) return;
    if (isTelegramEnv() || isDevEnv()) {
      loginAttempted.current = true;
      login().catch(() => {});
    }
  }, [token, login]);

  const value = { token, user, login, logout };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
