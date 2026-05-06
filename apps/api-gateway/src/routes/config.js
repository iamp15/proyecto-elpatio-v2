const express = require('express');
const { AppConfigManager } = require('@el-patio/database');

const router = express.Router();

/**
 * GET /config/store
 * Devuelve los paquetes de la tienda desde la configuración global en RAM.
 */
router.get('/store', (req, res) => {
  try {
    const config = AppConfigManager.getConfig();
    const storePackages = config.economy?.storePackages || [];
    
    res.json({
      ok: true,
      storePackages
    });
  } catch (error) {
    console.error('[GET /config/store] Error:', error);
    res.status(500).json({ ok: false, error: 'Error al obtener la configuración de la tienda' });
  }
});

module.exports = router;
