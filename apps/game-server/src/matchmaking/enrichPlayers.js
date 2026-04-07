const { User } = require('@el-patio/database');
const configManager = require('../config/ConfigManager');

/**
 * Enriquece los jugadores de una sala con displayName y rank desde la BD.
 * @param {import('./Room')} room
 * @returns {Promise<Array<{ userId: number, socketId: string, pr: number, rank: string, displayName: string, avatar_id: string, frame_id: string, badge_contexts: object, badge_id: string }>>}
 */
async function enrichPlayersWithUsernames(room) {
  const base = room.getPublicPlayers();
  const enriched = await Promise.all(
    base.map(async (p) => {
      const u = await User.findById(p.userId).lean().select(
        'nickname tg_firstName tg_username rank avatar_id frame_id badge_id badge_contexts',
      );
      const nick = u?.nickname != null && String(u.nickname).trim() !== '' ? String(u.nickname).trim() : '';
      const first = u?.tg_firstName != null && String(u.tg_firstName).trim() !== '' ? String(u.tg_firstName).trim() : '';
      const uname = u?.tg_username != null && String(u.tg_username).trim() !== '' ? String(u.tg_username).trim() : '';
      const displayName = nick || first || uname || `Jugador ${String(p.userId).slice(-2)}`;
      const rank = u?.rank ?? configManager.getRankForPR('domino', p.pr ?? 1000);
      const badgeId = u?.badge_id ?? 'default';
      const badge_contexts = u?.badge_contexts && typeof u.badge_contexts === 'object'
        ? { global: 'default', domino: null, ...u.badge_contexts }
        : { global: badgeId, domino: null };
      return {
        userId:      p.userId,
        socketId:    p.socketId,
        pr:          p.pr ?? 1000,
        rank,
        displayName,
        avatar_id:   u?.avatar_id ?? 'telegram',
        frame_id:    u?.frame_id ?? 'rank',
        badge_id:    badgeId,
        badge_contexts,
      };
    }),
  );
  return enriched;
}

module.exports = { enrichPlayersWithUsernames };
