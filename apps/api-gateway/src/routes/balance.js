const express = require('express');
const Balance = require('../models/Balance');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const balance = await Balance.findOne({ userId: req.user.userId });
    if (!balance) {
      return res.status(404).json({ error: 'Balance not found' });
    }
    res.json({ piedras: balance.piedras });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
