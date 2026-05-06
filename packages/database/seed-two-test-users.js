/**
 * Crea dos usuarios de prueba (idempotente: reemplaza si ya existen esos _id).
 *
 * - Usuario A: incluye 5 cupones de entrada a liga bronce (`coupon_bronze`).
 * - Usuario B: mismo perfil base, sin cupones.
 *
 * Uso (desde la raíz del monorepo, con .env y MONGO_URI o MONGODB_URI):
 *   node packages/database/seed-two-test-users.js
 *
 * Opcional — sobrescribe IDs:
 *   node packages/database/seed-two-test-users.js 11111111 22222222
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, User, mongoose } = require('./index');

const DEFAULT_ID_A = 12345678;
const DEFAULT_ID_B = 87654321;

const now = () => new Date();

function baseUserDoc(_id, overrides) {
  return {
    _id,
    tg_firstName: overrides.tg_firstName,
    nickname: overrides.nickname,
    tg_username: null,
    balance_subunits: overrides.balance_subunits ?? 500000,
    pr: overrides.pr ?? 1000,
    rank: overrides.rank ?? 'BRONCE',
    current_status: 'ACTIVE',
    avatar_id: 'avatar_default',
    frame_id: 'frame_bronce',
    badge_id: 'badge_bronce',
    vip_status: { is_vip: false, start_date: null, expiresAt: null },
    stats: {
      games_played: 0,
      games_won: 0,
      games_lost: 0,
      games_abandoned: 0,
    },
    inventory: overrides.inventory ?? [],
  };
}

function starterCosmetics(acquiredAt) {
  return [
    {
      itemId: 'avatar_default',
      category: 'cosmetic',
      subType: 'avatar_photo',
      quantity: 1,
      isEquipped: true,
      acquiredAt,
    },
    {
      itemId: 'frame_bronce',
      category: 'cosmetic',
      subType: 'avatar_frame',
      quantity: 1,
      isEquipped: true,
      acquiredAt,
    },
    {
      itemId: 'badge_bronce',
      category: 'cosmetic',
      subType: 'profile_badge',
      quantity: 1,
      isEquipped: true,
      acquiredAt,
    },
  ];
}

async function main() {
  const idA = Number(process.argv[2]) || DEFAULT_ID_A;
  const idB = Number(process.argv[3]) || DEFAULT_ID_B;

  if (!Number.isFinite(idA) || !Number.isFinite(idB) || idA <= 0 || idB <= 0 || idA === idB) {
    console.error('❌ Los dos _id deben ser números positivos y distintos.');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ Falta MONGO_URI o MONGODB_URI en .env (raíz del proyecto).');
    process.exit(1);
  }

  await connectDB(uri);

  const t = now();

  const userWithCoupons = baseUserDoc(idA, {
    tg_firstName: 'UsuarioCupones',
    nickname: 'demo_cupones',
    inventory: [
      ...starterCosmetics(t),
      {
        itemId: 'coupon_bronze',
        category: 'consumable',
        subType: 'league_coupon',
        quantity: 5,
        isEquipped: false,
        acquiredAt: t,
      },
    ],
  });

  const userPlain = baseUserDoc(idB, {
    tg_firstName: 'UsuarioSinCupones',
    nickname: 'demo_sin_cupones',
    inventory: starterCosmetics(t),
  });

  await User.deleteMany({ _id: { $in: [idA, idB] } });
  const created = await User.insertMany([userWithCoupons, userPlain], { ordered: true });

  console.log('\n✔  Usuarios de prueba creados:\n');
  for (const u of created) {
    const coupons = (u.inventory || []).find((e) => e.itemId === 'coupon_bronze');
    const q = coupons ? coupons.quantity : 0;
    console.log(
      `   _id=${u._id}  nickname=${u.nickname}  piedras≈${Math.floor(u.balance_subunits / 100)}  cupones_bronce=${q}`,
    );
  }
  console.log('');
}

main()
  .catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
