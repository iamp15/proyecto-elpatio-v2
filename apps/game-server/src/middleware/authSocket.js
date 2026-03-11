const jwt = require('jsonwebtoken');
const { User } = require('@el-patio/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * Middleware de Socket.io que valida el JWT del handshake y carga
 * los datos actualizados del usuario desde MongoDB.
 *
 * El cliente debe enviar el token en:
 *   socket = io(url, { auth: { token: '<JWT>' } })
 *
 * Si la autenticación es exitosa, popula socket.data con:
 *   { userId: number, balance_subunits: number, pr: number, rank: string }
 *
 * Si falla, rechaza la conexión con error 'AUTH_FAILED'.
 */
async function authSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') {
      return next(Object.assign(new Error('AUTH_FAILED'), { data: { reason: 'Token no proporcionado' } }));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return next(Object.assign(new Error('AUTH_FAILED'), { data: { reason: 'Token inválido o expirado' } }));
    }

    const userId = Number(decoded.userId);
    if (!userId || Number.isNaN(userId)) {
      return next(Object.assign(new Error('AUTH_FAILED'), { data: { reason: 'userId inválido en el token' } }));
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return next(Object.assign(new Error('AUTH_FAILED'), { data: { reason: 'Usuario no encontrado' } }));
    }

    socket.data.userId          = userId;
    socket.data.balance_subunits = user.balance_subunits;
    socket.data.pr              = user.pr   ?? 1000;
    socket.data.rank            = user.rank ?? 'BRONCE';

    next();
  } catch (err) {
    console.error('[authSocket] Error inesperado:', err.message);
    next(Object.assign(new Error('AUTH_FAILED'), { data: { reason: 'Error interno de autenticación' } }));
  }
}

module.exports = { authSocket };
