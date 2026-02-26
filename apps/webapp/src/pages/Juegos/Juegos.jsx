import { useNavigate } from 'react-router-dom';
import styles from './Juegos.module.css';
import UserHeader from './UserHeader';

export default function Juegos() {
  const navigate = useNavigate();
  return (
    <div className={styles.root}>
      <UserHeader />
      {/* Tarjeta principal — Dominó */}
      <div className={`surface-card ${styles.cardMain}`}>
        <div className={styles.cardBadge}>Disponible</div>
        <div className={styles.cardIcon} aria-hidden>🁣</div>
        <div className={styles.cardBody}>
          <h2 className={styles.cardTitle}>Dominó</h2>
          <p className={styles.cardDescription}>
            Juega al dominó clásico con amigos en tiempo real. Apuesta tus piedras y demuestra quién domina la mesa.
          </p>
        </div>
        <button type="button" className={`action-button ${styles.cardButton}`} onClick={() => navigate('/lobby-domino')}>
          Jugar ahora
        </button>
      </div>

      {/* Tarjeta secundaria — próximamente */}
      <div className={`surface-card ${styles.cardSecondary}`} aria-disabled="true">
        <span className={styles.soon}>Más juegos próximamente…</span>
      </div>
    </div>
  );
}
