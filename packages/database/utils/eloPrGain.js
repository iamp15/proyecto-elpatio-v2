const K = 32;

/**
 * Delta de PR estilo ELO (mismo criterio que el game-server).
 * @param {number} winnerPR
 * @param {number} loserPR
 * @returns {number}
 */
function calculatePRGain(winnerPR, loserPR) {
  const expected = 1 / (1 + Math.pow(10, (loserPR - winnerPR) / 400));
  return Math.max(1, Math.round(K * (1 - expected)));
}

module.exports = { calculatePRGain };
