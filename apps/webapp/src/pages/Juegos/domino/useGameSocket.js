import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || 'http://localhost:3001';

/**
 * Hook para la página de juego activo (/juegos/domino/:roomId).
 *
 * Al conectar, emite automáticamente rejoin_room(roomId) para recuperar
 * el estado actual de la partida sin rehacer el matchmaking.
 *
 * @param {{
 *   token:       string | null,
 *   roomId:      string,
 *   onRejoined:  (payload: object) => void,
 *   onGameState: (state: object) => void,
 *   onGameOver:  (payload: object) => void,
 *   onRoundOver: (payload: object) => void,
 *   onChatMessage: (payload: object) => void,
 *   onInvalidMove: (payload: object) => void,
 *   onError:     (payload: object) => void,
 * }} options
 *
 * @returns {{
 *   connected:   boolean,
 *   reconnecting: boolean,
 *   sendAction:  (actionType: string, data?: object) => void,
 *   sendChat:    (type: string, content: string) => void,
 * }}
 */
export function useGameSocket({
  token,
  roomId,
  onRejoined,
  onGameState,
  onGameOver,
  onPRUpdated,
  onRoundOver,
  onChatMessage,
  onInvalidMove,
  onError,
}) {
  const socketRef     = useRef(null);
  const [connected,   setConnected]   = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Callbacks estables en refs para evitar re-subscripciones por cambio de referencia
  const onRejoinedRef    = useRef(onRejoined);
  const onGameStateRef   = useRef(onGameState);
  const onGameOverRef    = useRef(onGameOver);
  const onPRUpdatedRef   = useRef(onPRUpdated);
  const onRoundOverRef   = useRef(onRoundOver);
  const onChatMessageRef = useRef(onChatMessage);
  const onInvalidMoveRef = useRef(onInvalidMove);
  const onErrorRef       = useRef(onError);

  useEffect(() => { onRejoinedRef.current    = onRejoined;    }, [onRejoined]);
  useEffect(() => { onGameStateRef.current   = onGameState;   }, [onGameState]);
  useEffect(() => { onGameOverRef.current    = onGameOver;    }, [onGameOver]);
  useEffect(() => { onPRUpdatedRef.current   = onPRUpdated;   }, [onPRUpdated]);
  useEffect(() => { onRoundOverRef.current   = onRoundOver;   }, [onRoundOver]);
  useEffect(() => { onChatMessageRef.current  = onChatMessage; }, [onChatMessage]);
  useEffect(() => { onInvalidMoveRef.current = onInvalidMove; }, [onInvalidMove]);
  useEffect(() => { onErrorRef.current       = onError;       }, [onError]);

  useEffect(() => {
    if (!token || !roomId) return;

    const socket = io(`${GAME_SERVER_URL}/domino`, {
      auth:              { token },
      transports:        ['websocket'],
      reconnection:      true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      // Al conectar (o reconectar tras reload), solicitar el estado actual de la sala
      socket.emit('rejoin_room', { roomId });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('reconnect_attempt', () => {
      setReconnecting(true);
    });

    socket.on('game_rejoined', (payload) => {
      setReconnecting(false);
      onRejoinedRef.current?.(payload);
    });

    socket.on('game_state', (state) => {
      onGameStateRef.current?.(state);
    });

    socket.on('game_over', (payload) => {
      onGameOverRef.current?.(payload);
    });

    socket.on('pr_updated', (payload) => {
      onPRUpdatedRef.current?.(payload);
    });

    socket.on('round_over', (payload) => {
      onRoundOverRef.current?.(payload);
    });

    socket.on('chat_message', (payload) => {
      onChatMessageRef.current?.(payload);
    });

    socket.on('invalid_move', (payload) => {
      onInvalidMoveRef.current?.(payload);
    });

    socket.on('rejoin_error', (payload) => {
      onErrorRef.current?.(payload);
    });

    socket.on('error', (payload) => {
      onErrorRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setReconnecting(false);
    };
  }, [token, roomId]);

  const sendAction = useCallback((actionType, data = {}) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('game_action', { actionType, ...data });
    }
  }, []);

  const sendChat = useCallback((type, content) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_chat', { type, content });
    }
  }, []);

  return { connected, reconnecting, sendAction, sendChat };
}
