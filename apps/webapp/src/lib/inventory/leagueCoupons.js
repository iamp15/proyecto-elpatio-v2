import { ITEM_CATALOG } from './itemCatalog';

const LEAGUE_COUPON_BY_RANK = {
  BRONCE: { itemId: 'coupon_bronze', legacySubType: 'league_coupon_bronce' },
  PLATA: { itemId: 'coupon_plata', legacySubType: 'league_coupon_plata' },
  ORO: { itemId: 'coupon_oro', legacySubType: 'league_coupon_oro' },
  DIAMANTE: { itemId: 'coupon_diamante', legacySubType: 'league_coupon_diamante' },
};

function normalizeLeagueId(categoryId) {
  if (typeof categoryId !== 'string') return 'BRONCE';
  const normalized = categoryId.trim().toUpperCase();
  return LEAGUE_COUPON_BY_RANK[normalized] ? normalized : 'BRONCE';
}

export function getLeagueCouponMeta(categoryId) {
  const coupon = LEAGUE_COUPON_BY_RANK[normalizeLeagueId(categoryId)];
  const catalogEntry = ITEM_CATALOG[coupon.itemId];

  return {
    itemId: coupon.itemId,
    iconUrl: catalogEntry?.iconUrl,
    fallbackEmoji: catalogEntry?.fallbackEmoji ?? '🎟️',
  };
}

export function getLeagueCouponQuantity(inventory, categoryId) {
  if (!Array.isArray(inventory)) return 0;

  const coupon = LEAGUE_COUPON_BY_RANK[normalizeLeagueId(categoryId)];
  return inventory.reduce((total, item) => {
    const isCouponForLeague =
      item?.id === coupon.itemId ||
      item?.subType === coupon.legacySubType ||
      (item?.subType === 'league_coupon' && item?.id === coupon.itemId);

    if (!isCouponForLeague) return total;

    const quantity = Number(item.quantity);
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
}
