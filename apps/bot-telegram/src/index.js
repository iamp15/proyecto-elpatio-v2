require('dotenv').config();
const { Telegraf } = require('telegraf');
const { startHandler, playHandler } = require('./handlers/commands');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.start(startHandler);
bot.command('jugar', playHandler);

bot.launch().then(() => {
  console.log('Bot Telegram running');
}).catch((err) => {
  console.error('Bot failed to start:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
