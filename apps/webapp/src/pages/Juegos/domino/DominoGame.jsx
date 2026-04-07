import { useMemo, useState, useCallback, useEffect } from 'react';
import './domino.css';
import DominoBoard        from './components/DominoBoard';
import PlayerHand         from './components/PlayerHand';
import PlayerAvatar       from '../../../components/PlayerAvatar';
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
 *   │  PlayerAvatar        │  ← oponente (arriba derecha, flotante)
 *   │  DominoBoard         │  ← cadena de fichas, scroll horizontal
 *   │  PlayerAvatar        │  ← jugador local (abajo izquierda, flotante)
 *   │  PlayerHand          │  ← mano propia + acciones
 *   └──────────────────────┘
 *
 * @param {{
 *   gameState:  object,
 *   myUserId:   number,
 *   viewerUser: Usuario autenticado (AuthContext) para cosméticos y foto en el perfil local.
 *   onAction:   (actionType: string, data?: object) => void,
 *   isGameOverModalVisible: boolean,
 *   chatBubbles: object,
 *   onSendChat: (type: string, content: string) => void,
 * }} props
 */
export default function DominoGame({
  gameState,
  myUserId,
  viewerUser = null,
  onAction,
  isGameOverModalVisible = false,
  chatBubbles = {},
  onSendChat,
}) {
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

  const myEntry = players.find((p) => p.userId === myUserId) ?? null;

  /** Usuario local: perfil (cosméticos) + PR/rango de la partida si vienen en `players`. */
  const localUserForAvatar = useMemo(() => {
    if (!viewerUser) return null;
    return {
      ...viewerUser,
      pr:    myEntry?.pr ?? viewerUser.pr ?? 1000,
      rank:  myEntry?.rank ?? viewerUser.rank ?? 'BRONCE',
      avatar_id: viewerUser.avatar_id ?? 'telegram',
      frame_id: viewerUser.frame_id ?? 'rank',
      badge_contexts: viewerUser.badge_contexts ?? { global: 'default', domino: null },
    };
  }, [viewerUser, myEntry]);

  // Oponente: datos enriquecidos por game-server (displayName, cosméticos)
  const opponentData = players.find((p) => p.userId !== myUserId) ?? null;
  const opponentUserForAvatar = useMemo(() => {
    if (!opponentData) return null;
    return {
      ...opponentData,
      photo_url: opponentData.photo_url ?? null,
    };
  }, [opponentData]);

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
      {opponentUserForAvatar && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
          <ChatBubble bubble={chatBubbles[opponentData?.userId]} isOpponent={true} />
          <div style={{ pointerEvents: 'none' }}>
            <PlayerAvatar
              user={opponentUserForAvatar}
              size="medium"
              showName={false}
              showNameLabel
              showPR
              layoutSide="right"
              isActiveTurn={isOpponentTurn}
              score={scores[opponentData?.userId] ?? 0}
              targetScore={targetScore}
              tileCount={opponentTileCount}
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
        disabled={isGameOverModalVisible || status === 'FINISHED'}
      />

      {/* ── Marco del Jugador Local (Abajo Izquierda) ── */}
      {localUserForAvatar && (
        <div style={{ position: 'absolute', bottom: '148px', left: '16px', zIndex: 40, pointerEvents: 'none' }}>
          {onSendChat && (
            <PlayerChatControls onSendChat={(type, content) => onSendChat?.(type, content)} />
          )}
          <ChatBubble bubble={chatBubbles[myUserId]} isOpponent={false} />
          <div style={{ pointerEvents: 'auto' }}>
<PlayerAvatar
              user={localUserForAvatar}
              size="medium"
              showName={false}
              showNameLabel
              showPR
              layoutSide="left"
              isActiveTurn={isMyTurn}
              score={scores[myUserId] ?? 0}
              targetScore={targetScore}
              tileCount={null}
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
