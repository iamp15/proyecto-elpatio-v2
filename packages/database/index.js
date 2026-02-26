const mongoose = require('mongoose');
const User = require('./models/User');
const GameSession = require('./models/GameSession');
const Transaction = require('./models/Transaction');
const DominoMatch = require('./models/DominoMatch');
const LudoMatch = require('./models/LudoMatch');
const { createTransaction } = require('./services/createTransaction');

// Configuramos para que Mongoose use promesas modernas
mongoose.Promise = global.Promise;

/**
 * Función para conectar a la base de datos.
 * @param {string} uri - El string de conexión (de .env)
 */
const connectDB = async (uri) => {
  try {
    if (!uri) throw new Error("Falta la URI de MongoDB en las variables de entorno");

    await mongoose.connect(uri, {
      // Configuraciones recomendadas para evitar avisos de deprecación
      autoIndex: true, 
    });

    console.log('🍃 MongoDB Conectado exitosamente');
  } catch (err) {
    console.error('❌ Error de conexión a MongoDB:', err.message);
    process.exit(1);
  }
};

// Exportamos la conexión, los modelos y el servicio de transacciones
module.exports = {
  connectDB,
  createTransaction,
  User,
  GameSession,
  Transaction,
  DominoMatch,
  LudoMatch,
  mongoose,
};