import { useTranslation } from 'react-i18next';
import { triggerHaptic } from '../../../lib/telegram';
import { IconArrowDown, IconClock, IconPlus } from './WalletIcons';
import styles from './WalletQuickActions.module.css';

const actions = [
  { id: 'topup', labelKey: 'wallet.topUp', Icon: IconPlus },
  { id: 'withdraw', labelKey: 'wallet.withdraw', Icon: IconArrowDown },
  { id: 'history', labelKey: 'wallet.history', Icon: IconClock },
];

export default function WalletQuickActions() {
  const { t } = useTranslation();
  return (
    <section className={styles.root} aria-label={t('wallet.quickActionsLabel')}>
      {actions.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          type="button"
          className={styles.action}
          onClick={() => triggerHaptic('light')}
        >
          <span className={styles.iconCircle} aria-hidden>
            <Icon size={13} />
          </span>
          <span className={styles.label}>{t(labelKey)}</span>
        </button>
      ))}
    </section>
  );
}

