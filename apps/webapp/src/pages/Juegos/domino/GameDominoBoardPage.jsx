import { useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useGameSocket } from './useGameSocket';
import DominoGame from './DominoGame';
import GameOverModal from './components/GameOverModal';
import MatchFoundOverlay from './components/MatchFoundOverlay';
import './domino.css';

/**
 * Página del tablero de Dominó en /juegos/domino/:roomId.
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
  const { token, user, refreshBalance, updateUser } = useAuth();
  const navigate     = useNavigate();

  const [view,              setView]              = useState('connecting');
  const [gameState,         setGameState]         = useState(null);
  const [gameOver,          setGameOver]           = useState(null);  // payload completo del evento
  const [errorMsg,          setErrorMsg]          = useState('');
  const [invalidMsg,        setInvalidMsg]        = useState('');
  const [showMatchOverlay,  setShowMatchOverlay]  = useState(false);
  const [matchOverlayData,  setMatchOverlayData]  = useState(null);  // { playerMe, playerOpponent }
  const [roundOverData,     setRoundOverData]     = useState(null);   // { roundWinner, pointsWon, currentScores }
  const [handNumber,        setHandNumber]        = useState(0);
  const [chatBubbles,       setChatBubbles]       = useState({});     // { [userId]: { type, content, id } }

  const myUserId = user?.id ?? null;

  /** Datos del jugador local para el PlayerProfileFrame. */
  const myPlayer = user
    ? {
        name:      user.first_name ?? user.username ?? t('gameBoard.defaultPlayerName'),
        avatarUrl: user.photo_url ?? null,
        pr:        user.pr        ?? 1000,
        rankColor: user.rank      ?? 'BRONCE',
        badgeVariant: 'default',
      }
    : null;

  const handleRejoined = useCallback((payload) => {
    setGameState({ ...payload.state, players: payload.players ?? [] });
    setView('playing');

    // Versus solo cuando vienes de la cola (match_found → game_start → navigate con state).
    // Bypass de reconexión: si la partida ya está en curso (F5, recarga), nunca mostrar overlay.
    // board > 0 = alguien ya jugó; hand < 7 = ya jugamos al menos una ficha.
    // Flag por roomId: evita mostrar Versus al reconectar cuando nadie ha jugado (state persistido).
    const versusKey = `domino-versus-shown-${roomId}`;
    const alreadyShownForThisRoom = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem(versusKey);

    const fromMatchmaking = location.state?.fromMatchmaking === true;
    const gameAlreadyInProgress =
      (payload.state?.board?.length ?? 0) > 0 ||
      (payload.state?.hand?.length ?? 0) < 7;

    if (fromMatchmaking && !gameAlreadyInProgress && !alreadyShownForThisRoom && payload.players?.length >= 2) {
      const me = payload.players.find((p) => p.userId === myUserId);
      const opponent = payload.players.find((p) => p.userId !== myUserId);
      setMatchOverlayData({
        playerMe: {
          displayName: me?.displayName ?? user?.first_name ?? user?.username ?? t('gameBoard.you'),
          pr:          me?.pr ?? user?.pr ?? 1000,
          rank:        me?.rank ?? user?.rank,
        },
        playerOpponent: {
          displayName: opponent?.displayName ?? t('gameBoard.rival'),
          pr:          opponent?.pr ?? 1000,
          rank:        opponent?.rank,
        },
      });
      setShowMatchOverlay(true);
      try { sessionStorage.setItem(versusKey, '1'); } catch (_) {}
    } else {
      setShowMatchOverlay(false);
    }
  }, [myUserId, user, location.state, roomId, t]);

  const handleGameState = useCallback((state) => {
    // Preservar `players` del estado anterior si el nuevo no lo incluye
    setGameState((prev) => ({ ...state, players: state.players ?? prev?.players ?? [] }));
  }, []);

  const handleGameOver = useCallback((payload) => {
    setRoundOverData(null);
    setHandNumber(0);
    refreshBalance?.();
    try { sessionStorage.removeItem(`domino-versus-shown-${roomId}`); } catch (_) {}
    // Pequeña pausa para que la animación de "¡FIN DE PARTIDA!" termine antes del modal
    setTimeout(() => {
      setGameOver(payload);
      setView('finished');
    }, 1500);
  }, [refreshBalance, roomId]);

  const handlePRUpdated = useCallback(({ pr, rank }) => {
    updateUser({ pr, rank });
  }, [updateUser]);

  const handleError = useCallback((payload) => {
    setErrorMsg(payload?.message ?? t('gameBoard.errorConnectRoom'));
    setView('error');
  }, [t]);

  const handleInvalidMove = useCallback((payload) => {
    setInvalidMsg(payload?.reason ?? t('gameBoard.invalidMove'));
    setTimeout(() => setInvalidMsg(''), 2500);
  }, [t]);

  const handleRoundOver = useCallback((payload) => {
    setHandNumber((n) => n + 1);
    setRoundOverData(payload);
    setTimeout(() => setRoundOverData(null), 8000);
  }, []);

  const handleChatMessage = useCallback((payload) => {
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
  }, []);

  const { connected, reconnecting, sendAction, sendChat } = useGameSocket({
    token,
    roomId,
    onRejoined:    handleRejoined,
    onGameState:   handleGameState,
    onGameOver:    handleGameOver,
    onPRUpdated:   handlePRUpdated,
    onRoundOver:    handleRoundOver,
    onChatMessage:  handleChatMessage,
    onError:        handleError,
    onInvalidMove:  handleInvalidMove,
  });

  function handleAction(actionType, data = {}) {
    sendAction(actionType, data);
  }

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

  // ── Partida activa (y modal de resultado encima si terminó) ──────────────
  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#0d1117] relative overflow-hidden">

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
            myPlayer={myPlayer}
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
          onAnimationComplete={() => setShowMatchOverlay(false)}
          duration={5000}
        />
      )}

      {/* Overlay Cuaderno de Anotaciones (Fin de mano) */}
      <AnimatePresence>
        {roundOverData && !gameOver && (() => {
          const players = gameState?.players ?? [];
          const me = players.find((p) => String(p.userId) === String(myUserId));
          const opponent = players.find((p) => String(p.userId) !== String(myUserId));
          const myName = me?.displayName ?? me?.username ?? user?.first_name ?? user?.username ?? t('gameBoard.you');
          const opponentName = opponent?.displayName ?? opponent?.username ?? t('gameBoard.rival');
          const opponentScore = Object.entries(roundOverData.currentScores ?? {}).find(
            ([uid]) => String(uid) !== String(myUserId)
          )?.[1] ?? 0;

          return (
            <motion.div
              key="scorebook-overlay"
              initial={{ opacity: 0, y: 100, rotate: -5 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm pointer-events-none"
            >
              <div
                className="relative w-72 bg-[#fef3c7] shadow-2xl p-6 rounded-sm border-l-8 border-red-400"
                style={{
                  backgroundImage: 'linear-gradient(#93c5fd 1px, transparent 1px)',
                  backgroundSize: '100% 2rem',
                  fontFamily: "'Permanent Marker', 'Kalam', cursive",
                }}
              >
                {/* Agujeros de la libreta */}
                <div className="absolute -left-4 top-0 bottom-0 flex flex-col justify-around py-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-4 h-4 bg-gray-800 rounded-full shadow-inner" />
                  ))}
                </div>

                <h3 className="text-2xl text-blue-800 border-b-2 border-red-300 mb-4 text-center uppercase tracking-widest">
                  {t('roundOverOverlay.handTitle', { number: handNumber })}
                </h3>

                <div className="flex justify-between text-gray-800 text-xl">
                  <div className="flex flex-col items-center flex-1 border-r border-red-200">
                    <span className="text-sm opacity-60 truncate max-w-full px-1" title={myName}>
                      {myName}
                    </span>
                    <span className="text-3xl">
                      {roundOverData.currentScores?.[myUserId] ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-sm opacity-60 truncate max-w-full px-1" title={opponentName}>
                      {opponentName}
                    </span>
                    <span className="text-3xl">
                      {opponentScore}
                    </span>
                  </div>
                </div>

                <div className="mt-8 text-center bg-blue-100/50 py-2 px-3 rounded border border-blue-200">
                  <p className="text-blue-900 text-xl truncate" title={roundOverData.roundWinner === myUserId ? myName : opponentName}>
                    {roundOverData.roundWinner === myUserId ? myName : opponentName}
                  </p>
                  <p className="text-2xl text-blue-600">
                    +{roundOverData.pointsWon} {t('gameOverModal.pts')}
                  </p>
                </div>

                <div className="mt-4 text-[10px] text-gray-400 text-right italic font-sans">
                  {t('roundOverOverlay.preparingNextHand')}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Modal de resultado — overlay sobre el tablero */}
      {view === 'finished' && gameOver && (
        <GameOverModal
          winnerId={gameOver.winnerId}
          myUserId={myUserId}
          prize_piedras={gameOver.prize_piedras}
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
