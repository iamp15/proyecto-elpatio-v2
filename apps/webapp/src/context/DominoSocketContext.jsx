import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useSplashPhase } from './SplashPhaseContext';
import { attachDominoSocketHeartbeat } from '../pages/Juegos/domino/attachDominoSocketHeartbeat';

const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || 'http://localhost:3001';

const DominoSocketContext = createContext(null);

/**
 * Socket único a /domino: lobby, cola, handshake reconnect_game y mesa comparten conexión.
 */
export function DominoSocketProvider({ children }) {
  const { token } = useAuth();
  const { phase } = useSplashPhase();
  const navigate = useNavigate();
  const location = useLocation();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  /** null = aún no llegó init_lobby_config */
  const [lobbyServerCategories, setLobbyServerCategories] = useState(null);
  const [pendingReconnectRoomId, setPendingReconnectRoomId] = useState(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const lobbyConfigWaitersRef = useRef(null);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  useEffect(() => {
    if (lobbyServerCategories !== null && lobbyConfigWaitersRef.current) {
      const resolve = lobbyConfigWaitersRef.current;
      lobbyConfigWaitersRef.current = null;
      resolve();
    }
  }, [lobbyServerCategories]);

  const waitForLobbyConfig = useCallback(() => {
    if (lobbyServerCategories !== null) return Promise.resolve();
    return new Promise((resolve) => {
      lobbyConfigWaitersRef.current = resolve;
    });
  }, [lobbyServerCategories]);

  const clearPendingReconnect = useCallback(() => {
    setPendingReconnectRoomId(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setLobbyServerCategories(null);
      setPendingReconnectRoomId(null);
      if (lobbyConfigWaitersRef.current) {
        lobbyConfigWaitersRef.current();
        lobbyConfigWaitersRef.current = null;
      }
      setConnected(false);
      setReconnecting(false);
      setSocket(null);
      return undefined;
    }

    const s = io(`${GAME_SERVER_URL}/domino`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    attachDominoSocketHeartbeat(s);

    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
    };
    const onDisconnect = () => {
      setConnected(false);
    };
    const onReconnectAttempt = () => {
      setReconnecting(true);
    };
    const onInitLobbyConfig = ({ categories }) => {
      setLobbyServerCategories(categories ?? []);
    };
    const onReconnectGame = (payload) => {
      const id = payload?.roomId;
      if (!id) return;
      const targetPath = `/juegos/domino/${id}`;
      // No pisar la ruta si ya estamos en la mesa (p. ej. acabas de entrar con fromMatchmaking
      // para el versus; un reconnect_game del handshake no debe borrar ese state).
      if (pathnameRef.current === targetPath) {
        return;
      }
      if (phaseRef.current === 'splash') {
        setPendingReconnectRoomId(String(id));
        return;
      }
      navigateRef.current(targetPath, {
        replace: true,
        state: { fromReconnect: true },
      });
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('reconnect_attempt', onReconnectAttempt);
    s.on('init_lobby_config', onInitLobbyConfig);
    s.on('reconnect_game', onReconnectGame);

    setSocket(s);
    if (s.connected) {
      setConnected(true);
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('reconnect_attempt', onReconnectAttempt);
      s.off('init_lobby_config', onInitLobbyConfig);
      s.off('reconnect_game', onReconnectGame);
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setReconnecting(false);
    };
  }, [token]);

  const value = useMemo(
    () => ({
      socket,
      connected,
      reconnecting,
      lobbyServerCategories,
      pendingReconnectRoomId,
      clearPendingReconnect,
      waitForLobbyConfig,
    }),
    [
      socket,
      connected,
      reconnecting,
      lobbyServerCategories,
      pendingReconnectRoomId,
      clearPendingReconnect,
      waitForLobbyConfig,
    ],
  );

  return (
    <DominoSocketContext.Provider value={value}>{children}</DominoSocketContext.Provider>
  );
}

export function useDominoSocket() {
  const ctx = useContext(DominoSocketContext);
  if (!ctx) {
    throw new Error('useDominoSocket debe usarse dentro de DominoSocketProvider');
  }
  return ctx;
}
