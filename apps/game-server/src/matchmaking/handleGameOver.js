const { createTransaction, User } = require('@el-patio/database');
const { calculatePRGain } = require('./calculatePRGain');
const configManager = require('../config/ConfigManager');

/**
 * Calcula y persiste los cambios de PR para todos los jugadores de la sala
 * tras finalizar una partida. Emite 'pr_updated' por socket a cada jugador.
 *
 * @param {import('./Room').Room} room
 * @param {number} winnerId
 * @returns {Promise<{ winnerGain: number, loserLoss: number }>}
 */
async function updatePRAfterGame(room, winnerId) {
  const winnerPlayer = room.players.find((p) => p.userId === winnerId);
  const loserPlayers = room.players.filter((p) => p.userId !== winnerId);

  if (!winnerPlayer || loserPlayers.length === 0) return { winnerGain: 0, loserLoss: 0 };

  const [winnerUser, ...loserUsers] = await Promise.all([
    User.findById(winnerId).lean(),
    ...loserPlayers.map((p) => User.findById(p.userId).lean()),
  ]);

  const winnerCurrentPR = winnerUser?.pr ?? 1000;
  const avgLoserPR = loserUsers.reduce((sum, u) => sum + (u?.pr ?? 1000), 0) / loserUsers.length;

  const prGain = calculatePRGain(winnerCurrentPR, avgLoserPR);

  const newWinnerPR   = winnerCurrentPR + prGain;
  const newWinnerRank = configManager.getRankForPR('domino', newWinnerPR);

  await User.findByIdAndUpdate(winnerId, { pr: newWinnerPR, rank: newWinnerRank });
  winnerPlayer.socket.emit('pr_updated', {
    pr:   newWinnerPR,
    rank: newWinnerRank,
    gain: +prGain,
  });

  for (let i = 0; i < loserPlayers.length; i++) {
    const loserPlayer  = loserPlayers[i];
    const loserCurrentPR = loserUsers[i]?.pr ?? 1000;
    const newLoserPR   = Math.max(0, loserCurrentPR - prGain);
    const newLoserRank = configManager.getRankForPR('domino', newLoserPR);

    await User.findByIdAndUpdate(loserPlayer.userId, { pr: newLoserPR, rank: newLoserRank });
    loserPlayer.socket.emit('pr_updated', {
      pr:   newLoserPR,
      rank: newLoserRank,
      gain: -prGain,
    });
  }

  return { winnerGain: prGain, loserLoss: prGain };
}

async function handleGameOver(room, winnerId, nsp, finalScores = {}) {
  const winnerPlayer = room.players.find((p) => p.userId === winnerId);
  if (!winnerPlayer) {
    throw Object.assign(
      new Error('winnerId no pertenece a esta sala'),
      { statusCode: 400 },
    );
  }

  const { entryFee_subunits, maxPlayers } = room.config;
  const totalPot_subunits   = entryFee_subunits * maxPlayers;
  const prize_subunits      = Math.floor(totalPot_subunits * 0.8);
  const commission_subunits = totalPot_subunits - prize_subunits;

  const tx = await createTransaction({
    userId:                winnerId,
    amount_subunits:       prize_subunits,
    type:                  'WIN',
    reference_external_id: room.roomId,
  });

  winnerPlayer.socket.emit('balance_updated', {
    balance_subunits: tx.balance_after_subunits,
    piedras:          tx.balance_after_subunits / 100,
  });

  const { winnerGain, loserLoss } = await updatePRAfterGame(room, winnerId);

  room.finish();

  nsp.to(room.roomId).emit('game_over', {
    roomId:             room.roomId,
    winnerId,
    prize_subunits,
    prize_piedras:      prize_subunits / 100,
    commission_subunits,
    commission_pct:     20,
    finalScores,
    prChanges: {
      winnerGain,
      loserLoss,
    },
  });
}

module.exports = { handleGameOver };
