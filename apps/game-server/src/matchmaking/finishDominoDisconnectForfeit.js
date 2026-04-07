const { handleGameOver } = require('./handleGameOver');

/**
 * Finaliza partida por timeout de desconexión (90s): liquida como forfeit y limpia sala/sockets.
 *
 * @param {import('./Room').Room} room
 * @param {number} disconnectedUserId
 */
async function finishDominoDisconnectForfeit(room, disconnectedUserId) {
  const ctx = room.dominoLiveContext;
  if (!ctx?.nsp || !ctx?.roomManager) {
    console.error(
      `[finishDominoDisconnectForfeit] Sin contexto de dominó (sala=${room.roomId}), no se puede liquidar.`,
    );
    try {
      room.finish?.();
    } catch (_) {}
    return;
  }

  const winnerId = room.players.find((p) => p.userId !== disconnectedUserId)?.userId;
  if (winnerId == null) {
    console.error(
      `[finishDominoDisconnectForfeit] Sin ganador (sala=${room.roomId}, desconectado=${disconnectedUserId})`,
    );
    try {
      room.finish?.();
    } catch (_) {}
    ctx.roomManager.delete(room.roomId);
    return;
  }

  const finalScores = room.game?._getFinalScores?.() ?? {};

  try {
    await handleGameOver(room, winnerId, ctx.nsp, finalScores, {
      forfeit: true,
      disconnectedPlayerId: disconnectedUserId,
    });
  } catch (err) {
    console.error('[finishDominoDisconnectForfeit] handleGameOver:', err.message);
    try {
      room.finish?.();
    } catch (_) {}
  } finally {
    for (const p of room.players) {
      if (p.socket?.data) p.socket.data.currentRoom = null;
    }
    ctx.roomManager.delete(room.roomId);
  }
}

module.exports = { finishDominoDisconnectForfeit };
