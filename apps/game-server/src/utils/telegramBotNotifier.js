/**
 * Stub para notificaciones del bot de Telegram
 * Estructura preparada para conexión futura
 */
class TelegramBotNotifier {
  constructor() {
    this.isEnabled = false;
    this.botToken = null;
  }

  /**
   * Configurar el bot (stub)
   */
  configure({ botToken, enabled = true }) {
    this.botToken = botToken;
    this.isEnabled = enabled;
    console.log('[TelegramBot] Configuración actualizada, enabled:', enabled);
  }

  /**
   * Enviar mensaje a usuario (stub)
   */
  async sendMessage(userId, message) {
    // Esto es un stub - en producción se conectaría a la API de Telegram
    console.log(`[TelegramBot] Mensaje a userId=${userId}: "${message}"`);
    
    // Estructura preparada para implementación real:
    // if (this.isEnabled && this.botToken) {
    //   const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       chat_id: userId,
    //       text: message,
    //       parse_mode: 'HTML'
    //     })
    //   });
    //   return await response.json();
    // }
    
    return { stub: true, userId, message };
  }
}

// Exportar singleton
const telegramBotNotifier = new TelegramBotNotifier();
module.exports = telegramBotNotifier;