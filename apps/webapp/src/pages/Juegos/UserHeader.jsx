import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { triggerHaptic } from '../../lib/telegram';
import balanceIcon from '../../assets/icono-piedras-2.png';
import PlayerAvatar from '../../components/PlayerAvatar';
import { resolveDisplayName } from '../../lib/userDisplayName';
import styles from './UserHeader.module.css';

export default function UserHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, balance } = useAuth();

  const displayName = resolveDisplayName(user, t('userHeader.defaultPlayer'));

  function handleProfileClick() {
    triggerHaptic('light');
    navigate('/perfil');
  }

  return (
    <div className={styles.header}>
      <button
        type="button"
        className={styles.avatar}
        onClick={handleProfileClick}
        aria-label={t('userHeader.viewProfile')}
      >
        <PlayerAvatar
          user={user}
          size="small"
          showName={false}
        />
      </button>

      <span className={styles.greeting}>
        {t('userHeader.helloPrefix')}<span className={styles.name}>{displayName}</span>{t('userHeader.helloSuffix')}
      </span>

      <button
        type="button"
        className={styles.balanceCapsule}
        onClick={() => navigate('/wallet')}
        aria-label={t('userHeader.viewWallet')}
      >
        <img src={balanceIcon} alt="" aria-hidden className={styles.balanceIcon} />
        <span className={styles.balanceAmount}>{balance ?? '—'}</span>
      </button>
    </div>
  );
}
