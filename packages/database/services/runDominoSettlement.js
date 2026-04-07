const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { calculatePRGain } = require('../utils/eloPrGain');

/**
 * Liquida premio (Piedras) + PR ganador/perdedores en una sola transacción Mongo.
 * Idempotente por `settlementRef`: no duplica movimientos si se reintenta tras un fallo.
 *
 * @param {object} params
 * @param {string} params.settlementRef - Referencia única por partida y tipo de cierre
 * @param {number} params.winnerId
 * @param {number[]} params.loserUserIds
 * @param {number} params.winnerPayoutSubunits - Crédito al ganador (>= 0)
 * @param {(pr: number) => string} params.getRankForPR
 * @returns {Promise<{
 *   idempotent: boolean,
 *   winnerPrGain: number,
 *   loserPrLoss: number,
 *   balanceAfterSubunits: number|null,
 * }>}
 */
async function runDominoSettlement({
  settlementRef,
  winnerId,
  loserUserIds,
  winnerPayoutSubunits,
  getRankForPR,
}) {
  if (typeof settlementRef !== 'string' || !settlementRef.length) {
    throw Object.assign(new Error('settlementRef inválido'), { statusCode: 400 });
  }
  if (winnerPayoutSubunits < 0) {
    throw Object.assign(new Error('winnerPayoutSubunits no puede ser negativo'), { statusCode: 400 });
  }

  const session = await mongoose.startSession();
  let idempotent = false;
  let winnerPrGain = 0;
  let loserPrLoss = 0;
  let balanceAfterSubunits = null;

  try {
    await session.withTransaction(async () => {
      const dup = await Transaction.findOne({ reference_external_id: settlementRef }).session(session);
      if (dup) {
        idempotent = true;
        return;
      }

      const winner = await User.findById(winnerId).session(session);
      if (!winner) {
        throw Object.assign(new Error(`Ganador no encontrado: ${winnerId}`), { statusCode: 404 });
      }

      const losers =
        loserUserIds.length > 0
          ? await User.find({ _id: { $in: loserUserIds } }).session(session)
          : [];

      const winnerPR = winner.pr ?? 1000;
      const avgLoserPR =
        losers.length > 0
          ? losers.reduce((sum, u) => sum + (u.pr ?? 1000), 0) / losers.length
          : winnerPR;

      const prGain = calculatePRGain(winnerPR, avgLoserPR);
      winnerPrGain = prGain;
      loserPrLoss = prGain;

      const newWinnerPR = winnerPR + prGain;
      const newWinnerRank = getRankForPR(newWinnerPR);

      const updateWinner = {
        $inc: { balance_subunits: winnerPayoutSubunits },
        $set: { pr: newWinnerPR, rank: newWinnerRank },
      };

      const updatedWinner = await User.findOneAndUpdate(
        { _id: winnerId },
        updateWinner,
        { new: true, session },
      );

      if (!updatedWinner) {
        throw Object.assign(new Error('No se pudo actualizar al ganador'), { statusCode: 500 });
      }

      await Transaction.create(
        [
          {
            user_id: winnerId,
            amount_subunits: winnerPayoutSubunits,
            type: 'WIN',
            reference_external_id: settlementRef,
            status: 'COMPLETED',
            balance_after_subunits: updatedWinner.balance_subunits,
          },
        ],
        { session },
      );

      for (const loser of losers) {
        const cur = loser.pr ?? 1000;
        const newPr = Math.max(0, cur - prGain);
        const newRank = getRankForPR(newPr);
        await User.findOneAndUpdate(
          { _id: loser._id },
          { $set: { pr: newPr, rank: newRank } },
          { session },
        );
      }

      balanceAfterSubunits = updatedWinner.balance_subunits;
    });
  } finally {
    session.endSession();
  }

  return {
    idempotent,
    winnerPrGain,
    loserPrLoss,
    balanceAfterSubunits,
  };
}

module.exports = { runDominoSettlement };
