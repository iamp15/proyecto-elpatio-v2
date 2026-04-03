import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { attachDominoSocketHeartbeat } from '../pages/Juegos/domino/attachDominoSocketHeartbeat';

const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || 'http://localhost:3001';

const DominoSocketContext = createContext(null);

/**
 * Una sola conexión Socket.io al namespace /domino por sesión autenticada.
 * Mantiene categorías del lobby (init_lobby_config) y navegación por reconnect_game.
 */
export function DominoSocketProvider({ children }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  /** null = aún no llegó init_lobby_config */
  const [lobbyServerCategories, setLobbyServerCategories] = useState(null);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!token) {
      setLobbyServerCategories(null);
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
      navigateRef.current(`/juegos/domino/${id}`, {
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
    }),
    [socket, connected, reconnecting, lobbyServerCategories],
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
