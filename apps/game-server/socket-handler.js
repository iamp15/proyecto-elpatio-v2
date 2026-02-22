require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { createGameNamespace } = require('./src/games/registry');

const PORT = process.env.PORT || 3001;
const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'game-server' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(server, {
  cors: { origin: '*' },
});

createGameNamespace(io, '/ludo');
createGameNamespace(io, '/domino');

io.of('/').on('connection', (socket) => {
  socket.emit('connected', { message: 'El Patio Game Server' });
});

server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
