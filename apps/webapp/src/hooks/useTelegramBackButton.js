import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  showBackButton,
  hideBackButton,
  onBackButtonClick,
  offBackButtonClick,
  onWebAppEvent,
  offWebAppEvent,
} from '../lib/telegram';

const BACK_BUTTON_CLICKED_EVENT = 'backButtonClicked';

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

  const handleLobbyBack = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    const isMainRoute = MAIN_ROUTES.has(location.pathname);
    const isLobby = location.pathname === DOMINO_LOBBY_PATH;
    const hideBack = isMainRoute || isDominoGameBoardPath(location.pathname);

    if (hideBack) {
      hideBackButton();
      offBackButtonClick(handleBack);
      offWebAppEvent(BACK_BUTTON_CLICKED_EVENT, handleLobbyBack);
    } else if (isLobby) {
      offBackButtonClick(handleBack);
      showBackButton();
      onWebAppEvent(BACK_BUTTON_CLICKED_EVENT, handleLobbyBack);
    } else {
      offWebAppEvent(BACK_BUTTON_CLICKED_EVENT, handleLobbyBack);
      onBackButtonClick(handleBack);
      showBackButton();
    }

    return () => {
      offBackButtonClick(handleBack);
      offWebAppEvent(BACK_BUTTON_CLICKED_EVENT, handleLobbyBack);
    };
  }, [location.pathname, handleBack, handleLobbyBack]);
}
