const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { User, Transaction } = require('@el-patio/database');

const router = express.Router();

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/**
 * GET /wallet/balance
 * Devuelve el saldo actual del usuario autenticado, leído directamente desde la DB.
 */
router.get('/balance', authMiddleware, async (req, res, next) => {
  try {
    const telegramId = Number(req.user.userId);
    const user = await User.findById(telegramId).lean();

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({
      balance_subunits: user.balance_subunits,
      piedras: Math.floor(user.balance_subunits / 100),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /wallet/history?page=1&limit=20
 * Devuelve el historial de transacciones del usuario autenticado, paginado.
 */
router.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const telegramId = Number(req.user.userId);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const filter = { user_id: telegramId };

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Transaction.countDocuments(filter),
    ]);

    return res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
