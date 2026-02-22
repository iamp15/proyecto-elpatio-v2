const WEBAPP_URL = process.env.WEBAPP_URL || 'https://tu-webapp.vercel.app';

function startHandler(ctx) {
  return ctx.reply(
    '¡Bienvenido a El Patio! 🎲\n\nUn club social de juegos clásicos. Usa /jugar para abrir la Mini App.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Abrir El Patio', web_app: { url: WEBAPP_URL } }],
        ],
      },
    }
  );
}

function playHandler(ctx) {
  return ctx.reply('Abre la Mini App para jugar:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Jugar', web_app: { url: WEBAPP_URL } }],
      ],
    },
  });
}

module.exports = { startHandler, playHandler };
