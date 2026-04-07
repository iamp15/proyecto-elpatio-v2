import { createContext, useContext, useMemo, useState } from 'react';

const SplashPhaseContext = createContext(null);

/**
 * Fase global del splash: durante 'splash' el Dominó difiere navegación por reconnect_game.
 */
export function SplashPhaseProvider({ children }) {
  const [phase, setPhase] = useState('splash');

  const value = useMemo(
    () => ({
      phase,
      completeSplashPhase: () => setPhase('ready'),
    }),
    [phase],
  );

  return <SplashPhaseContext.Provider value={value}>{children}</SplashPhaseContext.Provider>;
}

export function useSplashPhase() {
  const ctx = useContext(SplashPhaseContext);
  if (!ctx) {
    throw new Error('useSplashPhase debe usarse dentro de SplashPhaseProvider');
  }
  return ctx;
}
