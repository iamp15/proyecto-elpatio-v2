const mongoose = require('mongoose');

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

async function connectMongo() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/el_patio_db';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri);
      const dbName = mongoose.connection.name;
      console.log('[Mongo] Conectado. Base de datos:', dbName);
      return;
    } catch (err) {
      console.error(`[Mongo] Intento ${attempt}/${MAX_RETRIES} fallido:`, err.message);
      if (attempt === MAX_RETRIES) throw err;
      await mongoose.disconnect().catch(() => {});
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

module.exports = { connectMongo };
