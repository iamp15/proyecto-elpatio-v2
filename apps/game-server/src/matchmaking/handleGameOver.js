const { runDominoSettlement, User } = require('@el-patio/database');
const configManager = require('../config/ConfigManager');

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

  if (earlyForfeit) {
    prize_subunits = entryFee_subunits;
    settlementKind = 'forfeit_early';
  } else if (forfeit) {
    /** Caso B: abandono tras al menos una mano — pozo completo (ambas apuestas), sin fraude por matchmaking. */
    prize_subunits = totalPot_subunits;
    settlementKind = 'forfeit_full';
  } else {
    prize_subunits = Math.floor(totalPot_subunits * 0.8);
    settlementKind = 'normal';
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
    getRankForPR: (pr) => configManager.getRankForPR('domino', pr),
  });

  if (result.idempotent) {
    console.warn(`[handleGameOver] Liquidación ya existía (${settlementRef}), sin duplicar movimientos.`);
  } else {
    const wUser = await User.findById(winnerId).lean();
    if (wUser) {
      winnerPlayer.socket?.emit('balance_updated', {
        balance_subunits: wUser.balance_subunits,
        piedras: wUser.balance_subunits / 100,
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
      lp.socket?.emit('pr_updated', {
        pr: lu.pr,
        rank: lu.rank,
        gain: -result.loserPrLoss,
      });
    }
  }

  room.finish();

  const basePayload = {
    roomId: room.roomId,
    winnerId,
    prize_subunits,
    prize_piedras: prize_subunits / 100,
    commission_subunits,
    commission_pct,
    finalScores,
    prChanges: {
      winnerGain: result.winnerPrGain,
      loserLoss: result.loserPrLoss,
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
