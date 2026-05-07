const express = require('express');
const { AppConfigManager, User, ITEM_CATALOG, SUBUNITS_PER_STONE } = require('@el-patio/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function toPositiveInt(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveCouponItem(rawItemId) {
  const match = /^(.+)_x(\d+)$/.exec(rawItemId);
  if (!match) return null;
  const [, itemId, rawQty] = match;
  const quantity = toPositiveInt(rawQty);
  if (!itemId.startsWith('coupon_') || quantity == null) return null;
  return { itemId, quantity };
}

function upsertInventoryItem(user, itemId, quantityToAdd, now) {
  const existing = Array.isArray(user.inventory)
    ? user.inventory.find((entry) => entry?.itemId === itemId)
    : null;

  if (existing) {
    existing.quantity = Number(existing.quantity || 0) + quantityToAdd;
    return;
  }

  const catalog = ITEM_CATALOG?.[itemId];
  const isCoupon = itemId.startsWith('coupon_');
  user.inventory.push({
    itemId,
    category: catalog?.category ?? (isCoupon ? 'consumable' : 'cosmetic'),
    subType: catalog?.subType ?? (isCoupon ? 'league_coupon' : 'profile_badge'),
    quantity: quantityToAdd,
    isEquipped: false,
    acquiredAt: now,
  });
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

    const config = AppConfigManager.getConfig();
    const vipPackages = config.economy?.vipPackages || {};
    const pack = vipPackages[packId];
    if (!pack) {
      return res.status(400).json({ error: 'Paquete VIP no encontrado' });
    }

    const days = toPositiveInt(pack.days);
    if (days == null) {
      return res.status(400).json({ error: 'Paquete VIP inválido (days)' });
    }

    const userId = req.user?.userId;
    if (userId == null) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!Array.isArray(user.inventory)) {
      user.inventory = [];
    }

    const now = new Date();
    const currentExpiryMs = new Date(user.vip_status?.expiresAt).getTime();
    const baseExpiryMs = Number.isFinite(currentExpiryMs) && currentExpiryMs > now.getTime()
      ? currentExpiryMs
      : now.getTime();
    const nextExpiry = new Date(baseExpiryMs + days * 24 * 60 * 60 * 1000);

    user.vip_status = {
      is_vip: true,
      start_date: user.vip_status?.start_date ?? now,
      expiresAt: nextExpiry,
    };

    const grantedItems = [];
    const items = Array.isArray(pack.items) ? pack.items : [];
    for (const rawItemId of items) {
      if (typeof rawItemId !== 'string' || rawItemId.length === 0) continue;
      const coupon = resolveCouponItem(rawItemId);

      if (coupon) {
        upsertInventoryItem(user, coupon.itemId, coupon.quantity, now);
        grantedItems.push({ itemId: coupon.itemId, quantity: coupon.quantity });
        continue;
      }

      const alreadyOwned = user.inventory.some((entry) => entry?.itemId === rawItemId);
      if (alreadyOwned) continue;

      upsertInventoryItem(user, rawItemId, 1, now);
      grantedItems.push({ itemId: rawItemId, quantity: 1 });
    }

    const stones = Math.max(0, Math.trunc(Number(pack.stones || 0)));
    if (stones > 0) {
      user.balance_subunits = Number(user.balance_subunits || 0) + stones * SUBUNITS_PER_STONE;
    }

    await user.save();

    return res.json({
      success: true,
      packageId: packId,
      vipExpiresAt: nextExpiry,
      grantedItems,
      addedStones: stones,
      balance_subunits: user.balance_subunits,
      piedras: Math.floor(Number(user.balance_subunits || 0) / SUBUNITS_PER_STONE),
    });
  } catch (error) {
    console.error('[POST /store/buy-vip-mock]', error);
    return res.status(500).json({ error: 'Error al comprar VIP mock' });
  }
});

module.exports = router;
