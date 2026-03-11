const { createTransaction } = require('@el-patio/database');

/**
 * Cobra el entry fee a todos los jugadores de la sala en paralelo.
 *
 * IMPORTANTE sobre el mapeo de resultados:
 *   Promise.allSettled garantiza que results[i] corresponde SIEMPRE a
 *   players[i] (mismo índice de inserción). Por eso usamos el índice para
 *   atribuir el saldo resultante a cada jugador, en lugar de comparar
 *   tx.user_id — lo que evita cualquier problema de tipo o colisión de userId.
 *
 * @param {import('./Room').Room} room
 * @returns {Promise<
 *   { success: true,  balancesAfter: Array<{ userId: number, socketId: string, balance_subunits: number, piedras: number }> } |
 *   { success: false, failedUserIds: number[] }
 * >}
 */
async function chargeEntryFees(room) {
  const { entryFee_subunits } = room.config;

  // Capturamos snapshot de jugadores ANTES del await para que el índice
  // no cambie si alguien se desconecta mientras corren las transacciones.
  const players = [...room.players];

  const results = await Promise.allSettled(
    players.map((player) =>
      createTransaction({
        userId:                player.userId,
        amount_subunits:       -entryFee_subunits,
        type:                  'BET',
        reference_external_id: room.roomId,
      }),
    ),
  );

  // Detectar fallos usando índice (más robusto que filtrar por userId)
  const failedIndices = results.reduce((acc, r, i) => {
    if (r.status === 'rejected') acc.push(i);
    return acc;
  }, []);

  if (failedIndices.length > 0) {
    failedIndices.forEach((i) => {
      console.warn(
        `[chargeEntryFees] Cobro fallido para userId=${players[i].userId}:`,
        results[i].reason?.message ?? 'Error desconocido',
      );
    });

    // Solo hacemos refund a los que SÍ pagaron
    const succeededUserIds = results
      .map((r, i) => (r.status === 'fulfilled' ? players[i].userId : null))
      .filter((id) => id !== null);

    await refundPlayers(succeededUserIds, entryFee_subunits, room.roomId);

    const failedUserIds = failedIndices.map((i) => players[i].userId);
    return { success: false, failedUserIds };
  }

  // Mapeo por índice: results[i] → players[i] → socketId exacto del jugador.
  // Incluir socketId permite que domino.js emita al socket correcto sin depender
  // de que userId sea único (previene el bug de cross-account si dos sockets
  // tuvieran el mismo userId por algún edge case).
  const balancesAfter = results.map((r, i) => ({
    userId:           players[i].userId,
    socketId:         players[i].socketId,
    balance_subunits: r.value.balance_after_subunits,
    piedras:          r.value.balance_after_subunits / 100,
  }));

  return { success: true, balancesAfter };
}

/**
 * Emite un REFUND a cada userId de la lista.
 * Los errores de refund se loguean pero no interrumpen el proceso
 * para evitar dejar transacciones colgadas.
 *
 * @param {number[]} userIds
 * @param {number}   entryFee_subunits
 * @param {string}   roomId
 */
async function refundPlayers(userIds, entryFee_subunits, roomId) {
  await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        await createTransaction({
          userId,
          amount_subunits:       entryFee_subunits,
          type:                  'REFUND',
          reference_external_id: roomId,
        });
        console.log(`[chargeEntryFees] Refund OK para userId=${userId}`);
      } catch (refundErr) {
        console.error(
          `[chargeEntryFees] ERROR en refund para userId=${userId}:`,
          refundErr.message,
        );
      }
    }),
  );
}

module.exports = { chargeEntryFees };
