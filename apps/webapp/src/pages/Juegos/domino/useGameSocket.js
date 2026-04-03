import { useEffect, useRef, useCallback } from 'react';
import { useDominoSocket } from '../../../context/DominoSocketContext';

/**
 * Suscripción al socket compartido (DominoSocketProvider) para la mesa activa.
 * No crea ni destruye la conexión; solo registra listeners y emite rejoin_room.
 */
export function useGameSocket({
  roomId,
  onRejoined,
  onGameState,
  onGameOver,
  onPRUpdated,
  onRoundOver,
  onChatMessage,
  onInvalidMove,
  onAutoPlayAction,
  onGameCancelled,
  onError,
}) {
  const { socket, connected, reconnecting } = useDominoSocket();
  const socketRef = useRef(socket);
  socketRef.current = socket;

  const onRejoinedRef = useRef(onRejoined);
  const onGameStateRef = useRef(onGameState);
  const onGameOverRef = useRef(onGameOver);
  const onPRUpdatedRef = useRef(onPRUpdated);
  const onRoundOverRef = useRef(onRoundOver);
  const onChatMessageRef = useRef(onChatMessage);
  const onInvalidMoveRef = useRef(onInvalidMove);
  const onAutoPlayActionRef = useRef(onAutoPlayAction);
  const onGameCancelledRef = useRef(onGameCancelled);
  const onErrorRef = useRef(onError);

  useEffect(() => { onRejoinedRef.current = onRejoined; }, [onRejoined]);
  useEffect(() => { onGameStateRef.current = onGameState; }, [onGameState]);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { onPRUpdatedRef.current = onPRUpdated; }, [onPRUpdated]);
  useEffect(() => { onRoundOverRef.current = onRoundOver; }, [onRoundOver]);
  useEffect(() => { onChatMessageRef.current = onChatMessage; }, [onChatMessage]);
  useEffect(() => { onInvalidMoveRef.current = onInvalidMove; }, [onInvalidMove]);
  useEffect(() => { onAutoPlayActionRef.current = onAutoPlayAction; }, [onAutoPlayAction]);
  useEffect(() => { onGameCancelledRef.current = onGameCancelled; }, [onGameCancelled]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!socket || !roomId) return undefined;

    const requestRejoin = () => {
      socket.emit('rejoin_room', { roomId });
    };

    const onGameRejoined = (payload) => {
      onRejoinedRef.current?.(payload);
    };

    const handleGameState = (state) => onGameStateRef.current?.(state);
    const handleGameOver = (payload) => onGameOverRef.current?.(payload);
    const handlePRUpdated = (payload) => onPRUpdatedRef.current?.(payload);
    const handleRoundOver = (payload) => onRoundOverRef.current?.(payload);
    const handleChatMessage = (payload) => onChatMessageRef.current?.(payload);
    const handleInvalidMove = (payload) => onInvalidMoveRef.current?.(payload);
    const handleAutoPlayAction = (payload) => onAutoPlayActionRef.current?.(payload);
    const handleGameCancelled = (payload) => onGameCancelledRef.current?.(payload);
    const handleRejoinError = (payload) => onErrorRef.current?.(payload);
    const handleSocketError = (payload) => onErrorRef.current?.(payload);

    const onSocketConnect = () => {
      requestRejoin();
    };

    socket.on('connect', onSocketConnect);
    socket.on('game_rejoined', onGameRejoined);
    socket.on('game_state', handleGameState);
    socket.on('game_over', handleGameOver);
    socket.on('pr_updated', handlePRUpdated);
    socket.on('round_over', handleRoundOver);
    socket.on('chat_message', handleChatMessage);
    socket.on('invalid_move', handleInvalidMove);
    socket.on('autoplay_action', handleAutoPlayAction);
    socket.on('game_cancelled', handleGameCancelled);
    socket.on('rejoin_error', handleRejoinError);
    socket.on('error', handleSocketError);

    if (socket.connected) {
      requestRejoin();
    }

    return () => {
      socket.off('connect', onSocketConnect);
      socket.off('game_rejoined', onGameRejoined);
      socket.off('game_state', handleGameState);
      socket.off('game_over', handleGameOver);
      socket.off('pr_updated', handlePRUpdated);
      socket.off('round_over', handleRoundOver);
      socket.off('chat_message', handleChatMessage);
      socket.off('invalid_move', handleInvalidMove);
      socket.off('autoplay_action', handleAutoPlayAction);
      socket.off('game_cancelled', handleGameCancelled);
      socket.off('rejoin_error', handleRejoinError);
      socket.off('error', handleSocketError);
    };
  }, [socket, roomId]);

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

  const sendForfeit = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('forfeit_game');
    }
  }, []);

  return { connected, reconnecting, sendAction, sendForfeit, sendChat };
}
