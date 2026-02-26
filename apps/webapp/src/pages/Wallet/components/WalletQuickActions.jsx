import { triggerHaptic } from '../../../lib/telegram';
import { IconArrowDown, IconClock, IconPlus } from './WalletIcons';
import styles from './WalletQuickActions.module.css';

const actions = [
  { id: 'topup', label: 'Recargar', Icon: IconPlus },
  { id: 'withdraw', label: 'Retirar', Icon: IconArrowDown },
  { id: 'history', label: 'Historial', Icon: IconClock },
];

export default function WalletQuickActions() {
  return (
    <section className={styles.root} aria-label="Acciones rápidas">
      {actions.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={styles.action}
          onClick={() => triggerHaptic('light')}
        >
          <span className={styles.iconCircle} aria-hidden>
            <Icon size={13} />
          </span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </section>
  );
}

