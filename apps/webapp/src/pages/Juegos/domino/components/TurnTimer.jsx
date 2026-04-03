import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameSounds from '../hooks/useGameSounds';

export default function TurnTimer({ turnEndsAt, isMyTurn }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const sounds = useGameSounds();

  useEffect(() => {
    if (!turnEndsAt) {
      setTimeLeft(null);
      return undefined;
    }

    let tickedForTen = false;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((turnEndsAt - now) / 1000));
      setTimeLeft(remaining);

      // Reproduce el tick exactamente al entrar en los 10 segundos.
      if (remaining === 10 && !tickedForTen && isMyTurn) {
        sounds.playTick?.();
        tickedForTen = true;
      }
    }, 200);

    return () => clearInterval(interval);
  }, [turnEndsAt, isMyTurn, sounds]);

  const isUrgent = timeLeft !== null && timeLeft <= 10 && timeLeft > 0;

  // Posición: abajo-derecha para el turno propio, arriba-derecha para el del oponente.
  const positionClass = isMyTurn
    ? 'bottom-[12.125rem] right-6'
    : 'top-36 right-6';

  return (
    <AnimatePresence>
      {isUrgent && (
        <motion.div
          key={isMyTurn ? 'my-turn' : 'opponent-turn'}
          initial={{ opacity: 0, scale: 0.5, y: isMyTurn ? 15 : -15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className={`absolute ${positionClass} z-50 flex items-center gap-1.5 rounded-full border border-red-500 bg-black/80 px-3 py-1.5 shadow-[0_0_12px_rgba(239,68,68,0.5)]`}
        >
          <motion.div
            animate={{
              rotate: [0, 180, 180, 360],
              color: ['#ffffff', '#ef4444', '#ffffff', '#ef4444'],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-lg leading-none"
          >
            ⏳
          </motion.div>

          {/* Sin animación de escala en el número para evitar el efecto de "pop" que
              hace percibir la cápsula más grande durante la transición */}
          <motion.span
            key={timeLeft}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="w-6 text-center font-mono text-lg font-black leading-none text-red-500"
          >
            {timeLeft}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
