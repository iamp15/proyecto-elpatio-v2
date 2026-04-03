/**
 * Heartbeat aplicación (ping/pong) sobre Socket.io.
 * Si el cliente no responde con client_pong tras server_ping, se fuerza disconnect
 * para disparar la misma lógica que un cierre limpio (desconexión en Room, etc.).
 */

const PING_INTERVAL_MS = Number(process.env.DOMINO_HEARTBEAT_INTERVAL_MS) || 20000;
const PONG_WAIT_MS = Number(process.env.DOMINO_HEARTBEAT_PONG_WAIT_MS) || 15000;

/**
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
