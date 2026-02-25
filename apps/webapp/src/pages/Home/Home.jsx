import { useAuth } from '../../hooks/useAuth';
import styles from './Home.module.css';

export default function Home() {
  const { user, balance, balanceLoading, balanceError, logout } = useAuth();
  const username = user?.username ?? 'Usuario';

  return (
    <div className={styles.root}>
      <h1>Home</h1>
      {balanceLoading && <p>Cargando…</p>}
      {balanceError && <p className={styles.error}>{balanceError}</p>}
      {!balanceLoading && !balanceError && balance != null && (
        <p>Hola, {username}, tu balance es {balance} piedras.</p>
      )}
      {user && (
        <button type="button" className={styles.logoutBtn} onClick={logout}>
          Cerrar sesión
        </button>
      )}
    </div>
  );
}
