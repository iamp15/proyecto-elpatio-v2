require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { connectDB, AppConfigManager } = require('@el-patio/database');
const { createDominoNamespace } = require('./src/namespaces/domino');

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
        // En el nuevo sistema, recargar la config global recarga todo
        await AppConfigManager.refreshConfig();
      } else {
        await AppConfigManager.refreshConfig();
      }

      // Prepara el resumen de juegos recargados
      const targetGameIds = gameId ? [gameId] : AppConfigManager.gameIds;
      const games = targetGameIds.map((gid) => ({
        gameId: gid,
        ranks: AppConfigManager.getAllRanks(gid).map((r) => ({
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
          : `Todos los juegos recargados: [${AppConfigManager.gameIds.join(', ')}]`,
        games,
      }));
    } catch (err) {
      console.error('[admin/refresh-config] Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Error al recargar la configuración.' }));
    }
    return;
  }

  // ── Admin: activar/desactivar reglas de producción de matchmaking ────────
  if (req.url === '/admin/matchmaking/production-rules' && req.method === 'POST') {
    const authHeader = req.headers['authorization'] ?? '';
    const secret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (secret !== ADMIN_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      const body = await readBody(req);
      if (typeof body?.enabled !== 'boolean') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Body inválido. Debes enviar { "enabled": true|false }',
        }));
        return;
      }

      const enabled = await AppConfigManager.setMatchmakingProductionRulesEnabled(body.enabled);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        matchmaking: { productionRulesEnabled: enabled },
        message: enabled
          ? 'Reglas de producción de matchmaking ACTIVADAS.'
          : 'Reglas de producción de matchmaking DESACTIVADAS.',
      }));
    } catch (err) {
      console.error('[admin/matchmaking/production-rules] Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No se pudo actualizar el estado de production-rules.' }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  // Refuerzo junto al heartbeat de aplicación (setupDominoHeartbeat en /domino)
  pingInterval: 10000,
  pingTimeout: 25000,
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
  await AppConfigManager.loadConfigFromDB();

  createDominoNamespace(io);

  server.listen(PORT, () => {
    console.log(`[Game Server] Escuchando en puerto ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[bootstrap] Error fatal:', err.message);
  process.exit(1);
});
