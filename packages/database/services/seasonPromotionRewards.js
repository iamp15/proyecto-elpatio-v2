const LEAGUE_SLUGS = {
  BRONCE: 'bronce',
  PLATA: 'plata',
  ORO: 'oro',
  DIAMANTE: 'diamante',
};

const COUPON_SLUGS = {
  BRONCE: 'bronze',
  PLATA: 'plata',
  ORO: 'oro',
  DIAMANTE: 'diamante',
};

function normalizeLeagueId(league) {
  return String(league || '').trim().toUpperCase();
}

function getPromotionRewardsForLeague(league) {
  const normalized = normalizeLeagueId(league);
  const itemSlug = LEAGUE_SLUGS[normalized];
  const couponSlug = COUPON_SLUGS[normalized];
  if (!itemSlug || !couponSlug) return [];

  return [
    {
      itemId: `coupon_${couponSlug}`,
      category: 'consumable',
      subType: 'league_coupon',
      quantity: 3,
    },
    {
      itemId: `frame_${itemSlug}`,
      category: 'cosmetic',
      subType: 'avatar_frame',
      quantity: 1,
    },
    {
      itemId: `badge_${itemSlug}`,
      category: 'cosmetic',
      subType: 'profile_badge',
      quantity: 1,
    },
  ];
}

module.exports = {
  getPromotionRewardsForLeague,
  normalizeLeagueId,
};
