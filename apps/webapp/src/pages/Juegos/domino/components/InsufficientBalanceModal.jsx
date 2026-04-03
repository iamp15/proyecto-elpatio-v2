import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * Modal cuando el jugador intenta jugar sin piedras suficientes para la entrada.
 * @param {{ open: boolean, serverMessage?: string | null, onClose: () => void, onGoToStore: () => void }} props
 */
export default function InsufficientBalanceModal({ open, serverMessage, onClose, onGoToStore }) {
  const { t } = useTranslation();
  const detail = serverMessage && String(serverMessage).trim();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="insufficient-balance-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="insufficient-balance-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            background: 'rgba(13, 17, 23, 0.82)',
            backdropFilter: 'blur(12px) saturate(140%)',
            WebkitBackdropFilter: 'blur(12px) saturate(140%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            style={{
              width: '100%',
              maxWidth: 340,
              borderRadius: 20,
              background: 'var(--domino-surface-2)',
              border: '1.5px solid var(--domino-border-2)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                height: 4,
                background: 'linear-gradient(90deg, #f59e0b, #d97706)',
              }}
            />
            <div
              style={{
                padding: '24px 22px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.25rem', lineHeight: 1, marginBottom: 10 }} aria-hidden>
                  💎
                </div>
                <h2
                  id="insufficient-balance-title"
                  style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: 'var(--domino-text)',
                  }}
                >
                  {t('lobby.insufficientBalanceTitle')}
                </h2>
                {detail ? (
                  <>
                    <p
                      style={{
                        margin: '10px 0 0',
                        fontSize: '0.88rem',
                        lineHeight: 1.45,
                        color: 'var(--domino-text-muted)',
                        fontWeight: 400,
                      }}
                    >
                      {detail}
                    </p>
                    <p
                      style={{
                        margin: '10px 0 0',
                        fontSize: '0.82rem',
                        lineHeight: 1.4,
                        color: 'var(--domino-text-muted)',
                      }}
                    >
                      {t('lobby.rechargeStonesHint')}
                    </p>
                  </>
                ) : (
                  <p
                    style={{
                      margin: '10px 0 0',
                      fontSize: '0.88rem',
                      lineHeight: 1.45,
                      color: 'var(--domino-text-muted)',
                      fontWeight: 400,
                    }}
                  >
                    {t('lobby.insufficientBalanceDescription')}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="domino-btn domino-btn-primary"
                  style={{ width: '100%', fontSize: '0.92rem', padding: '12px 18px' }}
                  onClick={() => {
                    onGoToStore();
                    onClose();
                  }}
                >
                  {t('lobby.goToStore')}
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="domino-btn domino-btn-ghost"
                  style={{ width: '100%', fontSize: '0.88rem', padding: '10px 16px' }}
                  onClick={onClose}
                >
                  {t('lobby.modalClose')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
