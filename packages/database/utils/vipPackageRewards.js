/**
 * Expande los `items` de un paquete VIP a entradas de recompensa para la UI.
 * Resuelve cupones con sufijo `_xN` (p. ej. `coupon_bronze_x3`).
 *
 * @param {string[]} rawItems
 * @returns {{ itemId: string, quantity: number }[]}
 */
function expandVipPackageItemRewards(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  const rewards = [];
  for (const rawItemId of rawItems) {
    if (typeof rawItemId !== 'string' || rawItemId.length === 0) continue;

    const match = /^(.+)_x(\d+)$/.exec(rawItemId);
    if (match) {
      const [, itemId, rawQty] = match;
      const quantity = Math.trunc(Number(rawQty));
      if (itemId.startsWith('coupon_') && Number.isFinite(quantity) && quantity > 0) {
        rewards.push({ itemId, quantity });
        continue;
      }
    }

    rewards.push({ itemId: rawItemId, quantity: 1 });
  }

  return rewards;
}

module.exports = { expandVipPackageItemRewards };
