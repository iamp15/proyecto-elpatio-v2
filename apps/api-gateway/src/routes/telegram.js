const express = require('express');
const {
  AppConfigManager,
  Transaction,
  createTransaction,
  SUBUNITS_PER_STONE,
  applyVipPackagePurchase,
} = require('@el-patio/database');
const { handleTelegramMessage } = require('../bot/messageHandler');
const { parseInvoicePayload } = require('../lib/invoicePayload');

const router = express.Router();

function getBotToken() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  return typeof botToken === 'string' && botToken.trim() ? botToken.trim() : null;
}

async function answerPreCheckoutQuery(preCheckoutQueryId) {
  const botToken = getBotToken();
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN no configurado');
  }

  const telegramRes = await fetch(
    `https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pre_checkout_query_id: preCheckoutQueryId,
        ok: true,
      }),
    },
  );

  const telegramJson = await telegramRes.json().catch(() => null);
  console.log('[telegram:webhook] answerPreCheckoutQuery:', {
    httpStatus: telegramRes.status,
    ok: telegramJson?.ok,
    description: telegramJson?.description,
    errorCode: telegramJson?.error_code,
  });

  if (!telegramJson?.ok) {
    throw new Error(telegramJson?.description || 'Telegram rechazó answerPreCheckoutQuery');
  }
}

async function handleSuccessfulPayment(successfulPayment) {
  const payload = successfulPayment.invoice_payload;
  const parsedPayload = parseInvoicePayload(payload);
  if (!parsedPayload) {
    throw Object.assign(new Error('Payload de invoice inválido'), { statusCode: 400 });
  }

  const { userId, kind, packId } = parsedPayload;

  const telegramChargeId = successfulPayment.telegram_payment_charge_id || null;
  const chargeReferenceExternalId = telegramChargeId
    ? `telegram_stars:${telegramChargeId}`
    : `telegram_stars:${payload}`;
  const vipInvoiceReferenceId = kind === 'vip' ? `vip_invoice:${payload}` : null;

  const existingTransaction = await Transaction.findOne({
    type: kind === 'vip' ? 'VIP_PURCHASE' : 'DEPOSIT',
    reference_external_id: kind === 'vip'
      ? { $in: [chargeReferenceExternalId, vipInvoiceReferenceId] }
      : chargeReferenceExternalId,
  }).lean();

  if (existingTransaction) {
    console.log('[telegram:webhook] Pago ya acreditado, ignorando duplicado:', {
      userId,
      packId,
      chargeReferenceExternalId,
    });
    return;
  }

  if (kind === 'vip') {
    const result = await applyVipPackagePurchase({ userId, packId });
    const transaction = await Transaction.create({
      user_id: userId,
      amount_subunits: 0,
      type: 'VIP_PURCHASE',
      status: 'COMPLETED',
      balance_after_subunits: Number(result.balance_subunits || 0),
      reference_external_id: vipInvoiceReferenceId,
    });

    console.log('[telegram:webhook] Compra VIP aplicada:', {
      userId,
      packId,
      vipExpiresAt: result.vipExpiresAt,
      vipInvoiceReferenceId,
      transactionId: transaction?._id,
    });
    return;
  }

  const config = AppConfigManager.getConfig();
  const storePackages = config.economy?.storePackages || [];
  const pack = storePackages.find((p) => p?.id === packId);
  if (!pack) {
    throw Object.assign(new Error(`Paquete no encontrado: ${packId}`), { statusCode: 400 });
  }

  const piedras = Math.trunc(Number(pack.piedras));
  if (!Number.isFinite(piedras) || piedras <= 0) {
    throw Object.assign(new Error(`Piedras inválidas para paquete: ${packId}`), { statusCode: 400 });
  }

  const amountSubunits = piedras * SUBUNITS_PER_STONE;
  const transaction = await createTransaction({
    userId,
    amount_subunits: amountSubunits,
    type: 'DEPOSIT',
    reference_external_id: chargeReferenceExternalId,
  });

  console.log('[telegram:webhook] Pago acreditado:', {
    userId,
    packId,
    piedras,
    amountSubunits,
    chargeReferenceExternalId,
    transactionId: transaction?._id,
  });
}

router.post('/webhook', async (req, res) => {
  try {
    console.log('[telegram:webhook] Update recibido:', {
      updateId: req.body?.update_id,
      hasPreCheckoutQuery: Boolean(req.body?.pre_checkout_query),
      hasSuccessfulPayment: Boolean(req.body?.message?.successful_payment),
      hasMessageText: Boolean(req.body?.message?.text),
    });

    const preCheckoutQuery = req.body?.pre_checkout_query;
    if (preCheckoutQuery) {
      await answerPreCheckoutQuery(preCheckoutQuery.id);
      return res.status(200).send();
    }

    const successfulPayment = req.body?.message?.successful_payment;
    if (successfulPayment) {
      await handleSuccessfulPayment(successfulPayment);
      return res.status(200).send();
    }

    const message = req.body?.message;
    if (message?.text) {
      handleTelegramMessage(message).catch((err) => {
        console.error('[telegram:webhook] Error manejando mensaje:', err);
      });
      return res.status(200).send();
    }

    return res.status(200).send();
  } catch (error) {
    console.error('[telegram:webhook] Error:', error);
    return res.status(error.statusCode || 500).send();
  }
});

module.exports = router;
