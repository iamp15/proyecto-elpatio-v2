import { Outlet, useLocation } from 'react-router-dom';
import TabBar from './TabBar';
import styles from './MainLayout.module.css';
import useTelegramBackButton from '../../hooks/useTelegramBackButton';

const isGameRoute = (path) => /^\/juegos\/domino\/[^/]+$/.test(path);

export default function MainLayout() {
  useTelegramBackButton();
  const { pathname } = useLocation();
  const isGame = isGameRoute(pathname);

  return (
    <div className={`${styles.container} ${isGame ? styles.containerGame : ''}`}>
      <main className={`${styles.content} ${isGame ? styles.contentGame : ''}`}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
