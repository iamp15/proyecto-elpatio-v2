const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});

/** Para diagnóstico: al llamar GET /health/debug se escribe un log. Útil para comprobar que las peticiones llegan al gateway (túnel, CORS, VITE_API_URL). */
router.get('/debug', (req, res) => {
  console.log('[health] GET /health/debug recibido', new Date().toISOString(), '| Origin:', req.get('origin') || '-');
  res.json({ ok: true, message: 'api-gateway recibió la petición', timestamp: new Date().toISOString() });
});

module.exports = router;
