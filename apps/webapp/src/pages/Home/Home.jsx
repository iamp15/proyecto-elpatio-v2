import { useUser } from '../../context/UserContext';
import { useBalance } from '../../hooks/useBalance';
import styles from './Home.module.css';

export default function Home() {
  const { user, logout } = useUser();
  const { piedras, loading, error } = useBalance();
  const username = user?.username ?? 'Usuario';

  return (
    <div className={styles.root}>
      <h1>Home</h1>
      {loading && <p>Cargando…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {!loading && !error && piedras != null && (
        <p>Hola, {username}, tu balance es {piedras} piedras.</p>
      )}
      {user && (
        <button type="button" className={styles.logoutBtn} onClick={logout}>
          Cerrar sesión
        </button>
      )}
    </div>
  );
}
