/**
 * Script para crear o actualizar un usuario de prueba con saldo específico.
 *
 * Uso:
 *   node packages/database/create-test-user.js [userId] [piedras] [username]
 *
 * Ejemplos:
 *   node packages/database/create-test-user.js                   → ID:12345678, 50 piedras, "TestUser"
 *   node packages/database/create-test-user.js 99999999 10       → ID:99999999, 10 piedras
 *   node packages/database/create-test-user.js 99999999 200 Ana  → ID:99999999, 200 piedras, "Ana"
 *
 * Si el usuario ya existe, su saldo se SOBRESCRIBE con el valor indicado.
 * No borra otros usuarios de la base de datos.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, User, mongoose } = require('./index');

const DEFAULT_ID       = 12345678;
const DEFAULT_PIEDRAS  = 50;
const DEFAULT_USERNAME = 'TestUser';

async function main() {
  const userId   = Number(process.argv[2]) || DEFAULT_ID;
  const piedras  = Number(process.argv[3]) ?? DEFAULT_PIEDRAS;
  const username = process.argv[4] || DEFAULT_USERNAME;

  if (Number.isNaN(userId) || userId <= 0) {
    console.error('❌ userId debe ser un número positivo.');
    process.exit(1);
  }
  if (Number.isNaN(piedras) || piedras < 0) {
    console.error('❌ piedras debe ser un número >= 0.');
    process.exit(1);
  }

  const balance_subunits = Math.round(piedras * 100);
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ No se encontró MONGO_URI. Crea un .env en la raíz del proyecto.');
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Crear / Actualizar usuario de prueba');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  ID       : ${userId}`);
  console.log(`  Username : ${username}`);
  console.log(`  Piedras  : ${piedras}  (${balance_subunits} sub-unidades)\n`);

  await connectDB(uri);

  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $set: { username, balance_subunits } },
    { upsert: true, new: true },
  );

  const accion = user.createdAt?.getTime() === user.updatedAt?.getTime() ? 'creado' : 'actualizado';

  console.log(`  ✔  Usuario ${accion}: ID=${user._id}, saldo=${user.balance_subunits / 100} piedras\n`);
}

main()
  .catch((err) => {
    console.error('\n❌ Error inesperado:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
