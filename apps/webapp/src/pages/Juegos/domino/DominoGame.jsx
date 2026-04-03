import { useMemo, useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import './domino.css';
import DominoBoard        from './components/DominoBoard';
import PlayerHand         from './components/PlayerHand';
import PlayerProfileFrame from './components/PlayerProfileFrame';
import ChatBubble         from './components/ChatBubble';
import PlayerChatControls from './components/PlayerChatControls';
import TurnTimer          from './components/TurnTimer';
import useGameSounds      from './hooks/useGameSounds';

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
  const sounds = useGameSounds();
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
    turnEndsAt,
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
    sounds.playClack();
    onAction('play_tile', { tile, side });
  }, [onAction, sounds]);

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
    sounds.playClack2();
    onAction('draw_tile');
  }

  function handlePass() {
    sounds.playPass();
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

      {/* ── Temporizador de Urgencia ── */}
      <TurnTimer
        turnEndsAt={turnEndsAt}
        isMyTurn={isMyTurn}
      />

      {/* ── Marco del Jugador Local (Abajo Izquierda) ── */}
      {myPlayer && (
        <div style={{ position: 'absolute', bottom: '148px', left: '16px', zIndex: 40, pointerEvents: 'none' }}>
          {onSendChat && (
            <PlayerChatControls onSendChat={(type, content) => onSendChat?.(type, content)} />
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
