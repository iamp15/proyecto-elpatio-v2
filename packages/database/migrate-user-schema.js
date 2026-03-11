/**
 * Migración: añade los campos pr, rank, current_status, vip_status y stats
 * a los usuarios existentes que no los tienen.
 *
 * Solo actualiza documentos donde el campo no existe; no sobrescribe valores.
 *
 * Uso:
 *   node packages/database/migrate-user-schema.js
 *   npm run migrate:users  (desde packages/database)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, User, mongoose } = require('./index');

const DEFAULTS = {
  pr:           1000,
  rank:         'BRONCE',
  current_status: 'ACTIVE',
  vip_status:   { is_vip: false, days_left: 0, start_date: null },
  stats:        { games_played: 0, games_won: 0, games_lost: 0, games_abandoned: 0 },
};

async function migrate() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ No se encontró MONGO_URI. Crea un .env en la raíz del proyecto.');
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Migración: esquema de Usuario');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await connectDB(uri);

  let anyModified = false;

  for (const [field, value] of Object.entries(DEFAULTS)) {
    const result = await User.updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: value } },
    );
    if (result.modifiedCount > 0) {
      console.log(`  ✔ ${field}: ${result.modifiedCount} usuarios actualizados`);
      anyModified = true;
    }
  }

  if (!anyModified) {
    console.log('  ✔ Todos los usuarios ya tienen los campos actualizados. Nada que migrar.\n');
  } else {
    console.log('\n  ✔ Migración completada.\n');
  }
}

migrate()
  .catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
