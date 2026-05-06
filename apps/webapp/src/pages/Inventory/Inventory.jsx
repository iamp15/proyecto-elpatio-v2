import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import BackHomeButton from '../../components/navigation/BackHomeButton';
import InventoryDetailSheet from './components/InventoryDetailSheet';
import { isVipUser } from '../../lib/vipUserUi';
import styles from './Inventory.module.css';

const TAB_CONSUMABLES = 'consumables';
const TAB_COSMETICS = 'cosmetics';

export default function Inventory() {
  const { inventory, inventoryLoading, inventoryError } = useInventory();
  const { user } = useAuth();
  const [tab, setTab] = useState(TAB_CONSUMABLES);
  const [selectedId, setSelectedId] = useState(null);
  const hasActiveVip = isVipUser(user);

  const items = useMemo(() => {
    if (tab === TAB_CONSUMABLES) {
      return inventory.filter((i) => i.category === 'consumable');
    }
    return inventory.filter((i) => i.category === 'cosmetic');
  }, [inventory, tab]);

  const selectedItem = useMemo(
    () => (selectedId ? inventory.find((i) => i.id === selectedId) ?? null : null),
    [inventory, selectedId],
  );

  return (
    <div className={styles.root}>
      <p className={styles.eyebrow}>El Patio Dominó</p>
      <h1 className={styles.title}>Mochila</h1>

      <div className={styles.tabs} role="tablist" aria-label="Categorías de inventario">
        <button
          type="button"
          role="tab"
          aria-selected={tab === TAB_CONSUMABLES}
          className={`${styles.tabButton} ${tab === TAB_CONSUMABLES ? styles.tabButtonActive : ''}`}
          onClick={() => {
            setTab(TAB_CONSUMABLES);
            setSelectedId(null);
          }}
        >
          Consumibles
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === TAB_COSMETICS}
          className={`${styles.tabButton} ${tab === TAB_COSMETICS ? styles.tabButtonActive : ''}`}
          onClick={() => {
            setTab(TAB_COSMETICS);
            setSelectedId(null);
          }}
        >
          Cosméticos
        </button>
      </div>

      {inventoryLoading && inventory.length === 0 ? (
        <p className={styles.empty}>Cargando inventario…</p>
      ) : inventoryError ? (
        <p className={styles.empty}>{inventoryError}</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No hay ítems en esta categoría.</p>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => {
            const isLocked = item.requirement === 'vip_active' && !hasActiveVip;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.card} ${item.category === 'cosmetic' && item.isEquipped ? styles.cardEquipped : ''} ${isLocked ? styles.cardLocked : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                {isLocked && (
                  <span className={styles.lockBadge} aria-label="Bloqueado hasta renovar VIP">
                    🔒
                  </span>
                )}
                {item.category === 'consumable' && typeof item.quantity === 'number' && (
                  <span className={styles.quantityBadge} aria-label={`Cantidad: ${item.quantity}`}>
                    {item.quantity}
                  </span>
                )}
                <span className={styles.cardIcon} aria-hidden>
                  {item.iconUrl ? (
                    <img src={item.iconUrl} alt="" className={styles.cardIconImg} />
                  ) : (
                    item.icon
                  )}
                </span>
                <p className={styles.cardName}>{item.name}</p>
                {item.category === 'cosmetic' && item.isEquipped && (
                  <span className={styles.equippedLabel}>Equipado</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <InventoryDetailSheet
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedId(null)}
      />
      <BackHomeButton />
    </div>
  );
}
