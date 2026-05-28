const express = require('express');
const {
  AppConfigManager,
  User,
  Transaction,
  applyVipPackagePurchase,
} = require('@el-patio/database');
const { authMiddleware } = require('../middleware/auth');
const { buildInvoicePayload, parseInvoicePayload } = require('../lib/invoicePayload');

const router = express.Router();

function generateInvoiceNonce() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createTelegramInvoiceLink({
  title,
  description,
  payload,
  label,
  stars,
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || typeof botToken !== 'string') {
    throw Object.assign(new Error('Servidor no configurado para facturación'), { statusCode: 500 });
  }

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
      prices: [{ label, amount: stars }],
    }),
  });

  const telegramJson = await telegramRes.json().catch(() => null);
  if (!telegramJson?.ok || typeof telegramJson?.result !== 'string' || !telegramJson.result.length) {
    throw Object.assign(new Error('No se pudo crear la factura'), { statusCode: 500 });
  }

  return telegramJson.result;
}

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

    const userId = req.user?.userId;
    if (userId == null) {
      console.warn('[store:create-invoice] userId ausente en JWT');
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const title = `Paquete de ${pack.piedras} Piedras`;
    const description = 'Recarga de saldo para El Patio Dominó';
    const payload = buildInvoicePayload({ userId, kind: 'stones', packId });
    console.log('[store:create-invoice] Payload Telegram preparado:', {
      title,
      payload,
      currency: 'XTR',
      priceAmount: stars,
    });

    const invoiceUrl = await createTelegramInvoiceLink({
      title,
      description,
      payload,
      label: pack.name,
      stars,
    });

    console.log('[store:create-invoice] Invoice creada correctamente:', { packId, userId });
    return res.json({ success: true, invoiceUrl });
  } catch (error) {
    console.error('[POST /store/create-invoice]', error);
    return res.status(500).json({ error: 'Error al crear la factura' });
  }
});

/**
 * POST /store/create-vip-invoice
 * Genera invoice Telegram Stars para activar/renovar VIP.
 */
router.post('/create-vip-invoice', authMiddleware, async (req, res) => {
  try {
    const packId = String(req.body?.packId ?? '').trim();
    if (!packId) {
      return res.status(400).json({ error: 'packId requerido' });
    }

    const config = AppConfigManager.getConfig();
    const vipPackages = config.economy?.vipPackages || {};
    const pack = vipPackages[packId];
    if (!pack) {
      return res.status(400).json({ error: 'Paquete VIP no encontrado' });
    }

    const stars = Math.trunc(Number(pack.stars));
    if (!Number.isFinite(stars) || stars <= 0) {
      return res.status(400).json({ error: 'Paquete VIP inválido (stars)' });
    }

    const userId = req.user?.userId;
    if (userId == null) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const title = `VIP ${pack.days} días`;
    const description = 'Membresía VIP para El Patio Dominó';
    const payload = buildInvoicePayload({
      userId,
      kind: 'vip',
      packId,
      nonce: generateInvoiceNonce(),
    });

    const invoiceUrl = await createTelegramInvoiceLink({
      title,
      description,
      payload,
      label: `VIP ${pack.days}d`,
      stars,
    });

    return res.json({ success: true, invoiceUrl, purchaseToken: payload });
  } catch (error) {
    console.error('[POST /store/create-vip-invoice]', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Error al crear la factura VIP' });
  }
});

/**
 * POST /store/vip-purchase-status
 * Consulta si una compra VIP (invoice/payload) ya fue aplicada por webhook.
 */
router.post('/vip-purchase-status', authMiddleware, async (req, res) => {
  try {
    const purchaseToken = String(req.body?.purchaseToken ?? '').trim();
    if (!purchaseToken) {
      return res.status(400).json({ error: 'purchaseToken requerido' });
    }

    const parsed = parseInvoicePayload(purchaseToken);
    if (!parsed || parsed.kind !== 'vip') {
      return res.status(400).json({ error: 'purchaseToken VIP inválido' });
    }

    const userId = Number(req.user?.userId);
    if (!Number.isFinite(userId)) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    if (parsed.userId !== userId) {
      return res.status(403).json({ error: 'purchaseToken no pertenece al usuario autenticado' });
    }

    const tx = await Transaction.findOne({
      type: 'VIP_PURCHASE',
      reference_external_id: `vip_invoice:${purchaseToken}`,
    }).lean();

    if (!tx) {
      return res.json({ success: true, applied: false });
    }

    const user = await User.findById(userId).select('vip_status balance_subunits').lean();
    return res.json({
      success: true,
      applied: true,
      packId: parsed.packId,
      vipExpiresAt: user?.vip_status?.expiresAt ?? null,
      balance_subunits: Number(user?.balance_subunits || 0),
      appliedAt: tx.createdAt ?? null,
    });
  } catch (error) {
    console.error('[POST /store/vip-purchase-status]', error);
    return res.status(500).json({ error: 'Error consultando estado de compra VIP' });
  }
});

/**
 * POST /store/buy-vip-mock
 * Compra mock de paquete VIP (sin Telegram Stars) para prototipo.
 */
router.post('/buy-vip-mock', authMiddleware, async (req, res) => {
  try {
    const packId = String(req.body?.packId ?? '').trim();
    if (!packId) {
      return res.status(400).json({ error: 'packId requerido' });
    }

    const userId = req.user?.userId;
    if (userId == null) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    const result = await applyVipPackagePurchase({ userId, packId });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[POST /store/buy-vip-mock]', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Error al comprar VIP mock' });
  }
});

module.exports = router;
