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
        user = await User.create({ _id: userId, username: 'MockUser' });
        console.log('[auth] Usuario mock creado:', user._id);
      }
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      console.log('[auth] Login MOCK OK:', user._id, user.username);
      return res.json({
        token,
        user: { id: user._id, username: user.username ?? null },
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
    const username = tgUser.username || tgUser.first_name || null;
    console.log('[auth] initData válido. Usuario Telegram:', { id, username });

    let user = await User.findById(id);
    if (!user) {
      user = await User.create({ _id: id, username });
    } else if (username && !user.username) {
      user.username = username;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    console.log('[auth] Login Telegram OK:', user._id, user.username);
    res.json({
      token,
      user: { id: user._id, username: user.username ?? null },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
