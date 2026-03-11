import { useRef, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import DominoTile from './DominoTile';
import { calculateTilePositions } from '../calculateTilePositions';

const PADDING = 120;

/**
 * Tablero central del juego de Dominó — Sistema de coordenadas absolutas (La Culebrita).
 * Centro del tablero: X: 0, Y: 0. Cámara con auto-zoom en pantallas pequeñas.
 * Cuando el jugador selecciona una ficha que encaja en ambos extremos, muestra
 * sombras clickeables en cada posición posible.
 *
 * @param {{
 *   board:                   Array<{ tile: { a: number, b: number }, side: string, playedBy: number }>,
 *   selectedTileForPosition: { a: number, b: number } | null,
 *   onSelectPosition:        (side: 'left' | 'right') => void,
 * }} props
 */
export default function DominoBoard({ board, selectedTileForPosition = null, onSelectPosition, localPlayerId }) {
  const { t } = useTranslation();
  const boardContainerRef = useRef(null);
  const [camera, setCamera] = useState({ scale: 1, x: 0, y: 0 });

  const { positions: positionedTiles, extents, endPositions } = useMemo(
    () => calculateTilePositions(board, selectedTileForPosition),
    [board, selectedTileForPosition]
  );

  const showPlacementShadows = selectedTileForPosition && onSelectPosition && endPositions && board.length > 0;

  useEffect(() => {
    if (!boardContainerRef.current || board.length === 0) {
      setCamera({ scale: 1, x: 0, y: 0 });
      return;
    }

    const updateCamera = () => {
      if (!boardContainerRef.current || board.length === 0) return;
      const { clientWidth, clientHeight } = boardContainerRef.current;

      // 1. Dimensiones Totales Reales de la figura geométrica
      const totalWidth = extents.maxX - extents.minX;
      const totalHeight = extents.maxY - extents.minY;

      // 2. Centro de Masa Exacto
      const centerX = (extents.minX + extents.maxX) / 2;
      const centerY = (extents.minY + extents.maxY) / 2;

      // 3. Cálculo de Escala basado en el tamaño total (no en la distancia desde 0,0)
      // Márgenes aumentados para proteger las UI superpuestas (Player Frames)
      const paddingX = 100; // Margen lateral (50px por lado)
      const paddingY = 240; // Margen vertical para las manos y perfiles

      // Evitamos dividir por cero si es la primera ficha
      const scaleX = totalWidth > 0 ? (clientWidth - paddingX) / totalWidth : 1;
      const scaleY = totalHeight > 0 ? (clientHeight - paddingY) / totalHeight : 1;

      const newScale = Math.min(1, scaleX, scaleY);

      // 4. Multiplicar el offset por la escala: si el tablero se reduce al 50%,
      //    la distancia física a mover también debe reducirse al 50%
      setCamera({
        scale: newScale,
        x: -centerX * newScale,
        y: -centerY * newScale,
      });
    };

    updateCamera();

    const resizeObserver = new ResizeObserver(updateCamera);
    resizeObserver.observe(boardContainerRef.current);

    return () => resizeObserver.disconnect();
  }, [board.length, extents.minX, extents.maxX, extents.minY, extents.maxY]);

  return (
    <div
      ref={boardContainerRef}
      className="flex-1 relative w-full min-h-0 overflow-hidden"
    >
      {board.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5"
          style={{
            color:          'var(--domino-text-muted)',
            fontSize:       '0.875rem',
            fontWeight:     500,
          }}
        >
          <div
            className="rounded-full border border-dashed flex items-center justify-center text-2xl"
            style={{
              width:        48,
              height:       48,
              borderColor:  'var(--domino-border-2)',
            }}
          >
            🁣
          </div>
          <span>{t('dominoBoard.empty')}</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            {t('dominoBoard.playFirstTile')}
          </span>
        </motion.div>
      ) : (
        <>
          {/* Cámara: centro de masa + auto-zoom + pan dinámico */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-0 h-0 origin-center"
            style={{ transformOrigin: 'center center' }}
            animate={{
              scale: camera.scale,
              x: camera.x,
              y: camera.y,
            }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          >
            <AnimatePresence initial={false}>
            {positionedTiles.map((entry, i) => {
              const { tile, x, y, rotation, boardFlip = false, playedBy } = entry;

              const isMyTile = playedBy === localPlayerId;
              const startY = isMyTile ? 600 : -600;

              return (
                <motion.div
                  key={`board-tile-${tile.a}-${tile.b}`}
                  initial={{ x: 0, y: startY, rotate: rotation, opacity: 0, scale: 0.2 }}
                  animate={{
                    x,
                    y,
                    rotate: rotation,
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 40,
                    mass: 0.5,
                    restDelta: 0.001,
                  }}
                  style={{
                    position: 'absolute',
                    zIndex: i,
                    marginLeft: -20,
                    marginTop: -40,
                  }}
                  className="top-0 left-0 origin-center"
                >
                  <DominoTile
                    tile={tile}
                    isBoard
                    isVertical={false}
                    boardFlip={boardFlip}
                  />
                </motion.div>
              );
            })}
            {/* Sombras clickeables cuando la ficha encaja en ambos extremos */}
            {showPlacementShadows && (
              <>
                <motion.div
                  key="placement-shadow-left"
                  initial={{ x: endPositions.left.x, y: endPositions.left.y, opacity: 0, scale: 0.8 }}
                  animate={{
                    x: endPositions.left.x,
                    y: endPositions.left.y,
                    opacity: 1,
                    scale: 1,
                    rotate: endPositions.left.rotation,
                  }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute',
                    marginLeft: -20,
                    marginTop: -40,
                    width: 40,
                    height: 80,
                    transformOrigin: 'center center',
                    zIndex: 1000,
                    cursor: 'pointer',
                    background: 'rgba(0, 229, 204, 0.15)',
                    border: '2px dashed var(--domino-neon)',
                    borderRadius: 'var(--domino-radius)',
                    boxShadow: '0 0 16px var(--domino-neon-dim)',
                  }}
                  className="top-0 left-0 origin-center"
                  onClick={() => onSelectPosition('left')}
                  whileHover={{ scale: 1.08, background: 'rgba(0, 229, 204, 0.25)' }}
                  whileTap={{ scale: 0.98 }}
                />
                <motion.div
                  key="placement-shadow-right"
                  initial={{ x: endPositions.right.x, y: endPositions.right.y, opacity: 0, scale: 0.8 }}
                  animate={{
                    x: endPositions.right.x,
                    y: endPositions.right.y,
                    opacity: 1,
                    scale: 1,
                    rotate: endPositions.right.rotation,
                  }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute',
                    marginLeft: -20,
                    marginTop: -40,
                    width: 40,
                    height: 80,
                    transformOrigin: 'center center',
                    zIndex: 1000,
                    cursor: 'pointer',
                    background: 'rgba(0, 229, 204, 0.15)',
                    border: '2px dashed var(--domino-neon)',
                    borderRadius: 'var(--domino-radius)',
                    boxShadow: '0 0 16px var(--domino-neon-dim)',
                  }}
                  className="top-0 left-0 origin-center"
                  onClick={() => onSelectPosition('right')}
                  whileHover={{ scale: 1.08, background: 'rgba(0, 229, 204, 0.25)' }}
                  whileTap={{ scale: 0.98 }}
                />
              </>
            )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </div>
  );
}
