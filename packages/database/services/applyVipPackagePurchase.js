const AppConfigManager = require('./AppConfigManager');
const User = require('../models/User');
const ITEM_CATALOG = require('../catalog/itemCatalog.json');
const { SUBUNITS_PER_STONE } = require('../utils/stoneEconomy');
const { isVipEffective } = require('../utils/isVipEffective');
const { expandVipPackageItemRewards } = require('../utils/vipPackageRewards');

function toPositiveInt(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveCouponItem(rawItemId) {
  const match = /^(.+)_x(\d+)$/.exec(rawItemId);
  if (!match) return null;
  const [, itemId, rawQty] = match;
  const quantity = toPositiveInt(rawQty);
  if (!itemId.startsWith('coupon_') || quantity == null) return null;
  return { itemId, quantity };
}

function upsertInventoryItem(user, itemId, quantityToAdd, now) {
  const existing = Array.isArray(user.inventory)
    ? user.inventory.find((entry) => entry?.itemId === itemId)
    : null;

  if (existing) {
    existing.quantity = Number(existing.quantity || 0) + quantityToAdd;
    return;
  }

  const catalog = ITEM_CATALOG?.[itemId];
  const isCoupon = itemId.startsWith('coupon_');
  user.inventory.push({
    itemId,
    category: catalog?.category ?? (isCoupon ? 'consumable' : 'cosmetic'),
    subType: catalog?.subType ?? (isCoupon ? 'league_coupon' : 'profile_badge'),
    quantity: quantityToAdd,
    isEquipped: false,
    acquiredAt: now,
  });
}

async function applyVipPackagePurchase({ userId, packId }) {
  const config = AppConfigManager.getConfig();
  const vipPackages = config.economy?.vipPackages || {};
  const pack = vipPackages[packId];
  if (!pack) {
    throw Object.assign(new Error('Paquete VIP no encontrado'), { statusCode: 400 });
  }

  const days = toPositiveInt(pack.days);
  if (days == null) {
    throw Object.assign(new Error('Paquete VIP inválido (days)'), { statusCode: 400 });
  }

  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error('Usuario no encontrado'), { statusCode: 404 });
  }
  if (!Array.isArray(user.inventory)) {
    user.inventory = [];
  }

  const now = new Date();
  const hadActiveSubscription = isVipEffective(user.vip_status);
  const showItemRewardModals = !hadActiveSubscription;
  const currentExpiryMs = new Date(user.vip_status?.expiresAt).getTime();
  const baseExpiryMs = hadActiveSubscription && Number.isFinite(currentExpiryMs)
    ? currentExpiryMs
    : now.getTime();
  const nextExpiry = new Date(baseExpiryMs + days * 24 * 60 * 60 * 1000);
  const rewardItems = showItemRewardModals
    ? expandVipPackageItemRewards(pack.items)
    : [];

  user.vip_status = {
    is_vip: true,
    start_date: user.vip_status?.start_date ?? now,
    expiresAt: nextExpiry,
  };

  const grantedItems = [];
  const items = Array.isArray(pack.items) ? pack.items : [];
  for (const rawItemId of items) {
    if (typeof rawItemId !== 'string' || rawItemId.length === 0) continue;
    const coupon = resolveCouponItem(rawItemId);

    if (coupon) {
      upsertInventoryItem(user, coupon.itemId, coupon.quantity, now);
      grantedItems.push({ itemId: coupon.itemId, quantity: coupon.quantity });
      continue;
    }

    const alreadyOwned = user.inventory.some((entry) => entry?.itemId === rawItemId);
    if (alreadyOwned) continue;

    upsertInventoryItem(user, rawItemId, 1, now);
    grantedItems.push({ itemId: rawItemId, quantity: 1 });
  }

  const stones = Math.max(0, Math.trunc(Number(pack.stones || 0)));
  if (stones > 0) {
    user.balance_subunits = Number(user.balance_subunits || 0) + stones * SUBUNITS_PER_STONE;
  }

  await user.save();

  return {
    packageId: packId,
    showItemRewardModals,
    isFirstActivation: showItemRewardModals,
    rewardItems,
    vipExpiresAt: nextExpiry,
    grantedItems,
    addedStones: stones,
    balance_subunits: user.balance_subunits,
    piedras: Math.floor(Number(user.balance_subunits || 0) / SUBUNITS_PER_STONE),
  };
}

module.exports = { applyVipPackagePurchase };
