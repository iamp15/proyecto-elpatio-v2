import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { triggerHaptic } from '../../lib/telegram';
import balanceIcon from '../../assets/icono-piedras-sinfondo.png';
import styles from './UserHeader.module.css';

export default function UserHeader() {
  const navigate = useNavigate();
  const { user, balance } = useAuth();

  const displayName = user?.first_name ?? user?.username ?? 'jugador';
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
        aria-label="Ver perfil"
      >
        {user?.photo_url ? (
          <img src={user.photo_url} alt={initial} className={styles.avatarImg} />
        ) : (
          <span className={styles.avatarInitials}>{initial}</span>
        )}
      </button>

      <span className={styles.greeting}>
        Hola, <span className={styles.name}>{displayName}</span>!
      </span>

      <button
        type="button"
        className={`glass-card ${styles.balanceCapsule}`}
        onClick={() => navigate('/wallet')}
        aria-label="Ver billetera"
      >
        <img src={balanceIcon} alt="" aria-hidden className={styles.balanceIcon} />
        <span className={styles.balanceAmount}>{balance ?? '—'}</span>
      </button>
    </div>
  );
}
