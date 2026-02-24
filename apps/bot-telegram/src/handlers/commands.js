const WEBAPP_URL = process.env.WEBAPP_URL || 'https://proyecto-elpatio-v2-webapp.vercel.app';

function startHandler(ctx) {
  // #region agent log
  console.log('[webapp-debug] /start → URL en botón inline:', WEBAPP_URL);
  fetch('http://127.0.0.1:7764/ingest/71f8e93f-57d3-49a1-a742-c61ccf85b56b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8922ac' }, body: JSON.stringify({ sessionId: '8922ac', location: 'commands.js:startHandler', message: 'URL in inline button', data: { WEBAPP_URL }, timestamp: Date.now(), hypothesisId: 'B' }) }).catch(() => {});
  // #endregion
  return ctx.reply(
    '¡Bienvenido a El Patio! 🎲\n\nUn club social de juegos clásicos. Pulsa el botón de abajo para abrir la webapp y probar el login con tu cuenta de Telegram.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Abrir webapp (login)', web_app: { url: WEBAPP_URL } }],
        ],
      },
    }
  );
}

function playHandler(ctx) {
  // #region agent log
  console.log('[webapp-debug] /jugar → URL en botón inline:', WEBAPP_URL);
  fetch('http://127.0.0.1:7764/ingest/71f8e93f-57d3-49a1-a742-c61ccf85b56b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8922ac' }, body: JSON.stringify({ sessionId: '8922ac', location: 'commands.js:playHandler', message: 'URL in inline button', data: { WEBAPP_URL }, timestamp: Date.now(), hypothesisId: 'B' }) }).catch(() => {});
  // #endregion
  return ctx.reply('Abre la webapp para jugar y usar tu cuenta:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Abrir webapp (login)', web_app: { url: WEBAPP_URL } }],
      ],
    },
  });
}

module.exports = { startHandler, playHandler };
