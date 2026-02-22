const mongoose = require('mongoose');

async function connectMongo() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/elpatio';
  await mongoose.connect(uri);
}

module.exports = { connectMongo };
