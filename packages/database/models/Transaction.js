const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Referencia al dueño de las piedras
  user_id: { 
    type: Number, 
    ref: 'User', 
    required: true,
    index: true // Indexado para búsquedas rápidas de historial
  },

  // Monto en SUB-UNIDADES (Ej: -500 para una apuesta de 5 piedras)
  // Usamos Number porque estamos en el sistema de sub-unidades enteras
  amount_subunits: { 
    type: Number, 
    required: true 
  },

  // Tipo de movimiento para categorizar en el Dashboard
  type: { 
    type: String, 
    required: true, 
    enum: [
      'DEPOSIT',    // Compra vía Telegram Stars
      'WITHDRAW',   // Retiro a TON Wallet
      'BET',        // Pago de entrada a mesa
      'WIN',        // Premio por ganar partida
      'REFUND',     // Devolución (ej: partida cancelada)
      'COMMISSION'  // El "Rake" o comisión del patio
    ] 
  },

  // Relación opcional: Si es BET o WIN, apuntamos a la sesión
  game_session_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'GameSession',
    default: null
  },

  // Estado de la transacción
  status: { 
    type: String, 
    default: 'COMPLETED', 
    enum: ['PENDING', 'COMPLETED', 'FAILED'] 
  },

  // Balance resultante DESPUÉS de esta transacción (Snaphot)
  // Muy útil para auditorías: "Después de esta apuesta, al usuario le quedaron X"
  balance_after_subunits: { 
    type: Number, 
    required: true 
  },

  // Referencia externa (ID de pago de Telegram o Hash de TON)
  reference_external_id: { 
    type: String, 
    default: null 
  }

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true } 
});

// --- HELPERS (VIRTUALS) ---

// Monto legible en Piedras
transactionSchema.virtual('amount_display').get(function() {
  return this.amount_subunits / 100;
});

// Balance resultante legible
transactionSchema.virtual('balance_after_display').get(function() {
  return this.balance_after_subunits / 100;
});

module.exports = mongoose.model('Transaction', transactionSchema);