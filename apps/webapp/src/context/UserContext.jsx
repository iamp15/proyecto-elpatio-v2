import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { WebApp } from '@twa-dev/sdk';
import { request } from '../api/client.js';

const MOCK_USER_ID = Number(import.meta.env.VITE_MOCK_USER_ID) || 12345678;

function isTelegramEnv() {
  return typeof WebApp !== 'undefined' && WebApp.initData && String(WebApp.initData).length > 0;
}

function getTelegramLogContext() {
  try {
    if (typeof WebApp === 'undefined') return { desdeTelegram: false, initDataPresente: false, initDataLongitud: 0, usuarioTelegram: null };
    const initData = WebApp.initData ? String(WebApp.initData) : '';
    let user = null;
    try {
      if (WebApp.initDataUnsafe && typeof WebApp.initDataUnsafe.user !== 'undefined') {
        const u = WebApp.initDataUnsafe.user;
        user = { id: u.id, username: u.username || null, firstName: u.first_name || null };
      }
    } catch (_) {}
    return {
      desdeTelegram: true,
      initDataPresente: initData.length > 0,
      initDataLongitud: initData.length,
      usuarioTelegram: user,
    };
  } catch (e) {
    return { desdeTelegram: false, initDataPresente: false, initDataLongitud: 0, usuarioTelegram: null, error: String(e && e.message ? e.message : e) };
  }
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
    const telegramCtx = getTelegramLogContext();
    console.log('[Login] Detección:', {
      desdeTelegram: telegramCtx.desdeTelegram,
      initDataPresente: telegramCtx.initDataPresente,
      initDataLongitud: telegramCtx.initDataLongitud,
      usuarioTelegram: telegramCtx.usuarioTelegram,
      esDevLocal: isDevEnv(),
    });

    if (isTelegramEnv()) {
      console.log('[Login] Enviando login con initData (longitud:', telegramCtx.initDataLongitud, ')');
      const data = await request('POST', '/auth/login', { body: { initData: WebApp.initData } });
      const userData = data.user ? { id: data.user.id, username: data.user.username ?? null } : null;
      setToken(data.token);
      setUser(userData);
      console.log('[Login] Login exitoso (Telegram):', userData);
      return;
    }
    if (isDevEnv()) {
      console.log('[Login] Enviando login mock (userId:', MOCK_USER_ID, ')');
      const data = await request('POST', '/auth/login', {
        body: { isMock: true, userId: MOCK_USER_ID },
      });
      const userData = data.user ? { id: data.user.id, username: data.user.username ?? null } : null;
      setToken(data.token);
      setUser(userData);
      console.log('[Login] Login exitoso (mock):', userData);
      return;
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let telegramCtx;
    try {
      telegramCtx = getTelegramLogContext();
      console.log('[Login] Webapp iniciada. Desde Telegram:', telegramCtx.desdeTelegram, '| initData presente:', telegramCtx.initDataPresente, '| Usuario TG:', telegramCtx.usuarioTelegram);
    } catch (e) {
      console.log('[Login] Webapp iniciada. Error al leer contexto:', String(e));
    }
    if (token != null || loginAttempted.current) return;
    if (isTelegramEnv() || isDevEnv()) {
      loginAttempted.current = true;
      login().catch((err) => {
        console.error('[Login] Error:', err?.message || err, 'status:', err?.status, 'body:', err?.body);
      });
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
