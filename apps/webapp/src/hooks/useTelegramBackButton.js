import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  showBackButton,
  hideBackButton,
  onBackButtonClick,
  offBackButtonClick,
} from '../lib/telegram';

const MAIN_ROUTES = new Set(['/', '/wallet', '/settings']);

export default function useTelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    const isMainRoute = MAIN_ROUTES.has(location.pathname);

    if (isMainRoute) {
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
