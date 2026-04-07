/** Misma ruta que `public/assets/splash_bg.png` (preload en index.html). */
export const SPLASH_BG_PUBLIC_URL = '/assets/splash_bg.png';

/** Tiempo mínimo visible del splash (evita parpadeo si los datos llegan muy rápido). */
export const SPLASH_MIN_MS = 3000;

export function splashMinimumDelayPromise(ms = SPLASH_MIN_MS) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Tope de espera por init_lobby_config antes de continuar (evita splash infinito). */
export const LOBBY_CONFIG_TIMEOUT_MS = 20000;

/** Margen tras conectar el socket para que el handshake emita reconnect_game / init_lobby. */
export const ACTIVE_GAME_HANDSHAKE_MS = 1200;
