import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * Anuncio de victoria por abandono/desconexión del rival.
 * Solo para el jugador que no abandonó; se muestra antes del GameOverModal.
 *
 * @param {{ visible: boolean, reason: 'disconnect'|'forfeit', opponentName: string }} props
 */
export default function OpponentAbandonWinBanner({ visible, reason, opponentName }) {
  const { t } = useTranslation();

  const titleKey =
    reason === 'disconnect'
      ? 'forfeitWinAnnouncement.titleDisconnect'
      : 'forfeitWinAnnouncement.titleForfeit';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="opponent-abandon-banner"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 z-[88] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md px-6"
        >
          <motion.div
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="max-w-md w-full rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/90 to-black/90 p-8 text-center shadow-[0_0_40px_rgba(16,185,129,0.25)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90 mb-3">
              {t('forfeitWinAnnouncement.kicker')}
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-2">
              {t(titleKey, { name: opponentName })}
            </h2>
            <p className="text-base text-white/75 font-medium">
              {t('forfeitWinAnnouncement.subtitle')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
