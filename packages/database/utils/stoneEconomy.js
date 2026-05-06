/**
 * Economía de piedras: 1 piedra = 100 subunidades. Sin decimales en saldos ni premios.
 */

const SUBUNITS_PER_STONE = 100;

/**
 * Alinea subunidades al múltiplo de 100 inferior (piedras enteras).
 * @param {number} subunits
 * @returns {number}
 */
function toWholeStoneSubunits(subunits) {
  const n = Number(subunits);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n / SUBUNITS_PER_STONE) * SUBUNITS_PER_STONE;
}

/**
 * Piedras enteras a partir de subunidades (truncado hacia -∞; saldo no negativo en práctica).
 * @param {number} subunits
 * @returns {number}
 */
function subunitsToStonesFloor(subunits) {
  const n = Number(subunits);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n / SUBUNITS_PER_STONE);
}

module.exports = {
  SUBUNITS_PER_STONE,
  toWholeStoneSubunits,
  subunitsToStonesFloor,
};
