import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { triggerHaptic } from '../../lib/telegram';
import balanceIcon from '../../assets/icono-piedras-2.png';
import styles from './UserHeader.module.css';

export default function UserHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, balance } = useAuth();

  const displayName = user?.first_name ?? user?.username ?? t('userHeader.defaultPlayer');
  const initial = displayName.charAt(0).toUpperCase();

  function handleProfileClick() {
    triggerHaptic('light');
    navigate('/profile');
  }

  return (
    <div className={`surface-card ${styles.header}`}>
      <button
        type="button"
        className={styles.avatar}
        onClick={handleProfileClick}
        aria-label={t('userHeader.viewProfile')}
      >
        {user?.photo_url ? (
          <img src={user.photo_url} alt={initial} className={styles.avatarImg} />
        ) : (
          <span className={styles.avatarInitials}>{initial}</span>
        )}
      </button>

      <span className={styles.greeting}>
        {t('userHeader.helloPrefix')}<span className={styles.name}>{displayName}</span>{t('userHeader.helloSuffix')}
      </span>

      <button
        type="button"
        className={`glass-card ${styles.balanceCapsule}`}
        onClick={() => navigate('/wallet')}
        aria-label={t('userHeader.viewWallet')}
      >
        <img src={balanceIcon} alt="" aria-hidden className={styles.balanceIcon} />
        <span className={styles.balanceAmount}>{balance ?? '—'}</span>
      </button>
    </div>
  );
}
