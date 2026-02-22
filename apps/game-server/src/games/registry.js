function createGameNamespace(io, path) {
  const nsp = io.of(path);
  nsp.on('connection', (socket) => {
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      nsp.to(roomId).emit('player_joined', { socketId: socket.id, roomId });
    });
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
    });
    socket.on('disconnect', () => {});
  });
  return nsp;
}

module.exports = { createGameNamespace };
