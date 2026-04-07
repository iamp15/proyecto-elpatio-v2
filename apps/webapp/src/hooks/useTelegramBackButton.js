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

const HOME_ROUTE = '/';
const PLAY_ROUTE_PREFIX = '/play/';

const SECONDARY_ROUTES = new Set(['/ligas', '/tienda', '/torneos', '/perfil']);

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
    const isHome = location.pathname === HOME_ROUTE;
    const isPlay = location.pathname.startsWith(PLAY_ROUTE_PREFIX);
    const isSecondaryRoute = SECONDARY_ROUTES.has(location.pathname);

    if (isHome || isPlay) {
      hideBackButton();
      offBackButtonClick(handleBack);
      offWebAppEvent(BACK_BUTTON_CLICKED_EVENT, handleLobbyBack);
    } else if (isSecondaryRoute) {
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
