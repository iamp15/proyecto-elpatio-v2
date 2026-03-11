import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useAnimation } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import LightningBolt from './LightningBolt';
import RankBadge from './RankBadge';

/** Colores PR por rango (metálicos). */
const RANK_COLORS = {
  BRONCE:   '#cd7f32',
  PLATA:    '#c5cdd3',
  ORO:      '#ffd54f',
  DIAMANTE: '#80deea',
};

/** Colores de resplandor para rayos (cian Diamante, ámbar Oro). */
const RANK_GLOW = {
  BRONCE:   '#cd7f32',
  PLATA:    '#c5cdd3',
  ORO:      '#ffb74d',
  DIAMANTE: '#80deea',
};

/**
 * Overlay épico "Partida Encontrada" (Versus Screen).
 * Se muestra como pantalla completa durante ~5s antes de revelar el tablero.
 *
 * @param {{
 *   playerMe:            { displayName: string, pr: number, rank?: string },
 *   playerOpponent:      { displayName: string, pr: number, rank?: string },
 *   onAnimationComplete: () => void,
 *   duration?:           number,
 * }} props
 */
export default function MatchFoundOverlay({
  playerMe,
  playerOpponent,
  onAnimationComplete,
  duration = 5000,
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('entering');
  const vsControls = useAnimation();
  const flashControls = useAnimation();

  const glowColor = RANK_GLOW[playerMe?.rank] ?? RANK_GLOW[playerOpponent?.rank] ?? RANK_GLOW.DIAMANTE;

  useEffect(() => {
    const exitDelay = duration - 600;
    const timer = setTimeout(() => {
      setPhase('exiting');
    }, exitDelay);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleExitComplete = () => {
    onAnimationComplete?.();
  };

  const prStyle = (rank) => ({
    fontSize:     '1.25rem',
    fontWeight:    700,
    color:        RANK_COLORS[rank] ?? RANK_COLORS.BRONCE,
    textShadow:   `0 0 8px ${(RANK_COLORS[rank] ?? RANK_COLORS.BRONCE)}88`,
  });

  const nameStyle = (rank) => {
    const glow = RANK_GLOW[rank] ?? RANK_GLOW.BRONCE;
    return {
      fontSize:     'clamp(2rem, 6vw, 3.5rem)',
      fontWeight:    900,
      color:        '#ffffff',
      textShadow:   `0 0 20px rgba(255,255,255,0.3), 0 0 24px ${glow}66, 0 2px 4px rgba(0,0,0,0.5)`,
      filter:       `drop-shadow(0 0 12px ${glow}44)`,
      lineHeight:   1.1,
      wordBreak:    'break-word',
    };
  };

  return createPortal(
    <motion.div
      className="fixed top-0 left-0 w-screen h-[100dvh] z-[9999] flex flex-col bg-black/90 backdrop-blur-md overflow-hidden"
      initial={{ opacity: 1 }}
      animate={phase === 'exiting' ? { opacity: 0 } : { opacity: 1 }}
      transition={{ opacity: { duration: 0.5, ease: 'easeInOut' } }}
      onAnimationComplete={phase === 'exiting' ? handleExitComplete : undefined}
    >
      {/* Degradado radial adicional en centro */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,0,0,0.4) 0%, transparent 70%)',
        }}
      />

      {/* Capa de rayos — z-index inferior a jugadores */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        <LightningBolt glowColor={glowColor} variant={0} />
        <LightningBolt glowColor={glowColor} variant={1} />
        <LightningBolt glowColor={glowColor} variant={2} />
      </div>

      {/* Destello ambiental al impacto del VS */}
      <motion.div
        className="absolute inset-0 z-[5] pointer-events-none bg-white"
        initial={{ opacity: 0 }}
        animate={flashControls}
      />

      {/* Mitad Superior — Oponente (entra desde arriba) */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-end pb-12 relative z-[2]"
        initial={{ y: -200 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        {/* Nombre arriba — blanco puro con resplandor de liga */}
        <motion.span
          className="text-center text-white inline-block"
          style={nameStyle(playerOpponent?.rank)}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {playerOpponent?.displayName ?? t('matchFoundOverlay.rival')}
        </motion.span>
        {/* Badge + PR — entrada con delay y zoom (scale 0 → 1.2 → 1) */}
        <motion.div
          className="flex items-center justify-center gap-2 mt-2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: 1 }}
          transition={{
            delay:      0.2,
            scale:      { duration: 0.4, ease: 'easeOut' },
            opacity:    { duration: 0.3 },
          }}
        >
          <RankBadge rank={playerOpponent?.rank} />
          <motion.span
            className="inline-block"
            style={prStyle(playerOpponent?.rank)}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          >
            {playerOpponent?.pr ?? 0} {t('matchFoundOverlay.pr')}
          </motion.span>
        </motion.div>
      </motion.div>

      {/* VS — Centro absoluto exacto; wrapper interno para screen shake al impacto */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <motion.div animate={vsControls}>
          <motion.span
            initial={{ scale: 5, opacity: 0, y: -60 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{
              delay:      0.25,
              type:       'spring',
              stiffness:  200,
              damping:    20,
            }}
            onAnimationComplete={() => {
              vsControls.start({
                x: [0, 5, -4, 3, -2, 0],
                y: [0, -3, 4, -2, 1, 0],
                transition: { duration: 0.2, ease: 'easeOut' },
              });
              flashControls.start({
                opacity: [0, 0.8, 0],
                transition: { duration: 0.25, ease: 'easeOut' },
              });
            }}
            style={{
              display:     'block',
              fontSize:     'clamp(3rem, 12vw, 6rem)',
              fontWeight:   900,
              fontStyle:    'italic',
              color:        '#ffffff',
              textShadow:   '0 0 30px rgba(255,255,255,0.5), 0 0 60px rgba(0,229,204,0.3)',
            }}
          >
            {t('matchFoundOverlay.vs')}
          </motion.span>
        </motion.div>
      </div>

      {/* Mitad Inferior — Tú (entra desde abajo) */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-start pt-12 relative z-[2]"
        initial={{ y: 200 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        {/* Nombre arriba — blanco puro con resplandor de liga */}
        <motion.span
          className="text-center text-white inline-block"
          style={nameStyle(playerMe?.rank)}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {playerMe?.displayName ?? t('matchFoundOverlay.you')}
        </motion.span>
        {/* Badge + PR — entrada con delay y zoom (scale 0 → 1.2 → 1) */}
        <motion.div
          className="flex items-center justify-center gap-2 mt-2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: 1 }}
          transition={{
            delay:      0.2,
            scale:      { duration: 0.4, ease: 'easeOut' },
            opacity:    { duration: 0.3 },
          }}
        >
          <RankBadge rank={playerMe?.rank} />
          <motion.span
            className="inline-block"
            style={prStyle(playerMe?.rank)}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          >
            {playerMe?.pr ?? 0} {t('matchFoundOverlay.pr')}
          </motion.span>
        </motion.div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
