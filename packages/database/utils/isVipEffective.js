/**
 * VIP activo: `is_vip` explícito y `expiresAt` estrictamente posterior a ahora.
 * No usar `days_left` ni inferir VIP solo por `is_vip`.
 *
 * @param {object|null|undefined} vipStatus - user.vip_status
 * @returns {boolean}
 */
function isVipEffective(vipStatus) {
  if (!vipStatus || typeof vipStatus !== 'object') return false;
  if (vipStatus.is_vip !== true) return false;
  const exp = vipStatus.expiresAt;
  if (exp == null) return false;
  const t = exp instanceof Date ? exp.getTime() : new Date(exp).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/**
 * @param {object|null|undefined} user - documento o lean con `vip_status`
 * @returns {boolean}
 */
function isUserVip(user) {
  return isVipEffective(user?.vip_status);
}

module.exports = { isVipEffective, isUserVip };
