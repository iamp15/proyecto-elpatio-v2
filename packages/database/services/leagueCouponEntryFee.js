const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/** Ligas donde un cupón de entrada puede sustituir el cobro en Piedras. */
const COUPON_SUPPORTED_LEAGUES = ['BRONCE', 'PLATA', 'ORO', 'DIAMANTE'];

/**
 * @param {string} leagueId
 * @returns {string|null}
 */
function normalizeCouponLeagueId(leagueId) {
  const u = String(leagueId || '').trim().toUpperCase();
  return COUPON_SUPPORTED_LEAGUES.includes(u) ? u : null;
}

/**
 * Filtros Mongo `arrayFilters` para decrementar / incrementar quantity en una fila del inventario.
 * @typedef {{ decrementFilters: object[][], incrementFilters: object[][] }} LeagueCouponMongoSpec
 */

/** @type {Record<string, LeagueCouponMongoSpec>} */
const LEAGUE_COUPON_MONGO = {
  BRONCE: {
    decrementFilters: [
      [{ 'elem.itemId': 'coupon_bronze', 'elem.category': 'consumable', 'elem.quantity': { $gte: 1 } }],
      [{ 'elem.subType': 'league_coupon_bronce', 'elem.category': 'consumable', 'elem.quantity': { $gte: 1 } }],
      [
        {
          'elem.subType': 'league_coupon',
          'elem.itemId': 'coupon_bronze',
          'elem.category': 'consumable',
          'elem.quantity': { $gte: 1 },
        },
      ],
    ],
    incrementFilters: [
      [{ 'elem.itemId': 'coupon_bronze', 'elem.category': 'consumable' }],
      [{ 'elem.subType': 'league_coupon_bronce', 'elem.category': 'consumable' }],
      [{ 'elem.subType': 'league_coupon', 'elem.itemId': 'coupon_bronze', 'elem.category': 'consumable' }],
    ],
  },
  PLATA: {
    decrementFilters: [
      [{ 'elem.itemId': 'coupon_plata', 'elem.category': 'consumable', 'elem.quantity': { $gte: 1 } }],
      [{ 'elem.subType': 'league_coupon_plata', 'elem.category': 'consumable', 'elem.quantity': { $gte: 1 } }],
      [
        {
          'elem.subType': 'league_coupon',
          'elem.itemId': 'coupon_plata',
          'elem.category': 'consumable',
          'elem.quantity': { $gte: 1 },
        },
      ],
    ],
    incrementFilters: [
      [{ 'elem.itemId': 'coupon_plata', 'elem.category': 'consumable' }],
      [{ 'elem.subType': 'league_coupon_plata', 'elem.category': 'consumable' }],
      [{ 'elem.subType': 'league_coupon', 'elem.itemId': 'coupon_plata', 'elem.category': 'consumable' }],
    ],
  },
  ORO: {
    decrementFilters: [
      [{ 'elem.itemId': 'coupon_oro', 'elem.category': 'consumable', 'elem.quantity': { $gte: 1 } }],
      [{ 'elem.subType': 'league_coupon_oro', 'elem.category': 'consumable', 'elem.quantity': { $gte: 1 } }],
      [
        {
          'elem.subType': 'league_coupon',
          'elem.itemId': 'coupon_oro',
          'elem.category': 'consumable',
          'elem.quantity': { $gte: 1 },
        },
      ],
    ],
    incrementFilters: [
      [{ 'elem.itemId': 'coupon_oro', 'elem.category': 'consumable' }],
      [{ 'elem.subType': 'league_coupon_oro', 'elem.category': 'consumable' }],
      [{ 'elem.subType': 'league_coupon', 'elem.itemId': 'coupon_oro', 'elem.category': 'consumable' }],
    ],
  },
  DIAMANTE: {
    decrementFilters: [
      [{ 'elem.itemId': 'coupon_diamante', 'elem.category': 'consumable', 'elem.quantity': { $gte: 1 } }],
      [{ 'elem.subType': 'league_coupon_diamante', 'elem.category': 'consumable', 'elem.quantity': { $gte: 1 } }],
      [
        {
          'elem.subType': 'league_coupon',
          'elem.itemId': 'coupon_diamante',
          'elem.category': 'consumable',
          'elem.quantity': { $gte: 1 },
        },
      ],
    ],
    incrementFilters: [
      [{ 'elem.itemId': 'coupon_diamante', 'elem.category': 'consumable' }],
      [{ 'elem.subType': 'league_coupon_diamante', 'elem.category': 'consumable' }],
      [{ 'elem.subType': 'league_coupon', 'elem.itemId': 'coupon_diamante', 'elem.category': 'consumable' }],
    ],
  },
};

