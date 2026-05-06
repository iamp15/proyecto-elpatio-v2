/**
 * Premio de cierre competitivo: pozo total menos rake de liga.
 * Aplica a partida normal y a abandono tras una mano válida.
 * Si el ganador es VIP, el rake se reduce un 20 % (solo afecta al ganador VIP).
 *
 * @param {number} totalPoolSubunits - Pozo total en subunidades (piedras × 100)
 * @param {number} leagueRakePercent - Porcentaje de rake de la liga (0–100)
 * @param {boolean} winnerIsVip
 * @returns {{ baseRake_subunits: number, finalRake_subunits: number, rawPrize_subunits: number }}
 */
function calculateDominoNormalPrize(totalPoolSubunits, leagueRakePercent, winnerIsVip) {
  const totalPool = Math.floor(Number(totalPoolSubunits));
  const pct = Number(leagueRakePercent);
  const rakePct = Number.isFinite(pct) ? Math.max(0, pct) : 0;

  const baseRake = Math.floor((totalPool * rakePct) / 100);
  const finalRake = winnerIsVip ? Math.floor(baseRake * 0.8) : baseRake;
  const rawPrize = Math.max(0, totalPool - finalRake);

  return {
    baseRake_subunits: baseRake,
    finalRake_subunits: finalRake,
    rawPrize_subunits: rawPrize,
  };
}

module.exports = { calculateDominoNormalPrize };
