const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Balance = require('../models/Balance');
const router = express.Router();

// Placeholder: validar initData de Telegram en producción
// Por ahora se acepta un body con telegramId para desarrollo
router.post('/login', async (req, res, next) => {
  try {
    const { telegramId, username, firstName, lastName } = req.body || {};
    const id = String(telegramId || req.body?.user?.id || '');
    if (!id) {
      return res.status(400).json({ error: 'telegramId or user.id required' });
    }
    let user = await User.findOne({ telegramId: id });
    if (!user) {
      user = await User.create({
        telegramId: id,
        username: username || req.body?.user?.username,
        firstName: firstName || req.body?.user?.first_name,
        lastName: lastName || req.body?.user?.last_name,
      });
      await Balance.create({ userId: user._id, piedras: 0 });
    }
    const token = jwt.sign(
      { userId: user._id.toString(), telegramId: user.telegramId },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user._id, telegramId: user.telegramId } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