/** Fila canónica para restaurar un cupón consumido si el cobro se revierte tras el cleanup. */
const CANONICAL_COUPON_BY_LEAGUE = {
  BRONCE: { itemId: 'coupon_bronze', subType: 'league_coupon' },
  PLATA: { itemId: 'coupon_plata', subType: 'league_coupon' },
  ORO: { itemId: 'coupon_oro', subType: 'league_coupon' },
  DIAMANTE: { itemId: 'coupon_diamante', subType: 'league_coupon' },
};

/**
 * Convierte un arrayFilter `{ 'elem.itemId': 'coupon_bronze', ... }` en
 * `$elemMatch` sobre `inventory`. Así el documento solo matchea si existe
 * realmente una fila de cupón; no dependemos de `modifiedCount` del positional update.
 *
 * @param {object[][]} arrayFilters
 * @returns {object}
 */
function toInventoryElemMatch(arrayFilters) {
  const raw = arrayFilters?.[0] && typeof arrayFilters[0] === 'object' ? arrayFilters[0] : {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('elem.')) {
      out[key.slice('elem.'.length)] = value;
    }
  }
  return out;
}

/**
 * Elimina basura de inventario después de consumir ítems. Se ejecuta dentro de
 * la misma transacción que el decremento para no dejar consumibles con quantity 0.
 *
 * @param {number} userId
 * @param {import('mongoose').ClientSession} session
 */
async function cleanupEmptyInventoryItems(userId, session) {
  await User.updateOne(
    { _id: userId },
    { $pull: { inventory: { quantity: { $lte: 0 } } } },
    { session },
  );
}

/**
 * @param {unknown} inventory
 * @param {string} leagueId
 * @returns {boolean}
 */
function hasLeagueEntryCoupon(inventory, leagueId) {
  const L = normalizeCouponLeagueId(leagueId);
  if (!L || !Array.isArray(inventory)) return false;

  return inventory.some((e) => {
    if (!e || e.category !== 'consumable' || typeof e.quantity !== 'number' || e.quantity <= 0) {
      return false;
    }
    if (L === 'BRONCE') {
      return (
        e.itemId === 'coupon_bronze' ||
        e.subType === 'league_coupon_bronce' ||
        (e.subType === 'league_coupon' && e.itemId === 'coupon_bronze')
      );
    }
    if (L === 'PLATA') {
      return (
        e.itemId === 'coupon_plata' ||
        e.subType === 'league_coupon_plata' ||
        (e.subType === 'league_coupon' && e.itemId === 'coupon_plata')
      );
    }
    if (L === 'ORO') {
      return (
        e.itemId === 'coupon_oro' ||
        e.subType === 'league_coupon_oro' ||
        (e.subType === 'league_coupon' && e.itemId === 'coupon_oro')
      );
    }
    if (L === 'DIAMANTE') {
      return (
        e.itemId === 'coupon_diamante' ||
        e.subType === 'league_coupon_diamante' ||
        (e.subType === 'league_coupon' && e.itemId === 'coupon_diamante')
      );
    }
    return false;
  });
}

/**
 * @param {string} leagueId
 * @param {number} userId
 * @param {import('mongoose').ClientSession} session
 * @returns {Promise<boolean>}
 */
async function tryAtomicDecrementLeagueCoupon(leagueId, userId, session) {
  const spec = LEAGUE_COUPON_MONGO[leagueId];
  if (!spec) return false;
  for (const arrayFilters of spec.decrementFilters) {
    const elemMatch = toInventoryElemMatch(arrayFilters);
    const res = await User.updateOne(
      { _id: userId, inventory: { $elemMatch: elemMatch } },
      { $inc: { 'inventory.$[elem].quantity': -1 } },
      { arrayFilters, session },
    );
    if (res.modifiedCount > 0) return true;
  }
  return false;
}

/**
 * @param {string} leagueId
 * @param {number} userId
 * @param {import('mongoose').ClientSession} session
 * @returns {Promise<boolean>}
 */
async function tryAtomicIncrementLeagueCoupon(leagueId, userId, session) {
  const spec = LEAGUE_COUPON_MONGO[leagueId];
  if (!spec) return false;
  for (const arrayFilters of spec.incrementFilters) {
    const elemMatch = toInventoryElemMatch(arrayFilters);
    const res = await User.updateOne(
      { _id: userId, inventory: { $elemMatch: elemMatch } },
      { $inc: { 'inventory.$[elem].quantity': 1 } },
      { arrayFilters, session },
    );
    if (res.modifiedCount > 0) return true;
  }
  return false;
}

