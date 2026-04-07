/**
 * Migración: reemplaza el campo legacy `username` (mezcla de handle/nombre) por
 * `tg_firstName` y `tg_username`, y elimina `username` de cada documento.
 *
 * Heurística para el valor antiguo `username` en BD:
 * - Si coincide con el patrón de handle de Telegram (solo minúsculas, 5–32, [a-z0-9_])
 *   → se asigna a `tg_username`.
 * - En cualquier otro caso (nombre con espacios, mayúsculas, "MockUser", etc.)
 *   → se asigna a `tg_firstName`.
 *
 * Si el documento ya tiene `tg_firstName` o `tg_username` definidos, solo se rellenan
 * los que falten desde `username` legacy y luego se hace $unset de `username`.
 *
 * Uso:
 *   node packages/database/migrate-user-tg-fields.js
 *   npm run migrate:tg-fields  (desde packages/database)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, mongoose } = require('./index');

/** @param {string|undefined|null} legacy */
function splitLegacyUsername(legacy) {
  if (legacy == null || String(legacy).trim() === '') {
    return { tg_firstName: null, tg_username: null };
  }
  const s = String(legacy).trim();
  if (/^[a-z0-9_]{5,32}$/.test(s)) {
    return { tg_firstName: null, tg_username: s };
  }
  return { tg_firstName: s, tg_username: null };
}

async function migrate() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ No se encontró MONGO_URI. Crea un .env en la raíz del proyecto.');
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Migración: tg_firstName / tg_username (desde username legacy)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await connectDB(uri);

  const col = mongoose.connection.collection('users');
  const cursor = col.find({ username: { $exists: true } });
  let updated = 0;

  for await (const doc of cursor) {
    const legacyVal = doc.username;

    const hasFirst = doc.tg_firstName != null && String(doc.tg_firstName).trim() !== '';
    const hasUser = doc.tg_username != null && String(doc.tg_username).trim() !== '';

    const $set = {};
    if (legacyVal != null && String(legacyVal).trim() !== '') {
      const split = splitLegacyUsername(legacyVal);
      if (!hasFirst && split.tg_firstName) {
        $set.tg_firstName = split.tg_firstName;
      }
      if (!hasUser && split.tg_username) {
        $set.tg_username = split.tg_username;
      }
    }

    const update = { $unset: { username: '' } };
    if (Object.keys($set).length > 0) {
      update.$set = $set;
    }

    await col.updateOne({ _id: doc._id }, update);
    updated += 1;
  }

  console.log(`  ✔ Documentos procesados (campo username eliminado): ${updated}\n`);
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
