/**
 * Seed: inserta la configuración inicial de cada juego en game_configs.
 *
 * - Un documento por juego (gameId único).
 * - Solo inserta si el juego aún no existe, para no sobrescribir cambios manuales.
 * - Usa --force para forzar un upsert aunque el documento ya exista.
 *
 * Uso:
 *   node packages/database/seed-game-config.js
 *   node packages/database/seed-game-config.js --force
 *   npm run seed:config            (desde packages/database)
 *   npm run seed:config -- --force
 */

const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, GameConfig, mongoose } = require('./index');

const FORCE = process.argv.includes('--force');

// ─────────────────────────────────────────────────────────────────────────────
// Datos iniciales
// ─────────────────────────────────────────────────────────────────────────────

const GAMES = [
  {
    gameId:   'domino',
    isActive: true,
    settings: {
      pipMax:       6,   // ficha máxima: [6|6]
      maxHandSize:  7,   // fichas por jugador al repartir
      passThreshold: 3,  // veces que se pasa antes de dar por bloqueada la partida
    },
    ranks: [
      {
        categoryId:        'BRONCE',
        label:             'Bronce',
        minPR:             0,
        maxPR:             999,
        entryFee_subunits: 500,
        maxPlayers:        2,
        targetPoints:      50,
      },
      {
        categoryId:        'PLATA',
        label:             'Plata',
        minPR:             1000,
        maxPR:             1999,
        entryFee_subunits: 1000,
        maxPlayers:        2,
        targetPoints:      50,
      },
      {
        categoryId:        'ORO',
        label:             'Oro',
        minPR:             2000,
        maxPR:             3499,
        entryFee_subunits: 2500,
        maxPlayers:        4,
        targetPoints:      100,
      },
      {
        categoryId:        'DIAMANTE',
        label:             'Diamante',
        minPR:             3500,
        maxPR:             null, // null = sin límite superior (Infinity)
        entryFee_subunits: 5000,
        maxPlayers:        4,
        targetPoints:      100,
      },
    ],
  },

  // ── Plantilla para un segundo juego futuro ────────────────────────────────
  // {
  //   gameId:   'ludo',
  //   isActive: false,
  //   settings: { boardSize: 'classic', diceCount: 1 },
  //   ranks: [ ... ],
  // },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function printRanks(ranks) {
  for (const r of ranks) {
    const maxDisplay = r.maxPR === null ? '∞' : r.maxPR;
    console.log(
      `      • ${r.categoryId.padEnd(8)} | PR ${String(r.minPR).padStart(4)}–${String(maxDisplay).padEnd(4)} | entrada: ${r.entryFee_subunits / 100} piedras | ${r.maxPlayers}j | meta: ${r.targetPoints}pts`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ No se encontró MONGO_URI. Crea un .env en la raíz del proyecto.');
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Seed: GameConfig (multi-juego)');
  if (FORCE) console.log('  Modo: --force (upsert)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await connectDB(uri);

  for (const game of GAMES) {
    const existing = await GameConfig.findOne({ gameId: game.gameId });

    if (existing && !FORCE) {
      console.log(`  ✔ '${game.gameId}' ya existe (${existing.ranks.length} rangos). Omitido.`);
      console.log('    (Usa --force para sobreescribir)\n');
      continue;
    }

    if (FORCE) {
      await GameConfig.findOneAndUpdate(
        { gameId: game.gameId },
        { $set: game },
        { upsert: true, new: true },
      );
      console.log(`  ↺ '${game.gameId}' actualizado (upsert):`);
    } else {
      await GameConfig.create(game);
      console.log(`  ✔ '${game.gameId}' insertado:`);
    }

    console.log(`     Settings: ${JSON.stringify(game.settings)}`);
    console.log(`     Rangos:`);
    printRanks(game.ranks);
    console.log();
  }

  console.log('  Seed completado.\n');
}

seed()
  .catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
