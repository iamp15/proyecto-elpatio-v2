require('dotenv').config();
const { Telegraf } = require('telegraf');
const { startHandler, playHandler } = require('./handlers/commands');

const token = process.env.TELEGRAM_BOT_TOKEN;
const webappUrl = process.env.WEBAPP_URL || 'https://proyecto-elpatio-v2-webapp.vercel.app';

// #region agent log
(function () {
  const msg = '[webapp-debug] URL que abrirá el bot (menú y botones): ' + webappUrl;
  console.log(msg);
  fetch('http://127.0.0.1:7764/ingest/71f8e93f-57d3-49a1-a742-c61ccf85b56b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8922ac' }, body: JSON.stringify({ sessionId: '8922ac', location: 'index.js:startup', message: 'WEBAPP_URL at startup', data: { webappUrl, fromEnv: !!process.env.WEBAPP_URL }, timestamp: Date.now(), hypothesisId: 'A' }) }).catch(() => {});
})();
// #endregion

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.start(startHandler);
bot.command('jugar', playHandler);

bot.launch().then(async () => {
  console.log('Bot Telegram running');
  // #region agent log
  console.log('[webapp-debug] Menú del bot configurado con URL:', webappUrl);
  fetch('http://127.0.0.1:7764/ingest/71f8e93f-57d3-49a1-a742-c61ccf85b56b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8922ac' }, body: JSON.stringify({ sessionId: '8922ac', location: 'index.js:launch', message: 'Menu button URL', data: { webappUrl }, timestamp: Date.now(), hypothesisId: 'A' }) }).catch(() => {});
  // #endregion
  await bot.telegram.setChatMenuButton({
    menu_button: {
      type: 'web_app',
      text: 'Abrir El Patio',
      web_app: { url: webappUrl },
    },
  }).catch((err) => console.error('Menu button (opcional):', err.message));
}).catch((err) => {
  console.error('Bot failed to start:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
