const {
  createTransaction,
  subunitsToStonesFloor,
  normalizeCouponLeagueId,
  tryConsumeLeagueCouponForEntryFee,
  restoreLeagueCouponAfterRollback,
} = require('@el-patio/database');

/**
 * @typedef {'stones' | 'coupon'} EntryChargeMethod
 */

/**
 * @typedef {Object} ChargeRecord
 * @property {number} userId
 * @property {string} socketId
 * @property {EntryChargeMethod} method
 * @property {number} balance_after_subunits
 */

/**
 * Resuelve el categoryId de la sala (Liga) desde el input de cobro.
 * @param {{ config?: { categoryId?: string }, modeId?: string }} | { config: object, modeId?: string }} input
 */
function resolveCategoryId(input) {
  if (input.config && typeof input.config.categoryId === 'string') {
    return input.config.categoryId;
  }
  if (typeof input.modeId === 'string') {
    return input.modeId;
  }
  return '';
}

/**
 * Cobra el entry fee a cada jugador en orden. En ligas con cupón de entrada: intenta cupón de esa liga antes que Piedras.
 * Si falla un jugador, revierte los cobros previos (Piedras → REFUND; cupón → +1 quantity).
 *
 * @param {import('./Room').Room | { roomId: string, config: { entryFee_subunits: number, categoryId?: string }, feePlayers: Array<{ userId: number, socketId: string, socket?: import('socket.io').Socket }> }} input
 * @returns {Promise<
 *   { success: true, balancesAfter: Array<{ userId: number, socketId: string, balance_subunits: number, piedras: number }>, chargeDetails: ChargeRecord[] } |
 *   { success: false, failedUserIds: number[] }
 * >}
 */
async function chargeEntryFees(input) {
  const roomId = input.roomId;
  const config = input.config;
  const { entryFee_subunits } = config;
  const categoryId = resolveCategoryId(input);
  const couponLeague = normalizeCouponLeagueId(categoryId);

  const players = [...(input.feePlayers ?? input.players)];

  /** @type {ChargeRecord[]} */
  const chargeDetails = [];

  try {
    for (const player of players) {
      let method;
      let balanceAfter;

      let couponLeagueUsed;
      if (couponLeague) {
        const couponResult = await tryConsumeLeagueCouponForEntryFee({
          userId: player.userId,
          roomId,
          leagueId: couponLeague,
        });
        if (couponResult) {
          method = 'coupon';
          couponLeagueUsed = couponLeague;
          balanceAfter = couponResult.balance_after_subunits;
        }
      }

      if (!method) {
        const tx = await createTransaction({
          userId: player.userId,
          amount_subunits: -entryFee_subunits,
          type: 'BET',
          reference_external_id: roomId,
        });
        method = 'stones';
        balanceAfter = tx.balance_after_subunits;
      }

      chargeDetails.push({
        userId: player.userId,
        socketId: player.socketId,
        method,
        balance_after_subunits: balanceAfter,
        ...(method === 'coupon' && couponLeagueUsed ? { couponLeague: couponLeagueUsed } : {}),
      });
    }
  } catch (err) {
    const failIdx = chargeDetails.length;
    const failedUserId = failIdx < players.length ? players[failIdx].userId : null;
    console.warn(
      `[chargeEntryFees] Cobro fallido para userId=${failedUserId ?? '?'}:`,
      err?.message ?? 'Error desconocido',
    );

    await rollbackSuccessfulCharges(chargeDetails, entryFee_subunits, roomId);

    const failedUserIds = failedUserId != null ? [failedUserId] : [];
    return { success: false, failedUserIds };
  }

  const balancesAfter = chargeDetails.map((c, i) => ({
    userId: players[i].userId,
    socketId: players[i].socketId,
    balance_subunits: c.balance_after_subunits,
    piedras: subunitsToStonesFloor(c.balance_after_subunits),
  }));

  return { success: true, balancesAfter, chargeDetails };
}

/**
 * @param {ChargeRecord[]} chargeDetails
 * @param {number} entryFee_subunits
 * @param {string} roomId
 */
async function rollbackSuccessfulCharges(chargeDetails, entryFee_subunits, roomId) {
  for (let i = chargeDetails.length - 1; i >= 0; i--) {
    const c = chargeDetails[i];
    try {
      if (c.method === 'stones') {
        await createTransaction({
          userId: c.userId,
          amount_subunits: entryFee_subunits,
          type: 'REFUND',
          reference_external_id: roomId,
        });
        console.log(`[chargeEntryFees] Refund Piedras OK userId=${c.userId}`);
      } else if (c.method === 'coupon') {
        const leagueId = c.couponLeague || 'BRONCE';
        if (!c.couponLeague) {
          console.warn(
            `[chargeEntryFees] Rollback cupón sin couponLeague; usando BRONCE userId=${c.userId}`,
          );
        }
        await restoreLeagueCouponAfterRollback({
          userId: c.userId,
          roomId,
          leagueId,
        });
        console.log(`[chargeEntryFees] Cupón de liga restaurado userId=${c.userId} league=${leagueId}`);
      }
    } catch (refundErr) {
      console.error(
        `[chargeEntryFees] ERROR en rollback para userId=${c.userId} (${c.method}):`,
        refundErr.message,
      );
    }
  }
}

/**
 * Devuelve entradas cobradas (Piedras o cupón) tras un fallo posterior (p. ej. creación de sala).
 * @param {ChargeRecord[]} chargeDetails - Salida de chargeEntryFees en success
 * @param {number} entryFee_subunits
 * @param {string} roomId
 */
async function refundBetsForRoom(chargeDetails, entryFee_subunits, roomId) {
  if (!Array.isArray(chargeDetails) || chargeDetails.length === 0) return;
  await rollbackSuccessfulCharges(chargeDetails, entryFee_subunits, roomId);
}

module.exports = { chargeEntryFees, refundBetsForRoom };
