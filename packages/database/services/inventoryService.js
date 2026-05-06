const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const DAILY_REWARDS = [
  {
    itemId: 'coupon_bronze',
    category: 'consumable',
    subType: 'league_coupon',
    dailyQuantity: 3,
    maxQuantity: 5,
  },
];

function getServerDayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function getServerDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameServerDay(a, b) {
  if (!a || !b) return false;
  const left = new Date(a);
  const right = new Date(b);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false;
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function findInventoryEntry(user, itemId) {
  return Array.isArray(user?.inventory)
    ? user.inventory.find((item) => item?.itemId === itemId)
    : null;
}

function getCouponCount(user, itemId) {
  const entry = findInventoryEntry(user, itemId);
  return Number(entry?.quantity || 0);
}

function upsertInventoryReward(user, reward, quantity, now) {
  const entry = findInventoryEntry(user, reward.itemId);
  if (entry) {
    entry.quantity = Number(entry.quantity || 0) + quantity;
    entry.category = reward.category;
    entry.subType = reward.subType;
    entry.isEquipped = false;
    return;
  }

  user.inventory.push({
    itemId: reward.itemId,
    category: reward.category,
    subType: reward.subType,
    quantity,
    isEquipped: false,
    acquiredAt: now,
  });
}

/**
 * Evalua y consume el bono diario de inventario una sola vez por dia calendario
 * del servidor. La fecha se marca antes de calcular cantidades para evitar
 * recargas posteriores el mismo dia si el usuario estaba en el tope.
 *
 * @param {import('mongoose').Document & { _id: number }} user
 * @returns {Promise<{ refilled: boolean, amount?: number, reason?: string, rewards?: Array<{ itemId: string, quantity: number }> }>}
 */
async function checkAndRefillDailyCoupons(user) {
  if (!user?._id) {
    return { refilled: false };
  }

  const now = new Date();
  if (isSameServerDay(user.lastDailyCouponRefill, now)) {
    return { refilled: false };
  }

  const { start, end } = getServerDayBounds(now);
  const session = await mongoose.startSession();
  let result = { refilled: false };

  try {
    await session.withTransaction(async () => {
      const claimedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          $or: [
            { lastDailyCouponRefill: { $exists: false } },
            { lastDailyCouponRefill: null },
            { lastDailyCouponRefill: { $lt: start } },
            { lastDailyCouponRefill: { $gte: end } },
          ],
        },
        { $set: { lastDailyCouponRefill: now } },
        { new: true, session },
      );

      if (!claimedUser) {
        result = { refilled: false };
        return;
      }

      const grantedRewards = [];
      for (const reward of DAILY_REWARDS) {
        const currentCount = getCouponCount(claimedUser, reward.itemId);
        const amount = Math.min(reward.dailyQuantity, reward.maxQuantity - currentCount);
        if (amount <= 0) continue;

        upsertInventoryReward(claimedUser, reward, amount, now);
        grantedRewards.push({ itemId: reward.itemId, quantity: amount });
      }

      if (grantedRewards.length === 0) {
        result = { refilled: false, reason: 'capped' };
        return;
      }

      await claimedUser.save({ session });

      await Transaction.create(
        grantedRewards.map((reward) => ({
          user_id: claimedUser._id,
          amount_subunits: 0,
          type: 'DAILY_REWARD',
          status: 'COMPLETED',
          balance_after_subunits: Number(claimedUser.balance_subunits || 0),
          reference_external_id: `daily_reward:${reward.itemId}:${getServerDayKey(now)}`,
        })),
        { session },
      );

      const bronzeReward = grantedRewards.find((reward) => reward.itemId === 'coupon_bronze');
      result = {
        refilled: true,
        amount: Number(bronzeReward?.quantity || grantedRewards[0]?.quantity || 0),
        rewards: grantedRewards,
      };
    });

    return result;
  } finally {
    session.endSession();
  }
}

module.exports = {
  DAILY_REWARDS,
  checkAndRefillDailyCoupons,
  getCouponCount,
  getServerDayBounds,
  isSameServerDay,
  upsertInventoryReward,
};
