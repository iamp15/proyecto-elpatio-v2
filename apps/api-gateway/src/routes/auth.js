const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  validateInitData,
  parseInitDataUser,
  normalizeTelegramFirstName,
  normalizeTelegramUsername,
} = require('../lib/telegram');
const { validateNickname } = require('../lib/validateNickname');
const { authMiddleware } = require('../middleware/auth');
const {
  isVipEffective,
  checkAndRefillDailyCoupons,
  ensureExpiredVipBadgeReverted,
} = require('@el-patio/database');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = '7d';

const NICKNAME_INDEX_COLLATION = { locale: 'es', strength: 2 };

const DEFAULT_AVATAR_ID = 'avatar_default';
const DEFAULT_FRAME_ID = 'frame_bronce';
const DEFAULT_BADGE_ID = 'badge_bronce';

function createStarterInventory() {
  const acquiredAt = new Date();
  return [
    {
      itemId: DEFAULT_AVATAR_ID,
      category: 'cosmetic',
      subType: 'avatar_photo',
      quantity: 1,
      isEquipped: true,
      acquiredAt,
    },
    {
      itemId: DEFAULT_FRAME_ID,
      category: 'cosmetic',
      subType: 'avatar_frame',
      quantity: 1,
      isEquipped: true,
      acquiredAt,
    },
    {
      itemId: DEFAULT_BADGE_ID,
      category: 'cosmetic',
      subType: 'profile_badge',
      quantity: 1,
      isEquipped: true,
      acquiredAt,
    },
    {
      itemId: 'coupon_bronze',
      category: 'consumable',
      subType: 'league_coupon',
      quantity: 5,
      isEquipped: false,
      acquiredAt,
    },
  ];
}

function createNewUserPayload(base) {
  return {
    ...base,
    avatar_id: DEFAULT_AVATAR_ID,
    frame_id: DEFAULT_FRAME_ID,
    badge_id: DEFAULT_BADGE_ID,
    inventory: createStarterInventory(),
  };
}

function publicUserPayload(user) {
  const tgFirst = user.tg_firstName ?? null;
  const tgUsern = user.tg_username ?? null;
  return {
    id:           user._id,
    tg_firstName: tgFirst,
    tg_username:  tgUsern,
    /** @deprecated usar tg_firstName; se mantiene para clientes que lean first_name */
    first_name:   tgFirst,
    /** @deprecated usar tg_username; se mantiene para clientes que lean username */
    username:     tgUsern,
    nickname:     user.nickname ?? null,
    avatar_id:  user.avatar_id ?? DEFAULT_AVATAR_ID,
    frame_id:   user.frame_id ?? DEFAULT_FRAME_ID,
    badge_id:   user.badge_id ?? DEFAULT_BADGE_ID,
    pr:         user.pr ?? 1000,
    rank:       user.rank ?? 'BRONCE',
    pendingPromotion: user.pendingPromotion ?? null,
    vip_status: {
      is_vip:     isVipEffective(user.vip_status),
      start_date: user.vip_status?.start_date ?? null,
      expiresAt:  user.vip_status?.expiresAt ?? null,
    },
  };
}

