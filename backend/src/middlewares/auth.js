const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

/**
 * Middleware de autenticação para rotas HTTP Express
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
}

/**
 * Middleware de autenticação para conexões Socket.io
 */
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.name) {
      decoded.name = decoded.email === 'test@syncplay.com'
        ? 'Luna Martins'
        : (decoded.email ? decoded.email.split('@')[0] : 'Usuário');
    }
    socket.user = decoded; // { id, email, name, ... }
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
}

module.exports = {
  authenticateToken,
  socketAuthMiddleware,
};

