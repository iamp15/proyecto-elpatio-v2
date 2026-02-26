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
