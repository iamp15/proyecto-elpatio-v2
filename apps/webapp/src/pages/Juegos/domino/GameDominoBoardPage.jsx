import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useGameSocket } from './useGameSocket';
import DominoGame from './DominoGame';
import GameOverModal from './components/GameOverModal';
import OpponentAbandonWinBanner from './components/OpponentAbandonWinBanner';
import MatchFoundOverlay from './components/MatchFoundOverlay';
import GameOptionsModal from './components/GameOptionsModal';
import DominoTile from './components/DominoTile';
import './domino.css';
import useGameSounds from './hooks/useGameSounds';
import { triggerTurnNotification } from '../../../lib/telegram';
import {
  OPPONENT_ABANDON_ANNOUNCE_MS,
  shouldShowOpponentAbandonAnnouncement,
  getAbandonReason,
  getAbandoningOpponentUserId,
} from './utils/opponentAbandonAnnouncement';
import { resolveDisplayName } from '../../../lib/userDisplayName';

/**
 * Página del tablero de Dominó en /play/:roomId.
 *
 * Resiliente a recargas y desconexiones:
 *   Al montar, useGameSocket emite rejoin_room(roomId) automáticamente.
 *   El servidor responde con game_rejoined → estado completo de la partida.
 *
 * Estados internos:
 *   'connecting'  → esperando game_rejoined tras conectar
 *   'playing'     → partida activa
 *   'error'       → sala no disponible o error de red
 *   'finished'    → partida terminada, mostrando resultado
 */
