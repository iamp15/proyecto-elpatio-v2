const mongoose = require('mongoose');
const User = require('../models/User');

const EQUIP_FIELD_TO_SUBTYPE = {
  avatar_id: 'avatar_photo',
  frame_id: 'avatar_frame',
  badge_id: 'profile_badge',
};

/**
 * Revoca un item condicionado y restaura el cosmetico equipado si era necesario.
 *
 * Casos de uso:
 * - Expiracion VIP:
 *   await revokeConditionalItem(user._id, 'badge_vip', 'badge_id', 'badge_bronce');
 * - Nuevo Campeon:
 *   await revokeConditionalItem(oldChampionId, 'badge_champion', 'badge_id', 'badge_bronce');
 *
 * @param {number|string} userId
 * @param {string} itemId
 * @param {'avatar_id'|'frame_id'|'badge_id'|string} rootEquipField
 * @param {string} fallbackItemId
 * @returns {Promise<boolean>} false si el usuario no existe; true si la revocacion se proceso.
 */
async function revokeConditionalItem(userId, itemId, rootEquipField, fallbackItemId) {
  const session = await mongoose.startSession();
  let revoked = false;

  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) {
        revoked = false;
        return;
      }

      const inventory = Array.isArray(user.inventory) ? user.inventory : [];
      for (let i = inventory.length - 1; i >= 0; i -= 1) {
        if (inventory[i]?.itemId === itemId) {
          inventory.splice(i, 1);
        }
      }

      if (user[rootEquipField] === itemId) {
        user[rootEquipField] = fallbackItemId;

        const equippedSubType = EQUIP_FIELD_TO_SUBTYPE[rootEquipField];
        for (const entry of inventory) {
          if (!equippedSubType || entry.subType === equippedSubType) {
            entry.isEquipped = false;
          }
        }

        const fallbackEntry = inventory.find((entry) => entry?.itemId === fallbackItemId);
        if (fallbackEntry) {
          fallbackEntry.isEquipped = true;
        }
      }

      await user.save({ session });
      revoked = true;
    });

    return revoked;
  } finally {
    session.endSession();
  }
}

module.exports = {
  revokeConditionalItem,
};
