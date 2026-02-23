import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { getBalance } from '../api/balance.js';

export function useBalance() {
  const { token } = useUser();
  const [piedras, setPiedras] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBalance = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setPiedras(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getBalance(token);
      setPiedras(data.piedras ?? null);
    } catch (e) {
      setError(e?.body?.error || e?.message || 'Error al cargar balance');
      setPiedras(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { piedras, loading, error, refetch: fetchBalance };
}
