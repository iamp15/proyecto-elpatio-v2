const { User, AppConfigManager, isVipEffective } = require('@el-patio/database');

/**
 * Enriquece los jugadores de una sala con displayName y rank desde la BD.
 * @param {import('./Room')} room
 * @returns {Promise<Array<{ userId: number, socketId: string, pr: number, rank: string, displayName: string, avatar_id: string, frame_id: string, badge_id: string, vip_status: { is_vip: boolean, start_date: *, expiresAt: * } }>>}
 */
async function enrichPlayersWithUsernames(room) {
  const base = room.getPublicPlayers();
  const enriched = await Promise.all(
    base.map(async (p) => {
      const u = await User.findById(p.userId).lean().select(
        'nickname tg_firstName tg_username rank avatar_id frame_id badge_id vip_status',
      );
      const nick = u?.nickname != null && String(u.nickname).trim() !== '' ? String(u.nickname).trim() : '';
      const first = u?.tg_firstName != null && String(u.tg_firstName).trim() !== '' ? String(u.tg_firstName).trim() : '';
      const uname = u?.tg_username != null && String(u.tg_username).trim() !== '' ? String(u.tg_username).trim() : '';
      const displayName = nick || first || uname || `Jugador ${String(p.userId).slice(-2)}`;
      const rank = u?.rank ?? AppConfigManager.getRankForPR('domino', p.pr ?? 1000);
      const badgeId = u?.badge_id ?? 'badge_bronce';
      const rawVip = u?.vip_status && typeof u.vip_status === 'object' ? u.vip_status : {};
      return {
        userId:      p.userId,
        socketId:    p.socketId,
        pr:          p.pr ?? 1000,
        rank,
        displayName,
        avatar_id:   u?.avatar_id ?? 'avatar_default',
        frame_id:    u?.frame_id ?? 'frame_bronce',
        badge_id:    badgeId,
        vip_status: {
          is_vip: isVipEffective(rawVip),
          start_date: rawVip.start_date ?? null,
          expiresAt: rawVip.expiresAt != null ? rawVip.expiresAt : null,
        },
      };
    }),
  );
  return enriched;
}

module.exports = { enrichPlayersWithUsernames };