export default function GameDominoBoardPage() {
  const { t } = useTranslation();
  const { roomId }  = useParams();
  const location    = useLocation();
  const { user, refreshBalance, updateUser } = useAuth();
  const navigate     = useNavigate();

  const sounds = useGameSounds();

  const [view,              setView]              = useState('connecting');
  const [gameState,         setGameState]         = useState(null);
  const [gameOver,          setGameOver]           = useState(null);  // payload completo del evento
  const [errorMsg,          setErrorMsg]          = useState('');
  const [invalidMsg,        setInvalidMsg]        = useState('');
  const [showMatchOverlay,  setShowMatchOverlay]  = useState(false);
  const [matchOverlayData,  setMatchOverlayData]  = useState(null);  // { playerMe, playerOpponent }
  // { phase: 'counting' | 'notebook', data: payload }
  const [roundEndSequence,  setRoundEndSequence]  = useState(null);
  const [chatBubbles,       setChatBubbles]       = useState({});     // { [userId]: { type, content, id } }
  const [optionsOpen,       setOptionsOpen]       = useState(false);
  const [abandonWinBanner, setAbandonWinBanner]  = useState(null);
  const roundOverlayVisibleRef = useRef(false);
  const pendingGameOverRef = useRef(null);
  const forfeitAnnounceTimerRef = useRef(null);
  const gameStateRef = useRef(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (forfeitAnnounceTimerRef.current) {
        clearTimeout(forfeitAnnounceTimerRef.current);
        forfeitAnnounceTimerRef.current = null;
      }
    };
  }, []);
  const previousTurnRef = useRef(null); // Para detectar cambio de turno

  const myUserId = user?.id ?? null;

  const handleRejoined = useCallback((payload) => {
    setGameState({ ...payload.state, players: payload.players ?? [] });
    setView('playing');

    // Versus solo cuando vienes de la cola (match_found → game_start → navigate con state).
    // Bypass de reconexión: si la partida ya está en curso (F5, recarga), nunca mostrar overlay.
    // board > 0 = alguien ya jugó; hand < 7 = ya jugamos al menos una ficha.
    // Flag por roomId: evita mostrar Versus al reconectar cuando nadie ha jugado (state persistido).
    const versusKey = `domino-versus-shown-${roomId}`;
    const alreadyShownForThisRoom =
      typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem(versusKey);

    const fromMatchmaking = location.state?.fromMatchmaking === true;
    const fromReconnect = location.state?.fromReconnect === true;
    // Solo "en curso" si hay jugadas en tablero o mano parcial (alguien ya bajó fichas).
    // hand [] o ausente al inicio NO debe activar el bypass (antes: (0 ?? 0) < 7 saltaba el versus).
    const boardLen = payload.state?.board?.length ?? 0;
    const hand = payload.state?.hand;
    const handLen = Array.isArray(hand) ? hand.length : null;
    const gameAlreadyInProgress =
      boardLen > 0 ||
      (handLen !== null && handLen > 0 && handLen < 7);
    const blockVersusFromSession = alreadyShownForThisRoom && !fromMatchmaking;

    if (
      fromMatchmaking &&
      !fromReconnect &&
      !gameAlreadyInProgress &&
      !blockVersusFromSession &&
      payload.players?.length >= 2
    ) {
      const me = payload.players.find((p) => p.userId === myUserId);
      const opponent = payload.players.find((p) => p.userId !== myUserId);
      setMatchOverlayData({
        playerMe: {
          displayName: me?.displayName ?? resolveDisplayName(user, t('gameBoard.you')),
          pr:          me?.pr ?? user?.pr ?? 1000,
          rank:        me?.rank ?? user?.rank,
        },
        playerOpponent: {
          displayName: resolveDisplayName(opponent, t('gameBoard.rival')),
          pr:          opponent?.pr ?? 1000,
          rank:        opponent?.rank,
        },
      });
      setShowMatchOverlay(true);
    } else {
      setShowMatchOverlay(false);
    }
  }, [myUserId, user, location.state, roomId, t]);

  const handleGameState = useCallback((state) => {
    // Detectar cambio de turno hacia el jugador local
    if (state.turn === myUserId && previousTurnRef.current !== myUserId) {
      triggerTurnNotification();
    }
    
    previousTurnRef.current = state.turn;
    
    // Preservar `players` del estado anterior si el nuevo no lo incluye
    setGameState((prev) => {
      const prevBoardLen = prev?.board?.length ?? 0;
      const nextBoardLen = state?.board?.length ?? 0;
      const prevHandLen = prev?.hand?.length ?? null;
      const nextHandLen = state?.hand?.length ?? null;

      // Si crece el tablero y mi mano no cambia, la ficha la puso el oponente.
      if (nextBoardLen > prevBoardLen && prevHandLen === nextHandLen) {
        sounds.playClack?.();
      }

      return { ...state, players: state.players ?? prev?.players ?? [] };
    });
  }, [myUserId, sounds]);

  const presentGameOver = useCallback(
    (payload) => {
      pendingGameOverRef.current = null;

      const finalize = () => {
        try {
          sessionStorage.removeItem(`domino-versus-shown-${roomId}`);
        } catch (_) {}
        setAbandonWinBanner(null);
        setGameOver(payload);
        setView('finished');
      };

      if (!shouldShowOpponentAbandonAnnouncement(payload, myUserId)) {
        finalize();
        return;
      }

      const players = gameStateRef.current?.players ?? [];
      const oid = getAbandoningOpponentUserId(payload);
      const ply = players.find((p) => String(p.userId) === String(oid));
      const opponentName = resolveDisplayName(ply, t('gameBoard.rival'));

      setAbandonWinBanner({
        reason: getAbandonReason(payload),
        opponentName,
      });

      if (forfeitAnnounceTimerRef.current) {
        clearTimeout(forfeitAnnounceTimerRef.current);
      }
      forfeitAnnounceTimerRef.current = setTimeout(() => {
        forfeitAnnounceTimerRef.current = null;
        finalize();
      }, OPPONENT_ABANDON_ANNOUNCE_MS);
    },
    [myUserId, roomId, t],
  );

  const handleGameOver = useCallback(
    (payload) => {
      pendingGameOverRef.current = payload;
      refreshBalance?.();

      if (!roundOverlayVisibleRef.current) {
        presentGameOver(payload);
      }
    },
    [refreshBalance, presentGameOver],
  );

  const handlePRUpdated = useCallback(({ pr, rank }) => {
    updateUser({ pr, rank });
  }, [updateUser]);

  const handleError = useCallback((payload) => {
    setErrorMsg(payload?.message ?? t('gameBoard.errorConnectRoom'));
    setView('error');
  }, [t]);

  const handleInvalidMove = useCallback((payload) => {
    if (roundOverlayVisibleRef.current) return; // No mostrar toast mientras el overlay de fin de mano está visible
    setInvalidMsg(payload?.reason ?? t('gameBoard.invalidMove'));
    setTimeout(() => setInvalidMsg(''), 2500);
  }, [t]);

  const handleGameCancelled = useCallback((payload) => {
    console.log(`[Game] Partida cancelada: ${payload?.reason || 'unknown'}`);
    // Limpiar estado de sesión
    try { sessionStorage.removeItem(`domino-versus-shown-${roomId}`); } catch (_) {}
    
    // Mostrar mensaje de error y navegar al lobby
    setErrorMsg(payload?.message || t('gameBoard.gameCancelled'));
    setView('error');
    
    // Reproducir sonido de cancelación si existe
    sounds.playThunder?.();
  }, [roomId, t, sounds]);

  const handleRoundOver = useCallback((payload) => {
    sounds.playHeavyClack();
    // Fase 0: Esperar aterrizaje de la última ficha
    setTimeout(() => {
      // Fase 1: Conteo de fichas (Pantalla negra)
      roundOverlayVisibleRef.current = true;
      setRoundEndSequence({ phase: 'counting', data: payload });

      // Disparar sonido de cierre de mano mientras se muestra la fase de conteo
      if (payload.isBlocked) {
        sounds.playSlam();
      } else {
        sounds.playDing();
      }

      const countingDuration = payload.isBlocked ? 5500 : 3500;

      setTimeout(() => {
        if (payload.isFinal) {
          // Es la ronda final de la partida: tras el conteo pasamos directamente al modal de Victoria/Derrota
          setRoundEndSequence(null);
          roundOverlayVisibleRef.current = false;

          if (pendingGameOverRef.current) {
            presentGameOver(pendingGameOverRef.current);
          }
        } else {
          // Ronda normal: Pasamos a la libreta
          setRoundEndSequence({ phase: 'notebook', data: payload });
          sounds.playWriting();

          setTimeout(() => {
            setRoundEndSequence(null);
            roundOverlayVisibleRef.current = false;
          }, 4500);
        }
      }, countingDuration); // Tiempo que dura la animación de conteo (más largo en tranca)
    }, 1200);
  }, [roomId, sounds, presentGameOver]);

  const handleAutoPlayAction = useCallback((payload) => {
    if (payload?.actionType === 'play_tile') sounds.playClack();
    else if (payload?.actionType === 'draw_tile') sounds.playClack2();
    else if (payload?.actionType === 'pass') sounds.playPass();
  }, [sounds]);

  const handleChatMessage = useCallback((payload) => {
    sounds.playChatPop();
    const { userId, type, content } = payload;
    const bubbleId = Date.now();
    setChatBubbles((prev) => ({ ...prev, [userId]: { type, content, id: bubbleId } }));
    setTimeout(() => {
      setChatBubbles((prev) => {
        if (prev[userId]?.id === bubbleId) {
          const newBubbles = { ...prev };
          delete newBubbles[userId];
          return newBubbles;
        }
        return prev;
      });
    }, 3000);
  }, [sounds]);

  const { connected, reconnecting, sendAction, sendForfeit, sendChat } = useGameSocket({
    roomId,
    onRejoined:       handleRejoined,
    onGameState:      handleGameState,
    onGameOver:       handleGameOver,
    onPRUpdated:      handlePRUpdated,
    onRoundOver:      handleRoundOver,
    onChatMessage:    handleChatMessage,
    onAutoPlayAction: handleAutoPlayAction,
    onGameCancelled:  handleGameCancelled,
    onError:          handleError,
    onInvalidMove:    handleInvalidMove,
  });

  const gameOverSoundPlayedRef = useRef(false);

  // Thunder: suena cuando aparece el overlay (partida encontrada).
  useEffect(() => {
    if (!showMatchOverlay) return;
    sounds.playThunder();
  }, [showMatchOverlay, sounds.playThunder]);

  // Música de la partida: arranca solo cuando el overlay ya se cerró.
  useEffect(() => {
    if (view !== 'playing' || showMatchOverlay) return;
    sounds.playGameMusic();
    return () => sounds.stopGameMusic();
  }, [view, showMatchOverlay, sounds.playGameMusic, sounds.stopGameMusic]);

  useEffect(() => {
    if (view !== 'finished') {
      gameOverSoundPlayedRef.current = false;
      return;
    }
    if (gameOver?.winnerId == null || gameOverSoundPlayedRef.current) return;
    gameOverSoundPlayedRef.current = true;
    if (String(gameOver.winnerId) === String(myUserId)) {
      sounds.playVictory();
    } else {
      sounds.playDefeat();
    }
  }, [view, gameOver, myUserId, sounds]);

  function handleAction(actionType, data = {}) {
    sendAction(actionType, data);
  }

  const handleForfeit = useCallback(() => {
    sounds.playButton();
    setOptionsOpen(false);
    sendForfeit();
  }, [sendForfeit, sounds]);

  // ── Pantalla de carga / reconexión ─────────────────────────────────────────
  if (view === 'connecting') {
    return (
      <div className="domino-root flex flex-col w-full min-h-[100dvh] bg-[#0d1117]" style={{
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '20px',
      }}>
        <div className="domino-spinner" />
        <p style={{
          color:      'var(--domino-text-muted)',
          fontSize:   '0.9rem',
          fontWeight: 500,
          margin:     0,
        }}>
          {reconnecting ? t('gameBoard.reconnecting') : t('gameBoard.loadingGame')}
        </p>
      </div>
    );
  }

  // ── Error / sala no disponible ─────────────────────────────────────────────
  if (view === 'error') {
    return (
      <div className="domino-root flex flex-col w-full min-h-[100dvh] bg-[#0d1117]" style={{
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '16px',
        padding:        '32px 24px',
      }}>
        <div style={{
          width:        56,
          height:       56,
          borderRadius: '50%',
          background:   'rgba(239,68,68,0.12)',
          border:       '1.5px solid rgba(239,68,68,0.25)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     '1.6rem',
        }}>
          ✕
        </div>
        <p style={{ color: 'var(--domino-text)', fontWeight: 600, margin: 0, textAlign: 'center' }}>
          {errorMsg}
        </p>
        <button
          className="domino-btn domino-btn-ghost"
          onClick={() => navigate('/lobby-domino')}
        >
          {t('gameBoard.backToLobby')}
        </button>
      </div>
    );
  }

  const opponentPlayer = (gameState?.players ?? []).find(
    (p) => String(p.userId) !== String(myUserId),
  );

  // ── Partida activa (y modal de resultado encima si terminó) ──────────────
  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#0d1117] relative overflow-hidden">
      {view === 'playing' && (
        <button
          type="button"
          aria-label={t('gameOptions.title')}
          title={t('gameOptions.title')}
          onClick={() => {
            sounds.playButton();
            setOptionsOpen(true);
          }}
          className="absolute top-4 left-4 z-[9999] h-10 w-10 rounded-full border border-white/20 bg-black/50 text-white shadow-lg backdrop-blur-sm hover:bg-black/70"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="mx-auto h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      )}

      {/*
      🧪 BOTONES DE DESARROLLADOR — mantener comentados para uso futuro
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!myUserId) return;
            handleRoundOver({
              roundWinner: myUserId,
              pointsWon: 14,
              currentScores: {
                [myUserId]: 25,
                [opponentPlayer?.userId || 999]: 10,
              },
              revealedHands: {
                [myUserId]: [
                  { a: 1, b: 2 },
                  { a: 0, b: 0 },
                ],
                [opponentPlayer?.userId || 999]: [
                  { a: 6, b: 6 },
                  { a: 5, b: 4 },
                  { a: 1, b: 1 },
                ],
              },
              isBlocked: true,
              isFinal: false,
            });
          }}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-full shadow-lg border-2 border-white text-sm"
        >
          🧪 Tranca
        </button>
        <button
          type="button"
          onClick={() => {
            if (!myUserId) return;
            const oppId = opponentPlayer?.userId ?? 999;
            setGameOver({
              winnerId: myUserId,
              prize_piedras: 50,
              finalScores: { [myUserId]: 52, [oppId]: 48 },
              prChanges: { winnerGain: 25, loserLoss: 25 },
            });
            setView('finished');
          }}
          className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-full shadow-lg border-2 border-white text-sm"
        >
          🧪 Victoria
        </button>
        <button
          type="button"
          onClick={() => {
            if (!myUserId) return;
            const oppId = opponentPlayer?.userId ?? 999;
            setGameOver({
              winnerId: oppId,
              prize_piedras: 0,
              finalScores: { [myUserId]: 45, [oppId]: 55 },
              prChanges: { winnerGain: 25, loserLoss: 25 },
            });
            setView('finished');
          }}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-full shadow-lg border-2 border-white text-sm"
        >
          🧪 Derrota
        </button>
      </div>
      */}


      {/* Indicador de desconexión */}
      <AnimatePresence>
        {!connected && view !== 'finished' && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{
              position:       'absolute',
              top:            0,
              left:           0,
              right:          0,
              zIndex:         20,
              background:     'rgba(239,68,68,0.9)',
              backdropFilter: 'blur(8px)',
              color:          '#fff',
              textAlign:      'center',
              padding:        '8px 16px',
              fontSize:       '0.8rem',
              fontWeight:     600,
            }}
          >
            {t('gameBoard.noConnection')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast de movimiento inválido */}
      <AnimatePresence>
        {invalidMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position:       'absolute',
              bottom:         '200px',
              left:           '50%',
              transform:      'translateX(-50%)',
              zIndex:         15,
              background:     'rgba(239,68,68,0.85)',
              backdropFilter: 'blur(8px)',
              color:          '#fff',
              padding:        '10px 20px',
              borderRadius:   '20px',
              fontSize:       '0.85rem',
              fontWeight:     500,
              whiteSpace:     'nowrap',
            }}
          >
            {invalidMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tablero del juego — flex-1 para que empuje la mano hacia el fondo */}
      {gameState && (
        <div className="flex-1 min-h-0 flex flex-col">
          <DominoGame
            gameState={gameState}
            myUserId={myUserId}
            viewerUser={user}
            onAction={handleAction}
            isGameOverModalVisible={!!gameOver}
            chatBubbles={chatBubbles}
            onSendChat={sendChat}
          />
        </div>
      )}

      {/* Overlay "Partida Encontrada" — Versus screen antes de revelar tablero */}
      {showMatchOverlay && matchOverlayData && (
        <MatchFoundOverlay
          playerMe={matchOverlayData.playerMe}
          playerOpponent={matchOverlayData.playerOpponent}
          onAnimationComplete={() => {
            try {
              sessionStorage.setItem(`domino-versus-shown-${roomId}`, '1');
            } catch (_) {}
            setShowMatchOverlay(false);
          }}
          duration={5000}
        />
      )}

      {/* Secuencia de Fin de Ronda (Mano) */}
      <AnimatePresence mode="wait">
        {roundEndSequence && !gameOver && roundEndSequence.phase === 'counting' && (
          <motion.div
            key="counting-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(5px)' }}
            className="absolute inset-0 flex flex-col items-center justify-center z-[100] bg-black/85 backdrop-blur-md overflow-hidden"
          >
            {roundEndSequence.data.isBlocked ? (
              // ── ANIMACIÓN DE TRANCA (DUELO DE MANOS) ──
              <div className="flex flex-col items-center w-full max-w-5xl px-4">
                <motion.h2
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', bounce: 0.6 }}
                  className="text-3xl md:text-5xl font-black text-red-500 mb-6 tracking-widest drop-shadow-[0_5px_15px_rgba(239,68,68,0.6)] uppercase italic"
                >
                  ¡Trancado!
                </motion.h2>

                <div className="flex flex-col md:flex-row w-full justify-around items-center gap-8 md:gap-4">
                  {Object.entries(roundEndSequence.data.revealedHands || {}).map(([uid, hand]) => {
                    const isWinner = String(uid) === String(roundEndSequence.data.roundWinner);
                    const handPoints = hand.reduce((sum, t) => sum + t.a + t.b, 0);
                    const isMe = String(uid) === String(myUserId);

                    const playerFromState = (gameState?.players ?? []).find(
                      (p) => String(p.userId) === String(uid),
                    );
                    const playerName = resolveDisplayName(
                      playerFromState,
                      isMe
                        ? resolveDisplayName(user, t('gameBoard.you'))
                        : t('gameBoard.rival'),
                    );

                    return (
                      <motion.div
                        key={uid}
                        initial={{ x: isMe ? -100 : 100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className={`flex flex-col items-center p-6 rounded-3xl w-full md:w-2/5 relative overflow-hidden ${
                          isWinner
                            ? 'bg-gradient-to-b from-green-900/60 to-black border-2 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] z-10'
                            : 'bg-gradient-to-b from-gray-900/60 to-black border-2 border-gray-700 opacity-60 scale-95'
                        }`}
                      >
                        <h3 className="text-lg text-white font-bold mb-3">{playerName}</h3>
                        <div className="flex flex-wrap justify-center gap-1.5 mb-3">
                          {hand.map((tile, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 1 + i * 0.1 }}
                            >
                              <DominoTile tile={tile} handSize={32} />
                            </motion.div>
                          ))}
                        </div>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 2 }}
                          className={`text-2xl font-black ${
                            isWinner ? 'text-green-400' : 'text-gray-400'
                          }`}
                        >
                          {handPoints} pts
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 3 }}
                  className="mt-6 text-xl font-bold text-yellow-400"
                >
                  +
                  {roundEndSequence.data.pointsWon} pts para{' '}
                  {String(roundEndSequence.data.roundWinner) === String(myUserId)
                    ? 'ti'
                    : 'el oponente'}
                </motion.div>
              </div>
            ) : (
              // ── ANIMACIÓN NORMAL (SOLO FICHAS DEL PERDEDOR) ──
              <>
                <h2 className="text-2xl md:text-3xl font-black text-white mb-6 drop-shadow-lg text-center">
                  {roundEndSequence.data.roundWinner === myUserId
                    ? '¡Fichas del Oponente!'
                    : 'Tus fichas restantes'}
                </h2>

                <div className="flex flex-wrap justify-center gap-3 px-4 max-w-2xl">
                  {(
                    Object.entries(roundEndSequence.data.revealedHands || {}).find(
                      ([uid]) =>
                        String(uid) !== String(roundEndSequence.data.roundWinner),
                    )?.[1] || []
                  ).map((tile, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 50, scale: 0.5, rotate: -10 }}
                      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                      transition={{ delay: idx * 0.15, type: 'spring', bounce: 0.5 }}
                    >
                      <DominoTile tile={tile} handSize={44} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.15 + 0.3 }}
                        className="text-center text-yellow-400 font-bold mt-1.5 text-base"
                      >
                        {tile.a + tile.b}
                      </motion.div>
                    </motion.div>
                  ))}
                </div>

                {(() => {
                  const winnerId = roundEndSequence.data.roundWinner;
                  const winnerPlayer = (gameState?.players ?? []).find(
                    (p) => String(p.userId) === String(winnerId),
                  );
                  const winnerName = resolveDisplayName(
                    winnerPlayer,
                    winnerId === myUserId
                      ? resolveDisplayName(user, t('gameBoard.you'))
                      : t('gameBoard.rival'),
                  );
                  const isMeWinner = String(winnerId) === String(myUserId);
                  const colorClass = isMeWinner
                    ? 'text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]'
                    : 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]';

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.5 }}
                      className={`mt-6 text-2xl md:text-3xl font-black ${colorClass}`}
                    >
                      {winnerName} +{roundEndSequence.data.pointsWon} pts
                    </motion.div>
                  );
                })()}
              </>
            )}
          </motion.div>
        )}

        {roundEndSequence && !gameOver && roundEndSequence.phase === 'notebook' && (
          <motion.div
            key="notebook-phase"
            initial={{ opacity: 0, y: 100, rotate: -5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: 5 }}
            className="absolute inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setRoundEndSequence(null)} /* <--- Cierra al hacer click fuera */
          >
            {/* Contenedor tipo Hoja de Papel */}
            <div
              className="relative w-72 bg-[#fff9db] shadow-2xl p-6 rounded-sm border-l-8 border-red-400 cursor-default"
              onClick={(e) => e.stopPropagation()} /* <--- Evita que el click dentro cierre la libreta */
              style={{
                backgroundImage: 'linear-gradient(#e1e1e1 1px, transparent 1px)',
                backgroundSize: '100% 2rem',
                fontFamily: "'Permanent Marker', 'Kalam', cursive",
              }}
            >
              <div className="absolute -left-4 top-0 bottom-0 flex flex-col justify-around py-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-4 h-4 bg-gray-800 rounded-full shadow-inner" />
                ))}
              </div>

              <h3 className="text-2xl text-blue-800 border-b-2 border-red-300 mb-4 text-center uppercase tracking-widest">
                Anotaciones
              </h3>

              <div className="flex justify-between text-gray-800 text-xl">
                <div className="flex flex-col items-center flex-1 border-r border-red-200">
                  <span className="text-sm opacity-60">{resolveDisplayName(user, t('gameBoard.you'))}</span>
                  <span className="text-3xl">{roundEndSequence.data.currentScores[myUserId] || 0}</span>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-sm opacity-60">
                    {resolveDisplayName(
                      (gameState?.players ?? []).find(
                        (p) => String(p.userId) !== String(myUserId),
                      ),
                      t('gameBoard.rival'),
                    )}
                  </span>
                  <span className="text-3xl">
                    {
                      Object.values(roundEndSequence.data.currentScores).find(
                        (_, i) =>
                          Object.keys(roundEndSequence.data.currentScores)[i] !== String(myUserId),
                      ) || 0
                    }
                  </span>
                </div>
              </div>

              <div className="mt-8 text-center bg-blue-100/50 py-2 rounded border border-blue-200">
                <p className="text-blue-900 text-lg">
                  {(() => {
                    const winnerId = roundEndSequence.data.roundWinner;
                    const winnerPlayer = (gameState?.players ?? []).find(
                      (p) => String(p.userId) === String(winnerId),
                    );
                    const winnerName = resolveDisplayName(
                      winnerPlayer,
                      winnerId === myUserId
                        ? resolveDisplayName(user, t('gameBoard.you'))
                        : t('gameBoard.rival'),
                    );
                    return (
                      <>
                        {winnerName} +{roundEndSequence.data.pointsWon} {t('gameOverModal.pts')}
                      </>
                    );
                  })()}
                </p>
              </div>

              <div className="mt-6 text-xs text-gray-500 text-center font-sans animate-pulse">
                Toca fuera para cerrar
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de resultado — overlay sobre el tablero */}
      <GameOptionsModal
        isOpen={optionsOpen && view === 'playing'}
        onClose={() => setOptionsOpen(false)}
        onForfeit={handleForfeit}
      />

      <OpponentAbandonWinBanner
        visible={!!abandonWinBanner}
        reason={abandonWinBanner?.reason ?? 'forfeit'}
        opponentName={abandonWinBanner?.opponentName ?? ''}
      />

      {view === 'finished' && gameOver && (
        <GameOverModal
          winnerId={gameOver.winnerId}
          myUserId={myUserId}
          prize_piedras={gameOver.prize_piedras}
          systemMessage={gameOver.systemMessage ?? null}
          finalScores={gameOver.finalScores ?? {}}
          playerOrder={gameState?.playerOrder ?? []}
          players={gameState?.players ?? []}
          prDelta={
            gameOver.winnerId === myUserId
              ? gameOver.prChanges?.winnerGain ?? 0
              : -(gameOver.prChanges?.loserLoss ?? 0)
          }
          currencyDelta={gameOver.winnerId === myUserId ? gameOver.prize_piedras ?? 0 : 0}
          onLobby={() => navigate('/lobby-domino')}
        />
      )}
    </div>
  );
}
