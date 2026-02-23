const crypto = require('crypto');

const AUTH_DATE_MAX_AGE_SECONDS = 86400; // 24 horas

/**
 * Valida el initData de Telegram Mini App según la documentación oficial.
 * @param {string} initDataString - String crudo (query string) que envía Telegram en WebApp.initData
 * @param {string} botToken - Token del bot (TELEGRAM_BOT_TOKEN)
 * @returns {boolean}
 */
function validateInitData(initDataString, botToken) {
  if (!initDataString || typeof initDataString !== 'string' || !botToken || typeof botToken !== 'string') {
    return false;
  }
  const params = new URLSearchParams(initDataString);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (computedHash !== hash) return false;
  const authDate = params.get('auth_date');
  if (authDate) {
    const age = Math.floor(Date.now() / 1000) - Number(authDate);
    if (age > AUTH_DATE_MAX_AGE_SECONDS || age < 0) return false;
  }
  return true;
}

/**
 * Extrae el objeto user del initData (solo usar después de validar el hash).
 * @param {string} initDataString
 * @returns {{ id: number, username?: string, first_name?: string, ... } | null}
 */
function parseInitDataUser(initDataString) {
  if (!initDataString || typeof initDataString !== 'string') return null;
  const params = new URLSearchParams(initDataString);
  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

module.exports = { validateInitData, parseInitDataUser };
