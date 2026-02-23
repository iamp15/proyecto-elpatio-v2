const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { User } = require('@el-patio/database');
const router = express.Router();

// Mi balance (requiere token)
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const telegramId = Number(req.user.userId);
    const user = await User.findById(telegramId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ piedras: user.piedras_display ?? Math.floor(user.balance_subunits / 100) });
  } catch (e) {
    next(e);
  }
});

// Consulta pública por ID de Telegram (para el bot o pruebas)
router.get('/:id', async (req, res) => {
  try {
    const telegramId = Number(req.params.id);
    if (Number.isNaN(telegramId)) {
      return res.status(400).json({ error: 'ID debe ser numérico' });
    }
    const user = await User.findById(telegramId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({
      username: user.username,
      piedras: user.piedras_display ?? Math.floor(user.balance_subunits / 100),
      wallet: user.ton_wallet,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener balance' });
  }
});

module.exports = router;
