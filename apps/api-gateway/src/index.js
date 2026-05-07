require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectMongo } = require('./lib/mongo');
const { AppConfigManager } = require('@el-patio/database');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const balanceRoutes = require('./routes/balance');
const walletRoutes = require('./routes/wallet');
const configRoutes = require('./routes/config');
const inventoryRoutes = require('./routes/inventory');
const userRoutes = require('./routes/user');
const storeRoutes = require('./routes/store');
const telegramRoutes = require('./routes/telegram');

const app = express();
const PORT = process.env.PORT || 3000;

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/balance', balanceRoutes);
app.use('/wallet', walletRoutes);
app.use('/config', configRoutes);
app.use('/store', storeRoutes);
app.use('/telegram', telegramRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/user', userRoutes);

app.use(errorHandler);

connectMongo()
  .then(async () => {
    await AppConfigManager.loadConfigFromDB();
    app.listen(PORT, () => {
      console.log(`API Gateway running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
