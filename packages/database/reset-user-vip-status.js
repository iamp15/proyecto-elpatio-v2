/**
 * Resetea el estatus VIP de un usuario existente al valor default.
 *
 * Uso:
 *   node packages/database/reset-user-vip-status.js
 *
 * También acepta el ID como argumento opcional:
 *   node packages/database/reset-user-vip-status.js [userId]
 */

const path = require('path');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, User, mongoose } = require('./index');

const DEFAULT_VIP_STATUS = { is_vip: false, start_date: null, expiresAt: null };

function parsePositiveInteger(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${fieldName} debe ser un numero entero positivo.`);
  }
  return n;
}

async function askUserId() {
  const rl = readline.createInterface({ input, output });
  try {
    const userIdRaw =
      process.argv[2] ||
      (await rl.question('ID de usuario (Telegram _id): '));

    return parsePositiveInteger(userIdRaw, 'userId');
  } finally {
    rl.close();
  }
}

async function main() {
  const userId = await askUserId();
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta MONGO_URI o MONGODB_URI en .env (raiz del proyecto).');
  }

  await connectDB(uri);

  const user = await User.findById(userId);
  if (!user) {
    throw new Error(`Usuario no encontrado: ${userId}`);
  }

  const previousVipStatus = user.vip_status
    ? {
        is_vip: user.vip_status.is_vip,
        start_date: user.vip_status.start_date,
        expiresAt: user.vip_status.expiresAt,
      }
    : null;

  user.vip_status = { ...DEFAULT_VIP_STATUS };
  await user.save();

  console.log('\n✔ Estatus VIP reseteado correctamente');
  console.log(`  Usuario : ${user._id} (${user.nickname || user.tg_firstName || 'sin nombre'})`);
  console.log('  Antes   :', previousVipStatus);
  console.log('  Ahora   :', user.vip_status);
  console.log('');
}

main()
  .catch((err) => {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
