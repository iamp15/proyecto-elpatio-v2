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
const { getUnlockedItems, getBadgeById } = require('../lib/cosmeticsCatalog');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = '7d';

const NICKNAME_INDEX_COLLATION = { locale: 'es', strength: 2 };

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
    avatar_id:  user.avatar_id ?? 'telegram',
    frame_id:   user.frame_id ?? 'rank',
    badge_id:   user.badge_id ?? 'default',
    badge_contexts: user.badge_contexts ?? { global: 'default', domino: null },
    pr:         user.pr ?? 1000,
    rank:       user.rank ?? 'BRONCE',
    vip_status: user.vip_status ?? { is_vip: false },
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
        user = await User.create({
          _id:          userId,
          tg_firstName: 'Mock',
          tg_username:  'mockuser',
        });
        console.log('[auth] Usuario mock creado:', user._id);
      }
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      console.log('[auth] Login MOCK OK:', user._id, user.tg_username);
      return res.json({
        token,
        user: publicUserPayload(user),
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
      user = await User.create({ _id: id, tg_firstName, tg_username });
    } else {
      user.tg_firstName = tg_firstName;
      user.tg_username = tg_username;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    console.log('[auth] Login Telegram OK:', user._id, { tg_firstName, tg_username });
    res.json({
      token,
      user: publicUserPayload(user),
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
    const user   = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      user: publicUserPayload(user),
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

/**
 * GET /auth/profile/cosmetics
 * Devuelve el catálogo completo y los items desbloqueados por el usuario.
 */
router.get('/profile/cosmetics', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const unlocked = getUnlockedItems(user);
    res.json({
      unlocked,
      selected: {
        avatar_id: user.avatar_id ?? 'telegram',
        frame_id:  user.frame_id ?? 'rank',
        badge_id:  user.badge_id ?? 'default',
        badge_contexts: user.badge_contexts ?? { global: 'default', domino: null },
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /auth/profile/cosmetics
 * Actualiza los cosméticos seleccionados del usuario.
 * Valida que los IDs existan y estén desbloqueados.
 */
router.patch('/profile/cosmetics', authMiddleware, async (req, res, next) => {
  try {
    const { avatar_id, frame_id, badge_id, badge_contexts } = req.body || {};
    const userId = req.user?.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Obtener items desbloqueados
    const unlocked = getUnlockedItems(user);
    const errors = [];

    if (avatar_id !== undefined) {
      if (!unlocked.avatars.includes(avatar_id)) {
        errors.push('El avatar seleccionado no está desbloqueado');
      } else {
        user.avatar_id = avatar_id;
      }
    }
    if (frame_id !== undefined) {
      if (!unlocked.frames.includes(frame_id)) {
        errors.push('El marco seleccionado no está desbloqueado');
      } else {
        user.frame_id = frame_id;
      }
    }

    // Si se pasa badge_id, actualiza badge_contexts.global (compatibilidad)
    if (badge_id !== undefined) {
      if (!unlocked.badges.includes(badge_id)) {
        errors.push('El badge seleccionado no está desbloqueado');
      } else {
        const badge = getBadgeById(badge_id);
        // Si el badge tiene contexto global, actualizamos badge_contexts.global
        if (badge && badge.context === 'global') {
          user.badge_contexts = {
            ...user.badge_contexts,
            global: badge_id,
          };
        }
        // También mantener badge_id por compatibilidad
        user.badge_id = badge_id;
      }
    }

    // Si se pasa badge_contexts, validar cada contexto
    if (badge_contexts !== undefined) {
      // Por seguridad, solo permitimos actualizar global y domino
      if (badge_contexts.global !== undefined) {
        if (!unlocked.badges.includes(badge_contexts.global)) {
          errors.push('El badge global seleccionado no está desbloqueado');
        } else {
          const badge = getBadgeById(badge_contexts.global);
          if (badge && badge.context !== 'global') {
            errors.push('El badge global debe tener contexto global');
          } else {
            user.badge_contexts.global = badge_contexts.global;
          }
        }
      }
      if (badge_contexts.domino !== undefined) {
        if (!unlocked.badges.includes(badge_contexts.domino)) {
          errors.push('El badge de dominó seleccionado no está desbloqueado');
        } else {
          const badge = getBadgeById(badge_contexts.domino);
          if (badge && badge.context !== 'domino') {
            errors.push('El badge de dominó debe tener contexto domino');
          } else {
            user.badge_contexts.domino = badge_contexts.domino;
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    await user.save();
    res.json({ user: publicUserPayload(user) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
