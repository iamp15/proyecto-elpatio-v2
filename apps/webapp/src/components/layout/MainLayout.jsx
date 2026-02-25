import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import styles from './MainLayout.module.css';

export default function MainLayout() {
  return (
    <div className={styles.container}>
      <header className={styles.header} aria-label="Cabecera">
        <h1 className={styles.title}>El Patio</h1>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
