import { useAuth } from '../../../hooks/useAuth';
import stonesIcon from '../../../assets/icono-piedras-sinfondo.png';
import styles from './WalletBalanceSection.module.css';

function formatBalance(balance) {
  if (balance == null || Number.isNaN(Number(balance))) return '—';
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number(balance));
}

export default function WalletBalanceSection() {
  const { balance } = useAuth();

  return (
    <section className={styles.root} aria-label="Balance">
      <div className={styles.amount}>{formatBalance(balance)}</div>
      <div className={styles.captionRow}>
        <img className={styles.captionIcon} src={stonesIcon} alt="" aria-hidden />
        <span className={styles.captionText}>Piedras Disponibles</span>
      </div>
    </section>
  );
}

