import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createApiClient } from '../api/client.js';
import { fetchBalance } from '../api/balance.js';
import { fetchWalletBalance, fetchWalletHistory } from '../api/wallet.js';

const STORAGE_KEYS = { token: 'el_patio_token', user: 'el_patio_user' };
const MOCK_USER_ID = Number(import.meta.env.VITE_MOCK_USER_ID) || 12345678;

function getTelegramWebApp() {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

function isTelegramEnv() {
  const twa = getTelegramWebApp();
  return twa != null && twa.initData != null && String(twa.initData).length > 0;
}

function getTelegramLogContext() {
  try {
    const twa = getTelegramWebApp();
    if (twa == null) return { desdeTelegram: false, initDataPresente: false, initDataLongitud: 0, usuarioTelegram: null, fuente: 'ninguna' };
    const initData = twa.initData ? String(twa.initData) : '';
    let user = null;
    try {
      if (twa.initDataUnsafe && typeof twa.initDataUnsafe.user !== 'undefined') {
        const u = twa.initDataUnsafe.user;
        user = { id: u.id, username: u.username || null, firstName: u.first_name || null };
      }
    } catch (_) {}
    return {
      desdeTelegram: initData.length > 0,
      initDataPresente: initData.length > 0,
      initDataLongitud: initData.length,
      usuarioTelegram: user,
      fuente: window.Telegram?.WebApp ? 'window.Telegram.WebApp' : 'sdk',
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

function readStoredAuth() {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.token) || null;
    const userRaw = localStorage.getItem(STORAGE_KEYS.user);
    const user = userRaw ? (() => { try { return JSON.parse(userRaw); } catch { return null; } })() : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
  } catch (_) {}
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const stored = readStoredAuth();
  const [token, setToken] = useState(stored.token);
  const [user, setUser] = useState(stored.user);
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(null);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState(null);
  const loginAttempted = useRef(false);

  const clearAndRedirect = useCallback(() => {
    setToken(null);
    setUser(null);
    setBalance(null);
    setBalanceError(null);
    setTransactions([]);
    setTransactionsError(null);
    clearStoredAuth();
    if (typeof window !== 'undefined') window.location.href = '/';
  }, []);

  const getToken = useCallback(() => token, [token]);
  const api = useMemo(() => createApiClient(getToken, clearAndRedirect), [getToken, clearAndRedirect]);

  const login = useCallback(async () => {
    const telegramCtx = getTelegramLogContext();
    console.log('[Auth] Detección:', { desdeTelegram: telegramCtx.desdeTelegram, initDataPresente: telegramCtx.initDataPresente, esDevLocal: isDevEnv() });

    setAuthLoading(true);
    try {
      if (isTelegramEnv()) {
        const twa = getTelegramWebApp();
        const data = await api.request('POST', '/auth/login', { body: { initData: twa.initData } });
        const twaUser = twa.initDataUnsafe?.user ?? {};
        const userData = data.user ? {
          id: data.user.id,
          username: data.user.username ?? null,
          first_name: data.user.first_name ?? twaUser.first_name ?? null,
          photo_url: data.user.photo_url ?? twaUser.photo_url ?? null,
        } : null;
        setToken(data.token);
        setUser(userData);
        localStorage.setItem(STORAGE_KEYS.token, data.token);
        if (userData) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData));
        console.log('[Auth] Login exitoso (Telegram):', userData);
        return;
      }
      if (isDevEnv()) {
        const data = await api.request('POST', '/auth/login', { body: { isMock: true, userId: MOCK_USER_ID } });
        const userData = data.user ? {
          id: data.user.id,
          username: data.user.username ?? null,
          first_name: data.user.first_name ?? null,
          photo_url: data.user.photo_url ?? null,
        } : null;
        setToken(data.token);
        setUser(userData);
        localStorage.setItem(STORAGE_KEYS.token, data.token);
        if (userData) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData));
        console.log('[Auth] Login exitoso (mock):', userData);
      }
    } catch (err) {
      console.error('[Auth] Error login:', err?.message || err, 'status:', err?.status);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  }, [api]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setBalance(null);
    setBalanceError(null);
    setTransactions([]);
    setTransactionsError(null);
    clearStoredAuth();
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!token) return;
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const data = await fetchBalance(api.request);
      setBalance(data.piedras ?? null);
    } catch (e) {
      setBalanceError(e?.body?.error || e?.message || 'Error al cargar balance');
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [token, api]);

  const refreshWallet = useCallback(async () => {
    if (!token) return;
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const [balanceData, historyData] = await Promise.all([
        fetchWalletBalance(api.request),
        fetchWalletHistory(api.request),
      ]);
      setBalance(balanceData.piedras ?? null);
      setTransactions(historyData.transactions ?? []);
    } catch (e) {
      setTransactionsError(e?.body?.error || e?.message || 'Error al cargar la billetera');
    } finally {
      setTransactionsLoading(false);
    }
  }, [token, api]);

  useEffect(() => {
    const twa = getTelegramWebApp();
    if (twa) {
      twa.ready();
      twa.expand();
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    refreshBalance();
  }, [token, refreshBalance]);

  useEffect(() => {
    try {
      const telegramCtx = getTelegramLogContext();
      console.log('[Auth] Inicio. Desde Telegram:', telegramCtx.desdeTelegram, '| initData:', telegramCtx.initDataPresente);
    } catch (_) {}
    if (token != null || loginAttempted.current) return;
    if (isTelegramEnv() || isDevEnv()) {
      loginAttempted.current = true;
      login().catch((err) => console.error('[Auth] Error auto-login:', err?.message || err));
    }
  }, [token, login]);

  const isAuthenticated = !!token;
  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated,
      login,
      logout,
      balance,
      refreshBalance,
      refreshWallet,
      transactions,
      authLoading,
      balanceLoading,
      balanceError,
      transactionsLoading,
      transactionsError,
    }),
    [
      user, token, isAuthenticated, login, logout,
      balance, refreshBalance, refreshWallet, transactions,
      authLoading, balanceLoading, balanceError,
      transactionsLoading, transactionsError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
