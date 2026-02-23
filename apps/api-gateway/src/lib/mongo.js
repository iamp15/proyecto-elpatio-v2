const mongoose = require('mongoose');

async function connectMongo() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/el_patio_db';
  await mongoose.connect(uri);
  const dbName = mongoose.connection.name;
  console.log('[Mongo] Conectado. Base de datos:', dbName);
}

module.exports = { connectMongo };
