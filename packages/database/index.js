const mongoose = require('mongoose');
const User = require('./models/User');
const GameSession = require('./models/GameSession');
const Transaction = require('./models/Transaction');
const DominoMatch = require('./models/DominoMatch');
const LudoMatch = require('./models/LudoMatch');
const AppConfig = require('./models/AppConfig');
const AppConfigManager = require('./services/AppConfigManager');
const ITEM_CATALOG = require('./catalog/itemCatalog.json');
const { createTransaction } = require('./services/createTransaction');
const { checkAndRefillDailyCoupons } = require('./services/inventoryService');
const { revokeConditionalItem } = require('./services/inventoryRevocation');
const {
  COUPON_SUPPORTED_LEAGUES,
  normalizeCouponLeagueId,
  hasLeagueEntryCoupon,
  tryConsumeLeagueCouponForEntryFee,
  restoreLeagueCouponAfterRollback,
  hasBronzeLeagueCoupon,
  tryConsumeBronzeCouponForEntryFee,
  restoreBronzeCouponAfterRollback,
} = require('./services/leagueCouponEntryFee');
const { runDominoSettlement } = require('./services/runDominoSettlement');
const {
  SUBUNITS_PER_STONE,
  toWholeStoneSubunits,
  subunitsToStonesFloor,
} = require('./utils/stoneEconomy');
const { isVipEffective, isUserVip } = require('./utils/isVipEffective');
const { CURRENT_SEASON } = require('./utils/currentSeason');

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
  checkAndRefillDailyCoupons,
  revokeConditionalItem,
  COUPON_SUPPORTED_LEAGUES,
  normalizeCouponLeagueId,
  hasLeagueEntryCoupon,
  tryConsumeLeagueCouponForEntryFee,
  restoreLeagueCouponAfterRollback,
  hasBronzeLeagueCoupon,
  tryConsumeBronzeCouponForEntryFee,
  restoreBronzeCouponAfterRollback,
  runDominoSettlement,
  User,
  GameSession,
  Transaction,
  DominoMatch,
  LudoMatch,
  AppConfig,
  AppConfigManager,
  SUBUNITS_PER_STONE,
  toWholeStoneSubunits,
  subunitsToStonesFloor,
  isVipEffective,
  isUserVip,
  CURRENT_SEASON,
  ITEM_CATALOG,
  mongoose,
};