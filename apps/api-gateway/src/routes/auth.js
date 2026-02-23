const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateInitData, parseInitDataUser } = require('../lib/telegram');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = '7d';

// Si es modo desarrollo y enviamos isMock, saltamos la validación de Telegram
router.post('/login', async (req, res, next) => {
  try {
    const { isMock, userId: bodyUserId, initData } = req.body || {};

    if (process.env.NODE_ENV !== 'production' && isMock === true) {
      const userId = Number(bodyUserId);
      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: 'userId (number) required for mock login' });
      }
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario mock no encontrado' });
      }
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      return res.json({
        token,
        user: { id: user._id, username: user.username ?? null },
      });
    }

    // Rama Telegram: validar initData
    if (!initData || typeof initData !== 'string') {
      return res.status(400).json({ error: 'initData (string) required' });
    }
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(503).json({ error: 'Servidor no configurado para validar Telegram' });
    }
    if (!validateInitData(initData, botToken)) {
      return res.status(401).json({ error: 'initData inválido o expirado' });
    }
    const tgUser = parseInitDataUser(initData);
    if (!tgUser || tgUser.id == null) {
      return res.status(401).json({ error: 'Datos de usuario de Telegram no válidos' });
    }
    const id = Number(tgUser.id);
    const username = tgUser.username || tgUser.first_name || null;

    let user = await User.findById(id);
    if (!user) {
      user = await User.create({ _id: id, username });
    } else if (username && !user.username) {
      user.username = username;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({
      token,
      user: { id: user._id, username: user.username ?? null },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
