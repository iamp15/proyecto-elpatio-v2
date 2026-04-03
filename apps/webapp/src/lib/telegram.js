/**
 * Devuelve la instancia de Telegram.WebApp si está disponible y
 * la plataforma es nativa (no 'unknown', que es lo que se ve en Chrome/Safari).
 * @returns {object|null}
 */
function getTelegramWebApp() {
  if (
    typeof window !== 'undefined' &&
    window.Telegram?.WebApp &&
    window.Telegram.WebApp.platform !== 'unknown'
  ) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function showBackButton() {
  getTelegramWebApp()?.BackButton.show();
}

export function hideBackButton() {
  getTelegramWebApp()?.BackButton.hide();
}

export function onBackButtonClick(callback) {
  getTelegramWebApp()?.BackButton.onClick(callback);
}

export function offBackButtonClick(callback) {
  getTelegramWebApp()?.BackButton.offClick(callback);
}

export function triggerHaptic(style = 'light') {
  try { getTelegramWebApp()?.HapticFeedback?.impactOccurred(style); } catch (_) {}
}

/**
 * Expande la WebApp de Telegram para ocupar toda la pantalla disponible.
 * Evita bordes inferiores y problemas de viewport en móviles.
 */
export function expandWebApp() {
  try { getTelegramWebApp()?.expand?.(); } catch (_) {}
}

/**
 * Notificación de turno con haptic feedback
 * Reutiliza la detección de entorno existente (getTelegramWebApp)
 */
export function triggerTurnNotification() {
  const twa = getTelegramWebApp();
  
  if (twa?.HapticFeedback?.notificationOccurred) {
    // Telegram Mini App - API nativa para notificaciones
    try {
      twa.HapticFeedback.notificationOccurred('warning');
      console.log('[Haptic] TMA warning feedback enviado');
    } catch (err) {
      console.warn('[Haptic] Error al enviar feedback TMA:', err.message);
    }
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    // Navegador web tradicional - fallback con Vibration API
    try {
      // Patrón: vibrar-pausa-vibrar para notificación de turno
      navigator.vibrate([200, 100, 200]);
      console.log('[Haptic] Vibration API fallback activado');
    } catch (err) {
      console.warn('[Haptic] Error al usar Vibration API:', err.message);
    }
  } else {
    // Sin soporte para feedback táctil
    console.log('[Haptic] No hay soporte para feedback táctil disponible');
  }
}

/**
 * Versión alternativa que también incluye el impacto visual/sonoro existente
 * Puede usarse si queremos combinar ambos efectos
 */
export function triggerEnhancedTurnNotification() {
  // Primero el haptic feedback de turno
  triggerTurnNotification();
  
  // Luego el impacto visual/sonoro ligero existente
  triggerHaptic('light');
}
