import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Juegos.module.css';
import UserHeader from './UserHeader';

export default function Juegos() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className={styles.root}>
      <UserHeader />
      {/* Tarjeta principal — Dominó */}
      <div className={`surface-card ${styles.cardMain}`}>
        <div className={styles.cardBadge}>{t('juegos.available')}</div>
        <div className={styles.cardIcon} aria-hidden>🁣</div>
        <div className={styles.cardBody}>
          <h2 className={styles.cardTitle}>{t('juegos.domino')}</h2>
          <p className={styles.cardDescription}>
            {t('juegos.dominoDescription')}
          </p>
        </div>
        <button type="button" className={`action-button ${styles.cardButton}`} onClick={() => navigate('/lobby-domino')}>
          {t('juegos.playNow')}
        </button>
      </div>

      {/* Tarjeta secundaria — próximamente */}
      <div className={`surface-card ${styles.cardSecondary}`} aria-disabled="true">
        <span className={styles.soon}>{t('juegos.moreGamesComing')}</span>
      </div>
    </div>
  );
}
