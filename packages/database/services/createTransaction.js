const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * Crea una transacción de Piedras de forma atómica usando MongoDB Sessions.
 * Garantiza que el balance del usuario y el registro de la transacción
 * se actualicen en un mismo bloque atómico, previniendo inconsistencias.
 *
 * @param {Object} params
 * @param {number}  params.userId               - Telegram ID del usuario (_id en User)
 * @param {number}  params.amount_subunits       - Monto en sub-unidades (negativo para débitos)
 * @param {string}  params.type                  - Tipo: 'DEPOSIT' | 'WITHDRAW' | 'BET' | 'WIN' | 'REFUND' | 'COMMISSION'
 * @param {string}  [params.game_session_id]     - ObjectId de la sesión de juego (opcional)
 * @param {string}  [params.reference_external_id] - ID externo de pago/TON (opcional)
 * @returns {Promise<Object>} El documento Transaction creado
 * @throws {Error} Con código 'SALDO_INSUFICIENTE' si el balance es menor al débito
 */
async function createTransaction({
  userId,
  amount_subunits,
  type,
  game_session_id = null,
  reference_external_id = null,
}) {
  if (typeof userId !== 'number' || isNaN(userId)) {
    throw Object.assign(new Error('userId debe ser un número válido'), { statusCode: 400 });
  }
  if (typeof amount_subunits !== 'number' || amount_subunits === 0) {
    throw Object.assign(new Error('amount_subunits debe ser un número distinto de cero'), { statusCode: 400 });
  }

  const session = await mongoose.startSession();
  let createdTransaction;

  try {
    await session.withTransaction(async () => {
      // Construimos el filtro: si es un débito, el usuario debe tener saldo suficiente.
      // La condición $gte se evalúa y aplica de forma atómica, eliminando el race condition.
      const isDebit = amount_subunits < 0;
      const userFilter = { _id: userId };
      if (isDebit) {
        userFilter.balance_subunits = { $gte: Math.abs(amount_subunits) };
      }

      const updatedUser = await User.findOneAndUpdate(
        userFilter,
        { $inc: { balance_subunits: amount_subunits } },
        { new: true, session },
      );

      if (!updatedUser) {
        if (isDebit) {
          throw Object.assign(
            new Error('Saldo insuficiente para realizar esta operación'),
            { code: 'SALDO_INSUFICIENTE', statusCode: 402 },
          );
        }
        throw Object.assign(
          new Error('Usuario no encontrado'),
          { statusCode: 404 },
        );
      }

      const [transaction] = await Transaction.create(
        [
          {
            user_id: userId,
            amount_subunits,
            type,
            game_session_id,
            reference_external_id,
            status: 'COMPLETED',
            balance_after_subunits: updatedUser.balance_subunits,
          },
        ],
        { session },
      );

      createdTransaction = transaction;
    });
  } finally {
    session.endSession();
  }

  return createdTransaction;
}

module.exports = { createTransaction };
