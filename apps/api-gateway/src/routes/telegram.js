const express = require('express');
const {
  AppConfigManager,
  Transaction,
  createTransaction,
  SUBUNITS_PER_STONE,
} = require('@el-patio/database');

const router = express.Router();

function getBotToken() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  return typeof botToken === 'string' && botToken.trim() ? botToken.trim() : null;
}

function parseInvoicePayload(payload) {
  if (typeof payload !== 'string') return null;

  const separatorIndex = payload.indexOf('_');
  if (separatorIndex <= 0 || separatorIndex === payload.length - 1) return null;

  const userId = Number(payload.slice(0, separatorIndex));
  const packId = payload.slice(separatorIndex + 1);
  if (!Number.isFinite(userId) || !packId) return null;

  return { userId, packId };
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

  const { userId, packId } = parsedPayload;
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

  const telegramChargeId = successfulPayment.telegram_payment_charge_id || null;
  const referenceExternalId = telegramChargeId
    ? `telegram_stars:${telegramChargeId}`
    : `telegram_stars:${payload}`;

  const existingTransaction = await Transaction.findOne({
    type: 'DEPOSIT',
    reference_external_id: referenceExternalId,
  }).lean();

  if (existingTransaction) {
    console.log('[telegram:webhook] Pago ya acreditado, ignorando duplicado:', {
      userId,
      packId,
      referenceExternalId,
    });
    return;
  }

  const amountSubunits = piedras * SUBUNITS_PER_STONE;
  const transaction = await createTransaction({
    userId,
    amount_subunits: amountSubunits,
    type: 'DEPOSIT',
    reference_external_id: referenceExternalId,
  });

  console.log('[telegram:webhook] Pago acreditado:', {
    userId,
    packId,
    piedras,
    amountSubunits,
    referenceExternalId,
    transactionId: transaction?._id,
  });
}

router.post('/webhook', async (req, res) => {
  try {
    console.log('[telegram:webhook] Update recibido:', {
      updateId: req.body?.update_id,
      hasPreCheckoutQuery: Boolean(req.body?.pre_checkout_query),
      hasSuccessfulPayment: Boolean(req.body?.message?.successful_payment),
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

    return res.status(200).send();
  } catch (error) {
    console.error('[telegram:webhook] Error:', error);
    return res.status(error.statusCode || 500).send();
  }
});

module.exports = router;
