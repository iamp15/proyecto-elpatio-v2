const { User } = require('@el-patio/database');
const configManager = require('../config/ConfigManager');

/**
 * Enriquece los jugadores de una sala con displayName y rank desde la BD.
 * @param {import('./Room')} room
 * @returns {Promise<Array<{ userId: number, socketId: string, pr: number, rank: string, displayName: string }>>}
 */
async function enrichPlayersWithUsernames(room) {
  const base = room.getPublicPlayers();
  const enriched = await Promise.all(
    base.map(async (p) => {
      const u = await User.findById(p.userId).lean().select('username rank');
      const displayName = u?.username
        ? String(u.username).trim() || `Jugador ${String(p.userId).slice(-2)}`
        : `Jugador ${String(p.userId).slice(-2)}`;
      const rank = u?.rank ?? configManager.getRankForPR('domino', p.pr ?? 1000);
      return {
        userId:      p.userId,
        socketId:    p.socketId,
        pr:          p.pr ?? 1000,
        rank,
        displayName,
      };
    }),
  );
  return enriched;
}

module.exports = { enrichPlayersWithUsernames };
