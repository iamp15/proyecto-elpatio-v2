import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { resolveDisplayName } from '../../../../lib/userDisplayName';

/**
 * Partícula de brillo para la animación de victoria.
 */
function GlowParticle({ delay, x, y }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 0],
        scale:   [0, 1, 0.5],
        x,
        y,
      }}
      transition={{ duration: 1.2, delay, ease: 'easeOut' }}
      style={{
        position:     'absolute',
        top:          '50%',
        left:         '50%',
        width:        6,
        height:       6,
        borderRadius: '50%',
        background:   'var(--domino-neon)',
        boxShadow:    '0 0 8px var(--domino-neon)',
        pointerEvents: 'none',
      }}
    />
  );
}

const PARTICLES = [
  { x: -80,  y: -90,  delay: 0.1  },
  { x:  80,  y: -80,  delay: 0.15 },
  { x: -60,  y: -110, delay: 0.2  },
  { x:  55,  y: -115, delay: 0.05 },
  { x: -100, y: -50,  delay: 0.25 },
  { x:  100, y: -55,  delay: 0.1  },
  { x: -30,  y: -130, delay: 0.3  },
  { x:  35,  y: -125, delay: 0.18 },
];

/**
 * Modal de fin de partida.
 * Se muestra como overlay sobre el tablero, con backdrop blur.
 *
 * Ganador: ¡VICTORIA! + animación de escala + contador de premio neón + partículas.
 * Perdedor: "Buen intento" + desglose de puntos finales de todos los jugadores.
 *
 * @param {{
 *   winnerId:     number,
 *   myUserId:     number,
 *   prize_piedras: number,
 *   finalScores:  Object.<number, number>,
 *   playerOrder:  number[],
 *   onLobby:      () => void,
 * }} props
 */
export default function GameOverModal({
  winnerId,
  myUserId,
  prize_piedras,
  finalScores = {},
  playerOrder = [],
  players = [],
  prDelta = 0,
  currencyDelta = 0,
  systemMessage = null,
  onLobby,
}) {
  const { t } = useTranslation();
  const isWinner   = winnerId === myUserId;

  const myPlayer = players.find((p) => String(p.userId) === String(myUserId)) ?? null;
  const opponentPlayer = players.find((p) => String(p.userId) !== String(myUserId)) ?? null;

  return (
    <AnimatePresence>
      {/* Capa de fondo — backdrop blur */}
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position:        'absolute',
          inset:           0,
          zIndex:          50,
          background:      'rgba(13, 17, 23, 0.75)',
          backdropFilter:  'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         '24px',
        }}
      >
        {/* Partículas (solo ganador) */}
        {isWinner && PARTICLES.map((p, i) => (
          <GlowParticle key={i} {...p} />
        ))}

        {/* Tarjeta principal */}
        <motion.div
          initial={{ scale: 0.65, opacity: 0, y: 40 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit={{   scale: 0.85,  opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.05 }}
          style={{
            width:          '100%',
            maxWidth:       340,
            borderRadius:   20,
            background:     'var(--domino-surface-2)',
            border:         `1.5px solid ${isWinner ? 'rgba(0,229,204,0.35)' : 'var(--domino-border-2)'}`,
            backdropFilter: 'blur(24px)',
            overflow:       'hidden',
            display:        'flex',
            flexDirection:  'column',
            position:       'relative',
          }}
        >
          {/* Franja superior de color */}
          <div style={{
            height:     4,
            background: isWinner
              ? 'linear-gradient(90deg, #00e5cc, #00b4d8)'
              : 'linear-gradient(90deg, #374151, #4b5563)',
          }} />

          <div style={{
            padding:       '28px 24px 24px',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           '20px',
          }}>
            {/* Icono animado */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0   }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
              style={{ fontSize: '3rem', lineHeight: 1, userSelect: 'none' }}
            >
              {isWinner ? '🏆' : '🎯'}
            </motion.div>

            {systemMessage && (
              <p
                style={{
                  margin:       0,
                  fontSize:     '0.9rem',
                  lineHeight:   1.35,
                  color:        'var(--domino-text-muted)',
                  textAlign:    'center',
                  fontWeight:   500,
                  maxWidth:     '100%',
                }}
              >
                {systemMessage}
              </p>
            )}

            {/* Título */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0  }}
              transition={{ delay: 0.3 }}
              style={{ textAlign: 'center' }}
            >
              <h2 style={{
                margin:        0,
                fontSize:      isWinner ? '1.8rem' : '1.4rem',
                fontWeight:    800,
                letterSpacing: '-0.03em',
                color:         isWinner ? 'var(--domino-neon)' : 'var(--domino-text)',
                textShadow:    isWinner ? '0 0 24px var(--domino-neon-glow)' : 'none',
              }}>
                {isWinner ? t('gameOverModal.victory') : t('gameOverModal.goodTry')}
              </h2>
              {!isWinner && (
                <p style={{
                  margin:     '4px 0 0',
                  fontSize:   '0.85rem',
                  color:      'var(--domino-text-muted)',
                  fontWeight: 400,
                }}>
                  {t('gameOverModal.keepPracticing')}
                </p>
              )}
            </motion.div>

            {/* Desglose de puntos finales: VS directo entre jugador y oponente */}
            {Object.keys(finalScores).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: isWinner ? 0.55 : 0.4 }}
                style={{ width: '100%' }}
              >
                <div className="flex justify-around items-center bg-black/30 p-4 rounded-lg mb-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-300">
                      {resolveDisplayName(myPlayer, t('gameBoard.you'))}
                    </p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {finalScores[myUserId] ?? 0} {t('gameOverModal.pts')}
                    </p>
                  </div>
                  <div className="text-2xl font-black text-gray-500">
                    VS
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-300">
                      {resolveDisplayName(opponentPlayer, t('gameBoard.rival'))}
                    </p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {opponentPlayer ? (finalScores[opponentPlayer.userId] ?? 0) : 0} {t('gameOverModal.pts')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Variaciones de PR (y Piedras solo para ganador) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: isWinner ? 0.6 : 0.45 }}
              className="flex justify-center gap-8 mb-2"
            >
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-[0.16em]">Rating (PR)</p>
                <p className={`text-2xl font-black ${isWinner ? 'text-green-400' : 'text-red-500'}`}>
                  {prDelta > 0 ? '+' : ''}{prDelta}
                </p>
              </div>
              {isWinner && (
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-[0.16em]">
                    {t('gameOverModal.stones')}
                  </p>
                  <p className="text-2xl font-black text-green-400">
                    +{currencyDelta}
                  </p>
                </div>
              )}
            </motion.div>

            {/* Botón Volver al Lobby */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: isWinner ? 0.65 : 0.5 }}
              whileTap={{ scale: 0.96 }}
              className="domino-btn domino-btn-primary"
              style={{ width: '100%', fontSize: '0.95rem', padding: '13px 20px' }}
              onClick={onLobby}
            >
              {t('gameOverModal.backToLobby')}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
