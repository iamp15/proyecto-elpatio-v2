import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { attachDominoSocketHeartbeat } from '../pages/Juegos/domino/attachDominoSocketHeartbeat';

const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || 'http://localhost:3001';

const isDominoBoardPath = (pathname) => /^\/juegos\/domino\/[^/]+$/.test(pathname);

/**
 * Conexión ligera al namespace /domino en rutas que no tienen ya un socket de partida o lobby.
 * Si el servidor detecta partida IN_GAME, emite reconnect_game → navegación al tablero.
 */
export default function DominoSessionSync() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    const { pathname } = location;
    if (isDominoBoardPath(pathname)) return;
    if (pathname === '/lobby-domino') return;

    const socket = io(`${GAME_SERVER_URL}/domino`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 8,
    });
    socketRef.current = socket;
    attachDominoSocketHeartbeat(socket);

    socket.on('reconnect_game', (payload) => {
      const id = payload?.roomId;
      if (!id) return;
      navigate(`/juegos/domino/${id}`, {
        replace: true,
        state: { fromReconnect: true },
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, location.pathname, navigate]);

  return null;
}
