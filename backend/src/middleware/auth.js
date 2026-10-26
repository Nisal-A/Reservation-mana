const jwt = require('jsonwebtoken');
const env = require('../config/env');
const pool = require('../config/db');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.', errors: [] });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.', errors: [] });
  }

  try {
    const [rows] = await pool.query(
      'SELECT user_id, username, role, is_active FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ message: 'User account is inactive or not found.', errors: [] });
    }

    req.user = {
      ...decoded,
      role: rows[0].role,
      is_active: Boolean(rows[0].is_active),
    };
    next();
  } catch (err) {
    next(err);
  }
};

const requireRole = (...roles) => {
  const middleware = (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.', errors: [] });
    }
    next();
  };
  middleware.roles = roles;
  Object.defineProperty(middleware, 'name', {
    value: `requireRole(${roles.join(',')})`,
    configurable: true,
  });
  return middleware;
};

module.exports = { verifyToken, requireRole };
