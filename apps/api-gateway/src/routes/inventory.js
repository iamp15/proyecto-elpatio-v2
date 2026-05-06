const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  getInventory,
  postEquip,
  postActivate,
} = require('../controllers/inventoryController');

const router = express.Router();

router.get('/', authMiddleware, getInventory);
router.post('/equip', authMiddleware, postEquip);
router.post('/activate', authMiddleware, postActivate);

module.exports = router;
