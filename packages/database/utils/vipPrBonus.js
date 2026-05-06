/**
 * Bono de prestigio VIP (PR impreso): extra solo para el ganador VIP según la liga de la sala.
 * No forma parte del delta del perdedor (suma cero en base; el bono se inyecta al ganador).
 */

const BONUS_MULTIPLIER_BY_ROOM_CATEGORY = Object.freeze({
  BRONCE:   0.5,
  PLATA:    0.25,
  ORO:      0.1,
  DIAMANTE: 0,
});

/**
 * @param {string} [roomCategoryId] - categoryId de la sala (BRONCE, PLATA, …)
 * @returns {number}
 */
function getVipPrPrestigeBonusMultiplier(roomCategoryId) {
  const key = String(roomCategoryId || '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(BONUS_MULTIPLIER_BY_ROOM_CATEGORY, key)
    ? BONUS_MULTIPLIER_BY_ROOM_CATEGORY[key]
    : 0;
}

/**
 * @param {number} basePrGain - Delta base ELO (entero >= 1 en la práctica)
 * @param {string} [roomCategoryId]
 * @param {boolean} winnerIsVip
 * @returns {number}
 */
function computeVipPrestigePrBonus(basePrGain, roomCategoryId, winnerIsVip) {
  if (!winnerIsVip) return 0;
  const mult = getVipPrPrestigeBonusMultiplier(roomCategoryId);
  if (mult <= 0) return 0;
  const base = Math.floor(Number(basePrGain));
  if (!Number.isFinite(base) || base < 0) return 0;
  return Math.floor(base * mult);
}

module.exports = {
  getVipPrPrestigeBonusMultiplier,
  computeVipPrestigePrBonus,
  BONUS_MULTIPLIER_BY_ROOM_CATEGORY,
};
