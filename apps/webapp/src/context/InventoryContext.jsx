import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { mapServerInventoryToUi } from '../lib/inventory/inventoryDisplayMeta';

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  const { api, token, refreshUser } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState(null);

  const refreshInventory = useCallback(async () => {
    if (!token) {
      setInventory([]);
      setInventoryError(null);
      setInventoryLoading(false);
      return [];
    }

    setInventoryLoading(true);
    setInventoryError(null);

    try {
      const data = await api.request('GET', '/api/inventory');
      const rows = Array.isArray(data?.inventory) ? data.inventory : [];
      const mappedInventory = mapServerInventoryToUi(rows);
      setInventory(mappedInventory);
      return mappedInventory;
    } catch (e) {
      setInventoryError(e?.message || 'Error al cargar inventario');
      setInventory([]);
      return [];
    } finally {
      setInventoryLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    if (!token) {
      setInventory([]);
      setInventoryError(null);
      setInventoryLoading(false);
      return;
    }

    let canceled = false;

    (async () => {
      const nextInventory = await refreshInventory();
      if (!canceled) setInventory(nextInventory);
    })();

    return () => {
      canceled = true;
    };
  }, [token, refreshInventory]);

  const handleEquipItem = useCallback(
    async (id) => {
      try {
        const data = await api.request('POST', '/api/inventory/equip', { body: { itemId: id } });
        const rows = Array.isArray(data?.inventory) ? data.inventory : [];
        setInventory(mapServerInventoryToUi(rows));
        await refreshUser();
      } catch (e) {
        console.error('[inventory] equip failed', e);
        throw e;
      }
    },
    [api, refreshUser],
  );

  const handleActivateItem = useCallback(
    async (id) => {
      try {
        const data = await api.request('POST', '/api/inventory/activate', { body: { itemId: id } });
        const rows = Array.isArray(data?.inventory) ? data.inventory : [];
        setInventory(mapServerInventoryToUi(rows));
        await refreshUser();
      } catch (e) {
        console.error('[inventory] activate failed', e);
        throw e;
      }
    },
    [api, refreshUser],
  );

  const value = useMemo(
    () => ({
      inventory,
      inventoryLoading,
      inventoryError,
      refreshInventory,
      handleEquipItem,
      handleActivateItem,
    }),
    [inventory, inventoryLoading, inventoryError, refreshInventory, handleEquipItem, handleActivateItem],
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) {
    throw new Error('useInventory debe usarse dentro de InventoryProvider');
  }
  return ctx;
}
