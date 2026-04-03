/**
 * Responde al ping de aplicación del game-server para evitar cierre por heartbeat.
 * Idempotente por instancia de socket.
 * @param {import('socket.io-client').Socket} socket
 */
export function attachDominoSocketHeartbeat(socket) {
  if (!socket || socket.__dominoHeartbeatAttached) return;
  socket.__dominoHeartbeatAttached = true;
  socket.on('server_ping', ({ pingId }) => {
    socket.emit('client_pong', { pingId });
  });
}
