import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useInventory } from '../../../context/InventoryContext';
import {
  isActiveConsumableItem,
  isPassiveLeagueCouponItem,
  PASSIVE_LEAGUE_COUPON_HINT,
} from '../../../lib/inventory/inventoryDisplayMeta';
import { isVipUser } from '../../../lib/vipUserUi';
import styles from './InventoryDetailSheet.module.css';

export default function InventoryDetailSheet({ item, isOpen, onClose }) {
  const { handleEquipItem, handleActivateItem } = useInventory();
  const { user } = useAuth();
  const isLocked = item?.requirement === 'vip_active' && !isVipUser(user);

  const handleBackdropClick = () => {
    onClose();
  };

  const handleCosmeticEquipClick = async () => {
    if (!item || item.category !== 'cosmetic' || isLocked) return;
    try {
      await handleEquipItem(item.id);
    } catch {
      /* error ya logueado en contexto */
    }
  };

  const handleActivateClick = async () => {
    if (!item || isLocked) return;
    try {
      await handleActivateItem(item.id);
    } catch {
      /* error ya logueado en contexto */
    }
  };

  return (
    <AnimatePresence>
      {isOpen && item && (
        <motion.div
          key="inv-detail"
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={handleBackdropClick}
          role="presentation"
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-detail-title"
          >
            <div className={styles.header}>
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className={styles.scroll}>
              <div className={styles.iconWrap}>
                <span className={styles.iconLarge} aria-hidden>
                  {item.iconUrl ? (
                    <img src={item.iconUrl} alt="" className={styles.iconLargeImg} />
                  ) : (
                    item.icon
                  )}
                </span>
              </div>
              <h2 id="inventory-detail-title" className={styles.title}>
                {item.name}
              </h2>
              <p className={styles.description}>{item.description}</p>

              {isLocked && (
                <p className={styles.lockedHint}>
                  🔒 Ítem bloqueado: renueva tu VIP para volver a usarlo.
                </p>
              )}

              {item.category === 'cosmetic' && (
                <button
                  type="button"
                  className={`${styles.actionButton} ${item.isEquipped ? styles.actionButtonSecondary : ''}`}
                  onClick={handleCosmeticEquipClick}
                  disabled={isLocked}
                >
                  {item.isEquipped ? 'Desequipar' : 'Equipar'}
                </button>
              )}

              {item.category === 'consumable' && isActiveConsumableItem(item) && (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={handleActivateClick}
                  disabled={isLocked}
                >
                  Activar
                </button>
              )}

              {item.category === 'consumable' && isPassiveLeagueCouponItem(item) && (
                <p className={styles.passiveHint}>{PASSIVE_LEAGUE_COUPON_HINT}</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
