/**
 * Script interactivo para otorgar o retirar cupones de entrada a un usuario existente.
 *
 * Uso:
 *   node packages/database/grant-user-coupons.js
 *
 * También acepta argumentos opcionales:
 *   node packages/database/grant-user-coupons.js [userId] [bronce|plata|oro|diamante] [cantidad]
 *
 * Cantidad positiva agrega cupones; cantidad negativa los retira sin permitir valores < 0.
 */

const path = require('path');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, User, mongoose } = require('./index');

const COUPON_BY_TYPE = {
  bronce: { itemId: 'coupon_bronze', label: 'Bronce' },
  plata: { itemId: 'coupon_plata', label: 'Plata' },
  oro: { itemId: 'coupon_oro', label: 'Oro' },
  diamante: { itemId: 'coupon_diamante', label: 'Diamante' },
};

function normalizeCouponType(value) {
  return String(value || '').trim().toLowerCase();
}

function parsePositiveInteger(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${fieldName} debe ser un número entero positivo.`);
  }
  return n;
}

function parseNonZeroInteger(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n === 0) {
    throw new Error(`${fieldName} debe ser un número entero distinto de 0.`);
  }
  return n;
}

async function askMissingInputs() {
  const rl = readline.createInterface({ input, output });
  try {
    const userIdRaw =
      process.argv[2] ||
      (await rl.question('ID de usuario (Telegram _id): '));

    const couponTypeRaw =
      process.argv[3] ||
      (await rl.question('Tipo de cupón (bronce, plata, oro, diamante): '));

    const quantityRaw =
      process.argv[4] ||
      (await rl.question('Cantidad de cupones a agregar o retirar (usa negativo para retirar): '));

    return {
      userId: parsePositiveInteger(userIdRaw, 'userId'),
      couponType: normalizeCouponType(couponTypeRaw),
      quantity: parseNonZeroInteger(quantityRaw, 'cantidad'),
    };
  } finally {
    rl.close();
  }
}

async function main() {
  const { userId, couponType, quantity } = await askMissingInputs();
  const coupon = COUPON_BY_TYPE[couponType];
  if (!coupon) {
    throw new Error('Tipo de cupón inválido. Usa: bronce, plata, oro o diamante.');
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta MONGO_URI o MONGODB_URI en .env (raíz del proyecto).');
  }

  await connectDB(uri);

  const user = await User.findById(userId);
  if (!user) {
    throw new Error(`Usuario no encontrado: ${userId}`);
  }

  const idx = user.inventory.findIndex((item) => item.itemId === coupon.itemId);
  const entry = idx >= 0 ? user.inventory[idx] : null;
  const previousQuantity = Number(entry?.quantity || 0);
  const nextQuantity = Math.max(0, previousQuantity + quantity);
  const appliedDelta = nextQuantity - previousQuantity;

  if (entry && nextQuantity > 0) {
    entry.quantity = nextQuantity;
    entry.category = 'consumable';
    entry.subType = 'league_coupon';
    entry.isEquipped = false;
  } else if (entry) {
    user.inventory.splice(idx, 1);
  } else if (quantity > 0) {
    user.inventory.push({
      itemId: coupon.itemId,
      category: 'consumable',
      subType: 'league_coupon',
      quantity,
      isEquipped: false,
      acquiredAt: new Date(),
    });
  } else {
    console.warn(
      `\n⚠ El usuario no tiene ${coupon.itemId}; no se retiraron cupones.`,
    );
  }

  await user.save();

  const updatedEntry = user.inventory.find((item) => item.itemId === coupon.itemId);
  console.log('\n✔ Inventario de cupones actualizado correctamente');
  console.log(`  Usuario : ${user._id} (${user.nickname || user.tg_firstName || 'sin nombre'})`);
  console.log(`  Cupón   : ${coupon.label} (${coupon.itemId})`);
  console.log(`  Antes   : ${previousQuantity}`);
  console.log(`  Cambio  : ${appliedDelta}`);
  console.log(`  Total   : ${updatedEntry?.quantity ?? 0}\n`);
}

main()
  .catch((err) => {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
