const K = 32;

/**
 * Calcula el delta de PR usando la fórmula ELO.
 * El ganador suma el valor retornado; el perdedor lo resta.
 *
 * @param {number} winnerPR - PR actual del ganador
 * @param {number} loserPR  - PR actual del perdedor (o promedio si es equipo)
 * @returns {number} delta de PR (siempre positivo, mínimo 1)
 */
function calculatePRGain(winnerPR, loserPR) {
  const expected = 1 / (1 + Math.pow(10, (loserPR - winnerPR) / 400));
  return Math.max(1, Math.round(K * (1 - expected)));
}

module.exports = { calculatePRGain };
