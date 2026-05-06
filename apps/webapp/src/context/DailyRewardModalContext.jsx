import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const DailyRewardModalContext = createContext(null);

export function DailyRewardModalProvider({ children }) {
  const [reward, setReward] = useState(null);

  const showDailyRewardModal = useCallback(({ amount }) => {
    const safeAmount = Number(amount || 0);
    if (safeAmount <= 0) return;
    setReward({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      amount: safeAmount,
    });
  }, []);

  const closeDailyRewardModal = useCallback(() => {
    setReward(null);
  }, []);

  const value = useMemo(
    () => ({ showDailyRewardModal }),
    [showDailyRewardModal],
  );

  const couponText = reward?.amount === 1 ? 'cupón' : 'cupones';

  return (
    <DailyRewardModalContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {reward && (
          <motion.div
            key={reward.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 4000,
              display: 'grid',
              placeItems: 'center',
              padding: '24px',
              background: 'rgba(2, 6, 23, 0.62)',
              backdropFilter: 'blur(8px)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-reward-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 18 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              style={{
                position: 'relative',
                width: 'min(100%, 380px)',
                borderRadius: '28px',
                padding: '30px 22px 22px',
                background: 'linear-gradient(180deg, rgba(255, 251, 235, 0.98), rgba(254, 243, 199, 0.98))',
                boxShadow: '0 24px 70px rgba(0, 0, 0, 0.35)',
                color: '#442006',
                textAlign: 'center',
              }}
            >
              <button
                type="button"
                onClick={closeDailyRewardModal}
                aria-label="Cerrar recompensa diaria"
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '36px',
                  height: '36px',
                  border: 0,
                  borderRadius: '999px',
                  background: 'rgba(120, 53, 15, 0.12)',
                  color: '#78350f',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                x
              </button>

              <div
                aria-hidden="true"
                style={{
                  margin: '0 auto 12px',
                  width: '64px',
                  height: '64px',
                  borderRadius: '22px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  boxShadow: '0 14px 28px rgba(217, 119, 6, 0.35)',
                  fontSize: '2rem',
                }}
              >
                🎁
              </div>

              <h2
                id="daily-reward-title"
                style={{
                  margin: '0 0 8px',
                  fontSize: '1.35rem',
                  fontWeight: 900,
                }}
              >
                ¡Tu regalo diario ha llegado!
              </h2>

              <p
                style={{
                  margin: '0 0 22px',
                  fontSize: '1rem',
                  lineHeight: 1.45,
                  color: '#78350f',
                }}
              >
                Has recibido {reward.amount} {couponText} de Bronce.
              </p>

              <button
                type="button"
                onClick={closeDailyRewardModal}
                style={{
                  width: '100%',
                  border: 0,
                  borderRadius: '16px',
                  padding: '13px 18px',
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 900,
                  boxShadow: '0 12px 26px rgba(21, 128, 61, 0.3)',
                }}
              >
                Aceptar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DailyRewardModalContext.Provider>
  );
}

export function useDailyRewardModal() {
  const ctx = useContext(DailyRewardModalContext);
  if (!ctx) {
    throw new Error('useDailyRewardModal debe usarse dentro de DailyRewardModalProvider');
  }
  return ctx;
}
