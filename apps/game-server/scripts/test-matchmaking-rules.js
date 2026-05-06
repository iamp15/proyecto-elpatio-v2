#!/usr/bin/env node
/**
 * Pruebas locales de reglas de matchmaking (_canMatch / _findBestPair).
 *
 * Requisitos: MongoDB accesible (misma config que el game-server) para cargar AppConfig.
 *
 * Uso (desde la raíz del monorepo o desde apps/game-server):
 *   cd apps/game-server && node scripts/test-matchmaking-rules.js
 *
 * Variables de entorno: MONGO_URI o MONGODB_URI
 */

const pathMod = require('path');
require('dotenv').config({ path: pathMod.join(__dirname, '..', '.env') });
require('dotenv').config({ path: pathMod.join(__dirname, '..', '..', '..', '.env') });

const path = require('path');
const { connectDB, AppConfigManager } = require('@el-patio/database');
const {
  MatchmakingQueue,
  LARGE_QUEUE_THRESHOLD,
} = require(path.join(__dirname, '..', 'src', 'matchmaking', 'MatchmakingQueue'));
const { createDefaultQueueStore } = require(path.join(__dirname, '..', 'src', 'matchmaking', 'QueueStore'));

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

let pass = 0;
let fail = 0;

function assert(cond, message) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${message}`);
  } else {
    fail += 1;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function mockSocket(userId, socketId) {
  return {
    id: socketId,
    data: { userId },
    emit() {},
  };
}

function makePlayer({
  userId,
  categoryId,
  pr,
  allowCrossLeague = false,
  joinTimeOffsetSec = 0,
}) {
  const socketId = `sock-${userId}`;
  return {
    userId,
    socketId,
    socket: mockSocket(userId, socketId),
    pr,
    categoryId,
    allowCrossLeague: !!allowCrossLeague,
    allowLowerLeague: !!allowCrossLeague,
    joinTime: Date.now() - joinTimeOffsetSec * 1000,
  };
}

function createTestQueue({ recentMatchFn } = {}) {
  const queueStore = createDefaultQueueStore();
  const roomManager = {
    hasRecentMatch: recentMatchFn ?? (() => false),
    createRoomWithConfig() {
      throw new Error('createRoomWithConfig no debe llamarse en este script');
    },
    delete() {},
    startGame() {},
  };
  const queue = new MatchmakingQueue(roomManager, {}, queueStore);
  return { queue, queueStore, roomManager };
}

function seedPlayers(queueStore, players) {
  for (const p of players) {
    const r = queueStore.addPlayer(p);
    if (!r.ok) throw new Error(`addPlayer falló: ${r.error}`);
  }
}

async function main() {
  if (!MONGO_URI) {
    console.error('Falta MONGO_URI o MONGODB_URI en el entorno (o .env en apps/game-server).');
    process.exit(1);
  }

  await connectDB(MONGO_URI);
  await AppConfigManager.loadConfigFromDB();

  const cfg = AppConfigManager.getConfig();
  if (!cfg.matchmaking) cfg.matchmaking = {};
  const prevProduction = cfg.matchmaking.productionRulesEnabled === true;

  try {
    const now = Date.now();

    console.log('\n--- Production OFF: mismo bucket, radio inicial ---\n');
    cfg.matchmaking.productionRulesEnabled = false;
    {
      const { queue, queueStore } = createTestQueue();
      const a = makePlayer({ userId: 1, categoryId: 'BRONCE', pr: 400, joinTimeOffsetSec: 0 });
      const b = makePlayer({ userId: 2, categoryId: 'BRONCE', pr: 420, joinTimeOffsetSec: 0 });
      seedPlayers(queueStore, [a, b]);
      const m = queue._canMatch(a, b, now);
      assert(m.valid === true && m.effectiveCategoryId === 'BRONCE', 'BRONCE 400 vs 420 válido (ΔPR dentro del radio)');
    }
    {
      const { queue, queueStore } = createTestQueue();
      const a = makePlayer({ userId: 3, categoryId: 'BRONCE', pr: 400, joinTimeOffsetSec: 0 });
      const b = makePlayer({ userId: 4, categoryId: 'BRONCE', pr: 600, joinTimeOffsetSec: 0 });
      seedPlayers(queueStore, [a, b]);
      const m = queue._canMatch(a, b, now);
      assert(m.valid === false, 'BRONCE 400 vs 600 inválido con prod OFF (ΔPR > radio mínimo)');
    }

    console.log('\n--- Production ON: MAX_PR_GAP ---\n');
    cfg.matchmaking.productionRulesEnabled = true;
    {
      const { queue, queueStore } = createTestQueue();
      const a = makePlayer({ userId: 10, categoryId: 'BRONCE', pr: 0, allowCrossLeague: true, joinTimeOffsetSec: 120 });
      const b = makePlayer({ userId: 11, categoryId: 'BRONCE', pr: 1200, allowCrossLeague: true, joinTimeOffsetSec: 120 });
      seedPlayers(queueStore, [a, b]);
      const m = queue._canMatch(a, b, now);
      assert(m.valid === false, 'ΔPR > 1000 rechazado siempre');
    }

    console.log('\n--- Production ON: dos invasores misma cola BRONCE ---\n');
    {
      const { queue, queueStore } = createTestQueue();
      const a = makePlayer({ userId: 20, categoryId: 'BRONCE', pr: 800, joinTimeOffsetSec: 60 });
      const b = makePlayer({ userId: 21, categoryId: 'BRONCE', pr: 900, joinTimeOffsetSec: 60 });
      seedPlayers(queueStore, [a, b]);
      const m = queue._canMatch(a, b, now);
      assert(m.valid === false, 'Invasor vs invasor no encajan (rival debe estar ≤ 499)');
    }

    console.log('\n--- Production ON: nativo valiente + invasor (misma cola BRONCE) ---\n');
    {
      const { queue, queueStore } = createTestQueue();
      const native = makePlayer({
        userId: 30,
        categoryId: 'BRONCE',
        pr: 400,
        allowCrossLeague: true,
        joinTimeOffsetSec: 40,
      });
      const invader = makePlayer({ userId: 31, categoryId: 'BRONCE', pr: 800, joinTimeOffsetSec: 40 });
      seedPlayers(queueStore, [native, invader]);
      const m = queue._canMatch(native, invader, now);
      assert(
        m.valid === true && m.effectiveCategoryId === 'BRONCE',
        'Nativo cross + invasor válidos con expansión suficiente (aceptación mutua)',
      );
    }
    {
      const { queue, queueStore } = createTestQueue();
      const native = makePlayer({
        userId: 32,
        categoryId: 'BRONCE',
        pr: 400,
        allowCrossLeague: false,
        joinTimeOffsetSec: 120,
      });
      const invader = makePlayer({ userId: 33, categoryId: 'BRONCE', pr: 800, joinTimeOffsetSec: 120 });
      seedPlayers(queueStore, [native, invader]);
      const m = queue._canMatch(native, invader, now);
      assert(m.valid === false, 'Nativo sin cross no puede aceptar invasor (searchMax capado a 499)');
    }

    console.log('\n--- Production ON: waterfall PLATA → BRONCE ---\n');
    {
      const { queue, queueStore } = createTestQueue();
      const plata = makePlayer({
        userId: 40,
        categoryId: 'PLATA',
        pr: 600,
        allowCrossLeague: true,
        joinTimeOffsetSec: 10,
      });
      const bronce = makePlayer({
        userId: 41,
        categoryId: 'BRONCE',
        pr: 450,
        allowCrossLeague: true,
        joinTimeOffsetSec: 15,
      });
      seedPlayers(queueStore, [plata, bronce]);
      const primary = queueStore.getPlayersByCategory('PLATA');
      const pair = queue._findBestPair(primary, now);
      assert(
        pair !== null
          && pair.effectiveCategoryId === 'BRONCE'
          && (pair.p1.userId === 40 || pair.p2.userId === 40)
          && (pair.p1.userId === 41 || pair.p2.userId === 41),
        '_findBestPair: PLATA (cross) + BRONCE → sala BRONCE',
      );
    }

    console.log('\n--- Production ON: cooldown revancha (hasRecentMatch) ---\n');
    {
      const { queue, queueStore } = createTestQueue({
        recentMatchFn: (u1, u2) => {
          const a = Number(u1);
          const b = Number(u2);
          return (a === 50 && b === 51) || (a === 51 && b === 50);
        },
      });
      const a = makePlayer({ userId: 50, categoryId: 'BRONCE', pr: 250, joinTimeOffsetSec: 0 });
      const b = makePlayer({ userId: 51, categoryId: 'BRONCE', pr: 280, joinTimeOffsetSec: 0 });
      seedPlayers(queueStore, [a, b]);
      const primary = queueStore.getPlayersByCategory('BRONCE');
      const pair = queue._findBestPair(primary, now);
      assert(pair === null, '_findBestPair ignora pareja con revancha reciente (mock)');
    }

    console.log('\n--- Resumen ---\n');
    console.log(`Pasaron: ${pass}  Fallaron: ${fail}`);
    if (fail > 0) process.exitCode = 1;

    console.log(`
--- Lo que este script NO prueba (hazlo manual u otro entorno) ---

  • Socket /domino: join_queue, auth, saldo, pr_out_of_range, leave_queue.
  • Activar productionRules vía HTTP POST /admin/matchmaking/production-rules y recarga real del proceso.
  • Flujo completo: chargeEntryFees, creación de Room, game_start, partida y game_over.
  • Liquidación PR/ELO en BD (runDominoSettlement, K del ganador).
  • Cooldown de revancha tras una partida REAL (3 h); aquí solo se mockea hasRecentMatch.
  • Cola grande (> ${LARGE_QUEUE_THRESHOLD}) y ruta diferida setImmediate.
  • Ligas ORO/DIAMANTE cuando el matchmaking las incluya en CATEGORIES_2V2.
  • Cliente web: toggle "Activar cruce de ligas", modal de ayuda, i18n.
`);
  } finally {
    cfg.matchmaking.productionRulesEnabled = prevProduction;
    const mongoose = require('mongoose');
    await mongoose.disconnect();
    console.log('Mongo desconectado. productionRules restaurado en memoria (reinicia game-server si dependía del valor).');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
