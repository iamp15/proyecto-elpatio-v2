import { useTranslation } from 'react-i18next';
import { ITEM_CATALOG } from '../../../lib/inventory/itemCatalog';
import styles from '../Store.module.css';

export default function StoreVipItemRewardModal({
  reward,
  currentIndex,
  totalCount,
  onAccept,
}) {
  const { t } = useTranslation();
  if (!reward) return null;

  const isStoneReward = reward.itemId === '__stones__';
  const catalog = isStoneReward ? null : ITEM_CATALOG[reward.itemId];
  const title = isStoneReward
    ? t('store.vipItemReward.stonesTitle')
    : catalog?.name || reward.itemId;
  const description = isStoneReward
    ? t('store.vipItemReward.stonesBody', { count: Number(reward.quantity) || 0 })
    : catalog?.description || t('store.vipItemReward.genericBody');
  const quantityLabel = Number(reward.quantity) > 1 && !isStoneReward
    ? t('store.vipItemReward.quantity', { count: reward.quantity })
    : null;

  return (
    <div
      className={styles.successModalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-vip-item-reward-title"
    >
      <section className={styles.successModal}>
        <p className={styles.vipItemRewardStep}>
          {t('store.vipItemReward.step', { current: currentIndex, total: totalCount })}
        </p>
        <div className={styles.successIconWrap}>
          {isStoneReward ? (
            <span className={styles.vipItemRewardEmoji} aria-hidden>
              💎
            </span>
          ) : catalog?.iconUrl ? (
            <img className={styles.vipItemRewardIcon} src={catalog.iconUrl} alt="" aria-hidden />
          ) : (
            <span className={styles.vipItemRewardEmoji} aria-hidden>
              {catalog?.fallbackEmoji || '🎁'}
            </span>
          )}
        </div>
        <h2 id="store-vip-item-reward-title" className={styles.successTitle}>
          {title}
        </h2>
        {quantityLabel ? (
          <p className={styles.vipItemRewardQuantity}>{quantityLabel}</p>
        ) : null}
        <p className={styles.successText}>{description}</p>
        <button type="button" className={styles.successButton} onClick={onAccept}>
          {t('store.vipItemReward.accept')}
        </button>
      </section>
    </div>
  );
}
