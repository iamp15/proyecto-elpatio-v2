import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import styles from './MainLayout.module.css';
import useTelegramBackButton from '../../hooks/useTelegramBackButton';

export default function MainLayout() {
  useTelegramBackButton();

  return (
    <div className={styles.container}>
      <main className={styles.content}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
