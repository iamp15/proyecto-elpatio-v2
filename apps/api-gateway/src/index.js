require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectMongo } = require('./lib/mongo');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const balanceRoutes = require('./routes/balance');

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

app.use(errorHandler);

connectMongo()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API Gateway running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
