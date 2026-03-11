import { useMemo, useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import './domino.css';
import DominoBoard        from './components/DominoBoard';
import PlayerHand         from './components/PlayerHand';
import PlayerProfileFrame from './components/PlayerProfileFrame';
import ChatBubble         from './components/ChatBubble';
import PlayerChatControls from './components/PlayerChatControls';

/**
 * Layout puro del juego de Dominó.
 * No maneja sockets ni reconexión — eso es responsabilidad de GameDominoBoardPage.
 *
 * Layout:
 *   ┌──────────────────────┐
 *   │  PlayerProfileFrame  │  ← oponente (arriba derecha, flotante)
 *   │  DominoBoard         │  ← cadena de fichas, scroll horizontal
 *   │  PlayerProfileFrame  │  ← jugador local (abajo izquierda, flotante)
 *   │  PlayerHand          │  ← mano propia + acciones
 *   └──────────────────────┘
 *
 * @param {{
 *   gameState:  object,
 *   myUserId:   number,
 *   myPlayer:   { name: string, avatarUrl: string|null, pr: number, rankColor: string, badgeVariant: string } | null,
 *   onAction:   (actionType: string, data?: object) => void,
 *   isGameOverModalVisible: boolean,
 *   chatBubbles: object,
 *   onSendChat: (type: string, content: string) => void,
 * }} props
 */
export default function DominoGame({
  gameState,
  myUserId,
  myPlayer = null,
  onAction,
  isGameOverModalVisible = false,
  chatBubbles = {},
  onSendChat,
}) {
  const { t } = useTranslation();
  const {
    board               = [],
    boardEnds           = null,
    turn                = null,
    playerOrder         = [],
    hand                = [],
    opponentTileCounts  = {},
    stockCount          = 0,
    players             = [],
    scores              = {},
    targetScore         = null,
    status,
    winner,
  } = gameState;

  const isMyTurn = turn === myUserId;
  const [selectedTileForPosition, setSelectedTileForPosition] = useState(null);

  // Datos del oponente derivados de gameState.players
  const opponentData = players.find((p) => p.userId !== myUserId) ?? null;
  const opponentPlayer = opponentData ? {
    name:         opponentData.displayName ?? opponentData.username ?? 'Rival',
    avatarUrl:    opponentData.avatarUrl ?? null,
    pr:           opponentData.pr ?? 1000,
    rankColor:    opponentData.rank ?? 'BRONCE',
    badgeVariant: 'default',
  } : null;
  const opponentTileCount = opponentData ? (opponentTileCounts[opponentData.userId] ?? null) : null;
  const isOpponentTurn    = turn === opponentData?.userId;

  const isFinishing = status === 'FINISHED';

  useEffect(() => {
    if (!isMyTurn) setSelectedTileForPosition(null);
  }, [isMyTurn]);

  // Extremos jugables derivados del board: así la jugabilidad es correcta tras la vuelta en U.
  // Izquierda: ficha más a la izquierda tiene el enchufe en .b y el número jugable en .a.
  // Derecha: ficha más a la derecha tiene el enchufe en .a y el número jugable en .b.
  const effectiveBoardEnds = useMemo(() => {
    if (!board?.length) return boardEnds ?? null;
    return {
      left:  board[0].tile.a,
      right: board[board.length - 1].tile.b,
    };
  }, [board, boardEnds]);

  const handlePlayTile = useCallback((tile, side) => {
    setSelectedTileForPosition(null);
    onAction('play_tile', { tile, side });
  }, [onAction]);

  const handleSelectTileForPosition = useCallback((tile) => {
    setSelectedTileForPosition(tile);
  }, []);

  const handleCancelSelectPosition = useCallback(() => {
    setSelectedTileForPosition(null);
  }, []);

  const handleSelectPosition = useCallback((side) => {
    if (!selectedTileForPosition) return;
    handlePlayTile(selectedTileForPosition, side);
  }, [selectedTileForPosition, handlePlayTile]);

  function handleDrawTile() {
    onAction('draw_tile');
  }

  function handlePass() {
    onAction('pass');
  }

  return (
    <div className="domino-root" style={{ position: 'relative' }}>
      {/* Fondo con gradiente sutil */}
      <div style={{
        position:   'absolute',
        inset:      0,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(0,229,204,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* ── Marco del Oponente (Arriba Derecha) ── */}
      {opponentPlayer && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
          <ChatBubble bubble={chatBubbles[opponentData?.userId]} isOpponent={true} />
          <div style={{ pointerEvents: 'none' }}>
            <PlayerProfileFrame
              player={opponentPlayer}
              score={scores[opponentData?.userId] ?? 0}
              targetScore={targetScore}
              layoutSide="right"
              tileCount={opponentTileCount}
              isActiveTurn={isOpponentTurn}
            />
          </div>
        </div>
      )}

      {/* ── Tablero ── */}
      <DominoBoard
        board={board}
        selectedTileForPosition={selectedTileForPosition}
        onSelectPosition={handleSelectPosition}
        localPlayerId={myUserId}
      />

      {/* Animación de Transición al ganar/perder */}
      <AnimatePresence>
        {isFinishing && !isGameOverModalVisible && (
          /* 1. Contenedor de Posicionamiento Fijo (HTML Puro, a prueba de fallos) */
          <div className="fixed inset-0 w-full h-[100dvh] flex items-center justify-center z-[100] pointer-events-none">

            {/* 2. Contenedor Animado (Framer Motion solo afecta el interior) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ type: 'spring', bounce: 0.6, duration: 0.8 }}
              className="text-center"
            >
              <div className="relative inline-block">
                <h1
                  className="text-5xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-2xl text-center px-4"
                  style={{ WebkitTextStroke: '2px #422006' }}
                >
                  FIN DE LA PARTIDA
                </h1>
                {/* Resplandor detrás del texto */}
                <div className="absolute inset-0 bg-yellow-500/30 blur-3xl -z-10 rounded-full scale-150" />
              </div>
            </motion.div>

          </div>
        )}
      </AnimatePresence>

      {/* ── Marco del Jugador Local (Abajo Izquierda) ── */}
      {myPlayer && (
        <div style={{ position: 'absolute', bottom: '148px', left: '16px', zIndex: 40, pointerEvents: 'none' }}>
          {onSendChat && (
            <PlayerChatControls
              onSendChat={(type, content) => onSendChat?.(type, content)}
            />
          )}
          <ChatBubble bubble={chatBubbles[myUserId]} isOpponent={false} />
          <div style={{ pointerEvents: 'auto' }}>
            <PlayerProfileFrame
              player={myPlayer}
              score={scores[myUserId] ?? 0}
              targetScore={targetScore}
              layoutSide="left"
              isActiveTurn={isMyTurn}
            />
          </div>
        </div>
      )}

      {/* ── Mano del jugador ── */}
      <PlayerHand
        hand={hand}
        boardEnds={effectiveBoardEnds}
        isMyTurn={isMyTurn}
        stockCount={stockCount}
        selectedTileForPosition={selectedTileForPosition}
        onPlayTile={handlePlayTile}
        onSelectTileForPosition={handleSelectTileForPosition}
        onCancelSelectPosition={handleCancelSelectPosition}
        onDrawTile={handleDrawTile}
        onPass={handlePass}
      />
    </div>
  );
}
