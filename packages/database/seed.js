const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, User, mongoose } = require('./index');

async function runSeed() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/el_patio_db';
    console.log('📍 Conectando a:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Oculta contraseña si la hay
    await connectDB(uri);
    const dbName = mongoose.connection.name;
    console.log('📍 Base de datos usada:', dbName);

    await User.deleteMany({});

    const tester = await User.create({
      _id: 12345678,
      username: 'TesterElPatio',
      balance_subunits: 5000,
      ton_wallet: 'v4R2_test_address',
    });

    console.log(`✅ ÉXITO: Usuario '${tester.username}' creado con ${tester.balance_subunits / 100} piedras.`);
  } catch (error) {
    console.error('❌ ERROR en el seed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada.');
    process.exit(0);
  }
}

runSeed();