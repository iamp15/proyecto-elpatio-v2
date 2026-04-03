import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DominoTile from './DominoTile';

/**
 * Calcula si una ficha puede jugarse en algún extremo del tablero.
 * @param {{ a: number, b: number }} tile
 * @param {{ left: number, right: number } | null} boardEnds
 * @returns {{ playable: boolean, side: 'left' | 'right' | null, bothEnds: boolean }}
 */
function getTilePlayability(tile, boardEnds) {
  if (!boardEnds) return { playable: true, side: null, bothEnds: false }; // tablero vacío
  const { left, right } = boardEnds;
  const fitsLeft  = tile.a === left  || tile.b === left;
  const fitsRight = tile.a === right || tile.b === right;
  if (fitsLeft && fitsRight) return { playable: true, side: null, bothEnds: true };
  if (fitsRight) return { playable: true, side: 'right', bothEnds: false };
  if (fitsLeft)  return { playable: true, side: 'left', bothEnds: false };
  return { playable: false, side: null, bothEnds: false };
}

/**
 * Panel inferior con la mano del jugador.
 * Fila única con scroll horizontal centrado.
 * El tamaño de las fichas se reduce dinámicamente según la cantidad.
 *
 * @param {{
 *   hand:                    Array<{ a: number, b: number }>,
 *   boardEnds:               { left: number, right: number } | null,
 *   isMyTurn:                boolean,
 *   stockCount:              number,
 *   selectedTileForPosition: { a: number, b: number } | null,
 *   onPlayTile:              (tile: object, side: string) => void,
 *   onSelectTileForPosition: (tile: object) => void,
 *   onCancelSelectPosition:  () => void,
 *   onDrawTile:              () => void,
 *   onPass:                  () => void,
 * }} props
 */
