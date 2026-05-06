/**
 * Calcula el delta de PR usando la fórmula ELO con un factor K dinámico.
 * La liga usada para K SIEMPRE es la del ganador.
 * El ganador suma el valor retornado; el perdedor lo resta.
 *
 * @param {number} winnerPR - PR actual del ganador
 * @param {number} loserPR  - PR actual del perdedor (o promedio si es equipo)
 * @param {string} winnerLeague - Liga del ganador (bronce, plata, oro, diamante)
 * @returns {number} delta de PR (siempre positivo, mínimo 1)
 */
function calculatePRGain(winnerPR, loserPR, winnerLeague) {
  let K;
  switch (String(winnerLeague || '').toLowerCase()) {
    case 'bronce':
      K = 64;
      break;
    case 'plata':
      K = 48;
      break;
    case 'oro':
      K = 32;
      break;
    case 'diamante':
      K = 24;
      break;
    default:
      K = 32; 
  }

  const expected = 1 / (1 + Math.pow(10, (loserPR - winnerPR) / 400));
  return Math.max(1, Math.round(K * (1 - expected)));
}

module.exports = { calculatePRGain };