/**
 * Restaura una unidad si el cupón original fue eliminado por cleanup.
 *
 * @param {string} leagueId
 * @param {number} userId
 * @param {import('mongoose').ClientSession} session
 */
async function pushCanonicalLeagueCoupon(leagueId, userId, session) {
  const coupon = CANONICAL_COUPON_BY_LEAGUE[leagueId];
  if (!coupon) return;

  await User.updateOne(
    { _id: userId },
    {
      $push: {
        inventory: {
          itemId: coupon.itemId,
          category: 'consumable',
          subType: coupon.subType,
          quantity: 1,
          isEquipped: false,
          acquiredAt: new Date(),
        },
      },
    },
    { session },
  );
}

/**
 * Intenta consumir un cupón de entrada de la liga indicada y registrar FEE_PAID_WITH_COUPON.
 * @param {{ userId: number, roomId: string, leagueId: string }} params
 * @returns {Promise<{ balance_after_subunits: number } | null>} null si no hay cupón usable
 */
async function tryConsumeLeagueCouponForEntryFee({ userId, roomId, leagueId }) {
  const L = normalizeCouponLeagueId(leagueId);
  if (!L) return null;

  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      const ok = await tryAtomicDecrementLeagueCoupon(L, userId, session);
      if (!ok) return;

      await cleanupEmptyInventoryItems(userId, session);

      const user = await User.findById(userId).session(session).select('balance_subunits').lean();
      if (!user) {
        throw new Error('Usuario no encontrado tras consumir cupón');
      }

      await Transaction.create(
        [
          {
            user_id: userId,
            amount_subunits: 0,
            type: 'FEE_PAID_WITH_COUPON',
            reference_external_id: roomId,
            status: 'COMPLETED',
            balance_after_subunits: user.balance_subunits,
          },
        ],
        { session },
      );

      result = { balance_after_subunits: user.balance_subunits };
    });
    return result;
  } finally {
    session.endSession();
  }
}

/**
 * Devuelve 1 unidad de cupón de la liga y elimina el registro FEE_PAID_WITH_COUPON de ese intento de sala.
 *
 * @param {{ userId: number, roomId: string, leagueId: string }} params
 */
async function restoreLeagueCouponAfterRollback({ userId, roomId, leagueId }) {
  const L = normalizeCouponLeagueId(leagueId);
  if (!L) {
    console.warn(`[leagueCouponEntryFee] Rollback: leagueId inválido leagueId=${leagueId}`);
    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const ok = await tryAtomicIncrementLeagueCoupon(L, userId, session);
      if (!ok) {
        await pushCanonicalLeagueCoupon(L, userId, session);
        console.warn(
          `[leagueCouponEntryFee] Rollback: cupón restaurado como fila canónica league=${L} userId=${userId}`,
        );
      }

      const del = await Transaction.deleteMany(
        {
          user_id: userId,
          type: 'FEE_PAID_WITH_COUPON',
          reference_external_id: roomId,
        },
        { session },
      );
      if (del.deletedCount === 0) {
        console.warn(
          `[leagueCouponEntryFee] Rollback: no había FEE_PAID_WITH_COUPON league=${L} userId=${userId} roomId=${roomId}`,
        );
      }
    });
  } finally {
    session.endSession();
  }
}

/** @deprecated Usar hasLeagueEntryCoupon(inventory, 'BRONCE') */
function hasBronzeLeagueCoupon(inventory) {
  return hasLeagueEntryCoupon(inventory, 'BRONCE');
}

/** @deprecated Usar tryConsumeLeagueCouponForEntryFee con leagueId: 'BRONCE' */
function tryConsumeBronzeCouponForEntryFee(params) {
  return tryConsumeLeagueCouponForEntryFee({ ...params, leagueId: 'BRONCE' });
}

/** @deprecated Usar restoreLeagueCouponAfterRollback con leagueId: 'BRONCE' */
function restoreBronzeCouponAfterRollback(params) {
  return restoreLeagueCouponAfterRollback({ ...params, leagueId: 'BRONCE' });
}

module.exports = {
  COUPON_SUPPORTED_LEAGUES,
  normalizeCouponLeagueId,
  hasLeagueEntryCoupon,
  tryConsumeLeagueCouponForEntryFee,
  restoreLeagueCouponAfterRollback,
  hasBronzeLeagueCoupon,
  tryConsumeBronzeCouponForEntryFee,
  restoreBronzeCouponAfterRollback,
};
