const { isVipEffective } = require('../utils/isVipEffective');

const VIP_BADGE_ID = 'badge_vip';
const DEFAULT_BADGE_ID = 'badge_bronce';
const PROFILE_BADGE_SUBTYPE = 'profile_badge';

/**
 * Si el VIP no está activo y el usuario lleva badge_vip equipado,
 * restaura badge_bronce en `badge_id` e inventario (sin quitar badge_vip del inventario).
 *
 * @param {import('mongoose').Document} user
 * @returns {boolean} true si hubo cambios en memoria
 */
function applyExpiredVipBadgeFallback(user) {
  if (!user || isVipEffective(user.vip_status)) return false;

  const inventory = Array.isArray(user.inventory) ? user.inventory : [];
  const vipBadgeEntry = inventory.find((entry) => entry?.itemId === VIP_BADGE_ID);
  const wearingVipBadge =
    user.badge_id === VIP_BADGE_ID || vipBadgeEntry?.isEquipped === true;

  if (!wearingVipBadge) return false;

  user.badge_id = DEFAULT_BADGE_ID;

  for (const entry of inventory) {
    if (entry?.subType === PROFILE_BADGE_SUBTYPE) {
      entry.isEquipped = entry.itemId === DEFAULT_BADGE_ID;
    }
  }

  let bronzeEntry = inventory.find((entry) => entry?.itemId === DEFAULT_BADGE_ID);
  if (!bronzeEntry) {
    user.inventory.push({
      itemId: DEFAULT_BADGE_ID,
      category: 'cosmetic',
      subType: PROFILE_BADGE_SUBTYPE,
      quantity: 1,
      isEquipped: true,
      acquiredAt: new Date(),
    });
  } else {
    bronzeEntry.isEquipped = true;
  }

  return true;
}

/**
 * @param {import('mongoose').Document} user
 * @returns {Promise<boolean>} true si se persistieron cambios
 */
async function ensureExpiredVipBadgeReverted(user) {
  if (!user?._id) return false;
  const changed = applyExpiredVipBadgeFallback(user);
  if (changed) await user.save();
  return changed;
}

module.exports = {
  VIP_BADGE_ID,
  DEFAULT_BADGE_ID,
  applyExpiredVipBadgeFallback,
  ensureExpiredVipBadgeReverted,
};