export default function PlayerHand({
  hand,
  boardEnds,
  isMyTurn,
  stockCount,
  selectedTileForPosition = null,
  onPlayTile,
  onSelectTileForPosition,
  onCancelSelectPosition,
  onDrawTile,
  onPass,
}) {
  const { t } = useTranslation();
  const [tileSize, setTileSize] = useState(38);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      if (width < 375) {
        setTileSize(30);
      } else if (width < 430) {
        setTileSize(34);
      } else {
        setTileSize(38);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const timeoutId = setTimeout(() => {
        const container = scrollContainerRef.current;
        container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [hand.length]);

  const [autoPassing, setAutoPassing] = useState(false);
  const autoPassTimerRef = useRef(null);

  const hasPlayableTile = hand.some(
    (tile) => getTilePlayability(tile, boardEnds).playable,
  );
  const canDraw = isMyTurn && !hasPlayableTile && stockCount > 0;
  const shouldAutoPass = isMyTurn && !hasPlayableTile && stockCount === 0;

  const triggerAutoPass = useCallback(() => {
    if (autoPassTimerRef.current) return;
    setAutoPassing(true);
    autoPassTimerRef.current = setTimeout(() => {
      onPass();
      setAutoPassing(false);
      autoPassTimerRef.current = null;
    }, 2500);
  }, [onPass]);

  useEffect(() => {
    if (shouldAutoPass) {
      triggerAutoPass();
    } else {
      if (autoPassTimerRef.current) {
        clearTimeout(autoPassTimerRef.current);
        autoPassTimerRef.current = null;
      }
      setAutoPassing(false);
    }
  }, [shouldAutoPass, triggerAutoPass]);

  useEffect(() => {
    return () => {
      if (autoPassTimerRef.current) {
        clearTimeout(autoPassTimerRef.current);
      }
    };
  }, []);

  function handleTileClick(tile) {
    if (!isMyTurn) return;
    const { playable, side, bothEnds } = getTilePlayability(tile, boardEnds);
    if (!playable) return;
    if (bothEnds) {
      if ((boardEnds && boardEnds.left === boardEnds.right) || hand.length === 1) {
        onPlayTile(tile, 'right');
        return;
      }
      if (onSelectTileForPosition) {
        onSelectTileForPosition(tile);
        return;
      }
    }
    onPlayTile(tile, side ?? 'right');
  }

  const isSelectedForPosition = (tile) =>
    selectedTileForPosition &&
    tile.a === selectedTileForPosition.a &&
    tile.b === selectedTileForPosition.b;

  return (
    <div className="domino-glass-strong" style={{
      height:          '140px',
      minHeight:       '140px',
      maxHeight:       '140px',
      padding:         '12px 0',
      display:         'flex',
      flexDirection:   'column',
      justifyContent:  'center',
      position:        'relative',
    }}>
      {/* Indicador de turno */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexShrink:     0,
        paddingInline:  '12px',
        marginBottom:   '6px',
      }}>
        <span style={{
          fontSize:   '0.75rem',
          fontWeight: 600,
          color:      autoPassing ? '#facc15' : (isMyTurn ? 'var(--domino-neon)' : 'var(--domino-text-muted)'),
          textShadow: autoPassing ? '0 0 8px rgba(250,204,21,0.5)' : (isMyTurn ? '0 0 8px var(--domino-neon-glow)' : 'none'),
          transition: 'color 0.3s, text-shadow 0.3s',
        }}>
          {autoPassing
            ? t('playerHand.autoPass')
            : selectedTileForPosition
              ? t('playerHand.tapBoardToPlay')
              : (isMyTurn ? t('playerHand.yourTurn') : t('playerHand.waiting'))}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--domino-text-muted)' }}>
          {hand.length} {hand.length === 1 ? t('playerHand.tile') : t('playerHand.tiles')}
        </span>
      </div>

      {/* Fichas: Fila única con Scroll 'Safe Center' */}
      <div
        ref={scrollContainerRef}
        className="domino-scrollbar-hide"
        style={{
          flex:       1,
          minHeight:  0,
          width:      '100%',
          overflowX:  'auto',
          overflowY:  'hidden',
          display:    'flex',
        }}
      >
        <div style={{
          display:       'flex',
          flexDirection: 'row',
          alignItems:    'center',
          gap:           tileSize <= 30 ? '6px' : '8px',
          minWidth:      '100%',
          paddingLeft:   '16px',
          paddingRight:  '16px',
        }}>
          {/* Espaciador izquierdo: empuja las fichas al centro si hay espacio */}
          <div style={{ marginRight: 'auto' }} />

          <AnimatePresence>
            {hand.map((tile, i) => {
              const { playable } = getTilePlayability(tile, boardEnds);
              return (
                <motion.div
                  key={`hand-tile-${tile.a}-${tile.b}`}
                  layout="position"
                  initial={{ opacity: 0, y: 30, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="flex-shrink-0"
                >
                  <DominoTile
                    tile={tile}
                    dealIndex={i}
                    isPlayable={isMyTurn && playable}
                    isSelectedForPosition={isSelectedForPosition(tile)}
                    disabled={!isMyTurn || !playable}
                    dimmed={isMyTurn && !playable}
                    onClick={() => handleTileClick(tile)}
                    handSize={tileSize}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Espaciador derecho: Bloque físico incompresible para forzar el margen final en el scroll */}
          <div style={{
            marginLeft: 'auto',
            minWidth: '32px', // Este es el espacio real que quedará al final
            width: '32px',
            flexShrink: 0,
            height: '1px', // Forzamos al navegador a renderizarlo como un objeto físico
          }} />
        </div>
      </div>

      {/* Botones de Acción Flotantes */}
      <div
        className="absolute right-4 z-50 pointer-events-none flex gap-2"
        style={{ top: '-52px' }}
      >
        <AnimatePresence>
          {isMyTurn && hand.length > 0 && canDraw && !selectedTileForPosition && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="flex gap-2 pointer-events-auto"
            >
              <button
                className="domino-btn domino-btn-primary shadow-lg shadow-black/50"
                style={{ minWidth: '120px' }}
                onClick={onDrawTile}
              >
                {t('playerHand.drawTile')}
                <span
                  className="domino-neon-badge"
                  style={{
                    background: 'rgba(13, 17, 23, 0.95)',
                    color:      '#00e5cc',
                    border:     '1px solid rgba(0, 229, 204, 0.6)',
                    zIndex:     1,
                    marginLeft: '6px',
                  }}
                >
                  {stockCount}
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botón Cancelar Selección Flotante */}
      <div
        className="absolute right-4 z-50 pointer-events-none"
        style={{ top: '-52px' }}
      >
        <AnimatePresence>
          {selectedTileForPosition && onCancelSelectPosition && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="pointer-events-auto"
            >
              <button
                className="domino-btn domino-btn-ghost shadow-lg shadow-black/50"
                style={{ minWidth: '110px' }}
                onClick={onCancelSelectPosition}
              >
                {t('playerHand.cancel')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
