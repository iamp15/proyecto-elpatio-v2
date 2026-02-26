import { useAuth } from '../../../hooks/useAuth';
import { IconArrowDown, IconArrowUp } from './WalletIcons';
import styles from './WalletActivitySection.module.css';

const SKELETON_COUNT = 4;

function SkeletonItem({ isLast }) {
  return (
    <div className={`${styles.item}${isLast ? ` ${styles.itemLast}` : ''}`} aria-hidden>
      <span className={styles.skeletonIcon} />
      <div className={styles.itemMain}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonMeta} />
      </div>
      <div className={styles.skeletonAmount} />
    </div>
  );
}

const TYPE_LABELS = {
  DEPOSIT:    'Recarga',
  WITHDRAW:   'Retiro',
  BET:        'Apuesta',
  WIN:        'Partida Ganada',
  REFUND:     'Reembolso',
  COMMISSION: 'Comisión',
};

function formatDateTime(iso) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function formatAmount(amount_subunits) {
  if (amount_subunits == null || Number.isNaN(Number(amount_subunits))) return '—';
  const piedras = Number(amount_subunits) / 100;
  const sign = piedras > 0 ? '+' : '';
  return `${sign}${piedras % 1 === 0 ? piedras : piedras.toFixed(2)}`;
}

export default function WalletActivitySection() {
  const { transactions, transactionsLoading, transactionsError } = useAuth();

  return (
    <section className={styles.root} aria-label="Actividad reciente">
      <h2 className={styles.heading}>Actividad Reciente</h2>

      <div className={`surface-card ${styles.card}`}>
        {transactionsLoading && Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <SkeletonItem key={i} isLast={i === SKELETON_COUNT - 1} />
        ))}

        {!transactionsLoading && transactionsError && (
          <p className={styles.empty}>{transactionsError}</p>
        )}

        {!transactionsLoading && !transactionsError && transactions.length === 0 && (
          <p className={styles.empty}>Aún no hay movimientos.</p>
        )}

        {!transactionsLoading && transactions.map((tx, idx) => {
          const isLast = idx === transactions.length - 1;
          const isPositive = Number(tx.amount_subunits) > 0;
          const Icon = isPositive ? IconArrowUp : IconArrowDown;
          const label = TYPE_LABELS[tx.type] ?? tx.type;

          return (
            <div
              key={tx._id}
              className={`${styles.item}${isLast ? ` ${styles.itemLast}` : ''}`}
            >
              <span
                className={`${styles.itemIcon}${isPositive ? ` ${styles.itemIconPositive}` : ` ${styles.itemIconNegative}`}`}
                aria-hidden
              >
                <Icon size={16} />
              </span>

              <div className={styles.itemMain}>
                <div className={styles.itemTitle}>{label}</div>
                <div className={styles.itemMeta}>{formatDateTime(tx.createdAt)}</div>
              </div>

              <div className={`${styles.amount}${isPositive ? ` ${styles.amountPositive}` : ` ${styles.amountNegative}`}`}>
                {formatAmount(tx.amount_subunits)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
