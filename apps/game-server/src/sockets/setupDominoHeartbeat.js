/**
 * Capa de transporte / salud de conexión (no lógica de juego).
 *
 * Ubicación: `apps/game-server/src/sockets/` — junto a utilidades del ciclo de vida
 * del socket, separado de `namespaces/` (eventos de dominó) y `matchmaking/`.
 *
 * Consumidor principal: `src/namespaces/domino.js` (tras auth, una vez por conexión).
 *
 * Si el despliegue falla con MODULE_NOT_FOUND, el archivo no está en la imagen:
 * suele faltar commitear/pushear este path o desplegar una rama sin el commit.
 */

const PING_INTERVAL_MS = Number(process.env.DOMINO_HEARTBEAT_INTERVAL_MS) || 20000;
const PONG_WAIT_MS = Number(process.env.DOMINO_HEARTBEAT_PONG_WAIT_MS) || 15000;

/**
 * Ping/pong a nivel aplicación. Sin pong → disconnect → misma rama que cierre real.
 * @param {import('socket.io').Socket} socket
 */
function setupDominoHeartbeat(socket) {
  let intervalId = null;
  let pongWaitId = null;
  let expectedPingId = null;

  const clearPongWait = () => {
    if (pongWaitId) {
      clearTimeout(pongWaitId);
      pongWaitId = null;
    }
    expectedPingId = null;
  };

  const sendPing = () => {
    clearPongWait();
    const pingId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    expectedPingId = pingId;
    socket.emit('server_ping', { pingId });
    pongWaitId = setTimeout(() => {
      if (!socket.connected) return;
      console.warn(`[Domino] Heartbeat: sin pong a tiempo (socket=${socket.id})`);
      socket.disconnect(true);
    }, PONG_WAIT_MS);
  };

  socket.on('client_pong', ({ pingId } = {}) => {
    if (pingId != null && pingId === expectedPingId) {
      clearPongWait();
    }
  });

  intervalId = setInterval(() => {
    if (socket.connected) sendPing();
  }, PING_INTERVAL_MS);

  const firstPing = setTimeout(sendPing, 4000);

  const cleanup = () => {
    clearInterval(intervalId);
    clearPongWait();
    clearTimeout(firstPing);
  };

  socket.once('disconnect', cleanup);
}

module.exports = { setupDominoHeartbeat, PING_INTERVAL_MS, PONG_WAIT_MS };
