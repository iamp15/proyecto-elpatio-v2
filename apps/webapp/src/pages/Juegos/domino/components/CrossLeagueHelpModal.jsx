import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * Modal informativo sobre el modo cruce de ligas en matchmaking.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function CrossLeagueHelpModal({ open, onClose }) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cross-league-help-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cross-league-help-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="cross-league-help-overlay"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="cross-league-help-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cross-league-help-title" className="cross-league-help-title">
              {t('lobby.crossLeagueHelpTitle')}
            </h2>
            <p className="cross-league-help-body">{t('lobby.crossLeagueHelpBody')}</p>
            <button
              type="button"
              className="domino-btn domino-btn-primary cross-league-help-close"
              onClick={onClose}
            >
              {t('lobby.crossLeagueHelpClose')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
