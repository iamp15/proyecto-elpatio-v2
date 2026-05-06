const {
  runDominoSettlement,
  User,
  AppConfigManager,
  toWholeStoneSubunits,
  subunitsToStonesFloor,
  isUserVip,
} = require('@el-patio/database');
const { calculateDominoNormalPrize } = require('./calculateDominoNormalPrize');

const MSG_WIN_FORFEIT =
  'Tu rival ha huido de la batalla. Victoria por abandono.';
const MSG_LOSS_FORFEIT = 'Has perdido la partida por abandono.';

/**
 * Cierra la partida: liquidación atómica (Piedras + PR) e idempotente por sala/tipo,
 * luego emite sockets y marca la sala como finalizada.
 *
 * @param {import('./Room').Room} room
 * @param {number} winnerId
 * @param {import('socket.io').Namespace} nsp
 * @param {object} finalScores
 * @param {object} [forfeitMeta]
 * @param {boolean} [forfeitMeta.forfeit]
 * @param {number} [forfeitMeta.forfeitingUserId]
 * @param {number} [forfeitMeta.disconnectedPlayerId]
 */
async function handleGameOver(room, winnerId, nsp, finalScores = {}, forfeitMeta = {}) {
  void nsp;
  const winnerPlayer = room.players.find((p) => p.userId === winnerId);
  if (!winnerPlayer) {
    throw Object.assign(
      new Error('winnerId no pertenece a esta sala'),
      { statusCode: 400 },
    );
  }

  const loserPlayers = room.players.filter((p) => p.userId !== winnerId);
  const { entryFee_subunits, maxPlayers } = room.config;
  const totalPot_subunits = entryFee_subunits * maxPlayers;

  const forfeit = Boolean(forfeitMeta.forfeit);
  /** Anti-fraude: sin primera mano cerrada, solo se devuelve la propia apuesta al ganador. */
  const earlyForfeit = forfeit && !room.firstHandCompleted;

  let prize_subunits;
  let settlementKind;
  /** Partida normal o abandono tras primera mano: % rake de la liga. */
  let leagueRakePercent = null;

  if (earlyForfeit) {
    prize_subunits = toWholeStoneSubunits(entryFee_subunits);
    settlementKind = 'forfeit_early';
  } else {
    leagueRakePercent = AppConfigManager.getLeagueRakePercent(room.config.categoryId);
    const winnerRow = await User.findById(winnerId).lean().select('vip_status');
    const winnerIsVip = isUserVip(winnerRow);
    const { rawPrize_subunits: rawPrize } = calculateDominoNormalPrize(
      totalPot_subunits,
      leagueRakePercent,
      winnerIsVip,
    );
    /** Premio siempre en piedras enteras (múltiplo de 100 subunidades). El resto queda como comisión implícita. */
    prize_subunits = toWholeStoneSubunits(rawPrize);
    settlementKind = forfeit ? 'forfeit_full' : 'normal';
  }

  const prize_piedras = subunitsToStonesFloor(prize_subunits);
  let prize_piedras_base = prize_piedras;
  let vip_piedras_bonus = 0;
  if ((settlementKind === 'normal' || settlementKind === 'forfeit_full') && leagueRakePercent != null) {
    const { rawPrize_subunits: rawNoVip } = calculateDominoNormalPrize(
      totalPot_subunits,
      leagueRakePercent,
      false,
    );
    const subNoVip = toWholeStoneSubunits(rawNoVip);
    prize_piedras_base = subunitsToStonesFloor(subNoVip);
    vip_piedras_bonus = Math.max(0, prize_piedras - prize_piedras_base);
  }

  const commission_subunits = totalPot_subunits - prize_subunits;
  const commission_pct =
    totalPot_subunits > 0
      ? Math.round((commission_subunits / totalPot_subunits) * 100)
      : 0;

  const settlementRef = `${room.roomId}:domino:${settlementKind}`;

  const result = await runDominoSettlement({
    settlementRef,
    winnerId,
    loserUserIds: loserPlayers.map((p) => Number(p.userId)),
    winnerPayoutSubunits: prize_subunits,
    getRankForPR: (pr) => AppConfigManager.getRankForPR('domino', pr),
    league: room.config.categoryId, // Se pasa el nuevo parámetro 'league' usando 'categoryId'
  });

  if (result.idempotent) {
    console.warn(`[handleGameOver] Liquidación ya existía (${settlementRef}), sin duplicar movimientos.`);
  } else {
    const wUser = await User.findById(winnerId).lean();
    if (wUser) {
      winnerPlayer.socket?.emit('balance_updated', {
        balance_subunits: wUser.balance_subunits,
        piedras: subunitsToStonesFloor(wUser.balance_subunits),
      });
      winnerPlayer.socket?.emit('pr_updated', {
        pr: wUser.pr,
        rank: wUser.rank,
        gain: result.winnerPrGain,
      });
    }

    for (const lp of loserPlayers) {
      const lu = await User.findById(lp.userId).lean();
      if (!lu) continue;
      lp.socket?.emit('balance_updated', {
        balance_subunits: lu.balance_subunits,
        piedras: subunitsToStonesFloor(lu.balance_subunits),
      });
      lp.socket?.emit('pr_updated', {
        pr: lu.pr,
        rank: lu.rank,
        gain: -result.loserPrLoss,
      });
    }
  }

  const participants = room.players.map((p) => Number(p.userId)).filter(Number.isFinite);
  if (participants.length === 2) {
    room.dominoLiveContext?.roomManager?.recordRecentMatch(participants[0], participants[1]);
  }

  room.finish();

  const basePayload = {
    roomId: room.roomId,
    winnerId,
    prize_subunits,
    prize_piedras,
    prize_piedras_base: prize_piedras_base,
    vip_piedras_bonus: vip_piedras_bonus,
    commission_subunits,
    commission_pct,
    finalScores,
    prChanges: {
      winnerGain:     result.winnerPrGain,
      loserLoss:      result.loserPrLoss,
      winnerGainBase: result.winnerPrGainBase ?? result.loserPrLoss,
      vipPrBonus:     result.winnerVipPrBonus ?? 0,
    },
    forfeit,
    forfeitingUserId: forfeitMeta.forfeitingUserId ?? null,
    disconnectedPlayerId: forfeitMeta.disconnectedPlayerId ?? null,
    forfeitEarlyAbandon: earlyForfeit,
    settlementRef,
  };

  room.players.forEach((p) => {
    const isWinner = Number(p.userId) === Number(winnerId);
    const systemMessage = forfeit
      ? isWinner
        ? MSG_WIN_FORFEIT
        : MSG_LOSS_FORFEIT
      : null;
    p.socket?.emit('game_over', {
      ...basePayload,
      systemMessage,
    });
  });
}

module.exports = { handleGameOver };