// Si es modo desarrollo y enviamos isMock, saltamos la validación de Telegram
router.post('/login', async (req, res, next) => {
  try {
    const { isMock, userId: bodyUserId, initData } = req.body || {};
    const nodeEnv = process.env.NODE_ENV;
    const hasInitData = typeof initData === 'string' && initData.length > 0;
    console.log('[auth] POST /login', {
      NODE_ENV: nodeEnv,
      isMock: !!isMock,
      hasInitData,
      initDataLength: typeof initData === 'string' ? initData.length : 0,
    });

    if (nodeEnv !== 'production' && isMock === true) {
      const userId = Number(bodyUserId);
      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: 'userId (number) required for mock login' });
      }
      let user = await User.findById(userId);
      if (!user) {
        user = await User.create(createNewUserPayload({
          _id:          userId,
          tg_firstName: 'Mock',
          tg_username:  'mockuser',
        }));
        console.log('[auth] Usuario mock creado:', user._id);
      }
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      await ensureExpiredVipBadgeReverted(user);
      const dailyReward = await checkAndRefillDailyCoupons(user);
      console.log('[auth] Login MOCK OK:', user._id, user.tg_username);
      return res.json({
        token,
        user: publicUserPayload(user),
        dailyReward,
      });
    }

    if (!initData || typeof initData !== 'string') {
      console.log('[auth] Login Telegram rechazado: initData faltante o no string');
      return res.status(400).json({ error: 'initData (string) required' });
    }
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.log('[auth] Login Telegram rechazado: sin TELEGRAM_BOT_TOKEN');
      return res.status(503).json({ error: 'Servidor no configurado para validar Telegram' });
    }
    if (!validateInitData(initData, botToken)) {
      console.log('[auth] Login Telegram rechazado: initData inválido o expirado');
      return res.status(401).json({ error: 'initData inválido o expirado' });
    }
    const tgUser = parseInitDataUser(initData);
    if (!tgUser || tgUser.id == null) {
      console.log('[auth] Login Telegram rechazado: datos de usuario no válidos');
      return res.status(401).json({ error: 'Datos de usuario de Telegram no válidos' });
    }
    const id = Number(tgUser.id);
    const tg_firstName = normalizeTelegramFirstName(tgUser.first_name);
    const tg_username = normalizeTelegramUsername(tgUser.username);
    console.log('[auth] initData válido. Usuario Telegram:', { id, tg_firstName, tg_username });

    let user = await User.findById(id);
    if (!user) {
      user = await User.create(createNewUserPayload({ _id: id, tg_firstName, tg_username }));
    } else {
      user.tg_firstName = tg_firstName;
      user.tg_username = tg_username;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    await ensureExpiredVipBadgeReverted(user);
    const dailyReward = await checkAndRefillDailyCoupons(user);
    console.log('[auth] Login Telegram OK:', user._id, { tg_firstName, tg_username });
    res.json({
      token,
      user: publicUserPayload(user),
      dailyReward,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /auth/me
 * Devuelve el perfil actualizado del usuario autenticado (pr, rank, balance incluidos).
 * Úsalo al arrancar la app para sincronizar el localStorage con los datos reales de la BD.
 */
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const user   = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await ensureExpiredVipBadgeReverted(user);
    const dailyReward = await checkAndRefillDailyCoupons(user);
    res.json({
      user: publicUserPayload(user),
      dailyReward,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /auth/nickname/check
 * Comprueba si el nickname está libre (misma validación que PATCH) sin guardar.
 */
router.post('/nickname/check', authMiddleware, async (req, res, next) => {
  try {
    const { nickname } = req.body || {};
    const validation = validateNickname(nickname);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.message });
    }

    const value = validation.nickname;
    const userId = req.user?.userId;

    const taken = await User.findOne({
      nickname: value,
      _id: { $ne: userId },
    }).collation(NICKNAME_INDEX_COLLATION);

    res.json({ available: !taken });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /auth/nickname
 * Establece o actualiza el nickname (validación y unicidad case-insensitive en servidor).
 */
router.patch('/nickname', authMiddleware, async (req, res, next) => {
  try {
    const { nickname } = req.body || {};
    const validation = validateNickname(nickname);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.message });
    }

    const value = validation.nickname;
    const userId = req.user?.userId;

    const taken = await User.findOne({
      nickname: value,
      _id: { $ne: userId },
    }).collation(NICKNAME_INDEX_COLLATION);

    if (taken) {
      return res.status(409).json({ error: 'Este nickname ya está en uso' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.nickname = value;
    try {
      await user.save();
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: 'Este nickname ya está en uso' });
      }
      throw e;
    }

    res.json({ user: publicUserPayload(user) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
