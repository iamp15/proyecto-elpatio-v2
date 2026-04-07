import { Outlet } from 'react-router-dom';
import styles from './MainLayout.module.css';
import useTelegramBackButton from '../../hooks/useTelegramBackButton';

export default function MainLayout() {
  useTelegramBackButton();

  return (
    <div className={`${styles.container} ${styles.containerDominoTheme}`}>
      <main className={`${styles.content} ${styles.contentDominoTheme}`}>
        <Outlet />
      </main>
    </div>
  );
}
