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

app.use(cors());
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
