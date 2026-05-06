const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { calculatePRGain } = require('../utils/eloPrGain');
const { toWholeStoneSubunits } = require('../utils/stoneEconomy');
const { computeVipPrestigePrBonus } = require('../utils/vipPrBonus');
const { isUserVip } = require('../utils/isVipEffective');
const { CURRENT_SEASON } = require('../utils/currentSeason');
const { upsertInventoryReward } = require('./inventoryService');
const { getPromotionRewardsForLeague, normalizeLeagueId } = require('./seasonPromotionRewards');

const RANK_ORDER = ['BRONCE', 'PLATA', 'ORO', 'DIAMANTE'];

function getRankLevel(rank) {
  return RANK_ORDER.indexOf(String(rank || '').trim().toUpperCase());
}

function isPromotion(previousRank, nextRank) {
  const previousLevel = getRankLevel(previousRank);
  const nextLevel = getRankLevel(nextRank);
  return previousLevel >= 0 && nextLevel > previousLevel;
}

function syncSeasonProgress(user) {
  const currentProgress = user.season_progress;
  if (currentProgress?.season_id === CURRENT_SEASON && Array.isArray(currentProgress.claimed_leagues)) {
    return;
  }

  user.season_progress = {
    season_id: CURRENT_SEASON,
    claimed_leagues: [],
  };
}

function hasClaimedLeagueThisSeason(user, league) {
  const normalized = normalizeLeagueId(league);
  return Array.isArray(user.season_progress?.claimed_leagues)
    && user.season_progress.claimed_leagues.includes(normalized);
}

function grantPromotionRewards(user, league, now) {
  const normalized = normalizeLeagueId(league);
  const rewards = getPromotionRewardsForLeague(normalized);
  if (rewards.length === 0) return false;

  for (const reward of rewards) {
    upsertInventoryReward(user, reward, reward.quantity, now);
  }

  user.season_progress.claimed_leagues.push(normalized);
  user.pendingPromotion = normalized;
  return true;
}

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
 * @param {string} [params.league] - categoryId de la sala (BRONCE, PLATA, …): fallback K del ganador y multiplicador del bono VIP prestigio
 * @returns {Promise<{
 *   idempotent: boolean,
 *   winnerPrGain: number,
 *   loserPrLoss: number,
 *   winnerPrGainBase: number,
 *   winnerVipPrBonus: number,
 *   balanceAfterSubunits: number|null,
 * }>}
 */
async function runDominoSettlement({
  settlementRef,
  winnerId,
  loserUserIds,
  winnerPayoutSubunits,
  getRankForPR,
  league,
}) {
  if (typeof settlementRef !== 'string' || !settlementRef.length) {
    throw Object.assign(new Error('settlementRef inválido'), { statusCode: 400 });
  }
  const rawPayout = Number(winnerPayoutSubunits);
  if (!Number.isFinite(rawPayout) || rawPayout < 0) {
    throw Object.assign(new Error('winnerPayoutSubunits no puede ser negativo'), { statusCode: 400 });
  }
  winnerPayoutSubunits = toWholeStoneSubunits(rawPayout);

  const session = await mongoose.startSession();
  let idempotent = false;
  let winnerPrGain = 0;
  let loserPrLoss = 0;
  let winnerPrGainBase = 0;
  let winnerVipPrBonus = 0;
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

      const winnerLeague = getRankForPR(winnerPR);
      const leagueKey = typeof winnerLeague === 'string' && winnerLeague.length
        ? winnerLeague.toUpperCase()
        : (typeof league === 'string' ? league.toUpperCase() : 'BRONCE');
      const basePRGain = calculatePRGain(winnerPR, avgLoserPR, leagueKey);
      const roomCategoryId =
        typeof league === 'string' && league.length ? league.toUpperCase() : 'BRONCE';
      const winnerIsVip = isUserVip(winner);
      const vipBonusPR = computeVipPrestigePrBonus(basePRGain, roomCategoryId, winnerIsVip);
      const winnerTotalPrDelta = basePRGain + vipBonusPR;

      winnerPrGainBase = basePRGain;
      winnerVipPrBonus = vipBonusPR;
      winnerPrGain = winnerTotalPrDelta;
      loserPrLoss = basePRGain;

      const newWinnerPR = winnerPR + winnerTotalPrDelta;
      const newWinnerRank = getRankForPR(newWinnerPR);

      winner.balance_subunits = Number(winner.balance_subunits || 0) + winnerPayoutSubunits;
      winner.pr = newWinnerPR;
      winner.rank = newWinnerRank;

      if (isPromotion(winnerLeague, newWinnerRank)) {
        syncSeasonProgress(winner);
        if (!hasClaimedLeagueThisSeason(winner, newWinnerRank)) {
          grantPromotionRewards(winner, newWinnerRank, new Date());
        }
      }

      const updatedWinner = await winner.save({ session });

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
        const newPr = Math.max(0, cur - basePRGain);
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
    winnerPrGainBase,
    winnerVipPrBonus,
    balanceAfterSubunits,
  };
}

module.exports = { runDominoSettlement };
