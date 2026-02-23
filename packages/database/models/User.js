const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: { type: Number, required: true }, // Telegram ID
  // Guardamos en sub-unidades (ej: 100 unidades = 1 Piedra)
  balance_subunits: {
    type: Number,
    default: 0,
  },
  username: String,
  ton_wallet: String
}, { timestamps: true });

// Helper para convertir a Piedras "legibles" en la interfaz
userSchema.virtual('piedras_display').get(function() {
  return Math.floor(this.balance_subunits / 100);
});

module.exports = mongoose.model('User', userSchema);