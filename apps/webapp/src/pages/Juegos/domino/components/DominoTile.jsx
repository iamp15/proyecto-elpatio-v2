import { motion } from 'framer-motion';

/**
 * Posición de cada punto según el valor de la mitad (0–6).
 * El grid de la mitad es 3×3 (9 celdas, índice 0–8).
 * true = colocar punto en esa celda.
 *
 * Layout de celdas:
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */
const DOT_POSITIONS = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DotGrid({ value, dotSize }) {
  const active = DOT_POSITIONS[value] ?? [];
  const dot = `${dotSize}px`;
  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows:    'repeat(3, 1fr)',
      width:               '100%',
      height:              '100%',
      padding:             '4px',
      boxSizing:           'border-box',
    }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}>
          {active.includes(i) && (
            <span style={{
              display:      'block',
              width:        dot,
              height:       dot,
              borderRadius: '50%',
              background:   'var(--domino-dot)',
              flexShrink:   0,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Componente de ficha de dominó.
 *
 * @param {{
 *   tile:        { a: number, b: number },
 *   onClick?:    () => void,
 *   disabled?:   boolean,
 *   isPlayable?: boolean,
 *   isSelectedForPosition?: boolean,  // ficha elegida para jugar en extremo (modo selección)
 *   dealIndex?:  number,   // índice para escalonar animación de reparto
 *   isBoard?:    boolean,  // ficha en tablero (no interactiva, más pequeña)
 *   isVertical?: boolean,  // doble acostado (horizontal) en tablero
 *   boardFlip?:  boolean,  // rotar 180° para que el número de conexión quede hacia el centro
 *   layout?:     boolean,  // Framer Motion: animar reacomodo al cambiar de fila
 * }} props
 */
export default function DominoTile({
  tile,
  onClick,
  disabled = false,
  isPlayable = false,
  isSelectedForPosition = false,
  dealIndex = 0,
  isBoard = false,
  isVertical = false,
  boardFlip = false,
  layout = false,
  handSize = 44,
  dimmed = false,
}) {
  const { a, b } = tile;

  // Usamos el tamaño fijo para el tablero, o el configurable para la mano
  const size = isBoard ? 36 : handSize;
  const totalHeight = isBoard ? size * 2 + 3 : size * 2 + 4;
  const totalWidth  = isBoard ? size + 4 : size + 6;

  // Punto proporcional al tamaño de la ficha, siempre par para evitar medio píxel
  const dotSize = Math.round(size * 0.21 / 2) * 2;


  const borderColor = isSelectedForPosition
    ? 'var(--domino-neon)'
    : isPlayable
      ? '#E5C07B'
      : 'var(--domino-tile-border)';

  const boxShadow = isSelectedForPosition
    ? '0 0 0 2px var(--domino-neon), 0 0 20px var(--domino-neon-glow), 0 4px 12px rgba(0,0,0,0.5)'
    : isPlayable
      ? '0 0 0 2px #E5C07B, 0 4px 12px rgba(229, 192, 123, 0.4)'
      : '0 2px 4px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)';


  const handResponsiveClass = !isBoard
    ? 'shrink-0'
    : '';

  /* Tablero: dimensiones explícitas + shrink-0. Dobles: estructura vertical rotada 90° (contenido incluido). */
  const boardSizeClass = isBoard
    ? (isVertical ? 'shrink-0' : 'w-[40px] h-[80px] shrink-0')
    : '';

  const tileContent = (
    <motion.div
      layout={layout}
      onClick={!disabled ? onClick : undefined}
      initial={!isBoard ? { x: -300, opacity: 0 } : false}
      animate={{ x: 0, opacity: dimmed ? 0.4 : 1 }}
      transition={!isBoard ? {
        type:    'spring',
        stiffness: 260,
        damping:   22,
        delay:   dealIndex * 0.06,
      } : { duration: 0.2 }}
      whileHover={!isBoard && !disabled ? { scale: 1.1, y: -10, zIndex: 20 } : undefined}
      whileTap={!isBoard && !disabled ? { scale: 0.95 } : undefined}
      className={`${isBoard ? boardSizeClass : handResponsiveClass} flex flex-col items-stretch box-border origin-center`}
      style={{
        background:    'var(--domino-tile-bg)',
        border:        `2px solid ${borderColor}`,
        borderRadius:  'var(--domino-radius)',
        boxShadow,
        cursor:        !isBoard && !disabled ? 'pointer' : 'default',
        overflow:      'hidden',
        flexShrink:    0,
        userSelect:    'none',
        position:      !isBoard ? 'relative' : undefined,
        zIndex:        !isBoard ? 10 : undefined,
        width:         !isBoard ? totalWidth : (isBoard && isVertical ? 40 : undefined),
        height:        !isBoard ? totalHeight : (isBoard && isVertical ? 80 : undefined),
        filter:             dimmed ? 'grayscale(40%)' : 'none',
        transition:         'filter 0.2s ease',
        backfaceVisibility: 'hidden',
        WebkitFontSmoothing: 'antialiased',
        transform:          isBoard && !isVertical
          ? (boardFlip ? 'rotate(180deg) translateZ(0)' : 'translateZ(0)')
          : 'translateZ(0)',
      }}
    >
      {/* Mitad A — borde inferior como división central (píxel-perfecta, 50%) */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center box-border"
        style={{ borderBottom: '1px solid var(--domino-divider)' }}
      >
        <DotGrid value={a} dotSize={dotSize} />
      </div>

      {/* Mitad B — exactamente 50% */}
      <div className="flex-1 min-h-0 flex items-center justify-center box-border">
        <DotGrid value={b} dotSize={dotSize} />
      </div>
    </motion.div>
  );

  if (isBoard && isVertical) {
    return (
      <div
        className="shrink-0"
        style={{
          width:  80,
          height: 40,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position:      'absolute',
            left:          '50%',
            top:           '50%',
            width:         40,
            height:        80,
            minWidth:      40,
            minHeight:     80,
            marginLeft:    -20,
            marginTop:     -40,
            transform:     'rotate(90deg)',
            transformOrigin: 'center center',
          }}
        >
          {tileContent}
        </div>
      </div>
    );
  }

  return tileContent;
}
