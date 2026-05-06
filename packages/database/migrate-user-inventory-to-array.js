/**
 * Migra user.inventory del formato legacy { avatars, frames, badges }
 * al formato array de subdocumentos.
 *
 * Uso:
 *   node packages/database/migrate-user-inventory-to-array.js
 *   npm run migrate:inventory  (desde packages/database)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, User, mongoose } = require('./index');

function isLegacyInventoryShape(inv) {
  return (
    inv &&
    typeof inv === 'object' &&
    !Array.isArray(inv) &&
    Array.isArray(inv.avatars) &&
    Array.isArray(inv.frames) &&
    Array.isArray(inv.badges)
  );
}

function legacyListToRows(list, subType, avatarId, frameId, badgeId) {
  const rows = [];
  const seen = new Set();
  for (const itemId of list) {
    if (itemId == null || seen.has(itemId)) continue;
    seen.add(itemId);
    let isEquipped = false;
    if (subType === 'avatar_photo') isEquipped = String(avatarId) === String(itemId);
    if (subType === 'avatar_frame') isEquipped = String(frameId) === String(itemId);
    if (subType === 'profile_badge') isEquipped = String(badgeId) === String(itemId);
    rows.push({
      itemId: String(itemId),
      category: 'cosmetic',
      subType,
      quantity: 1,
      isEquipped,
      acquiredAt: new Date(),
    });
  }
  return rows;
}

async function migrate() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('No se encontró MONGO_URI / MONGODB_URI en .env');
    process.exit(1);
  }

  console.log('\nMigración: inventory → array de subdocumentos\n');

  await connectDB(uri);

  const cursor = User.find({}).cursor();
  let updated = 0;
  let skipped = 0;

  for await (const user of cursor) {
    const inv = user.inventory;

    if (Array.isArray(inv)) {
      skipped += 1;
      continue;
    }

    if (!isLegacyInventoryShape(inv)) {
      console.warn(`Usuario ${user._id}: inventory no reconocido, se asigna [].`);
      user.inventory = [];
      await user.save();
      updated += 1;
      continue;
    }

    const avatarId = user.avatar_id ?? 'avatar_default';
    const frameId = user.frame_id ?? 'frame_bronce';
    const badgeId = user.badge_id ?? 'badge_bronce';

    const rows = [
      ...legacyListToRows(inv.avatars, 'avatar_photo', avatarId, frameId, badgeId),
      ...legacyListToRows(inv.frames, 'avatar_frame', avatarId, frameId, badgeId),
      ...legacyListToRows(inv.badges, 'profile_badge', avatarId, frameId, badgeId),
    ];

    user.inventory = rows;
    await user.save();
    updated += 1;
  }

  console.log(`  Usuarios migrados: ${updated}`);
  console.log(`  Ya en formato array (omitidos): ${skipped}\n`);
}

migrate()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
