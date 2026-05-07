/**
 * Manejo de mensajes de chat de Telegram vía Webhook (sin polling).
 * Una responsabilidad por archivo: respuestas a comandos con sendMessage.
 */

const WEBAPP_URL =
  process.env.WEBAPP_URL || 'https://proyecto-elpatio-v2-webapp.vercel.app';

function getBotToken() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  return typeof botToken === 'string' && botToken.trim() ? botToken.trim() : null;
}

function webAppReplyMarkup() {
  return {
    inline_keyboard: [
      [{ text: '🚀 Abrir webapp (login)', web_app: { url: WEBAPP_URL } }],
    ],
  };
}

async function telegramSendMessage(payload) {
  const botToken = getBotToken();
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN no configurado');
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!data?.ok) {
    console.error('[bot:messageHandler] sendMessage error:', data);
    throw new Error(data?.description || 'sendMessage falló');
  }
}

/**
 * @param {{ chat?: { id?: number }, text?: string }} message - Objeto `message` del update de Telegram
 */
async function handleTelegramMessage(message) {
  const chatId = message?.chat?.id;
  const rawText = typeof message?.text === 'string' ? message.text.trim() : '';
  if (chatId == null || !rawText) return;

  const firstToken = rawText.split(/\s+/)[0] || '';
  const command = firstToken.split('@')[0].toLowerCase();

  if (command === '/start') {
    await telegramSendMessage({
      chat_id: chatId,
      text:
        '¡Bienvenido a El Patio! 🎲\n\nUn club social de juegos clásicos. Pulsa el botón de abajo para abrir la webapp y probar el login con tu cuenta de Telegram.',
      reply_markup: webAppReplyMarkup(),
    });
    return;
  }

  if (command === '/jugar') {
    await telegramSendMessage({
      chat_id: chatId,
      text: 'Abre la webapp para jugar y usar tu cuenta:',
      reply_markup: webAppReplyMarkup(),
    });
  }
}

module.exports = { handleTelegramMessage };
