require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('@el-patio/database');
const { createDominoNamespace } = require('./src/namespaces/domino');
const configManager = require('./src/config/ConfigManager');

/** Lee y parsea el body JSON de una request. Devuelve {} si vacío o inválido. */
function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
  });
}

const PORT       = process.env.PORT       || 3001;
const MONGO_URI  = process.env.MONGO_URI  || process.env.MONGODB_URI;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-me';

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174'];

const server = http.createServer(async (req, res) => {
  // ── Health ─────────────────────────────────────────────────────────────
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'game-server' }));
    return;
  }

  // ── Admin: recargar configuración desde la BD ───────────────────────────
  if (req.url === '/admin/refresh-config' && req.method === 'POST') {
    const authHeader = req.headers['authorization'] ?? '';
    const secret     = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (secret !== ADMIN_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      // Lee el body para obtener el gameId opcional
      const body = await readBody(req);
      const gameId = body?.gameId ?? null;

      if (gameId) {
        await configManager.loadGameConfig(gameId);
      } else {
        await configManager.loadAllConfigs();
      }

      // Prepara el resumen de juegos recargados
      const targetGameIds = gameId ? [gameId] : configManager.gameIds;
      const games = targetGameIds.map((gid) => ({
        gameId: gid,
        ranks: configManager.getAllRanks(gid).map((r) => ({
          categoryId:        r.categoryId,
          label:             r.label,
          minPR:             r.minPR,
          maxPR:             r.maxPR === Infinity ? null : r.maxPR,
          entryFee_subunits: r.entryFee_subunits,
          maxPlayers:        r.maxPlayers,
        })),
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok:      true,
        message: gameId
          ? `Config de '${gameId}' recargada.`
          : `Todos los juegos recargados: [${configManager.gameIds.join(', ')}]`,
        games,
      }));
    } catch (err) {
      console.error('[admin/refresh-config] Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Error al recargar la configuración.' }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
});

io.of('/').on('connection', (socket) => {
  socket.emit('connected', { message: 'El Patio Game Server' });
});

async function bootstrap() {
  if (!MONGO_URI) {
    console.error('[bootstrap] MONGO_URI no definida. Revisa el archivo .env');
    process.exit(1);
  }

  await connectDB(MONGO_URI);
  await configManager.loadAllConfigs();

  createDominoNamespace(io);

  server.listen(PORT, () => {
    console.log(`[Game Server] Escuchando en puerto ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[bootstrap] Error fatal:', err.message);
  process.exit(1);
});
