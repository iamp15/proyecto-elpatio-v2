const express = require('express');
const { AppConfigManager } = require('@el-patio/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /store/create-invoice
 * Genera un enlace de factura de Telegram Stars para un paquete de la tienda.
 */
router.post('/create-invoice', authMiddleware, async (req, res) => {
  try {
    const packId = String(req.body?.packId ?? '').trim();
    console.log('[store:create-invoice] Request recibido:', {
      userId: req.user?.userId,
      packId,
      hasBody: req.body != null,
    });

    if (!packId) {
      console.warn('[store:create-invoice] packId faltante');
      return res.status(400).json({ error: 'packId requerido' });
    }

    const config = AppConfigManager.getConfig();
    const storePackages = config.economy?.storePackages || [];
    const pack = storePackages.find((p) => p?.id === packId);
    console.log('[store:create-invoice] Paquete buscado:', {
      packId,
      found: Boolean(pack),
      availablePackIds: storePackages.map((p) => p?.id).filter(Boolean),
    });

    if (!pack) {
      console.warn('[store:create-invoice] Paquete no encontrado:', packId);
      return res.status(400).json({ error: 'Paquete no encontrado' });
    }

    const stars = Math.trunc(Number(pack.stars));
    if (!Number.isFinite(stars) || stars <= 0) {
      console.warn('[store:create-invoice] Stars inválidas:', { packId, stars: pack.stars });
      return res.status(400).json({ error: 'Paquete inválido (stars)' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || typeof botToken !== 'string') {
      console.error('[POST /store/create-invoice] TELEGRAM_BOT_TOKEN no configurado');
      return res.status(500).json({ error: 'Servidor no configurado para facturación' });
    }

    const userId = req.user?.userId;
    if (userId == null) {
      console.warn('[store:create-invoice] userId ausente en JWT');
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const title = `Paquete de ${pack.piedras} Piedras`;
    const description = 'Recarga de saldo para El Patio Dominó';
    const payload = `${userId}_${packId}`;
    console.log('[store:create-invoice] Payload Telegram preparado:', {
      title,
      payload,
      currency: 'XTR',
      priceAmount: stars,
    });

    const url = `https://api.telegram.org/bot${botToken}/createInvoiceLink`;

    const telegramRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        payload,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: pack.name, amount: stars }],
      }),
    });

    const telegramJson = await telegramRes.json().catch(() => null);
    console.log('[store:create-invoice] Respuesta Telegram:', {
      httpStatus: telegramRes.status,
      ok: telegramJson?.ok,
      hasResult: typeof telegramJson?.result === 'string',
      description: telegramJson?.description,
      errorCode: telegramJson?.error_code,
    });

    if (!telegramJson?.ok) {
      console.error('[POST /store/create-invoice] Telegram error:', telegramJson);
      return res.status(500).json({ error: 'No se pudo crear la factura' });
    }

    const invoiceUrl = telegramJson.result;
    if (typeof invoiceUrl !== 'string' || !invoiceUrl.length) {
      console.error('[POST /store/create-invoice] Respuesta Telegram sin result válido');
      return res.status(500).json({ error: 'Respuesta de facturación inválida' });
    }

    console.log('[store:create-invoice] Invoice creada correctamente:', { packId, userId });
    return res.json({ success: true, invoiceUrl });
  } catch (error) {
    console.error('[POST /store/create-invoice]', error);
    return res.status(500).json({ error: 'Error al crear la factura' });
  }
});

module.exports = router;
