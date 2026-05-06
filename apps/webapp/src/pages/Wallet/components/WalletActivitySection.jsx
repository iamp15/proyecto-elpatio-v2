import { useTranslation } from 'react-i18next';
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

const TYPE_KEYS = {
  DEPOSIT:               'walletActivity.deposit',
  WITHDRAW:              'walletActivity.withdraw',
  BET:                   'walletActivity.bet',
  WIN:                   'walletActivity.win',
  REFUND:                'walletActivity.refund',
  COMMISSION:            'walletActivity.commission',
  FEE_PAID_WITH_COUPON:  'walletActivity.feePaidWithCoupon',
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
  const stones = Math.floor(Number(amount_subunits) / 100);
  const sign = stones > 0 ? '+' : '';
  return `${sign}${stones}`;
}

export default function WalletActivitySection() {
  const { t } = useTranslation();
  const { transactions, transactionsLoading, transactionsError } = useAuth();

  return (
    <section className={styles.root} aria-label={t('walletActivity.label')}>
      <h2 className={styles.heading}>{t('walletActivity.recentActivity')}</h2>

      <div className={`surface-card ${styles.card}`}>
        {transactionsLoading && Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <SkeletonItem key={i} isLast={i === SKELETON_COUNT - 1} />
        ))}

        {!transactionsLoading && transactionsError && (
          <p className={styles.empty}>{transactionsError}</p>
        )}

        {!transactionsLoading && !transactionsError && transactions.length === 0 && (
          <p className={styles.empty}>{t('walletActivity.noMovements')}</p>
        )}

        {!transactionsLoading && transactions.map((tx, idx) => {
          const isLast = idx === transactions.length - 1;
          const isCouponEntry = tx.type === 'FEE_PAID_WITH_COUPON';
          const isPositive = Number(tx.amount_subunits) > 0;
          const Icon = isCouponEntry || isPositive ? IconArrowUp : IconArrowDown;
          const label = TYPE_KEYS[tx.type] ? t(TYPE_KEYS[tx.type]) : tx.type;
          const iconModifier = isCouponEntry
            ? ` ${styles.itemIconPositive}`
            : isPositive
              ? ` ${styles.itemIconPositive}`
              : ` ${styles.itemIconNegative}`;

          return (
            <div
              key={tx._id}
              className={`${styles.item}${isLast ? ` ${styles.itemLast}` : ''}`}
            >
              <span
                className={`${styles.itemIcon}${iconModifier}`}
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
