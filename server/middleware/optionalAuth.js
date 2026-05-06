const jwt = require('jsonwebtoken');
const { User } = require('../models');

module.exports = async function (req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    // No auth header, continue as unauthenticated
    req.user = null;
    return next();
  }

  const token = auth.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change_me');
    const user = await User.findByPk(payload.id);
    if (user) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (err) {
    // Invalid token, continue as unauthenticated
    req.user = null;
  }
  next();
};
