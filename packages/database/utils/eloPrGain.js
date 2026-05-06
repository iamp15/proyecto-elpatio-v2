/**
 * Delta de PR estilo ELO (suma cero por enfrentamiento).
 * La liga usada para K SIEMPRE es la del ganador.
 *
 * @param {number} winnerPR
 * @param {number} loserPR
 * @param {string} winnerLeague - Liga del ganador (BRONCE, PLATA, ORO, DIAMANTE)
 * @returns {number}
 */
function calculatePRGain(winnerPR, loserPR, winnerLeague) {
  let K;
  switch (String(winnerLeague || '').toUpperCase()) {
    case 'BRONCE':
      K = 64;
      break;
    case 'PLATA':
      K = 48;
      break;
    case 'ORO':
      K = 32;
      break;
    case 'DIAMANTE':
      K = 24;
      break;
    default:
      K = 32;
  }
  const expected = 1 / (1 + Math.pow(10, (loserPR - winnerPR) / 400));
  return Math.max(1, Math.round(K * (1 - expected)));
}

module.exports = { calculatePRGain };
