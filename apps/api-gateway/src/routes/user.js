const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/clear-promotion', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { pendingPromotion: null } },
      { new: true },
    ).lean();

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ ok: true, pendingPromotion: null });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
