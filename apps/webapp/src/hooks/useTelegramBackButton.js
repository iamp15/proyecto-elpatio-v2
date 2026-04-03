import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  showBackButton,
  hideBackButton,
  onBackButtonClick,
  offBackButtonClick,
} from '../lib/telegram';

const MAIN_ROUTES = new Set(['/', '/wallet', '/settings']);

const DOMINO_LOBBY_PATH = '/lobby-domino';

/** Partida de dominó en curso (misma regla que MainLayout `isGameRoute`). */
function isDominoGameBoardPath(pathname) {
  return /^\/juegos\/domino\/[^/]+$/.test(pathname);
}

export default function useTelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    const isMainRoute = MAIN_ROUTES.has(location.pathname);
    const hideBack =
      isMainRoute ||
      location.pathname === DOMINO_LOBBY_PATH ||
      isDominoGameBoardPath(location.pathname);

    if (hideBack) {
      hideBackButton();
      offBackButtonClick(handleBack);
    } else {
      onBackButtonClick(handleBack);
      showBackButton();
    }

    return () => {
      offBackButtonClick(handleBack);
    };
  }, [location.pathname, handleBack]);
}
